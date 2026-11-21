import test from 'node:test';
import assert from 'node:assert/strict';
import {initialNotebook,assertModel,setGrade} from '../src/model.js';
import {createVault,unlockVault,seal,saltFromEnvelope} from '../src/vault.js';
import {readEnvelope,readRecoveryEnvelope,writeEnvelope,replaceEnvelopeWithRecovery,swapRecoveryEnvelope,sameEnvelope,readExportReceipt,recordExportReceipt} from '../src/storage.js';
import {overallGrade} from '../src/calculations.js';

/** IndexedDB determinista: snapshot por transacción, commit solo en oncomplete.
 * Si se aborta, ni main ni pre-restore se modifican (no representa un navegador real). */
function simulatedDb(){
 const records=new Map(),queue=[];let locked=false,failPutOn=0;
 const deep=v=>v===undefined?undefined:structuredClone(v);
 const dispatch=()=>{if(locked||!queue.length)return;locked=true;const t=queue.shift();t.active=true;t.start();t.pump();};
 const db={
  transaction(name,mode){
   assert.equal(name,'vault');assert(['readonly','readwrite'].includes(mode));
   let snapshot;
   const t={active:false,aborted:false,busy:false,ops:[],error:null,oncomplete:null,onabort:null,onerror:null,writeCount:0,
    start(){snapshot=new Map([...records].map(([k,v])=>[k,deep(v)]));},
    objectStore(which){assert.equal(which,'vault');return {
     get(key){const r={result:undefined,onsuccess:null,onerror:null};t.ops.push(()=>{r.result=deep(snapshot.get(key));r.onsuccess?.();});t.pump();return r;},
     put(value,key){assert.equal(mode,'readwrite');t.writeCount++;
       if(failPutOn&&t.writeCount===failPutOn){failPutOn=0;throw new Error('Simulación de fallo al escribir');}
       t.ops.push(()=>snapshot.set(key,deep(value)));t.pump();},
     delete(key){assert.equal(mode,'readwrite');t.ops.push(()=>snapshot.delete(key));t.pump();}
    };},
    pump(){if(!t.active||t.busy||t.aborted)return;t.busy=true;queueMicrotask(()=>{
     t.busy=false;if(t.aborted)return;
     if(t.ops.length){t.ops.shift()();t.pump();}
     else{if(mode==='readwrite'){records.clear();for(const [k,v] of snapshot)records.set(k,deep(v));}
      t.active=false;locked=false;t.oncomplete?.();dispatch();}
    });},
    abort(){if(t.aborted)return;t.aborted=true;t.ops=[];t.active=false;locked=false;t.onabort?.();dispatch();}
   };
   queue.push(t);queueMicrotask(dispatch);return t;
  },
  snapshot(){return deep([...records]);},
  failNextTransactionAtPut(n){failPutOn=n;}
 };
 return db;
}
const oldPassword='Clave de la copia antigua - auditoría v0.9';
const newPassword='Una clave distinta para la nueva copia 2026';
async function twoDocs(){
 const original=initialNotebook(),next=structuredClone(original);
 const s=original.students[0],a=original.assessments[0];
 setGrade(original,s.id,a.id,4.5);setGrade(next,s.id,a.id,9.25);
 assertModel(original);assertModel(next);
 const old=await createVault(oldPassword,original),replacement=await createVault(newPassword,next);
 return {original,next,old,replacement,s,a};
}

test('v0.9: restaurar guarda la copia previa cifrada en la misma transacción',async()=>{
 const db=simulatedDb(),{old,replacement,original,next}=await twoDocs();
 await writeEnvelope(db,old.envelope,null);
 await replaceEnvelopeWithRecovery(db,replacement.envelope,old.envelope);
 assert(sameEnvelope(await readEnvelope(db),replacement.envelope));
 const recovery=await readRecoveryEnvelope(db);
 assert.equal(recovery.version,1);assert.match(recovery.createdAt,/^\d{4}-\d\d-\d\dT/);
 assert(sameEnvelope(recovery.envelope,old.envelope));
 const readOld=await unlockVault(oldPassword,recovery.envelope);
 assert.deepEqual(readOld.doc.grades,original.grades);
 assert.deepEqual((await unlockVault(newPassword,await readEnvelope(db))).doc.grades,next.grades);
 assert(!JSON.stringify(db.snapshot()).includes(original.students[0].name));
});

test('v0.9: recuperar la versión anterior intercambia las dos copias sin perder ninguna',async()=>{
 const db=simulatedDb(),{old,replacement,original,next,s}=await twoDocs();
 await writeEnvelope(db,old.envelope,null);
 await replaceEnvelopeWithRecovery(db,replacement.envelope,old.envelope);
 const recovery=await readRecoveryEnvelope(db);
 await swapRecoveryEnvelope(db,replacement.envelope,recovery);
 const current=await readEnvelope(db),rescue=await readRecoveryEnvelope(db);
 assert(sameEnvelope(current,old.envelope));assert(sameEnvelope(rescue.envelope,replacement.envelope));
 assert.equal(overallGrade(original,s.id,original.groups[0].id,original.periods[0].id),
   overallGrade((await unlockVault(oldPassword,current)).doc,s.id,original.groups[0].id,original.periods[0].id));
 assert.deepEqual((await unlockVault(newPassword,rescue.envelope)).doc.grades,next.grades);
});

test('v0.9: una restauración concurrente con versión antigua no altera notas ni el rescate',async()=>{
 const db=simulatedDb(),{old,replacement}=await twoDocs();await writeEnvelope(db,old.envelope,null);
 const another=await createVault(newPassword,initialNotebook());
 const result=await Promise.allSettled([
  replaceEnvelopeWithRecovery(db,replacement.envelope,old.envelope),
  replaceEnvelopeWithRecovery(db,another.envelope,old.envelope)]);
 assert.equal(result.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(result.filter(x=>x.status==='rejected').length,1);
 assert.equal(result.find(x=>x.status==='rejected').reason.code,'ENVELOPE_CONFLICT');
 assert(sameEnvelope((await readRecoveryEnvelope(db)).envelope,old.envelope));
});

test('v0.9: el rescate no se pierde si falla el segundo put y aborta toda la transacción',async()=>{
 const db=simulatedDb(),{old,replacement}=await twoDocs();
 await writeEnvelope(db,old.envelope,null);
 const stateBefore=db.snapshot();db.failNextTransactionAtPut(2);
 await assert.rejects(replaceEnvelopeWithRecovery(db,replacement.envelope,old.envelope),/Simulación de fallo/);
 assert.deepEqual(db.snapshot(),stateBefore);
 assert.equal(await readRecoveryEnvelope(db),null);
 assert(sameEnvelope(await readEnvelope(db),old.envelope));
});

test('v0.9: recuperar tras cambios posteriores no sobrescribe si otra pestaña cambió la versión',async()=>{
 const db=simulatedDb(),{old,replacement,next}=await twoDocs();
 await writeEnvelope(db,old.envelope,null);
 await replaceEnvelopeWithRecovery(db,replacement.envelope,old.envelope);
 const rescue=await readRecoveryEnvelope(db);
 const changed=structuredClone(next);changed.title='Edición posterior';
 const opened=await unlockVault(newPassword,replacement.envelope);
 const changedEnvelope=await seal(changed,opened.key,saltFromEnvelope(replacement.envelope));
 await writeEnvelope(db,changedEnvelope,replacement.envelope);
 await assert.rejects(swapRecoveryEnvelope(db,replacement.envelope,rescue),{code:'ENVELOPE_CONFLICT'});
 assert(sameEnvelope(await readEnvelope(db),changedEnvelope));
 assert(sameEnvelope((await readRecoveryEnvelope(db)).envelope,old.envelope));
 await swapRecoveryEnvelope(db,changedEnvelope,rescue);
 assert(sameEnvelope(await readEnvelope(db),old.envelope));
 assert(sameEnvelope((await readRecoveryEnvelope(db)).envelope,changedEnvelope));
});

test('v0.9: rescate obsoleto distinto no puede intercambiarse; cifrado intacto',async()=>{
 const db=simulatedDb(),{old,replacement}=await twoDocs();await writeEnvelope(db,old.envelope,null);
 await replaceEnvelopeWithRecovery(db,replacement.envelope,old.envelope);
 const rescue=await readRecoveryEnvelope(db),bad={...rescue,createdAt:'2000-01-01T00:00:00.000Z'};
 const before=db.snapshot();
 await assert.rejects(swapRecoveryEnvelope(db,replacement.envelope,bad),{code:'ENVELOPE_CONFLICT'});
 assert.deepEqual(db.snapshot(),before);
});

test('v0.9: recuperación exige contraseña correcta de copia previa, no la de la versión actual',async()=>{
 const db=simulatedDb(),{old,replacement}=await twoDocs();
 await writeEnvelope(db,old.envelope,null);await replaceEnvelopeWithRecovery(db,replacement.envelope,old.envelope);
 const rescue=await readRecoveryEnvelope(db);
 await assert.rejects(unlockVault(newPassword,rescue.envelope),/Contraseña incorrecta/);
 assert(sameEnvelope(await readEnvelope(db),replacement.envelope));
});

test('v0.9: con almacén vacío la restauración no crea falsa copia previa',async()=>{
 const db=simulatedDb(),{replacement}=await twoDocs();
 await replaceEnvelopeWithRecovery(db,replacement.envelope,null);
 assert.equal(await readRecoveryEnvelope(db),null);
 assert(sameEnvelope(await readEnvelope(db),replacement.envelope));
});

test('v0.9: rechaza escritura de restauración sin versión esperada',async()=>{
 const db=simulatedDb(),{old}=await twoDocs();
 await assert.rejects(replaceEnvelopeWithRecovery(db,old.envelope,undefined),/Falta la versión/);
 await assert.rejects(swapRecoveryEnvelope(db,undefined,null),/Falta una versión/);
 assert.equal(await readEnvelope(db),null);
});

test('v1.0: un rescate migrado se escribe junto con el punto nuevo y ambos sobreviven al aborto',async()=>{
 const db=simulatedDb(),{old,replacement,original}=await twoDocs();
 await writeEnvelope(db,old.envelope,null);
 const rescue=await replaceEnvelopeWithRecovery(db,replacement.envelope,old.envelope);
 assert.deepEqual(rescue,await readRecoveryEnvelope(db));
 const migratedEnvelope=await seal(original,old.key,saltFromEnvelope(old.envelope));
 db.failNextTransactionAtPut(2);
 await assert.rejects(swapRecoveryEnvelope(db,replacement.envelope,rescue,migratedEnvelope),/Simulación de fallo/);
 assert.deepEqual(await readEnvelope(db),replacement.envelope);
 assert.deepEqual(await readRecoveryEnvelope(db),rescue);
 const previous=await swapRecoveryEnvelope(db,replacement.envelope,rescue,migratedEnvelope);
 assert.deepEqual(await readEnvelope(db),migratedEnvelope);
 assert.deepEqual(previous,await readRecoveryEnvelope(db));
 assert.deepEqual(previous.envelope,replacement.envelope);
 assert.deepEqual((await unlockVault(oldPassword,migratedEnvelope)).doc.grades,original.grades);
});


test('v1.17: acuse de exportación solo si se verifica versión local y transacción finaliza',async()=>{
 const db=simulatedDb(),{old}=await twoDocs();await writeEnvelope(db,old.envelope,null);
 assert.equal(await readExportReceipt(db),null);
 const receipt={version:1,bookId:'libro-ficticio',head:'revision-ficticia',exportedAt:new Date().toISOString()};
 await recordExportReceipt(db,receipt,old.envelope);
 assert.deepEqual(await readExportReceipt(db),receipt);
});
test('v1.17: una pestaña que altera notas impide registrar falsamente una exportación actual',async()=>{
 const db=simulatedDb(),{old,replacement}=await twoDocs();await writeEnvelope(db,old.envelope,null);
 await writeEnvelope(db,replacement.envelope,old.envelope);
 const receipt={version:1,bookId:'libro-ficticio',head:'revision-ficticia',exportedAt:new Date().toISOString()};
 await assert.rejects(recordExportReceipt(db,receipt,old.envelope),{code:'ENVELOPE_CONFLICT'});
 assert.equal(await readExportReceipt(db),null);
 assert(sameEnvelope(await readEnvelope(db),replacement.envelope));
});
test('v1.17: error de almacenamiento al registrar copia no destruye el cuaderno local',async()=>{
 const db=simulatedDb(),{old}=await twoDocs();await writeEnvelope(db,old.envelope,null);
 db.failNextTransactionAtPut(1);
 const receipt={version:1,bookId:'libro-ficticio',head:'revision-ficticia',exportedAt:new Date().toISOString()};
 await assert.rejects(recordExportReceipt(db,receipt,old.envelope),/Simulación de fallo/);
 assert.equal(await readExportReceipt(db),null);
 assert(sameEnvelope(await readEnvelope(db),old.envelope));
});
