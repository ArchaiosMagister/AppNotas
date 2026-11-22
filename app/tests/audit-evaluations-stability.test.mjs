import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {initialNotebook,addGroup,addStudent,assertModel} from '../src/model.js';
import {activeYear,saveEvaluationSession,calendarEventIcs} from '../src/planner.js';
import {saveTutorship,saveTutorshipEvaluation,consolidateTutorshipEvaluation,tutorshipEvent} from '../src/evaluation-groups.js';
import {renderSharedEvaluation} from '../src/evaluation-ui.js';
import {renderEvaluationWorkspace} from '../src/evaluation-workspace.js';

function fixture(){
 const doc=initialNotebook({empty:true}),year=activeYear(doc);
 const latin=addGroup(doc,'1.º BACH','Latín I',year.name,'1bach');
 const greek=addGroup(doc,'1.º BACH','Griego I',year.name,'1bach');
 addStudent(doc,latin.id,{name:'Alba',originGroup:'A'});
 addStudent(doc,greek.id,{name:'Beatriz',originGroup:'A'});
 const t=saveTutorship(doc,{name:'Tutoría original',sources:[
  {groupId:latin.id,originGroup:'A'},{groupId:greek.id,originGroup:'A'}]});
 return {doc,year,latin,greek,t,period:doc.periods[0]};
}
test('renombrar una tutoría actualiza convocatorias existentes y exportación ICS, no fechas ni notas',()=>{
 const f=fixture(),p2=f.doc.periods[1];
 const a=saveTutorshipEvaluation(f.doc,{tutorshipId:f.t.id,periodId:f.period.id,
  date:'2026-12-18',time:'15:30',endTime:'17:00',notes:'Sala 2'});
 const b=saveTutorshipEvaluation(f.doc,{tutorshipId:f.t.id,periodId:p2.id,
  date:'2027-03-12',time:'16:00',endTime:'17:30',notes:'Sala 4'});
 const original=structuredClone({grades:f.doc.grades,students:f.doc.students,
  sessions:f.year.events.map(e=>({id:e.id,date:e.date,time:e.time,endTime:e.endTime,notes:e.notes}))});
 saveTutorship(f.doc,{id:f.t.id,name:'Tutoría renombrada',sources:f.t.sources});
 assert.equal(a.title,f.period.name+' · Tutoría renombrada');
 assert.equal(b.title,p2.name+' · Tutoría renombrada');
 assert(calendarEventIcs(a).includes('Tutoría renombrada'));
 assert(calendarEventIcs(b).includes('Tutoría renombrada'));
 assert.deepEqual({grades:f.doc.grades,students:f.doc.students,
  sessions:f.year.events.map(e=>({id:e.id,date:e.date,time:e.time,endTime:e.endTime,notes:e.notes}))},original);
 assertModel(f.doc);
});
test('la conciliación histórica preserva el título archivado al renombrar posteriormente la tutoría',()=>{
 const f=fixture();
 // La creación de tutoría precede a la llegada de una cita antigua de la materia.
 const old=saveEvaluationSession(f.doc,{groupId:f.latin.id,originGroup:'A',
  periodId:f.period.id,date:'2026-12-18',time:'15:30',notes:'Acta anterior'});
 consolidateTutorshipEvaluation(f.doc,{tutorshipId:f.t.id,periodId:f.period.id,chosenEventId:old.id});
 const archive=structuredClone(f.doc.evaluationArchive);
 saveTutorship(f.doc,{id:f.t.id,name:'Nombre nuevo',sources:f.t.sources});
 assert.deepEqual(f.doc.evaluationArchive,archive,'El archivo histórico debe ser inmutable');
 assert.equal(tutorshipEvent(f.doc,f.t.id,f.period.id).title,f.period.name+' · Nombre nuevo');
 assertModel(f.doc);
});
test('un nombre de tutoría inválido no modifica ni títulos ni datos',()=>{
 const f=fixture();
 saveTutorshipEvaluation(f.doc,{tutorshipId:f.t.id,periodId:f.period.id,date:'2026-12-18',time:'15:30'});
 const before=structuredClone(f.doc);
 assert.throws(()=>saveTutorship(f.doc,{id:f.t.id,name:'<script>',sources:f.t.sources}));
 assert.deepEqual(f.doc,before);
 assertModel(f.doc);
});
test('renombrar una tutoría no altera convocatorias de otra tutoría',()=>{
 const f=fixture();
 const independent=saveTutorship(f.doc,{name:'Tutoría B',sources:[{groupId:f.latin.id,originGroup:'B'}]});
 const other=saveTutorshipEvaluation(f.doc,{tutorshipId:independent.id,periodId:f.period.id,
  date:'2026-12-18',time:'16:30'});
 const preserved=other.title;
 saveTutorship(f.doc,{id:f.t.id,name:'Tutoría A nueva',sources:f.t.sources});
 assert.equal(other.title,preserved);assertModel(f.doc);
});
test('la vista de notas usa acceso directo, sin generar el gestor de coincidencias',()=>{
 const f=fixture(),ui={plannerEvaluationView:{tutorshipId:f.t.id,periodId:f.period.id}};
 const html=renderSharedEvaluation(f.doc,f.year,ui,'notas');
 assert(html.includes('eval-combined-table'));
 assert(!html.includes('data-eval-confirm-session='));
 assert(!html.includes('id="plan-shared-management"'));
 assert(!html.includes('data-evaluation-section='));
 assert(renderEvaluationWorkspace(f.doc,{evaluationWorkspaceTab:'notas'}).includes('eval-combined-table'));
 assertModel(f.doc);
});
test('la pestaña Tutorías no genera innecesariamente el inventario de sesiones',()=>{
 const f=fixture(),html=renderSharedEvaluation(f.doc,f.year,{},'tutorias');
 assert(html.includes('id="plan-shared-management"'));
 assert(!html.includes('data-evaluation-section='));
 assert(!html.includes('id="plan-evaluations"'));
 assertModel(f.doc);
});
test('el tablero utiliza las tarjetas precalculadas, preservando la presentación',()=>{
 const f=fixture(),year=f.year,ui={evaluationWorkspaceTab:'sesiones'};
 const html=renderEvaluationWorkspace(f.doc,ui);
 assert(html.includes('data-evaluation-section="'+f.period.id+'"'));
 assert(html.includes('data-eval-tutor-session="'+f.t.id+'"'));
 assert(html.includes('Tutoría original'));
 assertModel(f.doc);
});

const js=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const first=js.indexOf('function fieldsModal('),last=js.indexOf('function showInfo(',first);
if(first<0||last<first)throw new Error('No se encuentra el formulario genérico');
const source=js.slice(first,last);
function modalHarness(onSubmit){
 let onSubmitEvent,closed=0,errors='',focused=0;
 const form={isConnected:true,submitButton:{disabled:false}};
 const dialog={innerHTML:'',showModal(){},close(){closed++;}};
 const $=(selector,parent)=>{
  if(selector==='#close-dialog')return{addEventListener(){}};
  if(selector==='#modal-form')return{addEventListener:(event,fn)=>{if(event==='submit')onSubmitEvent=fn;}};
  if(selector==='[type=submit]')return form.submitButton;
  if(selector==='input,select,textarea')return{focus:()=>{focused++;}};
  if(selector==='.modal-error')return{set textContent(value){errors=value;}};
  throw new Error('Selector desconocido: '+selector);
 };
 const run=runInNewContext(source+';fieldsModal',{
  dialog,$,esc:v=>String(v),opt:()=>'',FormData:class{*[Symbol.iterator](){yield ['selected','id'];}}
 });
 run('Unificar',[],onSubmit);
 return {submit:()=>onSubmitEvent({preventDefault(){},currentTarget:form}),
  get closed(){return closed;},get disabled(){return form.submitButton.disabled;},
  get errors(){return errors;},get focused(){return focused;}};
}
test('al desistir de la confirmación interna, el formulario conserva los datos y sigue abierto',async()=>{
 const control=modalHarness(async()=>false);
 await control.submit();
 assert.equal(control.closed,0);
 assert.equal(control.disabled,false);
 assert.equal(control.focused,1);
 assert.equal(control.errors,'');
});
test('cuando la acción se completa, el formulario se cierra normalmente',async()=>{
 const control=modalHarness(async()=>undefined);
 await control.submit();
 assert.equal(control.closed,1);
 assert.equal(control.disabled,false);
});
test('si la acción falla, se muestra el error y no se cierra el formulario',async()=>{
 const control=modalHarness(async()=>{throw new Error('Falló la operación');});
 await control.submit();
 assert.equal(control.closed,0);
 assert.equal(control.disabled,false);
 assert.equal(control.errors,'Falló la operación');
});
test('la conciliación exige confirmación final: rechazarla cancela guardado sin cerrar diálogo',()=>{
 const ui=readFileSync(new URL('../src/evaluation-ui.js',import.meta.url),'utf8');
 assert(ui.includes("if(!window.confirm('Se creará una sola cita"));
 assert.match(ui,/si no coinciden, elige cuál|Revisa fechas y horas/i);
 assert(ui.includes("'))return false;"),'El rechazo ha de comunicarse al formulario genérico');
});
