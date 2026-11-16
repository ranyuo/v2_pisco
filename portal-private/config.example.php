<?php
return [
    'db_host' => 'localhost',
    'db_port' => 3306,
    'db_name' => 'NOMBRE_DE_LA_BASE_EN_HPANEL',
    'db_user' => 'USUARIO_DE_LA_BASE_EN_HPANEL',
    'db_password' => 'CONTRASENA_DE_LA_BASE',
    // Elige una clave privada aleatoria de al menos 32 caracteres; se usa al instalar el portal.
    'install_key' => '',
    'secure_cookies' => true, // HTTPS en Hostinger. Usa false únicamente para pruebas locales HTTP.
    'timezone' => 'America/Lima',
    // Dirección de la web institucional (se administra aparte); la intranet la enlaza desde su cabecera y su pie.
    'website_url' => 'https://iestppisco.edu.pe/',
    // Meses de auditoría que se conservan (mínimo 6). 0 la conserva sin límite. La depuran a diario cron.php y mail-worker.php.
    'audit_retention_months' => 24,
    // Alternativa al formulario Configuración → Configurar correo notificador (SMTP).
    // El formulario guarda ajustes cifrados que tienen prioridad sobre este bloque.
    // Credenciales privadas: nunca añadir este bloque a la configuración visible del navegador.
    // Usa una contraseña de aplicación (no la clave personal de la cuenta) y programa el cron de mail-worker.php.
    'smtp' => [
        'enabled' => false,
        'host' => 'smtp.gmail.com',
        'port' => 587,
        'encryption' => 'tls', // STARTTLS; alternativa: 'ssl' con puerto 465.
        'username' => 'notificaciones@instituto.edu.pe', // Reemplaza por la cuenta de correo de la institución.
        'password' => getenv('PORTAL_SMTP_PASSWORD') ?: '',
        'from_email' => 'notificaciones@instituto.edu.pe',
        'from_name' => 'Notificaciones · Nombre corto del instituto',
    ],
    // Autocompletado de nombres por DNI y razón social por RUC en Mesa de Partes y Libro de Reclamaciones (MIGO API v2, https://docs.migo.pe/v2).
    // Recomendado: configúralo en Configuración → Consulta de DNI y RUC (API); se guarda cifrado y tiene prioridad sobre este bloque.
    // Si lo usas aquí, el token es privado: escríbelo solo en config.php del hosting, nunca en el repositorio.
    'document_lookup' => [
        'enabled' => false,
        'provider' => 'migo', // Alternativa: 'decolecta' con base_url https://api.decolecta.com/v1.
        'base_url' => 'https://api.migo.pe/api/v2',
        'token' => getenv('PORTAL_DOCUMENT_TOKEN') ?: '',
    ],
];
