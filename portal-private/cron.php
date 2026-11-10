<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require __DIR__.'/bootstrap.php';
try{$app=portal_app();$result=PortalBackups::scheduled($app);echo $result?"Respaldo programado completado.\n":"Sin respaldos pendientes.\n";
    $purged=PortalAudit::purge($app);if($purged)echo "Auditoría depurada: $purged filas.\n";}
catch(Throwable $e){fwrite(STDERR,"No se pudo crear el respaldo programado. Revisa permisos y espacio privado.\n");exit(1);}
