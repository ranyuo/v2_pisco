<?php
declare(strict_types=1);

/** Keeps issued document data independent of mutable academic catalogs. */
final class AcademicDocuments
{
    public static function publicRecord(array $r): array
    {
        return array_intersect_key($r,array_flip(['id','codigo','dni','nombres','programaId','programa','tipo','detalle','fecha','estado','origen','motivo','grupo','institucion','pais','region','nivel','horas','tipoHoras','modulo','resolucion']));
    }
    public static function validate(array $old,array &$new): void
    {
        foreach($new['certificados'] as &$r){
            $prior=PortalPolicy::find($old['certificados'],'id',$r['id']??null);
            if(PortalPolicy::equal($prior,$r)||($r['deleted']??false))continue;
            if(!empty($r['ref'])&&!$prior)throw new PortalError(422,'El vínculo académico se genera desde el módulo de origen.');
            if($prior&&(!empty($prior['ref'])||($prior['grupo']??'')==='documentos')){
                foreach(['id','ref','programaId','codigo','dni','nombres','tipo','detalle','fecha','grupo','institucion','programa','modulo','horas','tipoHoras','nivel','pais','region','resolucion'] as $field)
                    if(!PortalPolicy::equal($prior[$field]??'',$r[$field]??''))throw new PortalError(422,'Los datos emitidos son históricos. Anula el documento y crea una nueva emisión.');
                continue;
            }
            if(!$prior){
                if(!in_array($r['tipo']??'',['Constancia','Certificado'],true))throw new PortalError(422,'Utiliza el módulo de origen para registrar certificaciones modulares o títulos.');
                foreach(['detalle','institucion'] as $key)if(trim((string)($r[$key]??''))==='')throw new PortalError(422,'Completa la denominación y la institución emisora.');
                $r['grupo']='documentos';
            }
            if(isset($r['horas'])&&$r['horas']!==''&&(!is_numeric($r['horas'])||$r['horas']<1||$r['horas']>10000))throw new PortalError(422,'Horas del documento no válidas.');
            if(!empty($r['tipoHoras'])&&!in_array($r['tipoHoras'],['Académicas','Lectivas'],true))throw new PortalError(422,'Tipo de horas no válido.');
            $r['programa']??=PortalPolicy::find($new['programas'],'id',$r['programaId']??'')['nombre']??'';
        }unset($r);
        foreach(['certs'=>['num','fecha','mod','horasDoc','tipoHoras'],'titulos'=>['cod','tit','denominacion','nivel','pais','region','resol']] as $key=>$fields){
            foreach($new['academico'][$key] as $r){$prior=PortalPolicy::find($old['academico'][$key],'id',$r['id']);
                if(!$prior||!PortalPolicy::find($old['certificados'],'ref','ix:'.($key==='certs'?'cert':'tit').':'.$r['id']))continue;
                foreach([...$fields,'est','institucion'] as $field)if(!PortalPolicy::equal($prior[$field]??'',$r[$field]??''))throw new PortalError(422,'El registro ya fue emitido. Anúlalo y registra una nueva emisión.');
            }
        }
    }
    public static function sync(array &$data): void
    {
        $a=$data['academico'];
        foreach(['certs'=>['cert','modular'],'titulos'=>['tit','titulos']] as $key=>[$prefix,$group])foreach($a[$key] as $r){
            $student=PortalPolicy::find($a['estudiantes'],'id',$r['est']);if(!$student)continue;
            foreach($data['certificados'] as &$record){if(($record['ref']??'')!=='ix:'.$prefix.':'.$r['id'])continue;
                if(!isset($record['grupo'])){
                    $program=PortalPolicy::find($a['programas'],'id',$student['prog'])??[];
                    $p=PortalPolicy::find($data['programas'],'id',array_search($student['prog'],$a['progMap']??[],true))??[];
                    $m=$key==='certs'?(PortalPolicy::find($a['modulos'],'id',$r['mod'])??[]):[];
                    $record+=['grupo'=>$group,'programa'=>$program['nombre']??'','institucion'=>$r['institucion']??$data['config']['inst']['nombre'],
                        'pais'=>$r['pais']??'Perú','region'=>$r['region']??($data['config']['inst']['region']??''),'nivel'=>$r['nivel']??'Superior tecnológico',
                        'modulo'=>$m['nombre']??'','horas'=>$r['horasDoc']??$m['horasTotal']??'','tipoHoras'=>$r['tipoHoras']??$m['tipoHoras']??'Académicas','resolucion'=>$r['resol']??''];
                    if($key==='titulos')$record['tipo']=!empty($r['denominacion'])?$r['denominacion']:($p['titulo']??'Título de Profesional Técnico');
                }
                if(isset($r['estadoDoc']))$record['estado']=$r['estadoDoc'];
            }unset($record);
        }
    }
}
