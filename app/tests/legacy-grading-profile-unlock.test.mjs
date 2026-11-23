import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initialNotebook,addGroup,addPeriod,assertModel,migrateNotebook,
  availableCategories,effectiveCategories
} from '../src/model.js';
import {overallGrade,itacaGrade,finalGrade} from '../src/calculations.js';

function legacyNotebookWithHiddenCategoryRule(){
  const doc=initialNotebook();
  const latinI=doc.groups[0],student=doc.students[0],period=doc.periods[0];
  const latinII=addGroup(doc,'Latín II · histórico','Latín II','2026–2027','2bach');
  const work=doc.categories.find(c=>c.name==='Trabajos');
  const profile=doc.gradingProfiles.find(p=>p.groupId===latinII.id&&p.periodId===period.id);
  assert(profile?.overrides.some(o=>o.categoryId===work.id),'El perfil original debe incluir Trabajos');
  assert(!doc.assessments.some(a=>a.groupId===latinII.id&&a.categoryId===work.id));
  // Así se guardaban cuadernos antes de poder seleccionar categorías por
  // evaluación: una categoría se ocultaba, pero su regla histórica persistía.
  latinII.hiddenCategoryIds=[work.id];
  assert.equal(profile.categoryIds,undefined);
  return {doc,latinI,latinII,student,period,work,profile};
}

test('desbloqueo: perfil antiguo con categoría oculta y regla histórica sigue siendo válido',()=>{
  const {doc,latinI,latinII,student,period,work,profile}=legacyNotebookWithHiddenCategoryRule();
  const before=structuredClone(doc);
  const grades=[
    overallGrade(doc,student.id,latinI.id,period.id),
    itacaGrade(doc,student.id,latinI.id,period.id),
    finalGrade(doc,student.id,latinI.id)
  ];
  assert.equal(assertModel(doc),true);
  const opened=migrateNotebook(doc);
  assert.equal(opened.migrated,false,'No es necesaria ninguna migración destructiva');
  assert.deepEqual(opened.doc,before,'El desbloqueo no reescribe ni elimina los ajustes heredados');
  assert.equal(availableCategories(doc,latinII.id).some(c=>c.id===work.id),false);
  assert.equal(effectiveCategories(doc,latinII.id,period.id).some(c=>c.id===work.id),false);
  assert(profile.overrides.some(o=>o.categoryId===work.id),'Se conserva la configuración histórica');
  assert.deepEqual(grades,[
    overallGrade(doc,student.id,latinI.id,period.id),
    itacaGrade(doc,student.id,latinI.id,period.id),
    finalGrade(doc,student.id,latinI.id)
  ]);
});

test('categorías inexistentes siguen siendo rechazadas; solo se aceptan referencias históricas legítimas',()=>{
  const {doc,profile}=legacyNotebookWithHiddenCategoryRule();
  profile.overrides.push({categoryId:'inexistente',weight:10,rule:'mean',bestCount:2});
  assert.throws(()=>assertModel(doc),/Regla de periodo inválida/);
});

test('una selección explícita errónea de categorías continúa bloqueada',()=>{
  const {doc,profile}=legacyNotebookWithHiddenCategoryRule();
  profile.categoryIds=['inexistente'];
  assert.throws(()=>assertModel(doc),/Selección de categorías de evaluación inválida/);
});
