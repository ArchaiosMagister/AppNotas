import test from 'node:test';
import assert from 'node:assert/strict';
import {
 initialNotebook,assertModel,addAssessment,createRubric,
 setGrade,setRubricGrade,setOrthographyGrade,setPendingJustified,
 addGroup,addStudent,setFinalOverride
} from '../src/model.js';
import {
 effectiveAssessmentScore,categoryGrade,overallGrade,finalGrade,competencyGrade,
 itacaGrade
} from '../src/calculations.js';
import {ensureBookMetadata,markBookChange,createPortableCopy,readBackupFile,compareBookVersions} from '../src/cuaderno.js';
import {createVault,saltFromEnvelope} from '../src/vault.js';

const fx=()=>{
 const doc=initialNotebook(),student=doc.students[0],group=doc.groups[0],
 period=doc.periods[0],assessment=doc.assessments[0];
 return {doc,student,group,period,assessment};
};
const record=(doc,studentId,assessmentId)=>doc.grades.find(g=>g.studentId===studentId&&g.assessmentId===assessmentId);
const close=(actual,expected)=>assert(Math.abs(actual-expected)<1e-9,`Se esperaba ${expected} y se obtuvo ${actual}`);
const key='Contraseña de prueba de consistencia y cifrado 2026';

test('AJ + introducir la misma nota numérica reactiva esa evidencia sin alterar su valor ni su ID',()=>{
 const {doc,student,group,period,assessment}=fx();
 const previous=structuredClone(record(doc,student.id,assessment.id));
 const before=overallGrade(doc,student.id,group.id,period.id);
 setPendingJustified(doc,student.id,assessment.id,true);
 assert.equal(record(doc,student.id,assessment.id).pendingJustified,true);
 setGrade(doc,student.id,assessment.id,previous.score);
 const restored=record(doc,student.id,assessment.id);
 assert.equal(restored.id,previous.id);
 assert.equal(restored.score,previous.score);
 assert.equal(restored.pendingJustified,undefined,'AJ debe desaparecer al reintroducir una nota idéntica');
 close(overallGrade(doc,student.id,group.id,period.id),before);
 assertModel(doc);
});

test('AJ sobre nota 0: volver a introducir 0 restaura el suspenso evaluado, no una ausencia',()=>{
 const {doc,student,group,period,assessment}=fx();
 setGrade(doc,student.id,assessment.id,0);
 const initial=categoryGrade(doc,student.id,assessment.categoryId,group.id,period.id);
 setPendingJustified(doc,student.id,assessment.id,true);
 setGrade(doc,student.id,assessment.id,0);
 assert.equal(record(doc,student.id,assessment.id).pendingJustified,undefined);
 assert.equal(record(doc,student.id,assessment.id).score,0);
 close(categoryGrade(doc,student.id,assessment.categoryId,group.id,period.id),initial);
 assertModel(doc);
});

test('AJ sobre examen ortográfico: idéntica nota y faltas reactivan el descuento y respetan la entrega',()=>{
 const {doc,student,group,period}=fx();
 const a=addAssessment(doc,{name:'Examen ortográfico',groupId:group.id,periodId:period.id,
  categoryId:doc.categories[0].id,orthography:{enabled:true,penaltyPerFault:.3,repetitions:20,refundable:true}});
 setOrthographyGrade(doc,student.id,a.id,{score:7.25,faults:3,delivered:false});
 const before=effectiveAssessmentScore(doc,a,record(doc,student.id,a.id));
 setPendingJustified(doc,student.id,a.id,true);
 setOrthographyGrade(doc,student.id,a.id,{score:7.25,faults:3,delivered:false});
 const restored=record(doc,student.id,a.id);
 assert.equal(restored.pendingJustified,undefined,'AJ debe retirarse al confirmar una nota idéntica');
 close(effectiveAssessmentScore(doc,a,restored),before);
 assert.equal(restored.orthographyFaults,3);
 assert.equal(restored.orthographyDelivered,false);
 assertModel(doc);
});

test('AJ con faltas ya entregadas: reintroducir igual no vuelve a penalizar',()=>{
 const {doc,student,group,period}=fx();
 const a=addAssessment(doc,{name:'Devolución ortográfica',groupId:group.id,periodId:period.id,
  categoryId:doc.categories[0].id,orthography:{enabled:true,penaltyPerFault:.5,repetitions:10,refundable:true}});
 setOrthographyGrade(doc,student.id,a.id,{score:8.5,faults:2,delivered:true});
 setPendingJustified(doc,student.id,a.id,true);
 setOrthographyGrade(doc,student.id,a.id,{score:8.5,faults:2,delivered:true});
 const g=record(doc,student.id,a.id);
 assert.equal(g.pendingJustified,undefined);
 assert.equal(g.orthographyDelivered,true);
 close(effectiveAssessmentScore(doc,a,g),8.5);
 assertModel(doc);
});

test('AJ con rúbrica: reintroducir los mismos criterios reactiva su nota sin recomponer valores',()=>{
 const {doc,student,group,period}=fx();
 const rubric=createRubric(doc,'Rúbrica',[
  {name:'Comprensión',maxScore:6,weight:3},
  {name:'Expresión',maxScore:4,weight:1}
 ]);
 const a=addAssessment(doc,{name:'Trabajo con rúbrica',groupId:group.id,periodId:period.id,
 categoryId:doc.categories[1].id,rubricId:rubric.id});
 const ratings={[rubric.criteria[0].id]:4.5,[rubric.criteria[1].id]:3};
 setRubricGrade(doc,student.id,a.id,ratings);
 const before=structuredClone(record(doc,student.id,a.id));
 setPendingJustified(doc,student.id,a.id,true);
 setRubricGrade(doc,student.id,a.id,ratings);
 const restored=record(doc,student.id,a.id);
 assert.equal(restored.pendingJustified,undefined);
 assert.equal(restored.id,before.id);
 assert.deepEqual(restored.rubricRatings,before.rubricRatings);
 close(restored.score,before.score);
 assertModel(doc);
});

test('sin AJ, volver a introducir idéntica nota no modifica ni marca el cuaderno',()=>{
 const {doc,student,assessment}=fx(),before=structuredClone(doc);
 setGrade(doc,student.id,assessment.id,record(doc,student.id,assessment.id).score);
 assert.deepEqual(doc,before);
 assertModel(doc);
});

test('configuración, grupos, exámenes y notas finales no recalculan silenciosamente otros grupos',()=>{
 const {doc,student,group,period,assessment}=fx();
 const other=addGroup(doc,'Otro grupo');
 const otherStudent=addStudent(doc,other.id,'Alumno externo');
 const otherAssessment=addAssessment(doc,{name:'Examen externo',groupId:other.id,periodId:period.id,categoryId:assessment.categoryId});
 setGrade(doc,otherStudent.id,otherAssessment.id,5);
 const gradeBefore=overallGrade(doc,student.id,group.id,period.id);
 setFinalOverride(doc,student.id,period.id,9.5);
 setGrade(doc,otherStudent.id,otherAssessment.id,9.75);
 close(overallGrade(doc,student.id,group.id,period.id),gradeBefore);
 assertModel(doc);
});

test('copia cifrada verificable tras reactivar AJ conserva exactamente puntuaciones y niveles',async()=>{
 const {doc,student,group,period,assessment}=fx();
 ensureBookMetadata(doc);
 const before=structuredClone(doc);
 setPendingJustified(doc,student.id,assessment.id,true);
 setGrade(doc,student.id,assessment.id,record(doc,student.id,assessment.id).score);
 markBookChange(doc,before);
 const original=structuredClone(doc);
 const expected={
  grade:overallGrade(doc,student.id,group.id,period.id),
  final:finalGrade(doc,student.id,group.id),
  itaca:itacaGrade(doc,student.id,group.id,period.id),
  comp:competencyGrade(doc,student.id,doc.competencies[0].id,group.id,period.id)
 };
 const {key:cryptoKey,envelope}=await createVault(key,doc);
 const prepared=await createPortableCopy(doc,cryptoKey,saltFromEnvelope(envelope));
 const contents=JSON.stringify(prepared.file);
 assert(!contents.includes(student.name));
 const imported=await readBackupFile({size:Buffer.byteLength(contents),text:async()=>contents},key);
 assert.deepEqual(imported.doc,original);
 assert.equal(compareBookVersions(doc,imported.doc),'same');
 close(overallGrade(imported.doc,student.id,group.id,period.id),expected.grade);
 close(finalGrade(imported.doc,student.id,group.id),expected.final);
 close(itacaGrade(imported.doc,student.id,group.id,period.id),expected.itaca);
 close(competencyGrade(imported.doc,student.id,doc.competencies[0].id,group.id,period.id),expected.comp);
 assertModel(imported.doc);
});

test('10 valores de frontera: AJ y confirmación de la misma nota mantienen medias, Ítaca y competencias',()=>{
 const scores=[0,0.01,4.99,5,6.49,6.5,6.51,7.99,8,10];
 for(const score of scores){
  const {doc,student,group,period,assessment}=fx();
  setGrade(doc,student.id,assessment.id,score);
  const beforeOther=structuredClone(doc.grades.filter(g=>g.studentId!==student.id));
  const metric=()=>({
    cat:categoryGrade(doc,student.id,assessment.categoryId,group.id,period.id),
    period:overallGrade(doc,student.id,group.id,period.id),
    annual:finalGrade(doc,student.id,group.id),
    itaca:itacaGrade(doc,student.id,group.id,period.id),
    competency:competencyGrade(doc,student.id,doc.competencies[0].id,group.id,period.id)
  });
  const expected=metric(),id=record(doc,student.id,assessment.id).id;
  setPendingJustified(doc,student.id,assessment.id,true);
  setGrade(doc,student.id,assessment.id,score);
  assert.equal(record(doc,student.id,assessment.id).pendingJustified,undefined,`AJ no se eliminó para ${score}`);
  assert.equal(record(doc,student.id,assessment.id).id,id);
  for(const [name,value] of Object.entries(expected))close(metric()[name],value);
  assert.deepEqual(doc.grades.filter(g=>g.studentId!==student.id),beforeOther,`Alumnos ajenos modificados para ${score}`);
  assertModel(doc);
 }
});
