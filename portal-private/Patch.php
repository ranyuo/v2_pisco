<?php
declare(strict_types=1);
final class PortalPatch
{
    public static function apply(array $visible,mixed $patch): array
    {
        if(!is_array($patch)||count($patch)>300)throw new PortalError(422,'Cambios no válidos.');$out=$visible;$seen=[];
        foreach($patch as $entry){
            if(!is_array($entry)||!is_array($entry['path']??null)||!in_array(count($entry['path']),[1,2],true))throw new PortalError(422,'Ruta de cambios no válida.');
            $path=$entry['path'];foreach($path as $key)if(!is_string($key)||strlen($key)>100)throw new PortalError(422,'Ruta no válida.');
            if(count($path)===2&&$path[0]!=='academico')throw new PortalError(422,'Ruta anidada no permitida.');
            if(!array_key_exists($path[0],$visible)||(count($path)===2&&!array_key_exists($path[1],$visible['academico'])))throw new PortalError(422,'Colección no disponible.');
            $name=implode('.',$path);if(isset($seen[$name]))throw new PortalError(422,'Colección repetida.');$seen[$name]=true;
            $target=&$out[$path[0]];if(count($path)===2)$target=&$target[$path[1]];
            $kind=$entry['kind']??'';
            if($kind==='value'){
                if(!array_key_exists('before',$entry)||!array_key_exists('after',$entry))throw new PortalError(422,'Cambio incompleto.');
                if(!PortalPolicy::equal($target,$entry['before']))throw new PortalError(409,'Otra persona modificó '.$name.'. Recarga antes de continuar.');$target=$entry['after'];
            }elseif($kind==='rows'){
                if(!is_array($target)||!array_is_list($target)||!is_array($entry['changes']??null)||count($entry['changes'])>10000)throw new PortalError(422,'Registros no válidos.');
                $map=[];foreach($target as $row){if(!is_array($row))throw new PortalError(422,'Registro no válido.');$map[PortalPolicy::key($name,$row)]=$row;}$ids=[];
                foreach($entry['changes'] as $change){if(!is_array($change)||!array_key_exists('before',$change)||!array_key_exists('after',$change)||!is_string($change['key']??null)||isset($ids[$change['key']]))throw new PortalError(422,'Cambio de registro no válido.');
                    $id=$change['key'];$ids[$id]=true;$old=$change['before'];$new=$change['after'];
                    if(($old!==null&&(!is_array($old)||PortalPolicy::key($name,$old)!==$id))||($new!==null&&(!is_array($new)||PortalPolicy::key($name,$new)!==$id)))throw new PortalError(422,'Identificador de registro no válido.');
                    if(!PortalPolicy::equal($map[$id]??null,$old))throw new PortalError(409,'Otra persona modificó el registro '.$id.'. Recarga antes de continuar.');
                    if($new===null)unset($map[$id]);else $map[$id]=$new;
                }$target=array_values($map);
            }elseif($kind==='object'){
                if(!is_array($target)||!is_array($entry['changes']??null)||count($entry['changes'])>1000)throw new PortalError(422,'Configuración no válida.');$ids=[];
                foreach($entry['changes'] as $change){$key=$change['key']??null;if(!is_string($key)||isset($ids[$key])||!array_key_exists('before',$change)||!array_key_exists('after',$change))throw new PortalError(422,'Parámetro no válido.');$ids[$key]=true;
                    if(!PortalPolicy::equal($target[$key]??null,$change['before']))throw new PortalError(409,'Otra persona modificó '.$name.'.'.$key.'. Recarga la página.');
                    if($change['after']===null&&($change['remove']??false))unset($target[$key]);else $target[$key]=$change['after'];
                }
            }else throw new PortalError(422,'Tipo de cambio no válido.');unset($target);
        }return $out;
    }
}
