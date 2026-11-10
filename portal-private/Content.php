<?php
declare(strict_types=1);

/** Correcciones conocidas del catálogo TUPA; conserva el resto del catálogo y los datos operativos. */
final class PortalContent
{
    public static function forJson(array $payload): array
    {
        if (isset($payload['data']['academico'])) {
            $payload['data']['academico']['publicados'] = (object)($payload['data']['academico']['publicados'] ?? []);
        }
        return $payload;
    }

    public static function normalize(array $data): array
    {
        // Valores que el navegador espera en la configuración: se completan en el servidor para que ningún perfil
        // envíe cambios de configuración por el solo hecho de abrir el panel.
        if(isset($data['config']['mpv'])&&is_array($data['config']['mpv'])&&!isset($data['config']['mpv']['digitos']))$data['config']['mpv']['digitos']=6;
        // Distrito y región de la institución (instalaciones anteriores): se toman de las dos últimas partes de la dirección.
        if(isset($data['config']['inst'])&&is_array($data['config']['inst'])&&!isset($data['config']['inst']['region'])){
            $parts=array_values(array_filter(array_map('trim',explode(',',(string)($data['config']['inst']['direccion']??''))),'strlen'));
            $data['config']['inst']['region']=count($parts)>=2?$parts[count($parts)-1]:'';
            $data['config']['inst']['distrito']=count($parts)>=3?$parts[count($parts)-2]:'';
        }
        // «Impacto institucional» era Impacto con los colores del portal; desde que todas las estructuras usan esos colores es la misma.
        if(($data['config']['diseno']??null)==='impacto-flv')$data['config']['diseno']='impacto';
        if(isset($data['config']['disenoColores']['impacto-flv'])&&is_array($data['config']['disenoColores'])){
            if(empty($data['config']['disenoColores']['impacto']))$data['config']['disenoColores']['impacto']=$data['config']['disenoColores']['impacto-flv'];
            unset($data['config']['disenoColores']['impacto-flv']);
        }
        if(($data['__v']??0)<14){
            $data['academico']['perms']['acad']['config']=2;
            $data['academico']['perms']['dir']['config']=1;
            $data['__v']=14;
        }
        foreach ($data['tupa'] ?? [] as $i => $row) {
            $categories = ['6.- CONSTANCIA Y CERTIFICADOS' => '6.- CONSTANCIAS Y CERTIFICADOS',
                '12.-ALQUILERES' => '12.- ALQUILERES'];
            if (isset($categories[$row['categoria'] ?? ''])) {
                $data['tupa'][$i]['categoria'] = $categories[$row['categoria']];
            }
            $known = ['4.1' => ['4.1 ATRÍCULA REGULAR', '4.1 MATRÍCULA REGULAR'],
                '10.6' => ['10.6 CURSO DE OFIRMÁTICA Y/O EXCEL (PRESENCIAL) - MES 3',
                    '10.6 CURSO DE OFIMÁTICA Y/O EXCEL (PRESENCIAL) - MES 3']];
            $fix = $known[(string)($row['codigo'] ?? '')] ?? null;
            if ($fix && ($row['denominacion'] ?? '') === $fix[0]) {
                $data['tupa'][$i]['denominacion'] = $fix[1];
            }
        }
        return self::fitLimits($data);
    }

    /** Recorta los textos cargados que superan el límite del formulario; si no, el registro no se puede volver a guardar. */
    private static function fitLimits(array $data): array
    {
        foreach (PortalPolicy::defaults()['specs'] as $spec) {
            $key = $spec['collection'] ?? '';
            if (!isset($data[$key]) || !is_array($data[$key]) || !array_is_list($data[$key])) continue;
            foreach ($spec['fields'] as $field) {
                $max = $field['max'] ?? null;
                if (!is_int($max) || !in_array($field['type'] ?? 'text', ['text', 'textarea'], true)) continue;
                foreach ($data[$key] as $i => $row) {
                    $value = is_array($row) ? ($row[$field['name']] ?? null) : null;
                    if (!is_string($value) || str_contains($value, '<') || preg_match_all('/./us', $value) <= $max) continue;
                    if ($key === 'personas' && $field['name'] === 'titulo') $value = preg_replace('/\bMag\./u', 'Mg.', $value);
                    $value = self::cut($value, $max);
                    if (!empty($field['unique']) && in_array(strtolower(trim($value)), array_map(fn($other) => strtolower(trim((string)($other[$field['name']] ?? ''))), $data[$key]), true)) continue;
                    $data[$key][$i][$field['name']] = $value;
                }
            }
        }
        if(isset($data['academico'], $data['certificados'])&&class_exists(AcademicDocuments::class)){
            AcademicDocuments::sync($data);
            foreach(['certs'=>'cert','titulos'=>'tit'] as $key=>$prefix)foreach($data['academico'][$key] as &$row){
                $doc=PortalPolicy::find($data['certificados'],'ref','ix:'.$prefix.':'.$row['id']);if(!$doc)continue;
                $row+=['institucion'=>$doc['institucion']??'','estadoDoc'=>$doc['estado']??'Válido'];
                if($key==='certs')$row+=['horasDoc'=>$doc['horas']??'','tipoHoras'=>$doc['tipoHoras']??'Académicas'];
                else $row+=['denominacion'=>$doc['tipo'],'nivel'=>$doc['nivel']??'Superior tecnológico','pais'=>$doc['pais']??'Perú','region'=>$doc['region']??($data['config']['inst']['region']??'')];
            }unset($row);
        }
        return $data;
    }
}
