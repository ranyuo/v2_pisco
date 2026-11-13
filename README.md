# Intranet IESTP Pisco

Aplicación de **gestión académica y administrativa** del IESTP Pisco, con el mismo enfoque que la intranet de Palpa (`ranyuo/v2_palpa`). La **web institucional** (portada, noticias, eventos, admisión, matrícula, becas, TUPA, transparencia y documentos de gestión) **se administra por separado**: esta aplicación ya no la publica ni la edita, y el servidor rechaza esos cambios incluso al administrador. Los datos heredados de la web se conservan en la base; no se borran. Ver [ALCANCE-INTRANET.md](ALCANCE-INTRANET.md).

La entrada `/` abre el **inicio de sesión**. Cada usuario ve en **«Mi panel»** solo los módulos de su perfil:

| Grupo | Módulo | Gestión en la intranet | Página independiente |
| --- | --- | --- | --- |
| Gestión académica | Horarios | `#/admin/ix-horarios` | `/horarios.php` (docentes y estudiantes ven su horario) |
| Gestión académica | Certificación modular | `#/admin/ix-certificados` | `/certificados.php` (validación de documentos) |
| Gestión académica | Grados y títulos | `#/admin/ix-titulos` | `/certificados.php` |
| Gestión administrativa | Mesa de partes | `#/admin/expedientes` | `/mesa-de-partes.php` |
| Gestión administrativa | Libro de reclamaciones | `#/admin/reclamos` | `/libro-de-reclamaciones.php` |
| Gestión administrativa | Bolsa laboral | `#/admin/ix-bolsa` | `/bolsa-laboral.php` |
| Perfiles profesionales | CV docente | `#/admin/cvdocente` | `/cv-docente.php` (directorio docente y acceso del docente a su CV) |

Programas, alumnos, personal docente y la configuración académica son catálogos de soporte; usuarios, configuración, auditoría y respaldos son herramientas comunes. Las páginas independientes muestran solo su servicio, sin el menú de la intranet, y se pueden enlazar desde la web institucional. La dirección de esa web se indica con `website_url` en `config.php` (por omisión `https://iestppisco.edu.pe/`).


Archivos para publicar en Hostinger:

- `portal-private/`: código PHP, vistas y datos. Va **fuera** de `public_html`, al mismo nivel.
- `public_html/`: raíz pública del dominio, con la página, la intranet, el CSS, el JavaScript y las imágenes.

El archivo `portal-private/config.php` (datos de la base de datos y clave de instalación) **no se guarda en GitHub**: el repositorio es público. Se crea a partir de `portal-private/config.example.php`.

## Requisitos del hosting

- **PHP 8.1 o superior** con las extensiones `pdo_mysql`, `fileinfo`, `openssl`, `zlib`, `json` y `session` (Hostinger las trae activas). `mbstring` es recomendable.
- **MariaDB 10.4+ o MySQL 8** (en hPanel, «MySQL» es MariaDB). **Una base de datos por sitio:** las tablas usan el prefijo fijo `pisco_`.
- El sitio debe estar en la **raíz de un dominio o subdominio** (no en una subcarpeta).
- Carpetas con permiso de escritura: `portal-private/` (bloqueo de instalación, `backups/` y la configuración SMTP guardada desde la intranet) y `public_html/assets/cache/`.

## Instalación nueva

1. **Base de datos:** en hPanel › *Bases de datos › Bases de datos MySQL*, crea una base y un usuario con su contraseña. Anota los tres datos.
2. **Descarga el código:** en GitHub, *Code › Download ZIP*.
3. **Sube y extrae:** con el *Administrador de archivos*, sube el ZIP a la carpeta del dominio (la que contiene `public_html`) y extráelo. GitHub mete todo en una carpeta `pisco-main/`; mueve `portal-private/` y `public_html/` desde ahí a la carpeta del dominio y reemplaza el `public_html` vacío.
4. **Configura:** copia `portal-private/config.example.php` como `portal-private/config.php` y completa:
   - `db_name`, `db_user` y `db_password`;
   - `install_key`: una clave privada aleatoria de 32 caracteres o más. Guárdala.
5. **Instala:** abre `https://tu-dominio/install.php`, escribe la `install_key` y crea la cuenta del administrador principal.
6. **Borra** `public_html/install.php`. Después de instalar ya no sirve: si lo vuelves a abrir responde «El portal ya está instalado» (código 410). Mientras el portal no esté instalado, la portada muestra un aviso que indica abrir `/install.php`.
7. **Permisos:** `public_html/assets/cache/` debe tener permisos **755**.
8. **Comprueba:**
   - Abre el sitio y entra a la intranet con la cuenta creada.
   - Revisa *Configuración*: datos institucionales y logo.
   - En *Mesa de partes › Áreas receptoras › Editar áreas*, carga las áreas reales con sus correos.
   - En *Usuarios y roles*, crea las cuentas del personal.
   - Publica desde la intranet el TUPA, los documentos de gestión y los reconocimientos oficiales de Pisco: el paquete inicial no los incluye.

**Correo de notificaciones (recomendado):** en la intranet, *Configuración › Configurar correo notificador (SMTP)*, indica el servidor, la cuenta y su contraseña de aplicación y activa el envío. Después, en hPanel › *Avanzado › Trabajos cron*, crea una tarea **cada minuto** con `php /home/<usuario>/domains/<dominio>/portal-private/mail-worker.php` para los reintentos. Los avisos de Mesa de partes, Libro de reclamaciones y Bolsa laboral quedan en una cola privada (`pisco_mail`) y se reintentan hasta cinco veces; el estado se revisa en *Configuración › Notificaciones por correo*. Si no se configura SMTP el portal funciona igual y los avisos quedan pendientes.

**Consulta de DNI y RUC (opcional):** en *Configuración › Consulta de DNI y RUC (API)* el administrador elige el proveedor (MIGO API v2 o Decolecta), pega el token de su plan, define los límites de consultas por visitante (por omisión 8 por minuto y 40 por hora) y prueba la conexión con un DNI o RUC. Al activarla, en la Mesa de Partes y en el Libro de Reclamaciones un DNI completa nombres y apellidos y un RUC completa la razón social (o los nombres, si es RUC 10); los campos siguen siendo editables. El navegador consulta al propio portal y el servidor al proveedor: el token se guarda cifrado en `portal-private/.document-lookup.json` y nunca llega al navegador. Requiere la extensión cURL de PHP (activa en Hostinger). Cada consulta consume créditos del plan del proveedor.

**Opcional, respaldos automáticos:** en hPanel › *Avanzado › Trabajos cron*, crea una tarea diaria con `php /home/<usuario>/domains/<dominio>/portal-private/cron.php`. Luego actívala en la intranet, en *Copias de seguridad*.

**Retención de la auditoría:** el historial de auditoría se conserva 24 meses y lo más antiguo se elimina una vez al día, desde `mail-worker.php` o `cron.php` (basta con que una de las dos tareas esté programada). Para cambiar el plazo, define `'audit_retention_months'` en `config.php` (mínimo 6; `0` lo conserva sin límite). Cada depuración queda registrada en la propia auditoría como «Depurar auditoría».

## Actualizar una instalación existente

Sube `portal-private/` y `public_html/` encima de las carpetas actuales y acepta **sobrescribir**. **No borres las carpetas antes:** así se conservan `config.php`, `backups/` y la configuración SMTP guardada (`.smtp-settings.json`). Después, borra `public_html/install.php`.

Si la base aún tiene registros heredados de Chincha (TUPA, documentos, reconocimientos, becarios o programas en borrador), elimínalos desde la intranet. Borra también del servidor `public_html/actualizar.php`, `public_html/recuperar.php` y la carpeta `public_html/assets/chincha/` si siguen allí: ya no forman parte del sistema.

La base de datos se actualiza sola la primera vez que se abre el sitio con la versión nueva (por ejemplo, crea la cola de correo `pisco_mail`); no se pierden datos ni cuentas.

## Dónde se edita

- **CSS y JavaScript del portal:** `public_html/assets/app/` (`portal.css` y `portal-1.js` a `portal-4.js`).
- **Armazón de la página:** `portal-private/views/portal.php`.
- **Contenido inicial** que carga la instalación: `portal-private/data/portal.json`.
- **Imágenes y documentos:** `public_html/assets/pisco/`. Las imágenes grandes tienen una copia `.webp` que el servidor entrega a los navegadores compatibles.

### Web institucional

La apariencia del portal, el carrusel de programas, las noticias y demás contenidos de la web institucional ya no se administran desde esta aplicación (enfoque de intranet, como Palpa). Sus datos anteriores siguen en la base por si se necesitan.

### Recuperación de contraseña por correo

En el ingreso a la intranet, en las tarjetas de la Bolsa Laboral y en *Mi acceso laboral*, el enlace **«¿Olvidaste tu contraseña?»** envía un **código de 6 dígitos** al correo registrado en la cuenta (vence en 15 minutos, 5 intentos, máximo 3 códigos por hora por cuenta). Con el código se crea una contraseña nueva (mínimo 12 caracteres): se cierran las sesiones abiertas, se desbloquea la cuenta si estaba bloqueada por intentos fallidos y llega un aviso del cambio al correo. La respuesta es la misma exista o no la cuenta. Las cuentas sin correo real (las creadas sin correo usan `usuario@portal.invalid`) siguen restableciéndose en la institución. Requiere el correo notificador (SMTP).

### Bolsa Laboral: diseño con perfiles y carga masiva

- **Diseño de la página pública (configurable):** en *Bolsa laboral › Página pública* el administrador (o Atención al ciudadano) elige entre el **diseño actual** y el **diseño con perfiles**: una portada con tres tarjetas de ingreso (**Estudiante/Egresado**, **Administrador** y **Empresa**), con su título y una foto por tarjeta que se puede cambiar o quitar (sin foto se muestra el ícono del perfil). Debajo se mantienen las ofertas, el registro de empresas y «¿Cómo postular?». Se aplica a `#/servicios/bolsa-laboral` y a `/bolsa-laboral.php`; cambiar de diseño no modifica ofertas, empresas ni postulaciones. Las fotos iniciales son del propio instituto (estudiantes y personal); Empresa empieza sin foto.
- **Ingreso por perfil:** cada tarjeta admite solo su tipo de cuenta, y el servidor lo exige: Estudiante/Egresado (DNI), Administrador (personal del instituto) y Empresa (RUC). Si alguien usa la tarjeta equivocada, se le indica la que corresponde. Todos continúan en su espacio de Bolsa Laboral de la intranet.
- **Registro en línea de egresados:** en la página de la Bolsa Laboral (*Registrarme como egresado*), el egresado escribe su DNI, apellidos y nombres, programa, año de egreso, correo y celular, y **crea su propia contraseña** (mínimo 12 caracteres). Recibe en su correo un **código de 6 dígitos** (vence en 30 minutos, 5 intentos; puede pedir uno nuevo) para confirmar que el correo es suyo. Si el padrón ya lo registra como egresado o titulado **con ese mismo correo**, su cuenta se activa al confirmar; si no figura, figura como estudiante o con otro correo, la solicitud pasa a *Bolsa laboral › Registro de egresados*, donde Secretaría Académica (o quien tenga edición de Alumnos o de la Bolsa; el coordinador, solo de su programa) la **aprueba** o la **rechaza con un motivo**. Al aprobar, la persona se agrega (o actualiza) en el padrón como egresada y su cuenta usa la contraseña que creó. **El egresado recibe un correo en cada paso:** código, solicitud en revisión, cuenta activa o motivo del rechazo; el responsable de la Bolsa recibe aviso de cada solicitud nueva. Sin SMTP configurado el código no llega: el personal puede aprobar una solicitud con el correo sin confirmar tras verificar la identidad en persona. La contraseña elegida se guarda solo como hash en la tabla privada `pisco_graduate_requests` (fuera del estado del portal y de los respaldos).
- **Cierre automático de ofertas vencidas:** una oferta «Publicada» cuya fecha límite ya pasó queda «Cerrada» (el día límite todavía admite postulaciones). Se avisa a la empresa y a cada postulante en la intranet y por correo, y queda en la auditoría. Lo hacen `mail-worker.php` (cada minuto) y `cron.php` (diario); si no hay tareas cron, también se cierra después de cargar cualquier página del portal.
- **Carga masiva por Excel** (*Bolsa laboral › Carga masiva*), con cualquiera de los dos diseños: estudiantes y egresados (padrón), **empresas** y **ofertas**. Cada una tiene su plantilla descargable, vista previa con validación fila por fila (RUC con dígito verificador, correo, modalidad, programa, fechas) e importación solo de las filas válidas. Las empresas cargadas quedan validadas por el instituto; las ofertas cargadas quedan publicadas.

## Usar este sistema para otro instituto

El código es el mismo para todos los institutos; lo propio de cada uno está en la base de datos (editable desde la intranet) y en el contenido inicial.

1. **Contenido inicial:** `portal-private/data/portal.json` es el de Pisco (personal, noticias, programas, enlaces, colores). Reemplázalo por el del nuevo instituto antes de instalar, o instala y edita todo desde la intranet. Las imágenes de `public_html/assets/pisco/` son de Pisco: no las publiques en otro sitio; deja solo los archivos del nuevo instituto.
2. **Base de datos propia** y `config.php` propio, con una `install_key` nueva (no copies `portal-private/` de otro sitio: la configuración SMTP guardada está cifrada con esa clave e incluye la cuenta del otro instituto). Opcionalmente, la ruta del archivo de configuración se puede indicar con la variable de entorno `PORTAL_CONFIG_FILE`.
3. Instala como se indica arriba y completa en la intranet:
   - *Configuración*: nombre, nombre corto, sigla del logo, logo, dirección, **distrito y región** (se usan en el pie de la intranet, en los títulos emitidos y en los datos para buscadores), teléfono, correo, redes, SEO y WhatsApp.
   - *Apariencia del portal*: estructura, colores y letras.
   - *Enlaces y servicios*: DRE o GRE de la región (el pie muestra el nombre del enlace `dre`), plataforma virtual, correo y biblioteca.
   - *Mesa de partes*: prefijo de numeración, correo, teléfono, áreas y feriados regionales. Los feriados nacionales del Perú (incluida Semana Santa) se aplican solos cada año.
   - *Libro de reclamaciones*, *Bolsa laboral* y el correo notificador (SMTP).
4. Programa los trabajos cron de `mail-worker.php` (cada minuto) y `cron.php` (diario).

## Pruebas

`bash tests/run.sh` corre la suite completa (instalación, integridad, permisos, respaldos, SMTP con un servidor local y datos masivos) en contenedores Docker desechables; `python3 tests/vendor-audit.py --advisories` comprueba las bibliotecas del navegador. GitHub Actions ejecuta ambas en cada cambio. Detalles en [tests/README.md](tests/README.md).
