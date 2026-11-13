<?php
declare(strict_types=1);
// Registro en línea de egresados (Bolsa Laboral): datos y contraseña propios, código al correo, aprobación automática por padrón
// o revisión del personal, y aviso al correo del egresado en cada paso.
ob_start();require __DIR__.'/regressions.php';
function refuses(callable $f,int $status,string $text,string $name): void {try{$f();}catch(PortalError $e){verify($e->status===$status&&str_contains($e->getMessage(),$text),$name.' ('.$e->getMessage().')');return;}throw new RuntimeException('FAIL: '.$name.' was accepted');}
$db=$app->db();
$admin=function()use($app,$password){$app->logout();$app->login(['username'=>'qaadmin','password'=>$password]);};
$free=fn()=>$db->exec('DELETE FROM pisco_rate_limits');
$mails=function(string $to)use($db){$s=$db->prepare("SELECT subject,body FROM pisco_mail WHERE source_type='egresados' AND recipient=? ORDER BY created_at");$s->execute([$to]);return $s->fetchAll();};
$code=function(string $to)use($mails){$m=$mails($to);for($i=count($m)-1;$i>=0;$i--)if(preg_match('/código de verificación es: ([0-9]{6})/u',$m[$i]['body'],$x))return $x[1];return '';};
$pw='Egresado-Clave-2026';
$form=fn(array $over=[])=>[...['dni'=>'70000001','nom'=>'Quispe Huamán María Elena','prog'=>1,'anio'=>2024,'correo'=>'maria.egresada@example.test','tel'=>'987654321','password'=>$pw,'password_confirmation'=>$pw,'declaration'=>true],...$over];
$admin();
$state=$app->bootstrap()['data']['academico'];
saveRows($app,'estudiantes',[...$state['estudiantes'],['id'=>70,'dni'=>'70000001','nom'=>'Quispe Huamán María Elena','prog'=>1,'periodo'=>'2021-I','ciclo'=>'VI','sec'=>'A','turno'=>'Mañana','estado'=>'Egresado','correo'=>'maria.egresada@example.test'],
 ['id'=>71,'dni'=>'70000003','nom'=>'Torres Vega Luis','prog'=>1,'periodo'=>'2026-I','ciclo'=>'II','sec'=>'A','turno'=>'Mañana','estado'=>'Regular','correo'=>'luis@example.test']]);
saveRows($app,'empresas',[['id'=>1,'ruc'=>'20123456786','nom'=>'QA Empresa','sector'=>'Servicios','ubic'=>'Pisco','contacto'=>'QA','correo'=>'empresa@example.test','validada'=>true]]);
$app->createAccount(['username'=>'qaempresa','name'=>'QA Empresa','password'=>$password,'role'=>'empresa','vin'=>'emp:1']);
$app->logout();

// Validaciones del formulario público.
refuses(fn()=>$app->registerGraduate($form(['declaration'=>false])),422,'declaración','Registration requires the data declaration');$free();
refuses(fn()=>$app->registerGraduate($form(['dni'=>'1234'])),422,'DNI','Invalid DNI rejected');$free();
refuses(fn()=>$app->registerGraduate($form(['password_confirmation'=>'Otra-Clave-2026'])),422,'confirmación','Password confirmation must match');$free();
refuses(fn()=>$app->registerGraduate($form(['password'=>'corta','password_confirmation'=>'corta'])),422,'contraseña','Short password rejected');$free();
refuses(fn()=>$app->registerGraduate($form(['tel'=>'12345'])),422,'celular','Invalid mobile number rejected');$free();
refuses(fn()=>$app->registerGraduate($form(['prog'=>999])),422,'programa','Unknown programme rejected');$free();
refuses(fn()=>$app->registerGraduate($form(['anio'=>2099])),422,'año','Future graduation year rejected');$free();
refuses(fn()=>$app->registerGraduate($form(['nom'=>'<b>X</b>'])),422,'nombres','Invalid name rejected');$free();
refuses(fn()=>$app->registerGraduate($form(['correo'=>'no-es-correo'])),422,'correo','Invalid e-mail rejected');$free();

// A. En el padrón como egresada y con el mismo correo: la cuenta se activa al confirmar el código.
$r=$app->registerGraduate($form());$free();
verify($r['correo']!=='maria.egresada@example.test'&&str_contains($r['correo'],'@example.test'),'Response shows the e-mail masked');
$sent=$code('maria.egresada@example.test');verify(strlen($sent)===6,'Verification code e-mailed to the graduate');
$row=$db->query("SELECT * FROM pisco_graduate_requests WHERE dni='70000001'")->fetch();
verify(!str_contains(json_encode($row),$sent)&&!str_contains(json_encode($row),$pw)&&password_verify($pw,$row['password']),'Neither the code nor the password are stored in clear');
refuses(fn()=>$app->login(['username'=>'70000001','password'=>$pw]),422,'incorrectos','No account before confirming the e-mail');$free();
$wrong=$sent==='000000'?'111111':'000000';
refuses(fn()=>$app->verifyGraduate(['dni'=>'70000001','codigo'=>$wrong]),422,'no es correcto','Wrong code rejected');$free();
verify((int)$db->query("SELECT code_attempts FROM pisco_graduate_requests WHERE dni='70000001'")->fetchColumn()===1,'Wrong attempts are counted');
$v=$app->verifyGraduate(['dni'=>'70000001','codigo'=>$sent]);$free();
verify($v['estado']==='Aprobada','Graduate in the register with the same e-mail is approved at once');
$app->login(['username'=>'70000001','password'=>$pw]);$me=$app->user();
verify($me['rol']==='egresado'&&$me['vin']==='est:70'&&empty($me['cambiarClave']),'Graduate signs in with DNI and own password, linked to the register');
verify(count($app->bootstrap()['data']['academico']['estudiantes'])===1,'Graduate sees only their own record');
verify((bool)array_filter($mails('maria.egresada@example.test'),fn($m)=>str_contains($m['subject'],'está activa')),'Graduate is e-mailed that the account is active');
$app->logout();
refuses(fn()=>$app->registerGraduate($form()),422,'Ya existe una cuenta','A second registration with the same DNI is refused');$free();
refuses(fn()=>$app->registerGraduate($form(['dni'=>'70000009'])),422,'correo ya está registrado','An e-mail already used by another account is refused');$free();

// B. Fuera del padrón: confirma su correo y queda en revisión; el personal aprueba y se avisa al egresado.
$b=$form(['dni'=>'70000002','nom'=>'Ramos Peña Ana Lucía','correo'=>'ana.egresada@example.test','anio'=>2023]);
$app->registerGraduate($b);$free();$first=$code('ana.egresada@example.test');
$app->resendGraduateCode(['dni'=>'70000002']);$free();$second=$code('ana.egresada@example.test');
verify($second!==''&&count(array_filter($mails('ana.egresada@example.test'),fn($m)=>str_contains($m['subject'],'Código')))===2,'A new code can be requested');
if($first!==$second)refuses(fn()=>$app->verifyGraduate(['dni'=>'70000002','codigo'=>$first]),422,'no es correcto','The previous code stops working');$free();
$db->exec("UPDATE pisco_graduate_requests SET code_expires=DATE_SUB(NOW(),INTERVAL 1 MINUTE) WHERE dni='70000002' AND status='Por verificar'");
refuses(fn()=>$app->verifyGraduate(['dni'=>'70000002','codigo'=>$second]),422,'venció','Expired code rejected');$free();
$app->resendGraduateCode(['dni'=>'70000002']);$free();
$v=$app->verifyGraduate(['dni'=>'70000002','codigo'=>$code('ana.egresada@example.test')]);$free();
verify($v['estado']==='Por validar','Graduate not in the register waits for staff review');
verify((bool)array_filter($mails('ana.egresada@example.test'),fn($m)=>str_contains($m['subject'],'recibida')),'Graduate is e-mailed that the request is under review');
refuses(fn()=>$app->registerGraduate($b),422,'en revisión','A second registration while under review is refused');$free();
refuses(fn()=>$app->login(['username'=>'70000002','password'=>$pw]),422,'incorrectos','No account while under review');$free();
refuses(fn()=>$app->graduateRequests(),403,'Inicia sesión','Visitors cannot list registration requests');
$app->login(['username'=>'70000001','password'=>$pw]);refuses(fn()=>$app->graduateRequests(),403,'permiso','A graduate cannot list registration requests');$app->logout();
$app->login(['username'=>'qaempresa','password'=>$password]);refuses(fn()=>$app->decideGraduate(['id'=>1,'accion'=>'aprobar']),403,'permiso','A company cannot decide requests');$app->logout();
$admin();
$list=$app->graduateRequests()['requests'];$ana=array_values(array_filter($list,fn($x)=>$x['dni']==='70000002'))[0];
verify($ana['status']==='Por validar'&&$ana['padron']===null&&!isset($ana['password'])&&!isset($ana['code_hash']),'Staff sees the request without password or code');
verify((bool)array_filter($app->bootstrap()['data']['academico']['notifs'],fn($n)=>str_contains($n['txt'],'registro de egresado')),'Staff is notified in the intranet');
refuses(fn()=>$app->decideGraduate(['id'=>$ana['id'],'accion'=>'rechazar','motivo'=>'']),422,'motivo','Rejection requires a reason');
$app->decideGraduate(['id'=>$ana['id'],'accion'=>'aprobar']);
refuses(fn()=>$app->decideGraduate(['id'=>$ana['id'],'accion'=>'aprobar']),409,'atendida','A request is decided only once');
$st=array_values(array_filter($app->bootstrap()['data']['academico']['estudiantes'],fn($e)=>$e['dni']==='70000002'))[0]??null;
verify($st&&$st['estado']==='Egresado'&&$st['correo']==='ana.egresada@example.test'&&$st['origen']==='Registro en línea'&&$st['anioEgreso']==='2023','Approval adds the graduate to the register');
verify((bool)array_filter($mails('ana.egresada@example.test'),fn($m)=>str_contains($m['subject'],'está activa')),'Graduate is e-mailed the approval');
$app->logout();$app->login(['username'=>'70000002','password'=>$pw]);verify($app->user()['rol']==='egresado','Approved graduate signs in with own password');$app->logout();

// C. Registrado como estudiante regular con otro correo: revisión; si se rechaza, recibe el motivo.
$c=$form(['dni'=>'70000003','nom'=>'Torres Vega Luis','correo'=>'luis.otro@example.test']);
$app->registerGraduate($c);$free();$app->verifyGraduate(['dni'=>'70000003','codigo'=>$code('luis.otro@example.test')]);$free();
$admin();$luis=array_values(array_filter($app->graduateRequests()['requests'],fn($x)=>$x['dni']==='70000003'))[0];
verify($luis['status']==='Por validar'&&$luis['padron']['estado']==='Regular','Staff sees the register status next to the request');
$app->decideGraduate(['id'=>$luis['id'],'accion'=>'rechazar','motivo'=>'Aún figuras como estudiante del II ciclo.']);
$rej=array_values(array_filter($mails('luis.otro@example.test'),fn($m)=>str_contains($m['subject'],'no fue aprobada')));
verify($rej&&str_contains($rej[0]['body'],'Aún figuras como estudiante'),'Graduate is e-mailed the rejection with its reason');
$app->logout();refuses(fn()=>$app->login(['username'=>'70000003','password'=>$pw]),422,'incorrectos','Rejected request creates no account');$free();
$app->registerGraduate($c);$free();verify(true,'After a rejection the person can register again');

// Sin confirmar el correo (p. ej. sin SMTP): el personal puede aprobar tras verificar la identidad en persona.
$admin();$luis=array_values(array_filter($app->graduateRequests()['requests'],fn($x)=>$x['dni']==='70000003'&&$x['status']==='Por verificar'))[0];
$app->decideGraduate(['id'=>$luis['id'],'accion'=>'aprobar']);
$st=array_values(array_filter($app->bootstrap()['data']['academico']['estudiantes'],fn($e)=>$e['dni']==='70000003'))[0];
verify($st['estado']==='Egresado'&&$st['id']===71,'Approving a regular student updates the same register entry to graduate');
$queued=(int)$db->query("SELECT COUNT(*) FROM pisco_mail WHERE source_type='egresados' AND status='Pendiente'")->fetchColumn();
verify($queued>0&&PortalNotifications::exists([],['source_type'=>'egresados','source_id'=>'1']),'Graduate e-mails stay queued for delivery');
$app->logout();
echo "$passed total checks passed.\n";
