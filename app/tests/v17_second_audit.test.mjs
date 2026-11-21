import test from 'node:test';
import assert from 'node:assert/strict';
import {initialNotebook,addGroup,addStudent,addAssessment,parseScore,assertModel,setGrade} from '../src/model.js';
import {categoryEvidence,categoryGrade,overallGrade,calculationBreakdown,periodCalculationWarnings} from '../src/calculations.js';
import {activeYear,saveSlot,saveLesson,saveEvent,saveTask,saveHoliday,saveException,carryLesson,nextClassDate,updateAcademicYear} from '../src/planner.js';

const make=()=>{const doc=initialNotebook();return {doc,group:doc.groups[0],period:doc.periods[0],y:activeYear(doc)};};
const slot=(doc,group,day,start='08:00',end='08:55')=>saveSlot(doc,{type:'class',groupId:group.id,day,start,end});

test('acortar un curso con exámenes, tareas o planificaciones no invalida los datos y no modifica nada',()=>{
  const {doc,group,y}=make();const s=slot(doc,group,0);
  saveEvent(doc,{date:'2026-11-23',type:'exam',title:'Parcial',groupId:group.id,slotId:s.id});
  saveTask(doc,{dueDate:'2026-11-24',title:'Corregir'});
  saveLesson(doc,{date:'2026-11-30',slotId:s.id,planned:'Traducción'});
  const snapshot=structuredClone(doc);
  assert.throws(()=>updateAcademicYear(doc,y.id,{end:'2026-11-25'}),/fuera|existen/i);
  assert.deepEqual(doc,snapshot);assertModel(doc);
});

test('los días de vacaciones también impiden estrechar el curso sin perder los festivos',()=>{
  const {doc,y}=make();saveHoliday(doc,{name:'Vacaciones',start:'2026-12-20',end:'2027-01-06'});
  const original=structuredClone(doc);
  assert.throws(()=>updateAcademicYear(doc,y.id,{start:'2027-01-01'}),/fuera|existen/i);
  assert.deepEqual(doc,original);assertModel(doc);
});

test('trasladar pendiente busca la próxima clase del grupo, no el próximo lunes del mismo hueco',()=>{
 const {doc,group,y}=make();const monday=slot(doc,group,0),wednesday=slot(doc,group,2,'11:00','11:55');
 const lesson=saveLesson(doc,{date:'2026-11-23',slotId:monday.id,planned:'Adjetivos'});
 assert.equal(nextClassDate(y,monday.id,lesson.date),'2026-11-25');
 const moved=carryLesson(doc,lesson.id);
 assert.equal(moved.date,'2026-11-25');assert.equal(moved.slotId,wednesday.id);
 assert.equal(moved.planned,'Adjetivos');assert.equal(lesson.planned,'');assertModel(doc);
});

test('traslado respeta festivos, cancelaciones y sesiones consecutivas en el mismo día',()=>{
 const {doc,group,y}=make();const s1=slot(doc,group,0,'08:00','08:55'),s2=slot(doc,group,0,'10:00','10:55'),s3=slot(doc,group,2,'12:00','12:55');
 saveException(doc,{date:'2026-11-23',slotId:s2.id,type:'cancel'});
 saveHoliday(doc,{name:'Puente',start:'2026-11-25'});
 const lesson=saveLesson(doc,{date:'2026-11-23',slotId:s1.id,planned:'Repaso'});
 assert.equal(nextClassDate(y,s1.id,lesson.date),'2026-11-30');
 const moved=carryLesson(doc,lesson.id);assert.equal(moved.date,'2026-11-30');assert.equal(moved.slotId,s1.id);assertModel(doc);
});

test('sesiones dobles del mismo grupo permiten trasladar a la siguiente hora del mismo día',()=>{
 const {doc,group,y}=make();const a=slot(doc,group,0),b=slot(doc,group,0,'12:00','12:55');
 const lesson=saveLesson(doc,{date:'2026-11-23',slotId:a.id,planned:'Texto'});
 assert.equal(nextClassDate(y,a.id,lesson.date),'2026-11-23');
 const moved=carryLesson(doc,lesson.id);assert.equal(moved.slotId,b.id);assertModel(doc);
});

test('si la próxima sesión ya tiene planificación no se pierde ni altera el trabajo pendiente',()=>{
 const {doc,group}=make();const monday=slot(doc,group,0),wednesday=slot(doc,group,2);
 const lesson=saveLesson(doc,{date:'2026-11-23',slotId:monday.id,planned:'Texto original'});
 saveLesson(doc,{date:'2026-11-25',slotId:wednesday.id,planned:'Otro contenido'});
 const original=structuredClone(doc);
 assert.throws(()=>carryLesson(doc,lesson.id),/ya tiene planificación/);
 assert.deepEqual(doc,original);assertModel(doc);
});

test('las notas de un estudiante nunca se muestran consultando el grupo de otro',()=>{
 const {doc,group,period}=make();const other=addGroup(doc,'Otro grupo','Griego I');
 const id=doc.students[0].id,categoryId=doc.categories[0].id;
 assert.notEqual(overallGrade(doc,id,group.id,period.id),null);
 assert.equal(categoryEvidence(doc,id,categoryId,other.id,period.id).grade,null);
 assert.equal(categoryGrade(doc,id,categoryId,other.id,period.id),null);
 assert.equal(overallGrade(doc,id,other.id,period.id),null);
 assert.deepEqual(calculationBreakdown(doc,id,other.id,period.id),[]);
 assert.deepEqual(periodCalculationWarnings(doc,id,other.id,period.id),[]);
});

test('los valores numéricos también deben cumplir el máximo de dos decimales',()=>{
 for(const score of [4.256,1.005,0.333])assert.throws(()=>parseScore(score),/dos decimales/);
 for(const score of [4.25,0.1,8.5,10])assert.equal(parseScore(score),score);
 const {doc}=make();const original=structuredClone(doc);
 assert.throws(()=>setGrade(doc,doc.students[0].id,doc.assessments[0].id,2.345),/dos decimales/);
 assert.deepEqual(doc,original);assertModel(doc);
});

test('las medias se recalculan al editar una nota; el índice de optimización no retiene datos antiguos',()=>{
 const {doc,group,period}=make();const st=doc.students[0],as=doc.assessments[1];
 const initial=overallGrade(doc,st.id,group.id,period.id);
 setGrade(doc,st.id,as.id,0);const changed=overallGrade(doc,st.id,group.id,period.id);
 assert.notEqual(changed,initial);assert.equal(overallGrade(doc,st.id,group.id,period.id),changed);
 setGrade(doc,st.id,as.id,8);assert.equal(overallGrade(doc,st.id,group.id,period.id),initial);
 assertModel(doc);
});

test('las clases de una asignatura manual se enlazan entre días sin mezclar asignaturas distintas',()=>{
 const {doc,y}=make();const monday=saveSlot(doc,{day:0,start:'09:00',end:'09:55',type:'class',label:' Filosofía '});
 const wed=saveSlot(doc,{day:2,start:'10:00',end:'10:55',type:'class',label:'filosofía'});
 saveSlot(doc,{day:1,start:'12:00',end:'12:55',type:'class',label:'Tutoría'});
 const l=saveLesson(doc,{date:'2026-11-23',slotId:monday.id,planned:'Revisión del temario'});
 const target=carryLesson(doc,l.id);assert.equal(target.date,'2026-11-25');assert.equal(target.slotId,wed.id);assertModel(doc);
});

test('los cambios excepcionales de hora se tienen en cuenta para determinar la siguiente clase',()=>{
 const {doc,group,y}=make();const early=slot(doc,group,0,'08:00','08:55'),late=slot(doc,group,0,'10:00','10:55');
 saveException(doc,{date:'2026-11-23',slotId:early.id,type:'move',start:'13:00',end:'13:55'});
 const l=saveLesson(doc,{date:'2026-11-23',slotId:late.id,planned:'Concordancia'});
 // La clase de las 08:00 se ha movido a las 13:00, después de la de las 10:00.
 const target=carryLesson(doc,l.id);assert.equal(target.date,'2026-11-23');assert.equal(target.slotId,early.id);assertModel(doc);
});

test('no se traslada el contenido de una clase ya marcada como impartida',()=>{
 const {doc,group}=make(),s=slot(doc,group,0),l=saveLesson(doc,{date:'2026-11-23',slotId:s.id,planned:'Adjetivos',done:true,actual:'Adjetivos vistos'});
 const before=structuredClone(doc);
 assert.throws(()=>carryLesson(doc,l.id),/realizada/);assert.deepEqual(doc,before);assertModel(doc);
});

test('un recorte válido mantiene íntegros el horario y las calificaciones',()=>{
 const {doc,group,y}=make();const slots=slot(doc,group,0),grades=structuredClone(doc.grades);
 saveEvent(doc,{type:'exam',title:'Parcial',date:'2026-11-23',groupId:group.id,slotId:slots.id});
 updateAcademicYear(doc,y.id,{start:'2026-11-01',end:'2027-01-30'});
 assert.equal(y.start,'2026-11-01');assert.equal(y.end,'2027-01-30');assert.deepEqual(doc.grades,grades);assertModel(doc);
});
