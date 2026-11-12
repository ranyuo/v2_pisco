<?php
declare(strict_types=1);
// Bolsa Laboral (Informe N.º 011, observación 5): ingreso por perfil, recomendaciones de docentes y diseño configurable.
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
verify(PortalPolicy::can(['rol'=>'docente'],'ix-bolsa'),'Docente role includes the Bolsa Laboral module');

// Ingreso por perfil: cada tarjeta admite solo su tipo de cuenta.
as_user($app,'qadocente',$password,'docente');verify($app->user()['rol']==='docente','Teacher signs in through the Docente card');
refuses(fn()=>as_user($app,'qadocente',$password,'empresa'),403,'no corresponde','Teacher account rejected by the Empresa card');
verify($app->user()===null,'Rejected profile login leaves no session');
as_user($app,'qaegresada',$password,'estudiante');verify($app->user()['rol']==='egresado','Graduate signs in through the Estudiante/Egresado card');
as_user($app,'qaempresa',$password,'empresa');verify($app->user()['rol']==='empresa','Company signs in through the Empresa card');
as_user($app,'qaadmin',$password,'administrador');verify($app->user()['rol']==='admin','Administrator signs in through the Administrador card');
refuses(fn()=>as_user($app,'qaadmin',$password,'docente'),403,'no corresponde','Administrator rejected by the Docente card');
refuses(fn()=>as_user($app,'qaempresa',$password,'administrador'),403,'no corresponde','Company rejected by the Administrador card');
refuses(fn()=>as_user($app,'qadocente',$password,'rector'),422,'Perfil de ingreso','Unknown login profile rejected');
refuses(fn()=>as_user($app,'qadocente','incorrecta-123','docente'),422,'Usuario o contraseña incorrectos','Wrong password keeps the generic message');

// Vínculo docente-estudiante: el docente dicta QA Course al grupo de QA Estudiante (horario vigente) y la egresada tiene nota en ese curso.
$admin();
$ud=['id'=>1,'cod'=>'QA-U1','nombre'=>'QA Course','prog'=>1,'ciclo'=>'I','horas'=>10,'cred'=>1];saveRows($app,'uds',[$ud]);
$period=$app->bootstrap()['data']['academico']['cfg']['periodo'];
saveRows($app,'sesiones',[['id'=>1,'per'=>$period,'prog'=>1,'ciclo'=>'I','sec'=>'A','turno'=>'Mañana','ud'=>1,'doc'=>1,'dia'=>'Lun','ini'=>'08:00','fin'=>'09:00']]);
$acad=$app->bootstrap()['data']['academico'];
saveRows($app,'notas',[...$acad['notas'],['id'=>900,'est'=>2,'ud'=>$ud['nombre'],'periodo'=>'2024-I','nota'=>16]]);
$app->createAccount(['username'=>'qaest1','name'=>'QA Estudiante','password'=>$password,'role'=>'estudiante','vin'=>'est:1']);

// El docente solo ve a quienes les dictó, con la unidad didáctica que lo sustenta, sin DNI ni contacto.
as_user($app,'qadocente',$password,'docente');
$view=$app->bootstrap()['data']['academico'];
$ids=array_column($view['estudiantes'],'id');sort($ids);
verify($ids===[1,2]&&!array_diff(array_keys($view['estudiantes'][0]),['id','nom','prog','estado','ensena']),'Teacher sees only the people taught, with name, programme, status and supporting course');
verify(in_array($ud['nombre'],array_values(array_filter($view['estudiantes'],fn($e)=>$e['id']===2))[0]['ensena'],true),'Supporting course comes from the recorded grade');
verify(!str_contains(json_encode($view['estudiantes']),'00000002')&&!str_contains(json_encode($view['estudiantes']),'egresada@example.test'),'Teacher does not receive DNI or e-mail');
verify(($view['recomendaciones']??null)===[],'Teacher starts without recommendations');
$why='Destacó en las prácticas de laboratorio y en el trabajo en equipo.';
$rec=['id'=>1762780000001,'of'=>1,'est'=>2,'doc'=>1,'fecha'=>$today,'motivo'=>$why,'ud'=>$ud['nombre'],'estado'=>'Pendiente'];
refuses(fn()=>patch($app,['academico','recomendaciones'],[[...$rec,'motivo'=>'Muy bueno']]),422,'motivo','Recommendation without a real reason rejected');
refuses(fn()=>patch($app,['academico','recomendaciones'],[[...$rec,'ud'=>'Otra unidad']]),422,'unidades didácticas','Recommendation without a course the teacher taught rejected');
refuses(fn()=>patch($app,['academico','recomendaciones'],[[...$rec,'estado'=>'Aceptada']]),422,'decida','New recommendation cannot be created as accepted');
patch($app,['academico','recomendaciones'],[$rec]);
verify(count($app->bootstrap()['data']['academico']['recomendaciones'])===1,'Teacher records a recommendation');
refuses(fn()=>patch($app,['academico','recomendaciones'],[$rec,[...$rec,'id'=>1762780000002]]),422,'Ya recomendaste','Duplicate recommendation for the same offer and person rejected');
refuses(fn()=>patch($app,['academico','recomendaciones'],[$rec,[...$rec,'id'=>1762780000003,'of'=>3]]),422,'vigentes','Recommendation for a closed offer rejected');
refuses(fn()=>patch($app,['academico','recomendaciones'],[$rec,[...$rec,'id'=>1762780000004,'est'=>1,'motivo'=>str_repeat('a',501)]]),422,'500','Reason over 500 characters rejected');
refuses(fn()=>patch($app,['academico','recomendaciones'],[$rec,[...$rec,'id'=>1762780000005,'est'=>1,'extra'=>'x']]),422,'no permitidos','Recommendation with extra fields rejected');
refuses(fn()=>patch($app,['academico','recomendaciones'],[$rec,[...$rec,'id'=>1762780000006,'est'=>1,'doc'=>2]]),403,'otra persona','Teacher cannot sign as another teacher');
refuses(fn()=>patch($app,['academico','recomendaciones'],[[...$rec,'motivo'=>'Editado por el docente luego de enviarla.']]),403,'no se edita','Sent recommendation cannot be edited');
$offers=$app->bootstrap()['data']['academico']['ofertas'];$changed=$offers;$changed[0]['puesto']='Alterado';
refuses(fn()=>patch($app,['academico','ofertas'],$changed),403,'ofertas','Teacher cannot modify offers');
patch($app,['academico','recomendaciones'],[]);verify($app->bootstrap()['data']['academico']['recomendaciones']===[],'Teacher withdraws a recommendation not yet answered');
patch($app,['academico','recomendaciones'],[$rec]);

// La empresa no ve nada mientras la persona no acepte y postule; otra empresa nunca.
as_user($app,'qaempresa',$password,'empresa');$company=$app->bootstrap()['data']['academico'];
verify(($company['recomendaciones']??[])===[]&&!array_filter($company['estudiantes'],fn($e)=>$e['id']===2),'Company sees neither the recommendation nor the person before the person accepts');
verify(!array_filter($company['notifs'],fn($n)=>str_contains($n['txt'],'recomendación')),'Company is not notified before the person accepts');

// La persona decide: para aceptar debe postular; luego la empresa la ve.
as_user($app,'qaegresada',$password,'estudiante');$mine=$app->bootstrap()['data']['academico'];
verify(count($mine['recomendaciones'])===1&&$mine['recomendaciones'][0]['motivo']===$why,'Recommended graduate sees the recommendation and its reason');
verify((bool)array_filter($mine['notifs'],fn($n)=>str_contains($n['txt'],'te recomendó')),'Recommended graduate is notified');
$answer=[...$rec,'estado'=>'Aceptada','fechaResp'=>$today];
refuses(fn()=>patch($app,['academico','recomendaciones'],[$answer]),422,'postular','Accepting without applying rejected');
refuses(fn()=>patch($app,['academico','recomendaciones'],[[...$answer,'motivo'=>'Cambiado por la persona recomendada.']]),403,'aceptar','Recommended person cannot edit the reason');
patch($app,['academico','perfilesLab'],[...$mine['perfilesLab'],['est'=>2,'cv'=>['n'=>'cv.pdf','type'=>'application/pdf','size'=>1024,'d'=>'data:application/pdf;base64,JVBERi0xLjQK'],'resumen'=>'','competencias'=>[],'exp'=>[]]]);
$s=$app->bootstrap();$a=$s['data']['academico'];
$app->save(['revision'=>$s['revision'],'patch'=>[
 ['path'=>['academico','postulaciones'],'kind'=>'value','before'=>$a['postulaciones'],'after'=>[...$a['postulaciones'],['id'=>500,'of'=>1,'est'=>2,'fecha'=>$today,'estado'=>'Recibida']]],
 ['path'=>['academico','recomendaciones'],'kind'=>'value','before'=>$a['recomendaciones'],'after'=>[$answer]]]]);
verify($app->bootstrap()['data']['academico']['recomendaciones'][0]['estado']==='Aceptada','Graduate accepts the recommendation together with the application');
as_user($app,'qaempresa',$password,'empresa');$company=$app->bootstrap()['data']['academico'];
verify(count($company['recomendaciones'])===1&&$company['recomendaciones'][0]['motivo']===$why,'Company sees the accepted recommendation with its reason');
verify((bool)array_filter($company['notifs'],fn($n)=>str_contains($n['txt'],'recomendación de un docente')),'Company is notified once the person accepts');
as_user($app,'qaempresa2',$password,'empresa');$other=$app->bootstrap()['data']['academico'];
verify(($other['recomendaciones']??[])===[]&&!array_filter($other['estudiantes'],fn($e)=>$e['id']===2),'Another company sees neither the recommendation nor the person');
as_user($app,'qadocente',$password,'docente');
verify((bool)array_filter($app->bootstrap()['data']['academico']['notifs'],fn($n)=>str_contains($n['txt'],'aceptó tu recomendación')),'Teacher is told the person accepted');
refuses(fn()=>patch($app,['academico','recomendaciones'],[]),403,'ya respondió','Teacher cannot withdraw an answered recommendation');

// La persona que no acepta: solo el docente lo sabe.
as_user($app,'qaest1',$password,'estudiante');verify(($app->bootstrap()['data']['academico']['recomendaciones']??[])===[],'A student does not see recommendations of other people');

// Administración: ve todo y no puede borrar una oferta con recomendaciones.
$admin();$full=$app->bootstrap()['data']['academico'];verify(count($full['recomendaciones'])===1,'Administrator sees all recommendations');
refuses(fn()=>saveRows($app,'ofertas',array_values(array_filter($full['ofertas'],fn($o)=>$o['id']!==1))),422,'relacionados','Offer with recommendations cannot be deleted');

// Revisión institucional previa (configurable).
$app->createAccount(['username'=>'qaatencion','name'=>'QA Atención','password'=>$password,'role'=>'atencion']);
$bolsaCfg=$app->bootstrap()['data']['config']['bolsa'];
verify(($bolsaCfg['revisarRecomendaciones']??null)===false,'Institutional review is off by default');
refuses(fn()=>bolsa($app,[...$bolsaCfg,'revisarRecomendaciones'=>'si']),422,'revisión','Review setting must be true or false');
bolsa($app,[...$bolsaCfg,'revisarRecomendaciones'=>true]);
$acad=$app->bootstrap()['data']['academico'];
saveRows($app,'ofertas',[...$acad['ofertas'],array_replace($offer(4,1,'Publicada',$later),['prog'=>3]),$offer(5,2,'Publicada',$later)]);
patch($app,['academico','perms'],[...$acad['perms'],'doc'=>[...($acad['perms']['doc']??[]),'bolsa'=>2]]);
as_user($app,'qadocente',$password,'docente');$view=$app->bootstrap()['data']['academico'];
verify(empty($view['postulaciones'])&&empty($view['perfilesLab'])&&!str_contains(json_encode($view['empresas']??[]),'uno@example.test'),'Teacher gets no applications, CVs or company contacts even if the matrix grants a Bolsa level');
$emps=$view['empresas']??[];if($emps){$emps[0]['validada']=false;refuses(fn()=>patch($app,['academico','empresas'],$emps),403,'empresas','Teacher cannot modify companies even with a Bolsa level');}else verify(true,'Teacher cannot modify companies even with a Bolsa level (not visible)');
$recs=$view['recomendaciones'];$base=['doc'=>1,'fecha'=>$today,'motivo'=>$why,'ud'=>$ud['nombre']];
refuses(fn()=>patch($app,['academico','recomendaciones'],[...$recs,['id'=>1762780000010,'of'=>4,'est'=>1,...$base,'estado'=>'En revisión']]),422,'otro programa','Recommendation for an offer of another programme rejected');
refuses(fn()=>patch($app,['academico','recomendaciones'],[...$recs,['id'=>1762780000011,'of'=>5,'est'=>1,...$base,'fecha'=>'2020-01-01','estado'=>'En revisión']]),422,'Fecha','Backdated recommendation rejected');
refuses(fn()=>patch($app,['academico','recomendaciones'],[...$recs,['id'=>1762780000012,'of'=>5,'est'=>1,...$base,'fecha'=>'2026-02-31','estado'=>'En revisión']]),422,'Fecha','Impossible recommendation date rejected');
refuses(fn()=>patch($app,['academico','recomendaciones'],[...$recs,['id'=>1762780000014,'of'=>5,'est'=>1,...$base,'estado'=>'Pendiente']]),422,'revisión','With review on, a new recommendation must wait for the institute');
$pending=['id'=>1762780000015,'of'=>5,'est'=>1,...$base,'estado'=>'En revisión'];
patch($app,['academico','recomendaciones'],[...$recs,$pending]);
as_user($app,'qaest1',$password,'estudiante');verify(($app->bootstrap()['data']['academico']['recomendaciones']??[])===[],'Student does not see a recommendation under review');
as_user($app,'qaatencion',$password);$s=$app->bootstrap()['data']['academico'];
verify((bool)array_filter($s['notifs'],fn($n)=>str_contains($n['txt'],'por revisar')),'Staff is notified of a recommendation to review');
refuses(fn()=>patch($app,['academico','recomendaciones'],[...$s['recomendaciones'],['id'=>1762780000013,'of'=>1,'est'=>1,...$base,'estado'=>'En revisión']]),403,'docente','Staff cannot register recommendations on behalf of a teacher');
$rows=fn(array $change)=>array_map(fn($r)=>$r['id']===1762780000015?[...$r,...$change]:$r,$s['recomendaciones']);
refuses(fn()=>patch($app,['academico','recomendaciones'],$rows(['estado'=>'No aprobada','fechaRev'=>$today])),422,'motivo','Rejecting without telling the teacher why is refused');
refuses(fn()=>patch($app,['academico','recomendaciones'],$rows(['estado'=>'Aceptada','fechaRev'=>$today])),422,'no puede pasar','Staff cannot accept on behalf of the person');
patch($app,['academico','recomendaciones'],$rows(['estado'=>'Pendiente','fechaRev'=>$today]));
as_user($app,'qaest1',$password,'estudiante');$mine=$app->bootstrap()['data']['academico'];
verify(count($mine['recomendaciones'])===1,'Approved recommendation reaches the student');
patch($app,['academico','recomendaciones'],[[...$mine['recomendaciones'][0],'estado'=>'Declinada','fechaResp'=>$today]]);
as_user($app,'qaempresa2',$password,'empresa');verify(($app->bootstrap()['data']['academico']['recomendaciones']??[])===[],'Company never sees a declined recommendation');
as_user($app,'qadocente',$password,'docente');
verify((bool)array_filter($app->bootstrap()['data']['academico']['notifs'],fn($n)=>str_contains($n['txt'],'no aceptó')),'Teacher is told the person did not accept');
$admin();$s=$app->bootstrap()['data']['academico'];patch($app,['academico','recomendaciones'],[]);
verify($app->bootstrap()['data']['academico']['recomendaciones']===[],'Administrator can withdraw recommendations');
saveRows($app,'ofertas',array_values(array_filter($s['ofertas'],fn($o)=>!in_array($o['id'],[4,5],true))));verify(!array_filter($app->bootstrap()['data']['academico']['ofertas'],fn($o)=>in_array($o['id'],[4,5],true)),'Offer can be deleted once its recommendations are withdrawn');
patch($app,['academico','perms'],$acad['perms']);bolsa($app,[...$app->bootstrap()['data']['config']['bolsa'],'revisarRecomendaciones'=>false]);
// Recomendaciones anteriores al flujo transparente quedan pendientes de la respuesta de la persona.
$legacy=PortalContent::normalize(['config'=>['bolsa'=>[]],'academico'=>['recomendaciones'=>[['id'=>1,'of'=>1,'est'=>2,'doc'=>1,'fecha'=>$today,'motivo'=>'']]]]);
verify($legacy['academico']['recomendaciones'][0]['estado']==='Pendiente'&&$legacy['config']['bolsa']['revisarRecomendaciones']===false,'Earlier recommendations wait for the person to answer');
// Instalaciones anteriores: los valores de la página pública los completa el servidor (el navegador no cambia la configuración al abrirla).
$db=$app->db();$db->exec("UPDATE pisco_state SET data=JSON_REMOVE(data,'$.config.bolsa.diseno','$.config.bolsa.titulo','$.config.bolsa.perfiles') WHERE id=1");
$fixed=PortalContent::normalize(json_decode($db->query('SELECT data FROM pisco_state WHERE id=1')->fetchColumn(),true))['config']['bolsa'];
verify(($fixed['diseno']??'')==='actual'&&isset($fixed['perfiles']['estudiante'])&&($fixed['titulo']??'')!=='','Existing installs get the public-page defaults from the server');
// Diseño configurable de la página pública.
$bolsa=$app->bootstrap()['data']['config']['bolsa'];
verify(($bolsa['diseno']??'')==='actual'&&isset($bolsa['perfiles']['docente']),'Default public design is the current one, with default card photos');
refuses(fn()=>bolsa($app,[...$bolsa,'diseno'=>'otro']),422,'Diseño de la Bolsa','Unknown public design rejected');
refuses(fn()=>bolsa($app,[...$bolsa,'titulo'=>str_repeat('x',121)]),422,'120','Title over 120 characters rejected');
refuses(fn()=>bolsa($app,[...$bolsa,'perfiles'=>['docente'=>['img'=>'javascript:alert(1)']]]),422,'foto','Unsafe card photo rejected');
refuses(fn()=>bolsa($app,[...$bolsa,'perfiles'=>['rector'=>['img'=>'']]]),422,'Perfiles de la Bolsa','Unknown card rejected');
bolsa($app,[...$bolsa,'diseno'=>'perfiles','titulo'=>'Bolsa QA','perfiles'=>[...$bolsa['perfiles'],'empresa'=>['img'=>'data:image/png;base64,iVBORw0KGgo=']]]);
$saved=$app->bootstrap()['data']['config']['bolsa'];verify($saved['diseno']==='perfiles'&&$saved['titulo']==='Bolsa QA'&&str_starts_with($saved['perfiles']['empresa']['img'],'data:image/png'),'Profile design, title and uploaded photo saved');
$app->logout();verify(($app->bootstrap()['data']['config']['bolsa']['diseno']??'')==='perfiles','Visitors receive the chosen design');
as_user($app,'qadocente',$password,'docente');
refuses(fn()=>bolsa($app,[...$saved,'diseno'=>'actual']),403,'configuración','Teacher cannot change the public design');
$app->logout();
echo "$passed total checks passed.\n";
