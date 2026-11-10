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

// El docente ve ofertas vigentes y datos mínimos de estudiantes y egresados.
as_user($app,'qadocente',$password,'docente');
$view=$app->bootstrap()['data']['academico'];
verify(count($view['estudiantes'])===2&&!array_diff(array_keys($view['estudiantes'][0]),['id','nom','prog','estado']),'Teacher sees only name, programme and status of students');
verify(!str_contains(json_encode($view['estudiantes']),'00000002')&&!str_contains(json_encode($view['estudiantes']),'egresada@example.test'),'Teacher does not receive DNI or e-mail');
verify(($view['recomendaciones']??null)===[],'Teacher starts without recommendations');
$rec=['id'=>1762780000001,'of'=>1,'est'=>2,'doc'=>1,'fecha'=>$today,'motivo'=>'Destacó en prácticas.'];
patch($app,['academico','recomendaciones'],[$rec]);
verify(count($app->bootstrap()['data']['academico']['recomendaciones'])===1,'Teacher records a recommendation');
refuses(fn()=>patch($app,['academico','recomendaciones'],[$rec,[...$rec,'id'=>1762780000002]]),422,'Ya recomendaste','Duplicate recommendation for the same offer and person rejected');
refuses(fn()=>patch($app,['academico','recomendaciones'],[$rec,[...$rec,'id'=>1762780000003,'of'=>3]]),422,'vigentes','Recommendation for a closed offer rejected');
refuses(fn()=>patch($app,['academico','recomendaciones'],[$rec,[...$rec,'id'=>1762780000004,'est'=>1,'motivo'=>str_repeat('a',501)]]),422,'500','Reason over 500 characters rejected');
refuses(fn()=>patch($app,['academico','recomendaciones'],[$rec,[...$rec,'id'=>1762780000005,'est'=>1,'extra'=>'x']]),422,'no permitidos','Recommendation with extra fields rejected');
refuses(fn()=>patch($app,['academico','recomendaciones'],[$rec,[...$rec,'id'=>1762780000006,'est'=>1,'doc'=>2]]),403,'otra persona','Teacher cannot sign as another teacher');
refuses(fn()=>patch($app,['academico','recomendaciones'],[[...$rec,'motivo'=>'Editado']]),403,'no se edita','Sent recommendation cannot be edited');
$offers=$app->bootstrap()['data']['academico']['ofertas'];$changed=$offers;$changed[0]['puesto']='Alterado';
refuses(fn()=>patch($app,['academico','ofertas'],$changed),403,'ofertas','Teacher cannot modify offers');
patch($app,['academico','recomendaciones'],[]);verify($app->bootstrap()['data']['academico']['recomendaciones']===[],'Teacher withdraws own recommendation');
patch($app,['academico','recomendaciones'],[$rec]);

// La empresa ve las recomendaciones de sus ofertas; otra empresa no.
as_user($app,'qaempresa',$password,'empresa');$company=$app->bootstrap()['data']['academico'];
verify(count($company['recomendaciones'])===1&&$company['recomendaciones'][0]['of']===1,'Company sees recommendations for its offers');
verify((bool)array_filter($company['estudiantes'],fn($e)=>$e['id']===2&&$e['dni']==='****0002'),'Company sees the recommended person with masked DNI');
verify((bool)array_filter($company['notifs'],fn($n)=>str_contains($n['txt'],'recomendó')),'Company is notified of the recommendation');
as_user($app,'qaempresa2',$password,'empresa');$other=$app->bootstrap()['data']['academico'];
verify(($other['recomendaciones']??[])===[]&&!array_filter($other['estudiantes'],fn($e)=>$e['id']===2),'Another company sees neither the recommendation nor the person');
as_user($app,'qaegresada',$password,'estudiante');
verify((bool)array_filter($app->bootstrap()['data']['academico']['notifs'],fn($n)=>str_contains($n['txt'],'te recomendó')),'Recommended graduate is notified');

// Administración: ve todo y no puede borrar una oferta con recomendaciones.
$admin();$full=$app->bootstrap()['data']['academico'];verify(count($full['recomendaciones'])===1,'Administrator sees all recommendations');
refuses(fn()=>saveRows($app,'ofertas',array_values(array_filter($full['ofertas'],fn($o)=>$o['id']!==1))),422,'relacionados','Offer with recommendations cannot be deleted');

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
