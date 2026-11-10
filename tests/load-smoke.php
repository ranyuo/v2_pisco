<?php
declare(strict_types=1);
ob_start();require __DIR__.'/regressions.php';
$started=microtime(true);$data=$app->bootstrap()['data'];$students=$data['academico']['estudiantes'];$grades=$data['academico']['notas'];$gradeId=1001;
for($id=2;$id<=401;$id++){
    $students[]=['id'=>$id,'dni'=>sprintf('%08d',$id),'nom'=>'QA Student '.$id,'prog'=>1,'periodo'=>'2026-II','ciclo'=>'I','sec'=>'A','turno'=>'Mañana','estado'=>'Regular'];
    for($course=1;$course<=($id<=101?7:6);$course++)$grades[]=['id'=>$gradeId++,'est'=>$id,'ud'=>'QA Course '.$course,'periodo'=>'2026-II','nota'=>15];
}
saveRows($app,'estudiantes',$students);saveRows($app,'notas',$grades);
$data=$app->bootstrap()['data'];verify(count($data['academico']['estudiantes'])===401,'401 students survive bulk save');verify(count($data['academico']['notas'])===2502,'2502 grades survive bulk save');
$grades[100]['nota']=17;saveRows($app,'notas',$grades);$data=$app->bootstrap()['data'];verify($data['academico']['notas'][100]['nota']===17,'Single grade update survives bulk dataset');
echo 'Bulk scenario elapsed: '.round(microtime(true)-$started,3).' s; peak PHP memory: '.round(memory_get_peak_usage(true)/1048576,1)." MiB.\n";
echo "$passed total checks passed.\n";ob_end_flush();
