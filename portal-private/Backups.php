<?php
declare(strict_types=1);
final class PortalBackups
{
    private const TABLES=['pisco_state','pisco_users','pisco_visits','pisco_files'];
    private const COLUMNS=[
        'pisco_state'=>['id','data','revision','updated_at'],
        'pisco_users'=>['id','username','name','email','password','active','role','profile','auth_version','login_failures','locked_until','last_login','created_at'],
        'pisco_visits'=>['visit_day','views'],
        'pisco_files'=>['id','owner_user_id','owner_session','filename','mime','size','sha256','created_at'],
    ];
    public static function directory(): string
    {
        $path=__DIR__.'/backups';
        if(!is_dir($path)&&!mkdir($path,0700,true)&&!is_dir($path))throw new PortalError(503,'No se pudo crear la carpeta privada de respaldos.');
        return $path;
    }
    public static function path(string $id): string
    {if(!preg_match('/^[a-f0-9]{32}$/',$id))throw new PortalError(422,'Respaldo no válido.');return self::directory().'/'.$id.'.piscobak';}
    public static function create(PortalApp $app,string $kind='manual'): array
    {
        $db=$app->db();if($db->inTransaction())throw new PortalError(409,'Termina la operación actual antes de crear el respaldo.');
        $id=bin2hex(random_bytes(16));$tmp=self::path($id).'.tmp';$stream=gzopen($tmp,'wb6');if(!$stream)throw new PortalError(503,'No se pudo escribir el respaldo.');chmod($tmp,0600);
        $hash=hash_init('sha256');$write=function(array $item)use($stream,$hash){$line=json_encode($item,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE)."\n";hash_update($hash,$line);if(gzwrite($stream,$line)!==strlen($line))throw new PortalError(503,'No hay espacio suficiente para guardar el respaldo.');};
        $header=['format'=>'pisco-backup','version'=>1,'schema'=>PortalSchema::VERSION,'created_at'=>date(DATE_ATOM),'kind'=>$kind];$counts=[];
        try{
            $db->exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');$db->beginTransaction();
            $storedRoles=$db->query("SELECT setting_value FROM pisco_settings WHERE setting_key='role_permissions'")->fetchColumn();
            $header['role_permissions']=$storedRoles?json_decode($storedRoles,true,flags:JSON_THROW_ON_ERROR):[];
            PortalPolicy::validateRoles($header['role_permissions']);$write($header);
            foreach(self::TABLES as $table){$counts[$table]=0;
                if($table==='pisco_files'){
                    $ids=$db->query('SELECT id FROM pisco_files ORDER BY id')->fetchAll(PDO::FETCH_COLUMN);$get=$db->prepare('SELECT * FROM pisco_files WHERE id=?');
                    foreach($ids as $fileId){$get->execute([$fileId]);$row=$get->fetch();$get->closeCursor();$bytes=$row['contents'];unset($row['contents']);$write(['table'=>$table,'row'=>$row]);$counts[$table]++;
                        for($offset=0;$offset<strlen($bytes);$offset+=524288)$write(['chunk'=>$fileId,'data'=>base64_encode(substr($bytes,$offset,524288))]);
                    }
                }else{$stmt=$db->query('SELECT * FROM '.$table);while($row=$stmt->fetch()){$write(['table'=>$table,'row'=>$row]);$counts[$table]++;}}
            }
            $line=json_encode(['end'=>true,'counts'=>$counts,'sha256'=>hash_final($hash)],JSON_THROW_ON_ERROR)."\n";if(gzwrite($stream,$line)!==strlen($line))throw new PortalError(503,'No se pudo completar el respaldo.');
            $db->commit();gzclose($stream);$stream=null;if(!rename($tmp,self::path($id)))throw new PortalError(503,'No se pudo confirmar el respaldo.');
            PortalAudit::write($app,'Crear respaldo','Respaldos',$id,['tipo'=>$kind,'registros'=>$counts]);
            return ['id'=>$id,...$header,'counts'=>$counts,'bytes'=>filesize(self::path($id))];
        }catch(Throwable $e){if($db->inTransaction())$db->rollBack();if(is_resource($stream))gzclose($stream);@unlink($tmp);throw $e;}
    }
    public static function listing(): array
    {
        $out=[];foreach(glob(self::directory().'/*.piscobak')?:[] as $path){$s=@gzopen($path,'rb');if(!$s)continue;$line=gzgets($s,8192);gzclose($s);$h=json_decode($line?:'',true);if(($h['format']??'')!=='pisco-backup')continue;
            $id=basename($path,'.piscobak');if(preg_match('/^[a-f0-9]{32}$/',$id))$out[]=['id'=>$id,'created_at'=>$h['created_at'],'kind'=>$h['kind']??'manual','bytes'=>filesize($path)];}
        usort($out,fn($a,$b)=>strcmp($b['created_at'],$a['created_at'])?:strcmp($b['id'],$a['id']));return $out;
    }
    public static function config(PortalApp $app): array
    {
        $s=$app->db()->prepare('SELECT setting_value FROM pisco_settings WHERE setting_key=?');$s->execute(['backups']);return [...['enabled'=>false,'hour'=>2,'retention'=>7,'last_day'=>''],...(json_decode($s->fetchColumn()?:'{}',true)??[])];
    }
    public static function configure(PortalApp $app,array $input): void
    {
        $app->requireAdmin();$hour=filter_var($input['hour']??null,FILTER_VALIDATE_INT);$retention=filter_var($input['retention']??null,FILTER_VALIDATE_INT);
        if($hour===false||$hour<0||$hour>23||$retention===false||$retention<2||$retention>30)throw new PortalError(422,'Hora o retención no válida.');
        $c=self::config($app);$c=[...$c,'enabled'=>($input['enabled']??false)===true,'hour'=>$hour,'retention'=>$retention];self::saveConfig($app,$c);
        PortalAudit::write($app,'Programar respaldos','Respaldos','',['habilitado'=>$c['enabled']?'sí':'no','hora'=>$hour,'retencion'=>$retention]);
    }
    private static function saveConfig(PortalApp $app,array $c): void
    {$app->db()->prepare('INSERT INTO pisco_settings (setting_key,setting_value) VALUES (?,?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)')->execute(['backups',json_encode($c,JSON_THROW_ON_ERROR)]);}
    public static function scheduled(PortalApp $app): ?array
    {
        $lock=fopen(self::directory().'/scheduler.lock','c+');if(!$lock||!flock($lock,LOCK_EX|LOCK_NB)){if($lock)fclose($lock);return null;}
        try{$c=self::config($app);if(!$c['enabled']||(int)date('G')<$c['hour']||$c['last_day']===date('Y-m-d'))return null;
            $backup=self::create($app,'programado');$c['last_day']=date('Y-m-d');self::saveConfig($app,$c);
            $scheduled=array_values(array_filter(self::listing(),fn($b)=>$b['kind']==='programado'));foreach(array_slice($scheduled,$c['retention']) as $old)unlink(self::path($old['id']));return $backup;
        }finally{flock($lock,LOCK_UN);fclose($lock);}
    }
    public static function restore(PortalApp $app,string $path): array
    {
        $actor=$app->requireAdmin();$db=$app->db();$s=@gzopen($path,'rb');if(!$s)throw new PortalError(422,'El respaldo no se puede leer.');
        $hash=hash_init('sha256');$counts=array_fill_keys(self::TABLES,0);$ended=false;$header=null;$total=0;$activeFile=null;
        try{
            $line=gzgets($s,67108866);$header=json_decode($line?:'',true,flags:JSON_THROW_ON_ERROR);
            if(($header['format']??'')!=='pisco-backup'||($header['version']??0)!==1||($header['schema']??0)>PortalSchema::VERSION)throw new PortalError(422,'Formato de respaldo no admitido. Usa una copia portable .piscobak de este portal.');
            $roles=$header['role_permissions']??[];if(!is_array($roles))throw new PortalError(422,'Roles del respaldo no válidos.');PortalPolicy::validateRoles($roles);
            hash_update($hash,$line);$db->beginTransaction();$db->query('SELECT id FROM pisco_state WHERE id=1 FOR UPDATE')->fetch();
            foreach(array_reverse(self::TABLES) as $table)$db->exec('DELETE FROM '.$table);
            while(($line=gzgets($s,67108866))!==false){$total+=strlen($line);if($total>2147483648||!str_ends_with($line,"\n"))throw new PortalError(422,'Respaldo demasiado grande o incompleto.');$item=json_decode($line,true,flags:JSON_THROW_ON_ERROR);
                if(!is_array($item))throw new PortalError(422,'Registro de respaldo no válido.');
                if(isset($item['end'])){
                    if($item['end']!==true||!hash_equals(hash_final($hash),(string)($item['sha256']??''))||$counts!==($item['counts']??null))throw new PortalError(422,'El respaldo está incompleto o fue alterado.');
                    if(gzread($s,1)!=='')throw new PortalError(422,'El respaldo contiene datos adicionales.');$ended=true;break;
                }
                hash_update($hash,$line);
                if(isset($item['chunk'])){
                    if($activeFile===null||$item['chunk']!==$activeFile||!is_string($item['data']??null)||strlen($item['data'])>700000)throw new PortalError(422,'Fragmento de archivo no válido.');
                    $bytes=base64_decode($item['data'],true);if($bytes===false)throw new PortalError(422,'Archivo codificado no válido.');
                    $db->prepare('UPDATE pisco_files SET contents=CONCAT(contents,?) WHERE id=?')->execute([$bytes,$activeFile]);continue;
                }
                $table=$item['table']??'';$row=$item['row']??null;
                if(!isset(self::COLUMNS[$table])||!is_array($row)||array_diff(array_keys($row),self::COLUMNS[$table])||array_diff(self::COLUMNS[$table],array_keys($row)))throw new PortalError(422,'La estructura del respaldo no es válida.');
                foreach($row as $value)if(is_array($value)||is_object($value))throw new PortalError(422,'Valor de respaldo no válido.');
                if($table==='pisco_users'){
                    if(!isset(PortalPolicy::definitions()['roles'][$row['role']])||password_get_info((string)$row['password'])['algo']===null)throw new PortalError(422,'El respaldo contiene una cuenta no válida.');
                    $row['auth_version']=random_int(100000,2147480000);$row['locked_until']=null;$row['login_failures']=0;
                }
                if($table==='pisco_state'){
                    $state=json_decode((string)$row['data'],true,flags:JSON_THROW_ON_ERROR);
                    PortalRules::structure($state);
                    foreach(['config','academico','programas','noticias','usuarios'] as $required)if(!isset($state[$required])||!is_array($state[$required]))throw new PortalError(422,'El contenido del respaldo está incompleto.');
                    if((int)$row['id']!==1)throw new PortalError(422,'Identificador de portal no válido.');
                    $row['revision']=max(1,(int)$row['revision'])+1;
                }
                $activeFile=null;
                if($table==='pisco_files'){
                    if(!preg_match('/^[a-f0-9]{32}$/',(string)$row['id'])||!preg_match('/^[a-f0-9]{64}$/',(string)$row['sha256'])||(int)$row['size']<1||(int)$row['size']>41943040)throw new PortalError(422,'Archivo del respaldo no válido.');
                    $activeFile=$row['id'];$row['contents']='';
                }
                $columns=array_keys($row);$db->prepare('INSERT INTO '.$table.' (`'.implode('`,`',$columns).'`) VALUES ('.implode(',',array_fill(0,count($columns),'?')).')')->execute(array_values($row));$counts[$table]++;
            }
            if(!$ended||$counts['pisco_state']!==1||(int)$db->query("SELECT COUNT(*) FROM pisco_users WHERE role='admin' AND active=1")->fetchColumn()<1)throw new PortalError(422,'Falta el final del respaldo o una cuenta administradora activa.');
            // La cola no se restaura: evita entregar avisos pendientes de la instalación reemplazada.
            $db->exec('DELETE FROM pisco_mail');
            if((int)$db->query('SELECT COUNT(*) FROM pisco_files WHERE sha256<>SHA2(contents,256) OR size<>OCTET_LENGTH(contents)')->fetchColumn())throw new PortalError(422,'Los archivos del respaldo no coinciden con sus hashes.');
            $db->prepare("INSERT INTO pisco_settings (setting_key,setting_value) VALUES ('role_permissions',?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)")->execute([json_encode($roles,JSON_THROW_ON_ERROR)]);
            PortalAudit::write($app,'Restaurar respaldo','Respaldos','',['fecha_copia'=>$header['created_at'],'registros'=>$counts],$actor);
            $db->commit();gzclose($s);$_SESSION=[];session_regenerate_id(true);$_SESSION['csrf']=bin2hex(random_bytes(32));return ['counts'=>$counts,'created_at'=>$header['created_at']];
        }catch(Throwable $e){if($db->inTransaction())$db->rollBack();gzclose($s);if($e instanceof JsonException||$e instanceof PDOException)throw new PortalError(422,'El respaldo contiene datos inválidos; no se aplicó ningún cambio.');throw $e;}
    }
}
