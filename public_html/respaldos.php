<?php
declare(strict_types=1);
require dirname(__DIR__).'/portal-private/bootstrap.php';portal_headers();
$error='';$message='';$restored=false;$app=null;
try{
    $app=portal_app();$actor=$app->requireAdmin();
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET' && isset($_SESSION['portal_backup_notice'])) {
        $message = $_SESSION['portal_backup_notice'];
        unset($_SESSION['portal_backup_notice']);
    }
    if(isset($_GET['download'])){
        $id=is_string($_GET['download'])?$_GET['download']:'';$path=PortalBackups::path($id);if(!is_file($path))throw new PortalError(404,'Respaldo no encontrado.');
        PortalAudit::write($app,'Descargar respaldo portable','Respaldos',$id);header('Content-Type: application/gzip');header('Content-Disposition: attachment; filename="'.$id.'.piscobak"');header('Content-Length: '.filesize($path));readfile($path);exit;
    }
    if(($_SERVER['REQUEST_METHOD']??'GET')==='POST'){
        $app->checkCsrf(is_string($_POST['_csrf']??null)?$_POST['_csrf']:'');$action=$_POST['action']??'';
        if($action==='create'){$b=PortalBackups::create($app);$message='Respaldo completo creado. Puedes descargarlo o restaurarlo desde esta pantalla.';}
        elseif($action==='configure'){PortalBackups::configure($app,['enabled'=>isset($_POST['enabled']),'hour'=>$_POST['hour']??null,'retention'=>$_POST['retention']??null]);$message='Programación guardada. La tarea privada de hPanel ejecutará los respaldos según este horario.';}
        elseif($action==='run'){$result=PortalBackups::scheduled($app);$message=$result?'Respaldo programado completado.':'No hay un respaldo programado pendiente para hoy.';}
        elseif($action==='restore'){
            if(($_POST['confirmation']??'')!=='RESTAURAR')throw new PortalError(422,'Escribe RESTAURAR para confirmar.');
            $stmt=$app->db()->prepare('SELECT password FROM pisco_users WHERE id=?');$stmt->execute([$actor['server_id']]);
            if(!is_string($_POST['password']??null)||!password_verify($_POST['password'],$stmt->fetchColumn()))throw new PortalError(422,'La contraseña actual no es correcta.');
            $file=$_FILES['backup']??null;
            if($file&&($file['error']??UPLOAD_ERR_NO_FILE)!==UPLOAD_ERR_NO_FILE){
                if($file['error']!==UPLOAD_ERR_OK||!is_uploaded_file($file['tmp_name']))throw new PortalError(422,'No se pudo recibir el respaldo.');$source=$file['tmp_name'];
            }else{$source=PortalBackups::path(is_string($_POST['backup_id']??null)?$_POST['backup_id']:'');if(!is_file($source))throw new PortalError(404,'Selecciona o sube un respaldo existente.');}
            PortalBackups::create($app,'previo-restauracion');$result=PortalBackups::restore($app,$source);$restored=true;
            $message='Restauración completada. Se conservaron los archivos y el historial de auditoría del servidor. Por seguridad se cerraron las sesiones: entra con una cuenta incluida en el respaldo.';
        }else throw new PortalError(422,'Acción no válida.');
        if (!$restored) {
            $_SESSION['portal_backup_notice'] = $message;
            header('Location: /respaldos.php', true, 303);
            exit;
        }
    }
    if(!$restored){$schedule=PortalBackups::config($app);$backups=PortalBackups::listing();}
}catch(Throwable $e){if(!$e instanceof PortalError)portal_error($e);http_response_code($e->status);$error=$e->getMessage();}
function e(string $v):string{return htmlspecialchars($v,ENT_QUOTES,'UTF-8');}
?><!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Respaldos | Portal Pisco</title><link rel="stylesheet" href="/forms.css"></head><body><main style="max-width:1050px"><a href="/#/admin/respaldo">Volver a la intranet</a><h1>Respaldos y restauración</h1>
<?php if($error):?><p class="notice" role="alert"><?=e($error)?></p><?php endif ?>
<?php if($message):?><p class="notice success" role="status"><?=e($message)?></p><?php endif ?>
<?php if($restored):?><p><a href="/#/admin">Iniciar sesión</a></p>
<?php elseif(isset($schedule,$backups)):?>
<section><h2>Crear y descargar</h2><p>Las copias portables incluyen contenido, cuentas y adjuntos reales. Guárdalas en un lugar privado. La configuración de conexión del hosting se conserva por separado.</p><form method="post"><input type="hidden" name="_csrf" value="<?=e($_SESSION['csrf'])?>"><input type="hidden" name="action" value="create"><button>Crear respaldo completo</button></form><form method="post" action="/backup.php"><input type="hidden" name="_csrf" value="<?=e($_SESSION['csrf'])?>"><button style="margin-top:10px">Descargar también como SQL</button></form>
<ul><?php foreach($backups as $b):?><li><?=e($b['created_at'])?> · <?=e($b['kind'])?> · <?=number_format($b['bytes']/1048576,2)?> MB · <a href="?download=<?=e($b['id'])?>">Descargar copia portable</a></li><?php endforeach ?></ul></section>
<section><h2>Restaurar una copia</h2><p>Reemplaza el contenido y las cuentas por la copia elegida. Antes se crea automáticamente otra copia del estado actual. Se verifica el archivo completo y sus adjuntos; un error revierte la operación.</p><form method="post" enctype="multipart/form-data"><input type="hidden" name="_csrf" value="<?=e($_SESSION['csrf'])?>"><input type="hidden" name="action" value="restore"><label>Respaldo del servidor<select name="backup_id"><option value="">Selecciona una copia</option><?php foreach($backups as $b):?><option value="<?=e($b['id'])?>"><?=e($b['created_at'].' · '.$b['kind'])?></option><?php endforeach ?></select></label><p>Para copias que excedan el límite de subida de PHP, súbelas con hPanel a <code>portal-private/backups</code> conservando su nombre y selecciónalas en la lista.</p><label>O sube una copia portable .piscobak<input type="file" name="backup" accept=".piscobak,application/gzip"></label><label>Tu contraseña actual<input type="password" name="password" required autocomplete="current-password"></label><label>Escribe RESTAURAR para confirmar<input name="confirmation" required pattern="RESTAURAR" autocomplete="off"></label><button>Restaurar contenido, cuentas y archivos</button></form></section>
<section><h2>Respaldos diarios</h2><form method="post"><input type="hidden" name="_csrf" value="<?=e($_SESSION['csrf'])?>"><input type="hidden" name="action" value="configure"><label><input type="checkbox" name="enabled" <?=$schedule['enabled']?'checked':''?>> Activar respaldos diarios</label><label>Hora local (0 a 23)<input type="number" name="hour" min="0" max="23" value="<?=(int)$schedule['hour']?>" required></label><label>Copias programadas que se conservan (2 a 30)<input type="number" name="retention" min="2" max="30" value="<?=(int)$schedule['retention']?>" required></label><button>Guardar programación</button></form><p>Zona horaria: <?=e(date_default_timezone_get())?>. Última copia programada: <?=e($schedule['last_day']?:'Todavía ninguna')?>.</p><p>En hPanel → Avanzado → Tareas cron configura una tarea PHP que ejecute cada hora este archivo privado:</p><code><?=e(dirname(__DIR__).'/portal-private/cron.php')?></code><p>La tarea aplica el horario, evita duplicados del mismo día y elimina las copias programadas que excedan la retención. No necesita contraseñas en la URL.</p><form method="post"><input type="hidden" name="_csrf" value="<?=e($_SESSION['csrf'])?>"><input type="hidden" name="action" value="run"><button>Ejecutar programación ahora</button></form></section>
<?php endif ?></main></body></html>
