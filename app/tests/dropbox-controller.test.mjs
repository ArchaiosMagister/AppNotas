import test from 'node:test';
import assert from 'node:assert/strict';
import {initialNotebook} from '../src/model.js';
import {createVault,saltFromEnvelope} from '../src/vault.js';
import {ensureBookMetadata,markBookChange} from '../src/cuaderno.js';
import {sealDropboxSnapshot,openDropboxSnapshot} from '../src/dropbox-sync.js';
import {createSyncController,createSyncScheduler} from '../src/dropbox-controller.js';
function book(){const doc=initialNotebook();ensureBookMetadata(doc);return doc;}
function next(doc,name){const copy=structuredClone(doc);copy.students[0].name=name;markBookChange(copy,doc);return copy;}
async function setup(){
  const doc=book(),{key,envelope}=await createVault('Long fictional password for synchronization',doc),salt=saltFromEnvelope(envelope);
  let remote=null,serial=0;
  const transport={
    async download(){return remote;},
    async upload({doc,key,salt,expectedRev}){
      if((remote?.rev??null)!==expectedRev)throw Object.assign(new Error(),{code:'conflict'});
      remote={rev:'rev'+(++serial),snapshot:await sealDropboxSnapshot(doc,key,salt)};
    }
  };
  function device(startDoc){
    let state={doc:startDoc,key,salt},online=true;
    const controller=createSyncController({transport,readLocal:()=>state,isOnline:()=>online,
      acceptRemote:async({expected,doc,signal})=>{
        if(signal.aborted||state!==expected)return false;
        state={doc,key,salt};return true;
      }});
    controller.start();
    return {controller,read:()=>state.doc,edit:name=>{state={doc:next(state.doc,name),key,salt};},online:v=>{online=v;}};
  }
  return {doc,key,salt,device,transport,remote:()=>remote};
}
test('two devices propagate updates in both directions and never initialize implicitly',async()=>{
  const f=await setup(),a=f.device(f.doc),b=f.device(structuredClone(f.doc));
  assert.equal((await a.controller.sync()).status,'remote-missing');
  assert.equal(f.remote(),null);
  assert.equal((await a.controller.sync({allowInitialize:true})).status,'synced');
  a.edit('Fictitious A');
  assert.equal((await a.controller.sync()).status,'synced');
  assert.equal((await b.controller.sync()).status,'synced');
  assert.equal(b.read().students[0].name,'Fictitious A');
  b.edit('Fictitious B');
  await b.controller.sync();await a.controller.sync();
  assert.equal(a.read().students[0].name,'Fictitious B');
});
test('divergent offline changes preserve local and remote independently',async()=>{
  const f=await setup(),a=f.device(f.doc),b=f.device(structuredClone(f.doc));
  await a.controller.sync({allowInitialize:true});
  a.online(false);a.edit('Local A');b.edit('Local B');
  assert.equal((await a.controller.sync()).status,'offline');
  await b.controller.sync();a.online(true);
  assert.equal((await a.controller.sync()).status,'conflict');
  assert.equal(a.read().students[0].name,'Local A');
  assert.equal((await openDropboxSnapshot(f.remote().snapshot,f.key,f.salt)).students[0].name,'Local B');
});
test('local edit while downloading prevents remote replacement',async()=>{
  const f=await setup(),a=f.device(f.doc),b=f.device(structuredClone(f.doc));
  await a.controller.sync({allowInitialize:true});a.edit('Remote A');await a.controller.sync();
  const original=f.transport.download;let release,entered;
  const begun=new Promise(r=>entered=r);
  f.transport.download=async()=>{entered();await new Promise(r=>release=r);return original();};
  const pending=b.controller.sync();await begun;b.edit('New local B');release();
  assert.equal((await pending).status,'pending');
  assert.equal(b.read().students[0].name,'New local B');
});
test('lock cancels a pending download and coalesces concurrent triggers',async()=>{
  const f=await setup(),a=f.device(f.doc);
  let release,entered;const begun=new Promise(r=>entered=r);
  f.transport.download=async()=>{entered();await new Promise(r=>release=r);return null;};
  const p=a.controller.sync({allowInitialize:true});
  assert.equal(p,a.controller.sync());await begun;
  a.controller.stop();release();
  assert.equal((await p).status,'locked');assert.equal(f.remote(),null);
  assert.equal((await a.controller.sync()).status,'locked');
});
test('scheduler debounces changes, responds to foreground and stops on lock',()=>{
  const win=new EventTarget(),doc=new EventTarget();doc.visibilityState='visible';
  let calls=0,starts=0,stops=0,poll,seq=0;const timers=new Map();
  const controller={sync:()=>{calls++;return Promise.resolve({status:'synced'});},start:()=>starts++,stop:()=>stops++};
  const s=createSyncScheduler({controller,windowTarget:win,documentTarget:doc,
    setTimer:fn=>{timers.set(++seq,fn);return seq;},clearTimer:id=>timers.delete(id),
    setPoll:fn=>{poll=fn;return 1;},clearPoll:()=>{poll=null;}});
  s.start();s.start();assert.equal(starts,1);assert.equal(calls,1);
  s.changed();s.changed();assert.equal(timers.size,1);
  const fn=[...timers.values()][0];timers.clear();fn();assert.equal(calls,2);
  doc.visibilityState='hidden';doc.dispatchEvent(new Event('visibilitychange'));poll();assert.equal(calls,2);
  doc.visibilityState='visible';doc.dispatchEvent(new Event('visibilitychange'));assert.equal(calls,3);
  win.dispatchEvent(new Event('online'));assert.equal(calls,4);
  s.manual();assert.equal(calls,5);s.changed();s.stop();
  assert.equal(stops,1);assert.equal(timers.size,0);assert.equal(poll,null);
  win.dispatchEvent(new Event('online'));assert.equal(calls,5);
});

test('an obsolete IndexedDB revision prevents the first remote request',async()=>{
  let calls=0;const local={doc:{},key:{},salt:new Uint8Array(16)};
  const controller=createSyncController({readLocal:()=>local,verifyLocal:async()=>false,acceptRemote:async()=>false,
    transport:{download:async()=>{calls++;return null;}}});
  controller.start();assert.equal((await controller.sync()).status,'pending');assert.equal(calls,0);
});
