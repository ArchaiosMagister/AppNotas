import test from 'node:test';
import assert from 'node:assert/strict';
import {initialNotebook,addGroup,addStudent,addAssessment,addCategory,setGrade,setOrthographyGrade,assertModel,createRubric,setRubricGrade,setPeriodCategory} from '../src/model.js';
import {categoryEvidence,overallGrade,competencyGrade,finalGrade,effectiveAssessmentScore,roundGrade} from '../src/calculations.js';
import {activeYear,saveSlot,saveEvent,saveException,deletePlannerItem,assertPlanner,saveLesson} from '../src/planner.js';
import {parseRubricXlsx} from '../src/rubric-xlsx.js';

function setup(){
 const doc=initialNotebook();const group=addGroup(doc,'Grupo de pruebas','Latín I','2026-2027','1bach');
 const student=addStudent(doc,group.id,'Alumno ficticio');
 const period=doc.periods[0];const category=doc.categories.find(c=>c.name==='Exámenes');
 for(const c of doc.categories)setPeriodCategory(doc,group.id,period.id,c.id,{weight:c.id===category.id?100:0});
 const assessments=[1,2,3].map((weight,i)=>addAssessment(doc,{name:`Prueba ${i+1}`,groupId:group.id,periodId:period.id,categoryId:category.id,weight}));
 return {doc,group,student,period,category,assessments};
}
function close(a,b){assert(Math.abs(a-b)<1e-9,`${a} != ${b}`);}

for(const [rule,expected] of [
 ['mean',(6+8+9)/3],['weighted_mean',(6*1+8*2+9*3)/6],
 ['highest',9],['best_n',(9+8)/2],['last',9],['latest_if_highest',9]
]){
 test(`cálculos optimizados conservan la regla ${rule}`,()=>{
  const t=setup();t.assessments.forEach((a,i)=>setGrade(t.doc,t.student.id,a.id,[6,8,9][i]));
  setPeriodCategory(t.doc,t.group.id,t.period.id,t.category.id,{rule,bestCount:2});
  close(categoryEvidence(t.doc,t.student.id,t.category.id,t.group.id,t.period.id).grade,expected);
  close(overallGrade(t.doc,t.student.id,t.group.id,t.period.id),expected);
  close(finalGrade(t.doc,t.student.id,t.group.id),expected);assertModel(t.doc);
 });
}
test('recuperación mayor y sustitución ponderan solo una evidencia por actividad',()=>{
 const t=setup(),a=t.assessments[0];
 setGrade(t.doc,t.student.id,a.id,4);
 const r=addAssessment(t.doc,{name:'Recuperación',groupId:t.group.id,periodId:t.period.id,categoryId:t.category.id,recoveryOf:a.id,recoveryMode:'higher'});
 setGrade(t.doc,t.student.id,r.id,7);close(categoryEvidence(t.doc,t.student.id,t.category.id,t.group.id,t.period.id).grade,7);
 r.recoveryMode='replace';setGrade(t.doc,t.student.id,r.id,3);
 close(categoryEvidence(t.doc,t.student.id,t.category.id,t.group.id,t.period.id).grade,3);assertModel(t.doc);
});
test('la última nota menor no elimina la media y una nota futura sin evaluar no se inventa',()=>{
 const t=setup();[9,6,undefined].forEach((value,i)=>value!==undefined&&setGrade(t.doc,t.student.id,t.assessments[i].id,value));
 setPeriodCategory(t.doc,t.group.id,t.period.id,t.category.id,{rule:'latest_if_highest'});
 close(categoryEvidence(t.doc,t.student.id,t.category.id,t.group.id,t.period.id).grade,7.5);
});
test('la nota de un examen sobre cinco se penaliza una vez y el alumno puede recuperarla',()=>{
 const t=setup(),a=t.assessments[0];a.maxScore=5;a.convertToTen=true;
 setOrthographyGrade(t.doc,t.student.id,a.id,{score:'4,25',faults:4,delivered:false});
 let grade=t.doc.grades.find(g=>g.studentId===t.student.id&&g.assessmentId===a.id);
 close(effectiveAssessmentScore(t.doc,a,grade),8.1);
 setOrthographyGrade(t.doc,t.student.id,a.id,{score:'4,25',faults:4,delivered:true});
 grade=t.doc.grades.find(g=>g.studentId===t.student.id&&g.assessmentId===a.id);
 close(effectiveAssessmentScore(t.doc,a,grade),8.5);assertModel(t.doc);
});
function monday(doc){const group=doc.groups[0];const session=saveSlot(doc,{day:0,start:'08:00',end:'08:55',type:'class',groupId:group.id});const event=saveEvent(doc,{date:'2026-11-23',title:'Prueba ficticia',type:'exam',slotId:session.id,groupId:group.id,assessmentId:doc.assessments[0].id});return {session,event};}
test('editar un cambio de hora a cancelación restaura hora de los exámenes vinculados',()=>{
 const doc=initialNotebook(),{session,event}=monday(doc);
 const exception=saveException(doc,{date:'2026-11-23',slotId:session.id,type:'move',start:'12:00',end:'12:55'});
 assert.equal(event.time,'12:00');
 saveException(doc,{id:exception.id,date:'2026-11-23',slotId:session.id,type:'cancel'});
 assert.equal(event.time,'08:00');assertPlanner(doc);
});
test('mover una excepción entre fechas restaura la fecha original y actualiza la nueva',()=>{
 const doc=initialNotebook(),{session,event}=monday(doc);
 const next=saveEvent(doc,{date:'2026-11-30',title:'Prueba 2',type:'exam',slotId:session.id,groupId:doc.groups[0].id});
 const exception=saveException(doc,{date:'2026-11-23',slotId:session.id,type:'move',start:'12:00',end:'12:55'});
 saveException(doc,{id:exception.id,date:'2026-11-30',slotId:session.id,type:'move',start:'11:15',end:'12:15'});
 assert.equal(event.time,'08:00');assert.equal(next.time,'11:15');
 deletePlannerItem(doc,'exceptions',exception.id);
 assert.equal(next.time,'08:00');assertPlanner(doc);
});
test('tipos heredados de Object.prototype no se aceptan como clases o eventos',()=>{
 const doc=initialNotebook(),slot=monday(doc).session;
 assert.throws(()=>saveSlot(doc,{day:0,start:'09:00',end:'10:00',type:'constructor'}),/Tipo de sesión/);
 assert.throws(()=>saveEvent(doc,{date:'2026-11-23',title:'Ficticio',type:'__proto__'}),/Tipo de evento/);
 assert.throws(()=>saveException(doc,{date:'2026-11-23',slotId:slot.id,type:'constructor'}),/Cambio excepcional/);
 const y=activeYear(doc);y.slots[0].type='constructor';assert.throws(()=>assertModel(doc),/Horario inválido/);
});
test('una copia restaurada no puede contener excepciones ni planes duplicados',()=>{
 const doc=initialNotebook(),{session}=monday(doc),y=activeYear(doc);
 const e=saveException(doc,{date:'2026-11-23',slotId:session.id,type:'cancel'});
 y.exceptions.push({...e,id:crypto.randomUUID()});assert.throws(()=>assertModel(doc),/Agenda duplicada/);y.exceptions.pop();
 const l=saveLesson(doc,{date:'2026-11-23',slotId:session.id,planned:'Repaso'});
 y.lessons.push({...l,id:crypto.randomUUID()});assert.throws(()=>assertModel(doc),/Agenda duplicada/);y.lessons.pop();
 assertModel(doc);
});
test('una copia restaurada rechaza un examen enlazado dos veces',()=>{
 const doc=initialNotebook(),{event}=monday(doc),y=activeYear(doc);
 y.events.push({...event,id:crypto.randomUUID()});assert.throws(()=>assertModel(doc),/Agenda duplicada/);
});
function zipStub(entries){return {async loadAsync(){return {files:entries,file:name=>entries[name]??null}}};}
function entry(xml,uncompressedSize=xml.length){return {_data:{uncompressedSize},async:async ()=>xml};}
const fakeParser=class {};
test('Excel comprimido de 3 MB no puede expandir una hoja de 100 MB',async()=>{
 let expanded=false;const item={_data:{uncompressedSize:100_000_000},async:async()=>{expanded=true;return 'x'}};
 await assert.rejects(parseRubricXlsx(new ArrayBuffer(5),'prueba.xlsx',zipStub({'xl/worksheets/sheet1.xml':item}),fakeParser),/demasiado grande/);
 assert.equal(expanded,false);
});
test('Excel limita sharedStrings comprimidos y rechaza DTD XML',async()=>{
 const shared={_data:{uncompressedSize:15_000_000},async:async()=>{throw Error('No debe expandir')}};
 const sheet=entry('<worksheet/>');
 await assert.rejects(parseRubricXlsx(new ArrayBuffer(5),'prueba.xlsx',zipStub({'xl/worksheets/sheet1.xml':sheet,'xl/sharedStrings.xml':shared}),fakeParser),/demasiado grande/);
 const evil=entry('<!DOCTYPE root [<!ENTITY explode "x">]><worksheet/>');
 await assert.rejects(parseRubricXlsx(new ArrayBuffer(5),'prueba.xlsx',zipStub({'xl/worksheets/sheet1.xml':evil}),fakeParser),/no permitidas/);
});
test('Excel con miles de entradas XML pequeñas se rechaza sin procesarlas',async()=>{
 const entries=Object.fromEntries(Array.from({length:1002},(_,i)=>[`trash/${i}.xml`,entry('hi')]));
 entries['xl/worksheets/sheet1.xml']=entry('<worksheet/>');
 await assert.rejects(parseRubricXlsx(new ArrayBuffer(5),'prueba.xlsx',zipStub(entries),fakeParser),/demasiados archivos/);
});
test('los redondeos positivos no alteran la precisión interna ni exceden dos decimales',()=>{
 for(let i=0;i<10000;i++){
  const x=i/1000;const rounded=roundGrade(x,2);
  assert(rounded>=0&&rounded<=10&&Math.abs(Math.round(rounded*100)-rounded*100)<1e-7);
 }
});
