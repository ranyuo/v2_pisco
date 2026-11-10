<?php
declare(strict_types=1);
require_once __DIR__.'/Content.php';

final class PortalSchema
{
    public const VERSION = 7;
    public static function apply(PDO $db): void
    {
        foreach (explode(';', file_get_contents(__DIR__.'/schema.sql')) as $sql) if (trim($sql) !== '') $db->exec($sql);
        $mailInfo=$db->query('SHOW COLUMNS FROM pisco_mail')->fetchAll(PDO::FETCH_ASSOC);
        $mailColumns=array_column($mailInfo,'Field');
        foreach($mailInfo as $column)if($column['Field']==='created_at'&&strtolower($column['Type'])!=='datetime(6)')$db->exec('ALTER TABLE pisco_mail MODIFY created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)');
        foreach(['source_type'=>"VARCHAR(30) NOT NULL DEFAULT 'expedientes'",'source_id'=>"VARCHAR(100) NOT NULL DEFAULT ''",'source_key'=>"CHAR(64) NOT NULL DEFAULT ''",'event'=>"VARCHAR(40) NOT NULL DEFAULT 'registro'"] as $name=>$type)if(!in_array($name,$mailColumns,true))$db->exec('ALTER TABLE pisco_mail ADD COLUMN '.$name.' '.$type);
        $columns = array_column($db->query('SHOW COLUMNS FROM pisco_users')->fetchAll(PDO::FETCH_ASSOC), 'Field');
        foreach (['role' => "VARCHAR(30) NOT NULL DEFAULT 'admin'", 'profile' => 'JSON NULL',
            'auth_version' => 'INT UNSIGNED NOT NULL DEFAULT 1', 'login_failures' => 'INT UNSIGNED NOT NULL DEFAULT 0',
            'locked_until' => 'DATETIME NULL', 'last_login' => 'DATETIME NULL'] as $name => $type) {
            if (!in_array($name, $columns, true)) $db->exec('ALTER TABLE pisco_users ADD COLUMN '.$name.' '.$type);
        }
        $imported=$db->query("SELECT setting_value FROM pisco_settings WHERE setting_key='legacy_audit_imported'")->fetchColumn();
        $state=$db->query('SELECT data FROM pisco_state WHERE id=1')->fetchColumn();
        if(!$imported&&$state){
            $legacy=json_decode($state,true,flags:JSON_THROW_ON_ERROR)['auditoria']??[];
            $insert=$db->prepare('INSERT INTO pisco_audit (occurred_at,user_id,username,role,action,entity,record_key,details) VALUES (?,NULL,?,?,?,?,?,?)');
            $ownTransaction=!$db->inTransaction();if($ownTransaction)$db->beginTransaction();
            try{foreach($legacy as $row){if(!is_array($row))continue;$stamp=strtotime((string)($row['fecha']??''));$insert->execute([date('Y-m-d H:i:s',$stamp?:time()),substr((string)($row['usuario']??'historial'),0,80),substr((string)($row['rol']??''),0,30),substr((string)($row['accion']??'Historial anterior'),0,80),substr((string)($row['entidad']??'Portal'),0,100),substr((string)($row['registro']??''),0,250),json_encode(['origen'=>'Historial previo','detalle'=>$row['detalle']??''],JSON_THROW_ON_ERROR)]);}
                $db->exec("INSERT INTO pisco_settings (setting_key,setting_value) VALUES ('legacy_audit_imported','true') ON DUPLICATE KEY UPDATE setting_value='true'");if($ownTransaction)$db->commit();
            }catch(Throwable $e){if($ownTransaction&&$db->inTransaction())$db->rollBack();throw $e;}
        }
        // Normaliza conceptos heredados y completa verificaciones de reclamos sin alterar su seguimiento.
        $ownTransaction=!$db->inTransaction();if($ownTransaction)$db->beginTransaction();
        try {
            $row=$db->query('SELECT data FROM pisco_state WHERE id=1 FOR UPDATE')->fetch();
            if($row){$data=json_decode($row['data'],true,flags:JSON_THROW_ON_ERROR);$normalized=PortalContent::normalize($data);$changed=$data!==$normalized;$data=$normalized;$used=[];
                foreach($data['reclamos']??[] as $claim)if(!empty($claim['cargoCod']))$used[strtoupper($claim['cargoCod'])]=true;
                if(isset($data['reclamos']))foreach($data['reclamos'] as &$claim)if(empty($claim['cargoCod'])){do{$code=strtoupper(bin2hex(random_bytes(8)));}while(isset($used[$code]));$claim['cargoCod']=$code;$used[$code]=true;$changed=true;}unset($claim);
                $normalized=PortalContent::normalize($data);$changed=$changed||$normalized!==$data;$data=$normalized;
                if($changed)$db->prepare('UPDATE pisco_state SET data=?,revision=revision+1 WHERE id=1')->execute([json_encode($data,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE)]);
            }
            if($ownTransaction)$db->commit();
        }catch(Throwable $error){if($ownTransaction&&$db->inTransaction())$db->rollBack();throw $error;}
        $db->prepare('INSERT INTO pisco_schema (id,version) VALUES (1,?) ON DUPLICATE KEY UPDATE version = VALUES(version)')->execute([self::VERSION]);
    }
}
