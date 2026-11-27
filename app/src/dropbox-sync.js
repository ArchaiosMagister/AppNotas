/** Foundation for encrypted Dropbox sync. Not wired into the UI yet.
 * Never upload the notebook itself: only a freshly sealed, authenticated snapshot.
 * The current local vault format is reused; KDF hardening is a release prerequisite.
 */
import {seal,unlockVault,validateEnvelope,KDF_ITERATIONS,keyIterations} from './vault.js';
import {assertModel,SCHEMA_VERSION} from './model.js';
import {validateBookMetadata,compareBookVersions,MAX_CUADERNO_BYTES} from './cuaderno.js';
const TYPE='AppNotasDropbox';
const AAD=TYPE+'/v1';
import {DROPBOX_PRODUCTION_PATH,DROPBOX_TEST_PATH} from './dropbox-config.js';
const CONTENT='https://content.dropboxapi.com/2/files/';
const exact=(obj,keys)=>obj&&typeof obj==='object'&&!Array.isArray(obj)&&Object.keys(obj).sort().join(',')===keys.slice().sort().join(',');
const bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const sameBytes=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
function checkDoc(doc){
  if(doc?.schemaVersion!==SCHEMA_VERSION)throw new Error('Version de cuaderno no compatible con la sincronizacion.');
  assertModel(doc);validateBookMetadata(doc);return doc;
}
function checkSnapshot(snapshot){
  if(!exact(snapshot,['type','version','vault'])||snapshot.type!==TYPE||snapshot.version!==1||
     !exact(snapshot.vault,['format','version','kdf','iterations','salt','iv','data']))
    throw new Error('Formato Dropbox no reconocido.');
  if(JSON.stringify(snapshot).length>MAX_CUADERNO_BYTES)throw new Error('Copia demasiado grande.');
  const params=validateEnvelope(snapshot.vault);
  if(snapshot.vault.iterations!==KDF_ITERATIONS)throw new Error('Dropbox requires the strengthened vault.');
  return params;
}
export async function sealDropboxSnapshot(doc,key,salt){
  checkDoc(doc);
  if(keyIterations(key)!==KDF_ITERATIONS)throw new Error('Dropbox requires the strengthened vault.');
  const snapshot={type:TYPE,version:1,vault:await seal(doc,key,salt,undefined,AAD)};
  checkSnapshot(snapshot);return snapshot;
}
export async function unlockDropboxSnapshot(snapshot,password){
  checkSnapshot(snapshot);
  const result=await unlockVault(password,snapshot.vault,AAD);
  checkDoc(result.doc);return result;
}
export async function openDropboxSnapshot(snapshot,key,salt){
  const params=checkSnapshot(snapshot);
  if(keyIterations(key)!==KDF_ITERATIONS)throw new Error('Dropbox requires the strengthened vault.');
  if(!sameBytes(params.salt,salt))throw new Error('El cuaderno remoto utiliza otra clave.');
  let doc;
  try{
    const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:params.iv,additionalData:new TextEncoder().encode(AAD)},key,bytes(snapshot.vault.data));
    doc=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(plain));
  }catch{throw new Error('Copia remota no autentica o clave incorrecta.');}
  return checkDoc(doc);
}
/** Missing remote data may only initialize after explicit linking.
 * Never resolve divergent, different, unknown or deleted books by timestamp.
 */
export function dropboxSyncDecision(local,remote,{allowInitialize=false}={}){
  if(!remote)return local&&allowInitialize?'initialize':'stop';
  const relation=compareBookVersions(local,remote);
  return ({empty:'download',same:'current',newer:'download',older:'upload'})[relation]||'conflict';
}
function revision(value){
  if(typeof value!=='string'||! /^[a-zA-Z0-9_-]{1,128}$/.test(value))throw new Error('Revision Dropbox invalida.');
  return value;
}
export class DropboxSyncError extends Error{
  constructor(code){super('Dropbox: '+code);this.name='DropboxSyncError';this.code=code;}
}
/** Direct browser-to-Dropbox adapter. OAuth tokens are injected by a future
 * session controller; no credentials are persisted or logged here.
 */
export function createDropboxTransport({getAccessToken,fetchImpl=globalThis.fetch,path=DROPBOX_PRODUCTION_PATH}){
  if(![DROPBOX_PRODUCTION_PATH,DROPBOX_TEST_PATH].includes(path))throw new Error('Invalid Dropbox path.');
  if(typeof getAccessToken!=='function'||typeof fetchImpl!=='function')throw new Error('Falta transporte autorizado.');
  async function request(action,arg,body,signal,beforeSend){
    const token=await getAccessToken();
    if(typeof token!=='string'||!token||/[\r\n]/.test(token))throw new DropboxSyncError('authorization');
    if(signal?.aborted||beforeSend&&!await beforeSend()||signal?.aborted)throw new DropboxSyncError('local-changed');
    return fetchImpl(CONTENT+action,{method:'POST',headers:{Authorization:'Bearer '+token,'Dropbox-API-Arg':JSON.stringify(arg),...(body===undefined?{}:{'Content-Type':'application/octet-stream'})},body,signal,credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer'});
  }
  async function download({signal}={}){
    const res=await request('download',{path},undefined,signal);
    if(res.status===409){
      let err;try{err=await res.json();}catch{}
      if(err?.error?.['.tag']==='path'&&err.error.path?.['.tag']==='not_found')return null;
      throw new DropboxSyncError('conflict');
    }
    if(!res.ok)throw new DropboxSyncError('http-'+res.status);
    let metadata;try{metadata=JSON.parse(res.headers.get('Dropbox-API-Result'));}catch{throw new DropboxSyncError('metadata');}
    const rev=revision(metadata?.rev);
    if(!Number.isSafeInteger(metadata?.size)||metadata.size<=0||metadata.size>MAX_CUADERNO_BYTES)throw new DropboxSyncError('size');
    const raw=await res.text();
    if(raw.length>MAX_CUADERNO_BYTES||new TextEncoder().encode(raw).length!==metadata.size)throw new DropboxSyncError('size');
    let snapshot;try{snapshot=JSON.parse(raw);}catch{throw new DropboxSyncError('format');}
    checkSnapshot(snapshot);return {rev,snapshot};
  }
  async function upload({doc,key,salt,expectedRev,signal,beforeSend}){
    if(expectedRev===undefined)throw new DropboxSyncError('missing-revision');
    const mode=expectedRev===null?'add':{'.tag':'update',update:revision(expectedRev)};
    const snapshot=await sealDropboxSnapshot(doc,key,salt);
    const body=JSON.stringify(snapshot);
    const res=await request('upload',{path,mode,autorename:false,strict_conflict:true,mute:true},body,signal,beforeSend);
    if(res.status===409)throw new DropboxSyncError('conflict');
    if(!res.ok)throw new DropboxSyncError('http-'+res.status);
    const result=await res.json();return {rev:revision(result?.rev)};
  }
  return Object.freeze({download,upload});
}
