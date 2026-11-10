<?php
declare(strict_types=1);

final class PortalError extends RuntimeException
{
    public function __construct(public readonly int $status, string $message)
    {
        parent::__construct($message);
    }
}

require_once __DIR__.'/Schema.php';
require_once __DIR__.'/Policy.php';
require_once __DIR__.'/Accounts.php';
require_once __DIR__.'/Files.php';
require_once __DIR__.'/Domain.php';
require_once __DIR__.'/AcademicDocuments.php';
require_once __DIR__.'/Forms.php';
require_once __DIR__.'/Audit.php';
require_once __DIR__.'/Backups.php';
require_once __DIR__.'/Patch.php';
require_once __DIR__.'/Rules.php';
require_once __DIR__.'/Services.php';
require_once __DIR__.'/Academic.php';
require_once __DIR__.'/Numbering.php';
require_once __DIR__.'/Mail.php';
require_once __DIR__.'/Notifications.php';
require_once __DIR__.'/SmtpSettings.php';

final class PortalApp
{
    use PortalAccounts, PortalForms;
    private const PUBLIC_COLLECTIONS = ['__v', 'config', 'slides', 'enlaces', 'paginas', 'reconocimientos',
        'programas', 'personas', 'jerarquica', 'egresados', 'categoriasNoticia', 'noticias', 'eventos',
        'tiposDocumento', 'documentos', 'tupa', 'tupaDocs', 'estadisticas', 'licenciamiento', 'inversiones',
        'convocatorias', 'admisiones', 'matriculas', 'tiposBeca', 'becasPeriodos', 'locales', 'servicios', 'visitas', 'academico'];

    public const PRIVATE_COLLECTIONS = ['usuarios', 'auditoria', 'mensajes', 'reclamos', 'expedientes', 'certificados', 'correos', 'suscriptores', 'becarios'];

    private const RULES = [
        'mensajes' => ['nombres' => 'required|string|max:160', 'documento' => 'nullable|string|max:20',
            'correo' => 'required|email|max:254', 'telefono' => 'nullable|string|max:30',
            'asunto' => 'required|string|max:200', 'programa' => 'nullable|string|max:100', 'mensaje' => 'required|string|min:10|max:10000'],
        'reclamos' => ['nombres' => 'required|string|max:200', 'nombresP' => 'nullable|string|max:100',
            'apellidos' => 'nullable|string|max:100', 'tipo' => 'required|in:Reclamo,Queja',
            'tipoDoc' => 'required|string|max:20', 'numDoc' => 'required|string|max:20',
            'correo' => 'required|email|max:254', 'telefono' => 'nullable|string|max:30',
            'condicion' => 'required|string|max:100', 'programaId' => 'nullable|string|max:100',
            'fechaHecho' => 'required|date|before_or_equal:today', 'areaHecho' => 'nullable|string|max:100',
            'descripcion' => 'required|string|min:20|max:10000', 'pedido' => 'required|string|min:5|max:5000', 'adjunto' => 'nullable|array'],
        'expedientes' => ['nombres' => 'required|string|max:200', 'nombresP' => 'nullable|string|max:100',
            'apellidos' => 'nullable|string|max:100', 'tipoPersona' => 'required|string|max:100',
            'tipoDoc' => 'required|string|max:20', 'numDoc' => 'required|string|max:20',
            'correo' => 'required|email|max:254', 'telefono' => 'required|string|max:30', 'direccion' => 'nullable|string|max:300',
            'tipoTramite' => 'required|string|max:200', 'docRef' => 'nullable|string|max:200',
            'asunto' => 'required|string|min:5|max:2000', 'folios' => 'required|integer|min:1|max:100000',
            'observaciones' => 'nullable|string|max:10000', 'areaDestino' => 'required|string|max:100',
            'archivos' => 'required|array|min:1|max:5', 'archivos.*' => 'required|array'],
    ];

    private ?PDO $connection = null;

    public function __construct(private readonly array $config,private readonly ?string $configFile=null) {}

    /** Meses que se conserva la auditoría del servidor ('audit_retention_months'; 0 = sin límite). */
    public function auditRetentionMonths(): int
    {
        $months=$this->config['audit_retention_months']??24;
        if(!is_int($months)||$months<0)throw new PortalError(503,'audit_retention_months debe ser un entero mayor o igual a 0.');
        return $months===0?0:max(6,$months);
    }
    private function smtpSettings(): SmtpSettings
    {return new SmtpSettings($this->config,$this->configFile);}

    public function smtpForm(): array
    {$this->requireAdmin();return $this->smtpSettings()->view();}

    public function saveSmtp(array $input): array
    {
        $this->requireAdmin();$this->rate('smtp-settings',20,60);
        $result=$this->smtpSettings()->save($input);
        PortalAudit::write($this,'Configurar correo SMTP','Configuración','SMTP');
        return $result;
    }

    public function processMail(int $limit=10,?string $recordId=null): array
    {return (new PortalMail($this->smtpSettings()->read()))->process($this->db(),$limit,$recordId);}

    public function mailStatus(): array
    {$this->requireAdmin();return (new PortalMail($this->smtpSettings()->read()))->status($this);}

    public function db(): PDO
    {
        if ($this->connection === null) {
            $this->connection = new PDO(
                'mysql:host='.$this->config['db_host'].';port='.(int)($this->config['db_port'] ?? 3306).';dbname='.$this->config['db_name'].';charset=utf8mb4',
                $this->config['db_user'], $this->config['db_password'],
                [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES => false,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
            );
            try {
                $roles=$this->connection->query("SELECT setting_value FROM pisco_settings WHERE setting_key='role_permissions'")->fetchColumn();
                PortalPolicy::configureRoles($roles?json_decode($roles,true,flags:JSON_THROW_ON_ERROR):[]);
            } catch(PDOException $error) { if($error->getCode()!=='42S02')throw $error;PortalPolicy::configureRoles([]); }
            $this->upgradeSchema();
        }
        return $this->connection;
    }

    /** Al subir una versión nueva, la base instalada se actualiza una sola vez (p. ej. la cola de correo pisco_mail). */
    private function upgradeSchema(): void
    {
        try{$version=(int)$this->connection->query('SELECT version FROM pisco_schema WHERE id=1')->fetchColumn();}
        catch(PDOException $error){if($error->getCode()==='42S02')return;throw $error;}
        if($version===0||$version>=PortalSchema::VERSION)return;
        $schemaLock=$this->connection->prepare('SELECT GET_LOCK(?,30)');$schemaLockName='portal-schema-'.substr(hash('sha256',(string)$this->connection->query('SELECT DATABASE()')->fetchColumn()),0,40);$schemaLock->execute([$schemaLockName]);if((int)$schemaLock->fetchColumn()!==1)throw new PortalError(503,'La actualización de la base está en curso. Inténtalo en unos segundos.');
        try{
            if((int)$this->connection->query('SELECT version FROM pisco_schema WHERE id=1')->fetchColumn()<PortalSchema::VERSION)PortalSchema::apply($this->connection);
        }finally{$this->connection->prepare('SELECT RELEASE_LOCK(?)')->execute([$schemaLockName]);}
    }

    private static function publishedScholarship(array $row,array $data): bool
    {
        if(($row['deleted']??false)||($row['estado']??'')!=='Publicado')return false;
        $period=PortalPolicy::find($data['becasPeriodos']??[],'id',$row['periodoId']??null);
        return $period&&!($period['deleted']??false)&&in_array($period['estado']??'',['Abierto','Cerrado','Vigente','Publicado'],true);
    }
    private function publicData(array $data): array
    {
        $scholarships=array_values(array_filter($data['becarios']??[],fn($row)=>self::publishedScholarship($row,$data)));
            $data = array_intersect_key($data, array_flip(self::PUBLIC_COLLECTIONS));
            foreach (self::PRIVATE_COLLECTIONS as $key) {
                $data[$key] = [];
            }
            foreach ($data as $key => $value) {
                if (is_array($value) && array_is_list($value)) {
                    $data[$key] = array_values(array_filter($value, fn ($row) => ! is_array($row)
                        || (! ($row['deleted'] ?? false) && (! isset($row['estado']) || in_array($row['estado'], ($key==='documentos'?['Publicado','Histórico']:['Publicado', 'Publicada', 'Activo', 'Vigente', 'Abierto', 'Cerrado']))))));
                }
            }
            // La fecha de publicación se aplica en el servidor, también a los adjuntos.
            $data['noticias']=array_values(array_filter($data['noticias']??[],fn($row)=>!empty($row['fecha'])&&strtotime($row['fecha'])!==false&&strtotime($row['fecha'])<=time()));
            $data['personas'] = array_map(function ($person) {
                foreach (['dni', 'numDoc', 'direccion', 'fechaNacimiento', 'correoPersonal', 'telefonoPersonal'] as $key) {
                    unset($person[$key]);
                }
                if (isset($person['cv'])) {
                    if (($person['cv']['autoriza']['ok'] ?? false)!==true) {
                        // Una revocación expresa también retira la ficha procedente del directorio original.
                        if(($person['cv']['autoriza']['revocado']??false)===true)unset($person['fuente']);
                        unset($person['cv']);
                    } else {
                        foreach (['dni', 'nacimiento', 'fnac', 'sexo', 'direccion', 'domicilio', 'correoPersonal', 'celular', 'huella', 'docs'] as $key) {
                            unset($person['cv'][$key]);
                        }
                    }
                }

                return $person;
            }, $data['personas'] ?? []);
            $academic = $data['academico'] ?? [];
            $publicAcademic = [];
            foreach ($academic as $key => $value) {
                $publicAcademic[$key] = is_array($value) && array_is_list($value) ? [] : $value;
            }
            foreach (['programas', 'modulos', 'areas', 'tramites'] as $key) {
                $publicAcademic[$key] = $academic[$key] ?? [];
            }
            $publicAcademic['empresas'] = array_values(array_map(fn ($company) => array_intersect_key($company,
                array_flip(['id', 'nom', 'ruc', 'rubro', 'ubic', 'logo', 'web', 'validada', 'estadoVal'])),
                array_filter($academic['empresas'] ?? [], fn ($company) => ($company['validada'] ?? false))));
            $publicAcademic['ofertas'] = array_values(array_filter($academic['ofertas'] ?? [], fn ($offer) => ($offer['estado'] ?? '') === 'Publicada'));
            $data['academico'] = $publicAcademic;
            unset($data['config']['contadores']);

        $data['becarios']=array_values(array_map(function($r){$r=array_intersect_key($r,array_flip(['id','periodoId','apellidos','nombres','programaId','tipoId','motivo','estado','dni']));$r['dni']='****'.substr((string)($r['dni']??''),-4);return $r;},array_filter($scholarships,fn($r)=>!($r['deleted']??false)&&($r['estado']??'')==='Publicado')));
        return $data;
    }
    private static function withoutStaffStamps(array $data): array
    {
        foreach($data as $k=>$v){
            if(in_array($k,['creadoPor','modPor','publicadoPor','aprobadoPor','eliminadoPor','revisadoPor'],true)&&is_string($v)){unset($data[$k]);continue;}
            if(is_array($v))$data[$k]=self::withoutStaffStamps($v);
        }
        return $data;
    }
    public function bootstrap(): array
    {
        $state=$this->state();$full=json_decode($state['data'],true,flags:JSON_THROW_ON_ERROR);$user=$this->user();
        $full['visitas']=$this->visitCounts();
        $data=PortalPolicy::project($full,$user,$this->publicData($full));
        $data['usuarios']=$this->visibleAccounts($user,$full);
        // Visitantes: las imágenes incrustadas en base64 se sirven como archivos estáticos cacheables.
        if(!$user)$data=$this->externalizeImages($data);
        // Visitantes: sin los usuarios del personal que crearon o editaron cada registro (son nombres de acceso).
        if(!$user)$data=self::withoutStaffStamps($data);
        if($user&&$user['rol']==='admin'){$data['auditoria']=[...PortalAudit::rows($this),...PortalAudit::legacy($this,$full)];$data['academico']['bitacora']=array_map(fn($r)=>['id'=>$r['id'],'f'=>$r['fecha'],'u'=>$r['usuario'],'a'=>$r['accion'],'m'=>$r['entidad'],'d'=>$r['registro'].' · '.$r['detalle']],PortalAudit::rows($this));}
        return ['data'=>$data,'revision'=>(int)$state['revision'],'user'=>$user,'csrf'=>$_SESSION['csrf'],'numberingYear'=>(int)date('Y'),'schema_version'=>PortalSchema::VERSION,'roles'=>PortalPolicy::definitions()['roles']];
    }
    public function input(): array
    {
        if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 64 * 1024 * 1024) {
            throw new PortalError(413, 'La solicitud es demasiado grande. Máximo 40 MB de adjuntos en total.');
        }
        try {
            $input = json_decode(file_get_contents('php://input'), true, flags: JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            throw new PortalError(422, 'La solicitud no contiene JSON válido.');
        }
        if (!is_array($input)) throw new PortalError(422, 'Solicitud no válida.');
        PortalRules::structure($input);
        return $input;
    }

    public function checkCsrf(string $token): void
    {
        if (empty($_SESSION['csrf']) || !hash_equals($_SESSION['csrf'], $token)) {
            throw new PortalError(419, 'La sesión caducó. Recarga la página e inténtalo de nuevo.');
        }
    }

    public function user(): ?array
    {
        if(empty($_SESSION['user_id']))return null;
        if(!isset($_SESSION['auth_version'])){unset($_SESSION['user_id']);return null;}
        $statement=$this->db()->prepare('SELECT * FROM pisco_users WHERE id=? AND active=1');$statement->execute([$_SESSION['user_id']]);$user=$statement->fetch();
        if(!$user){unset($_SESSION['user_id']);return null;}
        if(isset($_SESSION['auth_version'])&&(int)$_SESSION['auth_version']!==(int)($user['auth_version']??1)){unset($_SESSION['user_id'],$_SESSION['auth_version']);return null;}
        $_SESSION['auth_version']=(int)($user['auth_version']??1);return $this->accountDto($user);
    }
    public function requireUser(): array {return $this->user()??throw new PortalError(403,'Inicia sesión para continuar.');}
    public function requireAdmin(): array
    {
        $user=$this->requireUser();if(PortalPolicy::role($user)!=='admin')throw new PortalError(403,'Esta acción requiere una cuenta administradora.');return $user;
    }
    private function state(bool $lock = false): array
    {
        $state = $this->db()->query('SELECT data, revision FROM pisco_state WHERE id = 1'.($lock ? ' FOR UPDATE' : ''))->fetch();
        if (!$state) throw new PortalError(503, 'Completa la instalación en /install.php.');
        $state['data']=json_encode($this->normalizeDates(json_decode($state['data'],true,flags:JSON_THROW_ON_ERROR)),JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE);
        return $state;
    }

    private function normalizeDates(array $data): array
    {
        $data = PortalContent::normalize($data);
        foreach(['noticias','eventos'] as $key)foreach($data[$key]??[] as $i=>$r)if(!empty($r['fecha'])){try{$data[$key][$i]['fecha']=(new DateTimeImmutable($r['fecha'],new DateTimeZone($this->config['timezone']??'America/Lima')))->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d\TH:i:s.v\Z');}catch(Exception){}}
        return PortalContent::normalize($data);
    }

    private function transaction(callable $operation): array
    {
        $db = $this->db();
        $sessionBefore=$_SESSION;
        $db->beginTransaction();
        try {
            $result = $operation();
            $db->commit();
            return $result;
        } catch (Throwable $error) {
            if ($db->inTransaction()) $db->rollBack();
            $_SESSION=$sessionBefore;
            throw $error;
        }
    }

    private function updateState(array $data, int $revision): void
    {
        $statement = $this->db()->prepare('UPDATE pisco_state SET data = ?, revision = ? WHERE id = 1');
        $statement->execute([json_encode($this->normalizeDates($data), JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE), $revision]);
    }

    /** Feriados nacionales del Perú (fijos + Jueves y Viernes Santo); los locales se agregan en la configuración de Mesa de partes. */
    public static function nationalHolidays(int $y): array
    {
        $a=$y%19;$b=intdiv($y,100);$c=$y%100;$d=intdiv($b,4);$e=$b%4;$f=intdiv($b+8,25);$g=intdiv($b-$f+1,3);$h=(19*$a+$b-$d-$g+15)%30;$i=intdiv($c,4);$k=$c%4;$l=(32+2*$e+2*$i-$h-$k)%7;$m=intdiv($a+11*$h+22*$l,451);
        $easter=new DateTimeImmutable(sprintf('%04d-%02d-%02d',$y,intdiv($h+$l-7*$m+114,31),(($h+$l-7*$m+114)%31)+1));
        $days=array_map(fn($md)=>"$y-$md",['01-01','05-01','06-07','06-29','07-23','07-28','07-29','08-06','08-30','10-08','11-01','12-08','12-09','12-25']);
        $days[]=$easter->modify('-3 days')->format('Y-m-d');$days[]=$easter->modify('-2 days')->format('Y-m-d');sort($days);return $days;
    }
    /** Prefijo de las claves de intentos fallidos de una cuenta (permite desbloquearla desde Cuentas). */
    public static function loginFailPrefix(string $username): string { return substr(hash('sha256','login-fail|'.strtolower(trim($username))),0,32); }
    private function rate(string $action, int $limit, int $seconds, int $cost = 1): void
    {
        $window = intdiv(time(), $seconds) * $seconds;
        // Con sesión iniciada el límite es por usuario: en el instituto muchas personas comparten la misma IP pública.
        $who = isset($_SESSION['user_id']) ? 'u'.(int)$_SESSION['user_id'] : ($_SERVER['REMOTE_ADDR'] ?? 'local');
        $key = hash('sha256', $action.'|'.$who.'|'.$window);
        $statement = $this->db()->prepare('INSERT INTO pisco_rate_limits (rate_key,hits,expires_at) VALUES (?,?,?) ON DUPLICATE KEY UPDATE hits = hits + ?');
        $statement->execute([$key, max(1, $cost), $window + $seconds, max(1, $cost)]);
        $statement = $this->db()->prepare('SELECT hits FROM pisco_rate_limits WHERE rate_key = ?');
        $statement->execute([$key]);
        if ((int)$statement->fetchColumn() > $limit) {
            header('Retry-After: '.max(1, $window + $seconds - time()));
            throw new PortalError(429, 'Demasiados intentos. Espera unos minutos antes de continuar.');
        }
        if (random_int(1, 100) === 1) {
            $statement = $this->db()->prepare('DELETE FROM pisco_rate_limits WHERE expires_at < ? LIMIT 1000');
            $statement->execute([time()]);
        }
    }

    public function login(array $input): array
    {
        $input=self::validate($input,['username'=>'required|string|max:80','password'=>'required|string|max:72']);$username=strtolower(trim($input['username']));
        $this->rate('login',60,60);
        $db=$this->db();$db->beginTransaction();
        try{
            $stmt=$db->prepare('SELECT * FROM pisco_users WHERE username=? AND active=1 FOR UPDATE');$stmt->execute([$username]);$row=$stmt->fetch();
            // El bloqueo es por cuenta e IP: un tercero que conoce el usuario no puede bloquear la cuenta para todos.
            $failKey=self::loginFailPrefix($username).substr(hash('sha256','ip|'.($_SERVER['REMOTE_ADDR']??'local')),0,32);
            $fails=$db->prepare('SELECT hits FROM pisco_rate_limits WHERE rate_key=? AND expires_at>?');$fails->execute([$failKey,time()]);
            if((int)$fails->fetchColumn()>=5){$db->commit();throw new PortalError(423,'Cuenta bloqueada por intentos fallidos. Espera cinco minutos o solicita el desbloqueo.');}
            $ok=password_verify($input['password'],$row['password']??'$2y$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.');
            if(isset($input['role'])&&(!is_string($input['role'])||$input['role']!==($row['role']??'')))$ok=false;
            if(!$row||!$ok){
                $locked=null;if($row){$db->prepare('DELETE FROM pisco_rate_limits WHERE rate_key=? AND expires_at<=?')->execute([$failKey,time()]);
                    $db->prepare('INSERT INTO pisco_rate_limits (rate_key,hits,expires_at) VALUES (?,1,?) ON DUPLICATE KEY UPDATE hits=hits+1')->execute([$failKey,time()+300]);
                    $fails->execute([$failKey,time()]);$locked=(int)$fails->fetchColumn()>=5;}
                PortalAudit::write($this,'Intento de acceso fallido','Cuentas',$username,['bloqueada'=>isset($locked)&&$locked?'sí':'no'],['usuario'=>'visitante','rol'=>'publico']);
                $db->commit();throw new PortalError(422,'Usuario o contraseña incorrectos.');
            }
            if(password_needs_rehash($row['password'],PASSWORD_DEFAULT))$db->prepare('UPDATE pisco_users SET password=? WHERE id=?')->execute([password_hash($input['password'],PASSWORD_DEFAULT),$row['id']]);
            $db->prepare('UPDATE pisco_users SET login_failures=0,locked_until=NULL,last_login=? WHERE id=?')->execute([date('Y-m-d H:i:s'),$row['id']]);$db->prepare('DELETE FROM pisco_rate_limits WHERE rate_key=?')->execute([$failKey]);$db->commit();
        }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
        PortalAudit::write($this,'Iniciar sesión','Cuentas',(string)$row['id'],[], $this->accountDto($row));
        session_regenerate_id(true);$_SESSION['user_id']=(int)$row['id'];$_SESSION['auth_version']=(int)($row['auth_version']??1);$_SESSION['csrf']=bin2hex(random_bytes(32));return ['ok'=>true];
    }

    public function logout(): array
    {
        if($this->user())PortalAudit::write($this,'Cerrar sesión','Cuentas',(string)$this->user()['server_id']);
        $_SESSION = [];
        session_regenerate_id(true);
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
        return ['ok' => true];
    }

    public function save(array $input): array
    {
        $user=$this->requireUser();$this->rate('save',120,60);
        if(!empty($user['cambiarClave']))throw new PortalError(403,'Cambia tu contraseña temporal antes de continuar (Mi cuenta).');
        if(!isset($input['revision'])||!is_int($input['revision'])||(!isset($input['patch'])&&!is_array($input['data']??null)))throw new PortalError(422,'Contenido o revisión no válidos.');
        // Los avisos generados al guardar (derivaciones, estados, bolsa) se envían tras responder; el cron queda como respaldo.
        $result=$this->transaction(function()use($input,$user){
            $state=$this->state(true);$user=$this->requireUser();if(!isset($input['patch'])&&(int)$state['revision']!==$input['revision'])throw new PortalError(409,'Otra persona guardó cambios. Recarga la página antes de continuar.');
            $previous=json_decode($state['data'],true,flags:JSON_THROW_ON_ERROR);
            foreach($input['data']['usuarios']??[] as $account)if(!is_array($account)||isset($account['passHash'],$account['password'])||isset($account['passHash'])||isset($account['password']))throw new PortalError(422,'Las contraseñas se gestionan mediante el servicio de cuentas.');
            $visible=PortalPolicy::project($previous,$user,$this->publicData($previous));$visible['usuarios']=$this->visibleAccounts($user,$previous);
            $incoming=isset($input['patch'])?PortalPatch::apply($visible,$input['patch']):$input['data'];
            $data=PortalPolicy::apply($previous,$visible,$incoming,$user);
            PortalRules::structure($data);PortalRules::stateShape($previous,$data);$data=PortalRules::scrub($data);
            $ops=$input['accounts']??[];if(!is_array($ops)||count($ops)>100)throw new PortalError(422,'Operaciones de cuentas no válidas.');
            foreach($ops as $operation){if(!is_array($operation))throw new PortalError(422,'Cuenta no válida.');$this->accountOperation($operation);}
            $aliases=[];$data=PortalFiles::persist($this,$data,$aliases,0,$previous);
            PortalServices::apply($previous,$data,$user);PortalRules::apply($previous,$data,$user);PortalRules::catalogs($data);
            PortalAcademic::validate($previous,$data);
            AcademicDocuments::validate($previous,$data);PortalDomain::validate($previous,$data,$user);PortalDomain::syncCertificates($data);AcademicDocuments::sync($data);$this->validateBindings($data);
            $allAccounts=array_map($this->accountDto(...),$this->db()->query('SELECT * FROM pisco_users')->fetchAll());
            PortalDomain::notifications($previous,$data,$allAccounts);
            PortalNotifications::changes($this->db(),$previous,$data,(int)$state['revision']+1,$allAccounts);
            foreach(['expedientes','reclamos'] as $collection)foreach($data[$collection] as &$row)unset($row['sinAviso']);unset($row);
            $data['usuarios']=[];$data['__v']=14;$data['visitas']=$previous['visitas']??[];
            $changed=[];foreach($data as $key=>$value)if(!PortalPolicy::equal($value,$previous[$key]??null))$changed[]=$key;
            PortalAudit::changes($this,$previous,$data,$user);
            $data['auditoria']=$previous['auditoria']??[];
            $this->updateState($data,(int)$state['revision']+1);
            $data=$this->normalizeDates($data);
            $projected=PortalPolicy::project($data,$this->user(),$this->publicData($data));
            // Las visitas viven en pisco_visits; sin esto la respuesta las vaciaba y el panel mostraba 0.
            $projected['visitas']=$this->visitCounts();
            if($this->user()&&$this->user()['rol']==='admin'){$projected['auditoria']=[...PortalAudit::rows($this),...PortalAudit::legacy($this,$data)];$projected['academico']['bitacora']=array_map(fn($r)=>['id'=>$r['id'],'f'=>$r['fecha'],'u'=>$r['usuario'],'a'=>$r['accion'],'m'=>$r['entidad'],'d'=>$r['registro'].' · '.$r['detalle']],PortalAudit::rows($this));}
            return ['revision'=>(int)$state['revision']+1,'user'=>$this->user(),'users'=>$this->visibleAccounts($this->user(),$data),'normalized'=>$projected,'files'=>array_values($aliases)];
        });
        if(PortalNotifications::$queued>0){PortalNotifications::$queued=0;portal_defer(fn()=>$this->processMail(10));}
        return $result;
    }
    private const INLINE_IMAGE_MIN=8192;
    /** Reemplaza imágenes data: grandes por /assets/cache/<hash>.<ext>; si no se puede escribir, conserva el original. */
    private function externalizeImages(array $data): array
    {
        $root=realpath((string)($_SERVER['DOCUMENT_ROOT']??''))?:dirname(__DIR__).'/public_html';
        $dir=$root.'/assets/cache';
        if(!is_dir($dir)&&!@mkdir($dir,0755,true)&&!is_dir($dir))return $data;
        if(!is_writable($dir))return $data;
        $types=['image/png'=>'png','image/jpeg'=>'jpg','image/webp'=>'webp','image/gif'=>'gif'];
        $walk=function(mixed $value)use(&$walk,$dir,$types):mixed{
            if(is_array($value)){foreach($value as $k=>$v)$value[$k]=$walk($v);return $value;}
            if(!is_string($value)||strlen($value)<self::INLINE_IMAGE_MIN||!preg_match('#^data:(image/(?:png|jpeg|webp|gif));base64,#',$value,$m))return $value;
            $name=substr(hash('sha256',$value),0,32).'.'.$types[$m[1]];$file=$dir.'/'.$name;
            if(!is_file($file)){
                $bytes=base64_decode(substr($value,strlen($m[0])),true);
                if($bytes===false||(new finfo(FILEINFO_MIME_TYPE))->buffer($bytes)!==$m[1])return $value;
                $tmp=$file.'.'.bin2hex(random_bytes(4)).'.tmp';
                if(@file_put_contents($tmp,$bytes,LOCK_EX)===false||!@rename($tmp,$file)){@unlink($tmp);return $value;}
            }
            return '/assets/cache/'.$name;
        };
        return $walk($data);
    }
    private function visitCounts(): array
    {
        try{return $this->db()->query('SELECT visit_day,views FROM pisco_visits')->fetchAll(PDO::FETCH_KEY_PAIR);}
        catch(PDOException $e){if($e->getCode()!=='42S02')throw $e;return [];}
    }
    public function track(array $input): array
    {
        $user=$this->user();if($user&&$user['rol']==='admin')return ['ok'=>true];
        $path=$input['path']??'';if(!is_string($path)||strlen($path)>250||!str_starts_with($path,'#/')||str_starts_with($path,'#/admin'))throw new PortalError(422,'Ruta no válida.');
        $this->rate('visits',60,60);$path=explode('?',$path)[0];$seen=$_SESSION['page_views'][$path]??0;
        if(time()-$seen<10)return ['ok'=>true];
        if(count($_SESSION['page_views']??[])>100)$_SESSION['page_views']=[];
        $_SESSION['page_views'][$path]=time();
        $this->db()->prepare('INSERT INTO pisco_visits (visit_day,views) VALUES (?,1) ON DUPLICATE KEY UPDATE views=views+1')->execute([date('Y-m-d')]);
        return ['ok'=>true];
    }
    public function upload(): array
    {
        $this->rate('uploads',30,60);
        if(!$this->user()){try{$proof=json_decode(is_string($_POST['proof']??null)?$_POST['proof']:'',true,flags:JSON_THROW_ON_ERROR);}catch(JsonException){throw new PortalError(422,'Verifica el formulario antes de subir adjuntos.');}$purpose=$_POST['purpose']??'';if(!in_array($purpose,['expedientes','reclamos'],true))throw new PortalError(422,'Formulario de adjuntos no válido.');$this->submissionProof($purpose,['proof'=>$proof,'idempotency_key'=>'upload']);}
        $file=$_FILES['file']??null;
        if(!is_array($file)||($file['error']??UPLOAD_ERR_NO_FILE)!==UPLOAD_ERR_OK||!is_uploaded_file($file['tmp_name']))throw new PortalError(422,'No se pudo recibir el archivo. Revisa los límites de tamaño de PHP.');
        if((int)$file['size']>40*1024*1024)throw new PortalError(413,'Máximo 40 MB por archivo.');
        // Sin sesión: tope por IP de archivos y de megas por hora, para que nadie llene el almacenamiento del hosting.
        $this->anonymousUploadQuota((int)$file['size']);
        return ['file'=>PortalFiles::store($this,$file['name'],file_get_contents($file['tmp_name']))];
    }
    public function registerCompany(array $input): array
    {
        $this->rate('company-registration',5,300);
        if(($input['declaration']??false)!==true)throw new PortalError(422,'Debes aceptar la declaración de registro y el tratamiento de datos.');
        $r=self::validate($input,['ruc'=>'required|string|max:11','nom'=>'required|string|max:200','sector'=>'required|string|max:100','ubic'=>'required|string|max:200','dir'=>'required|string|max:300','contacto'=>'required|string|max:150','cargoC'=>'required|string|max:150','correo'=>'required|email|max:254','tel'=>'required|string|max:30','web'=>'nullable|string|max:300','password'=>'required|string|min:12|max:72']);
        foreach($r as $key=>$value)if(is_string($value)&&$key!=='password'&&preg_match('/[<>]/',$value))throw new PortalError(422,'Los datos de la empresa no pueden contener los caracteres < o >.');
        if(!preg_match('/^(10|15|17|20)[0-9]{9}$/',$r['ruc']))throw new PortalError(422,'RUC no válido.');
        $weights=[5,4,3,2,7,6,5,4,3,2];$sum=0;foreach($weights as $i=>$w)$sum+=(int)$r['ruc'][$i]*$w;$digit=11-$sum%11;if($digit===10)$digit=0;if($digit===11)$digit=1;
        if($digit!==(int)$r['ruc'][10])throw new PortalError(422,'El dígito verificador del RUC no es válido.');
        $result=$this->transaction(function()use($r){
            $state=$this->state(true);$data=json_decode($state['data'],true);
            if(PortalPolicy::find($data['academico']['empresas'],'ruc',$r['ruc']))throw new PortalError(422,'Ya existe una empresa con ese RUC.');
            $id=max([0,...array_column($data['academico']['empresas'],'id')])+1;
            $company=[...array_diff_key($r,['password'=>1]),'id'=>$id,'validada'=>false,'estadoVal'=>'Pendiente','fechaReg'=>date('Y-m-d')];
            $data['academico']['empresas'][]=$company;PortalNotifications::received($this->db(),'empresas',$company,$data);PortalDomain::staff($data,'Empresa pendiente de validación: '.$company['nom'],'bolsa');$this->updateState($data,(int)$state['revision']+1);
            PortalAudit::write($this,'Registrar empresa','academico.empresas',(string)$id);
            $this->createAccount(['username'=>$r['ruc'],'name'=>$r['nom'],'email'=>$r['correo'],'password'=>$r['password'],'role'=>'empresa','vin'=>'emp:'.$id,'dni'=>$r['ruc']],false);
            return ['company'=>$company,'username'=>$r['ruc'],'revision'=>(int)$state['revision']+1];
        });
        $companyMail=hash('sha256','empresas|'.$result['company']['id']);portal_defer(fn()=>$this->processMail(2,$companyMail));
        return $result;
    }
    public function interfaceEvent(array $input): array
    {
        $this->requireUser();$this->rate('events',120,60);
        $action=$input['action']??'';if(!in_array($action,['Exportar','Vista previa','Acceso denegado'],true))throw new PortalError(422,'Evento no permitido.');
        if($action==='Acceso denegado'){
            $entity=$input['entity']??'';$route=$input['route']??'';$reason=$input['reason']??'';
            foreach([$entity,$route,$reason] as $value)if(!is_string($value)||strlen($value)>250)throw new PortalError(422,'Evento no válido.');
            PortalAudit::write($this,$action,$entity!==''?$entity:'Intranet',$route,['origen'=>'Interfaz','motivo'=>$reason!==''?$reason:'Módulo no permitido para el rol']);return ['ok'=>true];
        }
        $filename=$input['filename']??'';if(!is_string($filename)||strlen($filename)>200)throw new PortalError(422,'Nombre de archivo no válido.');
        PortalAudit::write($this,$action,'Interfaz',$filename,['origen'=>'Solicitud desde la interfaz','bytes'=>max(0,(int)($input['size']??0))]);return ['ok'=>true];
    }
    private function validateBindings(array $data): void
    {
        foreach($this->db()->query('SELECT username,role,profile FROM pisco_users WHERE active=1')->fetchAll() as $row){$p=json_decode($row['profile']??'{}',true)??[];$target=null;
            if(in_array($row['role'],['estudiante','egresado'],true))$target=PortalPolicy::find($data['academico']['estudiantes'],'id',PortalPolicy::binding($p,'est'));
            elseif($row['role']==='empresa')$target=PortalPolicy::find($data['academico']['empresas'],'id',PortalPolicy::binding($p,'emp'));
            elseif($row['role']==='docente'){$target=PortalPolicy::find($data['academico']['docentes'],'id',PortalPolicy::binding($p,'doc'));$person=PortalPolicy::find($data['personas'],'id',$p['personaId']??'');if(!$person||($person['deleted']??false))$target=null;}
            elseif($row['role']==='coordinador')$target=PortalPolicy::find($data['programas'],'id',$p['programaId']??'');else continue;
            if(!$target||($target['deleted']??false))throw new PortalError(422,'El registro está vinculado a la cuenta activa '.$row['username'].'. Desactiva o cambia su vínculo antes de eliminarlo.');
        }
    }
    public function installed(): bool
    {
        try { return (int)$this->db()->query('SELECT COUNT(*) FROM pisco_users')->fetchColumn() > 0; }
        catch (PDOException $error) {
            if ($error->getCode() === '42S02') return false;
            throw $error;
        }
    }

    public function install(array $input): void
    {
        $key = $this->config['install_key'] ?? '';
        if (!is_string($key) || strlen($key) < 32) throw new PortalError(503, 'Configura una clave de instalación privada de al menos 32 caracteres.');
        if (!is_string($input['install_key'] ?? null) || !hash_equals($key, $input['install_key'])) throw new PortalError(403, 'La clave de instalación no coincide.');
        $lock = fopen(__DIR__.'/install.lock', 'c+');
        if (!$lock || !flock($lock, LOCK_EX)) throw new PortalError(503, 'No se pudo proteger la instalación. Revisa los permisos de portal-private.');
        try {
            if ($this->installed()) throw new PortalError(410, 'La aplicación ya está instalada.');
            $this->accountInput($input);
            PortalSchema::apply($this->db());
            $this->transaction(function () use ($input) {
                $seed = file_get_contents(__DIR__.'/data/portal.json');
                json_decode($seed, true, flags: JSON_THROW_ON_ERROR);
                $this->db()->prepare('INSERT INTO pisco_state (id,data,revision) VALUES (1,?,1) ON DUPLICATE KEY UPDATE id = id')->execute([$seed]);
                $this->createAccount($input, false);
                return [];
            });
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }

    public static function validate(array $input, array $rules): array
    {
        $result = [];
        foreach ($rules as $field => $specification) {
            if (str_contains($field, '.*')) continue;
            $spec = explode('|', $specification);
            $present = array_key_exists($field, $input);
            $value = $input[$field] ?? null;
            if (!$present || $value === null || $value === '') {
                if (in_array('required', $spec, true)) throw new PortalError(422, 'Completa el campo '.$field.'.');
                if ($present) $result[$field] = $value;
                continue;
            }
            foreach ($spec as $rule) {
                [$kind, $argument] = array_pad(explode(':', $rule, 2), 2, '');
                $valid = match ($kind) {
                    'string' => is_string($value),
                    'array' => is_array($value),
                    'integer' => filter_var($value, FILTER_VALIDATE_INT) !== false,
                    'email' => is_string($value) && filter_var($value, FILTER_VALIDATE_EMAIL) !== false,
                    'in' => is_string($value) && in_array($value, explode(',', $argument), true),
                    'date' => is_string($value) && ($date = DateTimeImmutable::createFromFormat('!Y-m-d', $value)) !== false && $date->format('Y-m-d') === $value,
                    'before_or_equal' => is_string($value) && $value <= date('Y-m-d'),
                    'min', 'max' => true,
                    default => true,
                };
                if (!$valid) throw new PortalError(422, 'Revisa el campo '.$field.'.');
                if ($kind === 'min' || $kind === 'max') {
                    $size = in_array('integer', $spec, true) ? (int)$value : (is_array($value) ? count($value) : preg_match_all('/./us', (string)$value));
                    if (($kind === 'min' && $size < (int)$argument) || ($kind === 'max' && $size > (int)$argument)) throw new PortalError(422, 'El tamaño del campo '.$field.' no es válido.');
                }
            }
            $result[$field] = in_array('integer', $spec, true) ? (int)$value : $value;
        }
        return $result;
    }
    public function submit(string $type, array $input): array
    {
        if (!isset(self::RULES[$type])) throw new PortalError(404, 'Tipo de solicitud no disponible.');
        $this->rate('submissions', 10, 60);
        if (!is_string($input['idempotency_key'] ?? null) || !preg_match('/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i', $input['idempotency_key']) || !is_array($input['record'] ?? null)) {
            throw new PortalError(422, 'Solicitud no válida.');
        }
        $this->submissionProof($type,$input);
        $record = self::validate($input['record'], self::RULES[$type]);
        $result = $this->transaction(function () use ($record, $type, $input) {
            $state = $this->state(true);
            $data = json_decode($state['data'], true, flags:JSON_THROW_ON_ERROR);
            $id = hash('sha256', session_id().'|'.$type.'|'.$input['idempotency_key']);
            foreach ($data[$type] ?? [] as $existing) {
                if (($existing['id'] ?? null) === $id) { $_SESSION['challenges'][$input['proof']['challenge_id']]['used_key']=$input['idempotency_key'];return ['record' => $existing, 'status' => 200,'revision'=>(int)$state['revision'],'counters'=>$this->user()?($data['config']['contadores']??[]):null]; }
            }
            // Los adjuntos nuevos se confirman o revierten junto con el trámite.
            // Un reintento no vuelve a almacenarlos ni consume otra cuota de subida.
            if (!empty($record['archivos'])) $record['archivos'] = array_map($this->validateFile(...), $record['archivos']);
            if (!empty($record['adjunto'])) $record['adjunto'] = $this->validateFile($record['adjunto']);
            if (array_sum(array_column($record['archivos'] ?? [], 'size')) + ($record['adjunto']['size'] ?? 0) > 40 * 1024 * 1024) {
                throw new PortalError(422, 'Los adjuntos no pueden superar 40 MB en total.');
            }
            $record=$this->formDomain($type,$record,$data);
            $record['id'] = $id;
            $record['fecha'] = date(DATE_ATOM);
            $record['estado'] = $type === 'mensajes' ? 'Nuevo' : 'Recibido';
            $record['historial'] = [];
            $year = date('Y');
            if ($type === 'reclamos') {
                $count = (int)($data['config']['contadores']['RCL'][$year] ?? 0) + 1;
                $data['config']['contadores']['RCL'][$year] = $count;
                $record['codigo'] = sprintf('RCL-%s-%05d', $year, $count);
                do { $record['cargoCod'] = strtoupper(bin2hex(random_bytes(8))); }
                while (PortalPolicy::find($data['reclamos'], 'cargoCod', $record['cargoCod']) !== null);
                preg_match('/^.{0,80}/us', $record['descripcion'], $prefix); $record['asunto'] = $prefix[0] ?? '';
                $cfg = $data['config']['lr'];
                $days = (int)($cfg[$record['tipo'] === 'Queja' ? 'plazoQueja' : 'plazoReclamo'] ?? 15);
                $record += ['plazoDias' => $days, 'vence' => $this->deadline($days, $data)->format(DATE_ATOM),
                    'responsable' => ['nombre' => $cfg['responsable'], 'cargo' => $cfg['cargo'], 'correo' => $cfg['correo']],
                    'area' => '', 'notas' => [], 'respuesta' => '', 'notifInst' => 'Ver panel', 'notifUser' => 'Ver panel', 'anulado' => false];
            }
            if ($type === 'expedientes') {
                $data['config']['contadores']['DOC'][$year] = (int)($data['config']['contadores']['DOC'][$year] ?? 0) + 1;
                $cfg = $data['config']['mpv'];
                $record['numero'] = PortalNumbering::next($data,$year);
                $record['numDocumento'] = sprintf('DOC-%s-%06d', $year, $data['config']['contadores']['DOC'][$year]);
                do { $record['cargoCod'] = strtoupper(bin2hex(random_bytes(8))); }
                while (PortalPolicy::find($data['expedientes'], 'cargoCod', $record['cargoCod']) !== null);
                $received = new DateTimeImmutable();
                $business = fn ($date) => (int)$date->format('N') < 6 && !in_array($date->format('Y-m-d'), $cfg['feriados'] ?? [], true) && !in_array($date->format('Y-m-d'), self::nationalHolidays((int)$date->format('Y')), true);
                $inHours = $business($received) && $received->format('H:i') >= $cfg['horaIni'] && $received->format('H:i') <= $cfg['horaFin'];
                if (!$inHours) {
                    if (!$business($received) || $received->format('H:i') > $cfg['horaFin']) {
                        do { $received = $received->modify('+1 day'); } while (!$business($received));
                    }
                    [$hour, $minute] = explode(':', $cfg['horaIni']);
                    $received = $received->setTime((int)$hour, (int)$minute);
                }
                $record += ['fechaRecepcion' => $received->format(DATE_ATOM), 'enHorario' => $inHours,
                    'usuarioRegistro' => $this->user()['nombre']??'Ciudadano – portal web', 'canal' => 'Mesa de Partes Virtual',
                    'area' => 'MP', 'archivo' => $record['archivos'][0]];
            }
            if (in_array($type, ['reclamos', 'expedientes'], true)) {
                $record['historial'] = [['fecha' => $record['fecha'], 'usuario' => 'portal', 'estado' => 'Recibido', 'nota' => 'Registro recibido desde el portal.']];
            }
            if($type==='expedientes')PortalMail::enqueue($this->db(),$record,$data);
            if($type==='reclamos')PortalNotifications::received($this->db(),$type,$record,$data);
            $data[$type] = [$record, ...($data[$type] ?? [])];
            if(in_array($type,['mensajes','reclamos','expedientes'],true))PortalDomain::staff($data,'Nuevo registro: '.($record['codigo']??$record['numero']??$record['asunto']??$type),$type==='expedientes'?'mesa':$type);
            $this->updateState($data, (int)$state['revision'] + 1);
            PortalAudit::write($this,'Registrar solicitud',$type,$record['codigo']??$record['numero']??$id);
            $_SESSION['challenges'][$input['proof']['challenge_id']]['used_key']=$input['idempotency_key'];
            return ['record' => $record, 'status' => 201,'revision'=>(int)$state['revision']+1,'counters'=>$this->user()?($data['config']['contadores']??[]):null];
        });
        if(in_array($type,['expedientes','reclamos'],true)){
            $mailId=$type==='expedientes'?$result['record']['id']:hash('sha256',$type.'|'.$result['record']['id']);
            // El primer intento SMTP se hace después de responder; si falla, el cron reintenta desde la cola.
            portal_defer(fn()=>$this->processMail(3,$mailId));
        }
        return $result;
    }

    public function lookup(string $type, array $input): array
    {
        if (!in_array($type, ['expedientes', 'reclamos', 'certificados', 'becarios'], true)) throw new PortalError(404, 'Consulta no disponible.');
        $this->rate('lookups', 10, 60);
        $lookupProof=$input['proof']??[];
        $input = self::validate($input, ['reference' => 'required|string|max:150', 'document' => (in_array($type,['certificados','becarios'],true) ? 'nullable' : 'required').'|string|max:50', 'mode' => 'nullable|string|max:10']);
        $input['proof']=$lookupProof;
        $data = json_decode($this->state()['data'], true, flags: JSON_THROW_ON_ERROR);
        if (!in_array($input['mode'] ?? '', ['', 'codigo', 'dni', 'nombre'], true)) throw new PortalError(422, 'Modo de consulta no válido.');
        if($type==='certificados'&&!in_array($input['mode']??'',['dni','nombre'],true)&&$lookupProof!==[])$this->submissionProof('certificados',$input);
        if ($type === 'certificados' && ($input['mode'] ?? '') === 'dni' && !preg_match('/^[0-9]{8}$/', $input['reference'])) throw new PortalError(422, 'El DNI debe tener ocho dígitos.');
        if ($type === 'becarios') {
            if(!preg_match('/^[0-9]{8}$/',$input['reference']))throw new PortalError(422,'DNI no válido.');
            $matches=[];foreach($data['becarios']??[] as $r)if(self::publishedScholarship($r,$data)&&($r['dni']??'')===$input['reference']){$r=array_intersect_key($r,array_flip(['id','periodoId','apellidos','nombres','programaId','tipoId','motivo','estado','dni']));$r['dni']='****'.substr($r['dni'],-4);$matches[]=$r;}return ['records'=>$matches];
        }
        if ($type === 'certificados' && in_array($input['mode']??'', ['dni','nombre'],true)) {
            $this->submissionProof('certificados',$input);
            $nameMode=$input['mode']==='nombre';$query=PortalRules::normal($input['reference']);if($nameMode)$this->rate('consulta-nombre',15,600);
            if($nameMode&&strlen($query)<3)throw new PortalError(422,'Ingresa al menos tres caracteres del nombre.');
            $matches=[];
            foreach($data['certificados']??[] as $r){
                if($r['deleted']??false)continue;$name=PortalRules::normal($r['nombres']??'');
                $hit=$nameMode ? count(array_filter(explode(' ',$query),fn($token)=>$token!==''&&!str_contains($name,$token)))===0 : ($r['dni']??'')===$input['reference'];
                if($hit){$pub=AcademicDocuments::publicRecord($r);if($nameMode&&isset($pub['dni']))$pub['dni']='****'.substr((string)$pub['dni'],-4);$matches[]=$pub;if(count($matches)>=($nameMode?30:100))break;}
            }
            return ['records'=>$matches];
        }
        if ($type === 'reclamos') {
            $input['reference']=strtoupper(trim($input['reference']));$input['document']=strtoupper(trim($input['document']));
            if (!preg_match('/^[A-Z0-9-]{6,20}$/D',$input['document'])) throw new PortalError(422,'Ingresa el documento completo del reclamante (DNI de 8 dígitos, no el número de folios) o el código de verificación de 16 caracteres.');
        }
        $claimReference=fn($value)=>preg_replace('/^(RCL|LR)-(\d{4})-0*(\d+)$/i','$1-$2-$3',strtoupper(trim((string)$value)));
        $field = $type === 'expedientes' ? 'numero' : 'codigo';
        foreach ($data[$type] ?? [] as $record) {
            if ($record['deleted'] ?? false) continue;
            if ($type==='reclamos' ? $claimReference($record[$field]??'')!==$claimReference($input['reference']) : strtoupper($record[$field] ?? '') !== strtoupper($input['reference'])) continue;
            $recordDocument=(string)($record['numDoc']??'');if($type==='reclamos')$recordDocument=strtoupper(trim($recordDocument));
            if ($type !== 'certificados' && !hash_equals($recordDocument, $input['document'])
                && (empty($record['cargoCod']) || !hash_equals($record['cargoCod'], strtoupper($input['document'])))) continue;
            foreach (['archivos', 'archivo', 'adjunto', 'notas', 'notaInterna', 'correo', 'telefono', 'direccion', 'usuarioRegistro'] as $key) unset($record[$key]);
            if ($type === 'certificados') {
                $record = AcademicDocuments::publicRecord($record);
            } else {
                // Los proveídos internos no se publican; la observación y la respuesta del expediente sí, porque son para el ciudadano.
                $citizen = $type === 'expedientes' ? ['Observado', 'Atendido', 'Archivado'] : [];
                $record['historial'] = array_map(fn ($item) => array_intersect_key($item, array_flip(in_array($item['estado'] ?? '', $citizen, true) ? ['fecha', 'estado', 'nota'] : ['fecha', 'estado'])), $record['historial'] ?? []);
            }
            return ['record' => $record];
        }
        throw new PortalError(404, 'No se encontró un registro con esos datos.');
    }

    private function deadline(int $days, array $data): DateTimeImmutable
    {
        $date = new DateTimeImmutable();
        while ($days > 0) {
            $date = $date->modify('+1 day');
            if ((int)$date->format('N') < 6 && !in_array($date->format('Y-m-d'), $data['config']['mpv']['feriados'] ?? [], true) && !in_array($date->format('Y-m-d'), self::nationalHolidays((int)$date->format('Y')), true)) $days--;
        }
        return $date;
    }

    /** Cuota compartida por subidas multipart y adjuntos base64. */
    private function anonymousUploadQuota(int $size): void
    {
        if ($this->user()) return;
        $this->rate('uploads-anon',20,3600);
        $this->rate('uploads-anon-mb',150,3600,(int)ceil($size/1048576));
    }

    private function validateFile(mixed $file): array
    {
        if (!is_array($file)) throw new PortalError(422, 'Adjunto no válido.');
        if (isset($file['fileId'])) return PortalFiles::metadata($this, $file, true);
        $valid = self::validate($file, ['original' => 'required|string|max:255', 'data' => 'required|string|max:57000000']);
        if (!preg_match('/^data:([^;,]+);base64,(.*)$/s', $valid['data'], $match)) throw new PortalError(422, 'Adjunto no válido.');
        $bytes = base64_decode($match[2], true);
        if ($bytes === false || strlen($bytes) > 40 * 1024 * 1024) throw new PortalError(422, 'Adjunto no válido o demasiado grande.');
        // MIME y extensión se validan en PortalFiles::store, igual que multipart.
        $this->rate('uploads',30,60);
        $this->anonymousUploadQuota(strlen($bytes));
        return PortalFiles::store($this, $valid['original'], $bytes);
    }
}
