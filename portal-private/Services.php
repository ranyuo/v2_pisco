<?php
declare(strict_types=1);
final class PortalServices
{
    public static function apply(array $old,array &$new,array $user): void
    {
        $immutable=[
            'mensajes'=>['id','fecha','nombres','documento','correo','telefono','asunto','programa','mensaje'],
            'reclamos'=>['id','fecha','codigo','cargoCod','tipo','nombres','nombresP','apellidos','tipoDoc','numDoc','correo','telefono','condicion','programaId','fechaHecho','areaHecho','descripcion','pedido','adjunto','plazoDias','vence','responsable'],
            'expedientes'=>['id','fecha','numero','numDocumento','cargoCod','nombres','nombresP','apellidos','tipoPersona','tipoDoc','numDoc','correo','telefono','direccion','tipoTramite','docRef','asunto','folios','observaciones','areaDestino','archivos','archivo','fechaRecepcion','enHorario','usuarioRegistro','canal'],
        ];
        $states=['mensajes'=>['Nuevo','Leído','Atendido','Respondido','Archivado'],'reclamos'=>['Recibido','Derivado','En atención','Atendido','Anulado'],'expedientes'=>['Recibido','Derivado','En proceso','En evaluación','Observado','Atendido','Respondido','Cerrado','Archivado','Anulado']];
        foreach($immutable as $collection=>$fields)foreach($new[$collection] as &$r){$before=PortalPolicy::find($old[$collection],'id',$r['id']??null);if(PortalPolicy::equal($before,$r))continue;
            if(!$before)throw new PortalError(422,'Los nuevos registros de '.$collection.' se reciben mediante su formulario de servidor.');
            foreach($fields as $field)if(!PortalPolicy::equal($before[$field]??null,$r[$field]??null))throw new PortalError(422,'El registro original de '.$collection.' es de solo lectura: '.$field.'.');
            if(($before['anulado']??false)){foreach(['anulado','estado','area','respuesta'] as $field)if(!PortalPolicy::equal($before[$field]??null,$r[$field]??null))throw new PortalError(422,'El registro está anulado y no admite cambios de estado, derivación ni respuesta.');}
            if(!empty($r['anulado'])&&!($before['anulado']??false)&&isset($states[$collection])&&in_array('Anulado',$states[$collection],true))$r['estado']='Anulado';
            if(!in_array($r['estado']??'',$states[$collection],true))throw new PortalError(422,'Estado no válido.');
            if((!empty($r['anulado'])&&!($before['anulado']??false))||(!empty($r['deleted'])&&!($before['deleted']??false))){if($user['rol']!=='admin')throw new PortalError(403,'Solo el administrador puede anular o eliminar registros.');if(!empty($r['anulado'])&&strlen(trim($r['motivoAnulacion']??''))<5)throw new PortalError(422,'Registra el motivo de anulación.');$r['anuladoPor']=$user['usuario'];}
            if($collection==='reclamos'&&($r['estado']??'')==='Atendido'&&strlen(trim($r['respuesta']??''))<10)throw new PortalError(422,'Registra una respuesta institucional de al menos diez caracteres.');
            if(!empty($r['area'])&&!PortalPolicy::find($new['academico']['areas'],'cod',$r['area']))throw new PortalError(422,'El área de derivación no existe.');
            $provided=$r['historial']??[];$r['historial']=$before['historial']??[];$notes=[];
            foreach($provided as $entry)if(is_array($entry)&&!in_array($entry,$r['historial'],true)&&!empty($entry['nota']))$notes[]=substr((string)$entry['nota'],0,5000);
            $changed=$before['estado']!==$r['estado']||($before['area']??'')!==($r['area']??'')||($before['respuesta']??'')!==($r['respuesta']??'')||($before['anulado']??false)!==($r['anulado']??false);
            if($changed||$notes){$note=implode(' · ',$notes);if($collection==='expedientes'&&in_array($r['estado'],['Observado','Atendido'],true)&&$note==='')throw new PortalError(422,'Indica la observación del expediente.');$r['historial'][]=['fecha'=>date(DATE_ATOM),'usuario'=>$user['usuario'],'estado'=>$r['estado'],'nota'=>$note?:'Actualización institucional registrada en el servidor.'];}
            if(($before['respuesta']??'')!==($r['respuesta']??'')){$r['atendidoPor']=$user['usuario'];$r['atendidoEn']=date(DATE_ATOM);}
            $oldNotes=$before['notas']??[];$newNotes=$r['notas']??[];$r['notas']=$oldNotes;foreach($newNotes as $note)if(is_array($note)&&!in_array($note,$oldNotes,true)&&!empty($note['texto']))$r['notas'][]=['fecha'=>date(DATE_ATOM),'usuario'=>$user['usuario'],'texto'=>substr((string)$note['texto'],0,5000)];
            if($collection!=='mensajes'){$r['notifInst']='Ver panel';$r['notifUser']='Ver panel';}
        }unset($r);
        foreach(['mensajes','reclamos','expedientes'] as $collection)if($user['rol']!=='admin')foreach($old[$collection] as $r)if(!PortalPolicy::find($new[$collection],'id',$r['id']))throw new PortalError(403,'No puedes eliminar registros originales.');
        foreach(['inst','redes','seo','whatsapp','limites','mpv','lr','bolsa','contadores'] as $key)if(isset($old['config'][$key])&&(!isset($new['config'][$key])||!is_array($new['config'][$key])))throw new PortalError(422,'Configuración incompleta: '.$key.'.');
        foreach([[$new['config']['lr']['correo']??'','Reclamos'],[$new['config']['correoReclamos']??'','Reclamos'],[$new['config']['bolsa']['correo']??'','Bolsa Laboral']] as [$email,$label])if(!is_string($email)||($email!==''&&(strlen($email)>254||!filter_var($email,FILTER_VALIDATE_EMAIL))))throw new PortalError(422,'Correo receptor no válido: '.$label.'.');
        PortalNumbering::validate($old,$new);
        if(!PortalPolicy::equal($old['config']['mpv'],$new['config']['mpv'])){
            $email=$new['config']['mpv']['correo']??null;
            if(!is_string($email)||strlen($email)>254||!filter_var($email,FILTER_VALIDATE_EMAIL))throw new PortalError(422,'Indica un correo receptor válido para Mesa de Partes.');
            $c=$new['config']['mpv'];foreach(['horaIni','horaFin'] as $key)if(!preg_match('/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/',(string)($c[$key]??'')))throw new PortalError(422,'Hora de atención no válida.');
            if($c['horaFin']<=$c['horaIni']||($c['maxMB']??0)<1||$c['maxMB']>40||($c['maxArchivos']??0)<1||$c['maxArchivos']>5)throw new PortalError(422,'Horario o límites de adjuntos no válidos.');
            if(!is_array($c['formatos']??null)||!$c['formatos']||array_diff($c['formatos'],['pdf','doc','docx','xls','xlsx','jpg','jpeg','png']))throw new PortalError(422,'Formatos de Mesa de Partes no válidos.');
            foreach($c['feriados']??[] as $date){$v=is_string($date)?DateTimeImmutable::createFromFormat('!Y-m-d',$date):false;if(!$v||$v->format('Y-m-d')!==$date)throw new PortalError(422,'Feriado no válido.');}
        }
        if(!PortalPolicy::equal($old['config']['lr'],$new['config']['lr']))foreach(['plazoQueja','plazoReclamo'] as $key)if(!is_numeric($new['config']['lr'][$key]??null)||$new['config']['lr'][$key]<1||$new['config']['lr'][$key]>30)throw new PortalError(422,'El plazo debe estar entre uno y treinta días hábiles.');
    }
}
