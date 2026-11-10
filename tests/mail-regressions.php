<?php
declare(strict_types=1);
ob_start();require __DIR__.'/regressions.php';
$host=getenv('PORTAL_SMTP_TEST_HOST');$ca=getenv('PORTAL_SMTP_TEST_CA');
if(!$host||!$ca||!is_file($ca))throw new RuntimeException('Set PORTAL_SMTP_TEST_HOST and PORTAL_SMTP_TEST_CA for an isolated SMTP sink.');
$server=['enabled'=>true,'host'=>$host,'port'=>2525,'encryption'=>'tls','username'=>'qa@example.test','password'=>bin2hex(random_bytes(16)),'from_email'=>'qa@example.test','from_name'=>'QA','ca_file'=>$ca];
$app->db()->exec('DELETE FROM pisco_mail');
$id=$first['record']['id'];
PortalMail::queue($app->db(),'expedientes',$id,'qa','1','ok@example.test','QA','QA subject','QA body');
PortalMail::queue($app->db(),'expedientes',$id,'qa','1','fail@example.test','QA','QA subject','QA body');
$mail=new PortalMail($server);$result=$mail->process($app->db());verify($result['sent']===1&&$result['failed']===1,'STARTTLS delivery and rejected recipient handled');
$rows=$app->db()->query('SELECT id,status,attempts,last_error,next_attempt_at FROM pisco_mail ORDER BY recipient')->fetchAll();
$failed=$app->db()->query("SELECT * FROM pisco_mail WHERE status='Error'")->fetch();verify((int)$failed['attempts']===1&&strtotime($failed['next_attempt_at'].' UTC')>time(),'Failed SMTP delivery schedules a retry');
verify(!str_contains($failed['last_error'],$server['password'])&&!str_contains($failed['last_error'],'550'),'SMTP errors do not expose credentials or server dialog');
$result=$mail->process($app->db());verify($result['sent']===0&&$result['failed']===0,'Not-yet-due messages are not retried');
PortalMail::retry($app,['id'=>$failed['id']]);$result=$mail->process($app->db());verify($result['failed']===1,'Manual retry processes a failed notification');
PortalMail::queue($app->db(),'expedientes',$id,'qa','2','ok@example.test','QA','QA subject','QA body');
$data=$app->bootstrap()['data'];foreach($data['expedientes'] as &$record)if($record['id']===$id)$record['deleted']=true;unset($record);$app->db()->prepare('UPDATE pisco_state SET data=? WHERE id=1')->execute([json_encode($data)]);
$result=$mail->process($app->db());verify($result['skipped']===1&&$result['sent']===0,'Removed source cancels stale notification');
// Private SMTP settings: persistence, password retention, key validation and tampering.
$dir=sys_get_temp_dir().'/pisco-smtp-'.bin2hex(random_bytes(6));mkdir($dir,0700);$cfg=['install_key'=>bin2hex(random_bytes(32))];$settings=new SmtpSettings($cfg,$dir.'/config.php');
$input=array_intersect_key($server,array_flip(['enabled','host','port','encryption','username','password','from_email','from_name']));
$settings->save($input);verify($settings->read()['password']===$server['password'],'SMTP settings round trip');verify(!str_contains(file_get_contents($dir.'/.smtp-settings.json'),$server['password']),'SMTP password is encrypted on disk');
$input['password']='';$settings->save($input);verify($settings->read()['password']===$server['password'],'Blank password preserves credentials for same account');
$input['username']='other@example.test';rejects(fn()=>$settings->save($input),422,'Changed SMTP account cannot reuse hidden password');
$wrong=new SmtpSettings(['install_key'=>str_repeat('x',32)],$dir.'/config.php');rejects(fn()=>$wrong->read(),503,'Wrong encryption key rejected');
file_put_contents($dir.'/.smtp-settings.json','{}');rejects(fn()=>$settings->read(),503,'Damaged SMTP settings rejected');foreach(glob($dir.'/*') as $p)unlink($p);foreach(glob($dir.'/.*') as $p)if(is_file($p))unlink($p);rmdir($dir);
echo "$passed total checks passed.\n";ob_end_flush();
