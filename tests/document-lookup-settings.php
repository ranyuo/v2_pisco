<?php
declare(strict_types=1);
// Configuración de la API de DNI/RUC: cifrado, token oculto, validación y prioridad sobre config.php. Sin base de datos.
require dirname(__DIR__).'/portal-private/Portal.php';

function check(bool $ok, string $message): void { if (!$ok) { fwrite(STDERR, "FALLA: $message\n"); exit(1); } }
function fails(callable $call, int $status, string $pattern, string $message): void
{
    try { $call(); } catch (PortalError $e) { check($e->status === $status && preg_match($pattern, $e->getMessage()) === 1, "$message ({$e->status}: {$e->getMessage()})"); return; }
    check(false, "$message: no lanzó error");
}

$dir = sys_get_temp_dir().'/pisco-idapi-'.bin2hex(random_bytes(4)); mkdir($dir, 0700);
$configFile = $dir.'/config.php'; touch($configFile);
$key = 'clave-de-prueba-0123456789abcdef0123456789';
$path = $dir.'/.document-lookup.json';
$checks = 0;
try {
    // Sin archivo: valores por defecto y, si existe, el bloque de config.php.
    $s = new PortalDocumentLookupSettings(['install_key' => $key], $configFile);
    $v = $s->view();
    check($v['enabled'] === false && $v['provider'] === 'migo' && $v['base_url'] === 'https://api.migo.pe/api/v2' && $v['has_token'] === false && $v['per_minute'] === 8 && $v['per_hour'] === 40, 'valores por defecto: '.json_encode($v)); $checks++;
    check(isset($v['providers']['migo'], $v['providers']['decolecta']), 'lista de proveedores'); $checks++;
    $legacy = new PortalDocumentLookupSettings(['install_key' => $key, 'document_lookup' => ['enabled' => true, 'token' => 'desde-config-1234']], $configFile);
    check($legacy->read()['token'] === 'desde-config-1234' && $legacy->view()['token_hint'] === '••••1234', 'config.php sirve como valor inicial'); $checks++;

    $form = ['enabled' => true, 'provider' => 'migo', 'base_url' => 'https://api.migo.pe/api/v2/', 'token' => 'fa28-token-secreto-9d950', 'per_minute' => 5, 'per_hour' => 30];
    $v = $s->save($form);
    check($v['enabled'] && $v['has_token'] && $v['token_hint'] === '••••d950' && $v['base_url'] === 'https://api.migo.pe/api/v2', 'guardar: '.json_encode($v)); $checks++;
    check(!str_contains(json_encode($v), 'token-secreto'), 'la vista nunca incluye el token'); $checks++;
    $raw = file_get_contents($path);
    check(!str_contains($raw, 'token-secreto') && !str_contains($raw, 'migo.pe'), 'el archivo está cifrado'); $checks++;
    check((fileperms($path) & 0777) === 0600, 'el archivo es privado (0600)'); $checks++;
    check($s->read()['token'] === 'fa28-token-secreto-9d950' && $s->read()['per_minute'] === 5, 'lectura descifrada'); $checks++;

    // Lo guardado tiene prioridad sobre config.php.
    $withConfig = new PortalDocumentLookupSettings(['install_key' => $key, 'document_lookup' => ['enabled' => false, 'token' => 'viejo']], $configFile);
    check($withConfig->read()['token'] === 'fa28-token-secreto-9d950' && $withConfig->read()['enabled'] === true, 'el formulario prevalece sobre config.php'); $checks++;

    // Token vacío conserva el anterior; cambiar de proveedor sin token lo descarta.
    $v = $s->save([...$form, 'token' => '', 'per_minute' => 6]);
    check($v['has_token'] && $s->read()['token'] === 'fa28-token-secreto-9d950' && $v['per_minute'] === 6, 'conservar token'); $checks++;
    fails(fn() => $s->save([...$form, 'token' => '', 'provider' => 'decolecta', 'base_url' => '']), 422, '/token/', 'otro proveedor exige su token'); $checks++;
    $v = $s->save([...$form, 'enabled' => false, 'token' => '', 'provider' => 'decolecta', 'base_url' => '']);
    check(!$v['has_token'] && $v['base_url'] === 'https://api.decolecta.com/v1', 'otro proveedor sin token y URL por defecto: '.json_encode($v)); $checks++;
    $s->save($form);
    $v = $s->save([...$form, 'enabled' => false, 'token' => '', 'clear_token' => true]);
    check(!$v['has_token'] && $s->read()['token'] === '', 'borrar token'); $checks++;
    fails(fn() => $s->save([...$form, 'token' => '']), 422, '/token/', 'habilitar sin token'); $checks++;

    // Validaciones.
    fails(fn() => $s->save([...$form, 'base_url' => 'http://api.migo.pe/api/v2']), 422, '/https/', 'solo https'); $checks++;
    fails(fn() => $s->save([...$form, 'base_url' => 'https://user:pw@api.migo.pe/v2']), 422, '/https/', 'sin credenciales en la URL'); $checks++;
    fails(fn() => $s->save([...$form, 'base_url' => 'https://api.migo.pe/v2?x=1']), 422, '/https/', 'sin parámetros en la URL'); $checks++;
    fails(fn() => $s->save([...$form, 'base_url' => 'file:///etc/passwd']), 422, '/https/', 'sin otros protocolos'); $checks++;
    fails(fn() => $s->save([...$form, 'provider' => 'otro']), 422, '/proveedor/', 'proveedor desconocido'); $checks++;
    fails(fn() => $s->save([...$form, 'token' => "con espacio\n"]), 422, '/token/', 'token con espacios'); $checks++;
    fails(fn() => $s->save([...$form, 'per_minute' => 0]), 422, '/minuto/', 'límite por minuto'); $checks++;
    fails(fn() => $s->save([...$form, 'per_minute' => 10, 'per_hour' => 5]), 422, '/hora/', 'hora menor que minuto'); $checks++;
    fails(fn() => $s->save([...$form, 'enabled' => 'si']), 422, '/habilitada/', 'enabled booleano'); $checks++;
    fails(fn() => $s->save([...$form, 'extra' => 1]), 422, '/no válidos/', 'campos desconocidos'); $checks++;

    // Clave de instalación distinta: no se puede leer y el portal no se cae (lo prueba Portal::documentLookupEnabled).
    $s->save($form);
    fails(fn() => (new PortalDocumentLookupSettings(['install_key' => str_repeat('z', 40)], $configFile))->read(), 503, '/protegida/', 'otra clave no descifra'); $checks++;

    // El servicio usa lo guardado.
    $seen = '';
    $lookup = new PortalDocumentLookup($s->read(), function (string $url, array $headers) use (&$seen) { $seen = $url.' '.implode('|', $headers); return [200, '{"success":true,"dni":"46027897","nombre":"DELGADO HUAMAN ROXANA KARINA"}']; });
    check($lookup->find('DNI', '46027897')['nombres'] === 'ROXANA KARINA' && str_starts_with($seen, 'https://api.migo.pe/api/v2/dni/46027897 ') && str_contains($seen, 'Bearer fa28-token-secreto-9d950'), 'el servicio usa la configuración guardada'); $checks++;

    $portal = file_get_contents(dirname(__DIR__).'/portal-private/Portal.php');
    check(substr_count($portal, '$this->requireAdmin();$this->rate(\'identity-') === 2 && str_contains($portal, "public function documentLookupForm(): array\n    {\$this->requireAdmin();"), 'las rutas de configuración exigen administrador'); $checks++;
    check(str_contains($portal, "(int)\$settings['per_minute'],60") && str_contains($portal, "(int)\$settings['per_hour'],3600"), 'los límites configurados se aplican'); $checks++;
} finally {
    foreach (glob($dir.'/{,.}*', GLOB_BRACE) ?: [] as $file) if (is_file($file)) unlink($file);
    rmdir($dir);
}
echo "$checks comprobaciones de configuración de la API de documentos aprobadas.\n";
