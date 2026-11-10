<?php
declare(strict_types=1);
require dirname(__DIR__).'/portal-private/bootstrap.php';
portal_headers();
$route = is_string($_GET['route'] ?? null) ? trim($_GET['route'], '/') : '';
try {
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
    $serviceEntries = [
        '/mesa-de-partes.php'=>'servicios/mesa-de-partes',
        '/libro-de-reclamaciones.php'=>'servicios/libro-de-reclamaciones',
        '/bolsa-laboral.php'=>'servicios/bolsa-laboral',
        '/certificados.php'=>'servicios/consulta-certificados',
    ];
    $publicService = defined('PORTAL_PUBLIC_SERVICE') ? PORTAL_PUBLIC_SERVICE : null;
    if (!in_array($path, ['/', '/index.php'], true) && (!$publicService || ($serviceEntries[$path]??null)!==$publicService)) throw new PortalError(404, 'Página no encontrada.');
    $app = portal_app();
    if ($route !== '') {
        $method = $_SERVER['REQUEST_METHOD'];
        if ($method !== 'GET') {
            $app->checkCsrf($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
        }
        if ($route === 'api/archivo' && $method === 'GET') PortalFiles::serve($app, is_string($_GET['id']??null)?$_GET['id']:'');
        if ($route === 'api/archivos' && $method === 'POST') portal_json($app->upload(),201);
        // Cerrar sesión no necesita un cuerpo JSON; la protección CSRF ya se comprobó.
        if ($route === 'api/session' && $method === 'DELETE') portal_json($app->logout());
        $input = $method === 'GET' ? [] : $app->input();
        // Con una contraseña temporal solo se permite cargar el portal, cambiarla o cerrar sesión.
        if (!in_array($route, ['api/portal', 'api/password', 'api/session', 'api/visitas', 'api/eventos'], true) || ($route === 'api/portal' && $method !== 'GET')) {
            if (!empty($app->user()['cambiarClave'])) throw new PortalError(403, 'Cambia tu contraseña temporal antes de continuar.');
        }
        if ($route === 'api/desafio' && $method === 'POST') portal_json($app->challenge($input));
        if ($route === 'api/eventos' && $method === 'POST') portal_json($app->interfaceEvent($input));
        if ($route === 'api/cuentas' && $method === 'POST') portal_json($app->accountOperation($input));
        if ($route === 'api/password' && $method === 'POST') { $app->changePassword($input); portal_json(['ok'=>true]); }
        if ($route === 'api/empresas' && $method === 'POST') portal_json($app->registerCompany($input),201);
        if ($route === 'api/visitas' && $method === 'POST') portal_json($app->track($input));
        if ($route === 'api/portal' && $method === 'GET') portal_json($app->bootstrap());
        if ($route === 'api/notificaciones' && $method === 'GET') portal_json($app->mailStatus());
        if ($route === 'api/smtp' && $method === 'GET') portal_json($app->smtpForm());
        if ($route === 'api/smtp' && $method === 'PUT') portal_json($app->saveSmtp($input));
        if ($route === 'api/notificaciones/reintentar' && $method === 'POST') portal_json(PortalMail::retry($app,$input));
        if ($route === 'api/portal' && $method === 'PUT') portal_json($app->save($input));
        if ($route === 'api/session' && $method === 'POST') portal_json($app->login($input));
        if (preg_match('#^api/solicitudes/([a-z]+)$#', $route, $match) && $method === 'POST') {
            $result = $app->submit($match[1], $input);
            $status = $result['status']; unset($result['status']);
            portal_json($result, $status);
        }
        if (preg_match('#^api/consultas/([a-z]+)$#', $route, $match) && $method === 'POST') portal_json($app->lookup($match[1], $input));
        throw new PortalError(404, 'Ruta no encontrada.');
    }
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') throw new PortalError(405, 'Método no permitido.');
    $bootstrap = $app->bootstrap();
    if($publicService)$bootstrap['standaloneService']=$publicService;
    header('Content-Type: text/html; charset=utf-8');
    require dirname(__DIR__).'/portal-private/views/portal.php';
} catch (Throwable $error) {
    portal_error($error, $route !== '');
}
