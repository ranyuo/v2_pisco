<?php
declare(strict_types=1);
/**
 * Tareas de mantenimiento de la Bolsa Laboral y recuperación de contraseñas.
 * - Cierre automático: las ofertas «Publicada» cuya fecha límite ya pasó quedan «Cerrada»; se avisa a la empresa y a sus postulantes.
 * - Recuperación de contraseña: código de 6 dígitos al correo registrado de la cuenta, nueva contraseña y aviso del cambio.
 */
trait PortalRecovery
{
    private const RESET_MINUTES=15;
    private const RESET_ATTEMPTS=5;

    /** Ofertas publicadas cuya fecha límite ya pasó (el día límite todavía admite postulaciones). */
    public static function expiredOffers(array $data): array
    {
        $today=date('Y-m-d');
        return array_values(array_filter($data['academico']['ofertas']??[],fn($o)=>($o['estado']??'')==='Publicada'&&!($o['deleted']??false)&&is_string($o['limite']??null)&&$o['limite']!==''&&$o['limite']<$today));
    }
    /** Cierra las ofertas vencidas. Se ejecuta desde mail-worker.php y cron.php, y tras cargar el portal si encuentra alguna. */
    public function closeExpiredOffers(): int
    {
        $peek=json_decode($this->state()['data'],true,flags:JSON_THROW_ON_ERROR);
        if(!self::expiredOffers($peek))return 0;
        $closed=$this->transaction(function(){
            $state=$this->state(true);$previous=json_decode($state['data'],true,flags:JSON_THROW_ON_ERROR);$data=$previous;
            $expired=array_column(self::expiredOffers($data),'id');if(!$expired)return [];
            $accounts=array_map($this->accountDto(...),$this->db()->query('SELECT * FROM pisco_users')->fetchAll());
            $a=&$data['academico'];$next=max([0,...array_map(fn($n)=>(int)$n['id'],$a['notifs']??[])])+1;
            $notify=function(string $binding,string $text)use(&$a,&$next,$accounts){foreach($accounts as $u)if(($u['vin']??'')===$binding)$a['notifs'][]=['id'=>$next++,'to'=>'u:'.$u['ixId'],'txt'=>$text,'fecha'=>date('Y-m-d H:i'),'go'=>'bolsa','leido'=>[]];};
            $names=[];
            foreach($a['ofertas'] as &$offer){
                if(!in_array($offer['id'],$expired,true))continue;
                $offer['estado']='Cerrada';$names[]=$offer['puesto'];
                $notify('emp:'.$offer['emp'],'Tu oferta «'.$offer['puesto'].'» se cerró automáticamente: venció su fecha límite.');
                foreach($a['postulaciones'] as $post)if(!($post['deleted']??false)&&$post['of']===$offer['id'])$notify('est:'.$post['est'],'La oferta «'.$offer['puesto'].'» cerró su convocatoria. La empresa comunicará el resultado de tu postulación.');
            }unset($offer);
            $a['notifs']=array_slice($a['notifs'],-3000);unset($a);
            // Mismos correos que un cierre manual: a la empresa y a cada postulante.
            PortalNotifications::changes($this->db(),$previous,$data,(int)$state['revision']+1,$accounts);
            $this->updateState($data,(int)$state['revision']+1);
            PortalAudit::write($this,'Cierre automático de ofertas','Bolsa laboral',implode(', ',array_map('strval',$expired)),['ofertas'=>implode(' · ',$names)],['usuario'=>'sistema','rol'=>'sistema']);
            return $expired;
        });
        // Ya se ejecuta después de responder (o desde el cron): los avisos salen de inmediato.
        if($closed){try{$this->processMail(20);}catch(Throwable){}}
        return count($closed);
    }

    private function resetMail(array $user,string $event,string $subject,string $body): void
    {
        $inst=json_decode($this->state()['data'],true)['config']['inst']['nombre']??'el instituto';
        PortalMail::queue($this->db(),'cuentas',(string)$user['id'],$event,(string)microtime(true),$user['email'],'CTA-'.$user['id'],$subject,
            "Hola, {$user['name']}:\n\n".$body."\n\n$inst\nEste es un mensaje automático; no lo respondas.\n");
        PortalNotifications::$queued++;
    }
    private static function realEmail(string $email): bool { return (bool)filter_var($email,FILTER_VALIDATE_EMAIL)&&!str_ends_with(strtolower($email),'@portal.invalid'); }

    /** Paso 1: se envía un código al correo registrado de la cuenta. La respuesta es la misma exista o no la cuenta. */
    public function requestPasswordReset(array $input): array
    {
        $this->rate('password-reset',5,300);
        $username=strtolower(trim((string)($input['usuario']??'')));
        if($username===''||strlen($username)>80)throw new PortalError(422,'Escribe tu usuario (DNI, RUC o usuario del instituto).');
        $sent=$this->transaction(function()use($username){
            $db=$this->db();$stmt=$db->prepare('SELECT * FROM pisco_users WHERE username=? AND active=1 FOR UPDATE');$stmt->execute([$username]);$user=$stmt->fetch();
            if(!$user||!self::realEmail($user['email']))return ['id'=>0];
            // Como máximo tres códigos por hora para una misma cuenta.
            $recent=$db->prepare('SELECT COUNT(*) FROM pisco_password_resets WHERE user_id=? AND created_at>DATE_SUB(NOW(),INTERVAL 1 HOUR)');$recent->execute([$user['id']]);
            if((int)$recent->fetchColumn()>=3)return ['id'=>0];
            $db->prepare('UPDATE pisco_password_resets SET used_at=NOW() WHERE user_id=? AND used_at IS NULL')->execute([$user['id']]);
            $code=(string)random_int(100000,999999);
            $db->prepare('INSERT INTO pisco_password_resets (user_id,code_hash,expires_at) VALUES (?,?,DATE_ADD(NOW(),INTERVAL '.self::RESET_MINUTES.' MINUTE))')->execute([$user['id'],'']);
            $id=(int)$db->lastInsertId();$db->prepare('UPDATE pisco_password_resets SET code_hash=? WHERE id=?')->execute([hash('sha256',$id.'|'.$code),$id]);
            $this->resetMail($user,'codigo','Código para restablecer tu contraseña: '.$code,
                "Recibimos una solicitud para restablecer la contraseña de tu cuenta (usuario: {$user['username']}).\n\nTu código es: $code\n\nEscríbelo en la página de ingreso, en «¿Olvidaste tu contraseña?». Vence en ".self::RESET_MINUTES." minutos.\nSi no lo solicitaste, ignora este mensaje: tu contraseña no cambiará.");
            PortalAudit::write($this,'Solicitar restablecimiento de contraseña','Cuentas',(string)$user['id'],[],['usuario'=>'visitante','rol'=>'publico']);
            return ['id'=>(int)$user['id']];
        })['id'];
        if($sent)portal_defer(fn()=>$this->processMail(3,hash('sha256','cuentas|'.$sent)));
        return ['ok'=>true,'minutos'=>self::RESET_MINUTES];
    }

    /** Paso 2: código y nueva contraseña. Cierra las sesiones abiertas y desbloquea la cuenta. */
    public function resetPassword(array $input): array
    {
        $this->rate('password-reset-verify',20,300);
        $username=strtolower(trim((string)($input['usuario']??'')));$code=trim((string)($input['codigo']??''));$password=$input['password']??'';
        if($username===''||strlen($username)>80)throw new PortalError(422,'Escribe tu usuario.');
        if(!preg_match('/^[0-9]{6}$/',$code))throw new PortalError(422,'El código tiene seis dígitos.');
        if(!is_string($password)||preg_match_all('/./us',$password)<12||strlen($password)>72)throw new PortalError(422,'La nueva contraseña necesita al menos 12 caracteres (máximo 72 bytes).');
        if(($input['password_confirmation']??null)!==$password)throw new PortalError(422,'La nueva contraseña y su confirmación deben coincidir.');
        $result=$this->transaction(function()use($username,$code,$password){
            $db=$this->db();$generic='El código no es correcto o ya venció. Solicita uno nuevo.';
            $stmt=$db->prepare('SELECT * FROM pisco_users WHERE username=? AND active=1 FOR UPDATE');$stmt->execute([$username]);$user=$stmt->fetch();
            if(!$user)return ['error'=>$generic];
            $r=$db->prepare('SELECT *,expires_at<NOW() AS expired FROM pisco_password_resets WHERE user_id=? AND used_at IS NULL ORDER BY id DESC LIMIT 1 FOR UPDATE');$r->execute([$user['id']]);$reset=$r->fetch();
            if(!$reset||(int)$reset['expired']||(int)$reset['attempts']>=self::RESET_ATTEMPTS)return ['error'=>$generic];
            if(!hash_equals($reset['code_hash'],hash('sha256',$reset['id'].'|'.$code))){
                $db->prepare('UPDATE pisco_password_resets SET attempts=attempts+1 WHERE id=?')->execute([$reset['id']]);
                $left=self::RESET_ATTEMPTS-1-(int)$reset['attempts'];
                return ['error'=>$left>0?"El código no es correcto. Te quedan $left intento(s).":'Superaste los intentos permitidos. Solicita un código nuevo.'];
            }
            $db->prepare('UPDATE pisco_password_resets SET used_at=NOW() WHERE id=?')->execute([$reset['id']]);
            $db->prepare('UPDATE pisco_users SET password=?,auth_version=auth_version+1,login_failures=0,locked_until=NULL WHERE id=?')->execute([password_hash($password,PASSWORD_DEFAULT),$user['id']]);
            $this->flagPasswordChange((int)$user['id'],false);
            $db->prepare('DELETE FROM pisco_rate_limits WHERE rate_key LIKE ?')->execute([self::loginFailPrefix($username).'%']);
            PortalAudit::write($this,'Restablecer contraseña','Cuentas',(string)$user['id'],['medio'=>'Código por correo'],['usuario'=>$user['username'],'rol'=>$user['role']]);
            $this->resetMail($user,'cambio','Tu contraseña fue cambiada',
                "La contraseña de tu cuenta (usuario: {$user['username']}) se cambió el ".date('d/m/Y \a \l\a\s H:i').".\nSi no fuiste tú, comunícate de inmediato con el instituto.");
            return ['id'=>(int)$user['id']];
        });
        if(isset($result['error']))throw new PortalError(422,$result['error']);
        portal_defer(fn()=>$this->processMail(3,hash('sha256','cuentas|'.$result['id'])));
        return ['ok'=>true];
    }
}
