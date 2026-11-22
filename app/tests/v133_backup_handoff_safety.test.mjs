import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initialNotebook,assertModel,setGrade} from '../src/model.js';
import {overallGrade,finalGrade} from '../src/calculations.js';
import {createVault,unlockVault} from '../src/vault.js';
import {ensureBookMetadata,markBookChange,createPortableCopy,readBackupFile,compareBookVersions,importRiskLevel,highRiskImport,canConfirmImport,IMPORT_CONFIRMATION_TEXT} from '../src/cuaderno.js';

const password='Frase ficticia segura para probar los dos dispositivos 2026';
function changed(doc,index,score){
  const next=structuredClone(doc);
  setGrade(next,next.students[index].id,next.assessments[0].id,score);
  markBookChange(next,doc);
  assertModel(next);
  return next;
}
function metrics(doc){
  const result=[];
  for(const student of doc.students){
    const group=doc.groups.find(g=>g.id===student.groupId);
    for(const period of doc.periods)result.push(overallGrade(doc,student.id,group.id,period.id));
    result.push(finalGrade(doc,student.id,group.id));
  }
  return result;
}
async function portable(doc,key,salt){
  const copy=await createPortableCopy(doc,key,salt);
  const bytes=JSON.stringify(copy.file);
  return {copy,file:{size:Buffer.byteLength(bytes),text:async()=>bytes}};
}
test('iPad → iPhone → iPad conserva registros y cálculos',async()=>{
  const initial=initialNotebook();ensureBookMetadata(initial);
  const ipad=changed(initial,0,7.25),originalIpad=structuredClone(ipad);
  const {key,envelope}=await createVault(password,ipad);
  const {salt}=await unlockVault(password,envelope);
  const first=await portable(ipad,key,salt);
  const fromIpad=await readBackupFile(first.file,password);
  assert.deepEqual(fromIpad.doc,ipad);
  assert.deepEqual(metrics(fromIpad.doc),metrics(ipad));
  assert.equal(compareBookVersions(initial,fromIpad.doc),'newer');
  const iphone=changed(fromIpad.doc,1,8.5);
  const second=await portable(iphone,fromIpad.key,fromIpad.salt);
  const fromIphone=await readBackupFile(second.file,password);
  assert.deepEqual(fromIphone.doc,iphone);
  assert.deepEqual(metrics(fromIphone.doc),metrics(iphone));
  assert.equal(compareBookVersions(ipad,fromIphone.doc),'newer');
  assert.equal(compareBookVersions(iphone,ipad),'older');
  const third=await portable(fromIphone.doc,fromIphone.key,fromIphone.salt);
  const returnedToIpad=await readBackupFile(third.file,password);
  assert.deepEqual(returnedToIpad.doc,iphone);
  assert.deepEqual(metrics(returnedToIpad.doc),metrics(iphone));
  assert.equal(compareBookVersions(ipad,returnedToIpad.doc),'newer');
  for(const part of ['groups','students','assessments','grades','categories','rubrics',
    'competencies','gradingProfiles','finalConfigs','finalOverrides','settings','planner'])
    assert.deepEqual(returnedToIpad.doc[part],iphone[part],part);
  assert.deepEqual(ipad,originalIpad);
});
test('copias divergentes entre dispositivos se detectan aunque sean válidas',()=>{
  const original=initialNotebook();ensureBookMetadata(original);
  const snapshot=structuredClone(original);
  const ipad=changed(original,0,4.5),iphone=changed(original,1,9.25);
  assert.equal(compareBookVersions(ipad,iphone),'divergent');
  assert.equal(compareBookVersions(iphone,ipad),'divergent');
  assert.deepEqual(original,snapshot);
});
test('niveles de confirmación: importación cotidiana sin bloqueos y riesgo proporcionado',()=>{
  assert.equal(IMPORT_CONFIRMATION_TEXT,'SUSTITUIR');
  for(const status of ['empty','newer']){
    assert.equal(importRiskLevel(status,status==='newer'),0);
    assert.equal(highRiskImport(status,status==='newer'),false);
    assert.equal(canConfirmImport(status,status==='newer'),true);
  }
  assert.equal(canConfirmImport('same',true),false);
  assert.equal(importRiskLevel('same',true),0);
  assert.equal(highRiskImport('same',true),false);
  for(const status of ['older','divergent']){
    assert.equal(importRiskLevel(status,true),1);
    assert.equal(highRiskImport(status,true),true);
    assert.equal(canConfirmImport(status,true,{}),false);
    assert.equal(canConfirmImport(status,true,{phrase:'SUSTITUIR'}),false);
    assert.equal(canConfirmImport(status,true,{accepted:true}),true);
  }
  for(const status of ['different','unknown','unexpected']){
    assert.equal(importRiskLevel(status,true),2);
    assert.equal(canConfirmImport(status,true,{accepted:true}),false);
    for(const phrase of ['', 'sustituir', ' SUSTITUIR', 'SUSTITUIR '])
      assert.equal(canConfirmImport(status,true,{phrase}),false);
    assert.equal(canConfirmImport(status,true,{phrase:'SUSTITUIR'}),true);
  }
});
test('la interfaz revalida la autorización sin depender del aspecto del botón',async()=>{
  const [app,sw]=await Promise.all(['app.js','sw.js'].map(p=>readFile(new URL('../'+p,import.meta.url),'utf8')));
  assert(app.includes('const riskLevel=importRiskLevel(conflict,hasLocal)'));
  assert(app.includes('id="import-risk-accept"'));
  assert(app.includes('Entiendo que voy a sustituir la versión local y que podría perder cambios posteriores'));
  assert(app.includes('id="import-risk-phrase"'));
  assert(app.includes('aria-label="Confirmación de sustitución de cuaderno"'));
  assert(app.includes('importButton.disabled=!canConfirmImport(conflict,hasLocal,approval())'));
  assert(app.includes('if(!canConfirmImport(conflict,hasLocal,currentApproval))return'));
  assert(app.includes('if(!canConfirmImport(conflict,!!existing,choice))'));
  assert(app.includes('if(STATE.doc!==originalLocalDoc||!sameEnvelope(STATE.envelope,existing))'));
  assert(app.includes('await replaceEnvelopeWithRecovery(STATE.db,replacement,existing)'));
  assert(app.includes("const identical=conflict==='same'"));
  assert(app.includes("identical?'':"));
  assert(app.includes('await STATE.mutationQueue;await STATE.saveQueue'));
  assert(sw.includes("const CACHE='cuaderno-docente-static-v133-dev'"));
  assert(app.includes("caches.open('cuaderno-docente-static-v133-dev')"));
});
test('contraseña incorrecta y archivo alterado no generan contenido restaurable',async()=>{
  const notebook=initialNotebook();ensureBookMetadata(notebook);
  const {key,envelope}=await createVault(password,notebook);
  const {salt}=await unlockVault(password,envelope);
  const {copy,file}=await portable(notebook,key,salt);
  const original=structuredClone(notebook),corrupt=structuredClone(copy.file);
  corrupt.vault.data=corrupt.vault.data.slice(0,-4)+'xxxx';
  const source=JSON.stringify(corrupt);
  await assert.rejects(readBackupFile({size:Buffer.byteLength(source),text:async()=>source},password));
  await assert.rejects(readBackupFile(file,'Una contraseña falsa y lo bastante larga'));
  assert.deepEqual(notebook,original);
});
