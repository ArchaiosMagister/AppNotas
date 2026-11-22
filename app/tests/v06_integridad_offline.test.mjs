import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {initialNotebook,assertModel,setGrade} from '../src/model.js';
import {createVault,seal,unlockVault,saltFromEnvelope} from '../src/vault.js';
import {readEnvelope,writeEnvelope,sameEnvelope,EnvelopeConflictError} from '../src/storage.js';

/** Simulador DETERMINISTA de transacciones serializadas de IndexedDB.
 * NO es un navegador real: verifica contratos, rechazo de carreras y lógica. */
function makeMemoryDb(){
  let record=null,locked=false;
  const waiting=[];
  function next(){if(locked||!waiting.length)return;locked=true;const tx=waiting.shift();tx.active=true;tx.pump();}
  const db={
    transaction(store,mode){
      assert.equal(store,'vault');
      assert(['readonly','readwrite'].includes(mode));
      const t={oncomplete:null,onabort:null,onerror:null,error:null,active:false,aborted:false,ops:[],busy:false,
        objectStore(name){assert.equal(name,'vault');return {
          get(key){assert.equal(key,'main');const req={result:undefined,onsuccess:null,onerror:null};t.ops.push(()=>{req.result=structuredClone(record);req.onsuccess?.();});t.pump();return req;},
          put(value,key){assert.equal(mode,'readwrite');assert.equal(key,'main');t.ops.push(()=>{record=structuredClone(value);});t.pump();}
        };},
        pump(){if(!t.active||t.busy||t.aborted)return;t.busy=true;queueMicrotask(()=>{t.busy=false;if(t.aborted)return;
          if(t.ops.length){t.ops.shift()();t.pump();}
          else {t.active=false;locked=false;t.oncomplete?.();next();}
        });},
        abort(){t.aborted=true;t.ops.length=0;t.active=false;locked=false;t.onabort?.();next();}
      };
      waiting.push(t);queueMicrotask(next);return t;
    },
    readRaw(){return structuredClone(record);}
  };
  return db;
}

const pass='Una clave de demostración que es muy larga 2026';

test('v0.6: la primera escritura exige almacén vacío; otra pestaña no puede crear segundo cuaderno',async()=>{
 const db=makeMemoryDb(), a=await createVault(pass,initialNotebook()), b=await createVault(pass,initialNotebook());
 const outcomes=await Promise.allSettled([writeEnvelope(db,a.envelope,null),writeEnvelope(db,b.envelope,null)]);
 assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(outcomes.filter(x=>x.status==='rejected').length,1);
 assert(outcomes.find(x=>x.status==='rejected').reason instanceof EnvelopeConflictError);
 assert(sameEnvelope(db.readRaw(),a.envelope)||sameEnvelope(db.readRaw(),b.envelope));
});

test('v0.6: dos pestañas no pisan notas: segunda recibe conflicto y el cifrado primero permanece',async()=>{
 const db=makeMemoryDb(), initial=initialNotebook(),{key,envelope}=await createVault(pass,initial);
 await writeEnvelope(db,envelope,null);
 const a=structuredClone(initial),b=structuredClone(initial);
 setGrade(a,a.students[0].id,a.assessments[0].id,8);
 setGrade(b,b.students[0].id,b.assessments[0].id,3);
 const salt=saltFromEnvelope(envelope),changeA=await seal(a,key,salt),changeB=await seal(b,key,salt);
 const results=await Promise.allSettled([writeEnvelope(db,changeA,envelope),writeEnvelope(db,changeB,envelope)]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(results.filter(x=>x.status==='rejected').length,1);
 assert.equal(results.find(x=>x.status==='rejected').reason.code,'ENVELOPE_CONFLICT');
 const saved=await unlockVault(pass,await readEnvelope(db));assertModel(saved.doc);
 const kept=saved.doc.grades.find(g=>g.studentId===a.students[0].id&&g.assessmentId===a.assessments[0].id);
 assert([3,8].includes(kept.score));
 assert(sameEnvelope(await readEnvelope(db),changeA)||sameEnvelope(await readEnvelope(db),changeB));
});

test('v0.6: un guardado con versión actual permite guardar y descifrar sin modificar el modelo',async()=>{
 const db=makeMemoryDb(), initial=initialNotebook(),{key,envelope}=await createVault(pass,initial);
 await writeEnvelope(db,envelope,null);
 const doc=structuredClone(initial);doc.students[0].name='Alumno ficticio corregido';
 const changed=await seal(doc,key,saltFromEnvelope(envelope));
 await writeEnvelope(db,changed,envelope);
 const unlocked=await unlockVault(pass,await readEnvelope(db));
 assert.deepEqual(unlocked.doc,doc);assertModel(unlocked.doc);
 assert.equal(JSON.stringify(changed).includes('Alumno ficticio corregido'),false);
});

test('v0.6: restaurar una copia cifrada requiere la versión actual y no permite sobrescritura inadvertida',async()=>{
 const db=makeMemoryDb(), {envelope:backup}=await createVault(pass,initialNotebook());
 const another=await createVault(pass,initialNotebook());
 await writeEnvelope(db,another.envelope,null);
 await assert.rejects(writeEnvelope(db,backup,null),{code:'ENVELOPE_CONFLICT'});
 assert(sameEnvelope(await readEnvelope(db),another.envelope));
 const unlocked=await unlockVault(pass,backup);assertModel(unlocked.doc);
 await writeEnvelope(db,backup,another.envelope);
 assert(sameEnvelope(await readEnvelope(db),backup));
});

test('v0.6: mismo sobre cifrado detectado; el comparador no requiere objetos idénticos',()=>{
 const envelope={format:'CuadernoDocenteEncrypted',version:1,kdf:'PBKDF2-SHA-256',iterations:310000,salt:'abc',iv:'xyz',data:'cipher'};
 assert(sameEnvelope(structuredClone(envelope),envelope));
 assert(!sameEnvelope({...envelope,iv:'xyz2'},envelope));
 assert(sameEnvelope(null,undefined));assert(!sameEnvelope(null,envelope));
});

test('v0.6: service worker simulado precarga recursos y responde sin red desde caché',async()=>{
 const js=await readFile(new URL('../sw.js',import.meta.url),'utf8');
 const cacheName=js.match(/const CACHE='([^']+)'/)?.[1];assert(cacheName);
 const listeners={},stored=new Map();const origin='https://cuaderno-docente.test';let online=true,claims=0,skips=0;
 const url=x=>new URL(typeof x==='string'?x:x.url,origin).href;
 const cache={
   async addAll(arr){for(const a of arr)stored.set(url(a),{status:200,text:'contenido local '+a});},
   async match(req){return stored.get(url(req))??undefined;}
 };
 const caches={async open(name){assert.equal(name,cacheName);return cache;},async keys(){return ['cuaderno-docente-static-v06','cuaderno-docente-static-v08','cuaderno-docente-static-v11-dev','cuaderno-docente-static-v12-dev','cuaderno-docente-static-v13-dev','cuaderno-docente-static-v15-dev'];},async delete(name){assert(['cuaderno-docente-static-v06','cuaderno-docente-static-v08','cuaderno-docente-static-v11-dev','cuaderno-docente-static-v12-dev','cuaderno-docente-static-v13-dev','cuaderno-docente-static-v15-dev'].includes(name));return true;}};
 const self={location:{origin},addEventListener(name,fn){listeners[name]=fn;},skipWaiting(){skips++;},clients:{claim(){claims++;}}};
 const fetchFn=async req=>{if(!online)throw new Error('Sin conexión de red');return {status:200,text:'desde red'};};
 runInNewContext(js,{self,caches,fetch:fetchFn,URL,Promise});
 let installing;
 listeners.install({waitUntil(p){installing=p;}});await installing;
 const expectedAssets=js.match(/const ASSETS=\[([^\]]+)\]/)?.[1];assert(expectedAssets);
 assert.equal(stored.size,[...expectedAssets.matchAll(/'\.\//g)].length,'Se deben precargar todos los recursos declarados');
 assert([...stored.keys()].some(k=>k.endsWith("/src/timetable-export.js")),'El exportador offline es obligatorio');
 assert([...stored.keys()].some(k=>k.endsWith("/src/cuaderno.js")));assert.equal(skips,0);listeners.message({data:{type:"SKIP_WAITING"}});assert.equal(skips,1);
 let activating;
 listeners.activate({waitUntil(p){activating=p;}});await activating;assert.equal(claims,1);
 online=false;
 for(const path of ['./','./index.html','./app.js','./src/model.js','./src/vault.js','./src/storage.js','./src/diagnostics.js','./styles.css']){
   const request={method:'GET',url:url(path)};let response;
   listeners.fetch({request,respondWith(p){response=p;}});
   const hit=await response;assert.equal(hit.status,200);assert(hit.text.startsWith('contenido local'));
 }
 assert(![...stored.keys()].some(k=>k.includes('grades')||k.includes('vault/main')||k.endsWith('.cdoc')));
});

test('v0.6: caché simulada rechaza recurso no precargado si el navegador se queda sin conexión',async()=>{
 const js=await readFile(new URL('../sw.js',import.meta.url),'utf8');
 const listeners={},stored=new Map(),origin='https://cuaderno-docente.test';
 const caches={async open(){return {async addAll(a){for(const p of a)stored.set(new URL(p,origin).href,{status:200});},async match(r){return stored.get(new URL(typeof r==='string'?r:r.url,origin).href);}};}};
 const self={location:{origin},addEventListener(n,f){listeners[n]=f;},skipWaiting(){},clients:{claim(){}}};
 runInNewContext(js,{self,caches,fetch:async()=>{throw new Error('sin red');},URL,Promise});
 let done;listeners.install({waitUntil(p){done=p;}});await done;
 let response;listeners.fetch({request:{url:origin+'/no-precache.html',method:'GET'},respondWith(p){response=p;}});
 await assert.rejects(response,/sin red/);
});
