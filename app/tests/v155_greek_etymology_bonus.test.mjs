import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  initialNotebook,addGroup,addStudent,addAssessment,setGrade,setOrthographyGrade,
  setPendingJustified,setNotSubmitted,updateAssessment,assertModel,
  copyPeriodAssessments,createRubric,supportsGreekEtymologyBonus
} from '../src/model.js';
import {
  effectiveAssessmentScore,greekEtymologyBonusApplied,categoryGrade,overallGrade,
  finalGrade,competencyGrade
} from '../src/calculations.js';
import {addCompetency,setCompetencyLink} from '../src/model.js';
import {createVault,unlockVault} from '../src/vault.js';
import {createPortableCopy,decodeBackupContent,ensureBookMetadata} from '../src/cuaderno.js';

const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-9,`Esperado ${expected}, recibido ${actual}`);
function setup(){
  const d=initialNotebook(),g=addGroup(d,'Latín 4.º · prueba','Latín 4.º','2026-2027','4eso');
  const s=addStudent(d,g.id,'Alumno de prueba'),p=d.periods[0];
  const category=d.categories.find(c=>c.name==='Exámenes');
  const a=addAssessment(d,{
    name:'Examen con etimología griega',groupId:g.id,periodId:p.id,
    categoryId:category.id,maxScore:10,convertToTen:true,greekEtymologyBonusEnabled:true
  });
  return {d,g,s,p,category,a};
}
const grade=t=>t.d.grades.find(g=>g.studentId===t.s.id&&g.assessmentId===t.a.id);
const record=(t,score,faults=0,delivered=false,bonus=1)=>
  setOrthographyGrade(t.d,t.s.id,t.a.id,{
    score,faults,delivered,greekEtymologyBonus:bonus
  });

test('etimología: nota aprobada sin faltas gana de cero a un punto sin tocar la nota base',()=>{
  const t=setup();
  assert(supportsGreekEtymologyBonus(t.d,t.a));
  for(const [score,bonus,expected] of [[7,1,8],[6.5,0.25,6.75],[5,0.5,5.5],[9.6,1,10],[10,1,10],[5,0,5]]){
    record(t,score,0,false,bonus);
    assert.equal(grade(t).score,score);
    close(greekEtymologyBonusApplied(t.d,t.a,grade(t)),bonus);
    close(effectiveAssessmentScore(t.d,t.a,grade(t)),expected);
    close(categoryGrade(t.d,t.s.id,t.category.id,t.g.id,t.p.id),expected);
    close(overallGrade(t.d,t.s.id,t.g.id,t.p.id),expected);
    close(finalGrade(t.d,t.s.id,t.g.id),expected);
    assertModel(t.d);
  }
});

test('con faltas pendientes NO se suma aunque el examen siga aprobado; al entregar se activa',()=>{
  const t=setup();
  record(t,8,2,false,1);
  close(effectiveAssessmentScore(t.d,t.a,grade(t)),7.8);
  assert.equal(greekEtymologyBonusApplied(t.d,t.a,grade(t)),0);
  assert.equal(grade(t).greekEtymologyBonus,1);
  record(t,8,2,true,1);
  close(effectiveAssessmentScore(t.d,t.a,grade(t)),9);
  record(t,8,2,false,1);
  close(effectiveAssessmentScore(t.d,t.a,grade(t)),7.8);
  assertModel(t.d);
});

test('suspenso antes de sumar: no se convierte en aprobado incluso si entregó las faltas',()=>{
  const t=setup();
  for(const [score,faults,delivered,expected] of [
    [4.99,0,false,4.99],[4.99,3,true,4.99],
    [5.1,2,false,4.9],[5.1,2,true,6.1],
    [5,0,false,6]
  ]){
    record(t,score,faults,delivered,1);
    close(effectiveAssessmentScore(t.d,t.a,grade(t)),expected);
    assertModel(t.d);
  }
});

test('NP, AJ y la reintroducción de la nota no conceden puntos indebidamente',()=>{
  const t=setup();
  record(t,7,0,false,1);
  setPendingJustified(t.d,t.s.id,t.a.id,true);
  assert.equal(effectiveAssessmentScore(t.d,t.a,grade(t)),null);
  setPendingJustified(t.d,t.s.id,t.a.id,false);
  close(effectiveAssessmentScore(t.d,t.a,grade(t)),8);
  setNotSubmitted(t.d,t.s.id,t.a.id,true);
  assert.equal(grade(t).greekEtymologyBonus,undefined);
  close(effectiveAssessmentScore(t.d,t.a,grade(t)),0);
  record(t,7,0,false,0.5);
  close(effectiveAssessmentScore(t.d,t.a,grade(t)),7.5);
  setGrade(t.d,t.s.id,t.a.id,4);
  assert.equal(grade(t).greekEtymologyBonus,0.5);
  close(effectiveAssessmentScore(t.d,t.a,grade(t)),4);
  assertModel(t.d);
});

test('rechazos de bonificaciones inválidas no mutan datos; solo Latín 4.º en categoría Exámenes',()=>{
  const t=setup();record(t,6,0,false,0.5);
  const original=structuredClone(t.d);
  for(const invalid of [1.01,-0.01,1.001,'1,001','x',NaN]){
    assert.throws(()=>record(t,6,0,false,invalid));
    assert.deepEqual(t.d,original);
  }
  assert.throws(()=>updateAssessment(t.d,t.a.id,{greekEtymologyBonusEnabled:false}),/bonificaciones/i);
  assert.deepEqual(t.d,original);
  record(t,6,0,false,0);
  updateAssessment(t.d,t.a.id,{greekEtymologyBonusEnabled:false});
  assert.equal(effectiveAssessmentScore(t.d,t.a,grade(t)),6);
  assertModel(t.d);
  const d=initialNotebook(),g=d.groups[0],p=d.periods[0],exam=d.categories.find(c=>c.name==='Exámenes');
  assert.throws(()=>addAssessment(d,{name:'Latín I',groupId:g.id,periodId:p.id,categoryId:exam.id,greekEtymologyBonusEnabled:true}),/Latín 4.º/);
  const work=t.d.categories.find(c=>c.name==='Trabajos');
  assert.throws(()=>addAssessment(t.d,{name:'Trabajo',groupId:t.g.id,periodId:t.p.id,categoryId:work.id,greekEtymologyBonusEnabled:true}),/Latín 4.º/);
  const rubric=createRubric(t.d,'Rúbrica',[{name:'Criterio',maxScore:2,weight:1}]);
  assert.throws(()=>addAssessment(t.d,{name:'Rúbrica',groupId:t.g.id,periodId:t.p.id,categoryId:t.category.id,rubricId:rubric.id,greekEtymologyBonusEnabled:true}),/Latín 4.º/);
  assertModel(t.d);
});

test('copia de estructura conserva la opción pero nunca copia la bonificación personal',()=>{
  const t=setup();record(t,8,0,false,1);
  const next=t.d.periods[1];
  copyPeriodAssessments(t.d,t.g.id,t.p.id,[next.id]);
  const copied=t.d.assessments.find(a=>a.groupId===t.g.id&&a.periodId===next.id);
  assert.equal(copied.greekEtymologyBonusEnabled,true);
  assert(!t.d.grades.some(g=>g.assessmentId===copied.id));
  assertModel(t.d);
});

test('competencias y restauración cifrada mantienen la misma nota efectiva y el extra',async()=>{
  const t=setup(),comp=addCompetency(t.d,'Competencia de prueba',t.g.id);
  setCompetencyLink(t.d,comp.id,t.category.id,1);
  record(t,7,1,true,0.75);
  close(competencyGrade(t.d,t.s.id,comp.id,t.g.id,t.p.id),7.75);
  ensureBookMetadata(t.d);
  const {key,envelope}=await createVault('Contrasena-ficticia-de-pruebas-2026!',t.d);
  const salt=(await unlockVault('Contrasena-ficticia-de-pruebas-2026!',envelope)).salt;
  const backup=(await createPortableCopy(t.d,key,salt)).file;
  const restored=(await decodeBackupContent(backup,'Contrasena-ficticia-de-pruebas-2026!')).doc;
  assert.deepEqual(restored,t.d);
  close(overallGrade(restored,t.s.id,t.g.id,t.p.id),7.75);
  assertModel(restored);
});

test('interfaz: activación y edición individual en Latín 4.º; la regla se calcula en un único motor',async()=>{
  const ui=await readFile(new URL('../app.js',import.meta.url),'utf8');
  assert(ui.includes('id="activity-greek-etymology"'));
  assert(ui.includes('name="greekEtymologyBonusEnabled"'));
  assert(ui.includes("id='orth-greek-bonus'")||ui.includes('id="orth-greek-bonus"'));
  assert(ui.includes('greekEtymologyBonusApplied(STATE.doc,assessment,candidate)'));
  assert(ui.includes('greekEtymologyBonusEnabled:v.greekEtymologyBonusEnabled'));
  assert(ui.includes('greekInput?.addEventListener'));
});
