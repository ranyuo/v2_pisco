<?php
declare(strict_types=1);

/** Eventos confirmados del servidor; nunca acepta destinatarios enviados por el navegador. */
final class PortalNotifications
{
    /** Avisos encolados en esta petición; permite intentar el envío al terminar la respuesta. */
    public static int $queued=0;
    private static function emit(PDO $db,string $module,array $row,string $event,string $version,array $recipients,string $reference,string $subject,string $body): void
    {
        foreach(array_unique(array_map(fn($s)=>strtolower(trim((string)$s)),$recipients)) as $to){
            if($to===''||strlen($to)>254||!filter_var($to,FILTER_VALIDATE_EMAIL))continue;
            PortalMail::queue($db,$module,(string)$row['id'],$event,$version,$to,$reference,$subject,$body,self::identity($module,$row));
            self::$queued++;
        }
    }
    public static function received(PDO $db,string $module,array $row,array $data): void
    {
        $inst=$data['config']['inst']['nombre'];
        if($module==='reclamos'){
            $ref=$row['codigo'];
            self::emit($db,$module,$row,'registro','registro',[$row['correo']],$ref,'Constancia de registro '.$ref,
                "Su reclamo o queja fue registrado en $inst.\nCódigo: $ref\nFecha: {$row['fecha']}\nCódigo de verificación: {$row['cargoCod']}\nPlazo: {$row['plazoDias']} días hábiles.\nVencimiento: {$row['vence']}\nConserve su constancia y consulte el seguimiento en el Libro de Reclamaciones.\n");
            $staff=[$data['config']['lr']['correo']??'',$data['config']['correoReclamos']??''];
            // Si coincide con el reclamante, la constancia ya cubre ese destinatario.
            $staff=array_filter($staff,fn($to)=>strcasecmp(trim((string)$to),trim($row['correo']))!==0);
            self::emit($db,$module,$row,'registro','registro',$staff,$ref,'Nuevo reclamo o queja '.$ref,
                "Se registró un reclamo o queja en $inst.\nCódigo: $ref\nVencimiento: {$row['vence']}\nIngrese a la intranet para revisar el registro y sus adjuntos privados.\n");
        }
        if($module==='empresas'){
            $state=($row['validada']??false)?'Aprobada':($row['estadoVal']??'Pendiente');
            self::emit($db,$module,$row,'registro','registro',[$row['correo'],$data['config']['bolsa']['correo']??''],'BOL-EMP-'.$row['id'],'Empresa registrada: '.$state,
                "La empresa {$row['nom']} fue registrada en la Bolsa Laboral de $inst.\nEstado: $state\nConsulte su registro en Bolsa Laboral o con el responsable institucional. Para gestionar ofertas necesita una cuenta habilitada. ".(($row['validada']??false)?'La validación institucional figura aprobada.':'El registro no habilita la publicación sin validación institucional.')."\n");
        }
    }
    private static function student(array $data,mixed $id,array $accounts): string
    {
        // Se prioriza el correo de la cuenta activa vinculada: el alumno no puede redirigirlo editando el perfil.
        $bound=false;foreach($accounts as $u)if(($u['vin']??'')==='est:'.$id&&in_array($u['rol']??'',['estudiante','egresado'],true)){$bound=true;if(($u['estado']??'Activo')==='Activo'&&!empty($u['correo']))return $u['correo'];}
        if($bound)return '';
        return PortalPolicy::find($data['academico']['estudiantes'],'id',$id)['correo']??'';
    }
    private static function index(array $rows,string $field='id'): array
    {
        $index=[];foreach($rows as $row)if(isset($row[$field])&&!array_key_exists((string)$row[$field],$index))$index[(string)$row[$field]]=$row;
        return $index;
    }
    public static function changes(PDO $db,array $old,array $data,int $revision,array $accounts): void
    {
        $version='revision:'.$revision;$a=$data['academico'];
        // Este análisis se ejecuta en cada guardado: las búsquedas por ID deben ser lineales en total.
        $previous=[];foreach(['expedientes','reclamos','empresas','ofertas','postulaciones'] as $module){$rows=in_array($module,['expedientes','reclamos'],true)?($old[$module]??[]):($old['academico'][$module]??[]);$previous[$module]=self::index($rows);}
        $areas=self::index($a['areas'],'cod');$companies=self::index($a['empresas']);$offers=self::index($a['ofertas']);
        foreach(['expedientes','reclamos'] as $module)foreach($data[$module] as $row){
            $before=$previous[$module][(string)$row['id']]??null;if(!$before||($row['deleted']??false))continue;
            $stateChanged=($before['estado']??'')!==($row['estado']??'')||($before['anulado']??false)!==($row['anulado']??false);
            $areaChanged=($before['area']??'')!==($row['area']??'');
            $answered=($before['respuesta']??'')!==($row['respuesta']??'')&&trim($row['respuesta']??'')!=='';
            if(!$stateChanged&&!$areaChanged&&!$answered)continue;
            // El personal puede omitir el aviso de un cambio puntual (p. ej. correcciones internas).
            if(($row['sinAviso']??false)===true)continue;
            $ref=$row['numero']??$row['codigo'];$state=($row['anulado']??false)?'Anulado':$row['estado'];
            $area=$areas[(string)($row['area']??'')]??null;
            $areaName=$area['nombre']??($row['area']??'');if($areaName==='')$areaName='Sin área asignada';
            $body="Referencia: $ref\nEstado: $state\n".($areaChanged?'Área de atención: '.$areaName."\n":'');
            self::emit($db,$module,$row,'seguimiento',$version,[$row['correo']],$ref,'Actualización de su solicitud '.$ref,
                $body.($answered?"Respuesta institucional:\n{$row['respuesta']}\n":'')."Consulte el seguimiento en el servicio correspondiente.\n");
            if($areaChanged&&!empty($area['correo'])&&strcasecmp($area['correo'],$row['correo'])!==0)self::emit($db,$module,$row,'seguimiento',$version,[$area['correo']],$ref,'Solicitud derivada '.$ref,$body."Ingrese a la intranet para revisar los documentos y la información privada.\n");
        }
        foreach($a['empresas'] as $row){
            $before=$previous['empresas'][(string)$row['id']]??null;
            if($row['deleted']??false)continue;
            if(!$before){
                self::received($db,'empresas',$row,$data);
                continue;
            }
            if(($row['validada']??false)===($before['validada']??false)&&($row['estadoVal']??'Pendiente')===($before['estadoVal']??'Pendiente'))continue;
            $state=($row['validada']??false)?'Aprobada':($row['estadoVal']??'Pendiente');
            self::emit($db,'empresas',$row,'validacion',$version,[$row['correo']],'BOL-EMP-'.$row['id'],'Validación de empresa: '.$state,
                "Empresa: {$row['nom']}\nEstado: $state\n".(!empty($row['motivoRech'])?"Motivo: {$row['motivoRech']}\n":'')."Consulte su registro en Bolsa Laboral o con el responsable institucional. Para gestionar ofertas necesita una cuenta habilitada. No comparta su contraseña.\n");
        }
        foreach($a['ofertas'] as $row){
            $before=$previous['ofertas'][(string)$row['id']]??null;
            if(($row['deleted']??false)||($before&&($row['estado']??'')===($before['estado']??'')))continue;
            $company=$companies[(string)$row['emp']]??null;
            $to=[$company['correo']??''];if(($row['estado']??'')==='Por validar')$to[]=$data['config']['bolsa']['correo']??'';
            if(in_array($row['estado']??'',['Cerrada','Rechazada'],true))foreach($a['postulaciones'] as $post)if(!($post['deleted']??false)&&(string)$post['of']===(string)$row['id'])$to[]=self::student($data,$post['est'],$accounts);
            self::emit($db,'ofertas',$row,'estado',$version,$to,'BOL-OF-'.$row['id'],'Oferta laboral: '.$row['estado'],
                "Puesto: {$row['puesto']}\nEstado de la oferta: {$row['estado']}\nFecha límite: {$row['limite']}\nReferencia: BOL-OF-{$row['id']}\nConsulte los detalles y las observaciones en Bolsa Laboral.\n");
        }
        foreach($a['postulaciones'] as $row){
            $before=$previous['postulaciones'][(string)$row['id']]??null;
            if(($row['deleted']??false)||($before&&($row['estado']??'')===($before['estado']??'')))continue;
            $offer=$offers[(string)$row['of']]??null;$company=$companies[(string)($offer['emp']??'')]??null;
            $to=[self::student($data,$row['est'],$accounts),$company['correo']??''];
            if(!$before)$to[]=$data['config']['bolsa']['correo']??'';
            self::emit($db,'postulaciones',$row,$before?'estado':'registro',$version,$to,'BOL-POST-'.$row['id'],$before?'Estado de postulación: '.$row['estado']:'Postulación registrada',
                'Puesto: '.($offer['puesto']??'Oferta laboral')."\nReferencia: BOL-POST-{$row['id']}\nEstado: {$row['estado']}\nIngrese a Bolsa Laboral para consultar su postulación o revisar candidatos según sus permisos. No se adjuntan currículos por correo.\n");
        }
    }
    public static function identity(string $module,array $row): string
    {
        $keys=match($module){
            'expedientes'=>['id','numero','cargoCod'], 'reclamos'=>['id','codigo','cargoCod'],
            'empresas'=>['id','ruc','fechaReg'], 'ofertas'=>['id','emp','fecha'],
            'postulaciones'=>['id','of','est','fecha'], default=>['id']};
        return hash('sha256',$module.'|'.json_encode(array_map(fn($key)=>(string)($row[$key]??''),$keys),JSON_THROW_ON_ERROR));
    }
    public static function exists(array $data,array $mail): bool
    {
        $module=$mail['source_type']??'expedientes';$id=($mail['source_id']??'')?:($mail['record_id']??'');
        if(!in_array($module,['expedientes','reclamos','empresas','ofertas','postulaciones'],true))return false;
        $rows=in_array($module,['expedientes','reclamos'],true)?($data[$module]??[]):($data['academico'][$module]??[]);
        $row=PortalPolicy::find($rows,'id',$id);if($row===null||($row['deleted']??false))return false;
        if(!empty($mail['source_key']))return hash_equals($mail['source_key'],self::identity($module,$row));
        // Las filas previas al esquema 7 no tienen huella; conservar su referencia original.
        if($module==='expedientes'&&empty($mail['source_id'])&&isset($mail['reference'])&&$mail['reference']!==$row['numero'])return false;
        return true;
    }
}
