<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= htmlspecialchars($bootstrap['data']['config']['seo']['titulo'] ?? $bootstrap['data']['config']['inst']['nombre'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') ?></title>
<meta name="description" content="<?= htmlspecialchars($bootstrap['data']['config']['seo']['descripcion'] ?? '', ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') ?>">
<meta property="og:type" content="website">
<meta name="theme-color" content="#0b1d3f">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ccircle cx='32' cy='32' r='30' fill='%230a2a5e'/%3E%3Cpath d='M14 30 32 20l18 10-18 10z' fill='%23f2b705'/%3E%3Cpath d='M22 35v8c6 5 14 5 20 0v-8' fill='none' stroke='%23fff' stroke-width='3'/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Montserrat:ital,wght@0,600;0,700;0,800;1,600&family=Poppins:wght@500;600;700;800&family=Merriweather:wght@700;900&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
<noscript><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Montserrat:ital,wght@0,600;0,700;0,800;1,600&family=Poppins:wght@500;600;700;800&family=Merriweather:wght@700;900&display=swap" rel="stylesheet"></noscript>
<link rel="stylesheet" href="<?= portal_asset('portal.css') ?>">
</head>
<body>
<noscript><p style="padding:20px">Este portal requiere JavaScript habilitado.</p></noscript>
<div id="app" aria-live="off"></div>
<script>window.PORTAL_BOOTSTRAP = <?= json_encode(PortalContent::forJson($bootstrap), JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_THROW_ON_ERROR) ?>;</script>
<div class="ix ix-layer" id="ix-layer" data-palette="web"><div id="ixmodal"></div></div>
<script defer src="<?= portal_asset('portal-1.js') ?>"></script>
<script defer src="<?= portal_asset('portal-2.js') ?>"></script>
<script defer src="<?= portal_asset('portal-3.js') ?>"></script>
<script defer src="<?= portal_asset('portal-4.js') ?>"></script>
<script defer src="<?= portal_asset('/portal-server.js') ?>"></script>
<script defer src="<?= portal_asset('/academic-documents.js') ?>"></script>
<script defer src="<?= portal_asset('/standalone-services.js') ?>"></script>
<script defer src="<?= portal_asset('/mail-settings.js') ?>"></script>
</body>
</html>
