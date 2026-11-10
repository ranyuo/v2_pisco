<?php
declare(strict_types=1);
final class PortalAcademic
{
    public const DAYS = ['Lun','Mar','Mié','Jue','Vie','Sáb'];
    public const CYCLES = ['I','II','III','IV','V','VI'];
    public static function validPeriod(mixed $value): bool
    {return is_string($value)&&(bool)preg_match('/^20[0-9]{2}-(?:I|II)$/D',$value);}
    public static function validateGroup(array $row): void
    {
        if(!in_array($row['ciclo']??null,self::CYCLES,true))throw new PortalError(422,'El ciclo debe estar entre I y VI.');
        if(!in_array($row['sec']??null,['A','B'],true))throw new PortalError(422,'La sección debe ser A o B.');
        if(!in_array($row['turno']??null,['Mañana','Tarde'],true))throw new PortalError(422,'El turno debe ser Mañana o Tarde.');
    }
    public static function validate(array $old,array &$new): void
    {
        if(!preg_match('/^20[0-9]{2}-(?:I|II)$/D',(string)($new['academico']['cfg']['periodo']??'')))throw new PortalError(422,'El periodo académico debe tener el formato 2026-II.');
        $contracts=json_decode(file_get_contents(__DIR__.'/contracts/academic.json'),true,flags:JSON_THROW_ON_ERROR);$a=&$new['academico'];$o=$old['academico'];
        // Las colecciones editables necesitan identidades únicas incluso para el administrador.
        foreach([...array_keys($contracts),'sesiones'] as $key){
            if($key==='usuarios')continue;
            if(!is_array($a[$key]??null)||!array_is_list($a[$key]))throw new PortalError(422,'Catálogo académico no válido: '.$key.'.');
            $ids=[];foreach($a[$key] as &$row){
                if(!is_array($row)||!isset($row['id'])||(!is_int($row['id'])&&!is_string($row['id']))||filter_var($row['id'],FILTER_VALIDATE_INT)===false||(int)$row['id']<1)throw new PortalError(422,'Identificador académico no válido en '.$key.'.');
                $id=(int)$row['id'];if(isset($ids[$id]))throw new PortalError(422,'Identificador académico duplicado en '.$key.'.');$ids[$id]=true;$row['id']=$id;
            }unset($row);
        }
        foreach($contracts as $key=>$spec){if($key==='usuarios')continue;
            if(!is_array($a[$key]??null)||!array_is_list($a[$key]))throw new PortalError(422,'Catálogo académico no válido: '.$key.'.');
            foreach($a[$key] as &$row){if(!is_array($row))throw new PortalError(422,'Registro académico no válido.');$prior=PortalPolicy::find($o[$key]??[],'id',$row['id']??null);if(PortalPolicy::equal($prior,$row))continue;
                if(!isset($row['id'])||(!is_int($row['id'])&&!is_string($row['id']))||filter_var($row['id'],FILTER_VALIDATE_INT)===false||(int)$row['id']<1)throw new PortalError(422,'Identificador académico no válido.');$row['id']=(int)$row['id'];
                foreach(['prog','est','mod','emp'] as $field)if(array_key_exists($field,$row)&&$row[$field]!==''&&$row[$field]!==null){if(filter_var($row[$field],FILTER_VALIDATE_INT)===false)throw new PortalError(422,'Vínculo académico no válido.');$row[$field]=(int)$row[$field];}
                // Se indica el registro: en una importación de cientos de filas el mensaje genérico no permite ubicarlo.
                $label=$row['dni']??$row['cod']??$row['num']??$row['nom']??$row['nombre']??null;$where=' (registro '.(is_scalar($label)?preg_replace('/^(.{0,60}).*$/su','$1',(string)$label):'id '.$row['id']).')';
                foreach($spec['fields'] as $f){$v=$row[$f['name']]??null;$empty=$v===null||$v===''||(is_array($v)&&$v===[]);
                    if($f['required']&&$empty&&(!$prior||!empty($prior[$f['name']])))throw new PortalError(422,'Completa '.$key.'.'.$f['name'].$where.'.');if($empty)continue;
                    if(in_array($f['type'],['text','textarea','email','date','time'],true)&&!is_string($v))throw new PortalError(422,'Tipo de dato no válido en '.$key.'.'.$f['name'].$where.'.');
                    if($f['type']==='select'&&!is_string($v)&&!is_int($v))throw new PortalError(422,'Selección no válida en '.$key.'.'.$f['name'].$where.'.');
                    if($f['type']==='bool'&&!is_bool($v))throw new PortalError(422,'La casilla '.$key.'.'.$f['name'].' no es válida.');
                    if($f['type']==='number'&&(!is_numeric($v)||($f['min']!==null&&$v<$f['min'])||($f['max']!==null&&$v>$f['max'])))throw new PortalError(422,'Número fuera del rango permitido en '.$key.'.'.$f['name'].$where.'.');
                    if($f['type']==='email'&&(!is_string($v)||!filter_var($v,FILTER_VALIDATE_EMAIL)))throw new PortalError(422,'Correo académico no válido'.$where.': '.preg_replace('/^(.{0,80}).*$/su','$1',(string)$v).'.');
                    if($f['type']==='date'){$date=is_string($v)?DateTimeImmutable::createFromFormat('!Y-m-d',$v):false;if(!$date||$date->format('Y-m-d')!==$v)throw new PortalError(422,'Fecha académica no válida'.$where.'.');}
                    if($f['type']==='multi'&&!is_array($v))throw new PortalError(422,'Selección múltiple no válida.');
                    if($f['type']==='time'&&(!is_string($v)||!preg_match('/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/',$v)))throw new PortalError(422,'Hora no válida.');
                    if($f['unique'])foreach($a[$key] as $other)if(($other['id']??null)!==$row['id']&&isset($other[$f['name']])&&PortalRules::normal((string)$other[$f['name']])===PortalRules::normal((string)$v))throw new PortalError(422,'Valor duplicado en '.$key.'.'.$f['name'].$where.'.');
                }
                $refs=match($key){'uds','ambientes','modulos','estudiantes'=>['prog'=>'programas'],'certs'=>['est'=>'estudiantes','mod'=>'modulos'],'notas','titulos'=>['est'=>'estudiantes'],'ofertas'=>['emp'=>'empresas','prog'=>'programas'],default=>[]};
                foreach($refs as $field=>$target)if(!empty($row[$field])&&!PortalPolicy::find($a[$target],'id',$row[$field]))throw new PortalError(422,'La referencia académica '.$target.' no existe.');
                if(in_array($key,['estudiantes','uds'],true)&&!in_array($row['ciclo']??null,self::CYCLES,true))throw new PortalError(422,'El ciclo debe estar entre I y VI.');
                if($key==='estudiantes'){
                    self::validateGroup($row);
                    if(!self::validPeriod($row['periodo']??null))throw new PortalError(422,'El periodo de ingreso debe tener el formato 2026-I o 2026-II.');
                }
                if($key==='uds'&&!empty($row['mod'])){
                    $module=PortalPolicy::find($a['modulos'],'id',$row['mod']);
                    if(!$module||$module['prog']!==$row['prog'])throw new PortalError(422,'La unidad didáctica y su módulo deben pertenecer al mismo programa.');
                }
                if(isset($row['tipoHoras'])&&!in_array($row['tipoHoras'],['','Académicas','Lectivas'],true))throw new PortalError(422,'Tipo de horas no válido.');
                if(isset($row['estadoDoc'])&&!in_array($row['estadoDoc'],['Válido','Anulado'],true))throw new PortalError(422,'Estado documental no válido.');
                if($key==='empresas'){
                    $ruc=(string)($row['ruc']??'');$weights=[5,4,3,2,7,6,5,4,3,2];$sum=0;if(!preg_match('/^[0-9]{11}$/',$ruc))throw new PortalError(422,'El RUC debe tener once dígitos.');foreach($weights as $i=>$weight)$sum+=(int)$ruc[$i]*$weight;$digit=11-$sum%11;$digit=$digit===10?0:($digit===11?1:$digit);if((int)$ruc[10]!==$digit)throw new PortalError(422,'El dígito verificador del RUC no coincide.');
                }
                if($key==='docentes'){
                    if(!array_is_list($row['dias'])||array_diff($row['dias'],self::DAYS))throw new PortalError(422,'Días de disponibilidad no válidos.');
                    foreach($a['docentes'] as $other)if($other['id']!==$row['id']&&(string)($other['per']??'')===(string)($row['per']??''))throw new PortalError(422,'El docente ya tiene una carga registrada.');
                    if(!empty($row['per'])&&!PortalPolicy::find($new['personas'],'id',$row['per']))throw new PortalError(422,'La persona del docente no existe.');
                    if(($row['desde']??'')>=($row['hasta']??''))throw new PortalError(422,'La hora final del docente debe ser posterior a la inicial.');
                    foreach($row['uds']??[] as $id)if(!PortalPolicy::find($a['uds'],'id',$id))throw new PortalError(422,'Unidad didáctica asignada no válida.');
                }
                if($key==='modulos')foreach($a['modulos'] as $other)if($other['id']!==$row['id']&&$other['prog']===$row['prog']&&PortalRules::normal($other['cod'])===PortalRules::normal($row['cod']))throw new PortalError(422,'El código del módulo ya existe en ese programa.');
                if($key==='tramites'&&!PortalPolicy::find($a['areas'],'cod',$row['area']))throw new PortalError(422,'El área responsable del trámite no existe.');
            }unset($row);
        }
        foreach(['perfilesLab'=>'est','perfilesDoc'=>'doc'] as $collection=>$field){
            $seen=[];foreach($a[$collection] as $row){$id=$row[$field]??null;
                if(!is_int($id)||$id<1||isset($seen[$id]))throw new PortalError(422,'Perfil académico duplicado o sin vínculo válido.');$seen[$id]=true;
                $target=$field==='est'?'estudiantes':'docentes';if(!PortalPolicy::find($a[$target],'id',$id))throw new PortalError(422,'El titular del perfil no existe.');
            }
        }
        foreach($a['uds'] as $unit)if(!empty($unit['mod'])){$m=PortalPolicy::find($a['modulos'],'id',$unit['mod']);if(!$m||$m['prog']!==$unit['prog'])throw new PortalError(422,'El módulo tiene unidades relacionadas de otro programa o fue eliminado.');}
        foreach($o['areas'] as $r)if(!PortalPolicy::find($a['areas'],'id',$r['id'])){
            if(PortalPolicy::find($a['tramites'],'area',$r['cod']))throw new PortalError(422,'El área tiene trámites relacionados.');
            foreach($new['expedientes'] as $exp)if(in_array($r['cod'],[$exp['area']??'',$exp['areaDestino']??''],true))throw new PortalError(422,'El área tiene expedientes relacionados.');
        }
    }
}
