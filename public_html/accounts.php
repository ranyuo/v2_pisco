<?php
declare(strict_types=1);
require dirname(__DIR__).'/portal-private/bootstrap.php';
portal_headers();
$error = ''; $notice = '';
try {
    $app = portal_app();
    $actor=$app->requireUser();
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
        $app->checkCsrf(is_string($_POST['_csrf'] ?? null) ? $_POST['_csrf'] : '');
        if (($_POST['action'] ?? '') === 'password') {
            $temporary=!empty($actor['cambiarClave']);
            $app->changePassword($_POST);
            if($temporary){header('Location: /#/admin/dashboard', true, 303); exit;}
            $_SESSION['account_notice'] = 'Contraseña actualizada.';
        } else {
            $app->createAccount($_POST);
            $_SESSION['account_notice'] = 'Cuenta creada con su rol y vínculos.';
        }
        header('Location: /accounts.php', true, 303); exit;
    }
    $notice = $_SESSION['account_notice'] ?? '';
    unset($_SESSION['account_notice']);
    $users = $actor['rol']==='admin'?$app->accounts():[];
} catch (Throwable $exception) {
    if (!$exception instanceof PortalError || in_array($exception->status, [403, 419], true)) portal_error($exception);
    $error = $exception->getMessage();
    http_response_code($exception->status);
    $users = $actor['rol']==='admin'?$app->accounts():[];
}
function e(string $value): string { return htmlspecialchars($value, ENT_QUOTES, 'UTF-8'); }
?><!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cuentas | Portal Pisco</title><link rel="stylesheet" href="/forms.css"></head>
<body><main><a href="/#/admin/dashboard">← Volver al panel</a><h1>Cuentas del portal</h1>
<?php if ($notice): ?><p class="notice success" role="status"><?= e($notice) ?></p><?php endif ?>
<?php if ($error): ?><p class="notice" role="alert"><?= e($error) ?></p><?php endif ?>
<?php if (!empty($actor['cambiarClave'])): ?><p class="notice" role="alert">Por seguridad, cambia la contraseña temporal que recibiste antes de usar la intranet.</p><?php elseif ($notice === 'Contraseña actualizada.'): ?><p><a href="/#/admin/dashboard">Ir a la intranet →</a></p><?php endif ?>
<?php if($actor['rol']==='admin'): ?><section><h2>Usuarios del portal</h2><p>Cada cuenta accede a los módulos de su rol y a los registros con los que está vinculada.</p><ul><?php foreach ($users as $user): ?><li><?= e($user['name']) ?> — <?= e($user['username']) ?> (<?= e($user['role']) ?>)</li><?php endforeach ?></ul></section>
<section><h2>Crear usuario</h2><form method="post">
<input type="hidden" name="_csrf" value="<?= e($_SESSION['csrf']) ?>"><input type="hidden" name="action" value="create">
<label>Nombre<input name="name" required maxlength="150" autocomplete="name"></label>
<label>Usuario<input name="username" required pattern="[a-z0-9._\-]{3,80}" autocomplete="off"></label>
<label>Correo<input type="email" name="email" required maxlength="254" autocomplete="email"></label>
<label>Rol<select name="role" style="display:block;width:100%;padding:10px"><?php foreach(PortalPolicy::definitions()['roles'] as $key=>$r):?><option value="<?=e($key)?>"><?=e($r['label'])?></option><?php endforeach ?></select></label>
<label>Programa del coordinador<input name="programaId" placeholder="Ej.: apsti"></label><label>Vínculo académico<input name="vin" placeholder="doc:2, est:1 o emp:1"></label><label>Persona del docente<input name="personaId" placeholder="ID de la persona en Plana docente"></label><label>DNI / RUC<input name="dni"></label><label>Área<input name="area"></label>
<label>Contraseña nueva<input type="password" name="password" required minlength="12" maxlength="72" autocomplete="new-password"></label>
<label>Repetir contraseña<input type="password" name="password_confirmation" required minlength="12" maxlength="72" autocomplete="new-password"></label><button>Crear cuenta</button>
</form></section><?php endif ?>
<section><h2>Cambiar mi contraseña</h2><form method="post">
<input type="hidden" name="_csrf" value="<?= e($_SESSION['csrf']) ?>"><input type="hidden" name="action" value="password">
<label>Contraseña actual<input type="password" name="current_password" required maxlength="72" autocomplete="current-password"></label>
<label>Contraseña nueva<input type="password" name="password" required minlength="12" maxlength="72" autocomplete="new-password"></label>
<label>Repetir contraseña<input type="password" name="password_confirmation" required minlength="12" maxlength="72" autocomplete="new-password"></label><button>Cambiar contraseña</button>
</form></section></main></body></html>
