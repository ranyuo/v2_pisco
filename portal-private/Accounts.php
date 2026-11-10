<?php
declare(strict_types=1);
trait PortalAccounts
{
    public function roleSettings(): array
    {
        $this->requireAdmin();
        $value=$this->db()->query("SELECT setting_value FROM pisco_settings WHERE setting_key='role_permissions'")->fetchColumn();
        return $value?json_decode($value,true,flags:JSON_THROW_ON_ERROR):[];
    }
    public function saveRole(array $input): void
    {
        $actor=$this->requireAdmin();$this->rate('roles',60,60);
        $key=$input['role']??null;$defaults=PortalPolicy::defaults()['roles'];
        if(!is_string($key)||!isset($defaults[$key])||$key==='admin')throw new PortalError(422,'El administrador está protegido. Selecciona otro rol.');
        $label=($input['reset']??false)===true?$defaults[$key]['label']:($input['label']??'');$mods=($input['reset']??false)===true?$defaults[$key]['mods']:($input['mods']??[]);
        if(!is_string($label)||trim($label)===''||strlen($label)>100||!preg_match('/^[\p{L}\p{N} ._,()\/-]+$/u',$label)||!is_array($mods)||!array_is_list($mods))throw new PortalError(422,'Nombre o módulos del rol no válidos.');
        foreach($mods as $mod)if(!is_string($mod)||!in_array($mod,$defaults[$key]['mods'],true))throw new PortalError(422,'Módulo ajeno al ámbito institucional del rol.');
        $new=['label'=>trim($label),'mods'=>array_values(array_unique(['dashboard',...$mods]))];
        // Los vínculos personales y el ámbito del programa no son permisos transferibles.
        $this->transaction(function()use($input,$key,$new,$actor){
            $this->state(true);
            $current=$this->roleSettings();
            if(!array_key_exists('expected',$input)||!PortalPolicy::equal($current[$key]??null,$input['expected']))throw new PortalError(409,'Otra persona modificó este rol. Recarga antes de guardar.');
            if(($input['reset']??false)===true)unset($current[$key]);else $current[$key]=$new;
            $this->db()->prepare("INSERT INTO pisco_settings (setting_key,setting_value) VALUES ('role_permissions',?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)")->execute([json_encode($current,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE)]);
            $this->db()->prepare('UPDATE pisco_users SET auth_version=auth_version+1 WHERE role=?')->execute([$key]);
            PortalAudit::write($this,'Modificar rol','Roles',$key,['nombre'=>$new['label'],'modulos'=>$new['mods'],'restaurado'=>$input['reset']??false],$actor);
            return [];
        });
        PortalPolicy::configureRoles($this->roleSettings());
    }
    private function accountInput(array $input,bool $creating=true): array
    {
        $data=self::validate($input,['username'=>'required|string|min:3|max:80','name'=>'required|string|max:150','email'=>'nullable|email|max:254']);
        $data['username']=strtolower(trim($data['username']));
        if(!preg_match('/^[a-z0-9._-]{3,80}$/',$data['username']))throw new PortalError(422,'El usuario admite letras, números, puntos y guiones.');
        $password=$input['password']??'';
        if($creating||$password!==''){
            if(!is_string($password)||preg_match_all('/./us',$password)<12||strlen($password)>72)throw new PortalError(422,'La contraseña necesita al menos 12 caracteres y máximo 72 bytes.');
            if(isset($input['password_confirmation'])&&$password!==$input['password_confirmation'])throw new PortalError(422,'Las contraseñas no coinciden.');
        }
        $role=$input['role']??$input['rol']??'admin';
        if(!is_string($role)||!isset(PortalPolicy::definitions()['roles'][$role]))throw new PortalError(422,'Rol no válido.');
        $data['role']=$role;$data['password']=$password;$data['email']=$data['email']??($data['username'].'@portal.invalid');
        $profile=[];
        foreach(['programaId','personaId','vin','dni','area','cargo'] as $key){
            $value=$input[$key]??'';if(!is_string($value)||strlen($value)>200)throw new PortalError(422,'Vínculo de usuario no válido.');$profile[$key]=$value;
        }
        $state=in_array($role,['coordinador','estudiante','egresado','empresa','docente'],true)?json_decode($this->state()['data'],true,flags:JSON_THROW_ON_ERROR):[];
        if($role==='coordinador'&&!PortalPolicy::find($state['programas'],'id',$profile['programaId']))throw new PortalError(422,'Selecciona el programa del coordinador.');
        if(in_array($role,['estudiante','egresado'],true)){
            $id=PortalPolicy::binding($profile,'est');$student=PortalPolicy::find($state['academico']['estudiantes']??[],'id',$id);
            if(!$student)throw new PortalError(422,'Vincula la cuenta con un alumno existente.');$profile['dni']=(string)$student['dni'];
        }
        if($role==='empresa'&&!PortalPolicy::find($state['academico']['empresas']??[],'id',PortalPolicy::binding($profile,'emp')))throw new PortalError(422,'Vincula la cuenta con una empresa registrada.');
        if($role==='docente'){
            $id=PortalPolicy::binding($profile,'doc');$teacher=PortalPolicy::find($state['academico']['docentes']??[],'id',$id);
            if($teacher&&empty($profile['personaId']))$profile['personaId']=(string)($teacher['per']??'');
            if($teacher&&!empty($teacher['per'])&&$profile['personaId']!==(string)$teacher['per'])throw new PortalError(422,'La persona de la cuenta debe coincidir con la carga docente vinculada.');
            if(!$teacher||!PortalPolicy::find($state['personas']??[],'id',$profile['personaId']))throw new PortalError(422,'Vincula la cuenta con el docente y su registro de persona.');
        }
        $data['profile']=$profile;return $data;
    }
    private function accountDto(array $row): array
    {
        $profile=json_decode($row['profile']??'{}',true)??[];
        return [...$profile,'id'=>'server-'.$row['id'],'server_id'=>(int)$row['id'],'ixId'=>(int)$row['id'],
            'usuario'=>$row['username'],'nombre'=>$row['name'],'correo'=>$row['email'],'rol'=>$row['role']??'admin',
            'estado'=>(int)$row['active']===1?'Activo':'Inactivo','has_password'=>true,
            'ultimoAcceso'=>$row['last_login']??'','intentos'=>(int)($row['login_failures']??0),
            'bloqueadoHasta'=>empty($row['locked_until'])?0:strtotime($row['locked_until'])*1000];
    }
    private function visibleAccounts(?array $actor,array $state): array
    {
        if(!$actor)return [];$role=PortalPolicy::role($actor);$rows=$this->db()->query('SELECT * FROM pisco_users ORDER BY username')->fetchAll();$out=[];
        foreach($rows as $row){$dto=$this->accountDto($row);
            $allowed=$role==='admin'||$dto['id']===$actor['id']||($role==='secretaria'&&in_array($dto['rol'],['estudiante','egresado','docente'],true))||($role==='atencion'&&$dto['rol']==='empresa');
            if($role==='coordinador'&&in_array($dto['rol'],['estudiante','egresado'],true)){
                $student=PortalPolicy::find($state['academico']['estudiantes']??[],'id',PortalPolicy::binding($dto,'est'));
                $allowed=$allowed||($student&&($student['prog']??null)===($state['academico']['progMap'][$actor['programaId']??'']??null));
            }
            if($allowed)$out[]=$dto;
        }return $out;
    }
    public function accounts(): array
    {
        $this->requireAdmin();return array_map(fn($r)=>['id'=>(int)$r['id'],'username'=>$r['username'],'name'=>$r['name'],'email'=>$r['email'],'role'=>$r['role'],'active'=>$r['active'],'profile'=>json_decode($r['profile']??'{}',true)??[]],$this->db()->query('SELECT * FROM pisco_users ORDER BY username')->fetchAll());
    }
    /** Contraseña temporal aleatoria, sin prefijos fijos, con mayúsculas, minúsculas y dígitos. */
    public static function temporaryPassword(): string
    {
        $alphabet='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
        do{$chars='';for($i=0;$i<16;$i++)$chars.=$alphabet[random_int(0,strlen($alphabet)-1)];}
        while(!preg_match('/[A-Z]/',$chars)||!preg_match('/[a-z]/',$chars)||!preg_match('/[0-9]/',$chars));
        return implode('-',str_split($chars,4));
    }
    public function createAccount(array $input,bool $authorize=true): void
    {
        if($authorize){$this->requireAdmin();$this->rate('accounts',120,60);}
        $data=$this->accountInput($input);
        try{$this->db()->prepare('INSERT INTO pisco_users (username,name,email,password,role,profile,active) VALUES (?,?,?,?,?,?,?)')->execute([$data['username'],$data['name'],$data['email'],password_hash($data['password'],PASSWORD_DEFAULT),$data['role'],json_encode($data['profile'],JSON_THROW_ON_ERROR),$this->accountActive($input)]);}
        catch(PDOException $e){if($e->getCode()==='23000')throw new PortalError(422,'El usuario o correo ya está registrado.');throw $e;}
        PortalAudit::write($this,'Crear cuenta','Cuentas',(string)$this->db()->lastInsertId(),['usuario'=>$data['username'],'rol'=>$data['role']]);
    }
    private function accountActive(array $input): int
    {
        $active=$input['active']??$input['estado']??'Activo';
        return ($active===true||$active===1||$active==='Activo')?1:0;
    }
    public function accountOperation(array $input): array
    {
        if($this->db()->inTransaction())return $this->performAccountOperation($input);
        return $this->transaction(function()use($input){$this->state(true);return $this->performAccountOperation($input);});
    }
    private function performAccountOperation(array $input): array
    {
        $actor=$this->requireUser();$role=PortalPolicy::role($actor);$action=$input['action']??'create';
        if(!in_array($role,['admin','secretaria','coordinador'],true))throw new PortalError(403,'No tienes permiso para gestionar cuentas.');
        $this->rate('accounts',120,60);
        $fields=$input['account']??[];if(!is_array($fields))throw new PortalError(422,'Cuenta no válida.');
        if($action==='student'){
            if($role!=='admin'&&PortalPolicy::level(json_decode($this->state()['data'],true),$actor,'alumnos')<2)throw new PortalError(403,'Tu perfil no tiene permiso para gestionar cuentas de alumnos.');
            $state=json_decode($this->state()['data'],true);$student=PortalPolicy::find($state['academico']['estudiantes']??[],'id',$input['student_id']??null);
            if(!$student)throw new PortalError(422,'Alumno no encontrado.');
            if($role==='coordinador'&&($student['prog']??null)!==($state['academico']['progMap'][$actor['programaId']]??null))throw new PortalError(403,'Alumno de otro programa.');
            $password=self::temporaryPassword();
            $fields=['username'=>(string)$student['dni'],'name'=>$student['nom'],'email'=>($student['correo']??'')?:$student['dni'].'@portal.invalid','password'=>$password,'role'=>in_array($student['estado'],['Egresado','Titulado'],true)?'egresado':'estudiante','vin'=>'est:'.$student['id'],'dni'=>(string)$student['dni']];
            $this->createAccount($fields,false);$row=$this->db()->query('SELECT * FROM pisco_users WHERE username = '.$this->db()->quote(strtolower($fields['username'])))->fetch();
            $this->flagPasswordChange((int)$row['id'],true);$row['profile']=json_encode([...(json_decode($row['profile']??'{}',true)??[]),'cambiarClave'=>true]);
            return ['user'=>$this->accountDto($row),'temporary_password'=>$password];
        }
        if($role!=='admin')throw new PortalError(403,'Solo el administrador puede editar cuentas.');
        if($action==='create'){
            $this->createAccount($fields,false);$row=$this->db()->query('SELECT * FROM pisco_users WHERE username = '.$this->db()->quote(strtolower($fields['username'])))->fetch();
            // Quien recibe una contraseña elegida por el administrador debe cambiarla al ingresar.
            $this->flagPasswordChange((int)$row['id'],true);$row['profile']=json_encode([...(json_decode($row['profile']??'{}',true)??[]),'cambiarClave'=>true]);return ['user'=>$this->accountDto($row)];
        }
        $id=filter_var($input['id']??null,FILTER_VALIDATE_INT);if(!$id)throw new PortalError(422,'Identificador de cuenta no válido.');
        $stmt=$this->db()->prepare('SELECT * FROM pisco_users WHERE id = ? FOR UPDATE');$stmt->execute([$id]);$old=$stmt->fetch();if(!$old)throw new PortalError(404,'Cuenta no encontrada.');
        if(isset($input['expected'])){$dto=$this->accountDto($old);$expected=['username'=>$dto['usuario'],'name'=>$dto['nombre'],'email'=>$dto['correo']??'','role'=>$dto['rol'],'estado'=>$dto['estado']];foreach(['vin','dni','personaId','programaId','area','cargo'] as $key)$expected[$key]=$dto[$key]??'';if(!PortalPolicy::equal($expected,$input['expected']))throw new PortalError(409,'Otra persona modificó esta cuenta. Recarga antes de continuar.');}
        if($action==='unlock'){PortalAudit::write($this,'Desbloquear cuenta','Cuentas',(string)$id);$this->db()->prepare('UPDATE pisco_users SET login_failures=0,locked_until=NULL WHERE id=?')->execute([$id]);$u=$this->db()->prepare('SELECT username FROM pisco_users WHERE id=?');$u->execute([$id]);$this->db()->prepare('DELETE FROM pisco_rate_limits WHERE rate_key LIKE ?')->execute([PortalApp::loginFailPrefix((string)$u->fetchColumn()).'%']);return ['ok'=>true];}
        if($action!=='update')throw new PortalError(422,'Acción no válida.');
        $data=$this->accountInput($fields,false);$active=$this->accountActive($fields);
        if($data['username']!==$old['username'])throw new PortalError(422,'El nombre de usuario existente no se puede cambiar.');
        if((int)$actor['server_id']===$id&&(!$active||$data['role']!=='admin'))throw new PortalError(422,'No puedes quitarte el acceso de administrador.');
        if($old['role']==='admin'&&(!$active||$data['role']!=='admin')&&(int)$this->db()->query("SELECT COUNT(*) FROM pisco_users WHERE role='admin' AND active=1")->fetchColumn()<=1)throw new PortalError(422,'Debe quedar al menos un administrador activo.');
        // La cuenta administradora principal (la más antigua, creada al instalar) solo se modifica a sí misma.
        $primary=(int)$this->db()->query("SELECT MIN(id) FROM pisco_users WHERE role='admin'")->fetchColumn();
        if($id===$primary&&(int)$actor['server_id']!==$id&&(!$active||$data['role']!=='admin'||$data['password']!==''))throw new PortalError(403,'La cuenta administradora principal solo puede cambiar su estado, rol o contraseña desde su propia sesión.');
        $oldProfile=json_decode($old['profile']??'{}',true)??[];if(!empty($oldProfile['cambiarClave']))$data['profile']['cambiarClave']=true;
        $revoke=($data['role']!==$old['role']||!$active||$data['password']!==''||!PortalPolicy::equal($data['profile'],json_decode($old['profile']??'{}',true)??[]));
        $hash=$data['password']!==''?password_hash($data['password'],PASSWORD_DEFAULT):$old['password'];
        try{$this->db()->prepare('UPDATE pisco_users SET name=?,email=?,password=?,role=?,profile=?,active=?,auth_version=auth_version+?,login_failures=0,locked_until=NULL WHERE id=?')->execute([$data['name'],$data['email'],$hash,$data['role'],json_encode($data['profile'],JSON_THROW_ON_ERROR),$active,(int)$revoke,$id]);}
        catch(PDOException $e){if($e->getCode()==='23000')throw new PortalError(422,'El correo ya está registrado.');throw $e;}
        if($data['password']!==''&&(int)$actor['server_id']!==$id)$this->flagPasswordChange($id,true);
        PortalAudit::write($this,'Actualizar cuenta','Cuentas',(string)$id,['rol_anterior'=>$old['role'],'rol_actual'=>$data['role'],'activo'=>$active,'cambio_clave'=>$data['password']!==''?'sí':'no'],$actor);
        if((int)$actor['server_id']===$id&&$revoke)$_SESSION['auth_version']=(int)$old['auth_version']+1;
        return ['ok'=>true];
    }
    /** Marca (o desmarca) que la cuenta debe cambiar su contraseña temporal en el próximo ingreso. */
    private function flagPasswordChange(int $id,bool $on): void
    {
        $stmt=$this->db()->prepare('SELECT profile FROM pisco_users WHERE id=?');$stmt->execute([$id]);$profile=json_decode((string)($stmt->fetchColumn()?:'{}'),true)??[];
        if($on)$profile['cambiarClave']=true;else unset($profile['cambiarClave']);
        $this->db()->prepare('UPDATE pisco_users SET profile=? WHERE id=?')->execute([json_encode($profile,JSON_THROW_ON_ERROR),$id]);
    }
    public function changePassword(array $input): void
    {
        $user=$this->requireUser();$this->rate('password',5,300);
        $data=self::validate($input,['current_password'=>'required|string|max:72','password'=>'required|string|min:12|max:72']);
        if(($input['password_confirmation']??null)!==$data['password']||strlen($data['password'])>72)throw new PortalError(422,'La contraseña nueva y su confirmación deben coincidir.');
        $stmt=$this->db()->prepare('SELECT password,auth_version FROM pisco_users WHERE id=?');$stmt->execute([$user['server_id']]);$old=$stmt->fetch();
        if(!password_verify($data['current_password'],$old['password']))throw new PortalError(422,'La contraseña actual no es correcta.');
        if(password_verify($data['password'],$old['password']))throw new PortalError(422,'La contraseña nueva debe ser distinta de la actual.');
        $this->db()->prepare('UPDATE pisco_users SET password=?,auth_version=auth_version+1,login_failures=0,locked_until=NULL WHERE id=?')->execute([password_hash($data['password'],PASSWORD_DEFAULT),$user['server_id']]);
        $this->flagPasswordChange((int)$user['server_id'],false);
        PortalAudit::write($this,'Cambiar contraseña','Cuentas',(string)$user['server_id'],[],$user);
        $_SESSION['auth_version']=(int)$old['auth_version']+1;session_regenerate_id(true);
    }
}
