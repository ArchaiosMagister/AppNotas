import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  initialNotebook,assertModel,addAssessment,createRubric,updateRubric,
  updateAssessment,removeAssessment,addCategory,removeCategory,
  removeCategoryFromGroup,setCategory,setItacaAttitudeCondition,itacaAttitudeCondition
} from '../src/model.js';

function criterionFixture(){
  const doc=initialNotebook(),group=doc.groups[0],period=doc.periods[0];
  const category=doc.categories.find(c=>c.name==='Actitud');
  const criteria=[
    {name:'Participación',maxScore:2,weight:1},
    {name:'Atención',maxScore:2,weight:1}
  ];
  const rubric=createRubric(doc,'Actitud para Ítaca',criteria);
  const activity=addAssessment(doc,{
    name:'Rúbrica de actitud',groupId:group.id,periodId:period.id,
    categoryId:category.id,rubricId:rubric.id,orthography:null
  });
  setItacaAttitudeCondition(doc,group.id,period.id,{
    mode:'criterion',categoryId:category.id,assessmentId:activity.id,
    criterionId:rubric.criteria[0].id,minScore:1
  });
  assertModel(doc);
  return {doc,group,period,category,rubric,activity,criteria};
}

test('rúbrica vinculada a Ítaca: no regenerar identificadores de criterios sin retirar antes la condición',()=>{
  const {doc,group,period,rubric,activity,criteria}=criterionFixture();
  const before=structuredClone(doc);
  assert.throws(()=>updateRubric(doc,rubric.id,'Actitud revisada',criteria),/Ítaca/);
  assert.deepEqual(doc,before,'La operación rechazada no cambia criterios ni calificaciones');
  assert.throws(()=>removeAssessment(doc,activity.id),/Ítaca/);
  assert.deepEqual(doc,before,'No se borra la actividad requerida');
  assertModel(doc);
  setItacaAttitudeCondition(doc,group.id,period.id,null);
  assert.doesNotThrow(()=>updateRubric(doc,rubric.id,'Actitud revisada',criteria));
  assert.doesNotThrow(()=>removeAssessment(doc,activity.id));
  assertModel(doc);
});

test('actividad de rúbrica requerida: bloquear cambios de rúbrica o categoría, permitir renombrarla',()=>{
  const {doc,group,period,rubric,activity}=criterionFixture();
  const alternative=createRubric(doc,'Rúbrica alternativa',[{name:'Puntos',maxScore:2,weight:1}]);
  const otherCategory=doc.categories.find(c=>c.name==='Trabajos');
  const before=structuredClone(doc);
  assert.throws(()=>updateAssessment(doc,activity.id,{rubricId:alternative.id}),/Ítaca/);
  assert.deepEqual(doc,before);
  assert.throws(()=>updateAssessment(doc,activity.id,{categoryId:otherCategory.id}),/Ítaca/);
  assert.deepEqual(doc,before);
  updateAssessment(doc,activity.id,{name:'Actitud actualizada'});
  assert.equal(itacaAttitudeCondition(doc,group.id,period.id).assessmentId,activity.id);
  assert.equal(doc.assessments.find(a=>a.id===activity.id).rubricId,rubric.id);
  assertModel(doc);
  setItacaAttitudeCondition(doc,group.id,period.id,null);
  assert.doesNotThrow(()=>updateAssessment(doc,activity.id,{rubricId:alternative.id}));
  assertModel(doc);
});

test('categoría de Actitud sin actividades: impedir retiro o cambio de nombre incompatible si está vinculada',()=>{
  const doc=initialNotebook(),group=doc.groups[0],period=doc.periods[0];
  const category=addCategory(doc,'Actitud adicional',0,'mean',group.id);
  setItacaAttitudeCondition(doc,group.id,period.id,{
    mode:'category',categoryId:category.id,minScore:5
  });
  const before=structuredClone(doc);
  assert.throws(()=>removeCategory(doc,category.id),/Ítaca/);
  assert.deepEqual(doc,before);
  assert.throws(()=>removeCategoryFromGroup(doc,group.id,category.id),/Ítaca/);
  assert.deepEqual(doc,before);
  assert.throws(()=>setCategory(doc,category.id,{name:'Trabajos extra'}),/Ítaca/);
  assert.deepEqual(doc,before);
  assert.doesNotThrow(()=>setCategory(doc,category.id,{name:'Actitud ampliada'}));
  assertModel(doc);
  setItacaAttitudeCondition(doc,group.id,period.id,null);
  assert.equal(removeCategoryFromGroup(doc,group.id,category.id),'deleted');
  assert(!doc.categories.some(c=>c.id===category.id));
  assertModel(doc);
});

test('categoría compartida: su uso en Ítaca bloquea solo el retiro del grupo afectado',()=>{
  const doc=initialNotebook(),group=doc.groups[0],period=doc.periods[0];
  const shared=addCategory(doc,'Actitud común',0);
  setItacaAttitudeCondition(doc,group.id,period.id,{
    mode:'category',categoryId:shared.id,minScore:5
  });
  assert.throws(()=>removeCategoryFromGroup(doc,group.id,shared.id),/Ítaca/);
  setItacaAttitudeCondition(doc,group.id,period.id,null);
  assert.equal(removeCategoryFromGroup(doc,group.id,shared.id),'hidden');
  assert(doc.categories.some(c=>c.id===shared.id));
  assertModel(doc);
});

test('recuperación de condición histórica huérfana y búsquedas rápidas en la tabla de calificaciones',async()=>{
  const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
  assert(app.includes('if(!eligible.length&&!current)'), 'Se puede abrir el diálogo aunque falte la categoría antigua');
  assert(app.includes("if(!activities.length){details.innerHTML="),'No acceder a activities[0] si desapareció la rúbrica');
  assert(app.includes('const studentsById=new Map('));
  assert(app.includes('const assessmentsById=new Map('));
  assert(app.includes('const student=studentsById.get(studentId)'));
});
