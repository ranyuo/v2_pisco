<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/portal-private/bootstrap.php';portal_headers();
try {
    $app=portal_app();$app->requireAdmin();
    if(($_SERVER['REQUEST_METHOD']??'GET')!=='POST')throw new PortalError(405,'Usa el botón de copia de seguridad de la intranet.');
    $app->checkCsrf(is_string($_POST['_csrf']??null)?$_POST['_csrf']:'');
    $db=$app->db();$tables=['pisco_state','pisco_users','pisco_schema','pisco_visits','pisco_files','pisco_rate_limits','pisco_audit','pisco_settings','pisco_mail'];
    $db->exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');$db->beginTransaction();
    PortalAudit::write($app,'Descargar respaldo','Respaldos');
    header('Content-Type: application/sql; charset=utf-8');header('Content-Disposition: attachment; filename="portal-ica-'.date('Ymd-His').'.sql"');
    echo "-- Copia privada del portal. Contiene cuentas y archivos.\nSET NAMES utf8mb4;\nSET SQL_MODE='NO_AUTO_VALUE_ON_ZERO';\nSET FOREIGN_KEY_CHECKS=0;\n";
    foreach($tables as $table){
        $ddl=$db->query('SHOW CREATE TABLE '.$table)->fetch(PDO::FETCH_NUM)[1];echo 'DROP TABLE IF EXISTS `'.$table."`;\n".$ddl.";\n";
        // Restaurar la estructura de la cola sin reenviar mensajes de la instalación anterior.
        if($table==='pisco_mail')continue;
        $rows=(function()use($db,$table){if($table==='pisco_files'){$ids=$db->query('SELECT id FROM pisco_files ORDER BY id')->fetchAll(PDO::FETCH_COLUMN);$stmt=$db->prepare('SELECT * FROM pisco_files WHERE id=?');foreach($ids as $id){$stmt->execute([$id]);yield $stmt->fetch(PDO::FETCH_ASSOC);$stmt->closeCursor();}}else{$stmt=$db->query('SELECT * FROM '.$table);while($row=$stmt->fetch(PDO::FETCH_ASSOC))yield $row;}})();$columns=null;
        foreach($rows as $row){
            $columns??=implode(',',array_map(fn($k)=>'`'.$k.'`',array_keys($row)));
            $values=[];foreach($row as $key=>$value)$values[]=$value===null?'NULL':($table==='pisco_files'&&$key==='contents'?($value===''?"X''":(strlen($value)>524288?"X''":'0x'.bin2hex($value))):$db->quote((string)$value));
            echo 'INSERT INTO `'.$table.'` ('.$columns.') VALUES ('.implode(',',$values).");\n";
            if($table==='pisco_files'&&strlen($row['contents'])>524288)for($offset=0;$offset<strlen($row['contents']);$offset+=524288)echo 'UPDATE `pisco_files` SET `contents`=CONCAT(`contents`,0x'.bin2hex(substr($row['contents'],$offset,524288)).') WHERE `id`='.$db->quote($row['id']).";\n";
        }
    }
    echo "SET FOREIGN_KEY_CHECKS=1;\n";$db->commit();
}catch(Throwable $e){if(isset($db)&&$db->inTransaction())$db->rollBack();portal_error($e);}
