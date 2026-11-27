import test from 'node:test';
import assert from 'node:assert/strict';
import {initialNotebook} from '../src/model.js';
import {createVault,saltFromEnvelope,unlockVault} from '../src/vault.js';
import {ensureBookMetadata,markBookChange} from '../src/cuaderno.js';
import {createLocalSyncBridge} from '../src/dropbox-local.js';
const password='Fictitious sufficiently long password';
async function fixture(){
  const doc=initialNotebook();ensureBookMetadata(doc);
  const {key,envelope}=await createVault(password,doc);
  const state={doc,key,envelope,salt:saltFromEnvelope(envelope),saveQueue:Promise.resolve(),pending:0,saving:0};
  let stored=envelope,adopted=0,blocked=false;
  const queue=fn=>{state.pending++;return Promise.resolve().then(fn).finally(()=>state.pending--);};
  const write=async(db,next,expected)=>{if(stored!==expected)throw Object.assign(Error(),{code:'ENVELOPE_CONFLICT'});stored=next;};
  const bridge=createLocalSyncBridge({state,enqueue:queue,canApply:()=>!blocked,adopt:()=>adopted++,write,read:async()=>stored});
  const newer=structuredClone(doc);newer.students[0].name='Fictitious change';markBookChange(newer,doc);
  return {state,bridge,newer,doc,stored:()=>stored,adopted:()=>adopted,block:()=>{blocked=true;},race:()=>{stored={...stored,data:stored.data+'x'};}};
}
test('remote adoption commits only encrypted bytes before changing current state',async()=>{
  const f=await fixture(),expected=f.bridge.readLocal();
  assert(await f.bridge.acceptRemote({expected,doc:f.newer,signal:new AbortController().signal}));
  assert.equal(f.adopted(),1);assert.equal(f.state.doc,f.newer);
  assert.equal(f.stored(),f.state.envelope);
  assert.equal(JSON.stringify(f.stored()).includes('Fictitious change'),false);
  assert.deepEqual((await unlockVault(password,f.stored())).doc,f.newer);
});
test('stale local revisions, conflicts and aborted sessions do not replace a notebook',async()=>{
  const f=await fixture(),expected=f.bridge.readLocal(),abort=new AbortController();abort.abort();
  assert.equal(await f.bridge.acceptRemote({expected,doc:f.newer,signal:abort.signal}),false);
  f.race();
  assert.equal(await f.bridge.acceptRemote({expected,doc:f.newer}),false);
  assert.equal(f.state.doc,f.doc);assert.equal(f.adopted(),0);
});
test('active edit or unsafe local state suppresses synchronization',async()=>{
  const f=await fixture(),expected=f.bridge.readLocal();
  f.state.pending=1;assert.equal(f.bridge.readLocal(),null);
  f.state.pending=0;f.state.saveError=Error();assert.equal(f.bridge.readLocal(),null);
  f.state.saveError=null;f.block();assert.equal(f.bridge.readLocal(),null);
  assert.equal(await f.bridge.acceptRemote({expected,doc:f.newer}),false);
  assert.equal(f.state.doc,f.doc);
});
test('unrelated or earlier incoming versions are never accepted by the local bridge',async()=>{
  const f=await fixture(),expected=f.bridge.readLocal();
  const other=initialNotebook();ensureBookMetadata(other);
  assert.equal(await f.bridge.acceptRemote({expected,doc:other}),false);
  assert.equal(await f.bridge.acceptRemote({expected,doc:f.doc}),false);
  assert.equal(f.adopted(),0);
});

test('a stale tab cannot certify its revision for Dropbox upload',async()=>{
  const f=await fixture(),expected=f.bridge.readLocal();
  assert.equal(await f.bridge.verifyLocal(expected),true);
  f.race();assert.equal(await f.bridge.verifyLocal(expected),false);
});
