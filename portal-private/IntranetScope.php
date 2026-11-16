<?php
declare(strict_types=1);

/**
 * Alcance de la intranet de Pisco (mismo enfoque que Palpa): gestión académica y administrativa por módulos.
 * La web institucional (portada, noticias, admisión, TUPA, transparencia…) se administra por separado:
 * sus colecciones no se envían al navegador y el servidor rechaza cualquier cambio, incluso del administrador.
 * Los datos heredados se conservan en la base: no se borran.
 */
final class IntranetScope
{
    /** Módulos de la intranet: siete funcionales (Horarios, Certificación modular, Grados y títulos, Mesa de partes,
     *  Libro de reclamaciones, Bolsa laboral y CV docente), catálogos de soporte y herramientas de administración. */
    public const MODULES = ['dashboard','perfil','programas','docentes','cvdocente','ix-alumnos','ix-horarios','ix-certificados','ix-titulos','ix-bolsa','ix-config','certificados','reclamos','expedientes','config','usuarios','auditoria','respaldo'];
    private const EDITORIAL = ['slides','enlaces','reconocimientos','jerarquica','egresados','categoriasNoticia','noticias','eventos','tiposDocumento','documentos','tupa','tupaDocs','estadisticas','licenciamiento','inversiones','convocatorias','admisiones','matriculas','tiposBeca','becasPeriodos','becarios','locales','servicios','mensajes','suscriptores'];
    /** Ajustes de configuración que siguen administrándose desde la intranet. */
    private const SETTINGS = ['inst','mpv','lr','bolsa','limites','contadores','correoReclamos','enlacesV2'];
    /** Colecciones que los módulos de la intranet pueden modificar. */
    private const WRITABLE = ['programas','personas','academico','reclamos','expedientes','certificados','config','usuarios','auditoria','visitas','correos','__v'];

    public static function website(array $config): string
    {
        $url=$config['website_url']??'https://iestppisco.edu.pe/';
        return is_string($url)&&preg_match('#^https://[^\s"<>]+$#',$url)?$url:'https://iestppisco.edu.pe/';
    }
    public static function project(array $data): array
    {
        foreach(self::EDITORIAL as $key)if(isset($data[$key]))$data[$key]=[];
        // Solo los textos legales y la presentación del directorio docente respaldan los servicios de la intranet.
        $data['paginas']=array_values(array_filter($data['paginas']??[],fn($p)=>in_array($p['clave']??'',['privacidad','terminos','docentes'],true)));
        return $data;
    }
    public static function assertChanges(array $visible,array $incoming): void
    {
        foreach($incoming as $key=>$value)if(!in_array($key,self::WRITABLE,true)&&!PortalPolicy::equal($value,$visible[$key]??null))throw new PortalError(403,'La web institucional se administra por separado. Este módulo no pertenece a la intranet.');
        foreach([...self::EDITORIAL,'paginas'] as $key)if(!PortalPolicy::equal($incoming[$key]??null,$visible[$key]??null))throw new PortalError(403,'La web institucional se administra por separado. Este módulo no pertenece a la intranet.');
        foreach($incoming['config']??[] as $key=>$value)if(!in_array($key,self::SETTINGS,true)&&!PortalPolicy::equal($value,$visible['config'][$key]??null))throw new PortalError(403,'Ese parámetro pertenece a la web institucional y no se administra desde la intranet.');
    }
    public static function roles(array $roles): array
    {
        foreach($roles as &$role)$role['mods']=array_values(array_intersect($role['mods'],self::MODULES));
        unset($role);return $roles;
    }
}
