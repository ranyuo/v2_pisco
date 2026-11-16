<?php
declare(strict_types=1);
// Bolsa Laboral (Informe N.º 011, observación 5): ingreso por perfil, privacidad entre empresas y diseño configurable.
ob_start();require __DIR__.'/regressions.php';
function ruc(string $first10): string {$w=[5,4,3,2,7,6,5,4,3,2];$s=0;foreach($w as $i=>$x)$s+=(int)$first10[$i]*$x;$d=11-$s%11;if($d===10)$d=0;if($d===11)$d=1;return $first10.$d;}
function patch(PortalApp $app,array $path,mixed $after): array {$s=$app->bootstrap();$before=$s['data'];foreach($path as $k)$before=$before[$k]??null;return $app->save(['revision'=>$s['revision'],'patch'=>[['path'=>$path,'kind'=>'value','before'=>$before,'after'=>$after]]]);}
function refuses(callable $f,int $status,string $text,string $name): void {try{$f();}catch(PortalError $e){verify($e->status===$status&&str_contains($e->getMessage(),$text),$name.' ('.$e->getMessage().')');return;}throw new RuntimeException('FAIL: '.$name.' was accepted');}
function bolsa(PortalApp $app,array $bolsa): array {$config=$app->bootstrap()['data']['config'];return patch($app,['config'],[...$config,'bolsa'=>$bolsa]);}
function as_user(PortalApp $app,string $user,string $password,?string $profile=null): void {$app->logout();$input=['username'=>$user,'password'=>$password];if($profile!==null)$input['perfil']=$profile;$app->login($input);}
$admin=fn()=>as_user($app,'qaadmin',$password);
$admin();
$today=date('Y-m-d');$later=date('Y-m-d',strtotime('+30 days'));
$state=$app->bootstrap()['data'];$person=$state['personas'][0]['id'];
$students=$state['academico']['estudiantes'];
$grad=['id'=>2,'dni'=>'00000002','nom'=>'QA Egresada','prog'=>1,'periodo'=>'2024-I','ciclo'=>'VI','sec'=>'A','turno'=>'Mañana','estado'=>'Egresado','correo'=>'egresada@example.test'];
saveRows($app,'estudiantes',[...$students,$grad]);
saveRows($app,'docentes',[['id'=>1,'per'=>$person,'dias'=>['Lun'],'desde'=>'08:00','hasta'=>'12:00','uds'=>[]]]);
$ruc1=ruc('2012345678');$ruc2=ruc('2098765432');
saveRows($app,'empresas',[
 ['id'=>1,'ruc'=>$ruc1,'nom'=>'QA Empresa Uno','sector'=>'Servicios','ubic'=>'Pisco','contacto'=>'QA Contacto','correo'=>'uno@example.test','validada'=>true],
 ['id'=>2,'ruc'=>$ruc2,'nom'=>'QA Empresa Dos','sector'=>'Comercio','ubic'=>'Ica','contacto'=>'QA Contacto Dos','correo'=>'dos@example.test','validada'=>true]]);
$offer=fn(int $id,int $emp,string $estado,string $limit)=>['id'=>$id,'emp'=>$emp,'puesto'=>'QA Puesto '.$id,'desc'=>'Descripción de prueba','req'=>'Requisitos de prueba','modal'=>'Presencial','prog'=>'','vac'=>1,'limite'=>$limit,'estado'=>$estado,'fecha'=>$today];
saveRows($app,'ofertas',[$offer(1,1,'Publicada',$later),$offer(2,2,'Publicada',$later),$offer(3,1,'Cerrada',$later)]);
$app->createAccount(['username'=>'qadocente','name'=>'QA Docente','password'=>$password,'role'=>'docente','vin'=>'doc:1']);
$app->createAccount(['username'=>'qaempresa','name'=>'QA Empresa Uno','password'=>$password,'role'=>'empresa','vin'=>'emp:1']);
$app->createAccount(['username'=>'qaempresa2','name'=>'QA Empresa Dos','password'=>$password,'role'=>'empresa','vin'=>'emp:2']);
$app->createAccount(['username'=>'qaegresada','name'=>'QA Egresada','password'=>$password,'role'=>'egresado','vin'=>'est:2']);
verify(!PortalPolicy::can(['rol'=>'docente'],'ix-bolsa'),'Teacher role no longer includes the Bolsa Laboral module');

// Ingreso por perfil: cada tarjeta admite solo su tipo de cuenta.
refuses(fn()=>as_user($app,'qadocente',$password,'docente'),422,'Perfil de ingreso','The Docente card no longer exists');
refuses(fn()=>as_user($app,'qadocente',$password,'empresa'),403,'no corresponde','Teacher account rejected by the Empresa card');
verify($app->user()===null,'Rejected profile login leaves no session');
as_user($app,'qaegresada',$password,'estudiante');verify($app->user()['rol']==='egresado','Graduate signs in through the Estudiante/Egresado card');
as_user($app,'qaempresa',$password,'empresa');verify($app->user()['rol']==='empresa','Company signs in through the Empresa card');
as_user($app,'qaadmin',$password,'administrador');verify($app->user()['rol']==='admin','Administrator signs in through the Administrador card');
refuses(fn()=>as_user($app,'qadocente',$password,'estudiante'),403,'no corresponde','Teacher account rejected by the Estudiante/Egresado card');
refuses(fn()=>as_user($app,'qaempresa',$password,'administrador'),403,'no corresponde','Company rejected by the Administrador card');
refuses(fn()=>as_user($app,'qadocente',$password,'rector'),422,'Perfil de ingreso','Unknown login profile rejected');
refuses(fn()=>as_user($app,'qadocente','incorrecta-123','estudiante'),422,'Usuario o contraseña incorrectos','Wrong password keeps the generic message');

// Sin recomendaciones: el docente no recibe datos de la Bolsa y la empresa solo ve a quienes postularon.
as_user($app,'qadocente',$password);$view=$app->bootstrap()['data']['academico'];
verify(!isset($view['recomendaciones'])&&empty($view['postulaciones'])&&empty($view['perfilesLab'])&&!str_contains(json_encode($view['empresas']??[]),'uno@example.test'),'Teacher gets no Bolsa data, applications, CVs or company contacts');
$admin();$acad=$app->bootstrap()['data']['academico'];
patch($app,['academico','perms'],[...$acad['perms'],'doc'=>[...($acad['perms']['doc']??[]),'bolsa'=>2]]);
as_user($app,'qadocente',$password);$view=$app->bootstrap()['data']['academico'];
verify(empty($view['postulaciones'])&&empty($view['perfilesLab']),'Teacher gets no applications or CVs even if the matrix grants a Bolsa level');
$emps=$view['empresas']??[];if($emps){$emps[0]['validada']=false;refuses(fn()=>patch($app,['academico','empresas'],$emps),403,'empresas','Teacher cannot modify companies even with a Bolsa level');}else verify(true,'Teacher cannot modify companies even with a Bolsa level (not visible)');
$admin();patch($app,['academico','perms'],$acad['perms']);
verify(!isset($acad['recomendaciones']),'Recommendation data is no longer kept');
as_user($app,'qaempresa',$password,'empresa');$company=$app->bootstrap()['data']['academico'];
verify(!array_filter($company['estudiantes'],fn($e)=>$e['id']===2),'Company does not see a graduate who has not applied');
verify(!array_filter($company['perfilesLab']??[],fn($r)=>($r['est']??null)===2),'Company does not receive the CV of a person who has not applied');
$legacy=PortalContent::normalize(['config'=>['bolsa'=>['perfiles'=>['docente'=>['img'=>''],'empresa'=>['img'=>'']]]],'academico'=>['recomendaciones'=>[['id'=>1]]]]);
verify(!isset($legacy['academico']['recomendaciones'])&&!isset($legacy['config']['bolsa']['perfiles']['docente']),'Existing installs drop recommendation data and the Docente card');
$admin();
// Instalaciones anteriores: los valores de la página pública los completa el servidor (el navegador no cambia la configuración al abrirla).
$db=$app->db();$db->exec("UPDATE pisco_state SET data=JSON_REMOVE(data,'$.config.bolsa.diseno','$.config.bolsa.titulo','$.config.bolsa.perfiles') WHERE id=1");
$fixed=PortalContent::normalize(json_decode($db->query('SELECT data FROM pisco_state WHERE id=1')->fetchColumn(),true))['config']['bolsa'];
verify(($fixed['diseno']??'')==='actual'&&isset($fixed['perfiles']['estudiante'])&&($fixed['titulo']??'')!=='','Existing installs get the public-page defaults from the server');
// Diseño configurable de la página pública.
$bolsa=$app->bootstrap()['data']['config']['bolsa'];
verify(($bolsa['diseno']??'')==='actual'&&isset($bolsa['perfiles']['estudiante'])&&!isset($bolsa['perfiles']['docente']),'Default public design is the current one, with default card photos');
refuses(fn()=>bolsa($app,[...$bolsa,'diseno'=>'otro']),422,'Diseño de la Bolsa','Unknown public design rejected');
refuses(fn()=>bolsa($app,[...$bolsa,'titulo'=>str_repeat('x',121)]),422,'120','Title over 120 characters rejected');
refuses(fn()=>bolsa($app,[...$bolsa,'perfiles'=>['estudiante'=>['img'=>'javascript:alert(1)']]]),422,'foto','Unsafe card photo rejected');
refuses(fn()=>bolsa($app,[...$bolsa,'perfiles'=>['rector'=>['img'=>'']]]),422,'Perfiles de la Bolsa','Unknown card rejected');
refuses(fn()=>bolsa($app,[...$bolsa,'perfiles'=>['docente'=>['img'=>'']]]),422,'Perfiles de la Bolsa','Docente card rejected');
bolsa($app,[...$bolsa,'diseno'=>'perfiles','titulo'=>'Bolsa QA','perfiles'=>[...$bolsa['perfiles'],'empresa'=>['img'=>'data:image/png;base64,iVBORw0KGgo=']]]);
$saved=$app->bootstrap()['data']['config']['bolsa'];verify($saved['diseno']==='perfiles'&&$saved['titulo']==='Bolsa QA'&&str_starts_with($saved['perfiles']['empresa']['img'],'data:image/png'),'Profile design, title and uploaded photo saved');
$app->logout();verify(($app->bootstrap()['data']['config']['bolsa']['diseno']??'')==='perfiles','Visitors receive the chosen design');
as_user($app,'qadocente',$password);
refuses(fn()=>bolsa($app,[...$saved,'diseno'=>'actual']),403,'configuración','Teacher cannot change the public design');
$app->logout();
echo "$passed total checks passed.\n";
