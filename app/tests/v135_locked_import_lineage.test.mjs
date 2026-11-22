import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initialNotebook,setGrade} from '../src/model.js';
import {createVault,unlockVault} from '../src/vault.js';
import {
  ensureBookMetadata,markBookChange,compareBackupAgainstLocal,
  createPortableCopy,readBackupFile,importRiskLevel,canConfirmImport
} from '../src/cuaderno.js';

const password='Frase ficticia robusta y compartida entre los dos dispositivos';
const make=()=>{const doc=initialNotebook();ensureBookMetadata(doc);return doc;};
const edited=(source,index=0,score=8.75)=>{
  const doc=structuredClone(source);
  setGrade(doc,doc.students[index].id,doc.assessments[0].id,score);
  markBookChange(doc,source);
  return doc;
};
async function copyOf(doc){
  const {key,envelope}=await createVault(password,doc);
  const {salt}=await unlockVault(password,envelope);
  const copy=await createPortableCopy(doc,key,salt);
  const text=JSON.stringify(copy.file);
  return {file:{name:'Tabularium_2026-11-22_093527.cuaderno',size:Buffer.byteLength(text),text:async()=>text},envelope};
}
test('importación bloqueada iPad → iPhone: misma contraseña y revisión posterior no piden SUSTITUIR',async()=>{
  const local=make(),newer=edited(edited(local),1,6.25);
  const {envelope}=await createVault(password,local);
  const old=structuredClone(envelope);
  const {file}=await copyOf(newer);
  const received=await readBackupFile(file,password);
  const status=await compareBackupAgainstLocal(null,envelope,received.doc,password);
  assert.equal(status,'newer');
  assert.equal(importRiskLevel(status,true),0);
  assert.equal(canConfirmImport(status,true),true);
  assert.deepEqual(envelope,old);
  assert.equal(received.doc._portability.revision,newer._portability.revision);
});
test('importación bloqueada de versión anterior exige casilla',async()=>{
  const old=make(),local=edited(old);
  const {envelope}=await createVault(password,local);
  const status=await compareBackupAgainstLocal(null,envelope,old,password);
  assert.equal(status,'older');
  assert.equal(importRiskLevel(status,true),1);
  assert.equal(canConfirmImport(status,true),false);
  assert.equal(canConfirmImport(status,true,{accepted:true}),true);
});
test('copia idéntica con cuaderno bloqueado se conserva sin reemplazo',async()=>{
  const local=edited(make()),{envelope}=await createVault(password,local);
  const status=await compareBackupAgainstLocal(null,envelope,structuredClone(local),password);
  assert.equal(status,'same');
  assert.equal(canConfirmImport(status,true,{phrase:'SUSTITUIR'}),false);
});
test('ramas divergentes desde un antecedente común exigen casilla aun bloqueadas',async()=>{
  const root=make(),ipad=edited(root,0,4),iphone=edited(root,1,9);
  const {envelope}=await createVault(password,ipad);
  const status=await compareBackupAgainstLocal(null,envelope,iphone,password);
  assert.equal(status,'divergent');
  assert.equal(importRiskLevel(status,true),1);
  assert.equal(canConfirmImport(status,true,{phrase:'SUSTITUIR'}),false);
});
test('cuaderno distinto sigue exigiendo frase exacta al estar bloqueado',async()=>{
  const local=make(),other=make();
  const {envelope}=await createVault(password,local);
  const status=await compareBackupAgainstLocal(null,envelope,other,password);
  assert.equal(status,'different');
  assert.equal(importRiskLevel(status,true),2);
  assert.equal(canConfirmImport(status,true,{phrase:'sustituir'}),false);
  assert.equal(canConfirmImport(status,true,{phrase:'SUSTITUIR'}),true);
});
test('distinta contraseña local impide dar una garantía falsa de versión posterior',async()=>{
  const local=make(),incoming=edited(local);
  const {envelope}=await createVault('Otra contraseña ficticia de dispositivo local',local);
  const before=structuredClone(envelope);
  const status=await compareBackupAgainstLocal(null,envelope,incoming,password);
  assert.equal(status,'unknown');
  assert.equal(importRiskLevel(status,true),2);
  assert.equal(canConfirmImport(status,true,{accepted:true}),false);
  assert.deepEqual(envelope,before);
});
test('copia local histórica sin metadatos no presume una historia verificable',async()=>{
  const local=initialNotebook(),incoming=structuredClone(local);
  ensureBookMetadata(incoming); const {envelope}=await createVault(password,local);
  const status=await compareBackupAgainstLocal(null,envelope,incoming,password);
  assert.equal(status,'unknown');
  assert.equal(importRiskLevel(status,true),2);
});
test('sin cuaderno previo se importa normalmente',async()=>{
  const status=await compareBackupAgainstLocal(null,null,make(),password);
  assert.equal(status,'empty');
  assert.equal(canConfirmImport(status,false,{}),true);
});
test('el código de restauración usa la comparación tras descifrar con la contraseña proporcionada',async()=>{
  const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
  const source=await readFile(new URL('../src/cuaderno.js',import.meta.url),'utf8');
  assert(app.includes('const conflict=await compareBackupAgainstLocal(originalLocalDoc,existing,opened.doc,password)'));
  assert(source.includes('const local=await unlockVault(password,localEnvelope)'));
  assert(source.includes("return 'unknown';"));
  assert(app.includes('await replaceEnvelopeWithRecovery(STATE.db,replacement,existing)'));
});
