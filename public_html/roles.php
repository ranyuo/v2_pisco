<?php
declare(strict_types=1);
require dirname(__DIR__).'/portal-private/bootstrap.php';
portal_headers();$error='';$notice='';$input=[];
try {
    $app=portal_app();$app->requireAdmin();
    if(($_SERVER['REQUEST_METHOD']??'GET')==='POST'){
        $app->checkCsrf(is_string($_POST['_csrf']??null)?$_POST['_csrf']:'');
        $input=['role'=>$_POST['role']??null,'label'=>$_POST['label']??'', 'mods'=>$_POST['mods']??[],
            'expected'=>json_decode(is_string($_POST['expected']??null)?$_POST['expected']:'null',true,flags:JSON_THROW_ON_ERROR),'reset'=>($_POST['action']??'')==='reset'];
        $app->saveRole($input);
        $_SESSION['roles_notice']='Rol actualizado. Sus usuarios deberán iniciar sesión de nuevo para aplicar los permisos.';
        header('Location: /roles.php?role='.rawurlencode($input['role']),true,303);exit;
    }
    $notice=$_SESSION['roles_notice']??'';unset($_SESSION['roles_notice']);
} catch(Throwable $exception){
    if(!$exception instanceof PortalError||!in_array($exception->status,[409,422],true))portal_error($exception);
    http_response_code($exception->status);$error=$exception->getMessage();
}
$overrides=$app->roleSettings();$definitions=PortalPolicy::defaults();$roles=PortalPolicy::definitions()['roles'];
$key=is_string($_GET['role']??null)?$_GET['role']:'imagen';if(isset($input['role'])&&is_string($input['role']))$key=$input['role'];
if(!isset($roles[$key]))$key='imagen';$role=$roles[$key];$protected=$key==='admin';
function e(string $v):string{return htmlspecialchars($v,ENT_QUOTES,'UTF-8');}
?><!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Roles y permisos | Portal Pisco</title><link rel="stylesheet" href="/forms.css"><style>
body{background:#f2f6fb;color:#102447}main{max-width:1050px;margin:auto;padding:24px}nav{display:flex;gap:8px;flex-wrap:wrap;margin:24px 0}nav a{padding:10px;border:1px solid #ccd6e5;border-radius:8px;background:white;text-decoration:none}nav a[aria-current]{background:#102447;color:white}.modules{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}.modules label{display:flex;align-items:center;gap:12px;padding:12px;border:1px solid #ccd6e5;border-radius:8px;margin:0}.modules input{width:20px;height:20px;flex:0 0 20px}.tools{display:flex;gap:12px;flex-wrap:wrap;margin-top:24px}button.secondary{background:#fff;color:#102447;border:1px solid #ccd6e5}fieldset{border:0;padding:0;min-width:0}legend{font-weight:bold;margin-bottom:16px}section{background:white;border:1px solid #d3dce8;border-radius:14px;padding:24px}input[type=text]{box-sizing:border-box;width:100%}
</style></head><body><main><a href="/#/admin/usuarios">← Volver a Usuarios y roles</a><h1>Roles y permisos</h1>
<p>Edite el nombre y los módulos habilitados de cada perfil. Los permisos se guardan en MySQL y se verifican en el servidor.</p>
<?php if($notice):?><p class="notice success" role="status"><?=e($notice)?></p><?php endif ?>
<?php if($error):?><p class="notice" role="alert"><?=e($error)?></p><?php endif ?>
<nav aria-label="Seleccione un rol"><?php foreach($roles as $id=>$r):?><a href="?role=<?=e($id)?>" <?=$id===$key?'aria-current="page"':''?>><?=e($r['label'])?></a><?php endforeach ?></nav>
<section><h2><?=e($role['label'])?></h2><p>Perfil institucional: <?=e($definitions['roles'][$key]['label'])?>.</p>
<?php if($protected):?><p>El administrador conserva todos los permisos y la gestión de cuentas. Este perfil está protegido para evitar perder el acceso al sistema.</p>
<?php else:?>
<p>Active o desactive los módulos del ámbito de este perfil. Los vínculos con alumno, docente, empresa o programa y las reglas de aprobación se mantienen.</p>
<form method="post"><input type="hidden" name="_csrf" value="<?=e($_SESSION['csrf'])?>"><input type="hidden" name="role" value="<?=e($key)?>"><input type="hidden" name="expected" value="<?=e(json_encode($overrides[$key]??null,JSON_THROW_ON_ERROR))?>">
<label>Nombre del rol<input type="text" name="label" maxlength="100" required value="<?=e($role['label'])?>"></label>
<fieldset><legend>Módulos habilitados</legend><div class="modules"><?php foreach($definitions['roles'][$key]['mods'] as $mod):?>
<label><input type="checkbox" name="mods[]" value="<?=e($mod)?>" <?=in_array($mod,$role['mods'],true)?'checked':''?> <?=$mod==='dashboard'?'disabled':''?>><?=e($definitions['modules'][$mod]??$mod)?></label>
<?php endforeach ?></div></fieldset>
<p>Al guardar o restaurar, se cerrarán las sesiones de los usuarios de este rol. No se modifican sus cuentas ni sus contraseñas.</p>
<div class="tools"><button name="action" value="save">Guardar permisos</button><button class="secondary" name="action" value="reset" formnovalidate>Restaurar permisos originales</button></div>
</form><?php endif ?></section></main></body></html>
