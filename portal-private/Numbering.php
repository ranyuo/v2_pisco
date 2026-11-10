<?php
declare(strict_types=1);
final class PortalNumbering
{
    public static function last(array $data,string $year): int
    {
        $last=(int)($data['config']['contadores']['MPV'][$year]??0);
        foreach($data['expedientes']??[] as $row)if(preg_match('/-'.preg_quote($year,'/').'-(\d{1,9})$/D',(string)($row['numero']??''),$m))$last=max($last,(int)$m[1]);
        return $last;
    }
    public static function validate(array $old,array $new): void
    {
        $c=$new['config']['mpv'];
        if(!is_string($c['prefijo']??null)||!preg_match('/^[A-Z0-9][A-Z0-9-]{0,39}$/D',$c['prefijo']))throw new PortalError(422,'Código de expediente no válido: usa hasta 40 letras mayúsculas, números o guiones.');
        $digits=$c['digitos']??6;
        if(!is_int($digits)||$digits<1||$digits>9)throw new PortalError(422,'La cantidad de dígitos debe estar entre 1 y 9.');
        $before=$old['config']['contadores']['MPV']??[];$after=$new['config']['contadores']['MPV']??[];
        if(!is_array($after))throw new PortalError(422,'Correlativo no válido.');
        $year=date('Y');
        foreach(array_unique([...array_keys($before),...array_keys($after)]) as $y){
            $value=$after[$y]??0;$previous=$before[$y]??0;
            if(!is_int($value)||$value<0||$value>999999999)throw new PortalError(422,'El siguiente correlativo debe estar entre 1 y 999999999.');
            if($value!==$previous&&((string)$y!==$year||$value<self::last($old,$year)))throw new PortalError(422,'No puedes retroceder el correlativo ni modificar la secuencia de otros años.');
        }
    }
    public static function next(array &$data,string $year): string
    {
        $c=$data['config']['mpv'];$next=self::last($data,$year)+1;
        if($next>999999999)throw new PortalError(422,'Se alcanzó el límite del correlativo anual.');
        $data['config']['contadores']['MPV'][$year]=$next;
        return sprintf('%s-%s-%0*d',$c['prefijo'],$year,$c['digitos']??6,$next);
    }
}
