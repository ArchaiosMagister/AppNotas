import test from 'node:test';
import assert from 'node:assert/strict';
import {initialNotebook,addGroup,addCategory,addStudent,addAssessment,removeCategoryFromGroup,availableCategories,effectiveCategories,setGrade,setFinalOverride,assertModel,parseScore,removeCategory} from '../src/model.js';
import {gradeTone,normalizedScore,overallGrade,formatGrade} from '../src/calculations.js';

function setup(){const doc=initialNotebook();const latin2=addGroup(doc,'Latín II · pruebas','Latín II','2026–2027','2bach');return {doc,latin2,latin1:doc.groups[0],p:doc.periods[0]};}

test('Trabajos vacío en Latín II puede ocultarse sin borrar Trabajo 1 de Latín I',()=>{
  const {doc,latin2,latin1,p}=setup();
  const id=doc.categories.find(c=>c.name==='Trabajos').id;
  const preserved=doc.assessments.find(a=>a.categoryId===id&&a.groupId===latin1.id);
  const grades=doc.grades.filter(g=>g.assessmentId===preserved.id);
  const before=overallGrade(doc,doc.students[0].id,latin1.id,p.id);
  assert.equal(removeCategoryFromGroup(doc,latin2.id,id),'hidden');
  assert.equal(effectiveCategories(doc,latin2.id,p.id).find(c=>c.id===id),undefined);
  assert(availableCategories(doc,latin1.id).some(c=>c.id===id));
  assert.equal(doc.grades.filter(g=>g.assessmentId===preserved.id).length,grades.length);
  assert.equal(overallGrade(doc,doc.students[0].id,latin1.id,p.id),before);
  assertModel(doc);
});
test('el borrado de categoría de grupo impide eliminar columnas existentes en otro trimestre',()=>{
  const {doc,latin2,p}=setup();const cat=doc.categories.find(c=>c.name==='Exámenes');
  const act=doc.assessments.find(a=>a.groupId===latin2.id&&a.categoryId===cat.id);
  const p2=doc.periods[1];addAssessment(doc,{name:'Segundo trimestre',groupId:latin2.id,periodId:p2.id,categoryId:cat.id});
  // Sin el examen de primera evaluación, sigue protegida por la segunda.
  doc.assessments=doc.assessments.filter(a=>a.id!==act.id && !(a.groupId===latin2.id&&a.periodId===p.id&&a.categoryId===cat.id));
  assert.throws(()=>removeCategoryFromGroup(doc,latin2.id,cat.id),/alguna evaluación/);
  assertModel(doc);
});
test('una categoría propia del grupo no aparece en otros grupos ni se puede asignar en ellos',()=>{
  const {doc,latin2,latin1,p}=setup();
  const cat=addCategory(doc,'Comentarios',0,'mean',latin2.id);
  assert(availableCategories(doc,latin2.id).some(c=>c.id===cat.id));
  assert(!availableCategories(doc,latin1.id).some(c=>c.id===cat.id));
  assert.throws(()=>addAssessment(doc,{name:'Inválida',groupId:latin1.id,periodId:p.id,categoryId:cat.id}),/inválidos/);
  assertModel(doc);
});
test('categoría vacía del grupo puede eliminarse globalmente sin referencias huérfanas',()=>{
  const {doc,latin2}=setup();const cat=addCategory(doc,'Entrevistas',0,'mean',latin2.id);
  assert.equal(removeCategoryFromGroup(doc,latin2.id,cat.id),'deleted');
  assert(!doc.categories.some(c=>c.id===cat.id));assertModel(doc);
});
test('no se permiten más de dos decimales en notas manuales',()=>{
  assert.equal(parseScore('4,25'),4.25);assert.equal(parseScore('.25'),.25);
  for(const s of ['4,256','4.256','4,','5e0','-1','1.000'])assert.throws(()=>parseScore(s),/decimales|puntuación/);
  const {doc,latin2,p}=setup();const st=addStudent(doc,latin2.id,'Ficticio');
  const a=doc.assessments.find(a=>a.groupId===latin2.id);
  assert.throws(()=>setGrade(doc,st.id,a.id,'4,256'),/dos decimales/);
  assert.throws(()=>setFinalOverride(doc,st.id,p.id,'8.123'),/dos decimales/);
  setGrade(doc,st.id,a.id,'4,25');setFinalOverride(doc,st.id,p.id,'8.12');
  assertModel(doc);
});
test('redondea solo la presentación; nunca la media de valores internos',()=>{
  assert(Math.abs(normalizedScore(1.11,3)-3.7)<1e-12);
  assert.equal(formatGrade(8.876,{decimals:3,rounding:'half-up'}),'8,88');
  assert.equal(formatGrade(8.876,{decimals:1,rounding:'half-up'}),'8,9');
  assert.equal(formatGrade(8.876,{decimals:0,rounding:'half-up'}),'9');
});
test('límites cromáticos exactos: 3,5 / 5 / 6 / 7 / 10',()=>{
  const boundary=[0,3.49,3.50,4.99,5,5.99,6,6.99,7,7.5,8.25,9.99,10];
  const tones=boundary.map(gradeTone);
  assert.equal(tones[0].background,tones[1].background);
  for(const [a,b] of [[1,2],[3,4],[5,6],[7,8],[11,12]])assert.notEqual(tones[a].background,tones[b].background);
  assert.notEqual(tones[8].background,tones[11].background);
  assert.equal(gradeTone(null),null);assert.equal(gradeTone(11),null);
});
test('los colores garantizan contraste WCAG AA 4,5:1 en todos los tramos',()=>{
  const L=hex=>{const c=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2];};
  for(let i=0;i<=1000;i++){
    const tone=gradeTone(i/100);
    const hi=Math.max(L(tone.background),L(tone.color)),lo=Math.min(L(tone.background),L(tone.color));
    const contrast=(hi+.05)/(lo+.05);
    assert(contrast>=4.5,`${i/100}: contraste ${contrast}`);
  }
});
test('las cifras de notas antiguas con tres decimales se pueden leer sin perder el valor original',()=>{
  const doc=initialNotebook();const id=doc.grades[0].id;
  doc.grades[0].score=7.125;doc.settings.decimals=3;
  assertModel(doc);
  assert.equal(doc.grades[0].score,7.125);
  assert.equal(formatGrade(doc.grades[0].score,doc.settings),'7,13');
});
