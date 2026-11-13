<?php
declare(strict_types=1);
/**
 * Registro en línea de egresados de la Bolsa Laboral.
 * 1. El egresado completa sus datos y crea su contraseña; recibe en su correo un código de 6 dígitos.
 * 2. Al confirmar el código: si figura en el padrón como egresado o titulado y con ese mismo correo, su cuenta queda activa;
 *    en otro caso, la solicitud pasa a validación de Secretaría Académica o de la Bolsa Laboral.
 * 3. Cada paso se notifica al correo del egresado (aprobación o motivo del rechazo).
 * Las solicitudes viven en su propia tabla: la contraseña elegida se guarda solo como hash y nunca entra al estado del portal.
 */
trait PortalGraduates
{
    private const GRAD_CODE_MINUTES=30;
    private const GRAD_CODE_ATTEMPTS=5;

    private static function maskEmail(string $email): string
    {
        [$user,$domain]=array_pad(explode('@',$email,2),2,'');
        return mb_substr($user,0,2).str_repeat('•',max(1,mb_strlen($user)-2)).'@'.$domain;
    }
    private function graduateRequest(int $id,bool $lock=false): ?array
    {
        $stmt=$this->db()->prepare('SELECT * FROM pisco_graduate_requests WHERE id=?'.($lock?' FOR UPDATE':''));$stmt->execute([$id]);return $stmt->fetch()?:null;
    }
    private function graduateMail(array $request,string $event,string $subject,string $body,array $data): void
    {
        $inst=$data['config']['inst']['nombre']??'el instituto';
        PortalMail::queue($this->db(),'egresados',(string)$request['id'],$event,(string)time(),$request['email'],'BOL-EGR-'.$request['id'],$subject,
            "Hola, {$request['name']}:\n\n".$body."\n\nBolsa Laboral · $inst\nEste es un mensaje automático; no lo respondas.\n");
        PortalNotifications::$queued++;
    }
    private function deliverGraduateMail(int $id): void
    {
        $batch=hash('sha256','egresados|'.$id);portal_defer(fn()=>$this->processMail(3,$batch));
    }
    private function sendGraduateCode(array $request,array $data): void
    {
        $code=(string)random_int(100000,999999);
        $this->db()->prepare('UPDATE pisco_graduate_requests SET code_hash=?,code_expires=DATE_ADD(NOW(),INTERVAL '.self::GRAD_CODE_MINUTES.' MINUTE),code_attempts=0 WHERE id=?')
            ->execute([hash('sha256',$request['id'].'|'.$code),$request['id']]);
        $this->graduateMail($request,'codigo-'.bin2hex(random_bytes(4)),'Código de verificación: '.$code,
            "Recibimos tu registro en la Bolsa Laboral.\n\nTu código de verificación es: $code\n\nEscríbelo en la página de registro para confirmar tu correo. Vence en ".self::GRAD_CODE_MINUTES." minutos.\nSi no solicitaste este registro, ignora este mensaje.",$data);
    }

    /** Paso 1: datos, contraseña elegida por el egresado y envío del código a su correo. */
    public function registerGraduate(array $input): array
    {
        $this->rate('graduate-registration',5,300);
        if(($input['declaration']??false)!==true)throw new PortalError(422,'Debes aceptar la declaración de veracidad y el tratamiento de tus datos personales.');
        if(!empty($input['website']))throw new PortalError(422,'Envío bloqueado por el filtro anti-spam.');
        $r=self::validate($input,['dni'=>'required|string|max:8','nom'=>'required|string|max:150','correo'=>'required|email|max:254','tel'=>'required|string|max:15','password'=>'required|string|max:72']);
        $r['prog']=$input['prog']??null;$r['anio']=$input['anio']??null;
        if(!preg_match('/^[0-9]{8}$/',$r['dni']))throw new PortalError(422,'El DNI debe tener ocho dígitos.');
        $r['nom']=trim(preg_replace('/\s+/u',' ',$r['nom']));
        if(preg_match_all('/\p{L}/u',$r['nom'])<5||preg_match('/[<>0-9]/u',$r['nom']))throw new PortalError(422,'Escribe tus apellidos y nombres completos.');
        if(!preg_match('/^9[0-9]{8}$/',preg_replace('/\D/','',$r['tel'])))throw new PortalError(422,'El celular debe tener nueve dígitos y empezar con 9.');
        $r['tel']=preg_replace('/\D/','',$r['tel']);$r['correo']=strtolower(trim($r['correo']));
        $year=filter_var($r['anio'],FILTER_VALIDATE_INT);if($year===false||$year<1984||$year>(int)date('Y'))throw new PortalError(422,'Indica un año de egreso válido.');
        if(preg_match_all('/./us',$r['password'])<12||($input['password_confirmation']??null)!==$r['password'])throw new PortalError(422,'La contraseña necesita al menos 12 caracteres y su confirmación debe coincidir.');
        $result=$this->transaction(function()use($r,$year){
            $data=json_decode($this->state()['data'],true);
            $prog=filter_var($r['prog'],FILTER_VALIDATE_INT);if($prog===false||!PortalPolicy::find($data['academico']['programas'],'id',$prog))throw new PortalError(422,'Selecciona tu programa de estudios.');
            $db=$this->db();
            $exists=$db->prepare('SELECT username,email FROM pisco_users WHERE username=? OR email=?');$exists->execute([$r['dni'],$r['correo']]);
            foreach($exists->fetchAll() as $u){
                if($u['username']===$r['dni'])throw new PortalError(422,'Ya existe una cuenta con ese DNI. Ingresa con tu DNI y contraseña; si la olvidaste, acércate a Secretaría Académica.');
                throw new PortalError(422,'Ese correo ya está registrado en otra cuenta. Usa otro correo.');
            }
            $open=$db->prepare("SELECT * FROM pisco_graduate_requests WHERE dni=? AND status IN ('Por verificar','Por validar') FOR UPDATE");$open->execute([$r['dni']]);$prior=$open->fetch();
            if($prior&&$prior['status']==='Por validar')throw new PortalError(422,'Ya tienes una solicitud en revisión. Te avisaremos a tu correo cuando sea aprobada.');
            // Un registro sin confirmar se reemplaza: así quien se equivocó de correo puede corregirlo.
            if($prior)$db->prepare("UPDATE pisco_graduate_requests SET status='Reemplazada',code_hash=NULL WHERE id=?")->execute([$prior['id']]);
            $db->prepare('INSERT INTO pisco_graduate_requests (dni,name,email,phone,program_id,grad_year,password) VALUES (?,?,?,?,?,?,?)')
                ->execute([$r['dni'],$r['nom'],$r['correo'],$r['tel'],$prog,$year,password_hash($r['password'],PASSWORD_DEFAULT)]);
            $request=$this->graduateRequest((int)$db->lastInsertId());
            $this->sendGraduateCode($request,$data);
            PortalAudit::write($this,'Registro de egresado','Bolsa laboral',(string)$request['id'],['dni'=>'****'.substr($r['dni'],-4)],['usuario'=>'visitante','rol'=>'publico']);
            return ['id'=>(int)$request['id'],'correo'=>self::maskEmail($r['correo'])];
        });
        $this->deliverGraduateMail($result['id']);
        return $result+['minutos'=>self::GRAD_CODE_MINUTES];
    }

    /** Reenvía el código (por ejemplo, si venció). */
    public function resendGraduateCode(array $input): array
    {
        $this->rate('graduate-code-resend',3,300);
        $dni=$input['dni']??'';if(!is_string($dni)||!preg_match('/^[0-9]{8}$/',$dni))throw new PortalError(422,'El DNI debe tener ocho dígitos.');
        $result=$this->transaction(function()use($dni){
            $stmt=$this->db()->prepare("SELECT * FROM pisco_graduate_requests WHERE dni=? AND status='Por verificar' ORDER BY id DESC LIMIT 1 FOR UPDATE");$stmt->execute([$dni]);$request=$stmt->fetch();
            if(!$request)throw new PortalError(422,'No hay un registro pendiente de confirmar con ese DNI. Regístrate nuevamente.');
            $this->sendGraduateCode($request,json_decode($this->state()['data'],true));
            return ['id'=>(int)$request['id'],'correo'=>self::maskEmail($request['email'])];
        });
        $this->deliverGraduateMail($result['id']);
        return $result;
    }

    /** Paso 2: confirmación del correo con el código. */
    public function verifyGraduate(array $input): array
    {
        $this->rate('graduate-verify',20,300);
        $dni=$input['dni']??'';$code=$input['codigo']??'';
        if(!is_string($dni)||!preg_match('/^[0-9]{8}$/',$dni))throw new PortalError(422,'El DNI debe tener ocho dígitos.');
        if(!is_string($code)||!preg_match('/^[0-9]{6}$/',trim($code)))throw new PortalError(422,'El código tiene seis dígitos.');
        $result=$this->transaction(function()use($dni,$code){
            $db=$this->db();
            $stmt=$db->prepare("SELECT *,code_expires<NOW() AS expired FROM pisco_graduate_requests WHERE dni=? AND status='Por verificar' ORDER BY id DESC LIMIT 1 FOR UPDATE");$stmt->execute([$dni]);$request=$stmt->fetch();
            if(!$request||!$request['code_hash'])throw new PortalError(422,'No hay un registro pendiente de confirmar con ese DNI.');
            if((int)$request['code_attempts']>=self::GRAD_CODE_ATTEMPTS)throw new PortalError(422,'Superaste los intentos permitidos. Solicita un código nuevo.');
            if((int)$request['expired'])throw new PortalError(422,'El código venció. Solicita un código nuevo.');
            if(!hash_equals($request['code_hash'],hash('sha256',$request['id'].'|'.trim($code)))){
                $db->prepare('UPDATE pisco_graduate_requests SET code_attempts=code_attempts+1 WHERE id=?')->execute([$request['id']]);
                return ['error'=>'El código no es correcto. Te quedan '.max(0,self::GRAD_CODE_ATTEMPTS-1-(int)$request['code_attempts']).' intento(s).'];
            }
            $db->prepare("UPDATE pisco_graduate_requests SET code_hash=NULL,verified_at=NOW(),status='Por validar' WHERE id=?")->execute([$request['id']]);
            $state=$this->state(true);$data=json_decode($state['data'],true);$request=$this->graduateRequest((int)$request['id']);
            $student=PortalPolicy::find($data['academico']['estudiantes'],'dni',$dni);
            // Aprobación inmediata solo si el padrón ya lo registra como egresado o titulado con el mismo correo.
            if($student&&in_array($student['estado']??'',['Egresado','Titulado'],true)&&strcasecmp(trim((string)($student['correo']??'')),$request['email'])===0){
                $this->approveGraduate($request,$data,(int)$state['revision'],null);return ['estado'=>'Aprobada','id'=>(int)$request['id']];
            }
            PortalDomain::staff($data,'Solicitud de registro de egresado: '.$request['name'],'bolsa');$this->updateState($data,(int)$state['revision']+1);
            $this->graduateMail($request,'recibida','Solicitud de registro recibida',
                "Confirmaste tu correo. Tu solicitud de registro en la Bolsa Laboral está en revisión por Secretaría Académica.\nTe avisaremos a este correo cuando sea aprobada. Después podrás ingresar con tu DNI y la contraseña que creaste.",$data);
            $bolsa=$data['config']['bolsa']['correo']??'';
            if(is_string($bolsa)&&filter_var($bolsa,FILTER_VALIDATE_EMAIL))PortalMail::queue($db,'egresados',(string)$request['id'],'aviso-personal','1',$bolsa,'BOL-EGR-'.$request['id'],'Nueva solicitud de registro de egresado',
                "Un egresado solicitó su cuenta de la Bolsa Laboral.\nNombre: {$request['name']}\nRevisa la solicitud en la intranet: Bolsa laboral › Registro de egresados.\n");
            return ['estado'=>'Por validar','id'=>(int)$request['id']];
        });
        if(isset($result['error']))throw new PortalError(422,$result['error']);
        $this->deliverGraduateMail($result['id']);
        return ['estado'=>$result['estado']];
    }

    /** Crea o actualiza el registro del padrón y la cuenta con la contraseña que eligió el egresado; avisa a su correo. */
    private function approveGraduate(array $request,array $data,int $revision,?array $actor): void
    {
        $db=$this->db();$a=&$data['academico'];
        $exists=$db->prepare('SELECT 1 FROM pisco_users WHERE username=? OR email=?');$exists->execute([$request['dni'],$request['email']]);
        if($exists->fetchColumn())throw new PortalError(422,'Ya existe una cuenta con ese DNI o correo.');
        $index=null;foreach($a['estudiantes'] as $i=>$e)if(($e['dni']??'')===$request['dni'])$index=$i;
        if($index===null){
            $id=max([0,...array_map(fn($e)=>(int)$e['id'],$a['estudiantes'])])+1;
            // Ingreso estimado (programas de tres años); Secretaría puede corregir ciclo, sección y turno en el maestro de alumnos.
            $a['estudiantes'][]=['id'=>$id,'dni'=>$request['dni'],'nom'=>$request['name'],'prog'=>(int)$request['program_id'],'periodo'=>max(1984,(int)$request['grad_year']-3).'-I','ciclo'=>'VI','sec'=>'A','turno'=>'Mañana','estado'=>'Egresado','anioEgreso'=>(string)$request['grad_year'],'correo'=>$request['email'],'tel'=>$request['phone'],'origen'=>'Registro en línea','actualizado'=>date('Y-m-d')];
        }else{
            $e=&$a['estudiantes'][$index];$id=(int)$e['id'];
            if(!in_array($e['estado']??'',['Egresado','Titulado'],true)){$e['estado']='Egresado';$e['anioEgreso']=(string)$request['grad_year'];}
            $e['correo']=$request['email'];$e['tel']=$request['phone'];$e['actualizado']=date('Y-m-d');unset($e);
        }
        $db->prepare('INSERT INTO pisco_users (username,name,email,password,role,profile,active) VALUES (?,?,?,?,?,?,1)')
            ->execute([$request['dni'],$request['name'],$request['email'],$request['password'],'egresado',json_encode(['vin'=>'est:'.$id,'dni'=>$request['dni']],JSON_THROW_ON_ERROR)]);
        $db->prepare("UPDATE pisco_graduate_requests SET status='Aprobada',student_id=?,decided_at=NOW(),decided_by=?,reason=NULL WHERE id=?")->execute([$id,$actor['usuario']??'Padrón (automática)',$request['id']]);
        $this->updateState($data,$revision+1);
        PortalAudit::write($this,'Aprobar registro de egresado','Cuentas',(string)$request['id'],['dni'=>'****'.substr($request['dni'],-4),'modo'=>$actor?'Revisión':'Padrón'],$actor??['usuario'=>'visitante','rol'=>'publico']);
        $this->graduateMail($request,'aprobada','Tu cuenta de la Bolsa Laboral está activa',
            "Tu registro fue aprobado. Ya puedes ingresar a la Bolsa Laboral con:\n\nUsuario: tu DNI ({$request['dni']})\nContraseña: la que creaste al registrarte\n\nCompleta tu perfil profesional y sube tu CV para postular a las ofertas.",$data);
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
    /** Solicitudes para el personal (sin contraseñas ni códigos). */
    public function graduateRequests(): array
    {
        $user=$this->canReviewGraduates();
        $rows=$this->db()->query("SELECT id,dni,name,email,phone,program_id,grad_year,status,reason,created_at,verified_at,decided_at,decided_by FROM pisco_graduate_requests WHERE status<>'Reemplazada' ORDER BY FIELD(status,'Por validar','Por verificar','Aprobada','Rechazada'),created_at DESC LIMIT 300")->fetchAll();
        if(PortalPolicy::role($user)==='coordinador'){$data=json_decode($this->state()['data'],true);$own=$data['academico']['progMap'][$user['programaId']]??null;$rows=array_values(array_filter($rows,fn($r)=>(int)$r['program_id']===(int)$own));}
        $data=json_decode($this->state()['data'],true);
        foreach($rows as &$r){$s=PortalPolicy::find($data['academico']['estudiantes'],'dni',$r['dni']);$r['padron']=$s?['estado'=>$s['estado']??'','nom'=>$s['nom']??'','correo'=>$s['correo']??'']:null;$r['id']=(int)$r['id'];$r['program_id']=(int)$r['program_id'];}unset($r);
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
        $this->transaction(function()use($id,$action,$reason,$user){
            $request=$this->graduateRequest($id,true);
            if(!$request||!in_array($request['status'],['Por validar','Por verificar'],true))throw new PortalError(409,'La solicitud ya fue atendida.');
            $state=$this->state(true);$data=json_decode($state['data'],true);
            if(PortalPolicy::role($user)==='coordinador'&&(int)$request['program_id']!==(int)($data['academico']['progMap'][$user['programaId']]??0))throw new PortalError(403,'Solicitud de otro programa.');
            if($action==='aprobar'){$this->approveGraduate($request,$data,(int)$state['revision'],$user);return [];}
            $this->db()->prepare("UPDATE pisco_graduate_requests SET status='Rechazada',reason=?,decided_at=NOW(),decided_by=?,code_hash=NULL WHERE id=?")->execute([$reason,$user['usuario'],$id]);
            PortalAudit::write($this,'Rechazar registro de egresado','Cuentas',(string)$id,['dni'=>'****'.substr($request['dni'],-4)],$user);
            $this->graduateMail($request,'rechazada','Tu solicitud de registro no fue aprobada',
                "Revisamos tu solicitud de registro en la Bolsa Laboral y no pudo ser aprobada.\n\nMotivo: $reason\n\nPuedes corregir tus datos y registrarte nuevamente, o acercarte a Secretaría Académica.",$data);
            return [];
        });
        $this->deliverGraduateMail($id);
        return ['ok'=>true];
    }
}
