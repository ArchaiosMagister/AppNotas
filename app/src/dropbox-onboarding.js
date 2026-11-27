/** Explicit onboarding, never invoked by the periodic sync scheduler.
 * Authorization is one-use and the callback is removed from browser history.
 * Tokens/passwords never enter a notebook or its cloud snapshot.
 */
import {beginAuthorization,completeAuthorization,sealDropboxCredential} from './dropbox-oauth.js';
import {createDropboxTransport,openDropboxSnapshot,unlockDropboxSnapshot,dropboxSyncDecision} from './dropbox-sync.js';
import {seal,keyIterations,KDF_ITERATIONS,unlockVault} from './vault.js';
import {assertModel} from './model.js';
import {validateBookMetadata,compareBookVersions} from './cuaderno.js';
import {sameEnvelope,readEnvelope,writeDropboxCredential,installDropboxNotebook} from './storage.js';
const PENDING='appnotas-dropbox-pkce-v1';
import {DROPBOX_ORIGIN,validDropboxRedirect,dropboxFilePath} from './dropbox-config.js';
const MODES=new Set(['link','restore']);
export async function prepareDropboxNavigation({clientId,mode,storage,origin,now=Date.now()}){
  if(!validDropboxRedirect(origin+'/')||!MODES.has(mode))throw new Error('Dropbox onboarding unavailable.');
  const result=await beginAuthorization(clientId,now,origin+'/');
  storage.setItem(PENDING,JSON.stringify({mode,pending:result.pending}));
  return result.url;
}
export function captureDropboxCallback({location,history,storage}){
  const url=new URL(location.href);
  if(!validDropboxRedirect(url.origin+url.pathname)||
     !['code','state','error','error_description'].some(k=>url.searchParams.has(k)))return null;
  // Scrub even unexpected/invalid callbacks. No query is kept in app history.
  history.replaceState(null,'',url.pathname);
  const raw=storage.getItem(PENDING);
  storage.removeItem(PENDING);
  if(!raw)return null;
  try{
    const record=JSON.parse(raw);
    if(!MODES.has(record.mode)||!record.pending||record.pending.redirectUri!==url.origin+url.pathname)return null;
    return {mode:record.mode,pending:record.pending,callbackUrl:url.href};
  }catch{return null;}
}
export function createDropboxOnboarding({clientId,authorize=completeAuthorization,transportFactory=createDropboxTransport,
  read=readEnvelope,writeLink=writeDropboxCredential,install=installDropboxNotebook,origin=DROPBOX_ORIGIN}){
  let used=false,session=null;
  const guard=()=>{if(!session||session.signal.aborted)throw new Error('Dropbox onboarding cancelled.');return session;};
  async function begin(callback){
    if(used||!callback||!MODES.has(callback.mode)||new URL(callback.callbackUrl).origin!==origin)throw new Error('Dropbox authorization already used or invalid.');
    used=true;
    const controller=new AbortController();
    const task={mode:callback.mode,controller,signal:controller.signal,token:null,accessToken:null,transport:null};
    session=task;
    try{
      const result=await authorize({clientId,pending:callback.pending,callbackUrl:callback.callbackUrl,signal:task.signal});
      if(guard()!==task)throw new Error('Dropbox onboarding cancelled.');
      task.token=result.refreshToken;task.accessToken=result.accessToken;
      task.transport=transportFactory({path:dropboxFilePath(origin),getAccessToken:async()=>{
        if(guard()!==task)throw new Error('Dropbox onboarding cancelled.');
        return task.accessToken;
      }});
      return task.mode;
    }catch(e){stop();throw e;}
  }
  function stop(){if(session){session.controller.abort();session.token=null;session.accessToken=null;session.transport=null;}session=null;}
  async function link({state,password,confirmInitialize=async()=>false}){
    const task=guard();
    if(task.mode!=='link'||!task.transport||!task.token)throw new Error('Link mode required.');
    const {doc,key,salt,envelope:expected,db}=state;
    const valid=()=>guard()===task&&state.doc===doc&&state.key===key&&sameEnvelope(state.envelope,expected)&&
      !state.saveError&&!state.failedEnvelope&&!state.saving;
    if(!doc||!key||!expected||keyIterations(key)!==KDF_ITERATIONS||!valid())throw new Error('Unlock strengthened notebook first.');
    // A 600k vault alone does not prove password strength; verify locally.
    if(typeof password!=='string'||password.length<16)throw new Error('Dropbox requires a passphrase of at least 16 characters.');
    const proof=await unlockVault(password,expected);
    if(compareBookVersions(doc,proof.doc)!=='same'||!valid())throw new Error('Local password verification failed.');
    assertModel(doc);validateBookMetadata(doc);
    if(!sameEnvelope(await read(db),expected)||!valid())throw new Error('Local notebook changed.');
    const entry=await task.transport.download({signal:task.signal});
    if(!valid())throw new Error('Local notebook changed.');
    if(entry){
      const remote=await openDropboxSnapshot(entry.snapshot,key,salt);
      if(!['current','upload','download'].includes(dropboxSyncDecision(doc,remote)))throw new Error('Remote notebook conflicts.');
    }else{
      if(await confirmInitialize()!==true)return false;
      if(!valid()||!sameEnvelope(await read(db),expected)||!valid())throw new Error('Local notebook changed.');
      // Add only, never overwrite, even if a different device creates first.
      await task.transport.upload({doc,key,salt,expectedRev:null,signal:task.signal,beforeSend:async()=>valid()&&sameEnvelope(await read(db),expected)&&valid()});
    }
    if(!valid())throw new Error('Local notebook changed.');
    const envelope=await sealDropboxCredential({clientId,refreshToken:task.token},key,salt);
    if(!valid())throw new Error('Local notebook changed.');
    await writeLink(db,{version:1,bookId:doc.id,envelope},expected);
    stop();return true;
  }
  async function restore({db,password,confirmRestore=async()=>false}){
    const task=guard();
    if(task.mode!=='restore'||!task.transport||!task.token)throw new Error('Restore mode required.');
    if(typeof password!=='string'||password.length<16)throw new Error('Dropbox requires a passphrase of at least 16 characters.');
    if(await read(db)!==null)throw new Error('Local notebook already exists.');
    const entry=await task.transport.download({signal:task.signal});
    if(guard()!==task||!entry)throw new Error('No remote notebook available.');
    const opened=await unlockDropboxSnapshot(entry.snapshot,password);
    if(guard()!==task)throw new Error('Dropbox onboarding cancelled.');
    if(await confirmRestore()!==true)return null;
    if(guard()!==task)throw new Error('Dropbox onboarding cancelled.');
    const envelope=await seal(opened.doc,opened.key,opened.salt);
    const credential=await sealDropboxCredential({clientId,refreshToken:task.token},opened.key,opened.salt);
    if(guard()!==task||await read(db)!==null||guard()!==task)throw new Error('Local notebook changed.');
    await install(db,envelope,{version:1,bookId:opened.doc.id,envelope:credential});
    stop();return {...opened,envelope};
  }
  return Object.freeze({begin,link,restore,stop});
}
