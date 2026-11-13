<?php
declare(strict_types=1);
// Cierre automático de ofertas vencidas y recuperación de contraseña por correo.
ob_start();require __DIR__.'/regressions.php';
function refuses(callable $f,int $status,string $text,string $name): void {try{$f();}catch(PortalError $e){verify($e->status===$status&&str_contains($e->getMessage(),$text),$name.' ('.$e->getMessage().')');return;}throw new RuntimeException('FAIL: '.$name.' was accepted');}
$db=$app->db();$free=fn()=>$db->exec('DELETE FROM pisco_rate_limits');
$admin=function()use($app,$password){$app->logout();$app->login(['username'=>'qaadmin','password'=>$password]);};
$mails=function(string $to,string $type)use($db){$s=$db->prepare('SELECT subject,body FROM pisco_mail WHERE source_type=? AND recipient=? ORDER BY created_at');$s->execute([$type,$to]);return $s->fetchAll();};
$code=function(string $to)use($mails){$m=$mails($to,'cuentas');for($i=count($m)-1;$i>=0;$i--)if(preg_match('/Tu código es: ([0-9]{6})/u',$m[$i]['body'],$x))return $x[1];return '';};
function saveAcad(PortalApp $app,string $key,array $rows): void {$s=$app->bootstrap();$app->save(['revision'=>$s['revision'],'patch'=>[['path'=>['academico',$key],'kind'=>'value','before'=>$s['data']['academico'][$key],'after'=>$rows]]]);}

// Datos: una empresa con cuenta, una egresada con cuenta y CV, y tres ofertas (vencida, vigente hasta hoy y futura).
$admin();
$a=$app->bootstrap()['data']['academico'];
saveAcad($app,'estudiantes',[...$a['estudiantes'],['id'=>80,'dni'=>'71000001','nom'=>'QA Egresada Recupera','prog'=>1,'periodo'=>'2021-I','ciclo'=>'VI','sec'=>'A','turno'=>'Mañana','estado'=>'Egresado','correo'=>'egresada.rec@example.test']]);
saveAcad($app,'empresas',[['id'=>1,'ruc'=>'20123456786','nom'=>'QA Empresa','sector'=>'Servicios','ubic'=>'Pisco','contacto'=>'QA','correo'=>'empresa.rec@example.test','validada'=>true]]);
$app->createAccount(['username'=>'20123456786','name'=>'QA Empresa','email'=>'empresa.rec@example.test','password'=>$password,'role'=>'empresa','vin'=>'emp:1']);
$app->createAccount(['username'=>'71000001','name'=>'QA Egresada Recupera','email'=>'egresada.rec@example.test','password'=>$password,'role'=>'egresado','vin'=>'est:80']);
$app->createAccount(['username'=>'sincorreo','name'=>'QA Sin Correo','password'=>$password,'role'=>'secretaria']);
$offer=fn(int $id,string $limit)=>['id'=>$id,'emp'=>1,'puesto'=>'QA Puesto '.$id,'desc'=>'Descripción','req'=>'Requisitos','modal'=>'Presencial','prog'=>'','vac'=>1,'limite'=>$limit,'estado'=>'Publicada','fecha'=>date('Y-m-d')];
$today=date('Y-m-d');$later=date('Y-m-d',strtotime('+10 days'));
saveAcad($app,'ofertas',[$offer(1,$later),$offer(2,$today),$offer(3,$later)]);
saveAcad($app,'perfilesLab',[['est'=>80,'cv'=>['n'=>'cv.pdf','type'=>'application/pdf','size'=>1024,'d'=>'data:application/pdf;base64,JVBERi0xLjQK'],'resumen'=>'','competencias'=>[],'exp'=>[]]]);
$app->logout();$app->login(['username'=>'71000001','password'=>$password]);
saveAcad($app,'postulaciones',[['id'=>1,'of'=>1,'est'=>80,'fecha'=>$today,'estado'=>'Recibida']]);
$app->logout();

// 1. Cierre automático: la oferta 1 vence (fecha límite de ayer); la 2 cierra hoy y sigue vigente.
$db->exec("UPDATE pisco_state SET data=JSON_SET(data,'$.academico.ofertas[0].limite','".date('Y-m-d',strtotime('-1 day'))."') WHERE id=1");
$full=json_decode($db->query('SELECT data FROM pisco_state WHERE id=1')->fetchColumn(),true);
verify(array_column(PortalApp::expiredOffers($full),'id')===[1],'Only the offer past its deadline is expired; the deadline day still counts');
$before=(int)$db->query('SELECT revision FROM pisco_state WHERE id=1')->fetchColumn();
verify($app->closeExpiredOffers()===1,'Expired offer is closed');
$after=json_decode($db->query('SELECT data FROM pisco_state WHERE id=1')->fetchColumn(),true)['academico'];
$state=array_column($after['ofertas'],'estado','id');
verify($state[1]==='Cerrada'&&$state[2]==='Publicada'&&$state[3]==='Publicada','Only the expired offer changes to Cerrada');
verify((int)$db->query('SELECT revision FROM pisco_state WHERE id=1')->fetchColumn()===$before+1,'Closing bumps the revision once');
verify((bool)array_filter($mails('empresa.rec@example.test','ofertas'),fn($m)=>str_contains($m['subject'],'Cerrada')),'Company is e-mailed that the offer closed');
verify((bool)array_filter($mails('egresada.rec@example.test','ofertas'),fn($m)=>str_contains($m['subject'],'Cerrada')),'Applicant is e-mailed that the offer closed');
verify(count(array_filter($after['notifs'],fn($n)=>str_contains($n['txt'],'se cerró automáticamente')))===1&&count(array_filter($after['notifs'],fn($n)=>str_contains($n['txt'],'cerró su convocatoria')))===1,'Company and applicant get an intranet notice');
verify($app->closeExpiredOffers()===0,'Running again closes nothing');
verify((bool)$db->query("SELECT 1 FROM pisco_audit WHERE action='Cierre automático de ofertas'")->fetchColumn(),'Automatic closing is audited');
$db->exec("UPDATE pisco_state SET data=JSON_SET(data,'$.academico.ofertas[2].limite','".date('Y-m-d',strtotime('-3 days'))."') WHERE id=1");
$app->bootstrap();
verify(array_column(json_decode($db->query('SELECT data FROM pisco_state WHERE id=1')->fetchColumn(),true)['academico']['ofertas'],'estado','id')[3]==='Cerrada','Loading the portal also closes expired offers when no cron runs');

// 2. Recuperación de contraseña.
$new='Nueva-Clave-Segura-2026';
refuses(fn()=>$app->requestPasswordReset(['usuario'=>'']),422,'usuario','User is required');$free();
$r=$app->requestPasswordReset(['usuario'=>'71000001']);$free();
$unknown=$app->requestPasswordReset(['usuario'=>'99999999']);$free();
$nomail=$app->requestPasswordReset(['usuario'=>'sincorreo']);$free();
verify($r===$unknown&&$r===$nomail&&$r['ok']===true,'Same answer whether or not the account exists or has e-mail');
$sent=$code('egresada.rec@example.test');verify(strlen($sent)===6,'Reset code e-mailed to the account e-mail');
verify(!str_contains(json_encode($db->query('SELECT * FROM pisco_password_resets')->fetchAll()),$sent),'Code is not stored in clear');
verify((int)$db->query("SELECT COUNT(*) FROM pisco_password_resets WHERE user_id=(SELECT id FROM pisco_users WHERE username='sincorreo')")->fetchColumn()===0,'Accounts without a real e-mail get no code');
$wrong=$sent==='000000'?'111111':'000000';
refuses(fn()=>$app->resetPassword(['usuario'=>'71000001','codigo'=>$wrong,'password'=>$new,'password_confirmation'=>$new]),422,'no es correcto','Wrong code rejected');$free();
refuses(fn()=>$app->resetPassword(['usuario'=>'71000001','codigo'=>$sent,'password'=>'corta','password_confirmation'=>'corta']),422,'12 caracteres','Short password rejected');$free();
refuses(fn()=>$app->resetPassword(['usuario'=>'71000001','codigo'=>$sent,'password'=>$new,'password_confirmation'=>'otra-cosa-distinta']),422,'coincidir','Confirmation must match');$free();
refuses(fn()=>$app->resetPassword(['usuario'=>'99999999','codigo'=>$sent,'password'=>$new,'password_confirmation'=>$new]),422,'no es correcto o ya venció','Unknown user gets the generic message');$free();
// Cuenta bloqueada por intentos fallidos: el restablecimiento la desbloquea.
for($i=0;$i<5;$i++){try{$app->login(['username'=>'71000001','password'=>'equivocada-'.$i]);}catch(PortalError){}$db->exec("DELETE FROM pisco_rate_limits WHERE rate_key NOT LIKE '".PortalApp::loginFailPrefix('71000001')."%'");}
refuses(fn()=>$app->login(['username'=>'71000001','password'=>$password]),423,'bloqueada','Account is locked after failed attempts');
$app->resetPassword(['usuario'=>'71000001','codigo'=>$sent,'password'=>$new,'password_confirmation'=>$new]);$free();
refuses(fn()=>$app->login(['username'=>'71000001','password'=>$password]),422,'incorrectos','Old password no longer works');$free();
$app->login(['username'=>'71000001','password'=>$new]);verify($app->user()['rol']==='egresado','New password works and the account is unlocked');$app->logout();
verify((bool)array_filter($mails('egresada.rec@example.test','cuentas'),fn($m)=>str_contains($m['subject'],'fue cambiada')),'Account owner is e-mailed that the password changed');
refuses(fn()=>$app->resetPassword(['usuario'=>'71000001','codigo'=>$sent,'password'=>$new.'x','password_confirmation'=>$new.'x']),422,'ya venció','A used code cannot be reused');$free();
// Código vencido, nuevo código invalida el anterior, límite de intentos y de solicitudes.
$app->requestPasswordReset(['usuario'=>'20123456786']);$free();$c1=$code('empresa.rec@example.test');
$db->exec('UPDATE pisco_password_resets SET expires_at=DATE_SUB(NOW(),INTERVAL 1 MINUTE) WHERE used_at IS NULL');
refuses(fn()=>$app->resetPassword(['usuario'=>'20123456786','codigo'=>$c1,'password'=>$new,'password_confirmation'=>$new]),422,'venció','Expired code rejected');$free();
$app->requestPasswordReset(['usuario'=>'20123456786']);$free();$c2=$code('empresa.rec@example.test');
if($c1!==$c2)refuses(fn()=>$app->resetPassword(['usuario'=>'20123456786','codigo'=>$c1,'password'=>$new,'password_confirmation'=>$new]),422,'no es correcto','Previous code stops working');$free();
$bad=$c2==='000000'?'111111':'000000';
for($i=0;$i<4;$i++){try{$app->resetPassword(['usuario'=>'20123456786','codigo'=>$bad,'password'=>$new,'password_confirmation'=>$new]);}catch(PortalError){}$free();}
refuses(fn()=>$app->resetPassword(['usuario'=>'20123456786','codigo'=>$c2,'password'=>$new,'password_confirmation'=>$new]),422,'ya venció','After five wrong attempts even the right code is refused');$free();
$app->requestPasswordReset(['usuario'=>'20123456786']);$free();
$count=fn()=>(int)$db->query("SELECT COUNT(*) FROM pisco_password_resets WHERE user_id=(SELECT id FROM pisco_users WHERE username='20123456786')")->fetchColumn();
$n=$count();$app->requestPasswordReset(['usuario'=>'20123456786']);$free();
verify($n===3&&$count()===3,'At most three codes per hour for one account');
// Una contraseña temporal pendiente de cambio queda resuelta al restablecerla.
$db->exec("UPDATE pisco_users SET profile=JSON_SET(COALESCE(profile,'{}'),'$.cambiarClave',true) WHERE username='71000001'");
$app->requestPasswordReset(['usuario'=>'71000001']);$free();$c3=$code('egresada.rec@example.test');
$app->resetPassword(['usuario'=>'71000001','codigo'=>$c3,'password'=>$new.'-2','password_confirmation'=>$new.'-2']);$free();
$app->login(['username'=>'71000001','password'=>$new.'-2']);verify(empty($app->user()['cambiarClave']),'Resetting also clears a pending temporary-password change');$app->logout();
verify(PortalNotifications::exists([],['source_type'=>'cuentas','source_id'=>'1']),'Account e-mails stay queued for delivery');
echo "$passed total checks passed.\n";
