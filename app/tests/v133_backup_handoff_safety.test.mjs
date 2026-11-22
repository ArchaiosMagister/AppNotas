import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initialNotebook,assertModel,setGrade} from '../src/model.js';
import {overallGrade,finalGrade} from '../src/calculations.js';
import {createVault,unlockVault} from '../src/vault.js';
import {ensureBookMetadata,markBookChange,createPortableCopy,readBackupFile,compareBookVersions,highRiskImport,canConfirmImport,IMPORT_CONFIRMATION_TEXT} from '../src/cuaderno.js';

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
test('copias antiguas, divergentes y ajenas exigen una confirmación deliberada',()=>{
  assert.equal(IMPORT_CONFIRMATION_TEXT,'SUSTITUIR');
  for(const status of ['older','divergent','different','unknown']){
    assert(highRiskImport(status,true));
    for(const phrase of ['', 'sustituir', ' SUSTITUIR', 'SUSTITUIR '])
      assert.equal(canConfirmImport(status,true,phrase),false,status+' no autorizado');
    assert.equal(canConfirmImport(status,true,'SUSTITUIR'),true);
    assert.equal(highRiskImport(status,false),false);
    assert.equal(canConfirmImport(status,false,''),true);
  }
  for(const status of ['same','newer']){
    assert.equal(highRiskImport(status,true),false);
    assert.equal(canConfirmImport(status,true,''),true);
  }
});
test('la interfaz impide importar accidentalmente una copia arriesgada',async()=>{
  const [app,sw]=await Promise.all(['app.js','sw.js'].map(p=>readFile(new URL('../'+p,import.meta.url),'utf8')));
  assert(app.includes('const risky=highRiskImport(conflict,hasLocal)'));
  assert(app.includes('id="import-risk-phrase"'));
  assert(app.includes('aria-label="Confirmación de sustitución de cuaderno"'));
  assert(app.includes("risky?'disabled':''"));
  assert(app.includes('importButton.disabled=!canConfirmImport(conflict,hasLocal,phrase.value)'));
  assert(app.includes("if(canConfirmImport(conflict,hasLocal,phrase))settle('import')"));
  assert(app.includes('await replaceEnvelopeWithRecovery(STATE.db,replacement,existing)'));
  assert(app.includes('if(!sameEnvelope(existing,STATE.envelope))'));
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
