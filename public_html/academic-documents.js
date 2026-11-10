/* Configuración académica compartida y registro de constancias / certificados (adaptado de v2_palpa). */
'use strict';
// Emitted documents are registered once by the PHP transaction.
IXHOST.registerDoc=()=>{};
MODULES['ix-config']='Configuración académica general';
MODULES['ix-certificados']='Certificación modular';
MODULES.certificados='Constancias / Certificados';
// Configuración académica general encabeza Gestión académica; Programas de estudio sigue siendo contenido del portal web.
for(const [,items] of NAV_GROUPS){for(let i=items.length-1;i>=0;i--)if(items[i][0]==='ix-config')items.splice(i,1);}
const academicMenu=NAV_GROUPS.find(([label])=>label==='Gestión académica')?.[1];
if(academicMenu)academicMenu.unshift(['ix-config','gear']);
// Explicit defaults, always constrained by server-projected role permissions.
for(const r of ['secretaria','coordinador','directivo'])if(ROLES[r]&&portalBootstrap.roles?.[r])ROLES[r].mods=portalBootstrap.roles[r].mods;

// The verification registry remains unique. Academic records are maintained at origin.
const docSpec=SPECS.certificados;
docSpec.title='Constancias / Certificados';
docSpec.sub='Documentos de cursos y actividades. Las certificaciones modulares y los títulos se administran en sus módulos y comparten la consulta pública.';
docSpec.scope=r=>!r.ref && !/modular|título|titulo|validación de título/i.test(r.tipo||'');
docSpec.fields=[
 {n:'codigo',l:'Código del documento',req:true,unique:true},
 {n:'dni',l:'DNI del titular',req:true},
 {n:'nombres',l:'Apellidos y nombres',req:true,full:true},
 {n:'tipo',l:'Tipo de documento',t:'select',req:true,opts:['Constancia','Certificado']},
 {n:'detalle',l:'Curso, actividad o denominación',req:true,full:true},
 {n:'fecha',l:'Fecha de emisión',t:'date',req:true},
 {n:'horas',l:'Horas del documento',t:'number',min:1,max:10000},
 {n:'tipoHoras',l:'Tipo de horas',t:'select',opts:['Académicas','Lectivas']},
 {n:'programaId',l:'Programa de estudios (si corresponde)',t:'select',opts:progOpts},
 {n:'institucion',l:'Institución emisora',req:true,full:true}
];
docSpec.beforeSave=w=>{w.codigo=String(w.codigo||'').trim().toUpperCase();w.grupo='documentos';};
docSpec.cols.splice(3,0,{l:'Denominación',f:r=>esc(r.detalle||'—')});
const docValidation=docSpec.validate;
docSpec.validate=w=>{const errors=docValidation(w);if(w.horas&&(!w.tipoHoras))errors.tipoHoras='Indica si las horas son académicas o lectivas.';return errors;};

// Select an existing student when relevant; external course participants can be entered directly.
docSpec.defaults=()=>({institucion:inst().nombre,tipoHoras:'Académicas',grupo:'documentos'});
docSpec.fields.unshift({n:'estudianteId',l:'Alumno registrado (opcional)',t:'select',opts:()=>DB.academico.estudiantes.map(e=>[e.id,e.dni+' · '+e.nom])});
docSpec.afterForm=(work,isNew,rerender,form)=>{
 const select=form.querySelector('[name="estudianteId"]');
 select.addEventListener('change',()=>{const student=DB.academico.estudiantes.find(e=>String(e.id)===select.value);if(!student)return;work.dni=student.dni;work.nombres=student.nom;work.programaId=Object.keys(DB.academico.progMap).find(k=>DB.academico.progMap[k]===student.prog)||'';form.querySelector('[name=dni]').value=work.dni;form.querySelector('[name=nombres]').value=work.nombres;form.querySelector('[name=programaId]').value=work.programaId;});
};
// Issued documents retain their payload; cancellation and its reason remain editable.
docSpec.fields.push({n:'motivo',l:'Motivo de anulación',full:true});
for(const f of docSpec.fields)if(f.n!=='motivo')f.ro=w=>!!byId('certificados',w.id)&&!!w.grupo;
const sharedDocumentAfterForm=docSpec.afterForm;
docSpec.afterForm=(work,isNew,rerender,form)=>{
 sharedDocumentAfterForm(work,isNew,rerender,form);
 if(!isNew&&work.grupo)for(const field of form.querySelectorAll('input,select,textarea'))if(!['estado','motivo'].includes(field.name)){if(field.tagName==='SELECT')field.disabled=true;else field.readOnly=true;}
};

// Embed the existing program editor list; there is still one source catalog.
IXHOST.programsView=()=>{const out=crudList(SPECS.programas);queueMicrotask(()=>{if(document.querySelector('[data-shared-programs]'))out.after?.();});return '<section data-shared-programs>'+out.html+'</section>';};

const independentTypeColumn=docSpec.cols.find(c=>c.l==='Tipo');if(independentTypeColumn)independentTypeColumn.f=r=>esc(r.tipo);
docSpec.sub+=' Los datos emitidos se conservan; para corregirlos, anule y registre una nueva emisión.';
