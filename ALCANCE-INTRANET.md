# Alcance de la intranet Pisco

Pisco adopta el mismo enfoque que la intranet de Palpa (`ranyuo/v2_palpa`): la aplicación es una **intranet de gestión** y la **web institucional se administra por separado**.

## Web y aplicación

- La web institucional conserva comunicación, historia, autoridades, oferta académica pública, noticias, eventos, admisión, matrícula, becas, transparencia, TUPA y documentos de gestión.
- Esta aplicación abre un acceso privado (`/` → inicio de sesión) y muestra las herramientas según el usuario autenticado.
- Los datos editoriales heredados no se borran: dejan de enviarse al navegador y no pueden modificarse.

## Módulos

| Módulo | Ruta de gestión | Página independiente | Dependencias |
| --- | --- | --- | --- |
| Horarios | `#/admin/ix-horarios` | `/horarios.php` | Programas, unidades, docentes, disponibilidad, ambientes, ciclos y periodos |
| Certificación modular | `#/admin/ix-certificados` | `/certificados.php` | Maestro de alumnos, módulos formativos, notas y certificaciones |
| Grados y títulos | `#/admin/ix-titulos` | `/certificados.php` | Alumnos y egresados, registro institucional de títulos |
| Mesa de partes | `#/admin/expedientes` | `/mesa-de-partes.php` | Áreas, trámites, responsables, adjuntos, cargos y estados |
| Libro de reclamaciones | `#/admin/reclamos` | `/libro-de-reclamaciones.php` | Responsables, áreas, parámetros e historial |
| Bolsa laboral | `#/admin/ix-bolsa` | `/bolsa-laboral.php` | Empresas, ofertas, egresados, perfiles, CV y postulaciones |
| CV docente | `#/admin/cvdocente` | `/cv-docente.php` | Personal docente, formación, experiencia, certificados y proyectos |

Usuarios, roles, auditoría, respaldos y configuración son herramientas transversales.

## Páginas independientes

Cada página muestra solo su servicio, sin el menú de la intranet ni enlaces a los demás módulos, y comparte la sesión y la API:

- **Mesa de partes** y **Libro de reclamaciones**: registro, adjuntos, constancia y seguimiento.
- **Bolsa laboral**: ofertas, registro de empresas y de egresados, y «Mi acceso laboral».
- **Certificados**: validación de certificaciones, constancias y títulos.
- **Horarios** (nueva): docentes y estudiantes ingresan con su cuenta y ven su horario publicado; el personal que programa horarios lo hace en la intranet.
- **CV docente** (nueva): directorio profesional de la plana docente y acceso del docente para editar su CV.

## Separación técnica

- `portal-private/IntranetScope.php` define los módulos, excluye las colecciones editoriales del arranque y rechaza sus cambios en el servidor, incluso con solicitudes manuales a la API.
- Los roles solo pueden incluir módulos de la intranet (*Usuarios y roles*).
- Los formularios de contacto y boletín y la consulta de becarios de la web anterior quedan deshabilitados.
- `public_html/intranet.js` y `intranet.css` configuran el ingreso, «Mi panel», la navegación por grupos y las rutas permitidas. El menú no concede permisos: el servidor sigue verificándolos.
- `public_html/servicios-modulos.js` crea las páginas de Horarios y CV docente; `standalone-services.js` les da el marco independiente.

## Pruebas

- `tests/intranet.php`: alcance (módulos, colecciones excluidas, escrituras editoriales rechazadas, roles, formularios deshabilitados).
- `tests/browser-smoke.cjs`: ingreso en `/`, siete módulos en el panel, editores web denegados y las seis páginas independientes.
