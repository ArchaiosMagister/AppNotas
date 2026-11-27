import test from 'node:test';
import assert from 'node:assert/strict';
import {initialNotebook} from '../src/model.js';
import {createVault,seal,saltFromEnvelope,unlockVault} from '../src/vault.js';
import {ensureBookMetadata,markBookChange} from '../src/cuaderno.js';
import {sealDropboxSnapshot} from '../src/dropbox-sync.js';
import {prepareConflictCopies} from '../src/dropbox-conflict.js';
const password='Long fictional password for conflict copies';
async function fixture(){
  const base=initialNotebook();ensureBookMetadata(base);
  const {key,envelope}=await createVault(password,base),salt=saltFromEnvelope(envelope);
  const a=structuredClone(base),b=structuredClone(base);
  a.students[0].name='Fictional Local';b.students[0].name='Fictional Dropbox';
  markBookChange(a,base);markBookChange(b,base);
  const local={doc:a,key,salt,envelope:await seal(a,key,salt)};
  const snapshot=await sealDropboxSnapshot(b,key,salt);
  return {local,b,transport:{download:async()=>({rev:'r1',snapshot}),upload:async()=>{throw Error('must not upload');}}};
}
test('conflict copies export two independent authenticated encrypted envelopes without changing either',async()=>{
  const f=await fixture();
  const copies=await prepareConflictCopies({transport:f.transport,readLocal:()=>f.local,verifyLocal:async()=>true});
  assert.equal(copies.relation,'divergent');assert.equal(JSON.stringify(copies).includes('Fictional'),false);
  assert.deepEqual((await unlockVault(password,copies.local)).doc,f.local.doc);
  assert.deepEqual((await unlockVault(password,copies.remote)).doc,f.b);
});
test('conflict export stops when local state changes during remote fetch',async()=>{
  const f=await fixture();let checks=0;
  await assert.rejects(prepareConflictCopies({transport:f.transport,readLocal:()=>f.local,verifyLocal:async()=>++checks===1}));
});
