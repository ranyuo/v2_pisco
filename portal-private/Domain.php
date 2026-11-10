<?php
declare(strict_types=1);
final class PortalDomain
{
    private static function changedRows(array $old,array $new,string $path): array
    {
        $before=[];foreach($old as $r)$before[PortalPolicy::key($path,$r)]=$r;
        return array_values(array_filter($new,fn($r)=>!PortalPolicy::equal($before[PortalPolicy::key($path,$r)]??null,$r)));
    }
    private static function required(array $row,array $keys,string $label): void
    {foreach($keys as $k)if(!isset($row[$k])||$row[$k]===''||$row[$k]===[])throw new PortalError(422,$label.': falta '.$k.'.');}
    private static function foreign(array $rows,mixed $id,string $label): array
    {return PortalPolicy::find($rows,'id',$id)??throw new PortalError(422,$label.' no existe.');}
    public static function validate(array $old,array &$new,array $user): void
    {
        $contracts=PortalPolicy::definitions()['specs'];
        foreach($contracts as $spec){$key=$spec['collection'];if($key==='usuarios'||!isset($new[$key])||!array_is_list($new[$key]))continue;
            foreach(self::changedRows($old[$key]??[],$new[$key],$key) as $r){
                $prior=PortalPolicy::find($old[$key]??[],'id',$r['id']??null);
                if($r['deleted']??false)continue;
                foreach($spec['fields'] as $f){$v=$r[$f['name']]??null;
                    if($key==='documentos'&&$f['name']==='archivo'&&($r['refModulo']??'')==='admision')$v=$r['archivoRef']??null;
                    $empty=$v===null||$v===''||$v===[];
                    if(($f['required']||($f['publishRequired']&&in_array($r['estado']??'',['Publicado','Publicada','En revisión'],true)))&&$empty&&(!$prior||!empty($prior[$f['name']])))throw new PortalError(422,$key.': completa '.$f['name'].'.');
                    if($empty)continue;
                    if($f['unique'])foreach($new[$key] as $other)if(!($other['deleted']??false)&&($other['id']??null)!==($r['id']??null)&&isset($other[$f['name']])&&strtolower(trim((string)$other[$f['name']]))===strtolower(trim((string)$v)))throw new PortalError(422,'Valor duplicado en '.$key.'.'.$f['name'].'.');
                    if($f['type']==='date'&&(!is_string($v)||!preg_match('/^\d{4}-\d{2}-\d{2}$/',$v)||($date=DateTimeImmutable::createFromFormat('!Y-m-d',$v))===false||$date->format('Y-m-d')!==$v))throw new PortalError(422,'Fecha no válida en '.$f['name'].'.');
                    if($f['type']==='datetime-local'&&(!is_string($v)||strtotime($v)===false))throw new PortalError(422,'Fecha y hora no válida.');
                    if($f['type']==='image'&&(!$prior||!PortalPolicy::equal($v,$prior[$f['name']]??null))&&!PortalRules::safeImage($v))throw new PortalError(422,'La imagen o su URL no es válida.');
                    if($f['type']==='email'&&(!is_string($v)||!filter_var($v,FILTER_VALIDATE_EMAIL)))throw new PortalError(422,'Correo no válido.');
                    if($f['type']==='url'&&!PortalRules::safeLink($v,false))throw new PortalError(422,'URL no válida.');
                    if($f['type']==='number'&&(!is_numeric($v)||(isset($f['min'])&&$v<$f['min'])))throw new PortalError(422,'Número no válido en '.$f['name'].'.');
                    if(isset($f['max'])&&is_string($v)&&preg_match_all('/./us',$v)>$f['max'])throw new PortalError(422,'Texto demasiado largo en '.$f['name'].'.');
                }
                if($spec['states']&&!in_array($r['estado']??'',array_merge($spec['states'],['En revisión']),true))throw new PortalError(422,'Estado no válido para '.$key.'.');
            }
        }
        foreach($new['academico']['docentes'] as &$teacher){$person=PortalPolicy::find($new['personas'],'id',$teacher['per']??'');if($person){$teacher['nom']=trim($person['nombres'].' '.$person['apellidos']);$teacher['dni']=$person['dni']??'';$teacher['correo']=$person['correo']??'';$teacher['esp']=$person['especialidad']??'';$teacher['cond']=$person['condicion']??'';}}unset($teacher);
        foreach($new['programas'] as $program){$academicId=$new['academico']['progMap'][$program['id']]??null;if($academicId!==null)foreach($new['academico']['programas'] as &$academic)if($academic['id']===$academicId){$academic['nombre']=$program['nombre'];$academic['activo']=($program['estado']??'')==='Publicado';$academic['pid']=$program['id'];}unset($academic);}
        foreach(self::changedRows($old['becarios']??[],$new['becarios']??[],'becarios') as $r){
            if($r['deleted']??false)continue;
            if(!empty($r['dni'])&&!preg_match('/^[0-9]{8}$/',(string)$r['dni']))throw new PortalError(422,'El DNI del beneficiario debe tener ocho dígitos.');
            $period=self::foreign($new['becasPeriodos'],$r['periodoId']??null,'Periodo de becas');self::foreign($new['programas'],$r['programaId']??null,'Programa');self::foreign($new['tiposBeca'],$r['tipoId']??null,'Tipo de beca');
            if(($period['estado']??'')==='Cerrado'&&PortalPolicy::role($user)!=='admin')throw new PortalError(403,'El periodo de becas está cerrado.');
            foreach($new['becarios'] as $other){
                $samePerson=!empty($r['dni'])?($other['dni']??'')===$r['dni']:PortalRules::normal(($other['nombres']??'').' '.($other['apellidos']??''))===PortalRules::normal(($r['nombres']??'').' '.($r['apellidos']??''));
                if(!($other['deleted']??false)&&$other['id']!==$r['id']&&$samePerson&&$other['periodoId']===$r['periodoId']&&$other['programaId']===$r['programaId']&&$other['tipoId']===$r['tipoId'])throw new PortalError(422,'Beneficiario duplicado en ese periodo, programa y tipo de beca.');
            }
        }
        $a=&$new['academico'];$o=$old['academico'];
        foreach(self::changedRows($o['estudiantes'],$a['estudiantes'],'academico.estudiantes') as $r){
            self::required($r,['dni','nom','prog','periodo','ciclo','sec','turno','estado'],'Alumno');
            if(!preg_match('/^[0-9]{8}$/',(string)$r['dni']))throw new PortalError(422,'El DNI del alumno debe tener ocho dígitos.');
            self::foreign($a['programas'],$r['prog'],'Programa');
            if(!in_array($r['estado'],['Regular','Retirado','Egresado','Titulado'],true))throw new PortalError(422,'Estado académico no válido.');
            if(!empty($r['correo'])&&!filter_var($r['correo'],FILTER_VALIDATE_EMAIL))throw new PortalError(422,'Correo del alumno no válido.');
            foreach($a['estudiantes'] as $other)if($other['id']!==$r['id']&&$other['dni']===$r['dni'])throw new PortalError(422,'Ya existe un alumno con ese DNI.');
        }
        foreach(self::changedRows($o['sesiones'],$a['sesiones'],'academico.sesiones') as $r){
            self::required($r,['per','prog','ciclo','sec','turno','ud','dia','ini','fin'],'Clase');
            foreach(['prog','ud','doc','amb'] as $field)if(isset($r[$field])&&$r[$field]!==''&&$r[$field]!==null&&(!is_int($r[$field])||$r[$field]<1))throw new PortalError(422,'Referencia de clase no válida: '.$field.'.');
            PortalAcademic::validateGroup($r);
            if(!PortalAcademic::validPeriod($r['per'])||!in_array($r['dia'],PortalAcademic::DAYS,true))throw new PortalError(422,'Periodo o día de clase no válido.');
            self::foreign($a['programas'],$r['prog'],'Programa');$ud=self::foreign($a['uds'],$r['ud'],'Unidad didáctica');
            if($ud['prog']!==$r['prog']||$ud['ciclo']!==$r['ciclo'])throw new PortalError(422,'La unidad didáctica pertenece a otro programa o ciclo.');
            if(!preg_match('/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/',$r['ini'])||!preg_match('/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/',$r['fin'])||$r['ini']>=$r['fin'])throw new PortalError(422,'Intervalo de clase no válido.');
            if(!empty($r['doc']))self::foreign($a['docentes'],$r['doc'],'Docente');if(!empty($r['amb']))self::foreign($a['ambientes'],$r['amb'],'Ambiente');
        }
        foreach($a['publicados'] as $group=>$publication){
            $lessons=array_values(array_filter($a['sesiones'],fn($s)=>self::group($s)===$group));
            $oldLessons=array_values(array_filter($o['sesiones'],fn($s)=>self::group($s)===$group));
            $affected=!PortalPolicy::equal($o['publicados'][$group]??null,$publication)||!PortalPolicy::equal($oldLessons,$lessons);
            foreach($lessons as $lesson)foreach(['docentes'=>['doc',['dias','desde','hasta']],'ambientes'=>['amb',['prog','cap']]] as $collection=>[$field,$keys]){
                $oldResource=PortalPolicy::find($o[$collection],'id',$lesson[$field]??null)??[];$newResource=PortalPolicy::find($a[$collection],'id',$lesson[$field]??null)??[];
                foreach($keys as $key)if(!PortalPolicy::equal($oldResource[$key]??null,$newResource[$key]??null))$affected=true;
            }
            if(!$affected)continue;
            if(!$lessons)throw new PortalError(422,'No se puede publicar un horario vacío.');
            foreach($lessons as $s){
                foreach($a['sesiones'] as $other){
                    if($other['id']===$s['id']||$other['per']!==$s['per']||$other['dia']!==$s['dia']||$s['ini']>=$other['fin']||$other['ini']>=$s['fin'])continue;
                    if((!empty($s['doc'])&&$s['doc']===$other['doc'])||(!empty($s['amb'])&&$s['amb']===$other['amb'])||self::group($other)===$group)throw new PortalError(422,'El horario tiene un cruce de docente, ambiente o sección. Corrígelo antes de publicar.');
                }
                $teacher=PortalPolicy::find($a['docentes'],'id',$s['doc']??null);$room=PortalPolicy::find($a['ambientes'],'id',$s['amb']??null);
                if($teacher&&(!in_array($s['dia'],$teacher['dias'],true)||$s['ini']<$teacher['desde']||$s['fin']>$teacher['hasta']))throw new PortalError(422,'La clase está fuera de la disponibilidad del docente.');
                if($room&&!empty($room['prog'])&&$room['prog']!==$s['prog'])throw new PortalError(422,'El ambiente está restringido a otro programa.');
            }
        }
        foreach(self::changedRows($o['certs'],$a['certs'],'academico.certs') as $r){
            self::required($r,['est','mod','fecha','num'],'Certificación');$s=self::foreign($a['estudiantes'],$r['est'],'Alumno');$m=self::foreign($a['modulos'],$r['mod'],'Módulo');
            if($s['prog']!==$m['prog']||$r['fecha']>date('Y-m-d'))throw new PortalError(422,'Módulo de otro programa o fecha futura.');
            foreach($a['certs'] as $other)if(($r['estadoDoc']??'Válido')!=='Anulado'&&($other['estadoDoc']??'Válido')!=='Anulado'&&$other['id']!==$r['id']&&(($other['est']===$r['est']&&$other['mod']===$r['mod'])||$other['num']===$r['num']))throw new PortalError(422,'Certificación duplicada.');
        }
        $gradeKey=fn(array $r)=>json_encode([(int)($r['est']??0),$r['periodo']??null,is_string($r['ud']??null)?PortalRules::normal($r['ud']):null],JSON_THROW_ON_ERROR);
        $gradeCounts=[];foreach($a['notas'] as $note){$key=$gradeKey($note);$gradeCounts[$key]=($gradeCounts[$key]??0)+1;}
        foreach(self::changedRows($o['notas'],$a['notas'],'academico.notas') as $r){
            self::required($r,['est','ud','periodo','nota'],'Nota');self::foreign($a['estudiantes'],$r['est'],'Alumno');
            if(!is_string($r['periodo'])||!preg_match('/^20[0-9]{2}-(?:I|II)$/D',$r['periodo']))throw new PortalError(422,'El periodo de la nota debe tener el formato 2026-I o 2026-II.');
            if(!is_string($r['ud'])||PortalRules::normal($r['ud'])==='')throw new PortalError(422,'Indica la unidad didáctica de la nota.');
            if(!is_numeric($r['nota'])||$r['nota']<0||$r['nota']>20)throw new PortalError(422,'La nota debe estar entre 0 y 20.');
            if($gradeCounts[$gradeKey($r)]>1)throw new PortalError(422,'Ya existe una nota para ese alumno, unidad didáctica y periodo.');
        }
        foreach(self::changedRows($o['titulos'],$a['titulos'],'academico.titulos') as $r){
            self::required($r,['est','culm','tit','cod','resol'],'Título');$student=self::foreign($a['estudiantes'],$r['est'],'Alumno');
            if(!in_array($student['estado'],['Egresado','Titulado'],true)||$r['tit']<$r['culm'])throw new PortalError(422,'El título requiere un egresado y fechas válidas.');
            foreach($a['titulos'] as $other)if($other['id']!==$r['id']&&(($other['cod']===$r['cod'])||(($r['estadoDoc']??'Válido')!=='Anulado'&&($other['estadoDoc']??'Válido')!=='Anulado'&&$other['est']===$r['est'])))throw new PortalError(422,'Título duplicado.');
            foreach($a['estudiantes'] as &$s)if($s['id']===$r['est'])$s['estado']='Titulado';unset($s);
        }
        foreach(self::changedRows($o['ofertas'],$a['ofertas'],'academico.ofertas') as $r){
            self::required($r,['emp','puesto','desc','req','modal','vac','limite','estado'],'Oferta');$company=self::foreign($a['empresas'],$r['emp'],'Empresa');
            if(($r['estado']??'')==='Publicada'&&!($company['validada']??false))throw new PortalError(422,'La empresa debe estar validada antes de publicar la oferta.');
            if(!is_numeric($r['vac'])||$r['vac']<1||$r['vac']>50)throw new PortalError(422,'Número de vacantes no válido.');
            if(PortalPolicy::role($user)==='empresa'&&!($company['validada']??false))throw new PortalError(403,'La empresa necesita aprobación institucional antes de publicar ofertas.');
        }
        foreach(self::changedRows($o['perfilesLab'],$a['perfilesLab'],'academico.perfilesLab') as $profile){self::foreign($a['estudiantes'],$profile['est']??null,'Alumno');if(!empty($profile['cv'])&&(($profile['cv']['type']??'')!=='application/pdf'||($profile['cv']['size']??0)>5*1024*1024))throw new PortalError(422,'El CV debe ser un PDF de hasta 5 MB.');}
        foreach(self::changedRows($o['postulaciones'],$a['postulaciones'],'academico.postulaciones') as $r){
            self::required($r,['est','of','fecha','estado'],'Postulación');$student=self::foreign($a['estudiantes'],$r['est'],'Alumno');$offer=self::foreign($a['ofertas'],$r['of'],'Oferta');
            $profile=PortalPolicy::find($a['perfilesLab'],'est',$r['est']);
            $isNew=!PortalPolicy::find($o['postulaciones'],'id',$r['id']);
            if($isNew&&(($offer['estado']??'')!=='Publicada'||$offer['limite']<date('Y-m-d')||!($profile['cv']??null)))throw new PortalError(422,'La oferta debe estar vigente y el postulante debe adjuntar su CV.');
            if($isNew&&!empty($offer['prog'])&&$offer['prog']!==$student['prog'])throw new PortalError(422,'La oferta corresponde a otro programa.');
            foreach($a['postulaciones'] as $other)if($other['id']!==$r['id']&&$other['est']===$r['est']&&$other['of']===$r['of'])throw new PortalError(422,'Ya existe una postulación a esa oferta.');
            if(!in_array($r['estado'],['Recibida','En revisión','Seleccionado','No seleccionado'],true))throw new PortalError(422,'Estado de postulación no válido.');
        }
        foreach(['programas'=>['estudiantes'=>'prog','uds'=>'prog','modulos'=>'prog','ambientes'=>'prog','sesiones'=>'prog','ofertas'=>'prog'],'estudiantes'=>['certs'=>'est','titulos'=>'est','notas'=>'est','perfilesLab'=>'est','postulaciones'=>'est'],'modulos'=>['certs'=>'mod','uds'=>'mod'],'uds'=>['sesiones'=>'ud'],'docentes'=>['sesiones'=>'doc'],'ambientes'=>['sesiones'=>'amb'],'empresas'=>['ofertas'=>'emp'],'ofertas'=>['postulaciones'=>'of']] as $collection=>$refs){
            foreach($o[$collection] as $r)if(!PortalPolicy::find($a[$collection],'id',$r['id']))foreach($refs as $related=>$field)if(PortalPolicy::find($a[$related],$field,$r['id']))throw new PortalError(422,'No se puede eliminar '.$collection.' porque tiene registros relacionados.');
        }
        foreach(['certs'=>'cert','titulos'=>'titulo'] as $collection=>$type)foreach($o[$collection] as $record)if(!PortalPolicy::find($a[$collection],'id',$record['id']))foreach($a['docs'] as $doc)if(($doc['tipo']??'')===$type&&($doc['ref']??null)===($type==='cert'?$record['est']:$record['id'])&&($doc['valido']??true))throw new PortalError(422,'El registro tiene documentos emitidos. Anula el documento antes de retirar su origen.');
        $codes=[];
        foreach($a['docs'] as &$doc){
            if(!is_array($doc)||!is_string($doc['cod']??null)||isset($codes[$doc['cod']]))throw new PortalError(422,'Código de documento vacío o duplicado.');$codes[$doc['cod']]=true;
            $issued=PortalPolicy::find($o['docs'],'cod',$doc['cod']);
            if($issued){
                if(!PortalPolicy::equal(array_diff_key($issued,['valido'=>1]),array_diff_key($doc,['valido'=>1])))throw new PortalError(422,'Los datos del documento emitido son históricos. Anúlalo y emite uno nuevo.');
                if(isset($doc['valido'])&&!is_bool($doc['valido']))throw new PortalError(422,'Estado del documento no válido.');
                if(($issued['valido']??true)===false&&($doc['valido']??true)!==false)throw new PortalError(422,'Un documento anulado no puede reactivarse.');
                continue;
            }
            if(!preg_match('/^[A-Z0-9-]{8,64}$/',(string)($doc['cod']??'')))throw new PortalError(422,'Código de documento no válido.');
            if(in_array($doc['tipo']??'',['cert','titulo'],true)){
                $module=$doc['tipo']==='cert'?'ix-certificados':'ix-titulos';
                if(in_array(PortalPolicy::role($user),['estudiante','egresado'],true)&&!PortalPolicy::can($user,$module))throw new PortalError(403,'Tu perfil no tiene habilitado ese tipo de documento.');
                if($doc['tipo']==='cert'){$student=self::foreign($a['estudiantes'],$doc['ref'],'Alumno');if(!array_filter($a['certs'],fn($c)=>$c['est']===$student['id']&&($c['estadoDoc']??'Válido')!=='Anulado'))throw new PortalError(422,'El alumno no tiene certificaciones registradas.');}
                else{$record=self::foreign($a['titulos'],$doc['ref'],'Documento');$student=self::foreign($a['estudiantes'],$record['est'],'Alumno');if(($record['estadoDoc']??'Válido')==='Anulado')throw new PortalError(422,'El título está anulado.');}
                if(in_array(PortalPolicy::role($user),['estudiante','egresado'],true)&&$student['id']!==PortalPolicy::binding($user,'est'))throw new PortalError(403,'Documento de otro alumno.');
                $doc['persona']=$student['nom'];$doc['fecha']=date(DATE_ATOM);$doc['por']=$user['nombre'];$doc['valido']=true;
            }elseif(PortalPolicy::role($user)!=='admin'&&PortalPolicy::level($new,$user,'certificados')<2)throw new PortalError(403,'No puedes emitir ese documento.');
        }unset($doc);
    }
    public static function group(array $s): string{return implode('|',[$s['prog'],$s['ciclo'],$s['sec'],$s['turno'],$s['per']]);}
    public static function syncCertificates(array &$data): void
    {
        $a=$data['academico'];$active=[];
        foreach(['certs'=>['cert','num','Certificado modular','fecha'],'titulos'=>['tit','cod','Título de Profesional Técnico','tit']] as $key=>[$prefix,$codeKey,$type,$dateKey]){
            foreach($a[$key] as $row){$student=PortalPolicy::find($a['estudiantes'],'id',$row['est']);if(!$student)continue;$ref='ix:'.$prefix.':'.$row['id'];$active[]=$ref;
                $programId=array_search($student['prog'],$a['progMap']??[],true);$m=$key==='certs'?PortalPolicy::find($a['modulos'],'id',$row['mod']):null;
                $canonical=['id'=>'academic-'.$prefix.'-'.$row['id'],'ref'=>$ref,'codigo'=>strtoupper($row[$codeKey]),'dni'=>$student['dni'],'nombres'=>$student['nom'],'programaId'=>$programId?:'','tipo'=>$type,'detalle'=>$m?($m['cod'].' · '.$m['nombre']):($row['resol']??''),'fecha'=>$row[$dateKey],'origen'=>$key==='certs'?'Certificación modular':'Grados y títulos'];
                self::putCertificate($data,$canonical);
            }
        }
        foreach($a['docs'] as $doc){$holder=null;if(($doc['tipo']??'')==='cert')$holder=PortalPolicy::find($a['estudiantes'],'id',$doc['ref']??null);elseif(($doc['tipo']??'')==='titulo'){$source=PortalPolicy::find($a['titulos'],'id',$doc['ref']??null);if($source)$holder=PortalPolicy::find($a['estudiantes'],'id',$source['est']);}$canonical=['id'=>'issued-'.$doc['cod'],'ref'=>'document:'.$doc['cod'],'codigo'=>strtoupper($doc['cod']),'dni'=>$holder['dni']??'','nombres'=>$holder['nom']??$doc['persona'],'programaId'=>'','tipo'=>['cert'=>'Certificado modular','titulo'=>'Título de Profesional Técnico','horario'=>'Horario académico','cargo'=>'Cargo de recepción'][$doc['tipo']]??'Constancia','fecha'=>substr($doc['fecha'],0,10),'origen'=>'Documento emitido','estado'=>($doc['valido']??true)?'Válido':'Anulado'];self::putCertificate($data,$canonical);if(!($doc['valido']??true))foreach($data['certificados'] as &$issued)if(($issued['ref']??'')===$canonical['ref'])$issued['estado']='Anulado';unset($issued);}
        foreach($data['certificados'] as &$r)if(preg_match('/^ix:(cert|tit):/',$r['ref']??'')&&!in_array($r['ref'],$active,true)&&($r['estado']??'')==='Válido'){$r['estado']='Anulado';$r['motivo']='Retirado del registro académico';}unset($r);
    }
    private static function putCertificate(array &$data,array $canonical): void
    {
        $target=null;$adopt=null;
        foreach($data['certificados'] as $i=>$existing)if(($existing['ref']??'')===$canonical['ref'])$target=$i;
        $legacyTypes=['Certificado modular'=>['Certificado modular','Constancia de certificación modular'],'Título de Profesional Técnico'=>['Título de Profesional Técnico','Reporte de validación de título']];
        foreach($data['certificados'] as $i=>$existing){if(strtoupper((string)($existing['codigo']??''))!==strtoupper($canonical['codigo'])||$i===$target)continue;
            $compatible=in_array($existing['tipo']??'', $legacyTypes[$canonical['tipo']]??[$canonical['tipo']],true);
            if($target!==null||$adopt!==null||!empty($existing['ref'])||($existing['dni']??'')!==($canonical['dni']??'')||!$compatible)throw new PortalError(422,'El código de verificación ya pertenece a otro documento. Usa un código único.');
            $adopt=$i;
        }
        $target??=$adopt;
        if($target!==null){$data['certificados'][$target]+=array_diff_key($canonical,['id'=>1,'estado'=>1]);return;}
        $data['certificados'][]=['estado'=>'Válido',...$canonical];
    }
    public static function staff(array &$data,string $text,string $view): void
    {
        $notifs=&$data['academico']['notifs'];$next=max([0,...array_map(fn($n)=>(int)$n['id'],$notifs)])+1;
        foreach(['admin','adm'] as $role)$notifs[]=['id'=>$next++,'to'=>'r:'.$role,'txt'=>$text,'fecha'=>date('Y-m-d H:i'),'go'=>$view,'leido'=>[]];$notifs=array_slice($notifs,-3000);
    }
    public static function notifications(array $old,array &$new,array $accounts): void
    {
        $a=&$new['academico'];$next=max([0,...array_map(fn($n)=>(int)$n['id'],$a['notifs'])])+1;
        $notify=function(string $binding,string $text,string $view)use(&$a,&$next,$accounts){foreach($accounts as $u)if(($u['vin']??'')===$binding)$a['notifs'][]=['id'=>$next++,'to'=>'u:'.$u['ixId'],'txt'=>$text,'fecha'=>date('Y-m-d H:i'),'go'=>$view,'leido'=>[]];};
        foreach(['certs'=>'certificados','titulos'=>'titulos'] as $key=>$view)foreach(self::changedRows($old['academico'][$key],$a[$key],'academico.'.$key) as $r)$notify('est:'.$r['est'],'Se actualizó tu registro de '.($key==='certs'?'certificación modular':'titulación').'.',$view);
        foreach(self::changedRows($old['academico']['postulaciones'],$a['postulaciones'],'academico.postulaciones') as $r){$offer=PortalPolicy::find($a['ofertas'],'id',$r['of']);$notify('est:'.$r['est'],'Estado de tu postulación: '.$r['estado'],'bolsa');if($offer)$notify('emp:'.$offer['emp'],'Se actualizó una postulación a '.$offer['puesto'],'bolsa');}
        foreach(self::changedRows($old['academico']['empresas'],$a['empresas'],'academico.empresas') as $r)$notify('emp:'.$r['id'],'Estado de validación: '.($r['estadoVal']??'Pendiente'),'bolsa');
        foreach($a['publicados'] as $group=>$published)if(!PortalPolicy::equal($old['academico']['publicados'][$group]??null,$published)){
            $parts=explode('|',$group);foreach($a['estudiantes'] as $student)if(count($parts)===5&&(string)$student['prog']===$parts[0]&&(string)$student['ciclo']===$parts[1]&&($student['sec']??'')===$parts[2]&&($student['turno']??'')===$parts[3])$notify('est:'.$student['id'],'Se publicó o actualizó tu horario académico.','horarios');
        }
        foreach(self::changedRows($old['academico']['ofertas'],$a['ofertas'],'academico.ofertas') as $offer)if(($offer['estado']??'')==='Publicada')foreach($a['estudiantes'] as $student)if(empty($offer['prog'])||(int)$student['prog']===(int)$offer['prog'])$notify('est:'.$student['id'],'Oferta laboral disponible: '.$offer['puesto'],'bolsa');
        foreach(self::changedRows($old['academico']['ofertas'],$a['ofertas'],'academico.ofertas') as $offer)if(($offer['estado']??'')==='Por validar')self::staff($new,'Oferta pendiente de validación: '.$offer['puesto'],'bolsa');
        $a['notifs']=array_slice($a['notifs'],-3000);
    }
}
