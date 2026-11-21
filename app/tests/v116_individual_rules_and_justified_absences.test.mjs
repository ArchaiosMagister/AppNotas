import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SCHEMA_VERSION,initialNotebook,assertModel,migrateNotebook,setGrade,setNotSubmitted,
  setPendingJustified,setIndividualCategoryRule,individualCategoryRule,setPeriodCategory,
  addAssessment,addGroup,addStudent,createRubric,setRubricGrade,setOrthographyGrade,
  removeStudent,removeCategoryFromGroup,copyPeriodAssessments
} from '../src/model.js';
import {categoryEvidence,categoryGrade,overallGrade,finalGrade,competencyGrade,effectiveAssessmentScore} from '../src/calculations.js';
import {assessmentClassStatistics,categoryClassStatistics,periodClassStatistics,finalClassStatistics} from '../src/statistics.js';
import {createVault,unlockVault} from '../src/vault.js';
import {emptyHistory,recordChange,stepHistory} from '../src/history.js';
function close(x,y){assert.equal(typeof x,'number');assert.ok(Math.abs(x-y)<1e-9,`Esperado ${y}; recibido ${x}`);}
function fx(){
  const doc=initialNotebook(),student=doc.students[0],other=doc.students[1],period=doc.periods[0],
    category=doc.categories.find(c=>c.name==='Exámenes'),group=doc.groups[0];
  const exams=doc.assessments.filter(a=>a.categoryId===category.id);
  doc.grades=[];
  const latest=addAssessment(doc,{name:'Examen UD3',groupId:group.id,periodId:period.id,categoryId:category.id,orthography:null});
  return {doc,student,other,group,period,category,exams:[...exams,latest]};
}
function put(t,values,person=t.student){values.forEach((v,i)=>v==='NP'?setNotSubmitted(t.doc,person.id,t.exams[i].id,true):v==='AJ'?setPendingJustified(t.doc,person.id,t.exams[i].id,true):v===null?null:setGrade(t.doc,person.id,t.exams[i].id,v));}
const score=t=>categoryGrade(t.doc,t.student.id,t.category.id,t.group.id,t.period.id);
const change=(t,rule)=>setIndividualCategoryRule(t.doc,t.student.id,t.category.id,t.period.id,rule);

test('cuatro reglas: último 9, media NP 5,67, media siempre y último sustitutivo',()=>{
  const t=fx();put(t,[8,'NP',9]);
  close(score(t),9);
  change(t,'np_mean');close(score(t),17/3);
  assert.equal(categoryEvidence(t.doc,t.student.id,t.category.id,t.group.id,t.period.id).npTriggered,true);
  change(t,'mean');close(score(t),17/3);
  change(t,'last');close(score(t),9);
  change(t,'general');close(score(t),9);
  assert.deepEqual(t.doc.individualCategoryRules,[]);
  assertModel(t.doc);
});

test('media obligatoria por NP no activa al haber solo ceros reales',()=>{
  const t=fx();put(t,[0,8,9]);change(t,'np_mean');close(score(t),9);
  const e=categoryEvidence(t.doc,t.student.id,t.category.id,t.group.id,t.period.id);
  assert.equal(e.npTriggered,false);
  change(t,'mean');close(score(t),17/3);
});

test('el último examen sustitutivo puede bajar la nota y NP último sustituye por cero',()=>{
  const t=fx();put(t,[9,8,3]);change(t,'last');close(score(t),3);
  setNotSubmitted(t.doc,t.student.id,t.exams[2].id,true);close(score(t),0);
  change(t,'general');close(score(t),17/3);
});

test('último AJ o vacío no activa sustitución anticipada de penúltimo',()=>{
  const t=fx();put(t,[9,5,'AJ']);change(t,'last');close(score(t),7);
  setPendingJustified(t.doc,t.student.id,t.exams[2].id,false);close(score(t),7);
  setGrade(t.doc,t.student.id,t.exams[2].id,2);close(score(t),2);
  assertModel(t.doc);
});

test('AJ solo: ni cero, ni suspenso, ni nota; desmarcar elimina exclusivamente marcador',()=>{
  const t=fx();setPendingJustified(t.doc,t.student.id,t.exams[0].id,true);
  assert.equal(score(t),null);
  assert.equal(t.doc.grades[0].pendingPlaceholder,true);
  assert.equal(assessmentClassStatistics(t.doc,t.group.id,t.exams[0].id).graded,0);
  assert.equal(categoryClassStatistics(t.doc,t.group.id,t.period.id,t.category.id).graded,0);
  assert.equal(overallGrade(t.doc,t.student.id,t.group.id,t.period.id),null);
  assert.equal(finalGrade(t.doc,t.student.id,t.group.id),null);
  setPendingJustified(t.doc,t.student.id,t.exams[0].id,false);
  assert.deepEqual(t.doc.grades,[]);
  assertModel(t.doc);
});

test('AJ sobre nota real conserva el valor exacto y su identidad al reactivarlo',()=>{
  const t=fx();setGrade(t.doc,t.student.id,t.exams[0].id,8.25);
  const original=structuredClone(t.doc.grades[0]);
  setPendingJustified(t.doc,t.student.id,t.exams[0].id,true);
  assert.equal(score(t),null);
  assert.equal(t.doc.grades[0].score,8.25);
  assert.equal(assessmentClassStatistics(t.doc,t.group.id,t.exams[0].id).graded,0);
  setPendingJustified(t.doc,t.student.id,t.exams[0].id,false);
  const restored=t.doc.grades[0];
  assert.equal(restored.id,original.id);
  assert.equal(restored.score,original.score);
  assert.equal(restored.createdAt,original.createdAt);
  assert.equal(restored.pendingJustified,undefined);
  close(score(t),8.25);
  assertModel(t.doc);
});

test('AJ y NP tienen efectos diferentes sobre media, estadísticas, competencias y evaluación anual',()=>{
  const t=fx();put(t,['NP',8,'AJ']);change(t,'np_mean');close(score(t),4);
  const stats=assessmentClassStatistics(t.doc,t.group.id,t.exams[0].id);
  assert.equal(stats.graded,1);assert.equal(stats.failed,1);
  assert.equal(assessmentClassStatistics(t.doc,t.group.id,t.exams[2].id).graded,0);
  assert.equal(periodClassStatistics(t.doc,t.group.id,t.period.id).graded,1);
  close(finalGrade(t.doc,t.student.id,t.group.id),overallGrade(t.doc,t.student.id,t.group.id,t.period.id));
  const before=competencyGrade(t.doc,t.student.id,t.doc.competencies[0].id,t.group.id,t.period.id);
  assert.ok(before!==null);
  setPendingJustified(t.doc,t.student.id,t.exams[0].id,true); // NP -> AJ, cero desaparece
  close(score(t),8);
  assert.ok(competencyGrade(t.doc,t.student.id,t.doc.competencies[0].id,t.group.id,t.period.id)>before);
  assertModel(t.doc);
});

test('las excepciones son independientes por alumno, grupo, categoría y trimestre; cambio aislado',()=>{
  const t=fx();put(t,[8,0,9]);put(t,[8,0,9],t.other);
  const before=structuredClone(t.doc);
  change(t,'mean');close(score(t),17/3);
  close(categoryGrade(t.doc,t.other.id,t.category.id,t.group.id,t.period.id),9);
  assert.deepEqual(t.doc.grades,before.grades);
  assert.deepEqual(t.doc.gradingProfiles,before.gradingProfiles);
  assert.deepEqual(t.doc.assessments,before.assessments);
  assert.equal(individualCategoryRule(t.doc,t.other.id,t.category.id,t.period.id),'general');
  assert.equal(individualCategoryRule(t.doc,t.student.id,t.doc.categories[1].id,t.period.id),'general');
  assert.equal(individualCategoryRule(t.doc,t.student.id,t.category.id,t.doc.periods[1].id),'general');
  const g=addGroup(t.doc,'Otro grupo');const s=addStudent(t.doc,g.id,'Alumno externo');
  assert.throws(()=>setIndividualCategoryRule(t.doc,s.id,t.category.id,t.period.id,'no_existe'),/inválid/);
  assertModel(t.doc);
});

test('regla condicional NP respeta la regla existente cuando no hay NP o se ha recuperado',()=>{
  const t=fx();setPeriodCategory(t.doc,t.group.id,t.period.id,t.category.id,{rule:'weighted_mean'});
  t.exams[0].weight=1;t.exams[1].weight=2;t.exams[2].weight=3;
  put(t,[8,5,9]);change(t,'np_mean');close(score(t),(8+10+27)/6);
  setNotSubmitted(t.doc,t.student.id,t.exams[1].id,true);close(score(t),(8+0+9)/3);
  const recovery=addAssessment(t.doc,{name:'Recuperación UD2',groupId:t.group.id,periodId:t.period.id,categoryId:t.category.id,recoveryOf:t.exams[1].id,recoveryMode:'replace',orthography:null});
  setGrade(t.doc,t.student.id,recovery.id,7);
  close(score(t),(8+14+27)/6); // NP original sustituido: ya no computa el cero
  assertModel(t.doc);
});

test('sustitución de examen mediante recuperación no agrega doble evidencia y conserva la nota de origen',()=>{
  const t=fx();put(t,[3,5,7]);
  const a=addAssessment(t.doc,{name:'Recuperación del primero',groupId:t.group.id,periodId:t.period.id,categoryId:t.category.id,recoveryOf:t.exams[0].id,recoveryMode:'replace',orthography:null});
  setGrade(t.doc,t.student.id,a.id,6);
  const e=categoryEvidence(t.doc,t.student.id,t.category.id,t.group.id,t.period.id);
  assert.deepEqual(e.evidence.map(x=>x.value),[6,5,7]);
  assert.equal(t.doc.grades.find(g=>g.assessmentId===t.exams[0].id).score,3);
  change(t,'mean');close(score(t),6);
  assertModel(t.doc);
});

test('AJ conserva notas de rúbrica y ortografía, incluidos sus metadatos, tras desmarcar',()=>{
  const t=fx();const rubric=createRubric(t.doc,'Ejercicio',[{name:'Criterio',maxScore:4,levels:[{label:'Bien',score:4}]}]);
  const a=addAssessment(t.doc,{name:'Rúbrica',groupId:t.group.id,periodId:t.period.id,categoryId:t.category.id,rubricId:rubric.id});
  setRubricGrade(t.doc,t.student.id,a.id,{[rubric.criteria[0].id]:4});
  const orth=addAssessment(t.doc,{name:'Examen con faltas',groupId:t.group.id,periodId:t.period.id,categoryId:t.category.id,orthography:{enabled:true,penaltyPerFault:.1,repetitions:30,refundable:true}});
  setOrthographyGrade(t.doc,t.student.id,orth.id,{score:7.3,faults:2,delivered:true});
  const before=structuredClone(t.doc.grades);
  for(const grade of before)setPendingJustified(t.doc,t.student.id,grade.assessmentId,true);
  assert.equal(assessmentClassStatistics(t.doc,t.group.id,a.id).graded,0);
  for(const grade of before)setPendingJustified(t.doc,t.student.id,grade.assessmentId,false);
  assert.deepEqual(t.doc.grades.map(({updatedAt,...x})=>x),before.map(({updatedAt,...x})=>x));
  assertModel(t.doc);
});

test('editar una nota AJ levanta el estado pendiente; limpiar nota elimina marcador',()=>{
  const t=fx();setPendingJustified(t.doc,t.student.id,t.exams[0].id,true);
  setGrade(t.doc,t.student.id,t.exams[0].id,8);
  assert.equal(t.doc.grades[0].pendingJustified,undefined);close(score(t),8);
  setPendingJustified(t.doc,t.student.id,t.exams[0].id,true);
  setGrade(t.doc,t.student.id,t.exams[0].id,null);assert.deepEqual(t.doc.grades,[]);
});

test('los cambios idénticos y errores de validación no tocan ningún dato ni generan timestamp nuevo',()=>{
  const t=fx();change(t,'mean');setPendingJustified(t.doc,t.student.id,t.exams[0].id,true);
  const before=structuredClone(t.doc);
  change(t,'mean');setPendingJustified(t.doc,t.student.id,t.exams[0].id,true);
  assert.deepEqual(t.doc,before);
  for(const mode of [null,'np','latest_if_highest','not_a_rule']){
    assert.throws(()=>change(t,mode),/inválid/);
    assert.deepEqual(t.doc,before);
  }
  const outside=addStudent(t.doc,addGroup(t.doc,'Externo').id,'Externo');
  const snapshot=structuredClone(t.doc);
  assert.throws(()=>setPendingJustified(t.doc,outside.id,t.exams[0].id,true),/inválid/);
  assert.deepEqual(t.doc,snapshot);
  assertModel(t.doc);
});

test('validación rechaza duplicados, valores ajenos, referencias perdidas y AJ incoherente',()=>{
  const t=fx();change(t,'np_mean');setPendingJustified(t.doc,t.student.id,t.exams[0].id,true);assertModel(t.doc);
  for(const change of [
    d=>d.individualCategoryRules.push({...d.individualCategoryRules[0],id:'otro'}),
    d=>{d.individualCategoryRules[0].rule='bogus';},
    d=>{d.individualCategoryRules[0].studentId='inexistente';},
    d=>{d.individualCategoryRules[0].categoryId='inexistente';},
    d=>{d.grades[0].pendingPlaceholder=true;d.grades[0].score=4;},
    d=>{d.grades[0].pendingJustified=false;}
  ]){const copy=structuredClone(t.doc);change(copy);assert.throws(()=>assertModel(copy));}
});

test('eliminar alumno limpia únicamente sus excepciones sin tocar las demás',()=>{
  const t=fx();change(t,'mean');setIndividualCategoryRule(t.doc,t.other.id,t.category.id,t.period.id,'last');
  removeStudent(t.doc,t.student.id);
  assert.equal(t.doc.individualCategoryRules.length,1);
  assert.equal(t.doc.individualCategoryRules[0].studentId,t.other.id);
  assertModel(t.doc);
});

test('restauración v7→v8 preserva todas las notas y el documento, tras migrar el esquema',()=>{
  const old=initialNotebook();const previous=structuredClone(old);delete old.individualCategoryRules;old.schemaVersion=7;
  const migrated=migrateNotebook(old);
  assert.equal(migrated.migrated,true);assert.equal(migrated.doc.schemaVersion,SCHEMA_VERSION);
  assert.deepEqual(migrated.doc.grades,previous.grades);
  assert.deepEqual(migrated.doc.students,previous.students);
  assert.deepEqual(migrated.doc.individualCategoryRules,[]);
  assert.equal(old.schemaVersion,7);assert.equal(old.individualCategoryRules,undefined);
  assert.deepEqual(migrateNotebook(migrated.doc).doc,migrated.doc);
});

test('copia cifrada recupera excepciones y AJ, y el historial deshace ambos',async()=>{
  const t=fx();const before=structuredClone(t.doc);
  change(t,'np_mean');setPendingJustified(t.doc,t.student.id,t.exams[1].id,true);
  const after=structuredClone(t.doc);
  const history=recordChange(emptyHistory(),before,after,'Excepciones');
  const undone=stepHistory(history,after,'undo');assert.deepEqual(undone.doc,before);
  const redone=stepHistory(undone.history,undone.doc,'redo');assert.deepEqual(redone.doc,after);
  const password='Contraseña extensa de pruebas';
  const backup=await createVault(password,t.doc);
  const opened=await unlockVault(password,backup.envelope);
  assert.deepEqual(migrateNotebook(opened.doc).doc,t.doc);
  assertModel(opened.doc);
});

test('distribución anual y por período ignora AJ y respeta regla individual incluso con otras asignaturas',()=>{
  const t=fx();put(t,[9,0,8]);change(t,'mean');
  assert.equal(finalClassStatistics(t.doc,t.group.id).graded,1);
  assert.equal(periodClassStatistics(t.doc,t.group.id,t.period.id).graded,1);
  const before=finalGrade(t.doc,t.student.id,t.group.id);
  const second=addGroup(t.doc,'Otro grupo');const student=addStudent(t.doc,second.id,'AJ');
  const course=t.doc.assessments.find(a=>a.groupId===t.group.id);
  assert.throws(()=>setPendingJustified(t.doc,student.id,course.id,true));
  close(finalGrade(t.doc,t.student.id,t.group.id),before);
  assertModel(t.doc);
});

test('al copiar estructura a otro trimestre no se copian excepciones ni registros AJ',()=>{
  const t=fx();setPendingJustified(t.doc,t.student.id,t.exams[0].id,true);change(t,'np_mean');
  copyPeriodAssessments(t.doc,t.group.id,t.period.id,[t.doc.periods[1].id]);
  assert.equal(t.doc.individualCategoryRules.length,1);
  assert.equal(t.doc.grades.length,1);
  assert(t.doc.assessments.some(a=>a.periodId===t.doc.periods[1].id));
  assert.equal(individualCategoryRule(t.doc,t.student.id,t.category.id,t.doc.periods[1].id),'general');
  assertModel(t.doc);
});

// Contraste aritmético independiente con cientos de escenarios deterministas.
test('oráculo independiente: 960 variantes con medias, NP, AJ y última baja',()=>{
  let seed=4971;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/2**32;};
  for(let k=0;k<960;k++){
    const t=fx();const values=[];
    for(let i=0;i<3;i++){
      const x=rnd();values.push(x<.15?null:x<.29?'AJ':x<.43?'NP':Math.round(rnd()*1000)/100);
    }
    put(t,values);
    const mode=['general','np_mean','mean','last'][Math.floor(rnd()*4)];
    change(t,mode);
    const counted=values.map((v,i)=>({v,i,score:v==='NP'?0:v===null||v==='AJ'?null:v})).filter(x=>x.score!==null);
    const scores=counted.map(x=>x.score);
    const avg=scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:null;
    const lastIsEvaluated=counted.length&&counted.at(-1).i===2;
    const hasNP=counted.some(x=>x.v==='NP');
    const expected=!scores.length?null:
      mode==='mean'||mode==='np_mean'&&hasNP?avg:
      mode==='last'?lastIsEvaluated?scores.at(-1):avg:
      lastIsEvaluated&&scores.at(-1)>=Math.max(...scores)?scores.at(-1):avg;
    const received=score(t);
    if(expected===null)assert.equal(received,null,`semilla ${k}`);
    else close(received,expected);
    assertModel(t.doc);
  }
});
