import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initialNotebook,addPeriod,removePeriod,assertModel,addAssessment,setGrade,setGradeObservation,
  setPeriodCategory,setIndividualCategoryRule,setFinalConfig,setFinalOverride,
  setItacaStudentRule,setItacaAttitudeCondition
} from '../src/model.js';
import {saveEvent,saveEvaluationSession,activeYear} from '../src/planner.js';
import {recordChange,stepHistory,emptyHistory} from '../src/history.js';

test('eliminar un periodo quita sus referencias y permite deshacer el cambio completo',()=>{
  const doc=initialNotebook(),group=doc.groups[0],student=doc.students[0];
  const [first,removed,third]=doc.periods;
  const [exams,,attitude]=doc.categories;
  const assessment=addAssessment(doc,{name:'Examen',groupId:group.id,periodId:removed.id,categoryId:exams.id});
  const recovery=addAssessment(doc,{name:'Recuperación',groupId:group.id,periodId:removed.id,categoryId:exams.id,recoveryOf:assessment.id});
  setGrade(doc,student.id,assessment.id,4);
  setGrade(doc,student.id,recovery.id,7);
  setGradeObservation(doc,student.id,recovery.id,'Observación ficticia');
  setPeriodCategory(doc,group.id,removed.id,exams.id,{rule:'highest'});
  setIndividualCategoryRule(doc,student.id,exams.id,removed.id,'mean');
  setFinalConfig(doc,group.id,{rule:'weighted_mean',weights:{[first.id]:2,[removed.id]:1},excludedPeriodIds:[removed.id]});
  setFinalOverride(doc,student.id,removed.id,8);
  setItacaStudentRule(doc,student.id,removed.id,'seven');
  setItacaAttitudeCondition(doc,group.id,removed.id,{mode:'category',categoryId:attitude.id,minScore:5});
  const exam=saveEvent(doc,{type:'exam',title:'Examen',date:'2026-12-02',groupId:group.id,assessmentId:assessment.id});
  const removedSession=saveEvaluationSession(doc,{groupId:group.id,periodId:removed.id,date:'2026-12-04',time:'10:00'});
  const keptSession=saveEvaluationSession(doc,{groupId:group.id,periodId:third.id,date:'2027-02-08',time:'10:00'});

  const before=structuredClone(doc);
  assertModel(doc);
  removePeriod(doc,removed.id);
  assertModel(doc);

  assert.deepEqual(doc.periods.map(p=>[p.id,p.order]),[[first.id,0],[third.id,1]]);
  assert.deepEqual(doc.assessments,before.assessments.filter(a=>a.periodId===first.id));
  assert.deepEqual(doc.grades,before.grades.filter(g=>g.assessmentId!==assessment.id&&g.assessmentId!==recovery.id));
  for(const key of ['gradeObservations','gradingProfiles','individualCategoryRules','finalOverrides'])assert.deepEqual(doc[key],[]);
  assert.deepEqual(doc.finalConfigs[0].weights,{[first.id]:2});
  assert.deepEqual(doc.finalConfigs[0].excludedPeriodIds,[]);
  assert.equal(student.itacaRoundingOverrides,undefined);
  assert.equal(group.itacaAttitudeConditions,undefined);
  assert.equal(activeYear(doc).events.find(e=>e.id===exam.id).assessmentId,null);
  assert(!activeYear(doc).events.some(e=>e.id===removedSession.id));
  assert(activeYear(doc).events.some(e=>e.id===keptSession.id));

  const history=recordChange(emptyHistory(),before,doc,'Eliminar período');
  assert.deepEqual(stepHistory(history,doc,'undo').doc,before);
  assert.equal(addPeriod(doc,'Otra evaluación').order,2);
});

test('se puede borrar una cuarta evaluación vacía y el último periodo se conserva',()=>{
  const doc=initialNotebook(),fourth=addPeriod(doc,'4.ª evaluación');
  const originalIds=doc.periods.slice(0,3).map(p=>p.id);
  removePeriod(doc,fourth.id);
  assert.deepEqual(doc.periods.map(p=>p.id),originalIds);
  assert.throws(()=>removePeriod(doc,fourth.id),/inexistente/);
  removePeriod(doc,originalIds[1]);
  removePeriod(doc,originalIds[2]);
  const before=structuredClone(doc);
  assert.throws(()=>removePeriod(doc,originalIds[0]),/al menos un periodo/);
  assert.deepEqual(doc,before);
  assertModel(doc);
});
