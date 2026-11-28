/** Independent encrypted UI preferences. Never part of the academic document. */
import {seal,validateEnvelope,keyIterations} from './vault.js';
import {readPeriodPreferences,writePeriodPreferences} from './storage.js';
import {DROPBOX_TEST_PATH,DROPBOX_PRODUCTION_PATH} from './dropbox-config.js';
const AAD='AppNotasPeriodPreferences/v1';
const MAX=1024*1024;
const id=s=>typeof s==='string'&&s.length>0&&s.length<=128;
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join(',')===keys;
export const emptyPeriodPreferences=bookId=>({version:1,bookId,entries:[]});
export function validatePeriodPreferences(p,bookId){
 if(!exact(p,'bookId,entries,version')||p.version!==1||!id(bookId)||p.bookId!==bookId||
    !Array.isArray(p.entries)||p.entries.length>10000)throw Error('Preferencias incompatibles.');
 const seen=new Set();
 for(const e of p.entries){
  if(!exact(e,'clock,device,groupId,periodId')||!id(e.groupId)||!id(e.periodId)||!id(e.device)||
     !Number.isSafeInteger(e.clock)||e.clock<1||seen.has(e.groupId))throw Error('Preferencias inválidas.');
  seen.add(e.groupId);
 }
 if(JSON.stringify(p).length>MAX/2)throw Error('Preferencias demasiado grandes.');
 return p;
}
const compare=(a,b)=>a.clock-b.clock||(a.device<b.device?-1:a.device>b.device?1:0)||(a.periodId<b.periodId?-1:a.periodId>b.periodId?1:0);
const ordered=entries=>[...entries].sort((a,b)=>a.groupId<b.groupId?-1:a.groupId>b.groupId?1:0);
export function mergePeriodPreferences(a,b){
 validatePeriodPreferences(a,a.bookId);validatePeriodPreferences(b,a.bookId);
 const entries=new Map(a.entries.map(e=>[e.groupId,e]));
 for(const e of b.entries){const old=entries.get(e.groupId);if(!old||compare(e,old)>0)entries.set(e.groupId,e);}
 return validatePeriodPreferences({...a,entries:ordered(entries.values())},a.bookId);
}
export function rememberPeriod(p,groupId,periodId,device){
 validatePeriodPreferences(p,p.bookId);
 const old=p.entries.find(e=>e.groupId===groupId);
 if(old?.periodId===periodId)return p;
 const clock=(old?.clock||0)+1;
 return mergePeriodPreferences(p,{version:1,bookId:p.bookId,entries:[{groupId,periodId,device,clock}]});
}
export function preferredPeriod(p,doc,groupId){
 const periods=[...doc.periods].sort((a,b)=>a.order-b.order);
 const selected=p?.bookId===doc.id&&doc.groups.some(g=>g.id===groupId)?p.entries.find(e=>e.groupId===groupId)?.periodId:null;
 return periods.find(x=>x.id===selected)?.id??periods[0]?.id??null;
}
export async function sealPeriodPreferences(p,key,salt){
 validatePeriodPreferences(p,p.bookId);
 return seal(p,key,salt,undefined,AAD);
}
export async function openPeriodPreferences(env,key,salt,bookId){
 if(!exact(env,'data,format,iterations,iv,kdf,salt,version')||typeof env.data!=='string'||env.data.length>MAX)throw Error('Preferencias cifradas inválidas.');
 const params=validateEnvelope(env);
 if(env.iterations!==keyIterations(key)||!params.salt.every((v,i)=>v===salt[i]))throw Error('Clave de preferencias distinta.');
 const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:params.iv,additionalData:new TextEncoder().encode(AAD)},key,Uint8Array.from(atob(env.data),c=>c.charCodeAt(0)));
 return validatePeriodPreferences(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(plain)),bookId);
}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
/** CAS independently of academic revisions; only a matching unlocked vault may write. */
export function createPeriodPreferenceStore({state,read=readPeriodPreferences,write=writePeriodPreferences}){
 let cache=null,owner=null,flight=Promise.resolve();
 const device=crypto.randomUUID();
 const context=()=>({key:state.key,salt:state.salt,bookId:state.doc?.id,db:state.db});
 const current=c=>!!c.key&&state.key===c.key&&state.doc?.id===c.bookId;
 const reset=()=>{cache=null;owner=null;};
 const queue=fn=>{const next=flight.then(fn,fn);flight=next.catch(()=>{});return next;};
 async function transact(c,change,guard){
  const active=()=>current(c)&&guard();
  for(let tries=0;tries<5;tries++){
   if(!active())throw Error('Sesión cerrada.');
   const main=state.envelope,previous=await read(c.db,main,c.bookId);
   const local=previous?await openPeriodPreferences(previous,c.key,c.salt,c.bookId):emptyPeriodPreferences(c.bookId);
   const next=change(local);
   if(!active())throw Error('Sesión cerrada.');
   if(same(local,next)){cache=next;owner=c.key;return next;}
   const sealed=await sealPeriodPreferences(next,c.key,c.salt);
   if(!active())throw Error('Sesión cerrada.');
   if(await write(c.db,main,previous,sealed,c.bookId,active)){
    if(!active())throw Error('Sesión cerrada.');
    cache=next;owner=c.key;return next;
   }
  }
  throw Error('No se pudieron guardar las preferencias en concurrencia.');
 }
 const run=(change,guard=()=>true)=>{const c=context();return queue(()=>transact(c,change,guard));};
 return Object.freeze({
  reset,load:()=>run(p=>p),
  get:()=>owner===state.key&&cache?.bookId===state.doc?.id?cache:null,
  remember:(groupId,periodId)=>run(p=>rememberPeriod(p,groupId,periodId,device)),
  merge:(remote,guard)=>run(p=>mergePeriodPreferences(p,remote),guard)
 });
}
/** The sidecar uses the existing Dropbox API and distinct fixed paths and AAD. */
export async function periodPreferenceScope(bookId,salt){
 if(!id(bookId)||typeof salt!=='string')throw Error('Cuaderno no identificado.');
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(bookId+':'+salt));
 return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}
export function createPeriodPreferenceTransport({academicPath,scope,getAccessToken,fetchImpl=globalThis.fetch}){
 if(!/^[a-f0-9]{64}$/.test(scope))throw Error('Identificador de preferencias inválido.');
 const path=academicPath===DROPBOX_TEST_PATH?'/pruebas-preferencias-cifradas-'+scope+'.json':academicPath===DROPBOX_PRODUCTION_PATH?'/preferencias-cifradas-'+scope+'.json':null;
 if(!path)throw Error('Ruta de preferencias no autorizada.');
 const revision=r=>{if(typeof r!=='string'||! /^[a-zA-Z0-9_-]{1,128}$/.test(r))throw Error('Revisión de preferencias inválida.');return r;};
 const request=async(action,arg,signal,body,beforeSend)=>{
  const token=await getAccessToken();
  if(!token||/[\r\n]/.test(token)||signal?.aborted||(beforeSend&&!await beforeSend())||signal?.aborted)throw Error('Sesión de preferencias cerrada.');
  return fetchImpl('https://content.dropboxapi.com/2/files/'+action,{method:'POST',headers:{Authorization:'Bearer '+token,'Dropbox-API-Arg':JSON.stringify({path,...arg}),...(body?{'Content-Type':'application/octet-stream'}:{})},body,signal,credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer'});
 };
 return Object.freeze({
  async download(signal){
   const res=await request('download',{},signal);
   if(res.status===409){const err=await res.json();if(err?.error?.['.tag']==='path'&&err.error.path?.['.tag']==='not_found')return null;}
   if(!res.ok)throw Error('No se pudieron descargar preferencias.');
   const meta=JSON.parse(res.headers.get('Dropbox-API-Result'));
   if(!Number.isSafeInteger(meta.size)||meta.size<1||meta.size>MAX)throw Error('Tamaño de preferencias inválido.');
   const body=await res.text();if(new TextEncoder().encode(body).length!==meta.size)throw Error('Tamaño de preferencias incorrecto.');
   return {rev:revision(meta.rev),envelope:JSON.parse(body)};
  },
  async upload(envelope,expectedRev,signal,beforeSend){
   const body=JSON.stringify(envelope);if(body.length>MAX)throw Error('Preferencias demasiado grandes.');
   const mode=expectedRev===null?'add':{'.tag':'update',update:revision(expectedRev)};
   const res=await request('upload',{mode,autorename:false,strict_conflict:true,mute:true},signal,body,beforeSend);
   if(res.status===409)return false; // retry after downloading, never overwrite
   if(!res.ok)throw Error('No se pudieron subir preferencias.');
   revision((await res.json()).rev);return true;
  }
 });
}
export async function syncPeriodPreferences({store,transport,state,signal,check=async()=>{}}){
 const key=state.key,salt=state.salt,bookId=state.doc?.id;
 const live=()=>!!key&&state.key===key&&state.doc?.id===bookId&&!signal?.aborted;
 for(let tries=0;tries<3;tries++){
  if(!live())return false;
  await check();if(!live())return false;
  const remote=await transport.download(signal);
  if(!live())return false;
  const incoming=remote?await openPeriodPreferences(remote.envelope,key,salt,bookId):emptyPeriodPreferences(bookId);
  if(!live())return false;
  await check();if(!live())return false;
  const merged=await store.merge(incoming,live);
  if(!live())return false;
  if(same(merged,incoming))return true;
  const envelope=await sealPeriodPreferences(merged,key,salt);
  if(await transport.upload(envelope,remote?.rev??null,signal,async()=>{await check();return live()&&same(store.get(),merged);})){
   if(!live())return false;
   if(same(store.get(),merged))return true;
  }
 }
 return false;
}
