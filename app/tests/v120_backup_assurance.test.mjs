import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initialNotebook,setGrade,assertModel} from '../src/model.js';
import {ensureBookMetadata,markBookChange,backupProtection,BACKUP_REVIEW_DAYS,
  createPortableCopy,readBackupFile,compareBookVersions} from '../src/cuaderno.js';
import {createVault,unlockVault} from '../src/vault.js';

const start=Date.parse('2026-11-21T18:00:00.000Z');
const book=()=>{const d=initialNotebook();ensureBookMetadata(d);return d;};
const receipt=d=>({version:1,bookId:d.id,head:d._portability.head,exportedAt:new Date(start-120000).toISOString()});

test('política: ausencia de copia, exportación sin verificar y comprobación válida son diferentes',()=>{
  const d=book(),r=receipt(d);
  assert.equal(BACKUP_REVIEW_DAYS,7);
  assert.equal(backupProtection(d,null,start),'missing');
  assert.equal(backupProtection(d,r,start),'unchecked');
  assert.equal(backupProtection(d,{...r,verifiedAt:new Date(start).toISOString()},start),'current');
  assert.equal(backupProtection(d,{...r,verifiedAt:new Date(start-8*86400000).toISOString()},start),'aged');
  assert.equal(backupProtection(d,{...r,verifiedAt:new Date(start-7*86400000).toISOString()},start),'current');
});

test('política: las notas nuevas invalidan la vigencia de la copia externa sin tocar datos',()=>{
  const d=book(),r={...receipt(d),verifiedAt:new Date(start).toISOString()};
  const changed=structuredClone(d);
  setGrade(changed,changed.students[0].id,changed.assessments[0].id,9.75);
  markBookChange(changed,d);
  const snapshot=structuredClone(changed);
  assert.equal(backupProtection(changed,r,start),'modified');
  assert.equal(backupProtection(changed,receipt(d),start),'modified-unchecked');
  assert.deepEqual(changed,snapshot);
  assertModel(changed);
});

test('política: no acepta como verificada una copia de otro cuaderno o una marca futura/alterada',()=>{
  const d=book(),r=receipt(d);
  assert.equal(backupProtection(d,{...r,bookId:'otra-copia',verifiedAt:new Date(start).toISOString()},start),'missing');
  assert.equal(backupProtection(d,{...r,verifiedAt:new Date(start+2000).toISOString()},start),'unchecked');
  assert.equal(backupProtection(d,{...r,verifiedAt:'no es una fecha'},start),'unchecked');
  assert.equal(backupProtection(d,{...r,verifiedAt:undefined},start),'unchecked');
});

test('el archivo portable se puede reabrir, verificar y comparar sin reescribir notas',async()=>{
  const password='Frase de prueba segura para una copia cifrada de Tabularium!';
  const d=book(),snapshot=structuredClone(d);
  const {key,envelope}=await createVault(password,d);
  const {salt}=await unlockVault(password,envelope);
  const copy=await createPortableCopy(d,key,salt,new Date(start));
  const contents=JSON.stringify(copy.file);
  assert(!contents.includes(d.students[0].name));
  const restored=await readBackupFile({size:contents.length,text:async()=>contents},password);
  assert.deepEqual(restored.doc,d);
  assert.equal(compareBookVersions(d,restored.doc),'same');
  const confirmed={version:1,bookId:restored.doc.id,head:restored.doc._portability.head,
    exportedAt:restored.exportedAt,verifiedAt:new Date(start).toISOString()};
  assert.equal(backupProtection(d,confirmed,start),'current');
  assert.deepEqual(d,snapshot);
  await assert.rejects(readBackupFile({size:contents.length,text:async()=>contents},'Clave incorrecta suficientemente larga'),/Contraseña incorrecta|dañados/);
  assert.deepEqual(d,snapshot);
});

test('interfaz: guarda copias portátiles y solo registra verificación sobre revisión idéntica',async()=>{
  const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
  const worker=await readFile(new URL('../sw.js',import.meta.url),'utf8');
  assert(app.includes('id="backup-portable"'));
  assert(app.includes('id="backup-verify"'));
  assert(app.includes("$('#backup-portable')?.addEventListener('click',()=>closeNotebook().catch(fail))"));
  assert(app.includes("compareBookVersions(STATE.doc,opened.doc)!=='same'"));
  assert(app.includes('verifiedAt:new Date().toISOString()'));
  assert(app.includes('await recordExportReceipt(STATE.db,receipt,STATE.envelope)'));
  assert(app.includes('Descargar copia histórica (.cdoc)'));
  const cache=worker.match(/const CACHE='([^']+)'/)?.[1];
  assert(cache&&/^cuaderno-docente-static-v\d+-dev$/.test(cache));
  assert(app.includes("caches.open('"+cache+"')"),'La UI debe comprobar la misma caché que el Service Worker');
});
