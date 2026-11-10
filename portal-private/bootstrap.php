<?php
declare(strict_types=1);
require_once __DIR__.'/Portal.php';

function portal_app(): PortalApp
{
    $path = getenv('PORTAL_CONFIG_FILE') ?: __DIR__.'/config.php';
    if (!is_file($path)) {
        throw new PortalError(503, 'Primero configura portal-private/config.php siguiendo la guía de instalación.');
    }
    $config = require $path;
    if (!is_array($config)) {
        throw new PortalError(503, 'La configuración no es válida.');
    }
    date_default_timezone_set($config['timezone'] ?? 'America/Lima');
    if (session_status() !== PHP_SESSION_ACTIVE) {
        ini_set('session.use_strict_mode', '1');
        ini_set('session.use_only_cookies', '1');
        ini_set('session.gc_maxlifetime', '1800');
        session_name('PISCOSESSID');
        session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'secure' => $config['secure_cookies'] ?? true,
            'httponly' => true, 'samesite' => 'Lax']);
        session_start();
    }
    if (isset($_SESSION['last_seen']) && time() - $_SESSION['last_seen'] > 1800) {
        $_SESSION = [];
        session_regenerate_id(true);
    }
    $_SESSION['last_seen'] = time();
    $_SESSION['csrf'] ??= bin2hex(random_bytes(32));
    return new PortalApp($config, realpath($path) ?: $path);
}

function portal_headers(): void
{
    header('Cache-Control: no-store, private');
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: SAMEORIGIN');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
    // HSTS solo sobre HTTPS para no bloquear pruebas locales por HTTP.
    if ((($_SERVER['HTTPS'] ?? '') !== '' && $_SERVER['HTTPS'] !== 'off') || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https') header('Strict-Transport-Security: max-age=31536000');
    header_remove('X-Powered-By');
}

/** URL de un recurso estático con versión (fecha de modificación) para que el navegador lo guarde en caché sin quedar desactualizado. */
function portal_asset(string $file): string
{
    $root = realpath((string) ($_SERVER['DOCUMENT_ROOT'] ?? '')) ?: dirname(__DIR__).'/public_html';
    $url = str_starts_with($file, '/') ? $file : '/assets/app/'.$file;
    $path = $root.$url;
    return htmlspecialchars($url.'?v='.(is_file($path) ? filemtime($path) : '0'), ENT_QUOTES, 'UTF-8');
}

/**
 * Programa una tarea para después de entregar la respuesta (p. ej. el primer intento de envío SMTP).
 * En CLI (cron, pruebas) se ejecuta de inmediato porque no hay un cliente esperando.
 */
function portal_defer(callable $task): void
{
    if (PHP_SAPI === 'cli') { portal_run_task($task); return; }
    $GLOBALS['portal_deferred_tasks'][] = $task;
}

function portal_run_task(callable $task): void
{
    try { $task(); } catch (Throwable $error) { error_log('Portal: tarea diferida fallida: '.$error->getMessage()); }
}

/** Cierra la respuesta HTTP y ejecuta las tareas diferidas sin que el usuario espere. */
function portal_finish_deferred(): void
{
    $tasks = $GLOBALS['portal_deferred_tasks'] ?? [];
    $GLOBALS['portal_deferred_tasks'] = [];
    if (!$tasks) return;
    if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
    ignore_user_abort(true);
    if (function_exists('fastcgi_finish_request')) fastcgi_finish_request();
    elseif (function_exists('litespeed_finish_request')) litespeed_finish_request();
    else { while (ob_get_level() > 0) ob_end_flush(); flush(); }
    @set_time_limit(120);
    foreach ($tasks as $task) portal_run_task($task);
}

function portal_json(array $body, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    $json = json_encode(PortalContent::forJson($body), JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_THROW_ON_ERROR);
    if (!empty($GLOBALS['portal_deferred_tasks'])) { header('Content-Length: '.strlen($json)); header('Connection: close'); }
    echo $json;
    portal_finish_deferred();
    exit;
}

function portal_error(Throwable $error, bool $json = false): never
{
    if ($error instanceof PortalError) {
        $status = $error->status;
        $message = $error->getMessage();
    } else {
        $status = 503;
        $message = 'No se pudo completar la operación. Revisa la configuración de MySQL o consulta al responsable del sitio.';
        // Base vacía (instalación nueva): se indica el instalador en lugar del error genérico.
        if ($error instanceof PDOException && $error->getCode() === '42S02') $message = 'El portal aún no está instalado. Abre /install.php para crear las tablas y la cuenta administradora.';
        error_log('Portal: '.get_class($error).' ('.$error->getCode().')');
    }
    if ($json) {
        portal_json(['message' => $message], $status);
    }
    http_response_code($status);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Portal institucional</title><main style="font:18px/1.6 system-ui;max-width:700px;margin:60px auto;padding:24px"><h1>Portal institucional</h1><p>'.htmlspecialchars($message, ENT_QUOTES, 'UTF-8').'</p></main></html>';
    exit;
}
