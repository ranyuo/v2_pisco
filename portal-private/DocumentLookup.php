<?php
declare(strict_types=1);

/**
 * Consulta de nombres por DNI o razón social por RUC mediante un proveedor externo.
 * El token se guarda solo en config.php y nunca se envía al navegador; la respuesta se reduce a los
 * campos que necesita los formularios de Mesa de Partes y Libro de Reclamaciones.
 *
 * Proveedor por defecto: MIGO API v2 (https://docs.migo.pe/v2).
 *   GET {base_url}/dni/XXXXXXXX     Authorization: Bearer TOKEN → {success, dni, nombre}
 *   GET {base_url}/ruc/XXXXXXXXXXX  Authorization: Bearer TOKEN → {success, ruc, nombre_o_razon_social, …}
 * Alternativa: 'provider' => 'decolecta' (antes apis.net.pe), con base_url https://api.decolecta.com/v1.
 */
final class PortalDocumentLookup
{
    private const NOT_FOUND = 'No se encontraron datos para ese documento. Completa los campos manualmente.';
    /** Partículas que forman parte de un apellido compuesto (DE LA CRUZ, DEL CASTILLO…). */
    private const PARTICLES = ['DE', 'DEL', 'LA', 'LAS', 'LOS', 'Y', 'SAN', 'SANTA', 'VAN', 'VON', 'DA', 'DI', 'MC'];

    /** @var callable(string,array):array{0:int,1:string} */
    private $http;

    public function __construct(private readonly array $config, ?callable $http = null)
    {
        $this->http = $http ?? [self::class, 'request'];
    }

    public function enabled(): bool
    {
        return !empty($this->config['enabled']) && trim((string)($this->config['token'] ?? '')) !== '';
    }

    public function find(string $type, string $number): array
    {
        $type = strtoupper(trim($type));
        $number = trim($number);
        if ($type === 'DNI') {
            if (!preg_match('/^\d{8}$/D', $number)) throw new PortalError(422, 'El DNI debe tener 8 dígitos.');
        } elseif ($type === 'RUC') {
            if (!preg_match('/^(10|20)\d{9}$/D', $number)) throw new PortalError(422, 'El RUC debe tener 11 dígitos y empezar con 10 o 20.');
        } else {
            throw new PortalError(422, 'Solo se pueden consultar DNI o RUC.');
        }
        if (!$this->enabled()) throw new PortalError(503, 'La consulta automática de documentos no está habilitada.');

        $decolecta = ($this->config['provider'] ?? 'migo') === 'decolecta';
        $base = rtrim((string)($this->config['base_url'] ?? ($decolecta ? 'https://api.decolecta.com/v1' : 'https://api.migo.pe/api/v2')), '/');
        $url = $decolecta
            ? $base.($type === 'DNI' ? '/reniec/dni' : '/sunat/ruc').'?numero='.$number
            : $base.($type === 'DNI' ? '/dni/' : '/ruc/').$number;
        [$status, $body] = ($this->http)($url, [
            'Accept: application/json',
            'Authorization: Bearer '.trim((string)$this->config['token']),
        ]);
        if ($status === 404 || $status === 422) throw new PortalError(404, self::NOT_FOUND);
        if ($status === 401 || $status === 403) throw new PortalError(503, 'El servicio de consulta de documentos rechazó la credencial configurada.');
        if ($status === 429) throw new PortalError(503, 'El servicio de consulta de documentos alcanzó su límite. Completa los campos manualmente.');
        if ($status < 200 || $status >= 300) throw new PortalError(503, 'El servicio de consulta de documentos no está disponible. Completa los campos manualmente.');
        $data = json_decode($body, true);
        if (!is_array($data)) throw new PortalError(503, 'El servicio de consulta de documentos devolvió una respuesta no válida.');
        if (($data['success'] ?? true) === false) throw new PortalError(404, self::NOT_FOUND);
        if (isset($data['data']) && is_array($data['data'])) $data = $data['data'];

        return $type === 'DNI' ? self::person($number, $data) : self::company($number, $data);
    }

    private static function person(string $number, array $d): array
    {
        $names = self::text($d['first_name'] ?? $d['nombres'] ?? '');
        $paternal = self::text($d['first_last_name'] ?? $d['apellidoPaterno'] ?? $d['apellido_paterno'] ?? '');
        $maternal = self::text($d['second_last_name'] ?? $d['apellidoMaterno'] ?? $d['apellido_materno'] ?? '');
        $surnames = trim($paternal.' '.$maternal);
        if ($names === '' && $surnames === '') {
            // MIGO devuelve el nombre completo en un solo campo, con el orden del padrón SUNAT:
            // APELLIDO PATERNO, APELLIDO MATERNO y NOMBRES.
            [$surnames, $names] = self::splitFullName(self::text($d['nombre'] ?? $d['full_name'] ?? ''));
        }
        if ($names === '' && $surnames === '') throw new PortalError(404, self::NOT_FOUND);
        return ['tipoDoc' => 'DNI', 'numDoc' => $number, 'nombres' => $names, 'apellidos' => $surnames];
    }

    /** @return array{0:string,1:string} [apellidos, nombres] */
    public static function splitFullName(string $full): array
    {
        $words = preg_split('/\s+/u', trim($full), -1, PREG_SPLIT_NO_EMPTY) ?: [];
        if (count($words) < 2) return [implode(' ', $words), ''];
        $surnames = [];
        for ($taken = 0; $taken < 2 && count($words) > 1; $taken++) {
            $surname = [];
            while (count($words) > 1 && in_array(mb_strtoupper($words[0]), self::PARTICLES, true)) $surname[] = array_shift($words);
            $surname[] = array_shift($words);
            $surnames[] = implode(' ', $surname);
        }
        return [implode(' ', $surnames), implode(' ', $words)];
    }

    private static function company(string $number, array $d): array
    {
        $name = self::text($d['nombre_o_razon_social'] ?? $d['razon_social'] ?? $d['razonSocial'] ?? $d['nombre'] ?? '');
        if ($name === '') throw new PortalError(404, self::NOT_FOUND);
        $address = self::text($d['direccion'] ?? '');
        if ($address === '-') $address = '';
        if (!isset($d['nombre_o_razon_social'])) {
            // Decolecta separa distrito, provincia y departamento; MIGO ya los incluye en «direccion».
            $place = array_filter(array_map(self::text(...), [$d['distrito'] ?? '', $d['provincia'] ?? '', $d['departamento'] ?? '']));
            if ($address !== '' && $place) $address .= ', '.implode(', ', $place);
        }
        $record = ['tipoDoc' => 'RUC', 'numDoc' => $number, 'razon' => $name, 'direccion' => mb_substr($address, 0, 160),
            'estado' => self::text($d['estado_del_contribuyente'] ?? $d['estado'] ?? ''),
            'condicion' => self::text($d['condicion_de_domicilio'] ?? $d['condicion'] ?? '')];
        // RUC 10 = persona natural con negocio: SUNAT registra «APELLIDO PATERNO APELLIDO MATERNO NOMBRES».
        // Los formularios sin razón social (Libro de Reclamaciones) usan estos campos.
        if (str_starts_with($number, '10')) [$record['apellidos'], $record['nombres']] = self::splitFullName($name);
        return $record;
    }

    private static function text(mixed $value): string
    {
        return is_scalar($value) ? trim(preg_replace('/\s+/u', ' ', (string)$value) ?? '') : '';
    }

    /** @return array{0:int,1:string} */
    public static function request(string $url, array $headers): array
    {
        if (!function_exists('curl_init')) throw new PortalError(503, 'El servidor no tiene la extensión cURL para consultar documentos.');
        $curl = curl_init($url);
        curl_setopt_array($curl, [CURLOPT_RETURNTRANSFER => true, CURLOPT_HTTPHEADER => $headers, CURLOPT_CONNECTTIMEOUT => 4,
            CURLOPT_TIMEOUT => 8, CURLOPT_FOLLOWLOCATION => false, CURLOPT_PROTOCOLS => CURLPROTO_HTTPS]);
        $body = curl_exec($curl);
        $status = (int)curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
        if ($body === false) return [0, ''];
        return [$status, (string)$body];
    }
}

/**
 * Configuración de la API de consulta de documentos editable desde Configuración (solo administradores).
 * Se guarda cifrada (AES-256-GCM con la clave de instalación) en .document-lookup.json, junto a config.php.
 * El bloque 'document_lookup' de config.php sirve como valor inicial; lo guardado en el formulario tiene prioridad.
 */
final class PortalDocumentLookupSettings
{
    public const PROVIDERS = [
        'migo' => ['label' => 'MIGO API v2', 'base_url' => 'https://api.migo.pe/api/v2', 'docs' => 'https://docs.migo.pe/v2'],
        'decolecta' => ['label' => 'Decolecta (antes apis.net.pe)', 'base_url' => 'https://api.decolecta.com/v1', 'docs' => 'https://decolecta.com'],
    ];
    private const FIELDS = ['enabled', 'provider', 'base_url', 'token', 'per_minute', 'per_hour'];
    private const AAD = 'pisco-document-lookup-v1';

    public function __construct(private readonly array $config, private readonly ?string $configFile) {}

    private function path(): ?string
    {return $this->configFile === null ? null : dirname($this->configFile).'/.document-lookup.json';}

    private function key(): string
    {
        $key = $this->config['install_key'] ?? '';
        if (!is_string($key) || strlen($key) < 32) throw new PortalError(503, 'Configura una clave privada de instalación de al menos 32 caracteres.');
        return hash('sha256', self::AAD.'|'.$key, true);
    }

    public function read(): array
    {
        $initial = is_array($this->config['document_lookup'] ?? null) ? $this->config['document_lookup'] : [];
        $base = ['enabled' => false, 'provider' => 'migo', 'base_url' => '', 'token' => '', 'per_minute' => 8, 'per_hour' => 40,
            ...array_intersect_key($initial, array_flip(self::FIELDS))];
        $path = $this->path();
        if ($path !== null && file_exists($path)) {
            try {
                $raw = @file_get_contents($path); if (!is_string($raw)) throw new RuntimeException();
                $blob = json_decode($raw, true, flags: JSON_THROW_ON_ERROR);
                if (!is_array($blob) || ($blob['version'] ?? null) !== 1) throw new RuntimeException();
                foreach (['nonce', 'tag', 'ciphertext'] as $field) if (!is_string($blob[$field] ?? null)) throw new RuntimeException();
                $nonce = base64_decode($blob['nonce'], true); $tag = base64_decode($blob['tag'], true); $cipher = base64_decode($blob['ciphertext'], true);
                if (!is_string($nonce) || strlen($nonce) !== 12 || !is_string($tag) || strlen($tag) !== 16 || !is_string($cipher)) throw new RuntimeException();
                $plain = openssl_decrypt($cipher, 'aes-256-gcm', $this->key(), OPENSSL_RAW_DATA, $nonce, $tag, self::AAD);
                if ($plain === false) throw new RuntimeException();
                $base = [...$base, ...array_intersect_key(json_decode($plain, true, flags: JSON_THROW_ON_ERROR), array_flip(self::FIELDS))];
            } catch (Throwable) {
                throw new PortalError(503, 'No se pudo leer la configuración protegida de la API de documentos. Revisa la clave privada y los permisos del servidor.');
            }
        }
        if (!isset(self::PROVIDERS[$base['provider']])) $base['provider'] = 'migo';
        if (trim((string)$base['base_url']) === '') $base['base_url'] = self::PROVIDERS[$base['provider']]['base_url'];
        $base['per_minute'] = max(1, min(120, (int)$base['per_minute']));
        $base['per_hour'] = max($base['per_minute'], min(2000, (int)$base['per_hour']));
        return $base;
    }

    /** Lo que ve el formulario: nunca el token, solo sus cuatro últimos caracteres. */
    public function view(): array
    {
        $c = $this->read(); $token = trim((string)$c['token']);
        return ['enabled' => (bool)$c['enabled'], 'provider' => $c['provider'], 'base_url' => $c['base_url'],
            'per_minute' => $c['per_minute'], 'per_hour' => $c['per_hour'], 'has_token' => $token !== '',
            'token_hint' => $token === '' ? '' : '••••'.substr($token, -4), 'providers' => self::PROVIDERS];
    }

    public function save(array $input): array
    {
        $path = $this->path(); if ($path === null) throw new PortalError(503, 'No se ha definido la configuración privada del servidor.');
        if (array_diff(array_keys($input), [...self::FIELDS, 'clear_token'])) throw new PortalError(422, 'Parámetros de la API de documentos no válidos.');
        if (!is_bool($input['enabled'] ?? null)) throw new PortalError(422, 'Indica si la consulta de documentos está habilitada.');
        if (!is_string($input['provider'] ?? null) || !isset(self::PROVIDERS[$input['provider']])) throw new PortalError(422, 'Selecciona un proveedor de la lista.');
        $url = trim((string)($input['base_url'] ?? ''));
        if ($url === '') $url = self::PROVIDERS[$input['provider']]['base_url'];
        $parts = parse_url($url);
        if (strlen($url) > 200 || !is_array($parts) || ($parts['scheme'] ?? '') !== 'https' || empty($parts['host']) || isset($parts['user']) || isset($parts['pass'])
            || isset($parts['query']) || isset($parts['fragment']) || !preg_match('/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/iD', $parts['host'])) {
            throw new PortalError(422, 'La URL base debe empezar con https:// y no puede incluir usuario, contraseña ni parámetros.');
        }
        $token = $input['token'] ?? '';
        if (!is_string($token) || strlen($token) > 512 || preg_match('/[\s\x00]/', $token)) throw new PortalError(422, 'El token no es válido: no debe contener espacios ni saltos de línea.');
        foreach (['per_minute' => [1, 120], 'per_hour' => [1, 2000]] as $field => [$min, $max]) {
            if (!is_int($input[$field] ?? null) || $input[$field] < $min || $input[$field] > $max) throw new PortalError(422, "El límite por ".($field === 'per_minute' ? 'minuto' : 'hora')." debe estar entre $min y $max.");
        }
        if ($input['per_hour'] < $input['per_minute']) throw new PortalError(422, 'El límite por hora no puede ser menor que el límite por minuto.');
        $c = ['enabled' => $input['enabled'], 'provider' => $input['provider'], 'base_url' => rtrim($url, '/'), 'token' => $token,
            'per_minute' => $input['per_minute'], 'per_hour' => $input['per_hour']];

        $lock = @fopen($path.'.lock', 'c'); if (!$lock) throw new PortalError(503, 'No se pudo guardar la configuración. Revisa los permisos de la carpeta privada.');
        chmod($path.'.lock', 0600); $tmp = null;
        try {
            if (!flock($lock, LOCK_EX)) throw new RuntimeException();
            $old = $this->read();
            // Un token vacío conserva el anterior si se mantiene el proveedor; para borrarlo se marca clear_token.
            if ($c['token'] === '' && empty($input['clear_token']) && $old['provider'] === $c['provider']) $c['token'] = (string)$old['token'];
            if ($c['enabled'] && $c['token'] === '') throw new PortalError(422, 'Introduce el token de la API para habilitar la consulta.');
            $nonce = random_bytes(12); $tag = '';
            $cipher = openssl_encrypt(json_encode($c, JSON_THROW_ON_ERROR), 'aes-256-gcm', $this->key(), OPENSSL_RAW_DATA, $nonce, $tag, self::AAD);
            if ($cipher === false) throw new RuntimeException();
            $json = json_encode(['version' => 1, 'nonce' => base64_encode($nonce), 'tag' => base64_encode($tag), 'ciphertext' => base64_encode($cipher)], JSON_THROW_ON_ERROR);
            $tmp = tempnam(dirname($path), '.document-lookup-'); if ($tmp === false) throw new RuntimeException();
            if (!chmod($tmp, 0600) || file_put_contents($tmp, $json) !== strlen($json) || !rename($tmp, $path)) throw new RuntimeException(); $tmp = null;
        } catch (PortalError $error) { throw $error; }
        catch (Throwable) { throw new PortalError(503, 'No se pudo guardar la configuración. Revisa los permisos de la carpeta privada.'); }
        finally { if (is_string($tmp) && is_file($tmp)) unlink($tmp); flock($lock, LOCK_UN); fclose($lock); }
        return $this->view();
    }
}
