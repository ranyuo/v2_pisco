<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require __DIR__.'/bootstrap.php';
try {
    $app=portal_app();
    // La depuración diaria de auditoría no debe impedir el envío de correo.
    try{PortalAudit::purge($app);}catch(Throwable $error){fwrite(STDERR,"No se pudo depurar la auditoría antigua.\n");}
    // Ofertas con la fecha límite vencida: se cierran y se avisa a la empresa y a sus postulantes.
    try{$app->closeExpiredOffers();}catch(Throwable $error){fwrite(STDERR,"No se pudieron cerrar las ofertas vencidas.\n");}
    $result=$app->processMail(10);
    echo json_encode($result,JSON_THROW_ON_ERROR)."\n";
    if(($result['configured']??true)===false||$result['failed']>0)exit(1);
} catch(Throwable $error) {
    fwrite(STDERR,"No se pudo procesar la cola de correo. Revisa configuración y actualización de la base.\n");exit(1);
}
