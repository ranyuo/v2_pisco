<?php
declare(strict_types=1);
// Alcance de la intranet (mismo enfoque que v2_palpa): siete módulos de gestión y la web institucional fuera de la aplicación.
ob_start();require __DIR__.'/regressions.php';
function refuses(callable $f,int $status,string $text,string $name): void {try{$f();}catch(PortalError $e){verify($e->status===$status&&str_contains($e->getMessage(),$text),$name.' ('.$e->getMessage().')');return;}throw new RuntimeException('FAIL: '.$name.' was accepted');}
$admin=function()use($app,$password){$app->logout();$app->login(['username'=>'qaadmin','password'=>$password]);};
$change=function(callable $edit)use($app){$s=$app->bootstrap();$before=$s['data'];$after=$before;$edit($after);$patch=[];foreach($after as $k=>$v)if(!PortalPolicy::equal($v,$before[$k]??null))$patch[]=['path'=>[$k],'kind'=>'value','before'=>$before[$k]??null,'after'=>$v];return $app->save(['revision'=>$s['revision'],'patch'=>$patch]);};
$admin();
$b=$app->bootstrap();
verify(($b['scope']['mode']??'')==='intranet'&&str_starts_with($b['scope']['website'],'https://'),'Application identifies itself as an intranet with the institutional website link');
verify(count(array_intersect(['ix-horarios','ix-certificados','ix-titulos','expedientes','reclamos','ix-bolsa','cvdocente'],$b['scope']['modules']))===7,'The seven functional modules are in scope');
verify($b['data']['noticias']===[]&&$b['data']['slides']===[]&&$b['data']['admisiones']===[]&&$b['data']['tupa']===[],'Editorial collections are excluded even for the administrator');
verify(!array_filter($b['data']['paginas'],fn($p)=>!in_array($p['clave']??'',['privacidad','terminos','docentes'],true)),'Only legal pages and the teacher directory text remain');
$raw=json_decode($app->db()->query('SELECT data FROM pisco_state WHERE id=1')->fetchColumn(),true);
verify(count($raw['noticias']??[])>0,'Editorial data is kept in the database (not deleted)');
foreach(['noticias','paginas','admisiones','tupa','enlaces','slides'] as $key)refuses(fn()=>$change(function(&$d)use($key){$d[$key][]=['id'=>'intrusion','titulo'=>'X'];}),403,'web institucional','Server rejects editorial write: '.$key);
refuses(fn()=>$change(function(&$d){$d['config']['home']=['cifras'=>[]];}),403,'web institucional','Server rejects home page settings');
refuses(fn()=>$change(function(&$d){$d['config']['diseno']='moderno';}),403,'web institucional','Server rejects website design settings');
$change(function(&$d){$d['config']['inst']['telefono']='056 000000';});
verify($app->bootstrap()['data']['config']['inst']['telefono']==='056 000000','Institution data is still editable');
refuses(fn()=>PortalPolicy::validateRoles(['secretaria'=>['label'=>'Secretaría','mods'=>['dashboard','noticias']]]),422,'ámbito','Roles cannot enable modules outside the intranet');
verify(!PortalPolicy::can(['rol'=>'admin'],'noticias')&&PortalPolicy::can(['rol'=>'admin'],'ix-bolsa'),'Even the administrator only has intranet modules');
foreach(PortalPolicy::definitions()['roles'] as $key=>$role)verify(!array_diff($role['mods'],IntranetScope::MODULES),'Role '.$key.' only lists intranet modules');
$app->logout();
refuses(fn()=>$app->submit('mensajes',[]),404,'alcance','Contact form of the old website disabled');
refuses(fn()=>$app->submit('suscriptores',[]),404,'alcance','Newsletter form of the old website disabled');
refuses(fn()=>$app->lookup('becarios',['reference'=>'12345678']),404,'no disponible','Scholarship lookup of the old website disabled');
$pub=$app->bootstrap();verify($pub['data']['noticias']===[]&&($pub['scope']['mode']??'')==='intranet','Visitors also receive no editorial content');
echo "$passed total checks passed.\n";
