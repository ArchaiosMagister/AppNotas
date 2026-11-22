import test from 'node:test';
import assert from 'node:assert/strict';
import {initialNotebook,addGroup,addStudent,addAssessment,setGrade,assertModel,migrateNotebook} from '../src/model.js';
import {saveEvaluationSession,activeYear} from '../src/planner.js';
import {
 suggestStudentLinks,linkStudentRecords,unlinkStudentRecord,linkedStudentFamilies,
 suggestTutorships,saveTutorship,tutorStudents,tutorGradeRows,tutorGradeBreakdown,
 saveTutorshipEvaluation,tutorshipEvent,consolidateTutorshipEvaluation,tutorshipLegacyEvents
} from '../src/evaluation-groups.js';
import {renderPlanner} from '../src/planner-ui.js';
import {renderSharedEvaluation} from '../src/evaluation-ui.js';

function fixture(){
 const doc=initialNotebook({empty:true}),latin=addGroup(doc,'1.º BACH','Latín I','2026-2027','1bach');
 const greek=addGroup(doc,'1.º BACH','Griego I','2026-2027','1bach');
 const student=(g,name,origin)=>addStudent(doc,g.id,{firstName:name,lastName:'García López',originGroup:origin});
 const la=student(latin,'María','A'),ga=student(greek,'María','A');
 const lb=student(latin,'Lucía','B'),gb=student(greek,'Lucía','B');
 return {doc,latin,greek,la,ga,lb,gb,period:doc.periods[0]};
}
function tutorA(f){
 return saveTutorship(f.doc,{name:'1.º BACH A',sources:[
  {groupId:f.latin.id,originGroup:'A'},{groupId:f.greek.id,originGroup:'A'}]});
}
test('la detección propone mismos nombres en asignaturas distintas, pero nunca los vincula por sí sola',()=>{
 const f=fixture(),suggestions=suggestStudentLinks(f.doc,'2026-2027');
 assert.equal(suggestions.length,2);
 assert(suggestions.every(s=>s.quality==='exacta'));
 assert.equal(f.la.personId,undefined);assert.equal(f.ga.personId,undefined);
 assert.equal(suggestTutorships(f.doc,'2026-2027').length,2);
});
test('la vinculación preserva identificadores, notas, actividades y evaluación original',()=>{
 const f=fixture(),a=addAssessment(f.doc,{name:'Examen latín',groupId:f.latin.id,periodId:f.period.id,
  categoryId:f.doc.categories[0].id,maxScore:10,weight:1,convertToTen:true});
 const b=addAssessment(f.doc,{name:'Examen griego',groupId:f.greek.id,periodId:f.period.id,
  categoryId:f.doc.categories[0].id,maxScore:10,weight:1,convertToTen:true});
 setGrade(f.doc,f.la.id,a.id,'7.20');setGrade(f.doc,f.ga.id,b.id,'9.10');
 const grades=structuredClone(f.doc.grades),assessments=structuredClone(f.doc.assessments);
 const person=linkStudentRecords(f.doc,[f.la.id,f.ga.id]);
 assert.equal(f.la.personId,person);assert.equal(f.ga.personId,person);
 assert.equal(linkedStudentFamilies(f.doc,'2026-2027').length,1);
 assert.deepEqual(f.doc.grades,grades);assert.deepEqual(f.doc.assessments,assessments);
 assertModel(f.doc);
 const tutor=tutorA(f),data=tutorGradeRows(f.doc,tutor.id,f.period.id);
 assert.equal(data.rows.length,1);
 assert(data.rows[0].grades.every((g,i)=>Math.abs(g.mean-[7.2,9.1][i])<1e-9));
 assert.deepEqual(data.rows[0].grades.map(g=>g.itaca),[7,9]);
 const parts=tutorGradeBreakdown(f.doc,f.ga.id,f.greek.id,f.period.id);
 assert(parts.find(p=>p.name==='Exámenes').grade===9.1);
});
test('sin vincular, una tutoría muestra todas las fichas, no fusiona homónimos',()=>{
 const f=fixture(),t=tutorA(f);
 assert.equal(tutorStudents(f.doc,t.id).length,2);
 assert.equal(tutorGradeRows(f.doc,t.id,f.period.id).rows.length,2);
});
test('un alumno sin Griego se muestra con no matriculado, sin convertirlo a cero',()=>{
 const f=fixture(),t=tutorA(f);f.doc.students=f.doc.students.filter(s=>s.id!==f.ga.id);
 const row=tutorGradeRows(f.doc,t.id,f.period.id).rows[0];
 assert.equal(row.grades[0].studentId,f.la.id);assert.equal(row.grades[1].studentId,null);
 assert.equal(row.grades[1].mean,null);
 assertModel(f.doc);
});
test('identidades de diferentes cursos, tutorías incompatibles o mismo grupo no se pueden mezclar',()=>{
 const f=fixture();
 assert.throws(()=>linkStudentRecords(f.doc,[f.la.id,f.lb.id]),/mismo grupo/);
 assert.throws(()=>linkStudentRecords(f.doc,[f.la.id,f.gb.id]),/tutorías compatibles/);
 assertModel(f.doc);
});
test('desvincular revierte solo la identidad compartida sin modificar las calificaciones',()=>{
 const f=fixture(),id=linkStudentRecords(f.doc,[f.la.id,f.ga.id]);
 const grades=structuredClone(f.doc.grades);
 assert.equal(unlinkStudentRecord(f.doc,f.ga.id),true);assert.equal(f.ga.personId,undefined);
 assert.equal(f.la.personId,id);assert.deepEqual(f.doc.grades,grades);
 assertModel(f.doc);
});
test('tutorías A y B son independientes y una procedencia no puede duplicarse',()=>{
 const f=fixture(),a=tutorA(f);
 const b=saveTutorship(f.doc,{name:'1.º BACH B',sources:[
  {groupId:f.latin.id,originGroup:'B'},{groupId:f.greek.id,originGroup:'B'}]});
 assert.notEqual(a.id,b.id);
 assert.throws(()=>saveTutorship(f.doc,{name:'Duplicada',sources:[{groupId:f.latin.id,originGroup:'A'}]}),/dos tutorías/);
 assertModel(f.doc);
});
test('dos tutorías diferentes pueden tener convocatorias en el mismo trimestre',()=>{
 const f=fixture(),a=tutorA(f),b=saveTutorship(f.doc,{name:'1.º BACH B',sources:[
  {groupId:f.latin.id,originGroup:'B'},{groupId:f.greek.id,originGroup:'B'}]});
 saveTutorshipEvaluation(f.doc,{tutorshipId:a.id,periodId:f.period.id,date:'2026-12-18',time:'15:30'});
 saveTutorshipEvaluation(f.doc,{tutorshipId:b.id,periodId:f.period.id,date:'2026-12-19',time:'17:00'});
 assert.equal(activeYear(f.doc).events.length,2);assertModel(f.doc);
});
test('convocatoria común aparece en agenda y calendario sin crear duplicados por asignatura',()=>{
 const f=fixture(),t=tutorA(f);
 const event=saveTutorshipEvaluation(f.doc,{tutorshipId:t.id,periodId:f.period.id,date:'2026-12-18',time:'15:30',notes:'Aula 4'});
 const again=saveTutorshipEvaluation(f.doc,{id:event.id,tutorshipId:t.id,periodId:f.period.id,date:'2026-12-19',time:'16:00'});
 assert.equal(again.id,event.id);assert.equal(activeYear(f.doc).events.length,1);
 assert.match(renderPlanner(f.doc,{plannerMode:'week',plannerDate:'2026-12-14'}),/Sesiones de evaluación por tutoría/);
 assert.match(renderPlanner(f.doc,{plannerMode:'day',plannerDate:'2026-12-19'}),/1.º BACH A/);
 assertModel(f.doc);
});
test('convocatorias heredadas discordantes impiden nuevas fechas y requieren consolidación confirmada',()=>{
 const f=fixture();
 saveEvaluationSession(f.doc,{groupId:f.latin.id,periodId:f.period.id,originGroup:'A',date:'2026-12-18',time:'15:30',notes:'Antigua latín'});
 saveEvaluationSession(f.doc,{groupId:f.greek.id,periodId:f.period.id,originGroup:'A',date:'2026-12-19',time:'16:00',notes:'Antigua griego'});
 const t=tutorA(f),prior=tutorshipLegacyEvents(f.doc,t.id,f.period.id);
 assert.equal(prior.length,2);
 assert.throws(()=>saveTutorshipEvaluation(f.doc,{tutorshipId:t.id,periodId:f.period.id,date:'2026-12-20',time:'15:30'}),/revisa las convocatorias/);
 const canonical=consolidateTutorshipEvaluation(f.doc,{tutorshipId:t.id,periodId:f.period.id,chosenEventId:prior[0].id});
 assert.equal(canonical.date,'2026-12-18');
 assert.equal(activeYear(f.doc).events.length,1);
 assert.equal(f.doc.evaluationArchive.length,2);
 assert.deepEqual(f.doc.evaluationArchive.map(a=>a.event.notes),['Antigua latín','Antigua griego']);
 assert.equal(tutorshipEvent(f.doc,t.id,f.period.id)?.id,prior[0].id);
 assertModel(f.doc);
});
test('copias históricas sin los nuevos campos siguen siendo compatibles',()=>{
 const f=fixture(),legacy=structuredClone(f.doc);
 delete legacy.tutorships;delete legacy.evaluationArchive;
 assertModel(legacy);
 const result=migrateNotebook(legacy);
 assert.equal(result.migrated,false);
 assert.equal(result.doc.students.length,4);
});
test('no se aceptan identidades compartidas manipuladas o doble matrícula de una misma identidad',()=>{
 const f=fixture();linkStudentRecords(f.doc,[f.la.id,f.ga.id]);
 f.gb.personId=f.la.personId;
 assert.throws(()=>assertModel(f.doc),/dos veces|incompatibles/);
});

test('equivalencias gráficas de procedencia conservan la vinculación y validan el cuaderno',()=>{
 const f=fixture();
 f.la.originGroup='1º Bach A';
 f.ga.originGroup='1.º Bachillerato A';
 const personId=linkStudentRecords(f.doc,[f.la.id,f.ga.id]);
 assert.equal(f.ga.personId,personId);
 assertModel(f.doc);
});
test('un grupo sin alumnos en cierta división puede figurar sin nota como fuente de tutoría',()=>{
 const f=fixture();
 f.doc.students=f.doc.students.filter(s=>s.id!==f.ga.id);
 const t=saveTutorship(f.doc,{name:'1.º BACH A',sources:[
  {groupId:f.latin.id,originGroup:'A'},{groupId:f.greek.id,originGroup:'A'}]});
 const rows=tutorGradeRows(f.doc,t.id,f.period.id).rows;
 assert.equal(rows.length,1);
 assert.equal(rows[0].grades[1].studentId,null);
 assertModel(f.doc);
});
test('el visor incluye gestión de vinculaciones, sesiones comunes y lectura de notas sin editar',()=>{
 const f=fixture(),t=tutorA(f);
 const html=renderSharedEvaluation(f.doc,activeYear(f.doc),{plannerEvaluationView:{tutorshipId:t.id,periodId:f.period.id}});
 assert.match(html,/data-eval-link-pair/);
 assert.match(html,/data-eval-tutor-session/);
 assert.match(html,/data-eval-open-tutor/);
 assert.match(html,/eval-combined-table/);
 assert.match(html,/Ítaca/);
 assert.doesNotMatch(html,/data-student=.*data-assessment=/);
});
