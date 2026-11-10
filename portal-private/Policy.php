<?php
declare(strict_types=1);
final class PortalPolicy
{
    public const ACADEMIC_ROLES = ['admin'=>'admin','directivo'=>'dir','secretaria'=>'acad','coordinador'=>'acad','atencion'=>'adm','docente'=>'doc','estudiante'=>'est','egresado'=>'egr','empresa'=>'emp'];
    public const COMMUNITY = ['docente','estudiante','egresado','empresa'];
    public const TOP = [
        'noticias'=>['imagen'],'categoriasNoticia'=>['imagen'],'eventos'=>['imagen'],
        'paginas'=>['imagen'],'reconocimientos'=>['imagen'],'slides'=>['imagen'],'enlaces'=>['imagen'],'locales'=>['imagen'],
        'personas'=>['secretaria','docente'],'jerarquica'=>['secretaria'],'programas'=>['coordinador','secretaria'],
        'egresados'=>['secretaria','coordinador'],'admisiones'=>['secretaria'],'matriculas'=>['secretaria'],
        'becarios'=>['secretaria'],'becasPeriodos'=>['secretaria'],'tiposBeca'=>['secretaria'],
        'estadisticas'=>['secretaria','directivo'],'certificados'=>['secretaria'],
        'documentos'=>['transparencia'],'tiposDocumento'=>['transparencia'],'tupa'=>['transparencia'],
        'tupaDocs'=>['transparencia'],'inversiones'=>['transparencia'],'licenciamiento'=>['transparencia'],
        'convocatorias'=>['transparencia'],'servicios'=>['transparencia'],
        'mensajes'=>['atencion'],'reclamos'=>['atencion'],'expedientes'=>['atencion','secretaria','coordinador','imagen','transparencia'],
    ];
    /** Colecciones que un rol puede consultar sin modificarlas (Dirección supervisa reclamos y expedientes). */
    public const READ_ONLY = ['reclamos'=>['directivo'],'expedientes'=>['directivo']];
    /** Personal que solo atiende los expedientes derivados al área asignada en su cuenta. */
    private static function areaInbox(string $key,array $user): bool
    {
        return $key==='expedientes'&&!in_array(self::role($user),['admin','atencion','directivo'],true)&&trim((string)($user['area']??''))!=='';
    }
    private static function topAllowed(string $key,array $user,bool $write): bool
    {
        $role=self::role($user);if($role==='admin')return true;
        $roles=[...(self::TOP[$key]??[]),...($write?[]:(self::READ_ONLY[$key]??[]))];
        if(!in_array($role,$roles,true))return false;
        return self::areaInbox($key,$user)||($key!=='expedientes'||in_array($role,['atencion','directivo'],true))&&self::can($user,self::collectionModule($key,$user));
    }
    private const ACADEMIC_MODULE = ['estudiantes'=>'alumnos','sesiones'=>'horarios','publicados'=>'horarios',
        'certs'=>'certificados','notas'=>'certificados','titulos'=>'titulos','empresas'=>'bolsa','ofertas'=>'bolsa',
        'postulaciones'=>'bolsa','perfilesLab'=>'bolsa','perfilesDoc'=>'docentes','uds'=>'config','docentes'=>'config',
        'ambientes'=>'config','modulos'=>'config','areas'=>'config','tramites'=>'config','programas'=>'config',
        'cfg'=>'config','perms'=>'usuarios','docs'=>'certificados'];
    private static array $roleOverrides = [];
    public static function configureRoles(array $roles): void { self::$roleOverrides=$roles; }
    public static function validateRoles(array $roles): void
    {
        $base=self::defaults()['roles'];
        foreach($roles as $key=>$role){
            if($key==='admin'||!isset($base[$key])||!is_array($role)||array_diff(array_keys($role),['label','mods'])||!is_string($role['label']??null)||trim($role['label'])===''||strlen($role['label'])>100||!preg_match('/^[\p{L}\p{N} ._,()\/-]+$/u',$role['label'])||!is_array($role['mods']??null)||!array_is_list($role['mods']))throw new PortalError(422,'Configuración de roles no válida.');
            foreach($role['mods'] as $mod)if(!is_string($mod)||!in_array($mod,$base[$key]['mods'],true))throw new PortalError(422,'Permiso fuera del ámbito del rol.');
            if(!in_array('dashboard',$role['mods'],true))throw new PortalError(422,'El inicio del panel debe permanecer habilitado.');
        }
    }
    public static function defaults(): array
    {
        static $base;return $base ??= json_decode(file_get_contents(__DIR__.'/contracts/original.json'),true,flags:JSON_THROW_ON_ERROR);
    }
    public static function definitions(): array
    {
        $base=self::defaults();
        foreach(self::$roleOverrides as $key=>$role)if($key!=='admin'&&isset($base['roles'][$key]))$base['roles'][$key]=array_replace($base['roles'][$key],$role);
        foreach($base['specs'] as &$spec)if($spec['collection']==='certificados')foreach($spec['fields'] as &$field)if($field['name']==='programaId'){$field['required']=false;$field['publishRequired']=false;}
        unset($spec,$field);
        return $base;
    }
    public static function collectionModule(string $key,array $user=[]): string
    {
        if($key==='personas'&&self::role($user)==='docente')return 'cvdocente';
        foreach(self::defaults()['specs'] as $spec)if($spec['collection']===$key)return $spec['module'];
        return ['slides'=>'portada','enlaces'=>'enlaces','categoriasNoticia'=>'noticias','tiposDocumento'=>'documentos','tupaDocs'=>'tupa','tiposBeca'=>'becas','becasPeriodos'=>'becas','becarios'=>'becas','personas'=>'docentes'][$key]??$key;
    }

    public static function role(array $user): string { return $user['rol'] ?? 'publico'; }
    public static function can(array $user, string $module): bool
    {
        return self::role($user)==='admin' || in_array($module,self::definitions()['roles'][self::role($user)]['mods']??[],true);
    }
    public static function level(array $data, array $user, string $module): int
    {
        if (self::role($user)==='admin') return 2;
        $role=self::ACADEMIC_ROLES[self::role($user)]??'';
        $portalModule=['alumnos'=>'ix-alumnos','horarios'=>'ix-horarios','certificados'=>'ix-certificados','titulos'=>'ix-titulos','bolsa'=>'ix-bolsa','config'=>'ix-config','usuarios'=>'usuarios','docentes'=>'cvdocente'][$module]??'';
        if ($module==='docentes' && self::role($user)==='docente') return self::can($user,'cvdocente')?2:0;
        if (!$portalModule || !self::can($user,$portalModule)) return 0;
        return min(2,max(0,(int)($data['academico']['perms'][$role][$module]??0)));
    }
    public static function binding(array $user, string $type): ?int
    {
        return preg_match('/^'.preg_quote($type,'/').':([1-9][0-9]*)$/',(string)($user['vin']??''),$m) ? (int)$m[1] : null;
    }
    private static function ownProgram(array $data,array $user): ?int
    {
        $id=$user['programaId']??'';
        return isset($data['academico']['progMap'][$id]) ? (int)$data['academico']['progMap'][$id] : null;
    }
    private static function topScope(string $key,array $row,array $user): bool
    {
        $role=self::role($user);
        if($role==='coordinador' && in_array($key,['programas','egresados'],true)) return (string)($key==='programas'?($row['id']??''):($row['programaId']??''))===(string)($user['programaId']??'');
        if($role==='docente' && $key==='personas') return (string)($row['id']??'')===(string)($user['personaId']??'');
        if(self::areaInbox($key,$user)) return (string)($row['area']??'')===(string)$user['area'];
        return true;
    }
    private static function academicScope(string $key,array $row,array $data,array $user): bool
    {
        $role=self::role($user);$est=self::binding($user,'est');$emp=self::binding($user,'emp');$doc=self::binding($user,'doc');
        if($role==='coordinador' && in_array($key,['programas','uds','modulos','ambientes','estudiantes','sesiones'],true)) return ($key==='programas'?($row['id']??null):($row['prog']??null))===self::ownProgram($data,$user);
        if(in_array($role,['estudiante','egresado'],true)) {
            if($key==='estudiantes')return $est!==null&&(int)($row['id']??0)===$est;
            if(in_array($key,['certs','notas','titulos','perfilesLab','postulaciones'],true))return $est!==null&&(int)($row['est']??0)===$est;
            if($key==='docs'){
                if(($row['tipo']??'')==='cert')return $est!==null&&(int)($row['ref']??0)===$est&&self::find($data['academico']['certs']??[],'est',$est)!==null;
                if(($row['tipo']??'')!=='titulo')return false;
                $reference=self::find($data['academico']['titulos']??[],'id',$row['ref']??null);return $est!==null&&$reference&&(int)$reference['est']===$est;
            }
            if($key==='sesiones'){
                $student=self::find($data['academico']['estudiantes']??[],'id',$est);
                if(!$student)return false;
                $g=implode('|',[$student['prog'],$student['ciclo'],$student['sec'],$student['turno'],$data['academico']['cfg']['periodo']]);
                return isset($data['academico']['publicados'][$g])&&($row['per']??'')===($data['academico']['cfg']['periodo']??'')&&(int)($row['prog']??0)===(int)$student['prog']&&(string)($row['ciclo']??'')===(string)$student['ciclo']&&($row['sec']??'')===$student['sec']&&($row['turno']??'')===$student['turno'];
            }
        }
        if($role==='docente') {
            if($key==='sesiones')return $doc!==null&&(int)($row['doc']??0)===$doc;
            if($key==='perfilesDoc')return $doc!==null&&(int)($row['doc']??0)===$doc;
        }
        if($role==='empresa') {
            if($key==='empresas')return $emp!==null&&(int)($row['id']??0)===$emp;
            if($key==='ofertas')return $emp!==null&&(int)($row['emp']??0)===$emp;
            $offers=array_column(array_filter($data['academico']['ofertas']??[],fn($r)=>(int)($r['emp']??0)===$emp),'id');
            $applications=array_filter($data['academico']['postulaciones']??[],fn($r)=>in_array($r['of']??null,$offers,true));
            if($key==='postulaciones')return in_array($row['of']??null,$offers,true);
            if(in_array($key,['estudiantes','perfilesLab','certs'],true))return in_array($key==='estudiantes'?($row['id']??null):($row['est']??null),array_column($applications,'est'),true);
        }
        return true;
    }
    public static function find(array $rows,string $field,mixed $value): ?array
    {foreach($rows as $r)if(isset($r[$field])&&(string)$r[$field]===(string)$value)return $r;return null;}
    public static function key(string $path,array $row): string
    {
        if(isset($row['id']))return 'id:'.(string)$row['id'];
        if($path==='academico.docs')return 'cod:'.(string)($row['cod']??'');
        if(str_ends_with($path,'perfilesLab'))return 'est:'.(string)($row['est']??'');
        if(str_ends_with($path,'perfilesDoc'))return 'doc:'.(string)($row['doc']??'');
        if(str_ends_with($path,'estadisticas'))return ($row['anio']??'').'|'.($row['programaId']??'');
        if(str_ends_with($path,'notas'))return implode('|',[$row['est']??'',$row['ud']??'',$row['per']??'',$row['mod']??'']);
        return hash('sha256',json_encode($row,JSON_THROW_ON_ERROR));
    }
    private static function mergeVisible(array $public,array $authorized,string $path): array
    {
        $rows=[];foreach([...$public,...$authorized] as $r)$rows[self::key($path,$r)]=$r;return array_values($rows);
    }
    public static function project(array $full,?array $user,array $public): array
    {
        if($user===null)return $public;
        if(self::role($user)==='admin')return $full;
        $out=$public;$role=self::role($user);
        // Counters and academic settings contain no credentials and are required by existing forms.
        $out['config']=$full['config'];
        foreach(array_keys([...self::TOP,...self::READ_ONLY]) as $key){
            if(!self::topAllowed($key,$user,false))continue;
            $value=$full[$key]??[];
            if(is_array($value)&&array_is_list($value)) {
                $allowed=array_values(array_filter($value,fn($r)=>self::topScope($key,$r,$user)));
                $out[$key]=self::mergeVisible($public[$key]??[],$allowed,$key);
            } else $out[$key]=$value;
        }
        $a=$full['academico']??[];$p=$public['academico']??[];
        foreach(['v','cfg','seq','perms','progMap'] as $key)$p[$key]=$a[$key]??[];
        foreach(['programas','uds','modulos','areas','tramites','ambientes','docentes'] as $key){
            $p[$key]=array_map(function($r){unset($r['dni'],$r['correoPersonal'],$r['direccion']);return $r;},$a[$key]??[]);
        }
        foreach(self::ACADEMIC_MODULE as $key=>$module){
            $read=self::level($full,$user,$module)>=1;
            if(in_array($key,['estudiantes','certs'],true)&&$role==='empresa')$read=true;
            if(!$read||in_array($key,['cfg','perms','publicados'],true))continue;
            if(!array_is_list($a[$key]??[]))continue;
            $rows=array_values(array_filter($a[$key]??[],fn($r)=>self::academicScope($key,$r,$full,$user)));
            if($role==='empresa'&&$key==='estudiantes')$rows=array_map(function($r){$r=array_intersect_key($r,array_flip(['id','dni','nom','prog','estado','correo','tel']));$r['dni']='****'.substr((string)($r['dni']??''),-4);return $r;},$rows);
            $p[$key]=self::mergeVisible($p[$key]??[],$rows,'academico.'.$key);
        }
        if(in_array($role,['estudiante','egresado'],true)) {
            foreach(['certs','notas','titulos','perfilesLab','postulaciones','estudiantes'] as $key)$p[$key]=array_values(array_filter($a[$key]??[],fn($r)=>self::academicScope($key,$r,$full,$user)));
        }
        if($role==='docente')$p['perfilesDoc']=array_values(array_filter($a['perfilesDoc']??[],fn($r)=>self::academicScope('perfilesDoc',$r,$full,$user)));
        $p['publicados']=$a['publicados']??[];
        $ar=self::ACADEMIC_ROLES[$role]??'';
        $p['notifs']=array_values(array_filter($a['notifs']??[],fn($n)=>in_array($n['to']??'',['u:'.($user['ixId']??''),'r:'.$ar],true)));
        $p['usuarios']=[];$p['bitacora']=[];
        if(in_array($role,['estudiante','egresado'],true))$p['docs']=array_values(array_filter($a['docs']??[],fn($r)=>self::academicScope('docs',$r,$full,$user)));
        $out['academico']=$p;
        return $out;
    }
    private static function changed(array $a,array $b): bool { return self::canonical($a)!==self::canonical($b); }
    private static function canonical(mixed $value): mixed
    {if(!is_array($value))return $value;if(!array_is_list($value))ksort($value);return array_map(self::canonical(...),$value);}
    public static function equal(mixed $a,mixed $b): bool{return self::canonical($a)===self::canonical($b);}
    public static function apply(array $full,array $visible,array $incoming,array $user): array
    {
        if(array_diff(array_keys($visible),array_keys($incoming)))throw new PortalError(422,'El contenido está incompleto. Recarga la página.');
        $role=self::role($user);$out=$full;
        foreach($incoming as $key=>$value){
            if(in_array($key,['usuarios','auditoria','visitas','correos','__v'],true))continue;
            if(self::equal($value,$visible[$key]??null))continue;
            if($key==='academico'){
                if(!is_array($value))throw new PortalError(422,'Datos académicos no válidos.');
                $out[$key]=self::applyAcademic($full,$visible,$value,$user);continue;
            }
            if($key==='config'){
                if(!is_array($value))throw new PortalError(422,'Configuración no válida.');
                foreach($value as $setting=>$settingValue){
                    if(self::equal($settingValue,$visible['config'][$setting]??null))continue;
                    $allowed=$role==='admin'||($role==='imagen'&&in_array($setting,['home','popup','temas','tema','diseno','disenoColores'],true))||($role==='atencion'&&$setting==='bolsa');
                    if($role!=='admin'&&!self::can($user,['home'=>'portada','popup'=>'portada','temas'=>'temas','tema'=>'temas','diseno'=>'temas','disenoColores'=>'temas','bolsa'=>'ix-bolsa'][$setting]??'config'))$allowed=false;
                    if(!$allowed)throw new PortalError(403,'Tu rol no puede modificar esa configuración.');
                    $out['config'][$setting]=$settingValue;
                }
                continue;
            }
            if($role!=='admin'&&!self::topAllowed($key,$user,true))throw new PortalError(403,'Tu rol no puede modificar '.$key.'.');
            if(is_array($value)&&array_is_list($value)&&is_array($full[$key]??null)&&array_is_list($full[$key])){
                $out[$key]=self::mergeRows($key,$full[$key],$visible[$key]??[],$value,$user,fn($row)=>self::topScope($key,$row,$user));
            }elseif($role==='admin'||isset(self::TOP[$key]))$out[$key]=$value;
            else throw new PortalError(403,'Colección no permitida.');
        }
        return $out;
    }
    private static function applyAcademic(array $full,array $visible,array $incoming,array $user): array
    {
        $role=self::role($user);$out=$full['academico'];$base=$visible['academico'];
        foreach($incoming as $key=>$value){
            if(self::equal($value,$base[$key]??null))continue;
            if(in_array($key,['usuarios','bitacora'],true))continue;
            if($key==='notifs'){
                $by=[];foreach($value as $n)if(is_array($n))$by[(string)($n['id']??'')]=$n;
                foreach($out['notifs'] as &$n){$candidate=$by[(string)$n['id']]??null;if(!$candidate)continue;
                    if(!self::equal(array_diff_key($n,['leido'=>1]),array_diff_key($candidate,['leido'=>1])))continue;
                    if(in_array($user['ixId'],$candidate['leido']??[],true)&&!in_array($user['ixId'],$n['leido']??[],true))$n['leido'][]=$user['ixId'];
                }unset($n);continue;
            }
            if($role==='admin'){$out[$key]=$value;continue;}
            if($key==='seq'){
                if(!is_array($value))throw new PortalError(422,'Numeración no válida.');
                foreach($value as $counter=>$number){
                    if(($out['seq'][$counter]??null)===$number)continue;
                    if(self::level($full,$user,'certificados')<2||!is_int($number)||$number<(int)($out['seq'][$counter]??0)||$number>(int)($out['seq'][$counter]??0)+1000)throw new PortalError(403,'No puedes cambiar esa numeración.');
                    $out['seq'][$counter]=$number;
                }continue;
            }
            $module=self::ACADEMIC_MODULE[$key]??'';
            $ownProfile=in_array($role,['estudiante','egresado'],true)&&in_array($key,['perfilesLab','postulaciones'],true);
            $docProfile=$role==='docente'&&$key==='perfilesDoc';
            $ownContact=in_array($role,['estudiante','egresado'],true)&&$key==='estudiantes';
            $ownDocument=in_array($role,['estudiante','egresado'],true)&&$key==='docs';
            $company=$role==='empresa'&&in_array($key,['empresas','ofertas','postulaciones'],true);
            if(($ownProfile||$company)&&!self::can($user,'ix-bolsa'))throw new PortalError(403,'Tu perfil no tiene habilitado el módulo de Bolsa Laboral.');
            if($docProfile&&!self::can($user,'cvdocente'))throw new PortalError(403,'Tu perfil no tiene habilitado el módulo de CV docente.');
            if($ownDocument&&!self::can($user,'ix-certificados')&&!self::can($user,'ix-titulos'))throw new PortalError(403,'Tu perfil no tiene habilitada la emisión de documentos.');
            if(!$module||(!$ownProfile&&!$docProfile&&!$company&&!$ownContact&&!$ownDocument&&self::level($full,$user,$module)<2))throw new PortalError(403,'Tu rol no puede modificar el módulo académico '.$key.'.');
            if($key==='cfg'){
                if($role==='coordinador')throw new PortalError(403,'Los parámetros generales requieren Secretaría o Administración.');
                foreach($value as $setting=>$v)if(!self::equal($base['cfg'][$setting]??null,$v)){if(in_array($setting,['nombre','siglas','director','direccion','web'],true))throw new PortalError(403,'La identidad institucional se configura en Configuración.');$out['cfg'][$setting]=$v;}continue;
            }
            if($key==='publicados'){
                foreach(array_unique([...array_keys($base[$key]??[]),...array_keys($value)]) as $group){
                    if(self::equal($value[$group]??null,$base[$key][$group]??null))continue;
                    if($role==='coordinador'&&(int)explode('|',$group)[0]!==self::ownProgram($full,$user))throw new PortalError(403,'Horario de otro programa.');
                    if(isset($value[$group]))$out[$key][$group]=$value[$group];else unset($out[$key][$group]);
                }continue;
            }
            if(!is_array($value)||!array_is_list($value))throw new PortalError(403,'Configuración académica restringida.');
            $out[$key]=self::mergeRows('academico.'.$key,$out[$key]??[],$base[$key]??[],$value,$user,fn($row)=>self::academicScope($key,$row,$full,$user));
        }
        return $out;
    }
    private static function mergeRows(string $path,array $full,array $base,array $incoming,array $user,callable $scope): array
    {
        $original=[];$proposed=[];$stored=[];
        foreach($base as $r)$original[self::key($path,$r)]=$r;
        foreach($full as $r)$stored[self::key($path,$r)]=$r;
        foreach($incoming as $r){
            if(!is_array($r))throw new PortalError(422,'Registro no válido.');$id=self::key($path,$r);
            if(isset($proposed[$id]))throw new PortalError(422,'Identificador duplicado.');$proposed[$id]=$r;
        }
        foreach(array_unique([...array_keys($original),...array_keys($proposed)]) as $id){
            $old=$original[$id]??null;$new=$proposed[$id]??null;
            if(self::equal($old,$new))continue;
            if(($old&&!$scope($old))||($new&&!$scope($new)))throw new PortalError(403,'Intento de modificar datos de otra persona o programa.');
            if(!$old&&isset($stored[$id]))throw new PortalError(403,'Identificador perteneciente a otro registro.');
            if(!$new&&self::role($user)!=='admin'&&!(in_array(self::role($user),['estudiante','egresado'],true)&&$path==='academico.postulaciones'))throw new PortalError(403,'Solo el administrador puede eliminar definitivamente.');
            self::guardRecord($path,$old,$new,$user);
            if($new)$stored[$id]=$new;else unset($stored[$id]);
        }
        return array_values($stored);
    }
    private static function guardRecord(string $path,?array $old,?array $new,array $user): void
    {
        if(!$new||self::role($user)==='admin')return;
        $role=self::role($user);$changes=[];
        foreach(array_unique([...array_keys($old??[]),...array_keys($new)]) as $key)if(!self::equal($old[$key]??null,$new[$key]??null))$changes[]=$key;
        if(in_array($role,['estudiante','egresado'],true)&&$path==='academico.estudiantes'&&array_diff($changes,['correo','tel']))throw new PortalError(403,'Solo puedes actualizar tu correo y teléfono.');
        if(in_array($role,['estudiante','egresado'],true)&&$path==='academico.docs'&&$old!==null)throw new PortalError(403,'No puedes modificar documentos ya emitidos.');
        if($role==='docente'&&$path==='personas'&&array_diff($changes,['cv','titulo','dni','telefono','foto','modPor','modEn']))throw new PortalError(403,'El docente solo puede modificar su propio CV.');
        if($role==='empresa') {
            $allowed=match($path){
                'academico.empresas'=>['nom','sector','ubic','dir','contacto','cargoC','correo','tel','web','logo'],
                'academico.postulaciones'=>['estado','observacion','nota'],
                'academico.ofertas'=>['id','emp','puesto','desc','req','modal','ubic','vac','prog','requisitos','descripcion','beneficios','limite','fecha','estado'],default=>[]};
            if(array_diff($changes,$allowed))throw new PortalError(403,'La empresa no puede modificar esos campos.');
            if($path==='academico.ofertas'&&($new['estado']??'')==='Publicada'&&array_diff($changes,['estado']))throw new PortalError(403,'Los cambios de una oferta publicada deben enviarse nuevamente a validación.');
            if($path==='academico.ofertas'&&($new['estado']??'')!==($old['estado']??'')&&!in_array($new['estado']??'',['Por validar','Cerrada'],true))throw new PortalError(403,'La publicación necesita validación institucional.');
        }
        if(in_array($role,['estudiante','egresado'],true)&&$path==='academico.postulaciones'&&($old!==null||($new['estado']??'')!=='Recibida'))throw new PortalError(403,'Solo puedes registrar tu propia postulación.');
        if($path==='documentos'&&($new['estado']??'')==='Histórico'&&!in_array($old['estado']??'',['Publicado','Histórico'],true))throw new PortalError(403,'La publicación de documentos históricos también requiere aprobación del administrador.');
        $publish=self::definitions()['roles'][$role]['publish']??false;
        if(!str_starts_with($path,'academico.')&&in_array($new['estado']??'',['Publicado','Publicada'],true)&&!$publish&&($old['estado']??'')!==$new['estado'])throw new PortalError(403,'Tu rol no puede publicar contenido.');
        if(in_array($path,['documentos','admisiones','convocatorias'],true)&&in_array($new['estado']??'',['Publicado','Publicada','Histórico'],true)&&(($old['estado']??'')!==$new['estado']||array_diff($changes,['modEn','modPor','estado','observacion'])))throw new PortalError(403,'La publicación requiere aprobación del administrador.');
    }
}
