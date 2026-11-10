<?php
declare(strict_types=1);
require dirname(__DIR__).'/portal-private/bootstrap.php';
portal_headers();
$error = ''; $success = false; $closed = false;
try {
    $app = portal_app();
    $closed = $app->installed();
    if ($closed) http_response_code(410);
    elseif (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
        $app->checkCsrf(is_string($_POST['_csrf'] ?? null) ? $_POST['_csrf'] : '');
        $app->install($_POST);
        $success = true;
    }
} catch (Throwable $exception) {
    if (!$exception instanceof PortalError) portal_error($exception);
    $error = $exception->getMessage();
    http_response_code($exception->status);
}
function e(string $value): string { return htmlspecialchars($value, ENT_QUOTES, 'UTF-8'); }
?><!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Instalar portal Pisco</title><link rel="stylesheet" href="/forms.css"></head>
<body><main><h1>Instalar portal Pisco</h1>
<?php if ($closed): ?>
<section><p>El portal ya está instalado. El instalador quedó bloqueado.</p><a href="/">Ir al portal</a></section>
<?php elseif ($success): ?>
<section><p class="notice success" role="status">Instalación completada. Las tablas y tu cuenta de administrador están listas.</p><p>Ya puedes entrar con el usuario y la contraseña que acabas de elegir.</p><a href="/#/admin">Abrir la intranet</a></section>
<?php else: ?>
<p>Configura primero los datos de MySQL y tu clave privada en <code>portal-private/config.php</code>. Este paso crea las tablas y la primera cuenta.</p>
<?php if ($error): ?><p class="notice" role="alert"><?= e($error) ?></p><?php endif ?>
<section><form method="post" autocomplete="off">
<input type="hidden" name="_csrf" value="<?= e($_SESSION['csrf'] ?? '') ?>">
<label>Clave privada de instalación<input type="password" name="install_key" required minlength="32" autocomplete="off"></label>
<label>Tu nombre<input name="name" required maxlength="150" autocomplete="name"></label>
<label>Usuario de administrador<input name="username" required pattern="[a-zA-Z0-9._\-]{3,80}" maxlength="80" autocomplete="username"></label>
<label>Correo del administrador<input type="email" name="email" required maxlength="254" autocomplete="email"></label>
<label>Contraseña nueva (12 a 72 caracteres)<input type="password" name="password" required minlength="12" maxlength="72" autocomplete="new-password"></label>
<label>Repetir contraseña<input type="password" name="password_confirmation" required minlength="12" maxlength="72" autocomplete="new-password"></label>
<button type="submit">Instalar y crear mi cuenta</button>
</form></section>
<?php endif ?>
</main></body></html>
