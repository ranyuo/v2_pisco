<?php
declare(strict_types=1);
require_once __DIR__.'/vendor/phpmailer/src/Exception.php';
require_once __DIR__.'/vendor/phpmailer/src/PHPMailer.php';
require_once __DIR__.'/vendor/phpmailer/src/SMTP.php';

/** Cola privada: se confirma junto al trámite y se entrega después del commit. */
final class PortalMail
{
    public function __construct(private readonly array $config) {}

    public function ready(): bool
    {
        return ($this->config['enabled']??false)===true
            && !empty($this->config['password']) && !empty($this->config['username']);
    }

    public static function enqueue(PDO $db,array $record,array $data): void
    {
        $reference=$record['numero'];
        $institution=$data['config']['inst']['nombre'];
        $messages=[
            'solicitante'=>[$record['correo'], 'Cargo de recepción '.$reference,
                "Su trámite ha sido registrado en $institution.\n\nExpediente: $reference\nDocumento: {$record['numDocumento']}\nFecha de registro: {$record['fecha']}\nRecepción administrativa: {$record['fechaRecepcion']}\nCódigo de verificación: {$record['cargoCod']}\n\nConserve estos datos para consultar el seguimiento en Mesa de Partes.\n"],
            'mesa'=>[$data['config']['mpv']['correo'], '['.$reference.'] Nuevo trámite registrado',
                "Se ha registrado un nuevo trámite en $institution.\n\nExpediente: $reference\nSolicitante: {$record['nombres']}\nCorreo del solicitante: {$record['correo']}\nTipo: {$record['tipoTramite']}\nAsunto: {$record['asunto']}\nÁrea de destino: {$record['areaDestino']}\n\nIngrese a la intranet para revisar el expediente y sus adjuntos privados.\n"],
        ];
        $insert=$db->prepare('INSERT INTO pisco_mail (id,record_id,reference,recipient,subject,body,created_at,next_attempt_at) VALUES (?,?,?,?,?,?,UTC_TIMESTAMP(6),UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE id=id');
        $seen=[];foreach($messages as $kind=>[$to,$subject,$body]){
            if(!is_string($to)||strlen($to)>254||!filter_var($to,FILTER_VALIDATE_EMAIL))throw new PortalError(422,'Configura un correo receptor válido para Mesa de Partes.');
            $key=strtolower(trim($to));if(isset($seen[$key]))continue;$seen[$key]=true;
            $insert->execute([hash('sha256',$record['id'].'|'.$kind),$record['id'],$reference,$to,$subject,$body]);
        }
    }

    public static function queue(PDO $db,string $module,string $sourceId,string $event,string $version,string $to,string $reference,string $subject,string $body,string $sourceKey=''): void
    {
        preg_match('/^.{0,200}/us',$subject,$short);$subject=$short[0]??'Notificación institucional';
        if(strlen($body)>60000){preg_match('/^.{0,14000}/us',$body,$short);$body=($short[0]??'')."\nMensaje resumido. Consulta el contenido completo en la plataforma.\n";}
        $batch=hash('sha256',$module.'|'.$sourceId);
        $id=hash('sha256',$batch.'|'.$sourceKey.'|'.$event.'|'.$version.'|'.$to);
        $insert=$db->prepare('INSERT INTO pisco_mail (id,record_id,source_type,source_id,source_key,event,reference,recipient,subject,body,created_at,next_attempt_at) VALUES (?,?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP(6),UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE id=id');
        $insert->execute([$id,$batch,$module,$sourceId,$sourceKey,$event,$reference,$to,$subject,'Evento registrado: '.date(DATE_ATOM)."\n".$body]);
    }

    /** No se incluyen credenciales ni cuerpos de correos en el panel. */
    public function status(PortalApp $app): array
    {
        $app->requireAdmin();
        $rows=$app->db()->query('SELECT id,source_type,event,reference,recipient,status,attempts,last_error,created_at,sent_at FROM pisco_mail ORDER BY created_at DESC,id LIMIT 30')->fetchAll();
        return ['enabled'=>($this->config['enabled']??false)===true,'configured'=>$this->ready(),
            'from'=>$this->config['from_email']??'notificaciones@proyectos.pe','messages'=>$rows,'warnings'=>$this->warnings($app)];
    }

    private function warnings(PortalApp $app): array
    {
        $raw=$app->db()->query('SELECT data FROM pisco_state WHERE id=1')->fetchColumn();$data=json_decode($raw,true,flags:JSON_THROW_ON_ERROR);$warnings=[];
        if(empty($data['config']['lr']['correo'])&&empty($data['config']['correoReclamos']))$warnings[]='Configura el correo responsable del Libro de Reclamaciones.';
        if(empty($data['config']['bolsa']['correo']))$warnings[]='Configura el correo responsable de Bolsa Laboral.';
        return $warnings;
    }

    public static function retry(PortalApp $app,array $input): array
    {
        $app->requireAdmin();$id=$input['id']??null;
        if(!is_string($id)||!preg_match('/^[a-f0-9]{64}$/D',$id))throw new PortalError(422,'Notificación no válida.');
        $update=$app->db()->prepare("UPDATE pisco_mail SET status='Pendiente',attempts=0,next_attempt_at=UTC_TIMESTAMP(),last_error=NULL WHERE id=? AND status='Error'");
        $update->execute([$id]);
        if(!$update->rowCount())throw new PortalError(409,'Solo se pueden reintentar notificaciones con error.');
        PortalAudit::write($app,'Reintentar notificación','Notificaciones',$id);
        return ['ok'=>true];
    }

    public function process(PDO $db,int $limit=10,?string $recordId=null): array
    {
        $result=['sent'=>0,'failed'=>0,'skipped'=>0];
        if(!$this->ready())return $result+['configured'=>false];
        if($db->inTransaction())throw new LogicException('Los correos se procesan después de confirmar el trámite.');
        // Un solo emisor por base. El bloqueo se libera incluso si el proceso muere.
        $lock='portal-mail-'.substr(hash('sha256',(string)$db->query('SELECT DATABASE()')->fetchColumn()),0,40);
        $get=$db->prepare('SELECT GET_LOCK(?,0)');$get->execute([$lock]);
        if((int)$get->fetchColumn()!==1)return $result+['busy'=>true];
        try{
            $sql="SELECT * FROM pisco_mail WHERE status IN ('Pendiente','Error') AND attempts<5 AND next_attempt_at<=UTC_TIMESTAMP()";
            if($recordId!==null)$sql.=' AND record_id=?';
            $select=$db->prepare($sql.' ORDER BY created_at,id LIMIT '.max(1,min(50,$limit)));
            $select->execute($recordId!==null?[$recordId]:[]);
            foreach($select->fetchAll() as $row){
                // Una copia restaurada no debe notificar trámites ausentes de su estado.
                $state=$db->query('SELECT data FROM pisco_state WHERE id=1')->fetchColumn();
                $data=$state?json_decode($state,true,flags:JSON_THROW_ON_ERROR):[];
                if(!PortalNotifications::exists($data,$row)){
                    $db->prepare("UPDATE pisco_mail SET status='Cancelado',next_attempt_at=NULL,last_error='Aviso cancelado: el registro de origen fue retirado o ya no corresponde.' WHERE id=?")->execute([$row['id']]);$result['skipped']++;continue;
                }
                $attempt=(int)$row['attempts']+1;
                try{
                    $this->send($row);
                }catch(Throwable $error){
                    // Nunca persistir ErrorInfo, el diálogo SMTP, contraseñas o tokens.
                    $message=$error instanceof InvalidArgumentException?'Configuración SMTP no válida.':'SMTP no confirmó el envío. Revise credenciales, conexión y destinatario.';
                    $delay=min(3600,60*(2**($attempt-1)));
                    $db->prepare("UPDATE pisco_mail SET status='Error',attempts=?,last_error=?,next_attempt_at=DATE_ADD(UTC_TIMESTAMP(),INTERVAL $delay SECOND) WHERE id=?")
                        ->execute([$attempt,$message,$row['id']]);
                    $result['failed']++;continue;
                }
                $db->prepare("UPDATE pisco_mail SET status='Enviado',attempts=?,sent_at=UTC_TIMESTAMP(),next_attempt_at=NULL,last_error=NULL WHERE id=?")
                    ->execute([$attempt,$row['id']]);$result['sent']++;
            }
            // Mantener fallos/pendientes para revisión; eliminar contenido entregado antiguo.
            $db->exec("DELETE FROM pisco_mail WHERE status IN ('Enviado','Cancelado') AND created_at<DATE_SUB(UTC_TIMESTAMP(),INTERVAL 30 DAY)");
        }finally{
            $release=$db->prepare('SELECT RELEASE_LOCK(?)');$release->execute([$lock]);
        }
        return $result+['configured'=>true];
    }

    private function send(array $row): void
    {
        $c=$this->config;$host=$c['host']??'smtp.gmail.com';$port=$c['port']??587;
        $security=$c['encryption']??'tls';$from=$c['from_email']??'notificaciones@proyectos.pe';
        if(!is_string($host)||!preg_match('/^[a-zA-Z0-9.-]+$/D',$host)||!is_int($port)||$port<1||$port>65535
            ||!in_array($security,['tls','ssl'],true)||!filter_var($from,FILTER_VALIDATE_EMAIL)
            ||!filter_var($c['username'],FILTER_VALIDATE_EMAIL))throw new InvalidArgumentException('SMTP');
        $mail=new \PHPMailer\PHPMailer\PHPMailer(true);
        $mail->isSMTP();$mail->Host=$host;$mail->Port=$port;$mail->SMTPAuth=true;
        $mail->SMTPSecure=$security;$mail->SMTPAutoTLS=true;
        $mail->Username=$c['username'];$mail->Password=$c['password'];
        $mail->Timeout=10;$mail->getSMTPInstance()->Timelimit=15;$mail->SMTPDebug=0;
        $mail->SMTPOptions=['ssl'=>['verify_peer'=>true,'verify_peer_name'=>true,'allow_self_signed'=>false]];
        if(!empty($c['ca_file']))$mail->SMTPOptions['ssl']['cafile']=$c['ca_file'];
        $mail->CharSet='UTF-8';$mail->Encoding='base64';
        $mail->setFrom($from,$c['from_name']??'Portal IESTP Pisco');
        $mail->addAddress($row['recipient']);
        $domain=substr(strrchr($from,'@'),1);
        $mail->MessageID='<portal-'.$row['id'].'@'.$domain.'>';
        $mail->Subject=$row['subject'];$mail->Body=$row['body'];$mail->isHTML(false);
        $mail->send();
    }
}
