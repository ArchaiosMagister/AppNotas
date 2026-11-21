import test from 'node:test';
import assert from 'node:assert/strict';
import {initialNotebook,assertModel,addAssessment,updateAssessment,setGrade,addPeriod,migrateNotebook,createRubric,updateRubric,setRubricGrade,setFinalConfig,setFinalOverride} from '../src/model.js';
import {normalizedScore,categoryGrade,overallGrade,finalGrade,finalEvidence} from '../src/calculations.js';
import {parseRubricText,parseRubricImport} from '../src/rubric-import.js';
const fx=()=>{const d=initialNotebook();return {d,g:d.groups[0],p:d.periods[0],s:d.students[0],ex:d.assessments[0],cat:d.categories[0]};};
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('nuevo modelo actual conserva datos ficticios, seis contenedores y propiedades de escala',()=>{
 const {d}=fx();assert.equal(d.schemaVersion,8);assertModel(d);assert.deepEqual(d.rubrics,[]);assert.deepEqual(d.finalConfigs,[]);assert.deepEqual(d.finalOverrides,[]);
 assert(d.assessments.every(a=>a.convertToTen===true&&a.rubricId===null));
});
test('convertir notas 0–5, 0–3 y 0–10 en el cálculo',()=>{
 const {d,g,p,s,cat}=fx();const a=addAssessment(d,{name:'Mini examen',groupId:g.id,periodId:p.id,categoryId:cat.id,maxScore:5});
 setGrade(d,s.id,a.id,4);assert.equal(normalizedScore(4,5),8);
 const b=addAssessment(d,{name:'Pregunta',groupId:g.id,periodId:p.id,categoryId:cat.id,maxScore:3});setGrade(d,s.id,b.id,2.4);
 close(normalizedScore(2.4,3),8);assert.equal(normalizedScore(7,10),7);
 assertModel(d);
});
test('desactivar conversión usa la nota bruta sin tocar la puntuación guardada',()=>{
 const {d,g,p,s,cat}=fx();d.grades=d.grades.filter(x=>x.studentId!==s.id||!d.assessments.filter(a=>a.categoryId===cat.id).some(a=>a.id===x.assessmentId));
 const a=addAssessment(d,{name:'Escala corta',groupId:g.id,periodId:p.id,categoryId:cat.id,maxScore:5,convertToTen:false});
 setGrade(d,s.id,a.id,4);assert.equal(categoryGrade(d,s.id,cat.id,g.id,p.id),4);
 updateAssessment(d,a.id,{convertToTen:true});assert.equal(categoryGrade(d,s.id,cat.id,g.id,p.id),8);
 assert.equal(d.grades.find(x=>x.assessmentId===a.id&&x.studentId===s.id).score,4);assertModel(d);
});
test('no se permite superar la escala, cambiar rúbrica con notas ni escala inválida',()=>{
 const {d,g,p,s,ex}=fx();const r=createRubric(d,'Expresión',[{name:'Claridad',maxScore:3,weight:1}]);
 assert.throws(()=>addAssessment(d,{name:'Test',groupId:g.id,periodId:p.id,categoryId:ex.categoryId,maxScore:3,rubricId:r.id}),/rúbrica/);
 assert.throws(()=>updateAssessment(d,ex.id,{rubricId:r.id}),/tipo/);
 assert.throws(()=>setGrade(d,s.id,ex.id,20),/entre/);
});
test('rúbrica pondera criterios y convierte puntuaciones a 0–10 sin redondeo parcial',()=>{
 const {d,g,p,s}=fx();const r=createRubric(d,'Trabajo',[{name:'Contenido',maxScore:5,weight:2},{name:'Presentación',maxScore:3,weight:1},{name:'Corrección',maxScore:2,weight:1}]);
 const a=addAssessment(d,{name:'Trabajo con rúbrica',groupId:g.id,periodId:p.id,categoryId:d.categories[1].id,maxScore:10,rubricId:r.id});
 const score=setRubricGrade(d,s.id,a.id,{[r.criteria[0].id]:4,[r.criteria[1].id]:3,[r.criteria[2].id]:1});
 close(score,7.75); // 10*(0.8*2+1+0.5)/4
 const saved=d.grades.find(x=>x.studentId===s.id&&x.assessmentId===a.id);
 assert.equal(saved.rubricRatings.length,3);close(saved.score,7.75);assertModel(d);
 assert.throws(()=>updateRubric(d,r.id,'Otra',[{name:'Nuevo',maxScore:5,weight:1}]),/calificaciones/);
});
test('rúbrica permite cero, rechaza puntos fuera de rango y borrar vuelve a sin evaluar',()=>{
 const {d,g,p,s}=fx(),r=createRubric(d,'Actitud',[{name:'Participación',maxScore:3,weight:1}]);
 const a=addAssessment(d,{name:'Actitud',groupId:g.id,periodId:p.id,categoryId:d.categories[2].id,rubricId:r.id});
 assert.equal(setRubricGrade(d,s.id,a.id,{[r.criteria[0].id]:0}),0);assertModel(d);
 assert.throws(()=>setRubricGrade(d,s.id,a.id,{[r.criteria[0].id]:3.5}),/fuera/);
 setRubricGrade(d,s.id,a.id,null);assert.equal(d.grades.some(x=>x.studentId===s.id&&x.assessmentId===a.id),false);
});
test('una rúbrica con notas no se puede eliminar o reasignar silenciosamente',()=>{
 const {d,g,p,s}=fx(),r=createRubric(d,'Criterios',[{name:'C',maxScore:5,weight:1}]);
 const a=addAssessment(d,{name:'Rubricada',groupId:g.id,periodId:p.id,categoryId:d.categories[2].id,rubricId:r.id});
 setRubricGrade(d,s.id,a.id,{[r.criteria[0].id]:4});
 assert.throws(()=>updateAssessment(d,a.id,{rubricId:null}),/tipo/);
 const bad=structuredClone(d);bad.rubrics=[];assert.throws(()=>assertModel(bad));
});
test('importación JSON y CSV; creación textual de criterios',()=>{
 const c=parseRubricText('Contenido | 5 | 2\nPresentación | 3 | 1');assert.equal(c[0].maxScore,5);assert.equal(c[1].weight,1);
 const json=parseRubricImport('{"name":"Trabajo","criteria":[{"name":"Fondo","maxScore":5,"weight":2}]}','trabajo.json');assert.equal(json.name,'Trabajo');assert.equal(json.criteria[0].weight,2);
 const csv=parseRubricImport('criterio;maximo;peso\nContenido;5;2\nPresentación;3;1','Trabajo escrito.csv');assert.equal(csv.criteria[1].maxScore,3);
 assert.throws(()=>parseRubricImport('criterio;maximo\nPresentación;0','x.csv'));assert.throws(()=>parseRubricText('Sin escala'));
});
test('evaluación final automática toma la nota sin redondeos intermedios',()=>{
 const {d,g,p,s}=fx();const p2=addPeriod(d,'2.ª evaluación');
 const a=addAssessment(d,{name:'Examen 2',groupId:g.id,periodId:p2.id,categoryId:d.categories[0].id});setGrade(d,s.id,a.id,9);
 close(overallGrade(d,s.id,g.id,p.id),7.95);close(overallGrade(d,s.id,g.id,p2.id),9);
 close(finalGrade(d,s.id,g.id),(7.95+9)/2);assertModel(d);
});
test('evaluación final ponderada y periodos sin evaluar renormalizados',()=>{
 const {d,g,p,s}=fx(),p2=addPeriod(d,'2.ª evaluación'),p3=addPeriod(d,'3.ª evaluación');
 const a=addAssessment(d,{name:'Examen',groupId:g.id,periodId:p2.id,categoryId:d.categories[0].id});setGrade(d,s.id,a.id,9);
 setFinalConfig(d,g.id,{rule:'weighted_mean',weights:{[p.id]:30,[p2.id]:70,[p3.id]:50}});
 close(finalGrade(d,s.id,g.id),(7.95*30+9*70)/100);assertModel(d);
});
test('se puede excluir un periodo del cálculo anual sin borrar sus notas',()=>{
 const {d,g,s}=fx(),p2=addPeriod(d,'Extraordinaria');
 setFinalOverride(d,s.id,p2.id,10);close(finalGrade(d,s.id,g.id),(7.95+10)/2);
 setFinalConfig(d,g.id,{excludedPeriodIds:[p2.id]});assert.equal(finalGrade(d,s.id,g.id),7.95);assertModel(d);
});
test('último periodo gana si tiene mayor nota; si no, media',()=>{
 const {d,g,s}=fx(),p2=addPeriod(d,'2.ª evaluación');
 const a=addAssessment(d,{name:'Examen',groupId:g.id,periodId:p2.id,categoryId:d.categories[0].id});
 setGrade(d,s.id,a.id,9);setFinalConfig(d,g.id,{rule:'latest_if_highest'});assert.equal(finalGrade(d,s.id,g.id),9);
 setGrade(d,s.id,a.id,6);close(finalGrade(d,s.id,g.id),(7.95+6)/2);
});
test('nota manual en periodo tiene preferencia y al borrarla vuelve a automática',()=>{
 const {d,g,p,s}=fx(),prev=overallGrade(d,s.id,g.id,p.id);
 setFinalOverride(d,s.id,p.id,8.6);assert.equal(finalGrade(d,s.id,g.id),8.6);
 const evidence=finalEvidence(d,s.id,g.id);assert.equal(evidence.evidence[0].automatic,prev);assert.equal(evidence.evidence[0].manual,8.6);
 setFinalOverride(d,s.id,p.id,null);assert.equal(finalGrade(d,s.id,g.id),prev);assertModel(d);
});
test('nota manual cero es distinta de ausencia y no admite duplicados',()=>{
 const {d,g,p,s}=fx();setFinalOverride(d,s.id,p.id,0);assert.equal(finalGrade(d,s.id,g.id),0);
 setFinalOverride(d,s.id,p.id,4);assert.equal(d.finalOverrides.length,1);
 assert.throws(()=>setFinalOverride(d,s.id,p.id,11));assertModel(d);
});
test('migración v4 conserva IDs, notas y colores personalizados, activa conversión existente',()=>{
 const {d,g,p,s}=fx(),old=structuredClone(d);old.schemaVersion=4;delete old.rubrics;delete old.finalConfigs;delete old.finalOverrides;
 old.assessments.forEach(a=>{delete a.convertToTen;delete a.rubricId;});
 old.settings.subjectAccents['1bach:Latín I']='#123ABC';
 const migrated=migrateNotebook(old);assert.equal(migrated.doc.schemaVersion,8);assert.deepEqual(migrated.doc.grades,d.grades);assert.deepEqual(migrated.doc.students,d.students);
 assert.equal(migrated.doc.settings.subjectAccents['1bach:Latín I'],'#123ABC');
 assert.equal(overallGrade(migrated.doc,s.id,g.id,p.id),7.95);assertModel(migrated.doc);
 assert.equal(migrateNotebook(migrated.doc).migrated,false);
});
test('invariantes protegen rúbricas y configuraciones finales alteradas',()=>{
 const {d,g,p,s}=fx();setFinalConfig(d,g.id,{rule:'mean'});assertModel(d);
 d.finalConfigs[0].weights['inexistente']=1;assert.throws(()=>assertModel(d),/final/);
 delete d.finalConfigs[0].weights['inexistente'];setFinalOverride(d,s.id,p.id,7);
 d.finalOverrides.push({...d.finalOverrides[0],id:crypto.randomUUID()});assert.throws(()=>assertModel(d),/duplicad|inválida/);
});
