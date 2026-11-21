import test from 'node:test';
import assert from 'node:assert/strict';
import {initialNotebook,assertModel,addGroup,addStudent,addAssessment,addCategory,removeCategory,copyPeriodAssessments,effectiveCategories,setGrade,setRubricGrade,duplicateRubric} from '../src/model.js';
import {overallGrade,categoryGrade} from '../src/calculations.js';
import {previewRubric} from '../src/rubric-ui.js';
import {parseRubricText} from '../src/rubric-import.js';

function setup(){const doc=initialNotebook();const latin=addGroup(doc,'2.º Bach A','Latín II','2026-2027','2bach');const first=doc.periods[0];return {doc,latin,first};}

test('los tres trimestres se ofrecen por defecto, con una evaluación final independiente',()=>{
  const doc=initialNotebook();assert.equal(doc.periods.length,3);
  assert.deepEqual(doc.periods.map(p=>p.name),['1.ª evaluación','2.ª evaluación','3.ª evaluación']);
  assertModel(doc);
});

test('Latín II nace con cuatro actividades, incluido Literatura y Actitud rubricada',()=>{
  const {doc,latin,first}=setup();const cols=doc.assessments.filter(a=>a.groupId===latin.id&&a.periodId===first.id).sort((a,b)=>a.order-b.order);
  assert.deepEqual(cols.map(a=>a.name),['Examen parcial','Examen final','Literatura','Actitud']);
  const attitude=cols[3];assert.equal(attitude.maxScore,10);assert.equal(attitude.convertToTen,true);
  const rubric=doc.rubrics.find(r=>r.id===attitude.rubricId);
  assert.equal(rubric.criteria.length,5);assert.equal(rubric.criteria.reduce((s,c)=>s+c.weight,0),100);
  assert.equal(rubric.criteria[4].name,'Uso del móvil');
  assert.deepEqual(rubric.criteria[4].levels.map(l=>l.score),[2,0]);
  const cats=effectiveCategories(doc,latin.id,first.id);assert.equal(cats.reduce((s,c)=>s+c.weight,0),100);
  assert.equal(cats.find(c=>c.name==='Trabajos').weight,0);
  assert.equal(cats.find(c=>c.name==='Literatura').weight,30);
  assertModel(doc);
});

test('Griego II crea Cultura y reutiliza sin duplicar la rúbrica, manteniendo Latín II',()=>{
  const {doc,latin,first}=setup();const griego=addGroup(doc,'2.º Bach B','Griego II','2026-2027','2bach');
  assert.deepEqual(doc.assessments.filter(a=>a.groupId===griego.id).map(a=>a.name),['Examen parcial','Examen final','Cultura','Actitud']);
  assert.equal(doc.rubrics.filter(r=>r.name==='Actitud · 2.º Bachillerato').length,1);
  assert.equal(effectiveCategories(doc,latin.id,first.id).reduce((a,c)=>a+c.weight,0),100);
  assert.equal(effectiveCategories(doc,griego.id,first.id).find(c=>c.name==='Cultura').weight,30);
  assert.equal(effectiveCategories(doc,latin.id,first.id).find(c=>c.name==='Cultura').weight,0);
  assertModel(doc);
});

test('rúbrica descriptiva con cinco máximos da exactamente 10 puntos',()=>{
  const {doc,latin,first}=setup();const st=addStudent(doc,latin.id,'Alumno ficticio');
  const cols=doc.assessments.filter(a=>a.groupId===latin.id&&a.periodId===first.id).sort((a,b)=>a.order-b.order);
  const rub=doc.rubrics.find(r=>r.id===cols[3].rubricId);
  const full=Object.fromEntries(rub.criteria.map(c=>[c.id,2]));
  assert.equal(setRubricGrade(doc,st.id,cols[3].id,full),10);
  setGrade(doc,st.id,cols[0].id,6);setGrade(doc,st.id,cols[1].id,8);setGrade(doc,st.id,cols[2].id,9);
  assert.equal(categoryGrade(doc,st.id,doc.categories.find(c=>c.name==='Exámenes').id,latin.id,first.id),7);
  assert.equal(overallGrade(doc,st.id,latin.id,first.id),7.9);
  assertModel(doc);
});

test('la rúbrica importada no permite puntuación 1 en Uso del móvil',()=>{
  const {doc,latin,first}=setup();const st=addStudent(doc,latin.id,'Alumno ficticio');
  const col=doc.assessments.find(a=>a.groupId===latin.id&&a.periodId===first.id&&a.name==='Actitud');
  const rubric=doc.rubrics.find(r=>r.id===col.rubricId);
  const ratings=Object.fromEntries(rubric.criteria.map(c=>[c.id,2]));
  ratings[rubric.criteria[4].id]=1;
  assert.throws(()=>setRubricGrade(doc,st.id,col.id,ratings),/escala/);
  assert.throws(()=>previewRubric(rubric,ratings),/niveles/);
  assertModel(doc);
});

test('copiar actividades a 2.º y 3.º preserva estructura, rúbrica y reglas sin notas',()=>{
  const {doc,latin,first}=setup();const st=addStudent(doc,latin.id,'Alumno ficticio');
  const originals=doc.assessments.filter(a=>a.groupId===latin.id&&a.periodId===first.id).sort((a,b)=>a.order-b.order);
  setGrade(doc,st.id,originals[0].id,7);
  const [p2,p3]=doc.periods.slice(1);copyPeriodAssessments(doc,latin.id,first.id,[p2.id,p3.id]);
  for(const p of [p2,p3]){
    const copies=doc.assessments.filter(a=>a.groupId===latin.id&&a.periodId===p.id).sort((a,b)=>a.order-b.order);
    assert.deepEqual(copies.map(a=>a.name),originals.map(a=>a.name));
    assert.notEqual(copies[0].id,originals[0].id);
    assert.equal(copies[3].rubricId,originals[3].rubricId);
    assert.equal(doc.grades.filter(g=>copies.some(a=>a.id===g.assessmentId)).length,0);
    assert.deepEqual(effectiveCategories(doc,latin.id,p.id).map(c=>c.weight),effectiveCategories(doc,latin.id,first.id).map(c=>c.weight));
    assert.equal(overallGrade(doc,st.id,latin.id,p.id),null);
  }
  assertModel(doc);
});

test('copiar a evaluaciones ocupadas bloquea toda copia, incluso en lote',()=>{
  const {doc,latin,first}=setup();const [p2,p3]=doc.periods.slice(1);const cat=doc.categories.find(c=>c.name==='Exámenes');
  addAssessment(doc,{name:'Existente',groupId:latin.id,periodId:p3.id,categoryId:cat.id});
  const before=JSON.stringify(doc);
  assert.throws(()=>copyPeriodAssessments(doc,latin.id,first.id,[p2.id,p3.id]),/contiene actividades/);
  assert.equal(JSON.stringify(doc),before);assertModel(doc);
});

test('categorías personalizables: se elimina una sin actividad, pero se protegen las ocupadas',()=>{
  const {doc}=setup();const cat=addCategory(doc,'Entrevistas',0);
  removeCategory(doc,cat.id);assert(!doc.categories.some(c=>c.id===cat.id));
  assert.throws(()=>removeCategory(doc,doc.categories.find(c=>c.name==='Exámenes').id),/contiene actividades/);
  assertModel(doc);
});

test('duplicar una rúbrica descriptiva conserva los niveles y no las notas',()=>{
  const {doc}=setup();const old=doc.rubrics.find(r=>r.name==='Actitud · 2.º Bachillerato');
  const copy=duplicateRubric(doc,old.id);
  assert.notEqual(copy.id,old.id);
  assert.deepEqual(copy.criteria.map(c=>c.levels),old.criteria.map(c=>c.levels));
  assert(copy.criteria.every((c,i)=>c.id!==old.criteria[i].id));assertModel(doc);
});

test('rúbrica creada directamente desde una actividad interpreta líneas criterio;máximo;peso',()=>{
  assert.deepEqual(parseRubricText('Asistencia;2;20\nParticipación;2;20'),[
    {name:'Asistencia',maxScore:2,weight:20},{name:'Participación',maxScore:2,weight:20}
  ]);
});
