import test from 'node:test';
import assert from 'node:assert/strict';
import {initialNotebook,ensureBookMetadata,setGrade,assertModel} from '../app/src/model.js';
import {createVault,seal,unlockVault,saltFromEnvelope} from '../app/src/vault.js';
import {createPortableCopy,readBackupFile,compareBookVersions} from '../app/src/cuaderno.js';

const password='Frase de paso ficticia para pruebas 2026 única!';
const originalOrigin='https://archaiosmagister.github.io';
const futureOrigin='https://appnotas-aislada.pages.dev';

test('migración entre orígenes aislados: exportar, importar y validar todo el cuaderno',async()=>{
  assert.notEqual(new URL(originalOrigin).origin,new URL(futureOrigin).origin);
  const notebook=initialNotebook();
  ensureBookMetadata(notebook);
  const s=notebook.students[0],a=notebook.assessments[0];
  setGrade(notebook,s.id,a.id,9.25);
  assertModel(notebook);
  const {key,envelope}=await createVault(password,notebook);
  const oldBrowser=new Map([['main',envelope]]);
  const newBrowser=new Map();
  assert.equal(newBrowser.get('main'),undefined,'IndexedDB no se transfiere por cambiar de origen');
  const backup=await createPortableCopy(notebook,key,saltFromEnvelope(envelope));
  const serialized=JSON.stringify(backup.file);
  assert.ok(!serialized.includes(s.name),'El archivo portátil no expone el nombre en claro');
  const imported=await readBackupFile({size:serialized.length,text:async()=>serialized},password);
  assert.deepEqual(imported.doc,notebook);
  assert.equal(compareBookVersions(notebook,imported.doc),'same');
  const restored=await seal(imported.doc,imported.key,imported.salt);
  newBrowser.set('main',restored);
  const verified=await unlockVault(password,newBrowser.get('main'));
  assertModel(verified.doc);
  assert.deepEqual(verified.doc,notebook,'Calificaciones, grupos, rúbricas, reglas y agenda coinciden');
  assert.deepEqual((await unlockVault(password,oldBrowser.get('main'))).doc,notebook,
    'La versión antigua no se borra ni altera durante la migración');
});

test('migración entre orígenes: contraseña errónea o contenido dañado no sustituye el destino',async()=>{
  const doc=initialNotebook();
  ensureBookMetadata(doc);
  const {key,envelope}=await createVault(password,doc);
  const exported=await createPortableCopy(doc,key,saltFromEnvelope(envelope));
  const serialized=JSON.stringify(exported.file);
  const target=new Map();
  const open=secret=>readBackupFile({size:serialized.length,text:async()=>serialized},secret);
  await assert.rejects(open('Clave equivocada para el otro navegador'),/Contraseña incorrecta/);
  assert.equal(target.get('main'),undefined);
  const corrupt=JSON.parse(serialized);
  corrupt.vault.data=corrupt.vault.data.slice(0,-4)+'AAAA';
  await assert.rejects(readBackupFile({
    size:JSON.stringify(corrupt).length,text:async()=>JSON.stringify(corrupt)
  },password),/Contraseña incorrecta|dañados/);
  assert.equal(target.get('main'),undefined);
});
