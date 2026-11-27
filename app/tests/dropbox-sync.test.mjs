import test from 'node:test';
import assert from 'node:assert/strict';
import {initialNotebook} from '../src/model.js';
import {createVault,saltFromEnvelope} from '../src/vault.js';
import {ensureBookMetadata,markBookChange} from '../src/cuaderno.js';
import {sealDropboxSnapshot,openDropboxSnapshot,unlockDropboxSnapshot,dropboxSyncDecision,createDropboxTransport} from '../src/dropbox-sync.js';
const password='Una frase larga de prueba exclusivamente ficticia';
function book(){const doc=initialNotebook();ensureBookMetadata(doc);return doc;}
function next(doc){const copy=structuredClone(doc);markBookChange(copy,doc);return copy;}
test('Dropbox snapshot is ciphertext only, authenticated and portable',async()=>{
  const doc=book(),{key,envelope}=await createVault(password,doc),salt=saltFromEnvelope(envelope);
  const snap=await sealDropboxSnapshot(doc,key,salt);
  assert.equal(JSON.stringify(snap).includes('Alumno 01'),false);
  assert.notEqual(snap.vault.iv,(await sealDropboxSnapshot(doc,key,salt)).vault.iv);
  assert.deepEqual(await openDropboxSnapshot(snap,key,salt),doc);
  assert.deepEqual((await unlockDropboxSnapshot(snap,password)).doc,doc);
  await assert.rejects(unlockDropboxSnapshot(snap,'Otra frase de prueba incorrecta'));
  const altered=structuredClone(snap);altered.vault.data=(altered.vault.data[0]==='A'?'B':'A')+altered.vault.data.slice(1);
  await assert.rejects(openDropboxSnapshot(altered,key,salt));
  await assert.rejects(openDropboxSnapshot({...snap,plaintext:doc},key,salt));
});
test('sync only follows verified ancestry; absent or divergent copies stop',()=>{
  const a=book(),b=next(a),c=next(a);
  assert.equal(dropboxSyncDecision(a,b),'download');
  assert.equal(dropboxSyncDecision(b,a),'upload');
  assert.equal(dropboxSyncDecision(a,structuredClone(a)),'current');
  assert.equal(dropboxSyncDecision(b,c),'conflict');
  assert.equal(dropboxSyncDecision(a,null),'stop');
  assert.equal(dropboxSyncDecision(a,null,{allowInitialize:true}),'initialize');
  assert.equal(dropboxSyncDecision(null,b),'download');
  assert.equal(dropboxSyncDecision(a,book()),'conflict');
});
test('upload sends only encrypted snapshots and conditional revisions, rejects conflicts',async()=>{
  const doc=book(),{key,envelope}=await createVault(password,doc),salt=saltFromEnvelope(envelope);
  const calls=[];
  const transport=createDropboxTransport({getAccessToken:async()=> 'test-token',fetchImpl:async(url,init)=>{
    calls.push({url,init});return new Response(JSON.stringify({rev:'newrev'}),{status:200});
  }});
  await assert.rejects(transport.upload({doc,key,salt}),{code:'missing-revision'});
  await transport.upload({doc,key,salt,expectedRev:'previousrev'});
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,'https://content.dropboxapi.com/2/files/upload');
  const arg=JSON.parse(calls[0].init.headers['Dropbox-API-Arg']);
  assert.deepEqual(arg.mode,{'.tag':'update',update:'previousrev'});
  assert.equal(arg.autorename,false);assert.equal(arg.strict_conflict,true);
  assert.equal(calls[0].init.body.includes('Alumno 01'),false);
  assert.equal(calls[0].init.body.includes(password),false);
  assert.deepEqual(await openDropboxSnapshot(JSON.parse(calls[0].init.body),key,salt),doc);
  const conflict=createDropboxTransport({getAccessToken:async()=> 'test-token',fetchImpl:async()=>new Response('{}',{status:409})});
  await assert.rejects(conflict.upload({doc,key,salt,expectedRev:'previousrev'}),{code:'conflict'});
});
test('download distinguishes a missing remote from errors and validates size',async()=>{
  const doc=book(),{key,envelope}=await createVault(password,doc),salt=saltFromEnvelope(envelope);
  const body=JSON.stringify(await sealDropboxSnapshot(doc,key,salt));
  const create=res=>createDropboxTransport({getAccessToken:async()=> 'test-token',fetchImpl:async()=>res});
  const download=await create(new Response(body,{headers:{'Dropbox-API-Result':JSON.stringify({rev:'rev1',size:new TextEncoder().encode(body).length})}})).download();
  assert.equal(download.rev,'rev1');
  assert.deepEqual(await openDropboxSnapshot(download.snapshot,key,salt),doc);
  assert.equal(await create(new Response(JSON.stringify({error:{'.tag':'path',path:{'.tag':'not_found'}}}),{status:409})).download(),null);
  await assert.rejects(create(new Response('{}',{status:401})).download(),{code:'http-401'});
  await assert.rejects(create(new Response(body,{headers:{'Dropbox-API-Result':JSON.stringify({rev:'rev1',size:1})}})).download(),{code:'size'});
});

test('preview transport accesses only its isolated test file',async()=>{
  const doc=book(),{key,envelope}=await createVault(password,doc),salt=saltFromEnvelope(envelope);
  const calls=[];
  const transport=createDropboxTransport({path:'/pruebas-cuaderno-cifrado.json',getAccessToken:async()=> 'test-token',fetchImpl:async(url,init)=>{
    calls.push(JSON.parse(init.headers['Dropbox-API-Arg']).path);return new Response(JSON.stringify({rev:'newrev'}));
  }});
  await transport.upload({doc,key,salt,expectedRev:null});
  assert.deepEqual(calls,['/pruebas-cuaderno-cifrado.json']);
  assert.throws(()=>createDropboxTransport({path:'/arbitrary.json',getAccessToken:async()=> 'test-token'}));
});
