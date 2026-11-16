<?php
declare(strict_types=1);
/**
 * Registro en línea de egresados de la Bolsa Laboral.
 * 1. El egresado completa sus datos y crea su contraseña; recibe en su correo un código de 6 dígitos.
 * 2. Al confirmar el código: si figura en el padrón como egresado o titulado y con ese mismo correo, su cuenta queda activa;
 *    en otro caso, la solicitud pasa a revisión del instituto (Secretaría Académica o Bolsa Laboral).
 * 3. Cada paso se notifica al correo del egresado (aprobación o motivo del rechazo).
 * Privacidad: las respuestas no revelan si un DNI o un correo ya tienen cuenta o solicitud; esos casos se explican
 * por correo solo a la dirección ya registrada. Las solicitudes viven en su propia tabla y la contraseña elegida
 * se guarda solo como hash: nunca entra al estado del portal.
 */
trait PortalGraduates
{
    private const GRAD_CODE_MINUTES=30;
    private const GRAD_CODE_ATTEMPTS=5;
    /** Códigos por DNI y por hora (registro y reenvíos juntos). */
    private const GRAD_CODES_PER_HOUR=3;
    private const GRAD_GENERIC='El código no es correcto o ya venció. Solicita uno nuevo.';

    private static function maskEmail(string $email): string
    {
        [$user,$domain]=array_pad(explode('@',$email,2),2,'');
        return mb_substr($user,0,2).str_repeat('•',max(1,mb_strlen($user)-2)).'@'.$domain;
    }
    private function mailReady(): bool { return (new PortalMail($this->smtpSettings()->read()))->ready(); }
    private function graduateRequest(int $id,bool $lock=false): ?array
    {
        $stmt=$this->db()->prepare('SELECT * FROM pisco_graduate_requests WHERE id=?'.($lock?' FOR UPDATE':''));$stmt->execute([$id]);return $stmt->fetch()?:null;
    }
    private function graduateMailTo(string $source,string $to,string $name,string $event,string $subject,string $body,array $data): void
    {
        if(!filter_var($to,FILTER_VALIDATE_EMAIL)||str_ends_with(strtolower($to),'@portal.invalid'))return;
        $inst=$data['config']['inst']['nombre']??'el instituto';
        PortalMail::queue($this->db(),'egresados',$source,$event,bin2hex(random_bytes(6)),$to,'BOL-EGR-'.$source,$subject,
            "Hola, {$name}:\n\n".$body."\n\nBolsa Laboral · $inst\nEste es un mensaje automático; no lo respondas.\n");
        PortalNotifications::$queued++;
    }
    private function graduateMail(array $request,string $event,string $subject,string $body,array $data): void
    {
        $this->graduateMailTo((string)$request['id'],$request['email'],$request['name'],$event,$subject,$body,$data);
    }
    private function deliverGraduateMail(string $source): void
    {
        $batch=hash('sha256','egresados|'.$source);portal_defer(fn()=>$this->processMail(3,$batch));
    }
    /** Cuenta un envío de código para el DNI; devuelve false si ya se enviaron demasiados en la última hora. */
    private function graduateCodeAllowed(string $dni): bool
    {
        $window=intdiv(time(),3600)*3600;$key=hash('sha256','graduate-code-dni|'.$dni.'|'.$window);
        $this->db()->prepare('INSERT INTO pisco_rate_limits (rate_key,hits,expires_at) VALUES (?,1,?) ON DUPLICATE KEY UPDATE hits=hits+1')->execute([$key,$window+3600]);
        $s=$this->db()->prepare('SELECT hits FROM pisco_rate_limits WHERE rate_key=?');$s->execute([$key]);
        return (int)$s->fetchColumn()<=self::GRAD_CODES_PER_HOUR;
    }
    private function sendGraduateCode(array $request,array $data): void
    {
        $code=(string)random_int(100000,999999);
        $this->db()->prepare('UPDATE pisco_graduate_requests SET code_hash=?,code_expires=DATE_ADD(NOW(),INTERVAL '.self::GRAD_CODE_MINUTES.' MINUTE),code_attempts=0 WHERE id=?')
            ->execute([hash('sha256',$request['id'].'|'.$code),$request['id']]);
        $this->graduateMail($request,'codigo','Código de verificación: '.$code,
            "Recibimos tu registro en la Bolsa Laboral.\n\nTu código de verificación es: $code\n\nEscríbelo en la página de registro para confirmar tu correo. Vence en ".self::GRAD_CODE_MINUTES." minutos.\nSi no solicitaste este registro, ignora este mensaje.",$data);
    }
    /** Cuenta activa vinculada al alumno (por DNI de usuario o por vínculo est:id). */
    private function accountForStudent(string $dni,?int $studentId): ?array
    {
        $s=$this->db()->prepare("SELECT username,email FROM pisco_users WHERE username=? OR (? IS NOT NULL AND JSON_UNQUOTE(JSON_EXTRACT(profile,'$.vin'))=?) LIMIT 1");
        $s->execute([$dni,$studentId,$studentId!==null?'est:'.$studentId:null]);return $s->fetch()?:null;
    }

    /** Paso 1: datos, contraseña elegida por el egresado y envío del código a su correo. La respuesta es siempre la misma. */
    public function registerGraduate(array $input): array
    {
        $this->rate('graduate-registration',15,300);
        if(($input['declaration']??false)!==true)throw new PortalError(422,'Debes aceptar la declaración de veracidad y el tratamiento de tus datos personales.');
        if(!empty($input['website']))throw new PortalError(422,'Envío bloqueado por el filtro anti-spam.');
        $r=self::validate($input,['dni'=>'required|string|max:8','nom'=>'required|string|max:150','correo'=>'required|email|max:254','tel'=>'required|string|max:15','password'=>'required|string|max:72']);
        $r['prog']=$input['prog']??null;$r['anio']=$input['anio']??null;
        if(!preg_match('/^[0-9]{8}$/',$r['dni']))throw new PortalError(422,'El DNI debe tener ocho dígitos.');
        $r['nom']=trim(preg_replace('/\s+/u',' ',$r['nom']));
        if(preg_match_all('/\p{L}/u',$r['nom'])<5||preg_match('/[<>0-9]/u',$r['nom']))throw new PortalError(422,'Escribe tus apellidos y nombres completos.');
        if(!preg_match('/^9[0-9]{8}$/',preg_replace('/\D/','',$r['tel'])))throw new PortalError(422,'El celular debe tener nueve dígitos y empezar con 9.');
        $r['tel']=preg_replace('/\D/','',$r['tel']);$r['correo']=strtolower(trim($r['correo']));
        if(str_ends_with($r['correo'],'@portal.invalid'))throw new PortalError(422,'Escribe un correo electrónico real.');
        $year=filter_var($r['anio'],FILTER_VALIDATE_INT);if($year===false||$year<1984||$year>(int)date('Y'))throw new PortalError(422,'Indica un año de egreso válido.');
        // bcrypt usa solo los primeros 72 bytes: se exige el límite en bytes, no en caracteres.
        if(preg_match_all('/./us',$r['password'])<12||strlen($r['password'])>72||($input['password_confirmation']??null)!==$r['password'])throw new PortalError(422,'La contraseña necesita al menos 12 caracteres (máximo 72 bytes) y su confirmación debe coincidir.');
        $source=$this->transaction(function()use($r,$year){
            $data=json_decode($this->state()['data'],true);$db=$this->db();
            $prog=filter_var($r['prog'],FILTER_VALIDATE_INT);if($prog===false||!PortalPolicy::find($data['academico']['programas'],'id',$prog))throw new PortalError(422,'Selecciona tu programa de estudios.');
            $student=PortalPolicy::find($data['academico']['estudiantes'],'dni',$r['dni']);
            // Casos que no deben revelarse en pantalla: se explican por correo solo a la dirección ya registrada.
            if($account=$this->accountForStudent($r['dni'],$student?(int)$student['id']:null)){
                $this->graduateMailTo('aviso-'.$r['dni'],$account['email'],$student['nom']??$r['nom'],'cuenta-existente','Ya tienes una cuenta en la Bolsa Laboral',
                    "Alguien intentó registrar una cuenta de egresado con tu DNI, pero ya tienes una cuenta (usuario: {$account['username']}).\nIngresa con ella; si olvidaste tu contraseña, usa «¿Olvidaste tu contraseña?» en la página de ingreso. Si no fuiste tú, ignora este mensaje.",$data);
                return ['s'=>'aviso-'.$r['dni']];
            }
            $used=$db->prepare('SELECT username FROM pisco_users WHERE email=?');$used->execute([$r['correo']]);
            if($used->fetchColumn()){
                $this->graduateMailTo('aviso-'.$r['dni'],$r['correo'],$r['nom'],'correo-en-uso','Este correo ya pertenece a una cuenta',
                    "Recibimos un registro de egresado con este correo, pero ya pertenece a otra cuenta del instituto.\nSi es tu cuenta, ingresa con ella o usa «¿Olvidaste tu contraseña?». Para registrarte como egresado usa otro correo.",$data);
                return ['s'=>'aviso-'.$r['dni']];
            }
            $open=$db->prepare("SELECT *,code_expires<NOW() AS expired FROM pisco_graduate_requests WHERE dni=? AND status IN ('Por verificar','Por validar') ORDER BY id DESC LIMIT 1 FOR UPDATE");$open->execute([$r['dni']]);$prior=$open->fetch();
            if($prior&&$prior['status']==='Por validar'){
                $this->graduateMail($prior,'en-revision','Tu solicitud ya está en revisión','Recibimos un nuevo registro con tu DNI, pero ya tienes una solicitud en revisión. Te avisaremos a este correo cuando sea atendida.',$data);
                return ['s'=>(string)$prior['id']];
            }
            // Un registro pendiente desde otro correo no se reemplaza mientras su código siga vigente (evita sabotear registros ajenos).
            if($prior&&strcasecmp($prior['email'],$r['correo'])!==0&&!(int)$prior['expired'])return ['s'=>'aviso-'.$r['dni']];
            if(!$this->graduateCodeAllowed($r['dni']))return ['s'=>'aviso-'.$r['dni']];
            if($prior)$db->prepare("UPDATE pisco_graduate_requests SET status='Reemplazada',code_hash=NULL WHERE id=?")->execute([$prior['id']]);
            $db->prepare('INSERT INTO pisco_graduate_requests (dni,name,email,phone,program_id,grad_year,password) VALUES (?,?,?,?,?,?,?)')
                ->execute([$r['dni'],$r['nom'],$r['correo'],$r['tel'],$prog,$year,password_hash($r['password'],PASSWORD_DEFAULT)]);
            $request=$this->graduateRequest((int)$db->lastInsertId());
            $this->sendGraduateCode($request,$data);
            PortalAudit::write($this,'Registro de egresado','Bolsa laboral',(string)$request['id'],['dni'=>'****'.substr($r['dni'],-4)],['usuario'=>'visitante','rol'=>'publico']);
            return ['s'=>(string)$request['id']];
        })['s'];
        $this->deliverGraduateMail($source);
        return ['ok'=>true,'correo'=>self::maskEmail($r['correo']),'minutos'=>self::GRAD_CODE_MINUTES,'correoActivo'=>$this->mailReady()];
    }

    /** Reenvía el código. La respuesta no revela si existe un registro pendiente para ese DNI. */
    public function resendGraduateCode(array $input): array
    {
        $this->rate('graduate-code-resend',5,300);
        $dni=$input['dni']??'';if(!is_string($dni)||!preg_match('/^[0-9]{8}$/',$dni))throw new PortalError(422,'El DNI debe tener ocho dígitos.');
        $source=$this->transaction(function()use($dni){
            $stmt=$this->db()->prepare("SELECT * FROM pisco_graduate_requests WHERE dni=? AND status='Por verificar' ORDER BY id DESC LIMIT 1 FOR UPDATE");$stmt->execute([$dni]);$request=$stmt->fetch();
            if(!$request||!$this->graduateCodeAllowed($dni))return ['s'=>''];
            $this->sendGraduateCode($request,json_decode($this->state()['data'],true));
            return ['s'=>(string)$request['id']];
        })['s'];
        if($source!=='')$this->deliverGraduateMail($source);
        return ['ok'=>true,'correoActivo'=>$this->mailReady()];
    }

    /** Paso 2: confirmación del correo con el código. Los errores usan un mensaje único. */
    public function verifyGraduate(array $input): array
    {
        $this->rate('graduate-verify',20,300);
        $dni=$input['dni']??'';$code=$input['codigo']??'';
        if(!is_string($dni)||!preg_match('/^[0-9]{8}$/',$dni))throw new PortalError(422,'El DNI debe tener ocho dígitos.');
        if(!is_string($code)||!preg_match('/^[0-9]{6}$/',trim($code)))throw new PortalError(422,'El código tiene seis dígitos.');
        $result=$this->transaction(function()use($dni,$code){
            $db=$this->db();
            $stmt=$db->prepare("SELECT *,code_expires<NOW() AS expired FROM pisco_graduate_requests WHERE dni=? AND status='Por verificar' ORDER BY id DESC LIMIT 1 FOR UPDATE");$stmt->execute([$dni]);$request=$stmt->fetch();
            if(!$request||!$request['code_hash']||(int)$request['code_attempts']>=self::GRAD_CODE_ATTEMPTS||(int)$request['expired'])return ['error'=>true];
            if(!hash_equals($request['code_hash'],hash('sha256',$request['id'].'|'.trim($code)))){
                $db->prepare('UPDATE pisco_graduate_requests SET code_attempts=code_attempts+1 WHERE id=?')->execute([$request['id']]);
                return ['error'=>true];
            }
            $db->prepare("UPDATE pisco_graduate_requests SET code_hash=NULL,verified_at=NOW(),status='Por validar' WHERE id=?")->execute([$request['id']]);
            $state=$this->state(true);$data=json_decode($state['data'],true);$request=$this->graduateRequest((int)$request['id']);
            $student=PortalPolicy::find($data['academico']['estudiantes'],'dni',$dni);
            // Aprobación inmediata solo si el padrón ya lo registra como egresado o titulado con el mismo correo.
            if($student&&in_array($student['estado']??'',['Egresado','Titulado'],true)&&strcasecmp(trim((string)($student['correo']??'')),$request['email'])===0){
                $db->exec('SAVEPOINT auto_approval');
                try{$this->approveGraduate($request,$data,(int)$state['revision'],null,false);return ['estado'=>'Aprobada','id'=>(int)$request['id']];}
                // Si no se puede aprobar sola (p. ej. el correo ya se usó en otra cuenta), queda para la revisión del personal.
                catch(PortalError){$db->exec('ROLLBACK TO SAVEPOINT auto_approval');$state=$this->state(true);$data=json_decode($state['data'],true);}
            }
            PortalDomain::staff($data,'Solicitud de registro de egresado: '.$request['name'],'bolsa',['admin','adm','acad']);$this->updateState($data,(int)$state['revision']+1);
            $this->graduateMail($request,'recibida','Solicitud de registro recibida',
                "Confirmaste tu correo. Tu solicitud de registro en la Bolsa Laboral está en revisión por el instituto (Secretaría Académica o Bolsa Laboral).\nTe avisaremos a este correo cuando sea atendida. Después podrás ingresar con tu DNI y la contraseña que creaste.",$data);
            $bolsa=$data['config']['bolsa']['correo']??'';
            if(is_string($bolsa)&&filter_var($bolsa,FILTER_VALIDATE_EMAIL))PortalMail::queue($db,'egresados',(string)$request['id'],'aviso-personal','1',$bolsa,'BOL-EGR-'.$request['id'],'Nueva solicitud de registro de egresado',
                "Un egresado solicitó su cuenta de la Bolsa Laboral.\nNombre: {$request['name']}\nRevisa la solicitud en la intranet: Bolsa laboral › Registro de egresados, o Maestro de alumnos › Registro de egresados.\n");
            return ['estado'=>'Por validar','id'=>(int)$request['id']];
        });
        if(isset($result['error']))throw new PortalError(422,self::GRAD_GENERIC);
        $this->deliverGraduateMail((string)$result['id']);
        return ['estado'=>$result['estado']];
    }

    /** Crea o actualiza el registro del padrón y la cuenta con la contraseña que eligió el egresado; avisa a su correo. */
    private function approveGraduate(array $request,array $data,int $revision,?array $actor,bool $inPerson): void
    {
        $db=$this->db();$a=&$data['academico'];
        $index=null;foreach($a['estudiantes'] as $i=>$e)if(($e['dni']??'')===$request['dni'])$index=$i;
        $existing=$index!==null?$a['estudiantes'][$index]:null;
        if($this->accountForStudent($request['dni'],$existing?(int)$existing['id']:null))throw new PortalError(422,'Esta persona ya tiene una cuenta. Revísala en Usuarios y roles.');
        $used=$db->prepare('SELECT 1 FROM pisco_users WHERE email=?');$used->execute([$request['email']]);
        if($used->fetchColumn())throw new PortalError(422,'El correo de la solicitud ya pertenece a otra cuenta.');
        $previousEmail='';
        if($existing===null){
            $id=max([0,...array_map(fn($e)=>(int)$e['id'],$a['estudiantes'])])+1;
            // Ingreso estimado (programas de tres años); Secretaría puede corregir ciclo, sección y turno en el maestro de alumnos.
            $a['estudiantes'][]=['id'=>$id,'dni'=>$request['dni'],'nom'=>$request['name'],'prog'=>(int)$request['program_id'],'periodo'=>max(1984,(int)$request['grad_year']-3).'-I','ciclo'=>'VI','sec'=>'A','turno'=>'Mañana','estado'=>'Egresado','anioEgreso'=>(string)$request['grad_year'],'correo'=>$request['email'],'tel'=>$request['phone'],'origen'=>'Registro en línea','actualizado'=>date('Y-m-d')];
        }else{
            $e=&$a['estudiantes'][$index];$id=(int)$e['id'];
            if(!in_array($e['estado']??'',['Egresado','Titulado'],true)){$e['estado']='Egresado';$e['anioEgreso']=(string)$request['grad_year'];}
            // El contacto del padrón no se sobrescribe: solo se completa si estaba vacío.
            $previousEmail=trim((string)($e['correo']??''));
            if($previousEmail==='')$e['correo']=$request['email'];
            if(trim((string)($e['tel']??''))==='')$e['tel']=$request['phone'];
            $e['actualizado']=date('Y-m-d');unset($e);
        }
        $db->prepare('INSERT INTO pisco_users (username,name,email,password,role,profile,active) VALUES (?,?,?,?,?,?,1)')
            ->execute([$request['dni'],$request['name'],$request['email'],$request['password'],'egresado',json_encode(['vin'=>'est:'.$id,'dni'=>$request['dni']],JSON_THROW_ON_ERROR)]);
        $db->prepare("UPDATE pisco_graduate_requests SET status='Aprobada',student_id=?,decided_at=NOW(),decided_by=?,reason=NULL WHERE id=?")->execute([$id,$actor['usuario']??'Padrón (automática)',$request['id']]);
        $this->updateState($data,$revision+1);
        PortalAudit::write($this,'Aprobar registro de egresado','Cuentas',(string)$request['id'],['dni'=>'****'.substr($request['dni'],-4),'modo'=>$actor?($inPerson?'Revisión con identidad verificada en persona':'Revisión'):'Padrón'],$actor??['usuario'=>'visitante','rol'=>'publico']);
        $this->graduateMail($request,'aprobada','Tu cuenta de la Bolsa Laboral está activa',
            "Tu registro fue aprobado. Ya puedes ingresar a la Bolsa Laboral con:\n\nUsuario: tu DNI ({$request['dni']})\nContraseña: la que creaste al registrarte\n\nCompleta tu perfil profesional y sube tu CV para postular a las ofertas.",$data);
        // Si el padrón tenía otro correo, se avisa también a esa dirección.
        if($previousEmail!==''&&strcasecmp($previousEmail,$request['email'])!==0)$this->graduateMailTo((string)$request['id'],$previousEmail,$request['name'],'aviso-padron','Se creó una cuenta con tu DNI',
            "Se creó una cuenta de egresado de la Bolsa Laboral con tu DNI y el correo ".self::maskEmail($request['email']).".\nSi no fuiste tú, comunícate de inmediato con Secretaría Académica.",$data);
    }

    private function canReviewGraduates(): array
    {
        $user=$this->requireUser();$role=PortalPolicy::role($user);
        if($role==='admin')return $user;
        if(in_array($role,PortalPolicy::COMMUNITY,true))throw new PortalError(403,'No tienes permiso para revisar registros de egresados.');
        $full=json_decode($this->state()['data'],true);
        if(PortalPolicy::level($full,$user,'alumnos')<2&&PortalPolicy::level($full,$user,'bolsa')<2)throw new PortalError(403,'No tienes permiso para revisar registros de egresados.');
        return $user;
    }
    /** Programa que corresponde a una solicitud: el del padrón si la persona ya figura; si no, el declarado. */
    private static function requestProgram(array $request,array $data): int
    {
        $student=PortalPolicy::find($data['academico']['estudiantes'],'dni',$request['dni']);
        return (int)($student['prog']??$request['program_id']);
    }
    /** Solicitudes para el personal (sin contraseñas ni códigos). */
    public function graduateRequests(): array
    {
        $user=$this->canReviewGraduates();
        $rows=$this->db()->query("SELECT id,dni,name,email,phone,program_id,grad_year,status,reason,created_at,verified_at,decided_at,decided_by FROM pisco_graduate_requests WHERE status<>'Reemplazada' ORDER BY FIELD(status,'Por validar','Por verificar','Aprobada','Rechazada'),created_at DESC LIMIT 300")->fetchAll();
        $data=json_decode($this->state()['data'],true);
        if(PortalPolicy::role($user)==='coordinador'){$own=(int)($data['academico']['progMap'][$user['programaId']]??0);$rows=array_values(array_filter($rows,fn($r)=>self::requestProgram($r,$data)===$own));}
        foreach($rows as &$r){$s=PortalPolicy::find($data['academico']['estudiantes'],'dni',$r['dni']);$r['padron']=$s?['estado'=>$s['estado']??'','nom'=>$s['nom']??'','correo'=>$s['correo']??'','prog'=>(int)($s['prog']??0)]:null;$r['id']=(int)$r['id'];$r['program_id']=(int)$r['program_id'];}unset($r);
        return ['requests'=>$rows];
    }
    /** Paso 3: Secretaría (o la Bolsa Laboral) aprueba o rechaza; el egresado recibe la respuesta en su correo. */
    public function decideGraduate(array $input): array
    {
        $user=$this->canReviewGraduates();$this->rate('graduate-decide',120,60);
        $id=filter_var($input['id']??null,FILTER_VALIDATE_INT);$action=$input['accion']??'';
        if(!$id||!in_array($action,['aprobar','rechazar'],true))throw new PortalError(422,'Solicitud no válida.');
        $reason=trim((string)($input['motivo']??''));
        if($action==='rechazar'&&(preg_match_all('/./us',$reason)<5||preg_match_all('/./us',$reason)>300))throw new PortalError(422,'Indica el motivo del rechazo (de 5 a 300 caracteres); se enviará al egresado.');
        $inPerson=($input['verificadoEnPersona']??false)===true;
        $this->transaction(function()use($id,$action,$reason,$user,$inPerson){
            $request=$this->graduateRequest($id,true);
            if(!$request||!in_array($request['status'],['Por validar','Por verificar'],true))throw new PortalError(409,'La solicitud ya fue atendida.');
            $state=$this->state(true);$data=json_decode($state['data'],true);
            if(PortalPolicy::role($user)==='coordinador'&&self::requestProgram($request,$data)!==(int)($data['academico']['progMap'][$user['programaId']]??0))throw new PortalError(403,'Solicitud de otro programa.');
            if($action==='aprobar'){
                // Sin correo confirmado solo se aprueba si el personal verificó la identidad en persona (queda en la auditoría).
                if($request['status']==='Por verificar'&&!$inPerson)throw new PortalError(422,'El correo de esta solicitud no está confirmado. Apruébala solo si verificaste la identidad de la persona (por ejemplo, con su DNI en Secretaría).');
                $this->approveGraduate($request,$data,(int)$state['revision'],$user,$inPerson);return [];
            }
            $this->db()->prepare("UPDATE pisco_graduate_requests SET status='Rechazada',reason=?,decided_at=NOW(),decided_by=?,code_hash=NULL WHERE id=?")->execute([$reason,$user['usuario'],$id]);
            PortalAudit::write($this,'Rechazar registro de egresado','Cuentas',(string)$id,['dni'=>'****'.substr($request['dni'],-4)],$user);
            $this->graduateMail($request,'rechazada','Tu solicitud de registro no fue aprobada',
                "Revisamos tu solicitud de registro en la Bolsa Laboral y no pudo ser aprobada.\n\nMotivo: $reason\n\nPuedes corregir tus datos y registrarte nuevamente, o acercarte a Secretaría Académica.",$data);
            return [];
        });
        $this->deliverGraduateMail((string)$id);
        return ['ok'=>true];
    }
}
