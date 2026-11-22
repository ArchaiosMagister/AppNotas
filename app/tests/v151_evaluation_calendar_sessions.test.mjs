import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initialNotebook,addGroup,addStudent,assertModel} from '../src/model.js';
import {overallGrade,finalGrade,competencyGrade,itacaGrade} from '../src/calculations.js';
import {
 activeYear,EVENT_TYPES,saveEvent,saveEvaluationSession,calendarEventIcs,
 deletePlannerItem,addAcademicYear,assertPlanner
} from '../src/planner.js';
import {renderPlanner} from '../src/planner-ui.js';
import {ensureBookMetadata,markBookChange,createPortableCopy,readBackupFile} from '../src/cuaderno.js';
import {createVault,saltFromEnvelope} from '../src/vault.js';

const fixture=()=>{const doc=initialNotebook();return {doc,group:doc.groups[0],period:doc.periods[0],student:doc.students[0],year:activeYear(doc)};};
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('una sesión de evaluación concreta solo añade una cita, sin tocar ninguna nota ni media',()=>{
 const {doc,group,period,student,year}=fixture(),grades=structuredClone(doc.grades);
 const before={trim:overallGrade(doc,student.id,group.id,period.id),annual:finalGrade(doc,student.id,group.id),
  itaca:itacaGrade(doc,student.id,group.id,period.id),ce:competencyGrade(doc,student.id,doc.competencies[0].id,group.id,period.id)};
 const event=saveEvaluationSession(doc,{groupId:group.id,periodId:period.id,date:'2026-12-18',time:'15:45',notes:'Sala del profesorado'});
 assert.equal(event.type,'evaluation');
 assert.equal(event.groupId,group.id);assert.equal(event.periodId,period.id);
 assert.equal(event.time,'15:45');assert.equal(event.slotId,null);assert.equal(event.assessmentId,null);
 assert.equal(year.events.length,1);assert.deepEqual(doc.grades,grades);
 assert.equal(overallGrade(doc,student.id,group.id,period.id),before.trim);
 assert.equal(finalGrade(doc,student.id,group.id),before.annual);
 assert.equal(itacaGrade(doc,student.id,group.id,period.id),before.itaca);
 assert.equal(competencyGrade(doc,student.id,doc.competencies[0].id,group.id,period.id),before.ce);
 assertModel(doc);
});

test('una sola sesión por grupo, trimestre y año; se puede editar y eliminar sin perder otros eventos',()=>{
 const {doc,group,period,year}=fixture();
 const otherPeriod=doc.periods[1],other=addGroup(doc,'Griego I A','Griego I',year.name,'1bach');
 const regular=saveEvent(doc,{date:'2026-12-01',type:'meeting',title:'Claustro',time:'16:00'});
 const first=saveEvaluationSession(doc,{groupId:group.id,periodId:period.id,date:'2026-12-18',time:'14:30'});
 const unchanged=structuredClone(doc);
 assert.throws(()=>saveEvaluationSession(doc,{groupId:group.id,periodId:period.id,date:'2026-12-19',time:'14:30'}),/ya tiene una sesión/);
 assert.deepEqual(doc,unchanged);
 const amended=saveEvaluationSession(doc,{id:first.id,groupId:group.id,periodId:period.id,date:'2026-12-19',time:'16:05'});
 assert.equal(amended.id,first.id);assert.equal(year.events.length,2);
 assert.equal(amended.date,'2026-12-19');assert.equal(amended.time,'16:05');
 saveEvaluationSession(doc,{groupId:group.id,periodId:otherPeriod.id,date:'2027-03-19',time:'16:05'});
 saveEvaluationSession(doc,{groupId:other.id,periodId:period.id,date:'2026-12-19',time:'16:05'});
 assert.equal(year.events.length,4);
 deletePlannerItem(doc,'events',first.id);
 assert.equal(year.events.length,3);assert.equal(year.events.find(x=>x.id===regular.id).title,'Claustro');
 assertModel(doc);
});

test('fechas, horas, evaluaciones y grupos inválidos se rechazan antes de cambiar el cuaderno',()=>{
 const {doc,group,period,year}=fixture();
 const outside=addGroup(doc,'Otro curso','Latín I','2027-2028','1bach');
 const scenarios=[
  {groupId:outside.id,periodId:period.id,date:'2026-12-18',time:'16:00'},
  {groupId:group.id,periodId:'periodo-inexistente',date:'2026-12-18',time:'16:00'},
  {groupId:group.id,periodId:period.id,date:'2026-12-18',time:''},
  {groupId:group.id,periodId:period.id,date:'2026-12-18',time:'28:10'},
  {groupId:group.id,periodId:period.id,date:'2027-07-01',time:'15:00'}
 ];
 for(const candidate of scenarios){
  const before=structuredClone(doc);
  assert.throws(()=>saveEvaluationSession(doc,candidate));
  assert.deepEqual(doc,before);
 }
 const before=structuredClone(doc);
 assert.throws(()=>saveEvent(doc,{date:'2026-11-25',type:'meeting',title:'Otra',periodId:period.id,time:'10:00'}),/Solo las sesiones/);
 assert.deepEqual(doc,before);
 assert.equal(year.events.length,0);
 assertModel(doc);
});

test('el modelo rechaza convocatorias duplicadas o sin trimestre al restaurar',()=>{
 const {doc,group,period}=fixture();
 const e=saveEvaluationSession(doc,{groupId:group.id,periodId:period.id,date:'2026-12-18',time:'17:00'});
 const duplicate=structuredClone(doc);
 duplicate.planner.years[0].events.push({...e,id:'id-distinto'});
 assert.throws(()=>assertModel(duplicate),/duplicada/);
 const incomplete=structuredClone(doc);
 delete incomplete.planner.years[0].events[0].periodId;
 assert.throws(()=>assertModel(incomplete),/Evento inválido/);
 assertModel(doc);
});

test('otro curso se crea sin copiar convocatorias; cada curso puede tener su propia sesión',()=>{
 const {doc,group,period,year}=fixture();
 saveEvaluationSession(doc,{groupId:group.id,periodId:period.id,date:'2026-12-18',time:'15:30'});
 const groupNew=addGroup(doc,group.name,group.subject,'2027-2028',group.level);
 const next=addAcademicYear(doc,{name:'2027-2028',start:'2027-09-01',end:'2028-06-30',copyFrom:year.id});
 assert.equal(next.events.length,0);
 const e=saveEvaluationSession(doc,{groupId:groupNew.id,periodId:period.id,date:'2027-12-17',time:'15:30'});
 assert.equal(next.events.length,1);assert.equal(year.events.length,1);
 assert.notEqual(next.events[0].id,year.events[0].id);
 assert.equal(e.date,'2027-12-17');
 assertModel(doc);
});

test('ICS individual contiene exactamente un VEVENT, hora local y UID estable',()=>{
 const {doc,group,period}=fixture();
 const e=saveEvaluationSession(doc,{groupId:group.id,periodId:period.id,date:'2026-12-18',time:'15:45',notes:'Biblioteca'});
 const file=calendarEventIcs(e,new Date('2026-11-22T12:00:00Z'));
 assert.equal((file.match(/BEGIN:VEVENT/g)||[]).length,1);
 assert(file.includes('UID:'+e.id+'@cuadernodocente.local'));
 assert(file.includes('DTSTART:20261218T154500'));
 assert(file.includes('DTEND:20261218T164500'));
 assert(file.includes('DTSTAMP:20261122T120000Z'));
 assert(file.includes('DESCRIPTION:Biblioteca'));
 assert(file.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'));
 assert(file.endsWith('END:VCALENDAR\r\n'));
 assert(!file.includes(doc.students[0].name));
 assert.equal(calendarEventIcs(e,new Date('2026-11-22T12:00:00Z')),file);
});

test('ICS apoya eventos sin hora y el paso de medianoche sin alterar la fecha del registro',()=>{
 const {doc}=fixture();
 const e=saveEvent(doc,{type:'meeting',title:'Día completo',date:'2026-12-24'});
 const allDay=calendarEventIcs(e);
 assert(allDay.includes('DTSTART;VALUE=DATE:20261224'));
 assert(allDay.includes('DTEND;VALUE=DATE:20261225'));
 const late=saveEvent(doc,{type:'other',title:'Encuentro nocturno',date:'2026-12-24',time:'23:45'});
 const timed=calendarEventIcs(late);
 assert(timed.includes('DTSTART:20261224T234500'));
 assert(timed.includes('DTEND:20261225T004500'));
 assert.equal(late.date,'2026-12-24');
 assertModel(doc);
});

test('ICS escapa comas, saltos de línea y Unicode, con líneas de hasta 75 octetos',()=>{
 const {doc}=fixture();
 const notes='Avisar, sin publicar nombres; evitar copias externas\\\n'+('áéíóú griego ἀρχή · '.repeat(28));
 const e=saveEvent(doc,{type:'other',title:'Reunión, planificación; año',date:'2026-12-19',time:'15:00',notes});
 const file=calendarEventIcs(e);
 assert(file.includes('SUMMARY:Otro evento: Reunión\\, planificación\\; año'));
 assert(file.includes('DESCRIPTION:Avisar\\, sin publicar nombres\\; evitar copias externas'));
 assert(file.includes('\\n'));
 for(const line of file.split('\r\n').filter(Boolean))assert(Buffer.byteLength(line,'utf8')<=75,JSON.stringify(line));
 assertModel(doc);
});

test('edición de fechas y exportación individual aparecen en la vista, sin exposición de notas',()=>{
 const {doc,group,period,student}=fixture();
 const e=saveEvaluationSession(doc,{groupId:group.id,periodId:period.id,date:'2026-12-18',time:'16:00'});
 const html=renderPlanner(doc,{plannerMode:'day',plannerDate:e.date});
 assert(html.includes('plan-show-evaluations'));
 assert(html.includes('id="plan-evaluations"'));
 assert(html.includes('data-eval-group="'+group.id+'" data-eval-period="'+period.id+'"'));
 assert(html.includes('data-export-event="'+e.id+'"'));
 assert(html.includes('Sesiones de evaluación por grupo y trimestre'));
 assert(!html.includes(student.name));
 const script=read('src/planner-ui.js');
 assert(script.includes('function evaluationModal('));
 assert(script.includes('function exportSingleEvent('));
 assert(script.includes('calendarEventIcs(event)'));
 assert(script.includes("value!=='evaluation'"));
 assertModel(doc);
});

test('copia portátil cifrada recupera convocatorias y calificaciones originales sin alteraciones',async()=>{
 const {doc,group,period,student}=fixture();
 ensureBookMetadata(doc);
 const old=structuredClone(doc);
 saveEvaluationSession(doc,{groupId:group.id,periodId:period.id,date:'2026-12-18',time:'15:15',notes:'Sala de reuniones'});
 markBookChange(doc,old);
 const before=structuredClone(doc),average=overallGrade(doc,student.id,group.id,period.id);
 const password='Clave temporal de pruebas de sesiones de evaluación 2026';
 const {key,envelope}=await createVault(password,doc);
 const {file}=await createPortableCopy(doc,key,saltFromEnvelope(envelope));
 const raw=JSON.stringify(file);
 assert(!raw.includes(student.name));
 const restored=await readBackupFile({size:Buffer.byteLength(raw),text:async()=>raw},password);
 assert.deepEqual(restored.doc,before);
 assert.equal(overallGrade(restored.doc,student.id,group.id,period.id),average);
 assert.equal(restored.doc.planner.years[0].events[0].type,'evaluation');
 assertModel(restored.doc);
});
