<?php
declare(strict_types=1);
// Autocompletado de DNI/RUC: normaliza las respuestas del proveedor sin llamar a la red ni a la base.
require dirname(__DIR__).'/portal-private/Portal.php';

function check(bool $ok, string $message): void { if (!$ok) { fwrite(STDERR, "FALLA: $message\n"); exit(1); } }
function fails(callable $call, int $status, string $message): void
{
    try { $call(); } catch (PortalError $e) { check($e->status === $status, "$message (estado {$e->status}: {$e->getMessage()})"); return; }
    check(false, "$message: no lanzó error");
}

$calls = [];
$fake = function (array $responses) use (&$calls): callable {
    return function (string $url, array $headers) use (&$calls, $responses): array {
        $calls[] = [$url, $headers];
        foreach ($responses as $needle => $response) if (str_contains($url, $needle)) return $response;
        return [404, '{"message":"not found"}'];
    };
};
$config = ['enabled' => true, 'provider' => 'decolecta', 'token' => 'secreto-de-prueba', 'base_url' => 'https://api.example.test/v1/'];

check(!(new PortalDocumentLookup([]))->enabled(), 'sin configuración queda deshabilitado');
check(!(new PortalDocumentLookup(['enabled' => true, 'token' => ' ']))->enabled(), 'sin token queda deshabilitado');
fails(fn() => (new PortalDocumentLookup(['enabled' => false, 'token' => 'x']))->find('DNI', '12345678'), 503, 'deshabilitado responde 503');

$lookup = new PortalDocumentLookup($config, $fake([
    'dni?numero=46027897' => [200, json_encode(['first_name' => 'ROXANA KARINA', 'first_last_name' => 'DELGADO', 'second_last_name' => 'HUAMAN', 'full_name' => 'DELGADO HUAMAN ROXANA KARINA', 'document_number' => '46027897'])],
    'dni?numero=11111111' => [200, json_encode(['nombres' => 'JUAN', 'apellidoPaterno' => 'PEREZ', 'apellidoMaterno' => 'QUISPE'])],
    'dni?numero=22222222' => [401, '{"message":"Unauthorized"}'],
    'dni?numero=33333333' => [500, 'error'],
    'ruc?numero=20131312955' => [200, json_encode(['razon_social' => 'SUPERINTENDENCIA NACIONAL DE ADUANAS Y DE ADMINISTRACION TRIBUTARIA - SUNAT', 'numero_documento' => '20131312955', 'estado' => 'ACTIVO', 'condicion' => 'HABIDO', 'direccion' => 'AV.  GARCILASO DE LA VEGA NRO. 1472', 'distrito' => 'LIMA', 'provincia' => 'LIMA', 'departamento' => 'LIMA'])],
]));

$r = $lookup->find('DNI', '46027897');
check($r === ['tipoDoc' => 'DNI', 'numDoc' => '46027897', 'nombres' => 'ROXANA KARINA', 'apellidos' => 'DELGADO HUAMAN'], 'DNI con formato Decolecta: '.json_encode($r));
check($calls[0][0] === 'https://api.example.test/v1/reniec/dni?numero=46027897', 'URL del DNI: '.$calls[0][0]);
check(in_array('Authorization: Bearer secreto-de-prueba', $calls[0][1], true), 'envía el token como Bearer');

$r = $lookup->find('dni', ' 11111111 ');
check($r['nombres'] === 'JUAN' && $r['apellidos'] === 'PEREZ QUISPE', 'DNI con formato anterior de apis.net.pe');

$r = $lookup->find('RUC', '20131312955');
check($r['razon'] === 'SUPERINTENDENCIA NACIONAL DE ADUANAS Y DE ADMINISTRACION TRIBUTARIA - SUNAT', 'razón social del RUC');
check($r['direccion'] === 'AV. GARCILASO DE LA VEGA NRO. 1472, LIMA, LIMA, LIMA', 'dirección del RUC: '.$r['direccion']);
check($r['estado'] === 'ACTIVO' && $r['condicion'] === 'HABIDO', 'estado y condición del RUC');
check(!array_key_exists('ubigeo', $r) && count($r) === 6, 'solo devuelve los campos del formulario');

$before = count($calls);
fails(fn() => $lookup->find('DNI', '1234567'), 422, 'DNI de 7 dígitos');
fails(fn() => $lookup->find('DNI', '1234567a'), 422, 'DNI con letras');
fails(fn() => $lookup->find('RUC', '30131312955'), 422, 'RUC que no empieza con 10 o 20');
fails(fn() => $lookup->find('Pasaporte', 'AB123456'), 422, 'tipo no consultable');
fails(fn() => $lookup->find('DNI', '12345678&x=1'), 422, 'no permite inyectar parámetros en la URL');
check(count($calls) === $before, 'los documentos no válidos no llegan al proveedor');

fails(fn() => $lookup->find('DNI', '99999999'), 404, 'documento inexistente');
fails(fn() => $lookup->find('DNI', '22222222'), 503, 'token rechazado');
fails(fn() => $lookup->find('DNI', '33333333'), 503, 'proveedor caído');
try { $lookup->find('DNI', '22222222'); } catch (PortalError $e) { check(!str_contains($e->getMessage(), 'secreto'), 'el error no expone el token'); }

$empty = new PortalDocumentLookup($config, fn() => [200, '{"first_name":"","first_last_name":""}']);
fails(fn() => $empty->find('DNI', '12345678'), 404, 'respuesta vacía');
$broken = new PortalDocumentLookup($config, fn() => [200, '<html>']);
fails(fn() => $broken->find('DNI', '12345678'), 503, 'respuesta no JSON');
$network = new PortalDocumentLookup($config, fn() => [0, '']);
fails(fn() => $network->find('DNI', '12345678'), 503, 'sin conexión');

// MIGO API v2 (proveedor por defecto): nombre completo en un campo y RUC con campos propios.
$calls = [];
$migo = new PortalDocumentLookup(['enabled' => true, 'token' => 'secreto-de-prueba'], $fake([
    '/dni/46027897' => [200, json_encode(['success' => true, 'dni' => '46027897', 'nombre' => 'DELGADO HUAMAN ROXANA KARINA'])],
    '/dni/12121212' => [200, json_encode(['success' => true, 'dni' => '12121212', 'nombre' => 'DE LA CRUZ  DEL CASTILLO MARIA DE LOS ANGELES'])],
    '/dni/00000000' => [404, json_encode(['success' => false, 'message' => 'Recurso no encontrado'])],
    '/dni/13131313' => [200, json_encode(['success' => false, 'message' => 'Recurso no encontrado'])],
    '/dni/14141414' => [401, json_encode(['message' => 'Unauthenticated.'])],
    '/ruc/10456789123' => [200, json_encode(['success' => true, 'ruc' => '10456789123', 'nombre_o_razon_social' => 'QUISPE HUAMAN MARIA ELENA', 'estado_del_contribuyente' => 'ACTIVO', 'condicion_de_domicilio' => 'HABIDO', 'direccion' => '-'])],
    '/ruc/20131312955' => [200, json_encode(['success' => true, 'ruc' => '20131312955', 'nombre_o_razon_social' => 'SUPERINTENDENCIA NACIONAL DE ADUANAS Y DE ADMINISTRACION TRIBUTARIA - SUNAT', 'estado_del_contribuyente' => 'ACTIVO', 'condicion_de_domicilio' => 'HABIDO', 'ubigeo' => '150101', 'distrito' => 'LIMA', 'provincia' => 'LIMA', 'departamento' => 'LIMA', 'direccion_simple' => 'AV. GARCILASO DE LA VEGA NRO. 1472', 'direccion' => 'AV. GARCILASO DE LA VEGA NRO. 1472 - LIMA LIMA LIMA'])],
]));
$r = $migo->find('DNI', '46027897');
check($r === ['tipoDoc' => 'DNI', 'numDoc' => '46027897', 'nombres' => 'ROXANA KARINA', 'apellidos' => 'DELGADO HUAMAN'], 'DNI de MIGO: '.json_encode($r));
check($calls[0][0] === 'https://api.migo.pe/api/v2/dni/46027897', 'URL del DNI en MIGO: '.$calls[0][0]);
check(in_array('Authorization: Bearer secreto-de-prueba', $calls[0][1], true) && in_array('Accept: application/json', $calls[0][1], true), 'MIGO recibe Bearer y Accept');
$r = $migo->find('DNI', '12121212');
check($r['apellidos'] === 'DE LA CRUZ DEL CASTILLO' && $r['nombres'] === 'MARIA DE LOS ANGELES', 'apellidos compuestos: '.json_encode($r));
check(PortalDocumentLookup::splitFullName('QUISPE JUAN') === ['QUISPE', 'JUAN'], 'con dos palabras deja al menos un nombre');
check(PortalDocumentLookup::splitFullName('QUISPE') === ['QUISPE', ''], 'una sola palabra');
check(PortalDocumentLookup::splitFullName('ROJAS PEREZ JUAN CARLOS') === ['ROJAS PEREZ', 'JUAN CARLOS'], 'nombre habitual');
fails(fn() => $migo->find('DNI', '00000000'), 404, 'DNI inexistente en MIGO');
fails(fn() => $migo->find('DNI', '13131313'), 404, 'success=false en MIGO');
fails(fn() => $migo->find('DNI', '14141414'), 503, 'token rechazado por MIGO');
$r = $migo->find('RUC', '20131312955');
check($calls[count($calls) - 1][0] === 'https://api.migo.pe/api/v2/ruc/20131312955', 'URL del RUC en MIGO');
check($r === ['tipoDoc' => 'RUC', 'numDoc' => '20131312955', 'razon' => 'SUPERINTENDENCIA NACIONAL DE ADUANAS Y DE ADMINISTRACION TRIBUTARIA - SUNAT', 'direccion' => 'AV. GARCILASO DE LA VEGA NRO. 1472 - LIMA LIMA LIMA', 'estado' => 'ACTIVO', 'condicion' => 'HABIDO'], 'RUC de MIGO: '.json_encode($r));

$r = $migo->find('RUC', '10456789123');
check($r['razon'] === 'QUISPE HUAMAN MARIA ELENA' && $r['apellidos'] === 'QUISPE HUAMAN' && $r['nombres'] === 'MARIA ELENA' && $r['direccion'] === '', 'RUC 10 separa apellidos y nombres: '.json_encode($r));
check(!isset($migo->find('RUC', '20131312955')['nombres']), 'RUC 20 no inventa nombres de persona');
check(($js = file_get_contents(dirname(__DIR__).'/public_html/document-lookup.js')) && str_contains($js, "bindIdentityLookup(document.querySelector('[data-mpv]'))") && str_contains($js, "bindIdentityLookup(document.querySelector('[data-lr2]'))") && str_contains(file_get_contents(dirname(__DIR__).'/portal-private/views/portal.php'), 'document-lookup.js'), 'Mesa de Partes y Libro de Reclamaciones usan el autocompletado');

check(str_contains($js, "portalURL('/api/identidad')") && !str_contains($js, 'Authorization'), 'los formularios consultan /api/identidad del propio portal, nunca al proveedor');
check(str_contains(file_get_contents(dirname(__DIR__).'/portal-private/Portal.php'), "'documentLookup'=>\$this->documentLookupEnabled()"), 'el navegador solo recibe si la consulta está habilitada, nunca el token');

echo "Autocompletado de DNI/RUC correcto.\n";
