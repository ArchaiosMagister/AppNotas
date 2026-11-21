import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addAssessment, addGroup, addStudent, assertModel, createRubric, initialNotebook,
  migrateNotebook, setGrade, setNotSubmitted, setOrthographyGrade, setRubricGrade,
} from '../src/model.js';
import {
  categoryEvidence, competencyGrade, effectiveAssessmentScore, finalGrade, overallGrade,
} from '../src/calculations.js';
import {assessmentClassStatistics} from '../src/statistics.js';
import {emptyHistory, recordChange, stepHistory} from '../src/history.js';
import {createVault, unlockVault} from '../src/vault.js';

function fixture(){
  const doc=initialNotebook();
  const student=doc.students[0], groupId=student.groupId, periodId=doc.periods[0].id;
  const categoryId=doc.categories[1].id;
  doc.grades=[];
  return {doc, studentId:student.id, groupId, periodId, categoryId};
}

test('NP y cero se distinguen; ambos cuentan en medias, competencias, evaluación final y estadísticas',()=>{
  const {doc,studentId,groupId,periodId,categoryId}=fixture();
  const [first,second,third]=doc.students;
  const activity=doc.assessments.find(a=>a.categoryId===categoryId);
  assert.equal(overallGrade(doc,studentId,groupId,periodId),null);
  setNotSubmitted(doc,first.id,activity.id,true);
  setGrade(doc,second.id,activity.id,0);
  setGrade(doc,third.id,activity.id,9);
  assertModel(doc);
  const stats=assessmentClassStatistics(doc,groupId,activity.id);
  assert.equal(stats.graded,3);
  assert.equal(stats.ungraded,5);
  assert.equal(stats.failed,2);
  assert.equal(stats.mean,3);
  assert.equal(overallGrade(doc,studentId,groupId,periodId),0);
  assert.equal(competencyGrade(doc,studentId,doc.competencies[0].id,groupId,periodId),0);
  assert.equal(finalGrade(doc,studentId,groupId),0);
  assert.equal(categoryEvidence(doc,studentId,categoryId,groupId,periodId).evidence[0].originalNotSubmitted,true);
  const id=doc.grades[0].id;
  setGrade(doc,studentId,activity.id,0);
  assert.equal(doc.grades[0].notSubmitted,undefined);
  assert.equal(doc.grades[0].id,id);
  setNotSubmitted(doc,studentId,activity.id,false);
  assert.equal(doc.grades[0].score,0);
  setNotSubmitted(doc,studentId,activity.id,true);
  const snapshot=structuredClone(doc);
  setNotSubmitted(doc,studentId,activity.id,true);
  assert.deepEqual(doc,snapshot);
  setNotSubmitted(doc,studentId,activity.id,false);
  assert.equal(overallGrade(doc,studentId,groupId,periodId),null);
});

test('NP es válido en rúbricas y exámenes con faltas, y puede sustituirse por una valoración real de cero',()=>{
  const {doc,studentId,groupId,periodId,categoryId}=fixture();
  const common={groupId,periodId,categoryId};
  const rubric=createRubric(doc,'Rúbrica',[{name:'Criterio',maxScore:4,levels:[{label:'Inicial',score:1},{label:'Máximo',score:4}]}]);
  const activity=addAssessment(doc,{...common,name:'Rúbrica',rubricId:rubric.id});
  const exam=addAssessment(doc,{...common,name:'Examen',maxScore:20,orthography:{enabled:true,penaltyPerFault:.1,repetitions:30,refundable:true}});
  setRubricGrade(doc,studentId,activity.id,{[rubric.criteria[0].id]:1});
  setOrthographyGrade(doc,studentId,exam.id,{score:15,faults:3,delivered:true});
  for(const a of [activity,exam]){
    setNotSubmitted(doc,studentId,a.id,true);
    const grade=doc.grades.find(g=>g.assessmentId===a.id);
    assert.equal(grade.rubricRatings,undefined);
    assert.equal(grade.orthographyFaults,undefined);
    assert.equal(grade.orthographyDelivered,undefined);
    assert.equal(effectiveAssessmentScore(doc,a,grade),0);
  }
  assertModel(doc);
  setRubricGrade(doc,studentId,activity.id,{[rubric.criteria[0].id]:4});
  setOrthographyGrade(doc,studentId,exam.id,{score:0});
  assertModel(doc);
  assert.deepEqual(doc.grades.map(g=>[g.score,g.notSubmitted]),[[10,undefined],[0,undefined]]);
});

test('NP respeta las reglas de recuperación y la escala bruta',()=>{
  const {doc,studentId,groupId,periodId,categoryId}=fixture();
  const common={groupId,periodId,categoryId};
  const base=addAssessment(doc,{...common,name:'Original',maxScore:25,convertToTen:false});
  const recovery=addAssessment(doc,{...common,name:'Recuperación',recoveryOf:base.id,recoveryMode:'replace'});
  setGrade(doc,studentId,base.id,8);
  setNotSubmitted(doc,studentId,recovery.id,true);
  const evidence=()=>categoryEvidence(doc,studentId,categoryId,groupId,periodId).evidence[0];
  assert.equal(evidence().value,0);
  assert.equal(evidence().recoveryNotSubmitted,true);
  recovery.recoveryMode='higher';
  assert.equal(evidence().value,8);
  setNotSubmitted(doc,studentId,base.id,true);
  setGrade(doc,studentId,recovery.id,7);
  assert.equal(evidence().original,0);
  assert.equal(evidence().value,7);
  assertModel(doc);
});

test('la validación rechaza estados NP incoherentes y modificaciones entre grupos',()=>{
  const {doc,studentId}=fixture();
  const activity=doc.assessments[0];
  const unrelated=addStudent(doc,addGroup(doc,'Otro grupo').id,'Otro alumno');
  const before=structuredClone(doc);
  assert.throws(()=>setNotSubmitted(doc,unrelated.id,activity.id,true),/inválidos/);
  assert.throws(()=>setNotSubmitted(doc,studentId,activity.id,'true'),/inválido/);
  assert.deepEqual(doc,before);
  setNotSubmitted(doc,studentId,activity.id,true);
  for(const bad of [{score:1},{notSubmitted:false},{orthographyFaults:0},{orthographyDelivered:false},{rubricRatings:[]}]){
    const copy=structuredClone(doc);
    Object.assign(copy.grades[0],bad);
    assert.throws(()=>assertModel(copy),/No presentado/);
  }
});

test('una copia cifrada v1.12 migra sin alterar los datos y una copia v1.13 restaura NP e historial',async()=>{
  const old=initialNotebook();old.schemaVersion=6;
  old.settings.orthographyDefaults.penaltyPerFault=.25;
  const password='Contraseña de prueba local';
  const legacyBackup=await createVault(password,old);
  const opened=await unlockVault(password,legacyBackup.envelope);
  const {doc,migrated}=migrateNotebook(opened.doc);
  assert.equal(migrated,true);
  assert.deepEqual(doc,{...old,schemaVersion:8,individualCategoryRules:[]});
  const before=structuredClone(doc);
  const {studentId,assessmentId}=doc.grades[0];
  setNotSubmitted(doc,studentId,assessmentId,true);
  const history=recordChange(emptyHistory(),before,doc,'Marcar NP');
  const undone=stepHistory(history,doc,'undo');
  assert.deepEqual(undone.doc,before);
  assert.deepEqual(stepHistory(undone.history,undone.doc,'redo').doc,doc);
  const backup=await createVault(password,doc);
  const restored=migrateNotebook((await unlockVault(password,backup.envelope)).doc);
  assert.equal(restored.migrated,false);
  assert.deepEqual(restored.doc,doc);
  assert.equal(restored.doc.grades[0].notSubmitted,true);
});
