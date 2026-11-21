import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initialNotebook, addGroup, addCategory, addCompetency, setCompetencyLink,
  setFinalConfig, setPeriodCategory, setCategory, removeCategory, copyPeriodCategories,
  removeCategoryFromGroup, availableCategories, assertModel
} from '../src/model.js';

const fixture=()=>{const doc=initialNotebook();const group=doc.groups[0],period=doc.periods[0];return {doc,group,period};};

test('integridad: peso competencial inválido deja el cuaderno byte a byte inalterado',()=>{
 const {doc}=fixture();const c=doc.competencies[0],cat=doc.categories[0].id;
 const before=structuredClone(doc);
 assert.throws(()=>setCompetencyLink(doc,c.id,cat,-2),/Peso/);
 assert.deepEqual(doc,before);
});

test('integridad: configuración final inválida no crea un registro a medias',()=>{
 const {doc,group,period}=fixture();const before=structuredClone(doc);
 assert.throws(()=>setFinalConfig(doc,group.id,{weights:{[period.id]:-1}}),/Regla/);
 assert.deepEqual(doc,before);
});

test('integridad: retirar categoría compartida vacía no altera los porcentajes de otro grupo',()=>{
 const {doc,group,period}=fixture();const cat=addCategory(doc,'Lecturas adicionales',0);
 const second=addGroup(doc,'Grupo B','Latín I','2026-2027','1bach');
 setPeriodCategory(doc,second.id,period.id,cat.id,{weight:35});
 const before=structuredClone(doc);
 assert.equal(removeCategoryFromGroup(doc,group.id,cat.id),'hidden');
 assert(!availableCategories(doc,group.id).some(c=>c.id===cat.id));
 assert(availableCategories(doc,second.id).some(c=>c.id===cat.id));
 assert.deepEqual(doc.gradingProfiles,before.gradingProfiles);
 assert.deepEqual(doc.categories,before.categories);
 assert.deepEqual(doc.grades,before.grades);
 assertModel(doc);
});

test('integridad: un vínculo competencial bloquea el borrado global en lugar de desaparecer silenciosamente',()=>{
 const {doc}=fixture();const cat=addCategory(doc,'Indicador conectado',0);
 const competency=addCompetency(doc,'Competencia de prueba');
 setCompetencyLink(doc,competency.id,cat.id,1);
 const before=structuredClone(doc);
 assert.throws(()=>removeCategory(doc,cat.id),/competenc|víncul/i);
 assert.deepEqual(doc,before);
});

test('integridad: los perfiles por periodo nunca admiten cambiar el identificador de categoría',()=>{
 const {doc,group,period}=fixture();const c=doc.categories[0].id,other=doc.categories[1].id;
 const before=structuredClone(doc);
 assert.throws(()=>setPeriodCategory(doc,group.id,period.id,c,{categoryId:other,weight:50}),/categoría|campo/i);
 assert.deepEqual(doc,before);
});

test('integridad: editar nombre o peso no puede modificar el ID de categoría ni asignarle un propietario ajeno',()=>{
 const {doc,group}=fixture();const c=addCategory(doc,'Prueba mutable',0,'mean',group.id);
 const before=structuredClone(doc);
 assert.throws(()=>setCategory(doc,c.id,{id:'id-inyectado',name:'Otro'}),/campo|no permitid/i);
 assert.deepEqual(doc,before);
});

test('integridad: no se pueden copiar pesos desde un periodo que no existe',()=>{
 const {doc,group,period}=fixture();const target=doc.periods[1];const prior=structuredClone(doc);
 assert.throws(()=>copyPeriodCategories(doc,group.id,'periodo-inexistente',target.id),/inexistente/);
 assert.deepEqual(doc,prior);
});

test('integridad: un grupo no puede ocultar una categoría vinculada a sus competencias',()=>{
 const {doc,group}=fixture();const cat=addCategory(doc,'Categoría propia',0,'mean',group.id);
 const comp=addCompetency(doc,'Competencia propia',group.id);
 setCompetencyLink(doc,comp.id,cat.id,50);
 const prior=structuredClone(doc);
 assert.throws(()=>removeCategoryFromGroup(doc,group.id,cat.id),/competencia/);
 assert.deepEqual(doc,prior);
});

test('integridad: se puede retirar un vínculo antiguo de una categoría oculta sin alterar otras competencias',()=>{
 const {doc,group}=fixture();const other=addGroup(doc,'Otro grupo','Griego I','2026-2027','1bach');
 const cat=addCategory(doc,'Vieja categoría',0,'mean',other.id);
 const comp=addCompetency(doc,'Competencia especial',other.id);
 setCompetencyLink(doc,comp.id,cat.id,20);
 // Simula una copia antigua con un vínculo a una categoría ya ocultada.
 other.hiddenCategoryIds=[cat.id];
 setCompetencyLink(doc,comp.id,cat.id,null);
 assert.equal(comp.links.length,0);
 assertModel(doc);
});

test('integridad: no se puede ligar una competencia a categorías de otro grupo',()=>{
 const {doc,group}=fixture();const other=addGroup(doc,'Otro grupo','Griego I','2026-2027','1bach');
 const cat=addCategory(doc,'Exclusiva A',0,'mean',group.id);
 const comp=addCompetency(doc,'Exclusiva B',other.id);
 const prior=structuredClone(doc);
 assert.throws(()=>setCompetencyLink(doc,comp.id,cat.id,30),/no disponible/);
 assert.deepEqual(doc,prior);
});
