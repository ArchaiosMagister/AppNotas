import test from 'node:test';
import assert from 'node:assert/strict';
import {initialNotebook} from '../src/model.js';
import {createVault,saltFromEnvelope,unlockVault} from '../src/vault.js';
import {ensureBookMetadata} from '../src/cuaderno.js';
import {sealDropboxSnapshot} from '../src/dropbox-sync.js';
import {openDropboxCredential} from '../src/dropbox-oauth.js';
import {prepareDropboxNavigation,captureDropboxCallback,createDropboxOnboarding} from '../src/dropbox-onboarding.js';
const clientId='test-app-key',password='Only fictional long passphrase',origin='https://appnotas-docente.pages.dev';
function memory(){const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};}
test('callback is scrubbed and consumed once, including malformed callback',async()=>{
  const storage=memory(),history={replaceState(a,b,path){assert.equal(path,'/');}};
  const url=await prepareDropboxNavigation({clientId,mode:'restore',storage,origin});
  const state=new URL(url).searchParams.get('state');
  const location={href:origin+'/?code=fake&state='+state};
  const callback=captureDropboxCallback({location,history,storage});
  assert.equal(callback.mode,'restore');assert.equal(callback.pending.state,state);
  assert.equal(captureDropboxCallback({location,history,storage}),null);
  await assert.rejects(prepareDropboxNavigation({clientId,mode:'link',storage,origin:'https://other.example'}));
});
async function fixture(mode){
  const doc=initialNotebook();ensureBookMetadata(doc);
  const {key,envelope}=await createVault(password,doc),salt=saltFromEnvelope(envelope);
  let stored=mode==='restore'?null:envelope,record=null,remote=null,uploads=0,installs=0;
  const state={doc,key,salt,envelope,db:{}};
  const flow=createDropboxOnboarding({clientId,authorize:async()=>({accessToken:'fake-access',refreshToken:'fake-refresh'}),
    transportFactory:()=>({download:async()=>remote,upload:async args=>{
      assert.equal(args.expectedRev,null);assert.equal(remote,null);uploads++;
      remote={rev:'r1',snapshot:await sealDropboxSnapshot(args.doc,args.key,args.salt)};
    }}),read:async()=>stored,writeLink:async(db,r,expected)=>{assert.equal(expected,stored);record=r;},
    install:async(db,e,r)=>{assert.equal(stored,null);stored=e;record=r;installs++;}});
  await flow.begin({mode,pending:{},callbackUrl:origin});
  return {flow,state,doc,key,salt,remote:async()=>{remote={rev:'r1',snapshot:await sealDropboxSnapshot(doc,key,salt)};},
    record:()=>record,stored:()=>stored,uploads:()=>uploads,installs:()=>installs,setStored:v=>{stored=v;}};
}
test('new cloud copy requires explicit approval and uses add-only upload',async()=>{
  const f=await fixture('link');
  assert.equal(await f.flow.link({state:f.state}),false);
  assert.equal(f.uploads(),0);assert.equal(f.record(),null);
  assert.equal(await f.flow.link({state:f.state,confirmInitialize:async()=>true}),true);
  assert.equal(f.uploads(),1);
  assert.equal(await openDropboxCredential(f.record().envelope,f.key,f.salt,clientId),'fake-refresh');
  assert.equal(JSON.stringify(f.record()).includes('fake-refresh'),false);
  await assert.rejects(f.flow.begin({mode:'link'}));
});
test('new device requires correct password and explicit approval before encrypted installation',async()=>{
  const f=await fixture('restore');await f.remote();
  await assert.rejects(f.flow.restore({db:{},password:'Incorrect fictional password',confirmRestore:async()=>true}));
  assert.equal(f.stored(),null);
  assert.equal(await f.flow.restore({db:{},password}),null);
  assert.equal(f.installs(),0);
  const result=await f.flow.restore({db:{},password,confirmRestore:async()=>true});
  assert.deepEqual((await unlockVault(password,f.stored())).doc,f.doc);
  assert.equal(result.doc.id,f.doc.id);assert.equal(f.installs(),1);assert.equal(f.uploads(),0);
  assert.equal(await openDropboxCredential(f.record().envelope,result.key,result.salt,clientId),'fake-refresh');
});
test('restore refuses a local notebook even if it appears during confirmation',async()=>{
  const f=await fixture('restore');await f.remote();
  await assert.rejects(f.flow.restore({db:{},password,confirmRestore:async()=>{f.setStored(f.state.envelope);return true;}}));
  assert.equal(f.installs(),0);assert.equal(f.stored(),f.state.envelope);
});
test('linking existing remote does not replace or upload local data during onboarding',async()=>{
  const f=await fixture('link');await f.remote();
  assert.equal(await f.flow.link({state:f.state}),true);
  assert.equal(f.uploads(),0);assert.equal(f.stored(),f.state.envelope);
});
