import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sameEnvelope,writeEnvelope,replaceEnvelopeWithRecovery,
  readRecoveryEnvelope,swapRecoveryEnvelope,recordExportReceipt
} from '../src/storage.js';

/** Modelo mínimo de transacción: lecturas asíncronas, cambios provisionales,
 * commit al terminar y rollback íntegro en abort; NO sustituye a Safari real. */
function memoryDb(initial={},options={}){
  let actual=structuredClone(initial);
  const db={
    snapshot:()=>structuredClone(actual),
    transaction(){
      let staged=structuredClone(actual),pending=0,aborted=false,complete=false;
      const tx={
        oncomplete:null,onerror:null,onabort:null,
        abort(){if(aborted||complete)return;aborted=true;queueMicrotask(()=>tx.onabort?.());},
        objectStore(){
          return {
            get(key){
              const req={result:undefined,onsuccess:null,onerror:null};
              pending++;
              queueMicrotask(()=>{
                if(aborted)return;
                req.result=structuredClone(staged[key]);
                req.onsuccess?.();
                pending--;
                if(pending===0)queueMicrotask(()=>{
                  if(aborted||complete)return;
                  actual=staged;complete=true;tx.oncomplete?.();
                });
              });
              return req;
            },
            put(value,key){
              if(aborted||complete)throw Error('Transacción cerrada');
              if(options.failPut===key)throw Error('Fallo de escritura simulado: '+key);
              staged[key]=structuredClone(value);
            },
            delete(key){
              if(aborted||complete)throw Error('Transacción cerrada');
              delete staged[key];
            }
          };
        }
      };
      return tx;
    }
  };
  return db;
}
const envelope=label=>({
  format:'CuadernoDocenteEncrypted',version:1,kdf:'PBKDF2-SHA-256',
  iterations:310000,salt:'salt-'+label,iv:'iv-'+label,data:'data-'+label
});
test('restauración válida sustituye principal y conserva rescate cifrado',async()=>{
  const old=envelope('ipad'),next=envelope('iphone');
  const db=memoryDb({main:old});
  const rescue=await replaceEnvelopeWithRecovery(db,next,old);
  assert.equal(rescue.version,1);
  assert.deepEqual(rescue.envelope,old);
  assert.deepEqual(db.snapshot().main,next);
  assert.deepEqual((await readRecoveryEnvelope(db)).envelope,old);
});
test('restauración con versión esperada antigua se rechaza sin tocar ninguna copia',async()=>{
  const old=envelope('ipad'),concurrent=envelope('other-tab'),incoming=envelope('iphone');
  const db=memoryDb({main:concurrent,'pre-restore':{version:1,createdAt:'2026-11-22T08:00:00Z',envelope:old}});
  const before=db.snapshot();
  await assert.rejects(replaceEnvelopeWithRecovery(db,incoming,old),/Otra pestaña/);
  assert.deepEqual(db.snapshot(),before);
});
test('fallo al escribir principal revierte también el rescate provisional',async()=>{
  const old=envelope('ipad'),incoming=envelope('iphone');
  const prior={version:1,createdAt:'2026-11-20T08:00:00Z',envelope:envelope('older')};
  const db=memoryDb({main:old,'pre-restore':prior},{failPut:'main'});
  const before=db.snapshot();
  await assert.rejects(replaceEnvelopeWithRecovery(db,incoming,old),/Fallo de escritura/);
  assert.deepEqual(db.snapshot(),before);
});
test('rescate invierte la restauración y guarda la versión nueva como recuperación',async()=>{
  const old=envelope('ipad'),incoming=envelope('iphone');
  const db=memoryDb({main:old});
  const rescue=await replaceEnvelopeWithRecovery(db,incoming,old);
  const reverse=await swapRecoveryEnvelope(db,incoming,rescue);
  assert.deepEqual(db.snapshot().main,old);
  assert.deepEqual(reverse.envelope,incoming);
  assert.deepEqual(db.snapshot()['pre-restore'].envelope,incoming);
  assert.deepEqual((await readRecoveryEnvelope(db)).envelope,incoming);
});
test('no se puede recuperar con un rescate modificado por otra pestaña',async()=>{
  const old=envelope('ipad'),newer=envelope('iphone');
  const rescue={version:1,createdAt:'2026-11-20T08:00:00Z',envelope:old};
  const db=memoryDb({main:newer,'pre-restore':rescue});
  const before=db.snapshot(),stale={...rescue,createdAt:'2026-11-19T08:00:00Z'};
  await assert.rejects(swapRecoveryEnvelope(db,newer,stale),/Otra pestaña/);
  assert.deepEqual(db.snapshot(),before);
});
test('guardado y acuse de exportación rechazan copias desactualizadas',async()=>{
  const original=envelope('ipad'),saved=envelope('iphone'),stale=envelope('old');
  const db=memoryDb({main:original}),receipt={
    version:1,bookId:'cuaderno-1',head:'revision-2',exportedAt:'2026-11-22T08:00:00Z'
  };
  await writeEnvelope(db,saved,original);
  assert.deepEqual(db.snapshot().main,saved);
  const before=db.snapshot();
  await assert.rejects(writeEnvelope(db,stale,original),/Otra pestaña/);
  await assert.rejects(recordExportReceipt(db,receipt,original),/Otra pestaña/);
  assert.deepEqual(db.snapshot(),before);
  assert(sameEnvelope(db.snapshot().main,saved));
});
