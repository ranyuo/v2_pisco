<?php
declare(strict_types=1);
trait PortalForms
{
    public function challenge(array $input): array
    {
        $purpose=$input['purpose']??'';
        if(!in_array($purpose,['mensajes','expedientes','reclamos','certificados'],true))throw new PortalError(422,'Formulario no válido.');
        $this->rate('challenge',120,60);
        $_SESSION['challenges']=array_filter($_SESSION['challenges']??[],fn($c)=>$c['expires']>=time());
        if(count($_SESSION['challenges'])>=80)array_shift($_SESSION['challenges']);
        $a=random_int(2,19);$b=random_int(1,19);$id=bin2hex(random_bytes(16));
        $_SESSION['challenges'][$id]=['answer'=>(string)($a+$b),'purpose'=>$purpose,'expires'=>time()+1800,'used_key'=>null];
        return ['id'=>$id,'question'=>"$a + $b",'expires_in'=>1800];
    }
    private function submissionProof(string $purpose,array $input): void
    {
        $proof=$input['proof']??[];$id=$proof['challenge_id']??'';$c=is_string($id)?($_SESSION['challenges'][$id]??null):null;
        if(!$c||$c['purpose']!==$purpose||$c['expires']<time())throw new PortalError(422,'La verificación anti-spam ha caducado. Recarga el formulario.');
        if(!hash_equals($c['answer'],trim((string)($proof['answer']??''))))throw new PortalError(422,'La suma no es correcta. Corrige el resultado e inténtalo nuevamente.');
        if(!empty($proof['website']))throw new PortalError(422,'Envío bloqueado por el filtro anti-spam.');
        if(($c['used_key']??null)!==null&&$c['used_key']!==($input['idempotency_key']??''))throw new PortalError(422,'La verificación ya fue utilizada. Recarga el formulario.');
        if(in_array($purpose,['mensajes','expedientes','reclamos'],true)&&($proof['accept']??false)!==true)throw new PortalError(422,'Debes aceptar el tratamiento de datos y la política de privacidad.');
        if(in_array($purpose,['expedientes','reclamos'],true)&&($proof['declare']??false)!==true)throw new PortalError(422,'Debes aceptar la declaración de veracidad.');
    }
    private function formDomain(string $type,array $record,array $data): array
    {
        if(isset($record['numDoc'])){
            $doc=$record['tipoDoc'];$number=$record['numDoc'];
            $valid=match($doc){'DNI'=>(bool)preg_match('/^[0-9]{8}$/',$number),'RUC'=>(bool)preg_match('/^[0-9]{11}$/',$number),'CE','Carné de extranjería','Pasaporte'=>(bool)preg_match('/^[A-Za-z0-9-]{6,20}$/',$number),default=>false};
            if(!$valid)throw new PortalError(422,'El tipo o número de documento de identidad no es válido.');
        }
        if(!empty($record['telefono'])&&!preg_match('/^[0-9\s+()\-]{6,30}$/',$record['telefono']))throw new PortalError(422,'El teléfono no es válido.');
        if(!empty($record['programaId'])&&!PortalPolicy::find($data['programas'],'id',$record['programaId']))throw new PortalError(422,'El programa de estudios no existe.');
        if($type==='expedientes'&&!PortalPolicy::find($data['academico']['areas'],'cod',$record['areaDestino']))throw new PortalError(422,'El área de destino no existe.');
        if($type==='reclamos'&&in_array($record['condicion'],['Estudiante','Egresado'],true)&&empty($record['programaId']))throw new PortalError(422,'Selecciona el programa de estudios.');
        if($type==='reclamos'&&!empty($record['adjunto'])&&(!in_array($record['adjunto']['type'],['application/pdf','image/jpeg','image/png'],true)||$record['adjunto']['size']>10*1048576))throw new PortalError(422,'La evidencia del reclamo debe ser PDF, JPG o PNG de hasta diez MB.');
        if($type==='reclamos'&&(preg_match_all('/./us',$record['descripcion'])>(int)($data['config']['limites']['descripcion']??10000)||preg_match_all('/./us',$record['pedido'])>(int)($data['config']['limites']['pedido']??5000)))throw new PortalError(422,'La descripción o el pedido excede el límite configurado.');
        if($type==='expedientes'){$c=$data['config']['mpv'];$tipos=[...($c['tipos']??[]),...array_column($data['academico']['tramites']??[],'nombre')];if(!in_array($record['tipoTramite'],$tipos,true))throw new PortalError(422,'Selecciona un tipo de trámite configurado en Mesa de Partes.');if(count($record['archivos'])>($c['maxArchivos']??5))throw new PortalError(422,'Demasiados adjuntos.');foreach($record['archivos'] as $file)if(!in_array(strtolower(pathinfo($file['original'],PATHINFO_EXTENSION)),$c['formatos']??[],true)||$file['size']>(int)($c['maxMB']??40)*1048576)throw new PortalError(422,'El adjunto excede los límites o formatos configurados.');}
        return $record;
    }
}
