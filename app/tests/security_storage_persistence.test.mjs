import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {storagePersistence} from '../src/pwa-controls.js';

test('almacenamiento local: protección concedida, denegada y API ausente',async()=>{
  assert.equal(await storagePersistence(null),'unsupported');
  assert.equal(await storagePersistence({persisted:async()=>true}),'persistent');
  assert.equal(await storagePersistence({persisted:async()=>false}),'best-effort');
  assert.equal(await storagePersistence({persisted:async()=>{throw Error('test');}}),'unavailable');
  assert.equal(await storagePersistence({persisted:async()=>null}),'unavailable');
});
test('solicitud de persistencia solo tras una acción explícita',async()=>{
  let checked=0,requested=0;
  const storage={persisted:async()=>{checked++;return false;},persist:async()=>{requested++;return true;}};
  assert.equal(await storagePersistence(storage,false),'best-effort');
  assert.deepEqual([checked,requested],[1,0]);
  assert.equal(await storagePersistence(storage,true),'persistent');
  assert.deepEqual([checked,requested],[1,1]);
  assert.equal(await storagePersistence({persisted:async()=>true},true),'unsupported');
});
test('el aviso del origen compartido figura en la vista de Ajustes',async()=>{
  const source=await readFile(new URL('../app.js',import.meta.url),'utf8');
  assert(source.includes("location.hostname==='archaiosmagister.github.io'"));
  assert(source.includes('comparten origen y acceso al almacenamiento del navegador'));
  assert(source.includes('No introduzcas datos reales hasta alojar AppNotas en un origen independiente'));
  assert(source.includes('id="storage-check"'));
  assert(source.includes('id="storage-protect"'));
  assert(source.includes('void reportStorageProtection(false)'));
});
test('la nueva caché PWA coincide con el comprobador offline',async()=>{
  const [app,sw]=await Promise.all(['app.js','sw.js'].map(path=>readFile(new URL('../'+path,import.meta.url),'utf8')));
  const cache=sw.match(/const CACHE='(cuaderno-docente-static-v(\d+)-dev)'/)?.[1];
  assert(cache,'El service worker debe declarar una caché versionada');
  assert(Number(cache.match(/v(\d+)-dev/)[1])>=121,'No reutilizar una caché anterior');
  assert(app.includes("caches.open('"+cache+"')"),'La UI debe utilizar exactamente la misma caché');
});
