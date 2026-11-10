<?php
declare(strict_types=1);

/** Configuración SMTP privada, cifrada fuera de la raíz pública. */
final class SmtpSettings
{
    public function __construct(private readonly array $config,private readonly ?string $configFile) {}

    private function path(): ?string
    {return $this->configFile===null?null:dirname($this->configFile).'/.smtp-settings.json';}

    private function key(): string
    {
        $key=$this->config['install_key']??'';
        if(!is_string($key)||strlen($key)<32)throw new PortalError(503,'Configura una clave privada de instalación de al menos 32 caracteres.');
        return hash('sha256','portal-smtp-v1|'.$key,true);
    }

    public function read(): array
    {
        $base=['enabled'=>false,'host'=>'smtp.gmail.com','port'=>587,'encryption'=>'tls',
            'username'=>'notificaciones@proyectos.pe','from_email'=>'notificaciones@proyectos.pe',
            'from_name'=>'Notificaciones · IESTP Pisco','password'=>'',...($this->config['smtp']??[])];
        $path=$this->path();if($path===null||!file_exists($path))return $base;
        try{
            $raw=@file_get_contents($path);if(!is_string($raw))throw new RuntimeException();
            $blob=json_decode($raw,true,flags:JSON_THROW_ON_ERROR);
            if(!is_array($blob)||($blob['version']??null)!==1)throw new RuntimeException();
            foreach(['nonce','tag','ciphertext'] as $field)if(!is_string($blob[$field]??null))throw new RuntimeException();
            $nonce=base64_decode($blob['nonce'],true);$tag=base64_decode($blob['tag'],true);$cipher=base64_decode($blob['ciphertext'],true);
            if(!is_string($nonce)||strlen($nonce)!==12||!is_string($tag)||strlen($tag)!==16||!is_string($cipher))throw new RuntimeException();
            $plain=openssl_decrypt($cipher,'aes-256-gcm',$this->key(),OPENSSL_RAW_DATA,$nonce,$tag,'portal-smtp-v1');
            if($plain===false)throw new RuntimeException();
            return [...$base,...json_decode($plain,true,flags:JSON_THROW_ON_ERROR)];
        }catch(Throwable $error){throw new PortalError(503,'No se pudo leer la configuración SMTP protegida. Revisa la clave privada y los permisos del servidor.');}
    }

    public function view(): array
    {
        $c=$this->read();
        return [...array_intersect_key($c,array_flip(['enabled','host','port','encryption','username','from_email','from_name'])),
            'has_password'=>!empty($c['password'])];
    }

    public function save(array $input): array
    {
        $path=$this->path();if($path===null)throw new PortalError(503,'No se ha definido la configuración privada del servidor.');
        if(array_diff(array_keys($input),['enabled','host','port','encryption','username','from_email','from_name','password']))throw new PortalError(422,'Parámetros SMTP no válidos.');
        if(!is_bool($input['enabled']??null))throw new PortalError(422,'Indica si el correo está habilitado.');
        foreach(['host','encryption','username','from_email','from_name','password'] as $field)if(!is_string($input[$field]??null))throw new PortalError(422,'Completa los campos SMTP.');
        $c=$input;foreach(['host','username','from_email','from_name'] as $field)$c[$field]=trim($c[$field]);
        if(strlen($c['host'])>253||!preg_match('/^[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?$/D',$c['host']))throw new PortalError(422,'Servidor SMTP no válido.');
        if(!is_int($c['port']??null)||$c['port']<1||$c['port']>65535||!in_array($c['encryption'],['tls','ssl'],true))throw new PortalError(422,'Puerto o seguridad SMTP no válidos.');
        foreach(['username','from_email'] as $field)if(strlen($c[$field])>254||!filter_var($c[$field],FILTER_VALIDATE_EMAIL))throw new PortalError(422,'Usuario o remitente SMTP no válido.');
        if($c['from_name']===''||strlen($c['from_name'])>150||preg_match('/[\r\n\x00]/',$c['from_name']))throw new PortalError(422,'Nombre del remitente no válido.');
        if(strlen($c['password'])>512||preg_match('/[\r\n\x00]/',$c['password']))throw new PortalError(422,'Contraseña de aplicación no válida.');
        $lock=@fopen($path.'.lock','c');if(!$lock)throw new PortalError(503,'No se pudo guardar SMTP. Revisa los permisos de la carpeta privada.');
        chmod($path.'.lock',0600);$tmp=null;
        try{
            if(!flock($lock,LOCK_EX))throw new RuntimeException();
            $old=$this->read();
            if($c['password']===''&&$old['username']===$c['username']&&$old['host']===$c['host'])$c['password']=$old['password'];
            if($c['enabled']&&$c['password']==='')throw new PortalError(422,'Introduce una contraseña de aplicación para habilitar este correo.');
            $nonce=random_bytes(12);$tag='';
            $cipher=openssl_encrypt(json_encode($c,JSON_THROW_ON_ERROR),'aes-256-gcm',$this->key(),OPENSSL_RAW_DATA,$nonce,$tag,'portal-smtp-v1');
            if($cipher===false)throw new RuntimeException();
            $json=json_encode(['version'=>1,'nonce'=>base64_encode($nonce),'tag'=>base64_encode($tag),'ciphertext'=>base64_encode($cipher)],JSON_THROW_ON_ERROR);
            $tmp=tempnam(dirname($path),'.smtp-');if($tmp===false)throw new RuntimeException();
            if(!chmod($tmp,0600)||file_put_contents($tmp,$json)!==strlen($json)||!rename($tmp,$path))throw new RuntimeException();$tmp=null;
        }catch(PortalError $error){throw $error;}
        catch(Throwable $error){throw new PortalError(503,'No se pudo guardar SMTP. Revisa los permisos de la carpeta privada.');}
        finally{if(is_string($tmp)&&is_file($tmp))unlink($tmp);flock($lock,LOCK_UN);fclose($lock);}
        return $this->view();
    }
}
