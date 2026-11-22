import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initialNotebook,addCompetency,setCompetencyLink,setGrade,assertModel} from '../src/model.js';
import {competencyGrade,competencyArithmeticMean,gradeToFour,overallGrade} from '../src/calculations.js';

const fixture=()=>{
  const doc=initialNotebook(),group=doc.groups[0],period=doc.periods[0],student=doc.students[0];
  return {doc,group,period,student};
};
test('la media de competencias es aritmética, no reutiliza sus pesos internos',()=>{
  const {doc,group,period,student}=fixture();
  const first=doc.competencies[0],second=addCompetency(doc,'CE2',group.id);
  setCompetencyLink(doc,second.id,doc.categories[2].id,999);
  const a=competencyGrade(doc,student.id,first.id,group.id,period.id);
  const b=competencyGrade(doc,student.id,second.id,group.id,period.id);
  assert.notEqual(a,b);
  const academicBefore=overallGrade(doc,student.id,group.id,period.id);
  assert.equal(competencyArithmeticMean(doc,student.id,[first.id,second.id],group.id,period.id),(a+b)/2);
  assert.notEqual(competencyArithmeticMean(doc,student.id,[first.id,second.id],group.id,period.id),(a*70+b*999)/1069);
  assert.equal(overallGrade(doc,student.id,group.id,period.id),academicBefore);
  assertModel(doc);
});
test('las competencias no evaluadas se omiten, no se convierten en cero y los duplicados no cuentan dos veces',()=>{
  const {doc,group,period,student}=fixture();
  const evaluated=doc.competencies[0],empty=addCompetency(doc,'CE sin evaluación',group.id);
  const grade=competencyGrade(doc,student.id,evaluated.id,group.id,period.id);
  assert.equal(competencyArithmeticMean(doc,student.id,[evaluated.id,empty.id],group.id,period.id),grade);
  assert.equal(competencyArithmeticMean(doc,student.id,[evaluated.id,evaluated.id,empty.id],group.id,period.id),grade);
  assert.equal(competencyArithmeticMean(doc,student.id,[empty.id],group.id,period.id),null);
  assert.equal(competencyArithmeticMean(doc,student.id,[],group.id,period.id),null);
});
test('la calificación cero sí cuenta, se recalcula tras modificar evidencias',()=>{
  const {doc,group,period,student}=fixture();
  const zero=addCompetency(doc,'CE cero',group.id),first=doc.competencies[0],cat=doc.categories[0];
  setCompetencyLink(doc,zero.id,cat.id,20);
  for(const assessment of doc.assessments.filter(a=>a.groupId===group.id&&a.periodId===period.id&&a.categoryId===cat.id))
    setGrade(doc,student.id,assessment.id,0);
  assert.equal(competencyGrade(doc,student.id,zero.id,group.id,period.id),0);
  const firstValue=competencyGrade(doc,student.id,first.id,group.id,period.id);
  assert.equal(competencyArithmeticMean(doc,student.id,[first.id,zero.id],group.id,period.id),firstValue/2);
  const selected=doc.assessments.find(a=>a.groupId===group.id&&a.periodId===period.id&&a.categoryId===cat.id&&!a.recoveryOf);
  setGrade(doc,student.id,selected.id,7);
  const updated=competencyArithmeticMean(doc,student.id,[first.id,zero.id],group.id,period.id);
  assert.equal(updated,(competencyGrade(doc,student.id,first.id,group.id,period.id)+competencyGrade(doc,student.id,zero.id,group.id,period.id))/2);
  assert.notEqual(updated,firstValue/2);
});
test('validación de pertenencia y conversión continua exacta de 0–10 a 1–4',()=>{
  const {doc,group,period,student}=fixture();
  const ids=[doc.competencies[0].id];
  assert.equal(competencyArithmeticMean(doc,'sin-alumno',ids,group.id,period.id),null);
  assert.equal(competencyArithmeticMean(doc,student.id,ids,'otro-grupo',period.id),null);
  assert.equal(competencyArithmeticMean(doc,student.id,ids,group.id,'otro-periodo'),null);
  assert.throws(()=>competencyArithmeticMean(doc,student.id,null,group.id,period.id),/inválida/);
  assert.equal(gradeToFour(0),1);
  assert.equal(gradeToFour(5),2.5);
  assert.equal(gradeToFour(7),3.1);
  assert.equal(gradeToFour(10),4);
  assert.equal(gradeToFour(null),null);
  assert.equal(gradeToFour(-1),null);
  assert.equal(gradeToFour(11),null);
});
test('la columna muestra ambas escalas y no interviene en Ítaca ni en las notas académicas',()=>{
  const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
  const styles=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
  assert.match(app,/Media de competencias <small>sin ponderar/);
  assert.match(app,/competencyArithmeticMean\(STATE\.doc,student\.id,meanIds,group\.id,STATE\.periodId\)/);
  assert.match(app,/gradeToFour\(score\)/);
  assert.match(app,/class="competency-mean-cell"/);
  assert.match(styles,/\.competency-mean-values/);
});
