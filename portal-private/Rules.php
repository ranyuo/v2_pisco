<?php
declare(strict_types=1);
final class PortalRules
{
    /** Defensa en el servidor para el HTML guardado: el navegador ya sanea, pero un cliente modificado no pasa por ese filtro. */
    public static function scrub(mixed $value): mixed
    {
        if(is_array($value)){foreach($value as $k=>$v)$value[$k]=self::scrub($v);return $value;}
        if(!is_string($value)||!str_contains($value,'<'))return $value;
        $value=preg_replace('#<(script|style|iframe|frame|frameset|object|embed|applet|svg|math|form|base|meta|link|template|noscript)\b[^>]*>.*?</\1\s*>#isu','',$value)??'';
        $value=preg_replace('#</?(script|style|iframe|frame|frameset|object|embed|applet|svg|math|form|input|button|textarea|select|base|meta|link|template|noscript)\b[^>]*>#iu','',$value)??'';
        $value=preg_replace_callback('#<([a-z][a-z0-9]*)([\s/][^>]*)>#iu',function($m){
            $attrs=preg_replace('#[\s/]+on[a-z]+\s*=\s*("[^"]*"|\'[^\']*\'|[^\s>]*)#iu','',$m[2])??'';
            $attrs=preg_replace('#[\s/]+(srcdoc|formaction|xlink:href)\s*=\s*("[^"]*"|\'[^\']*\'|[^\s>]*)#iu','',$attrs)??'';
            $attrs=preg_replace_callback('#([\s/]+(?:href|src|action|style|background|poster))\s*=\s*("[^"]*"|\'[^\']*\'|[^\s>]*)#iu',function($a){
                $v=html_entity_decode(trim($a[2],'"\''),ENT_QUOTES|ENT_HTML5,'UTF-8');$v=preg_replace('/[\x00-\x20]+/u','',$v)??'';
                return preg_match('/(javascript|vbscript|livescript):|data:(?!image\/(png|jpe?g|webp|gif);)|expression\(/iu',$v)?'':$a[0];
            },$attrs)??'';
            return '<'.$m[1].$attrs.'>';
        },$value)??'';
        return $value;
    }
    public static function normal(string $value): string
    {$value=strtr($value,['Á'=>'A','É'=>'E','Í'=>'I','Ó'=>'O','Ú'=>'U','Ñ'=>'N','á'=>'a','é'=>'e','í'=>'i','ó'=>'o','ú'=>'u','ñ'=>'n','ü'=>'u']);return strtolower(trim(preg_replace('/\s+/u',' ',$value)));}
    public static function safeLink(mixed $value,bool $internal=true): bool
    {
        if(!is_string($value))return false;if($value==='')return true;
        if($internal&&(str_starts_with($value,'#/')||preg_match('/^ext:[A-Za-z0-9_-]+$/D',$value)))return true;
        return (bool)filter_var($value,FILTER_VALIDATE_URL)&&(bool)preg_match('#^https?://#i',$value);
    }
    public static function safeImage(mixed $value): bool
    {
        if(!is_string($value))return false;if($value==='')return true;
        if(str_starts_with($value,'ph:'))return !preg_match('/[<>\x00-\x1f]/',$value);
        if(preg_match('#^data:image/(?:png|jpeg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/]+={0,2}$#D',$value))return true;
        if(preg_match('/["\'<>\x00-\x20]/',$value))return false;
        return (str_starts_with($value,'/')&&!str_starts_with($value,'//'))||(bool)filter_var($value,FILTER_VALIDATE_URL)&&preg_match('#^https?://#',$value);
    }
    public static function structure(mixed $value,int $depth=0): void
    {
        if(!is_array($value))return;if($depth>40)throw new PortalError(422,'El contenido tiene demasiados niveles.');
        foreach($value as $key=>$child){if(in_array($key,['__proto__','prototype','constructor'],true))throw new PortalError(422,'El contenido contiene un campo reservado.');self::structure($child,$depth+1);}
    }
    /** Reject malformed collection shapes before synchronization or file persistence. */
    public static function stateShape(array $before,array $after): void
    {
        foreach($before as $key=>$value){
            if(!is_array($value))continue;
            if(!isset($after[$key])||!is_array($after[$key]))throw new PortalError(422,'Colección no válida: '.$key.'.');
            if(array_is_list($value)&&!array_is_list($after[$key]))throw new PortalError(422,'La colección '.$key.' debe ser una lista.');
            if(array_is_list($value)){
                $ids=[];foreach($after[$key] as $row){
                    if(!is_array($row))throw new PortalError(422,'Registro no válido en '.$key.'.');
                    if($key==='estadisticas')continue;
                    $id=$row['id']??null;
                    if((!is_string($id)&&!is_int($id))||!preg_match('/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/D',(string)$id)||isset($ids[(string)$id]))throw new PortalError(422,'Identificador vacío, no válido o duplicado en '.$key.'.');
                    $ids[(string)$id]=true;
                }
            }
        }
        foreach($before['academico'] as $key=>$value){
            if(!is_array($value))continue;
            $rows=$after['academico'][$key]??null;
            if(!is_array($rows))throw new PortalError(422,'Colección académica no válida: '.$key.'.');
            if(in_array($key,['cfg','seq','perms','publicados','progMap'],true))continue;
            if(!array_is_list($rows))throw new PortalError(422,'El catálogo académico '.$key.' debe ser una lista.');
            foreach($rows as $row)if(!is_array($row))throw new PortalError(422,'Registro académico no válido en '.$key.'.');
        }
    }

    private static function alive(array $rows): array{return array_values(array_filter($rows,fn($r)=>!($r['deleted']??false)));}
    private static function changed(array $before,array $row): bool{return !PortalPolicy::equal(PortalPolicy::find($before,'id',$row['id']??null),$row);}
    private static function date(mixed $v): bool
    {if(!is_string($v))return false;$d=DateTimeImmutable::createFromFormat('!Y-m-d',$v);return $d&&$d->format('Y-m-d')===$v;}
    public static function apply(array $old,array &$new,array $user): void
    {
        self::settings($old,$new);
        foreach($new['noticias']??[] as $news)if(is_array($news)&&!($news['deleted']??false)&&self::changed($old['noticias']??[],$news)&&!empty($news['video'])&&(!is_string($news['video'])||!preg_match('#^https://[^\s<>"]+$#iD',$news['video'])))throw new PortalError(422,'El video de la noticia debe ser un enlace https (YouTube o Vimeo).');
        foreach($new['slides'] as $slide)if(!($slide['deleted']??false)&&self::changed($old['slides'],$slide)){
            if(!self::safeLink($slide['enlace']??''))throw new PortalError(422,'El enlace del carrusel debe ser una ruta interna, ext:id o una URL http/https válida.');
            if(!empty($slide['boton'])&&empty($slide['enlace']))throw new PortalError(422,'Indica el enlace del botón del carrusel.');
            foreach(['modo'=>['','imagen'],'ajuste'=>['','cover','contain'],'enfoque'=>['','center','left','right','top','bottom'],'capa'=>['','suave','fuerte','ninguna'],'realce'=>['','no']] as $key=>$allowed)if(!in_array($slide[$key]??'',$allowed,true))throw new PortalError(422,'Una opción de imagen del carrusel no es válida.');
        }
        foreach($new['programas']??[] as $prog)if(is_array($prog)&&self::changed($old['programas']??[],$prog)&&isset($prog['slug'])&&(!is_string($prog['slug'])||!preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/D',$prog['slug'])))throw new PortalError(422,'El identificador web (slug) del programa solo admite letras minúsculas, números y guiones.');
        if(!PortalPolicy::equal($old['config']['temas']??null,$new['config']['temas']??null)){
            if(!is_array($new['config']['temas']??null))throw new PortalError(422,'Los temas no son válidos.');
            foreach($new['config']['temas'] as $theme){if(!is_array($theme))throw new PortalError(422,'Los temas no son válidos.');foreach(['navy','navy2','blue','gold'] as $c)if(isset($theme[$c])&&(!is_string($theme[$c])||!preg_match('/^#[0-9a-fA-F]{6}$/D',$theme[$c])))throw new PortalError(422,'Los colores del tema deben tener el formato #RRGGBB.');
                foreach(['fh','ff'] as $f)if(isset($theme[$f])&&(!is_string($theme[$f])||!preg_match('/^[A-Za-z0-9 ]{1,40}$/D',$theme[$f])))throw new PortalError(422,'La tipografía del tema no es válida.');}
        }
        foreach($new['estadisticas'] as $row)if(self::changed($old['estadisticas'],$row)){
            if(filter_var($row['anio']??null,FILTER_VALIDATE_INT)===false||$row['anio']<2000||$row['anio']>2100||!PortalPolicy::find($new['programas'],'id',$row['programaId']??null))throw new PortalError(422,'El año y programa de la estadística deben ser válidos.');
            foreach(['postulantes','ingresantes','matriculados','egresados','titulados','becas','creditos'] as $key)if(isset($row[$key])&&(filter_var($row[$key],FILTER_VALIDATE_INT)===false||$row[$key]<0))throw new PortalError(422,'Los indicadores estadísticos deben ser enteros no negativos.');
        }
        foreach(PortalPolicy::definitions()['specs'] as $spec){$collection=$spec['collection'];if($collection==='usuarios')continue;foreach($new[$collection] as &$r){$prior=PortalPolicy::find($old[$collection],'id',$r['id']??null);if(PortalPolicy::equal($prior,$r))continue;
            if(!$prior){$r['creadoPor']=$user['usuario'];$r['creadoEn']=date(DATE_ATOM);}else foreach(['creadoPor','creadoEn'] as $field)if(isset($prior[$field]))$r[$field]=$prior[$field];else unset($r[$field]);
            $r['modPor']=$user['usuario'];$r['modEn']=date(DATE_ATOM);
        }unset($r);}
        $refs=['noticias'=>['categoriaId'=>'categoriasNoticia'],'documentos'=>['tipoId'=>'tiposDocumento'],'jerarquica'=>['personaId'=>'personas'],'egresados'=>['programaId'=>'programas'],'certificados'=>['programaId'=>'programas']];
        foreach($refs as $collection=>$fields)foreach(self::alive($new[$collection]) as $r)if(self::changed($old[$collection],$r))foreach($fields as $field=>$target){if(empty($r[$field]))continue;$linked=PortalPolicy::find($new[$target],'id',$r[$field]);if(!$linked||($linked['deleted']??false))throw new PortalError(422,'La referencia '.$collection.'.'.$field.' no existe o está eliminada.');}
        foreach($new['personas'] as $r)if(!($r['deleted']??false)&&self::changed($old['personas'],$r)){
            if(!empty($r['dni'])&&!preg_match('/^[0-9]{8}$/',(string)$r['dni']))throw new PortalError(422,'El DNI de la persona debe tener ocho dígitos.');
            $cv=$r['cv']??[];if(!is_array($cv))throw new PortalError(422,'CV docente no válido.');
            if(!empty($cv['cvPdf'])&&(($cv['cvPdf']['type']??'')!=='application/pdf'||($cv['cvPdf']['size']??0)>10485760))throw new PortalError(422,'El CV firmado debe ser un PDF de hasta diez MB.');
            foreach($cv['docs']??[] as $file)if(!in_array($file['type']??'',['application/pdf','image/jpeg','image/png'],true)||($file['size']??0)>10485760)throw new PortalError(422,'Los sustentos del CV deben ser PDF, JPG o PNG de hasta diez MB.');
            if(isset($cv['autoriza']['ok'])&&!is_bool($cv['autoriza']['ok']))throw new PortalError(422,'La autorización de publicación debe ser una casilla válida.');
            foreach($r['programas']??[] as $id)if(!PortalPolicy::find($new['programas'],'id',$id))throw new PortalError(422,'Programa de la persona no válido.');
        }
        $directors=array_filter(self::alive($new['jerarquica']),fn($r)=>($r['esDirector']??false)&&($r['estado']??'')==='Publicado');
        if(count($directors)>1&& !PortalPolicy::equal($old['jerarquica'],$new['jerarquica']))throw new PortalError(422,'Solo puede existir un director publicado.');
        foreach(self::alive($new['documentos']) as $r)if(self::changed($old['documentos'],$r)){
            foreach(self::alive($new['documentos']) as $other)if($other['id']!==$r['id']&&self::normal($other['nombre'])===self::normal($r['nombre'])&&($other['tipoId']??'')===($r['tipoId']??'')&&(string)$other['vigencia']===(string)$r['vigencia']&&(string)$other['version']===(string)$r['version'])throw new PortalError(422,'La versión del documento ya existe.');
        }
        foreach($new['documentos'] as &$document)if(($document['refModulo']??'')==='admision'){
            $prior=PortalPolicy::find($old['documentos'],'id',$document['id']);$historical=($document['estado']??'')==='Histórico';
            if($historical&&!empty($prior['archivoRef'])){$document['archivoRef']=$prior['archivoRef'];continue;}
            $source=$historical?$old:$new;foreach($source['admisiones'] as $admission)if(!($admission['deleted']??false)&&!empty($admission['vigente'])&&($admission['estado']??'')==='Publicado'&&!empty($admission['reglamento'])){$document['archivoRef']=$admission['reglamento'];break;}
        }unset($document);
        foreach($new['documentos'] as &$r){if($r['deleted']??false)continue;$r['grupo']=$r['grupo']??preg_replace('/[^a-z0-9]+/','-',self::normal($r['nombre']));if(!self::changed($old['documentos'],$r)||($r['estado']??'')!=='Publicado')continue;$r['fechaPub']=($r['fechaPub']??'')?:date('Y-m-d');$r['publicadoPor']=$user['usuario'];
            foreach($new['documentos'] as &$other)if($other['id']!==$r['id']&&($other['grupo']??'')===$r['grupo']&&($other['estado']??'')==='Publicado')$other['estado']='Histórico';unset($other);
        }unset($r);
        foreach(self::alive($new['tupa']) as $r)if(self::changed($old['tupa'],$r)){
            if(!is_numeric($r['monto']??null)||$r['monto']<0)throw new PortalError(422,'El monto TUPA no puede ser negativo.');
            foreach(self::alive($new['tupa']) as $other)if($other['id']!==$r['id']&&(string)$other['anio']===(string)$r['anio']&&self::normal($other['codigo'])===self::normal($r['codigo']))throw new PortalError(422,'El código TUPA ya existe en ese año.');
        }
        foreach(['admisiones','matriculas','becasPeriodos'] as $collection){$changed=array_filter($new[$collection],fn($r)=>self::changed($old[$collection],$r));$selected=null;
            foreach($changed as $r){if(($r['estado']??'')==='Cerrado'){foreach($new[$collection] as &$row)if($row['id']===$r['id'])$row['vigente']=false;unset($row);continue;}
                if(!empty($r['vigente'])){if(($r['estado']??'')==='Borrador')throw new PortalError(422,'Un proceso en borrador no puede ser vigente.');if(($r['estado']??'')!=='Publicado')continue;if($selected!==null)throw new PortalError(422,'Solo un proceso puede ser vigente.');$selected=$r['id'];}
            }
            if($selected!==null)foreach($new[$collection] as &$r){if($r['id']!==$selected)$r['vigente']=false;}unset($r);
        }
        foreach(self::alive($new['becasPeriodos']) as $r)if(self::changed($old['becasPeriodos'],$r))foreach(self::alive($new['becasPeriodos']) as $other)if($r['id']!==$other['id']&&(string)$r['anio']===(string)$other['anio']&&($r['periodo']??'')===($other['periodo']??''))throw new PortalError(422,'El periodo de becas ya existe.');
        foreach($new['matriculas'] as $r)if(self::changed($old['matriculas'],$r)){$seen=[];foreach($r['items']??[] as $item){if($item['deleted']??false)continue;$key=($item['seccion']??'').'|'.self::normal($item['texto']??'');if(empty($item['texto'])||isset($seen[$key]))throw new PortalError(422,'La matrícula contiene requisitos vacíos o duplicados en una sección.');$seen[$key]=true;}}
        foreach($new['certificados'] as $r)if(self::changed($old['certificados'],$r)){
            if(!preg_match('/^[0-9]{8}$/',(string)($r['dni']??'')))throw new PortalError(422,'El DNI del certificado debe tener ocho dígitos.');
            if(!self::date($r['fecha']??null))throw new PortalError(422,'La fecha del certificado no es válida.');
        }
        foreach($new['paginas'] as &$r){$prior=PortalPolicy::find($old['paginas'],'id',$r['id']);if(!$prior){$r['versiones']=[];continue;}if(!self::changed($old['paginas'],$r))continue;
            $fields=['titulo','contenido','imagen','mensaje','estado'];$edited=false;foreach($fields as $field)if(!PortalPolicy::equal($r[$field]??null,$prior[$field]??null))$edited=true;
            $r['versiones']=$prior['versiones']??[];if($edited)$r['versiones']=array_slice([[...array_intersect_key($prior,array_flip($fields)),'fecha'=>$prior['modEn']??date(DATE_ATOM),'por'=>$prior['modPor']??$user['usuario']],...$r['versiones']],0,10);
        }unset($r);
        // Protege las referencias incluso cuando se usa directamente la API.
        $relations=[...$refs,'becarios'=>['programaId'=>'programas','tipoId'=>'tiposBeca','periodoId'=>'becasPeriodos'],'programas'=>['coordinadorId'=>'personas']];
        foreach($old as $collection=>$rows){if(!is_array($rows)||!array_is_list($rows)||!isset($new[$collection])||!is_array($new[$collection]))continue;
            foreach($rows as $r){if(!is_array($r)||!isset($r['id'])||($r['deleted']??false))continue;$next=PortalPolicy::find($new[$collection],'id',$r['id']);if($next&&!($next['deleted']??false))continue;
                if($collection==='programas'){$pid=$new['academico']['progMap'][$r['id']]??null;if($pid!==null&&PortalPolicy::find($new['academico']['estudiantes'],'prog',$pid))throw new PortalError(422,'El programa tiene alumnos registrados.');}
                if($collection==='personas'){foreach($new['academico']['docentes'] as $teacher)if(($teacher['per']??'')===$r['id']&&PortalPolicy::find($new['academico']['sesiones'],'doc',$teacher['id']))throw new PortalError(422,'La persona tiene clases asignadas.');}
                foreach($relations as $source=>$fields)foreach($fields as $field=>$target)if($target===$collection)foreach(self::alive($new[$source]) as $ref)if(($ref[$field]??null)===$r['id'])throw new PortalError(422,'No se puede eliminar '.$collection.' porque tiene registros relacionados en '.$source.'.');
            }
        }
    }
    private static function settings(array $old,array $new): void
    {
        $changed=fn(string $key)=>!PortalPolicy::equal($old['config'][$key]??null,$new['config'][$key]??null);
        $link=fn(mixed $value,bool $internal=true):bool=>self::safeLink($value,$internal);
        if($changed('home')){
            $home=$new['config']['home']??null;if(!is_array($home))throw new PortalError(422,'La configuración de portada no es válida.');
            foreach(['bloques','accesos','cifras','beneficios'] as $key)if(!is_array($home[$key]??null)||!array_is_list($home[$key]))throw new PortalError(422,'La lista de portada '.$key.' no es válida.');
            $seen=[];foreach($home['bloques'] as $block){if(!is_array($block)||!is_string($block['k']??null)||isset($seen[$block['k']])||!is_bool($block['on']??null))throw new PortalError(422,'La visibilidad y el orden de los bloques deben ser válidos.');$seen[$block['k']]=true;}
            foreach($home['accesos'] as $access){
                if(!is_array($access)||!is_string($access['titulo']??null)||trim($access['titulo'])===''||!is_string($access['enlace']??null)||trim($access['enlace'])==='')throw new PortalError(422,'Cada acceso rápido necesita un título y un enlace.');
                if(!$link($access['enlace']))throw new PortalError(422,'El enlace de acceso rápido debe ser una ruta interna, ext:id o una URL http/https.');
            }
            foreach($home['cifras'] as $figure)if(!is_array($figure)||!is_scalar($figure['corte']??null)||trim((string)$figure['corte'])==='')throw new PortalError(422,'Cada cifra institucional debe indicar su año de corte.');
            foreach($home['cifras'] as $figure)if(!empty($figure['enlace'])&&!$link($figure['enlace']))throw new PortalError(422,'El enlace de una cifra institucional debe ser una ruta interna, ext:id o una URL http/https.');
            if(!in_array($home['programasVista']??'carrusel',['grid','carrusel'],true))throw new PortalError(422,'La vista de los programas de estudio no es válida.');
            if(!in_array($home['noticiasVista']??'',['','tarjetas','carrusel'],true))throw new PortalError(422,'La vista de las noticias no es válida.');
            if(count($home['beneficios'])>8&&!PortalPolicy::equal($old['config']['home']['beneficios']??null,$home['beneficios']))throw new PortalError(422,'La portada admite como máximo ocho beneficios.');
        }
        if($changed('diseno')&&!in_array($new['config']['diseno']??null,['clasico','moderno','universitario','editorial','impacto','impacto-flv','horizonte','campus'],true))throw new PortalError(422,'El diseño del portal no es válido.');
        if($changed('disenoColores')){
            $colors=$new['config']['disenoColores']??null;if(!is_array($colors))throw new PortalError(422,'Los colores del diseño no son válidos.');
            foreach($colors as $design=>$values){
                $fields=['clasico'=>['principal','secundario','acento'],'moderno'=>['principal','secundario','acento'],'universitario'=>['principal','secundario','acento'],'impacto'=>['acento','oscuro','boton','titulos'],'impacto-flv'=>['acento','oscuro','boton','titulos'],'horizonte'=>['primario','acento','fondo'],'campus'=>['primario','oscuro','pie']][$design]??null;
                if($fields===null||!is_array($values))throw new PortalError(422,'Los colores del diseño no son válidos.');
                foreach($values as $field=>$color)if(!in_array($field,$fields,true)||!is_string($color)||!preg_match('/^#[0-9a-f]{6}$/i',$color))throw new PortalError(422,'Cada color del diseño debe tener el formato #RRGGBB.');
            }
        }
        if($changed('popup')){
            $popup=$new['config']['popup']??null;if(!is_array($popup)||!is_bool($popup['activo']??null))throw new PortalError(422,'El comunicado debe tener una casilla de activación válida.');
            foreach(['inicio','fin'] as $key)if(!empty($popup[$key])&&!self::date($popup[$key]))throw new PortalError(422,'La fecha del comunicado no es válida.');
            if(!empty($popup['inicio'])&&!empty($popup['fin'])&&$popup['fin']<$popup['inicio'])throw new PortalError(422,'La fecha final del comunicado debe ser posterior a la inicial.');
            if(!$link($popup['enlace']??''))throw new PortalError(422,'El enlace del comunicado no es válido.');
            if(!empty($popup['imagen'])&&!self::safeImage($popup['imagen']))throw new PortalError(422,'La imagen del comunicado no es válida.');
            if(!in_array($popup['modelo']??'clasico',['','clasico','promocional'],true))throw new PortalError(422,'El modelo de la ventana emergente no es válido.');
            foreach(['etiqueta'=>40,'antetitulo'=>60,'t1'=>40,'t2'=>40,'t3'=>40,'t4'=>40,'d1'=>80,'d2'=>80,'d3'=>80,'d4'=>80,'titulo'=>150,'texto'=>600,'boton'=>60] as $key=>$max)if(isset($popup[$key])&&(!is_string($popup[$key])||preg_match_all('/./su',$popup[$key])>$max))throw new PortalError(422,'Un texto de la ventana emergente es demasiado largo.');
        }
        if($changed('inst')){
            $inst=$new['config']['inst']??[];foreach(['nombre','nombreCorto','direccion','telefono','correo','horario','fechaCreacion'] as $key)if(!is_string($inst[$key]??null)||trim($inst[$key])==='')throw new PortalError(422,'Completa el dato institucional '.$key.'.');
            if(!self::date($inst['fechaCreacion'])||!filter_var($inst['correo'],FILTER_VALIDATE_EMAIL))throw new PortalError(422,'La fecha o el correo institucional no es válido.');
            if(!empty($inst['logo'])&&!self::safeImage($inst['logo']))throw new PortalError(422,'El logotipo institucional no es válido.');
        }
        if($changed('redes'))foreach($new['config']['redes']??[] as $url)if(!$link($url,false))throw new PortalError(422,'Las redes sociales requieren una URL http/https válida.');
        if($changed('whatsapp')){$wa=$new['config']['whatsapp']??[];if(!is_bool($wa['activo']??null)||($wa['activo']&&!preg_match('/^[0-9]{9,13}$/D',(string)($wa['numero']??''))))throw new PortalError(422,'WhatsApp requiere una casilla válida y un número de nueve a trece dígitos.');}
        if($changed('uit')||!PortalPolicy::equal($old['tupaDocs']??null,$new['tupaDocs']??null)){
            foreach($new['config']['uit']??[] as $year=>$value)if(!preg_match('/^[0-9]{4}$/D',(string)$year)||!is_numeric($value)||$value<=0)throw new PortalError(422,'La UIT de cada año debe ser un importe positivo.');
            $year=$new['tupaDocs']['anio']??null;if(!is_scalar($year)||!isset($new['config']['uit'][$year]))throw new PortalError(422,'Registra la UIT del año del TUPA vigente.');
        }
        if(!PortalPolicy::equal($old['licenciamiento']??null,$new['licenciamiento']??null)){
            $license=$new['licenciamiento']??[];if(!in_array($license['estado']??null,['No iniciado','En proceso','Licenciado','Denegado'],true))throw new PortalError(422,'Estado de licenciamiento no válido.');
            if($license['estado']==='Licenciado'&&(!is_string($license['resolucion']??null)||trim($license['resolucion'])===''))throw new PortalError(422,'El licenciamiento requiere su resolución institucional.');
            foreach(['fechaResolucion','vigenciaHasta'] as $key)if(!empty($license[$key])&&!self::date($license[$key]))throw new PortalError(422,'La fecha de licenciamiento no es válida.');
        }
    }
    public static function catalogs(array &$new): void
    {
        $a=&$new['academico'];
        $institution=$new['config']['inst'];
        $a['cfg']['nombre']=$institution['nombre'];$a['cfg']['siglas']=$institution['nombreCorto'];$a['cfg']['direccion']=$institution['direccion'];
        $host=$_SERVER['HTTP_HOST']??'';
        if(is_string($host)&&preg_match('/^(?:[a-z0-9.-]+|\[[0-9a-f:]+\])(?::[0-9]{1,5})?$/iD',$host))$a['cfg']['web']=$host;
        foreach($new['jerarquica'] as $leader)if(!($leader['deleted']??false)&&($leader['esDirector']??false)&&($leader['estado']??'')==='Publicado'){
            $person=PortalPolicy::find($new['personas'],'id',$leader['personaId']);
            if($person&&!($person['deleted']??false))$a['cfg']['director']=trim(preg_replace('/\s+/u',' ',($person['titulo']??'').' '.($person['nombres']??'').' '.($person['apellidos']??'')));
            break;
        }
        foreach($new['programas'] as $p){if($p['deleted']??false)continue;$id=$a['progMap'][$p['id']]??null;
            if($id===null||!PortalPolicy::find($a['programas'],'id',$id)){$id??=max([0,...array_values($a['progMap']),...array_column($a['programas'],'id')])+1;$a['progMap'][$p['id']]=$id;$a['programas'][]=['id'=>$id,'pid'=>$p['id'],'cod'=>($p['codigo']??'')?:'P'.$id,'nombre'=>$p['nombre'],'dur'=>$p['duracion']??'3 años','sem'=>6,'activo'=>($p['estado']??'')==='Publicado'];}
            foreach($a['programas'] as &$r)if($r['id']===$id){$r['nombre']=$p['nombre'];$r['cod']=($p['codigo']??'')?:$r['cod'];$r['activo']=($p['estado']??'')==='Publicado';$r['pid']=$p['id'];}unset($r);
        }
        $kept=[];foreach($a['programas'] as $r){if(empty($r['pid'])){$kept[]=$r;continue;}$p=PortalPolicy::find($new['programas'],'id',$r['pid']);if($p&&!($p['deleted']??false)){$kept[]=$r;continue;}
            $used=false;foreach(['estudiantes','uds','modulos','ambientes','sesiones','ofertas'] as $collection)if(PortalPolicy::find($a[$collection],'prog',$r['id']))$used=true;
            if($used){$r['activo']=false;$kept[]=$r;}else unset($a['progMap'][$r['pid']]);
        }$a['programas']=$kept;
    }
}
