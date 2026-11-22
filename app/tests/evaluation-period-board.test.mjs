import test from 'node:test';
import assert from 'node:assert/strict';
import {initialNotebook,addGroup,addStudent,assertModel,setEvaluationPastMode} from '../src/model.js';
import {activeYear,saveEvaluationSession} from '../src/planner.js';
import {saveTutorship,saveTutorshipEvaluation,tutorshipLegacyEvents} from '../src/evaluation-groups.js';
import {renderEvaluationPeriodBoard} from '../src/evaluation-period-board.js';
import {renderEvaluationWorkspace} from '../src/evaluation-workspace.js';

function fixture(){
 const doc=initialNotebook({empty:true});
 const latin=addGroup(doc,'1.º BACH','Latín I','2026-2027','1bach');
 const greek=addGroup(doc,'1.º BACH','Griego I','2026-2027','1bach');
 addStudent(doc,latin.id,{name:'Alba',originGroup:'A'});
 addStudent(doc,greek.id,{name:'Beatriz',originGroup:'A'});
 return {doc,latin,greek,year:activeYear(doc),periods:[...doc.periods].sort((a,b)=>a.order-b.order)};
}
const render=f=>renderEvaluationWorkspace(f.doc,{evaluationWorkspaceTab:'sesiones'});
test('primero aparecen las evaluaciones ordenadas; dentro de cada una hay tarjetas de grupo',()=>{
 const f=fixture(),html=render(f);
 const positions=f.periods.map(p=>html.indexOf('data-evaluation-section="'+p.id+'"'));
 assert(positions.every(x=>x>=0));
 assert(positions.every((x,i)=>i===0||x>positions[i-1]));
 assert.equal((html.match(/class="eval-period-section"/g)||[]).length,f.periods.length);
 assert.equal((html.match(/class="eval-period-small-card"/g)||[]).length,f.periods.length);
 assert(html.includes('eval-period-cards'));
 assert(!html.includes('eval-session-card-heading'),'No debe agruparse por asignatura como nivel superior');
 assertModel(f.doc);
});
test('cuando existe una tutoría compartida, hay una tarjeta por evaluación sin duplicar Latín y Griego',()=>{
 const f=fixture(),t=saveTutorship(f.doc,{name:'1.º BACH A',sources:[
  {groupId:f.latin.id,originGroup:'A'},{groupId:f.greek.id,originGroup:'A'}]});
 const html=render(f);
 assert.equal((html.match(/class="eval-period-small-card"/g)||[]).length,f.periods.length);
 assert.equal((html.match(/data-eval-tutor-session="/g)||[]).length,f.periods.length);
 assert.equal((html.match(/data-eval-group="/g)||[]).length,0);
 assert(html.includes('data-eval-tutor-session="'+t.id+'"'));
 assert(html.includes('Latín I · Griego I'));
 assert(html.includes('Sin programar'));
 assert(html.includes('Programar sesión'));
});
test('cada evaluación indica fecha, hora de comienzo y fin con edición directa',()=>{
 const f=fixture(),t=saveTutorship(f.doc,{name:'1.º BACH A',sources:[
  {groupId:f.latin.id,originGroup:'A'},{groupId:f.greek.id,originGroup:'A'}]});
 const e=saveTutorshipEvaluation(f.doc,{tutorshipId:t.id,periodId:f.periods[0].id,
  date:'2026-12-18',time:'15:30',endTime:'17:15'});
 const html=render(f),first=html.slice(html.indexOf('data-evaluation-section="'+f.periods[0].id+'"'),
  html.indexOf('data-evaluation-section="'+f.periods[1].id+'"'));
 assert(first.includes('2026-12-18'));
 assert(first.includes('15:30–17:15'));
 assert(first.includes('Editar sesión'));
 assert(first.includes('data-eval-tutor-export="'+e.id+'"'));
 assert(first.includes('data-eval-open-tutor="'+t.id+'"'));
 const second=html.slice(html.indexOf('data-evaluation-section="'+f.periods[1].id+'"'));
 assert(second.includes('Sin programar'));
 assert(second.includes('Programar sesión'));
 assertModel(f.doc);
});
test('los grupos sin confirmar tienen una sola tarjeta con controles individuales y acceso a Tutorías',()=>{
 const f=fixture(),before=structuredClone(f.doc),html=render(f);
 assert(html.includes('Coincidencia pendiente de confirmar'));
 assert(html.includes('data-eval-switch-tab="tutorias"'));
 assert(html.includes('data-eval-group="'+f.latin.id+'"'));
 assert(html.includes('data-eval-group="'+f.greek.id+'"'));
 assert(html.includes('data-eval-origin="A"'));
 assert(!html.includes('data-eval-tutor-session='));
 assert.deepEqual(f.doc,before);
});
test('dos fechas independientes permanecen visibles; no se elige automáticamente una convocatoria',()=>{
 const f=fixture(),latin=saveEvaluationSession(f.doc,{groupId:f.latin.id,originGroup:'A',
  periodId:f.periods[0].id,date:'2026-12-18',time:'15:30',endTime:'16:30'});
 const greek=saveEvaluationSession(f.doc,{groupId:f.greek.id,originGroup:'A',
  periodId:f.periods[0].id,date:'2026-12-19',time:'16:00',endTime:'17:45'});
 const before=structuredClone(f.doc),html=render(f);
 assert(html.includes('2026-12-18 · 15:30–16:30'));
 assert(html.includes('2026-12-19 · 16:00–17:45'));
 assert(html.includes('data-export-event="'+latin.id+'"'));
 assert(html.includes('data-export-event="'+greek.id+'"'));
 assert.deepEqual(f.doc,before);
 assertModel(f.doc);
});
test('el conflicto histórico mantiene el botón de conciliación y expone todas las fechas anteriores',()=>{
 const f=fixture();
 const a=saveEvaluationSession(f.doc,{groupId:f.latin.id,originGroup:'A',
  periodId:f.periods[0].id,date:'2026-12-18',time:'15:30'});
 const b=saveEvaluationSession(f.doc,{groupId:f.greek.id,originGroup:'A',
  periodId:f.periods[0].id,date:'2026-12-19',time:'16:45'});
 const t=saveTutorship(f.doc,{name:'1.º BACH A',sources:[
  {groupId:f.latin.id,originGroup:'A'},{groupId:f.greek.id,originGroup:'A'}]});
 const before=structuredClone(f.doc),html=render(f);
 assert(html.includes('Sin convocatoria común'));
 assert(html.includes('data-eval-consolidate="'+t.id+'"'));
 assert(html.includes('2026-12-18 · 15:30'));
 assert(html.includes('2026-12-19 · 16:45'));
 assert(!html.includes('data-eval-tutor-session="'+t.id+'" data-eval-period="'+f.periods[0].id+'"'));
 assert.deepEqual(f.doc,before);
 assert.equal(tutorshipLegacyEvents(f.doc,t.id,f.periods[0].id).length,2);
 assert([a.id,b.id].every(id=>f.year.events.some(e=>e.id===id)));
 assertModel(f.doc);
});
test('los grupos sin alumnado ni convocatoria no habilitan programación por error',()=>{
 const f=fixture();f.doc.students=[];
 const html=renderEvaluationPeriodBoard(f.doc,f.year);
 assert(html.includes('Sin alumnado en esta procedencia'));
 assert(!html.includes('data-eval-group='));
});
test('los nombres de grupos no confiables se escapan en todas las tarjetas',()=>{
 const f=fixture();f.latin.name='<svg onload=alert(1)>';
 const html=render(f);
 assert(!html.includes('<svg onload=alert(1)>'));
 assert(html.includes('&lt;svg onload=alert(1)&gt;'));
});
test('los datos de otras evaluaciones y las notas permanecen sin cambios al renderizar',()=>{
 const f=fixture(),id=f.periods[2].id;
 saveEvaluationSession(f.doc,{groupId:f.latin.id,originGroup:'A',
  periodId:id,date:'2027-05-20',time:'16:00',endTime:'17:00'});
 const before=structuredClone(f.doc);
 const html=render(f);
 const third=html.slice(html.indexOf('data-evaluation-section="'+id+'"'));
 assert(third.includes('2027-05-20'));
 assert(third.includes('16:00–17:00'));
 assert.deepEqual(f.doc,before);
 assertModel(f.doc);
});

test('sesión anterior a hoy se oculta en el historial, pero la de hoy permanece visible',()=>{
 const f=fixture(),t=saveTutorship(f.doc,{name:'1.º BACH A',sources:[
  {groupId:f.latin.id,originGroup:'A'},{groupId:f.greek.id,originGroup:'A'}]});
 saveTutorshipEvaluation(f.doc,{tutorshipId:t.id,periodId:f.periods[0].id,
  date:'2026-12-18',time:'15:30',endTime:'17:00'});
 const before=structuredClone(f.doc);
 const yesterday=renderEvaluationPeriodBoard(f.doc,f.year,undefined,{today:'2026-12-19'});
 assert(yesterday.includes('Sesiones pasadas (1)'));
 assert(yesterday.includes('data-eval-card-state="past"'));
 assert(yesterday.includes('Editar sesión'));
 assert(yesterday.includes('data-eval-tutor-session="'+t.id+'"'));
 assert(yesterday.includes('Sin programar'),'No se archivan otros periodos sin convocatoria');
 const sameDay=renderEvaluationPeriodBoard(f.doc,f.year,undefined,{today:'2026-12-18'});
 assert(!sameDay.includes('Sesiones pasadas (1)'));
 assert(sameDay.includes('data-eval-card-state="scheduled"'));
 assert.deepEqual(f.doc,before,'La vista por fecha no escribe datos ni notas');
});
test('Mostrar siempre todas: se conserva la cita y se desactiva el acordeón',()=>{
 const f=fixture(),t=saveTutorship(f.doc,{name:'1.º BACH A',sources:[
  {groupId:f.latin.id,originGroup:'A'},{groupId:f.greek.id,originGroup:'A'}]});
 saveTutorshipEvaluation(f.doc,{tutorshipId:t.id,periodId:f.periods[0].id,
  date:'2026-12-18',time:'15:30'});
 setEvaluationPastMode(f.doc,'all');
 const html=renderEvaluationPeriodBoard(f.doc,f.year,undefined,{today:'2026-12-19',
  showPast:f.doc.settings.evaluationPastMode==='all'});
 assert(html.includes('data-eval-past-mode checked'));
 assert(!html.includes('Sesiones pasadas (1)'));
 assert(html.includes('data-eval-card-state="past"'));
 assert(html.includes('Editar sesión'));
 assertModel(f.doc);
 assert.throws(()=>setEvaluationPastMode(f.doc,'erase'),/inválido/);
});
test('las convocatorias anteriores por unificar nunca se archivan automáticamente',()=>{
 const f=fixture();
 saveEvaluationSession(f.doc,{groupId:f.latin.id,originGroup:'A',periodId:f.periods[0].id,
  date:'2026-12-18',time:'15:30'});
 saveEvaluationSession(f.doc,{groupId:f.greek.id,originGroup:'A',periodId:f.periods[0].id,
  date:'2026-12-18',time:'16:00'});
 const tutor=saveTutorship(f.doc,{name:'1.º BACH A',sources:[
  {groupId:f.latin.id,originGroup:'A'},{groupId:f.greek.id,originGroup:'A'}]});
 const html=renderEvaluationPeriodBoard(f.doc,f.year,undefined,{today:'2026-12-22'});
 assert(!html.includes('Sesiones pasadas (1)'));
 assert(html.includes('Pendiente de revisar'));
 assert(html.includes('Unificar convocatorias'));
 assert(html.includes('2026-12-18'));
 assertModel(f.doc);
});
