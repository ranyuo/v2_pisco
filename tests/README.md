# Pruebas de regresión

Requisitos: PHP 8.1+, `pdo_mysql` y una instancia MySQL/MariaDB de pruebas. No ejecutarlas con la configuración de producción.

1. Crea dos bases **vacías** con el mismo prefijo: por ejemplo `pisco_qa_test` y `pisco_qa_restore_test`.
2. Prepara un archivo PHP privado fuera del repositorio que devuelva la configuración de `portal-private/config.example.php`, con `db_name => 'pisco_qa_test'`, acceso a ambas bases, una `install_key` aleatoria de al menos 32 caracteres y `smtp => ['enabled' => false]`.
3. Ejecuta desde la raíz del checkout:

   ```sh
   PORTAL_TEST_CONFIG_FILE=/ruta/privada/qa-config.php php tests/regressions.php
   ```

El programa rechaza nombres de base que no terminan en `_test` y bases con tablas existentes. No elimina ni vacía bases automáticamente. Para repetirlo, prepara dos bases vacías de nuevo.

Comprueba idempotencia y rollback de adjuntos, cuotas compartidas con subidas multipart, validación y unicidad normalizada de notas, periodos históricos y restauración real del respaldo SQL con cola vacía y adjuntos conservados. Los datos son sintéticos y no se envía correo.

## Ejecución completa con Docker

```sh
bash tests/run.sh
PORTAL_TEST_PHP_VERSION=8.1 bash tests/run.sh
```

Necesita Docker, OpenSSL y Python 3. Crea una red privada, MariaDB y un receptor SMTP de pruebas con STARTTLS y una CA temporal; no publica puertos ni envía correo externo. Ejecuta las suites de estabilidad, correo y volumen, cada una en bases vacías propias. Elimina los contenedores, bases, red y certificados de esa ejecución al terminar. Conserva la imagen PHP para reutilizarla.

La suite de estabilidad comprueba también permisos revocados, identidades y formas de datos inválidas, documentos emitidos y respaldos programados. Correo verifica entrega y rechazo SMTP, reintentos, cancelación, cifrado y errores sin secretos. Volumen utiliza 401 alumnos y 2502 notas; sus tiempos son observaciones locales, no un benchmark del hosting.

El flujo `.github/workflows/qa.yml` ejecuta estas pruebas con PHP 8.1 y 8.3 en cada push y pull request.

## Pruebas de navegador con escritura

Usar una instalación local desechable cuya base haya sido preparada con `stability.php`, SMTP desactivado, raíz pública `public_html` y configuración privada correspondiente. Al ejecutar la suite PHP se puede establecer `PORTAL_TEST_ACCOUNT_FILE` a una ruta **que todavía no exista**, fuera del repositorio, para guardar allí la cuenta sintética generada (permisos privados). No se imprime su contraseña.

Con Node, Playwright 1.62.1 y Chromium disponibles:

```sh
PORTAL_BROWSER_URL=http://127.0.0.1:8081/ \
PORTAL_TEST_ACCOUNT_FILE=/ruta/privada/cuenta-qa.json \
node tests/browser-smoke.cjs
```

El navegador rechaza URLs que no sean localhost. Guarda una noticia mediante el formulario, comprueba programación futura, abre el Excel exportado, comprueba el PDF e importa un CSV de becas con rechazo de duplicados. Estas pruebas modifican únicamente la instalación de QA elegida. Las fuentes remotas se bloquean durante esta prueba para que su disponibilidad no condicione la validación funcional; no equivale a una medición visual de las fuentes en producción.

Para probar también los formularios ciudadanos (Mesa de Partes con subida multipart y descarga de cargo, y reclamo con evidencia de 6 MiB dentro del límite anunciado de 10 MiB):

```sh
PORTAL_BROWSER_URL=http://127.0.0.1:8081/ node tests/public-forms.cjs
```

`python3 tests/vendor-audit.py` verifica los hashes de las bibliotecas del navegador. Con `--advisories` consulta los avisos npm actuales; esa consulta requiere red. El resultado se limita a los paquetes y versiones declarados y al momento de la consulta.

Opcionalmente establece `PORTAL_TEST_ARTIFACT_DIR` a una carpeta privada fuera del checkout para conservar los PDF y XLSX sintéticos descargados y analizarlos con `pdfinfo`/`pdftotext`.
