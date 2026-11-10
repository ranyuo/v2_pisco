<?php
declare(strict_types=1);
final class PortalFiles
{
    private const TYPES=['application/pdf'=>['pdf'],'image/jpeg'=>['jpg','jpeg'],'image/png'=>['png'],'image/webp'=>['webp'],'image/gif'=>['gif'],
        'application/zip'=>['docx','xlsx','pptx'],'application/vnd.openxmlformats-officedocument.wordprocessingml.document'=>['docx'],
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'=>['xlsx'],'application/vnd.openxmlformats-officedocument.presentationml.presentation'=>['pptx'],
        'application/msword'=>['doc'],'application/vnd.ms-excel'=>['xls'],'application/vnd.ms-powerpoint'=>['ppt'],'application/x-ole-storage'=>['doc','xls','ppt']];
    public static function store(PortalApp $app,string $name,string $bytes): array
    {
        $name=basename(str_replace('\\','/',$name));$name=preg_replace('/[\x00-\x1f\x7f]/','',$name);
        if($name===''||strlen($name)>255||strlen($bytes)===0||strlen($bytes)>40*1024*1024)throw new PortalError(422,'Archivo vacío, demasiado grande o con nombre no válido.');
        $mime=(new finfo(FILEINFO_MIME_TYPE))->buffer($bytes);$ext=strtolower(pathinfo($name,PATHINFO_EXTENSION));
        if(!isset(self::TYPES[$mime])||!in_array($ext,self::TYPES[$mime],true))throw new PortalError(422,'El contenido del archivo no coincide con un formato permitido.');
        $id=bin2hex(random_bytes(16));$user=$app->user();$sha=hash('sha256',$bytes);
        $app->db()->prepare('INSERT INTO pisco_files (id,owner_user_id,owner_session,filename,mime,size,sha256,contents) VALUES (?,?,?,?,?,?,?,?)')->execute([$id,$user['server_id']??null,hash('sha256',session_id()),$name,$mime,strlen($bytes),$sha,$bytes]);
        return ['fileId'=>$id,'url'=>'/index.php?route=api%2Farchivo&id='.$id,'original'=>$name,'nombre'=>$name,'n'=>$name,'size'=>strlen($bytes),'s'=>strlen($bytes),'type'=>$mime,'sha256'=>$sha];
    }
    public static function contains(mixed $value,string $id): bool
    {
        if(!is_array($value))return false;
        if(($value['fileId']??null)===$id)return true;
        foreach($value as $item)if(is_array($item)&&self::contains($item,$id))return true;
        return false;
    }
    public static function metadata(PortalApp $app,array $file,bool $ownerOnly=false): array
    {
        $id=$file['fileId']??'';if(!is_string($id)||!preg_match('/^[a-f0-9]{32}$/',$id))throw new PortalError(422,'Referencia de archivo no válida.');
        $stmt=$app->db()->prepare('SELECT id,owner_user_id,owner_session,filename,mime,size,sha256 FROM pisco_files WHERE id=?');$stmt->execute([$id]);$row=$stmt->fetch();if(!$row)throw new PortalError(404,'Archivo no encontrado en el servidor.');
        $user=$app->user();$owned=$row['owner_user_id']!==null?($user&&(int)$row['owner_user_id']===$user['server_id']):hash_equals($row['owner_session'],hash('sha256',session_id()));
        if(!$owned&&($ownerOnly||!self::contains($app->bootstrap()['data'],$id)))throw new PortalError(403,'No tienes acceso a ese archivo.');
        return ['fileId'=>$id,'url'=>'/index.php?route=api%2Farchivo&id='.$id,'nombre'=>$row['filename'],'original'=>$row['filename'],'n'=>$row['filename'],'size'=>(int)$row['size'],'s'=>(int)$row['size'],'type'=>$row['mime'],'sha256'=>$row['sha256']];
    }
    public static function persist(PortalApp $app,mixed $value,array &$aliases=[],int $depth=0,mixed $previous=null): mixed
    {
        if($previous!==null&&PortalPolicy::equal($value,$previous))return $value;
        if(!is_array($value))return $value;
        if($depth>40)throw new PortalError(422,'El documento contiene demasiados niveles de datos.');
        if(isset($value['fileId'])){
            $meta=self::metadata($app,$value);
            unset($value['data'],$value['key']);return self::withMetadata($value,$meta);
        }
        if(isset($value['data'])&&is_string($value['data'])&&str_starts_with($value['data'],'data:')){
            if(!preg_match('/^data:[^;,]+;base64,(.*)$/s',$value['data'],$m)||strlen($m[1])>57_000_000)throw new PortalError(422,'Archivo codificado no válido.');
            $bytes=base64_decode($m[1],true);if($bytes===false)throw new PortalError(422,'Archivo codificado no válido.');
            $key=hash('sha256',$bytes).'|'.($value['original']??$value['nombre']??$value['n']??'archivo.pdf');
            $meta=$aliases[$key]??=self::store($app,$value['original']??$value['nombre']??$value['n']??'archivo.pdf',$bytes);
            unset($value['data'],$value['key']);return self::withMetadata($value,$meta);
        }
        foreach($value as $key=>$child)if(is_array($child))$value[$key]=self::persist($app,$child,$aliases,$depth+1,is_array($previous)?($previous[$key]??null):null);
        return $value;
    }
    private static function withMetadata(array $value,array $meta): array
    {
        // El título editorial puede diferir del archivo; identidad, tipo y hash siguen siendo del servidor.
        $name=is_string($value['nombre']??null)?trim($value['nombre']):'';
        return [...$value,...$meta,'nombre'=>$name!==''?$name:$meta['nombre']];
    }
    public static function serve(PortalApp $app,string $id): never
    {
        $meta=self::metadata($app,['fileId'=>$id]);$stmt=$app->db()->prepare('SELECT contents FROM pisco_files WHERE id=?');$stmt->execute([$id]);$data=$stmt->fetchColumn();
        header('Content-Type: '.$meta['type']);header('Content-Length: '.$meta['size']);
        $disposition=isset($_GET['download'])||!in_array($meta['type'],['application/pdf','image/png','image/jpeg','image/webp','image/gif'],true)?'attachment':'inline';
        header('Content-Disposition: '.$disposition."; filename*=UTF-8''".rawurlencode($meta['original']));
        header("Content-Security-Policy: default-src 'none'; sandbox");
        PortalAudit::write($app,isset($_GET['download'])?'Descargar archivo':'Consultar archivo','Archivos',$id,['nombre'=>$meta['original']]);
        echo $data;exit;
    }
}
