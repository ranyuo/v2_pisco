<?php
declare(strict_types=1);
// Runs the initial regression suite, then adversarial and lifecycle checks.
ob_start();require __DIR__.'/regressions.php';
verify(!PortalPolicy::can([], 'config'),'Missing role fails closed');
$state=$app->bootstrap()['data'];$student=$state['academico']['estudiantes'][0];
$other=$student;$other['dni']='00000002';$other['nom']='QA Another';
rejects(fn()=>saveRows($app,'estudiantes',[$student,$other]),422,'Duplicate student IDs rejected');
$other['id']=2;$other['periodo']='BAD';rejects(fn()=>saveRows($app,'estudiantes',[$student,$other]),422,'Invalid entry period rejected');
$other['periodo']='2026-II';$other['turno']='INVALID';rejects(fn()=>saveRows($app,'estudiantes',[$student,$other]),422,'Unknown shift rejected');
$other['turno']='Mañana';$other['ciclo']='VII';rejects(fn()=>saveRows($app,'estudiantes',[$student,$other]),422,'Unknown cycle rejected');
$other['ciclo']='I';$other['sec']='Z';rejects(fn()=>saveRows($app,'estudiantes',[$student,$other]),422,'Unknown section rejected');
$other['sec']='B';saveRows($app,'estudiantes',[$student,$other]);verify(count($app->bootstrap()['data']['academico']['estudiantes'])===2,'Valid second student accepted');
$ud=['id'=>1,'cod'=>'QA-U1','nombre'=>'QA Course','prog'=>1,'ciclo'=>'I','horas'=>10,'cred'=>1];saveRows($app,'uds',[$ud]);
$lesson=['id'=>1,'per'=>'BAD','prog'=>1,'ciclo'=>'I','sec'=>'A','turno'=>'Mañana','ud'=>1,'dia'=>'Lun','ini'=>'08:00','fin'=>'09:00'];
rejects(fn()=>saveRows($app,'sesiones',[$lesson]),422,'Invalid lesson period rejected');
$lesson['per']='2026-II';$lesson['dia']='Dom';rejects(fn()=>saveRows($app,'sesiones',[$lesson]),422,'Unsupported lesson day rejected');
$lesson['dia']='Lun';$bad=$lesson;unset($bad['id']);rejects(fn()=>saveRows($app,'sesiones',[$bad]),422,'Missing lesson identity rejected');
$bad=$lesson;$bad['id']=0;rejects(fn()=>saveRows($app,'sesiones',[$bad]),422,'Zero lesson identity rejected');
$bad=$lesson;$bad['id']=true;rejects(fn()=>saveRows($app,'sesiones',[$bad]),422,'Boolean lesson identity rejected');
saveRows($app,'sesiones',[$lesson]);verify(count($app->bootstrap()['data']['academico']['sesiones'])===1,'Valid lesson accepted');
$bad=$lesson;$bad['ini']='08:30';rejects(fn()=>saveRows($app,'sesiones',[$lesson,$bad]),422,'Duplicate lesson identities rejected');
// Publish an actual group; a conflicting lesson must not get through.
$s=$app->bootstrap();$pub=['1|I|A|Mañana|2026-II'=>['fecha'=>date(DATE_ATOM),'por'=>'QA']];saveRows($app,'publicados',$pub);
$bad=$lesson;$bad['id']=2;$bad['ini']='08:30';rejects(fn()=>saveRows($app,'sesiones',[$lesson,$bad]),422,'Published timetable rejects overlaps');
$s=$app->bootstrap();$news=$s['data']['noticias'][0];unset($news['id']);
rejects(fn()=>$app->save(['revision'=>$s['revision'],'patch'=>[['path'=>['noticias'],'kind'=>'value','before'=>$s['data']['noticias'],'after'=>[...$s['data']['noticias'],$news]]]]),422,'Content without identity rejected');
$news['id']='bad" onclick="QA';rejects(fn()=>$app->save(['revision'=>$s['revision'],'patch'=>[['path'=>['noticias'],'kind'=>'value','before'=>$s['data']['noticias'],'after'=>[...$s['data']['noticias'],$news]]]]),422,'Unsafe content identity rejected');
// Malformed API data should be a validation error, not an internal server error.
foreach(['docentes','sesiones','docs','perfilesLab'] as $key){
    $s=$app->bootstrap();rejects(fn()=>$app->save(['revision'=>$s['revision'],'patch'=>[['path'=>['academico',$key],'kind'=>'value','before'=>$s['data']['academico'][$key],'after'=>'invalid']]]),422,'Malformed collection rejected: '.$key);
}
rejects(fn()=>saveRows($app,'perfilesLab',[['est'=>1],['est'=>1]]),422,'Duplicate student profile rejected');
// Emitted documents retain their identities and historical payloads.
$mod=['id'=>1,'prog'=>1,'cod'=>'QA-M1','nombre'=>'QA Module','ciclos'=>'I'];saveRows($app,'modulos',[$mod]);
$cert=['id'=>1,'est'=>1,'mod'=>1,'fecha'=>'2026-11-01','num'=>'QA-STABLE-CERT','estadoDoc'=>'Válido'];saveRows($app,'certs',[$cert]);
saveRows($app,'docs',[['cod'=>'QA-STABLE-DOC','tipo'=>'cert','ref'=>1]]);
$docs=$app->bootstrap()['data']['academico']['docs'];$bad=$docs;$bad[0]['persona']='Forged Person';rejects(fn()=>saveRows($app,'docs',$bad),422,'Issued holder immutable');
$bad=$docs;$bad[0]['ref']=2;rejects(fn()=>saveRows($app,'docs',$bad),422,'Issued source immutable');
rejects(fn()=>saveRows($app,'docs',[$docs[0],$docs[0]]),422,'Duplicate verification code rejected');
$bad=$docs;$bad[0]['valido']='yes';rejects(fn()=>saveRows($app,'docs',$bad),422,'Document validity must be boolean');
$bad=$docs;$bad[0]['valido']=false;saveRows($app,'docs',$bad);verify($app->bootstrap()['data']['academico']['docs'][0]['valido']===false,'Issued document can be annulled');
rejects(fn()=>saveRows($app,'docs',$docs),422,'Annulled document cannot be reactivated');
// The advertised claim limit is 10 MiB and PDF/JPEG/PNG, regardless of API path.
$claim=['tipo'=>'Reclamo','nombres'=>'QA Ciudadano','tipoDoc'=>'DNI','numDoc'=>'00000001','correo'=>'qa@example.test','telefono'=>'999999999','condicion'=>'Público en general','fechaHecho'=>'2026-11-01','descripcion'=>'Descripción sintética suficientemente larga.','pedido'=>'Respuesta de prueba.'];
$gif=PortalFiles::store($app,'qa.gif',base64_decode('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='));
$input=payload($app,[]);$input['proof']=proof($app,'reclamos');$input['record']=[...$claim,'adjunto'=>$gif];rejects(fn()=>$app->submit('reclamos',$input),422,'Claim evidence rejects unsupported GIF');
$large=PortalFiles::store($app,'large.pdf',"%PDF-1.4\n".str_repeat(' ',11*1048576));
$input=payload($app,[]);$input['proof']=proof($app,'reclamos');$input['record']=[...$claim,'adjunto'=>$large];rejects(fn()=>$app->submit('reclamos',$input),422,'Claim evidence rejects PDF over 10 MiB');
// Cross-program isolation and role configuration are server rules, not menu rules.
$app->createAccount(['username'=>'qacoordinator','name'=>'QA Coordinator','password'=>$password,'role'=>'coordinador','programaId'=>(string)array_search(1,$app->bootstrap()['data']['academico']['progMap'],true)]);
$app->createAccount(['username'=>'qasecretary','name'=>'QA Secretary','password'=>$password,'role'=>'secretaria']);
$adminSession=$_SESSION;
$app->saveRole(['role'=>'secretaria','label'=>'Secretaría limitada','mods'=>['dashboard'],'expected'=>null]);
$app->login(['username'=>'qasecretary','password'=>$password]);rejects(fn()=>$app->accountOperation(['action'=>'student','student_id'=>2]),403,'Removed student module blocks account creation');
$_SESSION=$adminSession;
$app->saveRole(['role'=>'secretaria','reset'=>true,'expected'=>['label'=>'Secretaría limitada','mods'=>['dashboard']]]);
$students=$app->bootstrap()['data']['academico']['estudiantes'];// Otro programa existente distinto del 1 (los identificadores dependen del catálogo de cada instituto).
$otherProgram=current(array_filter(array_column($app->bootstrap()['data']['academico']['programas'],'id'),fn($id)=>$id!==1));$foreignStudent=[...$student,'id'=>3,'dni'=>'00000003','nom'=>'QA Other Program','prog'=>$otherProgram];saveRows($app,'estudiantes',[...$students,$foreignStudent]);
$app->login(['username'=>'qacoordinator','password'=>$password]);
$project=$app->bootstrap();verify(count($project['data']['academico']['estudiantes'])===2,'Coordinator sees own students');
rejects(fn()=>$app->accountOperation(['action'=>'create','account'=>['username'=>'forged-admin']]),403,'Coordinator cannot create privileged accounts');
rejects(fn()=>$app->accountOperation(['action'=>'student','student_id'=>3]),403,'Coordinator cannot create accounts for another program');
$own=$app->bootstrap()['data']['academico']['estudiantes'];rejects(fn()=>saveRows($app,'estudiantes',[...$own,$foreignStudent]),403,'Coordinator cannot inject another program student');
$_SESSION=$adminSession;
// Restricted community modules must also be enforced for own-profile endpoints.
$app->createAccount(['username'=>'qastudent','name'=>'QA Student','password'=>$password,'role'=>'estudiante','vin'=>'est:1']);
$app->saveRole(['role'=>'estudiante','label'=>'Alumno limitado','mods'=>['dashboard'],'expected'=>null]);
$app->login(['username'=>'qastudent','password'=>$password]);rejects(fn()=>saveRows($app,'perfilesLab',[['est'=>1]]),403,'Removed employment module blocks own profile writes');
$_SESSION=$adminSession;$app->saveRole(['role'=>'estudiante','reset'=>true,'expected'=>['label'=>'Alumno limitado','mods'=>['dashboard']]]);
// One document module must not grant the other module's issuance permission.
$app->createAccount(['username'=>'qagraduate','name'=>'QA Graduate','password'=>$password,'role'=>'egresado','vin'=>'est:1']);
$app->saveRole(['role'=>'egresado','label'=>'Solo títulos','mods'=>['dashboard','ix-titulos'],'expected'=>null]);
$app->login(['username'=>'qagraduate','password'=>$password]);
$docs=$app->bootstrap()['data']['academico']['docs'];rejects(fn()=>saveRows($app,'docs',[...$docs,['cod'=>'QA-FORBIDDEN-CERT','tipo'=>'cert','ref'=>1]]),403,'Title-only profile cannot issue modular certificate');
$_SESSION=$adminSession;$app->saveRole(['role'=>'egresado','reset'=>true,'expected'=>['label'=>'Solo títulos','mods'=>['dashboard','ix-titulos']]]);
// Account self-protection, password reset revocation, stale sessions.
$me=$app->requireUser();$fields=['username'=>'qaadmin','name'=>'QA','email'=>'qa@example.test','role'=>'admin','estado'=>'Inactivo'];
rejects(fn()=>$app->accountOperation(['action'=>'update','id'=>$me['server_id'],'account'=>$fields]),422,'Primary admin cannot disable own account');
$app->login(['username'=>'qasecretary','password'=>$password]);$oldSession=$_SESSION;$_SESSION=$adminSession;
$account=$app->db()->query("SELECT id FROM pisco_users WHERE username='qasecretary'")->fetchColumn();
$app->accountOperation(['action'=>'update','id'=>(int)$account,'account'=>['username'=>'qasecretary','name'=>'QA Secretary','role'=>'secretaria','password'=>$password.'x']]);
$_SESSION=$oldSession;verify($app->user()===null,'Password reset revokes another session');$_SESSION=$adminSession;
// Backups must survive tampering attempts without changing state.
$backup=PortalBackups::create($app);$backupPath=PortalBackups::path($backup['id']);$badPath=tempnam(sys_get_temp_dir(),'qa-bad-');file_put_contents($badPath,substr(file_get_contents($backupPath),0,120));
$before=$app->bootstrap()['revision'];rejects(fn()=>PortalBackups::restore($app,$badPath),422,'Truncated backup rejected');verify($app->bootstrap()['revision']===$before,'Failed restore preserves revision');unlink($badPath);
PortalBackups::configure($app,['enabled'=>true,'hour'=>0,'retention'=>2]);$scheduled=PortalBackups::scheduled($app);verify($scheduled!==null,'Scheduled backup runs when due');verify(PortalBackups::scheduled($app)===null,'Scheduled backup runs once per day');
$output=[];$exit=0;exec(escapeshellarg(PHP_BINARY).' '.escapeshellarg(dirname(__DIR__).'/portal-private/cron.php').' 2>&1',$output,$exit);verify($exit===0,'Backup cron CLI completes without duplicating daily backup');
$output=[];$exit=0;exec(escapeshellarg(PHP_BINARY).' '.escapeshellarg(dirname(__DIR__).'/portal-private/mail-worker.php').' 2>&1',$output,$exit);verify($exit===1,'Mail worker CLI signals disabled SMTP instead of reporting readiness');
$fileCount=(int)$app->db()->query('SELECT COUNT(*) FROM pisco_files')->fetchColumn();
PortalBackups::restore($app,$backupPath);verify($app->user()===null,'Successful portable restore closes current session');
verify((int)$app->db()->query('SELECT COUNT(*) FROM pisco_files')->fetchColumn()===$fileCount,'Portable restore preserves all small and chunked attachments');
verify((int)$app->db()->query('SELECT COUNT(*) FROM pisco_files WHERE sha256<>SHA2(contents,256)')->fetchColumn()===0,'Restored attachment bytes match original hashes');
verify($app->login(['username'=>'qaadmin','password'=>$password])['ok']===true,'Administrator can log in after portable restore');
foreach([$backup,$scheduled] as $entry)unlink(PortalBackups::path($entry['id']));
// Concurrent editors: unrelated rows may merge, the same stale row may not.
$snapshot=$app->bootstrap();$notes=$snapshot['data']['academico']['notas'];$firstEdit=$notes[0];$firstEdit['nota']=17;$secondEdit=$notes[1];$secondEdit['nota']=18;
$patchFor=fn(array $before,array $after)=>['revision'=>$snapshot['revision'],'patch'=>[['path'=>['academico','notas'],'kind'=>'rows','changes'=>[['key'=>'id:'.$before['id'],'before'=>$before,'after'=>$after]]]]];
$app->save($patchFor($notes[0],$firstEdit));$app->save($patchFor($notes[1],$secondEdit));
$current=$app->bootstrap()['data']['academico']['notas'];verify($current[0]['nota']===17&&$current[1]['nota']===18,'Independent stale row edits merge without lost updates');
$conflict=$notes[0];$conflict['nota']=19;rejects(fn()=>$app->save($patchFor($notes[0],$conflict)),409,'Same stale row edit rejected with conflict');
verify($app->bootstrap()['data']['academico']['notas'][0]['nota']===17,'Conflicting edit does not overwrite committed grade');
// Audit retention: only rows older than the configured window are removed, at most once per day.
$db=$app->db();$db->exec("DELETE FROM pisco_settings WHERE setting_key='audit_purged_day'");
$insertAudit=$db->prepare("INSERT INTO pisco_audit (occurred_at,user_id,username,role,action,entity,record_key,details) VALUES (?,NULL,'qa','publico','QA retention','QA','',?)");
$now=new DateTimeImmutable('2026-11-09 12:00:00');
foreach(['2024-11-08 11:59:59','2024-11-09 12:00:01','2026-11-01 00:00:00'] as $stamp)$insertAudit->execute([$stamp,'{}']);
$retained=fn()=>$db->query("SELECT occurred_at FROM pisco_audit WHERE action='QA retention' ORDER BY occurred_at")->fetchAll(PDO::FETCH_COLUMN);
$beforePurge=(int)$db->query('SELECT COUNT(*) FROM pisco_audit')->fetchColumn();
verify(PortalAudit::purge($app,$now)>=1,'Audit purge removes rows older than 24 months');
verify(count($retained())===2&&str_starts_with($retained()[0],'2024-11-09'),'Audit purge keeps rows inside the retention window');
verify((int)$db->query("SELECT COUNT(*) FROM pisco_audit WHERE action='Depurar auditoría'")->fetchColumn()===1,'Audit purge records its own execution');
$insertAudit->execute(['2020-01-01 00:00:00','{}']);
verify(PortalAudit::purge($app,$now)===null&&count($retained())===3,'Audit purge runs at most once per day');
verify(PortalAudit::purge($app,$now->modify('+1 day'))>=2&&$retained()===['2026-11-01 00:00:00.000000'],'Audit purge runs again the next day with a moving cutoff');
verify((int)$db->query('SELECT COUNT(*) FROM pisco_audit')->fetchColumn()<=$beforePurge+1,'Audit purge does not grow the table');
foreach([[0,null],[3,6],[36,36]] as [$months,$expected]){
    $config=require getenv('PORTAL_TEST_CONFIG_FILE');$probe=new PortalApp([...$config,'audit_retention_months'=>$months]);
    if($expected===null)verify(PortalAudit::purge($probe,$now->modify('+5 days'))===null,'Audit retention 0 keeps everything');
    else verify($probe->auditRetentionMonths()===$expected,"Audit retention $months months resolves to $expected");
}
rejects(fn()=>(new PortalApp(['audit_retention_months'=>'24']))->auditRetentionMonths(),503,'Non-integer audit retention rejected');
echo "$passed total checks passed.\n";ob_end_flush();
