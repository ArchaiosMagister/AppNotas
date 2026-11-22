import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {initialNotebook,addGroup,addStudent,assertModel} from '../src/model.js';
import {activeYear,saveEvaluationSession,calendarEventIcs} from '../src/planner.js';
import {saveTutorship,saveTutorshipEvaluation,consolidateTutorshipEvaluation,tutorshipEvent} from '../src/evaluation-groups.js';
import {renderPlanner} from '../src/planner-ui.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function fixture(){
 const doc=initialNotebook({empty:true});
 const latin=addGroup(doc,'1.º BACH','Latín I','2026-2027','1bach');
 const greek=addGroup(doc,'1.º BACH','Griego I','2026-2027','1bach');
 addStudent(doc,latin.id,{name:'Alumno Latín',originGroup:'A'});
 addStudent(doc,greek.id,{name:'Alumno Griego',originGroup:'A'});
 const period=doc.periods[0],year=activeYear(doc);
 const tutorship=saveTutorship(doc,{name:'1.º BACH A',sources:[
  {groupId:latin.id,originGroup:'A'},{groupId:greek.id,originGroup:'A'}
 ]});
 return {doc,latin,greek,period,year,tutorship};
}
const appointment=(f,data={})=>({
 tutorshipId:f.tutorship.id,periodId:f.period.id,date:'2026-12-18',time:'15:30',...data
});
const original=(f,groupId,data={})=>({
 groupId,originGroup:'A',periodId:f.period.id,date:'2026-12-18',time:'15:30',...data
});
test('hora de finalización en tutoría compartida: alta, edición y exportación ICS',()=>{
 const f=fixture();
 const e=saveTutorshipEvaluation(f.doc,appointment(f,{endTime:'17:15',notes:'Sala A'}));
 assert.equal(e.time,'15:30');assert.equal(e.endTime,'17:15');
 assert.equal(e.notes,'Sala A');assertModel(f.doc);
 let ics=calendarEventIcs(e,new Date('2026-11-22T12:00:00Z'));
 assert(ics.includes('DTSTART:20261218T153000'));
 assert(ics.includes('DTEND:20261218T171500'));
 const edited=saveTutorshipEvaluation(f.doc,appointment(f,{id:e.id,endTime:'18:05',notes:'Sala B'}));
 assert.equal(edited.id,e.id);assert.equal(f.year.events.length,1);
 assert.equal(edited.endTime,'18:05');assert.equal(edited.notes,'Sala B');
 ics=calendarEventIcs(edited);
 assert(ics.includes('DTEND:20261218T180500'));
 assertModel(f.doc);
});
test('la hora final es opcional y se puede borrar sin dejar un dato inválido',()=>{
 const f=fixture();
 const e=saveTutorshipEvaluation(f.doc,appointment(f,{endTime:'17:15'}));
 saveTutorshipEvaluation(f.doc,appointment(f,{id:e.id,endTime:''}));
 assert.equal('endTime' in e,false);
 assert(calendarEventIcs(e).includes('DTEND:20261218T163000'));
 assertModel(f.doc);
});
test('hora final inválida en tutoría: no se acepta ni modifica el cuaderno',()=>{
 const f=fixture();
 const initial=saveTutorshipEvaluation(f.doc,appointment(f,{endTime:'17:30'}));
 for(const endTime of ['15:30','14:00','25:00','no-es-hora']){
  const before=structuredClone(f.doc);
  assert.throws(()=>saveTutorshipEvaluation(f.doc,appointment(f,{id:initial.id,endTime})),/hora de finalización/i);
  assert.deepEqual(f.doc,before);
 }
 assertModel(f.doc);
});
test('una convocatoria antigua por asignatura conserva su hora final editable',()=>{
 const f=fixture();
 // La cita previa permanece independiente incluso tras asignar una tutoría.
 const e=saveEvaluationSession(f.doc,original(f,f.latin.id,{endTime:'16:45'}));
 assert.equal(e.endTime,'16:45');
 assert(calendarEventIcs(e).includes('DTEND:20261218T164500'));
 const changed=saveEvaluationSession(f.doc,original(f,f.latin.id,{id:e.id,endTime:'17:00'}));
 assert.equal(changed.id,e.id);assert.equal(changed.endTime,'17:00');
 saveEvaluationSession(f.doc,original(f,f.latin.id,{id:e.id,endTime:''}));
 assert.equal('endTime' in e,false);
 assertModel(f.doc);
});
test('la validación de las sesiones antiguas rechaza fin anterior o igual al inicio',()=>{
 const f=fixture();
 for(const endTime of ['15:30','14:59','99:00']){
  const before=structuredClone(f.doc);
  assert.throws(()=>saveEvaluationSession(f.doc,original(f,f.latin.id,{endTime})),/hora final|Hora final|Hora del evento|posterior/);
  assert.deepEqual(f.doc,before);
 }
 assertModel(f.doc);
});
test('se preserva la hora final de la convocatoria elegida al consolidar tutorías',()=>{
 const f=fixture();
 const la=saveEvaluationSession(f.doc,original(f,f.latin.id,{endTime:'16:30',notes:'Latín'}));
 const gr=saveEvaluationSession(f.doc,original(f,f.greek.id,{time:'16:00',endTime:'17:45',notes:'Griego'}));
 const chosen=consolidateTutorshipEvaluation(f.doc,{
  tutorshipId:f.tutorship.id,periodId:f.period.id,chosenEventId:gr.id
 });
 assert.equal(chosen.endTime,'17:45');
 assert.equal(tutorshipEvent(f.doc,f.tutorship.id,f.period.id).endTime,'17:45');
 assert.deepEqual(f.doc.evaluationArchive.map(a=>a.event.endTime),['16:30','17:45']);
 assert(calendarEventIcs(chosen).includes('DTEND:20261218T174500'));
 assert.equal(la.id,f.doc.evaluationArchive[0].event.id);
 assertModel(f.doc);
});
test('sesiones históricas sin hora final se abren sin migraciones destructivas',()=>{
 const f=fixture(),e=saveTutorshipEvaluation(f.doc,appointment(f));
 assert.equal('endTime' in e,false);
 const raw=structuredClone(f.doc);
 assertModel(raw);
 const html=renderPlanner(f.doc,{plannerMode:'week',plannerDate:'2026-12-18'});
 assert(html.includes('15:30'));
 assert(!html.includes('15:30–'));
});
test('la agenda muestra inicio y fin en la tutoría y en sesiones por asignatura',()=>{
 const f=fixture(),shared=saveTutorshipEvaluation(f.doc,appointment(f,{endTime:'17:15'}));
 const html=renderPlanner(f.doc,{plannerMode:'week',plannerDate:'2026-12-18'});
 assert(html.includes('15:30–17:15'));
 assert(html.includes('data-eval-tutor-session="'+f.tutorship.id+'"'));
 assert(html.includes('data-eval-tutor-export="'+shared.id+'"'));
 const separate=initialNotebook({empty:true});
 const group=addGroup(separate,'1.º BACH','Latín I','2026-2027','1bach');
 addStudent(separate,group.id,{name:'Ejemplo',originGroup:'A'});
 saveEvaluationSession(separate,{groupId:group.id,periodId:separate.periods[0].id,
  originGroup:'A',date:'2026-12-18',time:'16:00',endTime:'18:30'});
 assert(renderPlanner(separate,{plannerMode:'day',plannerDate:'2026-12-18'}).includes('16:00–18:30'));
});
test('ambos diálogos ofrecen campo de fin editable y opcional',()=>{
 const tutorUI=readFileSync(path.join(root,'src/evaluation-ui.js'),'utf8');
 const plannerUI=readFileSync(path.join(root,'src/planner-ui.js'),'utf8');
 assert(tutorUI.includes("{id:'endTime',label:'Hora de finalización (opcional)',type:'time'"));
 assert(plannerUI.includes("{id:'endTime',label:'Hora de finalización (opcional)',type:'time'"));
 assert(tutorUI.includes("value:e?.endTime||'',required:false"));
 assert(plannerUI.includes("value:existing?.endTime||'',required:false"));
});
