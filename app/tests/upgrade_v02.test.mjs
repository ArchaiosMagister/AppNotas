import test from 'node:test';
import assert from 'node:assert/strict';
import {initialNotebook,assertModel,migrateNotebook,effectiveCategories,setPeriodCategory,resetPeriodCategories,copyPeriodCategories,addPeriod,addGroup,addAssessment,setGrade,updateAssessment,moveAssessment,removeAssessment,setCompetencyLink,addCompetency} from '../src/model.js';
import {categoryGrade,categoryEvidence,overallGrade,competencyGrade} from '../src/calculations.js';
const f=()=>{const d=initialNotebook();return {d,g:d.groups[0],p:d.periods[0],s:d.students[0],c:d.categories[0],a:d.assessments[0],b:d.assessments[1]};};
const close=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} no coincide con ${b}`);

test('migración v0.1 -> v0.2 sin pérdida de identidades ni notas y es idempotente',()=>{
 const {d,g,p,s}=f();const old=structuredClone(d);
 delete old.gradingProfiles;old.schemaVersion=1;old.categories.forEach(c=>delete c.bestCount);old.assessments.forEach(a=>delete a.weight);
 const result=migrateNotebook(old);assert.equal(result.migrated,true);assert.equal(result.doc.schemaVersion,8);
 assert.deepEqual(result.doc.grades,d.grades);assert.deepEqual(result.doc.students,d.students);
 assert.equal(overallGrade(result.doc,s.id,g.id,p.id),7.95);assertModel(result.doc);
 assert.equal(migrateNotebook(result.doc).migrated,false);
});
test('dos periodos de un mismo grupo admiten pesos y reglas diferentes',()=>{
 const {d,g,p,s,c}=f();const next=addPeriod(d,'2.ª evaluación');
 setPeriodCategory(d,g.id,next.id,c.id,{weight:80,rule:'highest'});
 setPeriodCategory(d,g.id,next.id,d.categories[1].id,{weight:10});
 setPeriodCategory(d,g.id,next.id,d.categories[2].id,{weight:10});
 assert.equal(effectiveCategories(d,g.id,p.id)[0].weight,60);
 assert.equal(effectiveCategories(d,g.id,next.id)[0].weight,80);
 assert.equal(effectiveCategories(d,g.id,p.id)[0].rule,'latest_if_highest');
 assert.equal(effectiveCategories(d,g.id,next.id)[0].rule,'highest');
 assert.equal(overallGrade(d,s.id,g.id,p.id),7.95);assertModel(d);
});
test('mismos periodos en distintos grupos tienen configuración independiente',()=>{
 const {d,g,p,c}=f();const other=addGroup(d,'Segundo grupo');
 setPeriodCategory(d,g.id,p.id,c.id,{rule:'last'});
 assert.equal(effectiveCategories(d,other.id,p.id)[0].rule,'latest_if_highest');
});
test('copiar reglas y restaurar los valores predeterminados',()=>{
 const {d,g,p,c}=f();const p2=addPeriod(d,'Extraordinaria');
 setPeriodCategory(d,g.id,p.id,c.id,{weight:55,rule:'best_n',bestCount:3});
 copyPeriodCategories(d,g.id,p.id,p2.id);
 assert.deepEqual(effectiveCategories(d,g.id,p.id).map(({weight,rule,bestCount})=>({weight,rule,bestCount})),effectiveCategories(d,g.id,p2.id).map(({weight,rule,bestCount})=>({weight,rule,bestCount})));
 resetPeriodCategories(d,g.id,p.id);
 assert.equal(effectiveCategories(d,g.id,p.id)[0].weight,60);
 assert.equal(effectiveCategories(d,g.id,p2.id)[0].weight,55);assertModel(d);
});
test('media ponderada por actividad y mejores dos notas',()=>{
 const {d,g,p,s,c,a,b}=f();
 const third=addAssessment(d,{name:'Examen UD3',groupId:g.id,periodId:p.id,categoryId:c.id,maxScore:10,weight:3});
 setGrade(d,s.id,a.id,2);setGrade(d,s.id,b.id,6);setGrade(d,s.id,third.id,10);
 updateAssessment(d,a.id,{weight:2});
 setPeriodCategory(d,g.id,p.id,c.id,{rule:'weighted_mean'});
 close(categoryGrade(d,s.id,c.id,g.id,p.id),(2*2+6*1+10*3)/6);
 setPeriodCategory(d,g.id,p.id,c.id,{rule:'best_n',bestCount:2});
 close(categoryGrade(d,s.id,c.id,g.id,p.id),8);
 setPeriodCategory(d,g.id,p.id,c.id,{rule:'best_n',bestCount:1});
 assert.equal(categoryGrade(d,s.id,c.id,g.id,p.id),10);
});
test('la regla última y última si es la más alta ignoran actividades sin evaluar',()=>{
 const {d,g,p,s,c,a,b}=f();
 const last=addAssessment(d,{name:'Pendiente',groupId:g.id,periodId:p.id,categoryId:c.id,maxScore:10});
 setGrade(d,s.id,a.id,9);setGrade(d,s.id,b.id,7);
 setPeriodCategory(d,g.id,p.id,c.id,{rule:'last'});
 assert.equal(categoryGrade(d,s.id,c.id,g.id,p.id),7);
 setPeriodCategory(d,g.id,p.id,c.id,{rule:'latest_if_highest'});
 assert.equal(categoryGrade(d,s.id,c.id,g.id,p.id),8);
 setGrade(d,s.id,last.id,9.5);
 assert.equal(categoryGrade(d,s.id,c.id,g.id,p.id),9.5);
});
test('recuperación que mejora: sustituye nota sin añadir evidencia nueva',()=>{
 const {d,g,p,s,c,a,b}=f();setGrade(d,s.id,a.id,3);setGrade(d,s.id,b.id,7);
 const r=addAssessment(d,{name:'Recuperación UD1',groupId:g.id,periodId:p.id,categoryId:c.id,maxScore:5,recoveryOf:a.id,recoveryMode:'higher'});
 setGrade(d,s.id,r.id,4.5);
 const detail=categoryEvidence(d,s.id,c.id,g.id,p.id);
 assert.equal(detail.evidence.length,2);assert.equal(detail.evidence[0].value,9);assert.equal(detail.evidence[0].recovery,9);
 assert.equal(detail.grade,7===9?9:8);assertModel(d);
});
test('recuperación que no mejora conserva la primera nota; sustitución obligatoria sí cambia',()=>{
 const {d,g,p,s,c,a}=f();setGrade(d,s.id,a.id,8);
 const r=addAssessment(d,{name:'Recuperación UD1',groupId:g.id,periodId:p.id,categoryId:c.id,maxScore:10,recoveryOf:a.id,recoveryMode:'higher'});
 setGrade(d,s.id,r.id,4);assert.equal(categoryEvidence(d,s.id,c.id,g.id,p.id).evidence[0].value,8);
 // simulamos la opción elegida al crear una recuperación (campo fijo e inmutable)
 r.recoveryMode='replace';assert.equal(categoryEvidence(d,s.id,c.id,g.id,p.id).evidence[0].value,4);
 assertModel(d);
});
test('recuperación sin examen de origen evaluado cuenta como una sola evidencia',()=>{
 const {d,g,p,s,c,a}=f();setGrade(d,s.id,a.id,null);
 const r=addAssessment(d,{name:'Recuperación UD1',groupId:g.id,periodId:p.id,categoryId:c.id,maxScore:10,recoveryOf:a.id});
 setGrade(d,s.id,r.id,6);
 assert.equal(categoryEvidence(d,s.id,c.id,g.id,p.id).evidence[0].value,6);
});
test('editar, mover y eliminar actividad conserva integridad y previene pérdidas no deseadas',()=>{
 const {d,g,p,s,c,a,b}=f();
 const before=d.grades.length;
 updateAssessment(d,a.id,{name:'Evaluación UD1',maxScore:10,weight:2});
 moveAssessment(d,b.id,-1);
 assert.equal(d.assessments.filter(x=>x.groupId===g.id&&x.periodId===p.id).sort((a,b)=>a.order-b.order)[0].id,b.id);
 assert.throws(()=>updateAssessment(d,a.id,{maxScore:1}),/superan/);
 const r=addAssessment(d,{name:'Recu',groupId:g.id,periodId:p.id,categoryId:c.id,recoveryOf:a.id});
 assert.throws(()=>removeAssessment(d,a.id),/primero/);
 assert.throws(()=>updateAssessment(d,a.id,{categoryId:d.categories[1].id}),/recuperación/);
 removeAssessment(d,r.id);removeAssessment(d,a.id);
 assert.equal(d.grades.length,before-d.students.length);assertModel(d);
});
test('competencias siguen enlazadas a categorías con pesos específicos de periodo',()=>{
 const {d,g,p,s,c}=f();const comp=addCompetency(d,'CE nueva');
 setCompetencyLink(d,comp.id,c.id,100);assert.equal(competencyGrade(d,s.id,comp.id,g.id,p.id),8);
 setPeriodCategory(d,g.id,p.id,c.id,{rule:'last'});
 assert.equal(competencyGrade(d,s.id,comp.id,g.id,p.id),8);
});
test('modelo rechaza perfiles duplicados, recuperaciones cruzadas y mejores N inválidos',()=>{
 const {d,g,p,c,a}=f();
 assert.throws(()=>setPeriodCategory(d,g.id,p.id,c.id,{bestCount:0}),/inválidos/);
 setPeriodCategory(d,g.id,p.id,c.id,{rule:'best_n',bestCount:3});
 d.gradingProfiles.push({...d.gradingProfiles[0],id:crypto.randomUUID()});assert.throws(()=>assertModel(d),/duplicado/);d.gradingProfiles.pop();
 const r=addAssessment(d,{name:'Rec',groupId:g.id,periodId:p.id,categoryId:c.id,recoveryOf:a.id});
 r.categoryId=d.categories[2].id;assert.throws(()=>assertModel(d),/recuperación/);
});

test('una copia cifrada v0.1 puede descifrarse, migrarse y volver a cifrarse sin perder datos',async()=>{
 const {createVault,unlockVault,seal,saltFromEnvelope}=await import('../src/vault.js');
 const {d}=f();
 const original=structuredClone(d);original.schemaVersion=1;delete original.gradingProfiles;
 original.assessments.forEach(a=>delete a.weight);original.categories.forEach(c=>delete c.bestCount);
 const password='contraseña-larga-de-prueba';
 const {key,envelope}=await createVault(password,original);
 const opened=await unlockVault(password,envelope);
 const migrated=migrateNotebook(opened.doc);
 const newCipher=await seal(migrated.doc,key,saltFromEnvelope(envelope));
 const restored=await unlockVault(password,newCipher);
 assert.equal(restored.doc.schemaVersion,8);
 assert.deepEqual(restored.doc.grades,original.grades);
 assert.deepEqual(restored.doc.students,original.students);
 assertModel(restored.doc);
});
