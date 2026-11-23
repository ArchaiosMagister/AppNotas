import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  initialNotebook,emptyNotebook,addGroup,addStudent,addAssessment,addPeriod,
  availableCategories,effectiveCategories,addPeriodCategory,setPeriodCategoryEnabled,
  setPeriodCategory,resetPeriodCategories,copyPeriodCategories,copyPeriodAssessments,
  setGrade,setIndividualCategoryRule,setItacaAttitudeCondition,assertModel
} from '../src/model.js';
import {overallGrade,categoryGrade,itacaGrade,finalGrade} from '../src/calculations.js';

const setup=()=>{
  const doc=initialNotebook();
  const group=doc.groups[0],periods=[...doc.periods].sort((a,b)=>a.order-b.order);
  const categories=doc.categories;
  const student=doc.students[0];
  return {doc,group,periods,categories,student};
};
const ids=(doc,g,p)=>effectiveCategories(doc,g.id,p.id).map(c=>c.id);
const byName=(doc,g,p,name)=>effectiveCategories(doc,g.id,p.id).find(c=>c.name===name);

test('cuaderno heredado: todas las categorías y notas se conservan mientras no haya cambios',()=>{
  const {doc,group,periods,categories,student}=setup();
  const old=structuredClone(doc);
  const before=[overallGrade(doc,student.id,group.id,periods[0].id),
    itacaGrade(doc,student.id,group.id,periods[0].id),
    finalGrade(doc,student.id,group.id)];
  for(const p of periods)assert.deepEqual(ids(doc,group,p),categories.map(c=>c.id));
  assertModel(doc);
  assert.deepEqual(doc,old);
  assert.deepEqual(before,[overallGrade(doc,student.id,group.id,periods[0].id),
    itacaGrade(doc,student.id,group.id,periods[0].id),finalGrade(doc,student.id,group.id)]);
});

test('crear categoría en 2.ª evaluación la activa solo en esa materia y evaluación',()=>{
  const {doc,group,periods,student}=setup();
  const other=addGroup(doc,'Grupo Griego','Griego I','2026-2027','1bach');
  const original=overallGrade(doc,student.id,group.id,periods[0].id);
  const added=addPeriodCategory(doc,group.id,periods[1].id,'Trabajo de léxico',20);
  assert.equal(added.ownerGroupId,group.id);
  assert(ids(doc,group,periods[1]).includes(added.id));
  assert(!ids(doc,group,periods[0]).includes(added.id));
  assert(!ids(doc,group,periods[2]).includes(added.id));
  assert(!availableCategories(doc,other.id).some(c=>c.id===added.id));
  assert.equal(byName(doc,group,periods[1],'Trabajo de léxico').weight,20);
  assert.equal(overallGrade(doc,student.id,group.id,periods[0].id),original);
  assertModel(doc);
  setPeriodCategoryEnabled(doc,group.id,periods[0].id,added.id,true);
  assert(ids(doc,group,periods[0]).includes(added.id));
  setPeriodCategoryEnabled(doc,group.id,periods[0].id,added.id,false);
  assert(!ids(doc,group,periods[0]).includes(added.id));
  assert(ids(doc,group,periods[1]).includes(added.id));
  assertModel(doc);
});

test('retirar categoría vacía de 2.ª evaluación no la oculta en otras ni borra nada',()=>{
  const {doc,group,periods,student}=setup();
  const work=doc.categories.find(c=>c.name==='Trabajos');
  const before=overallGrade(doc,student.id,group.id,periods[0].id);
  const gradeCount=doc.grades.length;
  setPeriodCategoryEnabled(doc,group.id,periods[1].id,work.id,false);
  assert(!ids(doc,group,periods[1]).includes(work.id));
  assert(ids(doc,group,periods[0]).includes(work.id));
  assert(ids(doc,group,periods[2]).includes(work.id));
  assert.equal(overallGrade(doc,student.id,group.id,periods[0].id),before);
  assert.equal(doc.grades.length,gradeCount);
  assertModel(doc);
  assert.throws(()=>setPeriodCategoryEnabled(doc,group.id,periods[0].id,work.id,false),/actividades/);
  assertModel(doc);
});

test('retirar una categoría con una actividad calificada queda bloqueado en la evaluación afectada',()=>{
  const {doc,group,periods,student}=setup();
  const category=doc.categories.find(c=>c.name==='Exámenes');
  const a=addAssessment(doc,{name:'Examen 2',groupId:group.id,periodId:periods[1].id,categoryId:category.id});
  setGrade(doc,student.id,a.id,7);
  const original=structuredClone(doc);
  assert.throws(()=>setPeriodCategoryEnabled(doc,group.id,periods[1].id,category.id,false),/actividades/);
  assert.deepEqual(doc,original);
});

test('la condición de Ítaca y las reglas individuales impiden retirar categorías en uso',()=>{
  const {doc,group,periods,student}=setup();
  const attitude=doc.categories.find(c=>c.name==='Actitud');
  const work=doc.categories.find(c=>c.name==='Trabajos');
  setItacaAttitudeCondition(doc,group.id,periods[1].id,{mode:'category',categoryId:attitude.id,minScore:5});
  assert.throws(()=>setPeriodCategoryEnabled(doc,group.id,periods[1].id,attitude.id,false),/Ítaca/);
  setIndividualCategoryRule(doc,student.id,work.id,periods[1].id,'mean');
  assert.throws(()=>setPeriodCategoryEnabled(doc,group.id,periods[1].id,work.id,false),/reglas individuales/);
  assertModel(doc);
});

test('no se crean ni trasladan actividades a categorías desactivadas en su evaluación',()=>{
  const {doc,group,periods}=setup();
  const cat=doc.categories.find(c=>c.name==='Trabajos');
  setPeriodCategoryEnabled(doc,group.id,periods[1].id,cat.id,false);
  assert.throws(()=>addAssessment(doc,{name:'Trabajo ajeno',groupId:group.id,periodId:periods[1].id,categoryId:cat.id}),/inválidos/);
  const a=addAssessment(doc,{name:'Examen',groupId:group.id,periodId:periods[1].id,categoryId:doc.categories.find(c=>c.name==='Exámenes').id});
  assert(a.id);
  assertModel(doc);
});

test('copiar configuración incluye selección y pesos, pero nunca oculta notas existentes',()=>{
  const {doc,group,periods,student}=setup();
  const cat=doc.categories.find(c=>c.name==='Trabajos');
  setPeriodCategoryEnabled(doc,group.id,periods[1].id,cat.id,false);
  const added=addPeriodCategory(doc,group.id,periods[1].id,'Trabajo extraordinario',25);
  setPeriodCategory(doc,group.id,periods[1].id,added.id,{weight:40,rule:'highest'});
  copyPeriodCategories(doc,group.id,periods[1].id,periods[2].id);
  assert.deepEqual(ids(doc,group,periods[1]),ids(doc,group,periods[2]));
  assert.equal(effectiveCategories(doc,group.id,periods[2].id).find(c=>c.id===added.id).weight,40);
  assert.equal(effectiveCategories(doc,group.id,periods[2].id).find(c=>c.id===added.id).rule,'highest');
  const snapshot=structuredClone(doc);
  assert.throws(()=>copyPeriodCategories(doc,group.id,periods[1].id,periods[0].id),/actividades/);
  assert.deepEqual(doc,snapshot);
  assertModel(doc);
});

test('restablecer porcentajes conserva la selección específica de categorías',()=>{
  const {doc,group,periods}=setup();
  const work=doc.categories.find(c=>c.name==='Trabajos');
  setPeriodCategoryEnabled(doc,group.id,periods[1].id,work.id,false);
  const exams=doc.categories.find(c=>c.name==='Exámenes');
  setPeriodCategory(doc,group.id,periods[1].id,exams.id,{weight:75});
  assert.equal(byName(doc,group,periods[1],'Exámenes').weight,75);
  resetPeriodCategories(doc,group.id,periods[1].id);
  assert.equal(byName(doc,group,periods[1],'Exámenes').weight,60);
  assert(!ids(doc,group,periods[1]).includes(work.id));
  assertModel(doc);
});

test('los nuevos períodos heredan la selección y ponderaciones del último, sin alterar anteriores',()=>{
  const {doc,group,periods}=setup();
  const work=doc.categories.find(c=>c.name==='Trabajos');
  setPeriodCategoryEnabled(doc,group.id,periods[2].id,work.id,false);
  const exams=doc.categories.find(c=>c.name==='Exámenes');
  setPeriodCategory(doc,group.id,periods[2].id,exams.id,{weight:90});
  const before=ids(doc,group,periods[0]);
  const p4=addPeriod(doc,'4.ª evaluación');
  assert(!ids(doc,group,p4).includes(work.id));
  assert.equal(byName(doc,group,p4,'Exámenes').weight,90);
  assert.deepEqual(ids(doc,group,periods[0]),before);
  assertModel(doc);
});

test('copiar actividades desde una evaluación puede activar previamente categorías ausentes en destino',()=>{
  const {doc,group,periods}=setup();
  const category=doc.categories.find(c=>c.name==='Exámenes');
  setPeriodCategoryEnabled(doc,group.id,periods[1].id,category.id,false);
  copyPeriodAssessments(doc,group.id,periods[0].id,[periods[1].id]);
  assert(ids(doc,group,periods[1]).includes(category.id));
  assert.equal(doc.assessments.filter(a=>a.groupId===group.id&&a.periodId===periods[1].id).length,
    doc.assessments.filter(a=>a.groupId===group.id&&a.periodId===periods[0].id).length);
  assert(!doc.grades.some(g=>doc.assessments.some(a=>a.id===g.assessmentId&&a.periodId===periods[1].id)));
  assertModel(doc);
});

test('validación de copias antiguas sin selección explícita y nuevas con referencias rotas',()=>{
  const {doc,group,periods}=setup();
  assertModel(doc);
  const invalid=structuredClone(doc);
  invalid.gradingProfiles.push({id:'perfil-invalido',groupId:group.id,periodId:periods[1].id,
    overrides:[],categoryIds:['categoria-inexistente']});
  assert.throws(()=>assertModel(invalid),/Selección de categorías/);
});

test('UI: creación, activación, eliminación y selector de actividades usan categoría de la evaluación',async()=>{
  const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
  const css=await readFile(new URL('../styles.css',import.meta.url),'utf8');
  assert(app.includes('function renderRules(){'));
  assert(app.includes('id="category-to-enable"'));
  assert(app.includes('id="enable-category"'));
  assert(app.includes('addPeriodCategory(d,STATE.groupId,STATE.periodId'));
  assert(app.includes('setPeriodCategoryEnabled(d,STATE.groupId,STATE.periodId,category.id,false)'));
  assert(app.includes('effectiveCategories(STATE.doc,STATE.groupId,STATE.periodId).map(c=>opt(c.id,c.name))'));
  assert(css.includes('.period-category-picker{'));
});
