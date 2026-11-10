<?php
declare(strict_types=1);
// Integration tests: two EMPTY databases whose names end in _test are required.
ob_start();
require_once dirname(__DIR__).'/portal-private/bootstrap.php';
$path=getenv('PORTAL_TEST_CONFIG_FILE');
if(!$path||!is_file($path))throw new RuntimeException('Set PORTAL_TEST_CONFIG_FILE to a private PHP configuration file.');
$config=require $path;
if(!is_array($config)||!preg_match('/^[A-Za-z0-9_]{1,45}_test$/D',(string)($config['db_name']??'')))throw new RuntimeException('Refusing a database whose name does not end in _test.');
if(!empty($config['smtp']['enabled']))throw new RuntimeException('SMTP must be disabled for tests.');
$restoreConfig=$config;$restoreConfig['db_name']=substr($config['db_name'],0,-5).'_restore_test';
$connect=fn(array $c)=>new PDO('mysql:host='.$c['db_host'].';port='.($c['db_port']??3306).';dbname='.$c['db_name'].';charset=utf8mb4',$c['db_user'],$c['db_password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
foreach([$config,$restoreConfig] as $c){$db=$connect($c);if((int)$db->query('SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE()')->fetchColumn()!==0)throw new RuntimeException('Test databases must be empty.');}
putenv('PORTAL_CONFIG_FILE='.$path);
date_default_timezone_set('America/Lima');session_start();$_SESSION['csrf']=bin2hex(random_bytes(32));$_SERVER['REMOTE_ADDR']='127.0.0.99';
$app=new PortalApp($config);$password=bin2hex(random_bytes(12));
$app->install(['install_key'=>$config['install_key'],'username'=>'qaadmin','name'=>'QA','email'=>'qa@example.test','password'=>$password]);
if($accountPath=getenv('PORTAL_TEST_ACCOUNT_FILE')){
    $mask=umask(0077);$stream=fopen($accountPath,'x');umask($mask);
    if(!$stream)throw new RuntimeException('Refusing to overwrite the browser test credential file.');
    fwrite($stream,json_encode(['username'=>'qaadmin','password'=>$password],JSON_THROW_ON_ERROR));fclose($stream);
}
$passed=0;
function verify(bool $ok,string $name): void {global $passed;if(!$ok)throw new RuntimeException('FAIL: '.$name);$passed++;echo "PASS: $name\n";}
function rejects(callable $f,int $status,string $name): void {try{$f();}catch(PortalError $e){verify($e->status===$status,$name);return;}throw new RuntimeException('FAIL: '.$name.' was accepted');}
function proof(PortalApp $app,string $type): array {$c=$app->challenge(['purpose'=>$type]);preg_match('/^(\d+) \+ (\d+)$/',$c['question'],$m);return ['challenge_id'=>$c['id'],'answer'=>(string)((int)$m[1]+(int)$m[2]),'accept'=>true,'declare'=>true];}
function payload(PortalApp $app,array $record): array {return ['idempotency_key'=>sprintf('%s-%s-%s-%s-%s',bin2hex(random_bytes(4)),bin2hex(random_bytes(2)),bin2hex(random_bytes(2)),bin2hex(random_bytes(2)),bin2hex(random_bytes(6))),'proof'=>proof($app,'expedientes'),'record'=>$record];}
$count=fn()=>(int)$app->db()->query('SELECT COUNT(*) FROM pisco_files')->fetchColumn();
$pdf=['original'=>'qa.pdf','data'=>'data:application/pdf;base64,'.base64_encode("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF")];
$record=['nombres'=>'QA Sintetico','tipoPersona'=>'Persona natural','tipoDoc'=>'DNI','numDoc'=>'00000000','correo'=>'qa@example.test','telefono'=>'999999999','direccion'=>'Direccion de prueba','tipoTramite'=>'Solicitud','asunto'=>'Prueba de adjuntos','folios'=>1,'areaDestino'=>'MP','archivos'=>[$pdf]];
$input=payload($app,$record);$first=$app->submit('expedientes',$input);verify($first['status']===201&&$count()===1,'First submission stores one file');
$retry=$app->submit('expedientes',$input);verify($retry['status']===200&&$retry['record']['id']===$first['record']['id']&&$count()===1,'Retry does not duplicate files or record');
$before=$app->bootstrap()['revision'];$bad=$record;$bad['areaDestino']='NO_EXISTE';rejects(fn()=>$app->submit('expedientes',payload($app,$bad)),422,'Invalid destination rejected');verify($count()===1&&$app->bootstrap()['revision']===$before,'Invalid submission rolls back files and revision');
$bad=$record;$bad['archivos'][]=['original'=>'bad.pdf','data'=>'data:application/pdf;base64,'.base64_encode('not a PDF')];rejects(fn()=>$app->submit('expedientes',payload($app,$bad)),422,'Invalid second file rejected');verify($count()===1,'First file rolls back when a later file is invalid');
// Multipart uses these same buckets. Preload them instead of uploading large files.
foreach(['uploads-anon'=>20,'uploads-anon-mb'=>150] as $action=>$limit){
    $window=intdiv(time(),3600)*3600;$key=hash('sha256',$action.'|'.$_SERVER['REMOTE_ADDR'].'|'.$window);
    $app->db()->prepare('INSERT INTO pisco_rate_limits (rate_key,hits,expires_at) VALUES (?,?,?) ON DUPLICATE KEY UPDATE hits=VALUES(hits)')->execute([$key,$limit,$window+3600]);
    if($action==='uploads-anon'){$reference=$record;$reference['archivos']=$first['record']['archivos'];$reused=$app->submit('expedientes',payload($app,$reference));verify($reused['status']===201&&$count()===1,'Existing uploaded reference does not consume another upload quota');}
    rejects(fn()=>$app->submit('expedientes',payload($app,$record)),429,'Inline file respects shared '.$action.' quota');verify($count()===1,'Quota rejection stores no files: '.$action);
    $app->db()->prepare('DELETE FROM pisco_rate_limits WHERE rate_key=?')->execute([$key]);
}
$app->login(['username'=>'qaadmin','password'=>$password]);
function saveRows(PortalApp $app,string $key,array $rows): array {$s=$app->bootstrap();return $app->save(['revision'=>$s['revision'],'patch'=>[['path'=>['academico',$key],'kind'=>'value','before'=>$s['data']['academico'][$key],'after'=>$rows]]]);}
$student=['id'=>1,'dni'=>'00000001','nom'=>'QA Estudiante','prog'=>1,'periodo'=>'2026-II','ciclo'=>'I','sec'=>'A','turno'=>'Mañana','estado'=>'Regular'];saveRows($app,'estudiantes',[$student]);
$grade=['id'=>1,'est'=>1,'ud'=>'Matemática Aplicada','periodo'=>'2026-II','nota'=>15];saveRows($app,'notas',[$grade]);verify(count($app->bootstrap()['data']['academico']['notas'])===1,'Valid grade accepted');
$bad=$grade;$bad['periodo']='periodo-invalido';$revision=$app->bootstrap()['revision'];rejects(fn()=>saveRows($app,'notas',[$bad]),422,'Invalid grade period rejected');verify($app->bootstrap()['revision']===$revision,'Invalid grade preserves revision');
$duplicate=$grade;$duplicate['id']=2;$duplicate['ud']='  MATEMATICA   APLICADA  ';rejects(fn()=>saveRows($app,'notas',[$grade,$duplicate]),422,'Normalized duplicate grade rejected');
$other=$grade;$other['id']=2;$other['periodo']='2025-I';saveRows($app,'notas',[$grade,$other]);verify(count($app->bootstrap()['data']['academico']['notas'])===2,'Same course in a different historical period accepted');
$grade['nota']=16;saveRows($app,'notas',[$grade,$other]);verify($app->bootstrap()['data']['academico']['notas'][0]['nota']===16,'Existing grade can be corrected');
$s=$app->bootstrap();$app->save(['revision'=>$s['revision'],'patch'=>[['path'=>['config'],'kind'=>'object','changes'=>[['key'=>'diseno','before'=>$s['data']['config']['diseno'],'after'=>'editorial']]]]]);
verify($app->bootstrap()['data']['config']['diseno']==='editorial','Editorial layout can be saved');
// Exercise the real SQL export, then import it in another empty database.
$app->db()->exec("INSERT INTO pisco_mail (id,record_id,reference,recipient,subject,body) VALUES (REPEAT('a',64),'qa','QA','qa@example.test','QA','QA')");
$_SERVER['REQUEST_METHOD']='POST';$_POST=['_csrf'=>$_SESSION['csrf']];ob_start();require dirname(__DIR__).'/public_html/backup.php';$sql=ob_get_clean();
verify(str_contains($sql,'CREATE TABLE `pisco_mail`'),'SQL backup contains mail table structure');
verify(!str_contains($sql,'INSERT INTO `pisco_mail`'),'SQL backup excludes old mail queue');
$db=$connect($restoreConfig);$db->exec($sql);
$restored=new PortalApp($restoreConfig);verify($restored->installed(),'SQL restore is installed');$restored->mailStatus();verify((int)$restored->db()->query('SELECT COUNT(*) FROM pisco_mail')->fetchColumn()===0,'SQL restore mail service works with an empty queue');
verify((int)$restored->db()->query('SELECT COUNT(*) FROM pisco_files')->fetchColumn()===1,'SQL restore preserves attachment');
echo "$passed checks passed.\n";ob_end_flush();
