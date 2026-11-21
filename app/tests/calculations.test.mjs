import test from 'node:test';
import assert from 'node:assert/strict';
import {initialNotebook,setGrade,setCategory,addCompetency,setCompetencyLink,addAssessment} from '../src/model.js';
import {mean,normalizedScore,categoryGrade,overallGrade,competencyGrade,roundGrade} from '../src/calculations.js';
const fixture=()=>{const d=initialNotebook(),s=d.students[0],g=d.groups[0],p=d.periods[0],e=d.categories[0],a=d.assessments.filter(x=>x.categoryId===e.id);return {d,s,g,p,e,a};};
test('media vacía es nula, no es cero',()=>{assert.equal(mean([]),null);assert.equal(mean([5,7]),6);});
test('último examen si es el más alto',()=>{
  const {d,s,g,p,e,a}=fixture();setGrade(d,s.id,a[0].id,5);setGrade(d,s.id,a[1].id,9);
  assert.equal(categoryGrade(d,s.id,e.id,g.id,p.id),9);
});
test('último examen inferior produce media, y empate permite última nota',()=>{
  const {d,s,g,p,e,a}=fixture();setGrade(d,s.id,a[0].id,9);setGrade(d,s.id,a[1].id,7);
  assert.equal(categoryGrade(d,s.id,e.id,g.id,p.id),8);
  setGrade(d,s.id,a[1].id,9);assert.equal(categoryGrade(d,s.id,e.id,g.id,p.id),9);
});
test('la última ACTIVIDAD SIN EVALUAR no se computa y hay cambio de escala',()=>{
  const {d,s,g,p,e,a}=fixture();setGrade(d,s.id,a[0].id,7);setGrade(d,s.id,a[1].id,null);
  const newer=addAssessment(d,{name:'UD3',groupId:g.id,periodId:p.id,categoryId:e.id,maxScore:5});
  assert.equal(categoryGrade(d,s.id,e.id,g.id,p.id),7);
  setGrade(d,s.id,newer.id,4.5);assert.equal(categoryGrade(d,s.id,e.id,g.id,p.id),9);
  assert.equal(normalizedScore(2.5,5),5);
});
test('media ponderada normal y sin redondeos parciales',()=>{
  const {d,s,g,p}=fixture();
  // 6.5 -> 8, se usa 8 como exámenes; trabajos 7.5 y actitud 9: 4.8+2.25+0.9=7.95.
  assert.equal(overallGrade(d,s.id,g.id,p.id),7.95);
});
test('categoría sin evaluar redistribuye porcentajes, cero permanece cero',()=>{
  const {d,s,g,p,e,a}=fixture();
  for(const grade of [...d.grades])if(grade.studentId===s.id)d.grades.splice(d.grades.indexOf(grade),1);
  assert.equal(overallGrade(d,s.id,g.id,p.id),null);
  setGrade(d,s.id,a[0].id,0);assert.equal(overallGrade(d,s.id,g.id,p.id),0);
});
test('suma de porcentajes distinta de 100 bloquea la nota global',()=>{
  const {d,s,g,p,e}=fixture();setCategory(d,e.id,{weight:55});assert.equal(overallGrade(d,s.id,g.id,p.id),null);
});
test('competencias: pesos relativos independientes',()=>{
  const {d,s,g,p,e}=fixture();const c=addCompetency(d,'CE2');
  setCompetencyLink(d,c.id,e.id,100);assert.equal(competencyGrade(d,s.id,c.id,g.id,p.id),8);
  assert.equal(competencyGrade(d,s.id,'id inexistente',g.id,p.id),null);
});
test('redondeo solo de presentación',()=>{
  assert.equal(roundGrade(8.055,2,'half-up'),8.06);
  assert.equal(roundGrade(8.045,2,'half-up'),8.05);
  assert.equal(roundGrade(8.035,2,'half-up'),8.04);
  assert.equal(roundGrade(8.099,1,'floor'),8.0);
  assert.equal(roundGrade(8.001,1,'ceil'),8.1);
  assert.equal(roundGrade(null,2),null);
});
