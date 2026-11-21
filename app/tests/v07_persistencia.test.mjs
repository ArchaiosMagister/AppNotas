import test from 'node:test';
import assert from 'node:assert/strict';
import {initialNotebook,assertModel,setGrade,addPeriod,addAssessment,setFinalConfig,setFinalOverride} from '../src/model.js';
import {createVault,seal,unlockVault,saltFromEnvelope} from '../src/vault.js';
import {envelopeFingerprint,makeReloadProbe,evaluateReloadProbe,RELOAD_PROBE_KEY} from '../src/diagnostics.js';
import {categoryGrade,overallGrade,finalGrade} from '../src/calculations.js';

const password='Clave ficticia de auditoría 2026, solo prueba local';

test('v0.7: la huella es estable para una copia estructural y no contiene información personal',async()=>{
 const doc=initialNotebook();const {envelope}=await createVault(password,doc);
 const hash=await envelopeFingerprint(envelope);
 assert.match(hash,/^[a-f0-9]{64}$/);
 assert.equal(hash,await envelopeFingerprint(structuredClone(envelope)));
 assert(!hash.includes(doc.students[0].name));
 assert.equal(RELOAD_PROBE_KEY,'cuaderno-docente-reload-probe-v1');
});

test('v0.7: guardado y recarga conservan exactamente el sobre cifrado, y desbloquear valida el modelo',async()=>{
 const doc=initialNotebook();setGrade(doc,doc.students[0].id,doc.assessments[0].id,7.25);
 const {envelope}=await createVault(password,doc);
 const probe=await makeReloadProbe(envelope,100_000);
 // Simula serialización persistente entre recargas, NO la implementación real de IndexedDB.
 const reloaded=JSON.parse(JSON.stringify(envelope));
 assert.deepEqual(await evaluateReloadProbe(probe,reloaded,100_001),{ok:true,reason:'matched'});
 const {doc:opened}=await unlockVault(password,reloaded);
 assertModel(opened);
 assert.deepEqual(opened.grades,doc.grades);
 assert.equal(overallGrade(opened,opened.students[0].id,opened.groups[0].id,opened.periods[0].id),overallGrade(doc,doc.students[0].id,doc.groups[0].id,doc.periods[0].id));
});

test('v0.7: las notas cambiadas después del test invalidan la huella antigua sin acusar pérdida',async()=>{
 const doc=initialNotebook(), {key,envelope}=await createVault(password,doc), probe=await makeReloadProbe(envelope,200_000);
 const changed=structuredClone(doc);
 setGrade(changed,changed.students[0].id,changed.assessments[0].id,9);
 const saved=await seal(changed,key,saltFromEnvelope(envelope));
 assert.deepEqual(await evaluateReloadProbe(probe,saved,200_001),{ok:false,reason:'changed'});
 const {doc:opened}=await unlockVault(password,saved);
 assertModel(opened);assert.equal(opened.grades.find(g=>g.studentId===doc.students[0].id&&g.assessmentId===doc.assessments[0].id).score,9);
});

test('v0.7: al eliminar IndexedDB, el diagnóstico no comunica falsamente éxito',async()=>{
 const {envelope}=await createVault(password,initialNotebook()),probe=await makeReloadProbe(envelope,10);
 assert.deepEqual(await evaluateReloadProbe(probe,null,11),{ok:false,reason:'missing'});
});

test('v0.7: marcador caducado, malformado o de reloj incoherente se rechaza',async()=>{
 const {envelope}=await createVault(password,initialNotebook()),probe=await makeReloadProbe(envelope,10);
 assert.deepEqual(await evaluateReloadProbe(probe,envelope,10+31*60*1000),{ok:false,reason:'expired'});
 assert.deepEqual(await evaluateReloadProbe(probe,envelope,9),{ok:false,reason:'expired'});
 assert.deepEqual(await evaluateReloadProbe({version:1,digest:'ab',createdAt:10},envelope,11),{ok:false,reason:'invalid'});
 assert.deepEqual(await evaluateReloadProbe(JSON.parse('{"version":0}'),envelope,11),{ok:false,reason:'invalid'});
 await assert.rejects(envelopeFingerprint(null),/copia cifrada/);
});

test('v0.7: recuperar el respaldo cifra intacta notas, rúbricas y configuración anual',async()=>{
 const doc=initialNotebook(), groupId=doc.groups[0].id, studentId=doc.students[0].id;
 const period=addPeriod(doc,'Segunda evaluación');
 setFinalConfig(doc,groupId,{rule:'weighted_mean',weights:{[doc.periods[0].id]:1,[period.id]:3}});
 const exam=doc.assessments.find(a=>a.categoryId===doc.categories[0].id);
 const act=addAssessment(doc,{name:'Examen ficticio',groupId,periodId:period.id,categoryId:exam.categoryId});
 setGrade(doc,studentId,act.id,5.25);
 setFinalOverride(doc,studentId,period.id,6.75);
 assertModel(doc);
 const expected=finalGrade(doc,studentId,groupId);
 const {envelope:backup}=await createVault(password,doc);
 const {doc:recovered}=await unlockVault(password,JSON.parse(JSON.stringify(backup)));
 assertModel(recovered);
 assert.deepEqual(recovered,doc);
 assert.equal(finalGrade(recovered,studentId,groupId),expected);
 assert.equal(recovered.finalOverrides.length,doc.finalOverrides.length);
});

test('v0.7: la huella de una restauración válida no equivale a la de una versión anterior',async()=>{
 const original=initialNotebook(), {key,envelope}=await createVault(password,original), probe=await makeReloadProbe(envelope,100);
 const change=structuredClone(original);setGrade(change,change.students[0].id,change.assessments[1].id,0);
 const replacement=await seal(change,key,saltFromEnvelope(envelope));
 assert.notEqual(await envelopeFingerprint(replacement),await envelopeFingerprint(envelope));
 assert.deepEqual(await evaluateReloadProbe(probe,replacement,102),{ok:false,reason:'changed'});
 assert.deepEqual(await evaluateReloadProbe(await makeReloadProbe(replacement,103),replacement,104),{ok:true,reason:'matched'});
});

// Oráculo de muestreo reproducible: medias en escalas heterogéneas y categorías con datos vacíos.
test('v0.7: 1600 combinaciones reproducibles de escalas y categorías respetan la media independiente',()=>{
 let seed=17062026;
 const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
 const doc=initialNotebook(),st=doc.students[0],g=doc.groups[0],period=doc.periods[0];
 const exams=doc.assessments.filter(a=>a.categoryId===doc.categories[0].id);
 let checked=0;
 for(let i=0;i<1600;i++){
   const scores=[];
   doc.grades=doc.grades.filter(x=>x.studentId!==st.id);
   exams.forEach((a,j)=>{
     const max=[3,5,10,20,100][Math.floor(rand()*5)];
     const score=Math.round(rand()*max*100)/100;
     a.maxScore=max;a.convertToTen=true;
     if(rand()>.2){doc.grades.push({id:`test-${i}-${j}`,studentId:st.id,assessmentId:a.id,score});scores.push({index:j,value:10*score/max});}
   });
   const expected=!scores.length?null:scores.at(-1).index===exams.length-1 && scores.at(-1).value>=Math.max(...scores.map(x=>x.value))?scores.at(-1).value:scores.reduce((s,x)=>s+x.value,0)/scores.length;
   const actual=categoryGrade(doc,st.id,doc.categories[0].id,g.id,period.id);
   if(expected===null)assert.equal(actual,null);
   else assert(Math.abs(actual-expected)<1e-10,`iteración ${i}: ${actual} !== ${expected}`);
   checked++;
 }
 assert.equal(checked,1600);
});
