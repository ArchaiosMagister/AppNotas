import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {emptyNotebook,addGroup,addStudent,addAssessment,setGrade,sortStudents} from '../src/model.js';
import {overallGrade} from '../src/calculations.js';

const read=name=>readFile(new URL('../'+name,import.meta.url),'utf8');

async function controls(initial='surname',plain='surname'){
  const source=await read('app.js');
  const start=source.indexOf('const STUDENT_SORT_LABELS=');
  const end=source.indexOf('const studentOriginBadge=',start);
  assert(start>0&&end>start,'Bloque de ordenación no encontrado');
  const storage=new Map(),calls=[];
  const state={studentSort:initial,studentPlainSort:plain,doc:{grades:[{score:7.5}]}};
  const api=runInNewContext(source.slice(start,end)+';({studentSortControls,setStudentSort})',{
    STATE:state,
    STUDENT_SORT_MODES:['surname','firstName','originGroup','manual'],
    localStorage:{setItem:(key,value)=>storage.set(key,value)},
    render:()=>calls.push(state.studentSort),
    opt:(id,label,chosen)=>`<option value="${id}" ${chosen===id?'selected':''}>${label}</option>`
  });
  return {state,storage,calls,...api};
}

test('Cerrar cuaderno se encuentra visible en la cabecera y se conecta al mismo flujo cifrado',async()=>{
  const js=await read('app.js'),start=js.indexOf('function render(){'),end=js.indexOf('function renderNotebook(){',start);
  const section=js.slice(start,end),label=section.indexOf('id="close-notebook"');
  assert(label>=0,'Cerrar cuaderno ausente');
  assert(label<section.indexOf('<details class="header-tools"'),'El cierre debe estar fuera del menú Herramientas');
  assert(label>section.indexOf('id="save-status"'),'El cierre está junto al estado de guardado');
  assert.equal([...section.matchAll(/id="close-notebook"/g)].length,1,'No deben aparecer botones duplicados');
  assert(js.includes("$('#close-notebook')?.addEventListener('click',()=>closeNotebook().catch(fail))"));
  assert(js.includes('async function closeNotebook()'));
  assert(js.includes('await STATE.mutationQueue;await STATE.saveQueue;'),'No omitir guardados pendientes');
  assert(js.includes('const prepared=await createPortableCopy(snapshot,STATE.key,STATE.salt,exportedDate)'));
});

test('el interruptor se muestra junto a Alumnos y refleja la agrupación actual',async()=>{
  const off=await controls('surname','surname');
  const offHTML=off.studentSortControls();
  assert(offHTML.includes('>Alumnos</strong>'));
  assert(offHTML.includes('id="student-group-mode"'));
  assert(offHTML.includes('role="switch"'));
  assert(offHTML.includes('Modo grupo'));
  assert(offHTML.includes('aria-checked="false"'));
  assert(!/<input[^>]+id="student-group-mode"[^>]*\bchecked\s*\/>/.test(offHTML));
  const on=await controls('originGroup','firstName');
  const onHTML=on.studentSortControls();
  assert(onHTML.includes('aria-checked="true"'));
  assert(onHTML.includes('checked/>'));
  assert(onHTML.includes('<option value="originGroup" selected>'));
});

test('al activar Modo grupo se guarda la preferencia sin tocar datos académicos',async()=>{
  const c=await controls('firstName','surname');
  const before=JSON.stringify(c.state.doc);
  c.setStudentSort('originGroup');
  assert.equal(c.state.studentSort,'originGroup');
  assert.equal(c.state.studentPlainSort,'firstName');
  assert.equal(c.storage.get('cuaderno-docente-student-sort'),'originGroup');
  assert.equal(c.storage.get('cuaderno-docente-student-sort-before-group'),'firstName');
  assert.deepEqual(c.calls,['originGroup']);
  assert.equal(JSON.stringify(c.state.doc),before);
});

test('al desactivar se restablece exactamente el modo alfabético anterior',async()=>{
  const c=await controls('manual','manual');
  c.setStudentSort('originGroup');
  c.setStudentSort(c.state.studentPlainSort);
  assert.equal(c.state.studentSort,'manual');
  assert.equal(c.state.studentPlainSort,'manual');
  assert.equal(c.storage.get('cuaderno-docente-student-sort'),'manual');
  c.setStudentSort('surname');
  c.setStudentSort('originGroup');
  c.setStudentSort(c.state.studentPlainSort);
  assert.equal(c.state.studentSort,'surname');
  assert.equal(c.state.studentPlainSort,'surname');
});

test('modos no previstos no se admiten ni se renderizan',async()=>{
  const c=await controls();
  c.setStudentSort('inventado');
  assert.equal(c.state.studentSort,'surname');
  assert.equal(c.calls.length,0);
  assert.equal(c.storage.size,0);
});

test('el grupo se ordena primero por procedencia y después por apellido A-Z, sin mezclar grupos',()=>{
  const doc=emptyNotebook(),g=addGroup(doc,'Optativa','Latín I','2026-2027','1bach');
  const entries=[
    ['Zúñiga','Ana','2B'],['Crespo','Marcos','1A'],['Álvarez','Ana','1A'],
    ['García','Paula','2B'],['Ávila','Rosa','1A'],['Bravo','Julia','']
  ];
  const ids=entries.map(([lastName,firstName,originGroup])=>
    addStudent(doc,g.id,{lastName,firstName,originGroup}).id);
  const assessment=addAssessment(doc,{name:'Trabajo',groupId:g.id,periodId:doc.periods[0].id,categoryId:doc.categories[0].id,maxScore:10});
  setGrade(doc,ids[0],assessment.id,9);
  setGrade(doc,ids[2],assessment.id,6.5);
  const old=structuredClone(doc);
  const ordered=sortStudents(doc.students.filter(s=>s.groupId===g.id),'originGroup');
  assert.deepEqual(ordered.map(s=>s.id),[ids[2],ids[4],ids[1],ids[3],ids[0],ids[5]]);
  assert.deepEqual(doc,old,'Ordenar no muta los alumnos ni los registros');
  assert.equal(overallGrade(doc,ids[0],g.id,doc.periods[0].id),9);
  assert.equal(overallGrade(doc,ids[2],g.id,doc.periods[0].id),6.5);
});

test('el modo grupo es compartido por cuaderno y directorio individual; no cambia estructura de notas',async()=>{
  const js=await read('app.js');
  assert.equal(js.split('<div class="student-order-bar">${studentSortControls()}</div>').length-1,3,'Cuaderno, directorio y evaluación final comparten el interruptor');
  assert(js.includes('originGroupHeader(students,i,assessments.length+3)'));
  assert(js.includes('originGroupHeader(students,i,periods.length+2)'));
  assert(js.includes('originDirectoryHeader(students,i)'));
  assert(js.includes("$('#student-group-mode')?.addEventListener('change',event=>{"));
  assert(js.includes("setStudentSort(event.target.checked?'originGroup':STATE.studentPlainSort)"));
  assert(js.includes('sortStudents(STATE.doc.students.filter(x=>x.groupId===STATE.groupId),STATE.studentSort)'));
});

test('los controles son accesibles en móvil, en temas oscuros y con servicio PWA renovado',async()=>{
  const [css,sw]=await Promise.all([read('styles.css'),read('sw.js')]);
  const cacheId=sw.match(/const CACHE='(cuaderno-docente-static-v(\d+)-dev)'/)?.[1];
  assert(cacheId&&Number(cacheId.match(/v(\d+)/)?.[1])>=142,'La caché PWA debe tener versión actualizada');
  assert(css.includes('.topbar .topbar-close-btn'));
  assert(css.includes('.student-group-switch input:focus-visible+.student-group-switch-track'));
  assert(css.includes('.student-group-switch input:checked+.student-group-switch-track'));
  assert(css.includes('.topmeta{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))'));
  assert(css.includes('min-height:44px'));
  assert(sw.includes(`${cacheId}`));
});
