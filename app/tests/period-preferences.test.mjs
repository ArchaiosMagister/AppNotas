import test from 'node:test';
import assert from 'node:assert/strict';
import {createVault,unlockVault} from '../src/vault.js';
import {emptyPeriodPreferences,rememberPeriod,preferredPeriod,mergePeriodPreferences,sealPeriodPreferences,openPeriodPreferences,createPeriodPreferenceStore,syncPeriodPreferences} from '../src/period-preferences.js';
const doc={id:'book',groups:[{id:'g1'},{id:'g2'}],periods:[{id:'p2',order:2},{id:'p1',order:1}]};
test('independent periods, renamed/reordered/deleted groups and periods; no academic mutation',()=>{
 const before=structuredClone(doc),a=rememberPeriod(emptyPeriodPreferences(doc.id),'g1','p2','a'),b=rememberPeriod(a,'g2','p1','a');
 assert.equal(preferredPeriod(b,doc,'g1'),'p2');assert.equal(preferredPeriod(b,doc,'g2'),'p1');
 assert.equal(preferredPeriod(b,{...doc,periods:[{id:'p1',order:3}]},'g1'),'p1');assert.equal(preferredPeriod(b,doc,'missing'),'p1');assert.deepEqual(doc,before);
});
test('concurrent preferences converge by group; same-group conflict has deterministic tie-break',()=>{
 const base=emptyPeriodPreferences('book'),a=rememberPeriod(base,'g1','p2','a',1000),b=rememberPeriod(base,'g2','p1','b',1000);
 assert.deepEqual(mergePeriodPreferences(a,b),mergePeriodPreferences(b,a));
 assert.equal(mergePeriodPreferences(a,b).entries.length,2);
 const c=rememberPeriod(base,'g1','p1','z',1000);assert.equal(mergePeriodPreferences(a,c).entries[0].periodId,'p1');
 assert.throws(()=>mergePeriodPreferences(a,emptyPeriodPreferences('other')));
});
test('ciphertext authenticated with separate AAD, wrong book and tampering rejected',async()=>{
 const {key,envelope}=await createVault('contraseña ficticia de pruebas',doc);
 const salt=Uint8Array.from(atob(envelope.salt),c=>c.charCodeAt(0)),p=rememberPeriod(emptyPeriodPreferences('book'),'g1','p2','a');
 const sealed=await sealPeriodPreferences(p,key,salt);assert(!JSON.stringify(sealed).includes('g1'));assert.deepEqual(await openPeriodPreferences(sealed,key,salt,'book'),p);
 await assert.rejects(openPeriodPreferences(sealed,key,salt,'other'));
 await assert.rejects(unlockVault('contraseña ficticia de pruebas',sealed));
 await assert.rejects(openPeriodPreferences({...sealed,data:sealed.data.slice(0,-8)+'AAAAAAAA'},key,salt,'book'));
});
test('two simulated devices merge with CAS without changing academic envelope',async()=>{
 const {key,envelope}=await createVault('contraseña ficticia de pruebas',doc),salt=Uint8Array.from(atob(envelope.salt),c=>c.charCodeAt(0));
 const state={key,salt,doc,envelope,db:null},before=JSON.stringify(state.envelope);
 const make=()=>{let local=null;return createPeriodPreferenceStore({state,read:async()=>local,write:async(db,main,expected,next)=>{if(local!==expected)return false;local=next;return true;}});};
 const a=make(),b=make();await a.remember('g1','p2');await b.remember('g2','p1');
 let remote=null,rev=0;
 const transport={download:async()=>remote,upload:async(envelope,expected,signal,check)=>{if(expected!==(remote?.rev??null)||!await check())return false;remote={envelope,rev:String(++rev)};return true;}};
 await syncPeriodPreferences({store:a,transport,state});await syncPeriodPreferences({store:b,transport,state});await syncPeriodPreferences({store:a,transport,state});
 assert.deepEqual(a.get(),b.get());assert.equal(a.get().entries.length,2);assert.equal(JSON.stringify(state.envelope),before);assert.deepEqual(state.doc,doc);
 a.reset();assert.equal(a.get(),null);await a.load();assert.deepEqual(a.get(),b.get());
});

import {initialNotebook} from '../src/model.js';
import {ensureBookMetadata,createPortableCopy,decodeBackupContent,compareBookVersions} from '../src/cuaderno.js';
test('portable backup includes optional authenticated preferences without changing academic revision or legacy format',async()=>{
 const book=initialNotebook();ensureBookMetadata(book);const before=structuredClone(book);
 const password='contraseña ficticia de pruebas',vault=await createVault(password,book);
 const salt=Uint8Array.from(atob(vault.envelope.salt),c=>c.charCodeAt(0));
 const p=rememberPeriod(emptyPeriodPreferences(book.id),book.groups[0].id,book.periods[1].id,'device');
 const newCopy=await createPortableCopy(book,vault.key,salt,new Date(),p);
 assert.deepEqual(Object.keys(newCopy.file).sort(),['type','vault','version']);
 const decoded=await decodeBackupContent(newCopy.file,password);
 assert.deepEqual(decoded.preferences,p);assert.equal(compareBookVersions(decoded.doc,before),'same');
 const oldCopy=await createPortableCopy(book,vault.key,salt);
 assert.equal((await decodeBackupContent(oldCopy.file,password)).preferences,undefined);
 assert.deepEqual(book,before);
});

import {readFileSync} from 'node:fs';
test('diagnóstico sin conexión comprueba exactamente el inventario PWA',()=>{
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8'),sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 assert.equal(app.match(/const expected=(\['\.\/','\.\/index\.html',[^\]]+\]);/)[1],sw.match(/const ASSETS=(\[[^\]]+\]);/)[1]);
});
test('una descarga cancelada no puede fusionar preferencias ni escribir después de desvincular',async()=>{
 const {key,envelope}=await createVault('contraseña ficticia de pruebas',doc),salt=Uint8Array.from(atob(envelope.salt),c=>c.charCodeAt(0));
 const state={key,salt,doc,envelope},abort=new AbortController();
 let writes=0;
 const store=createPeriodPreferenceStore({state,read:async()=>null,write:async()=>{writes++;return true;}});
 const remote=await sealPeriodPreferences(rememberPeriod(emptyPeriodPreferences(doc.id),'g1','p2','b'),key,salt);
 const transport={download:async()=>{abort.abort();return {rev:'r1',envelope:remote};},upload:async()=>{throw Error('unexpected upload');}};
 assert.equal(await syncPeriodPreferences({store,transport,state,signal:abort.signal}),false);assert.equal(writes,0);
 await assert.rejects(store.merge(rememberPeriod(emptyPeriodPreferences(doc.id),'g1','p2','b'),()=>false));assert.equal(writes,0);
});
test('un cambio local durante una subida obliga a sincronizar la nueva selección',async()=>{
 const {key,envelope}=await createVault('contraseña ficticia de pruebas',doc),salt=Uint8Array.from(atob(envelope.salt),c=>c.charCodeAt(0));
 const state={key,salt,doc,envelope};let local=null,remote=null,rev=0;
 const store=createPeriodPreferenceStore({state,read:async()=>local,write:async(db,main,previous,next)=>{if(local!==previous)return false;local=next;return true;}});
 await store.remember('g1','p2');
 const transport={download:async()=>remote,upload:async(env,expected,signal,check)=>{
  if(!await check())return false;
  remote={rev:String(++rev),envelope:env};
  if(rev===1)await store.remember('g1','p1');
  return true;
 }};
 assert.equal(await syncPeriodPreferences({store,transport,state}),true);
 assert.equal(rev,2);assert.equal(preferredPeriod(await openPeriodPreferences(remote.envelope,key,salt,doc.id),doc,'g1'),'p1');
});

test('selecciones offline: prevalece la más reciente con relojes razonables y se conserva compatibilidad v1',()=>{
 const base=emptyPeriodPreferences('book'),legacy=rememberPeriod(base,'g1','p1','old',1);
 const a=rememberPeriod(legacy,'g1','p2','z',1700000000000);
 const b=rememberPeriod(legacy,'g1','p1','a',1700000001000);
 assert.equal(preferredPeriod(mergePeriodPreferences(a,b),doc,'g1'),'p1');
 assert.deepEqual(mergePeriodPreferences(a,b),mergePeriodPreferences(b,a));
 const c=rememberPeriod(b,'g1','p2','a',1700000000000);
 assert(c.entries[0].clock>b.entries[0].clock);
 assert.equal(preferredPeriod(mergePeriodPreferences(b,c),doc,'g1'),'p2');
});
