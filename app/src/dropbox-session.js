/** Unlocked-session wiring. Disabled by default until app-folder registration,
 * CSP review, account/device onboarding and end-to-end tests are complete.
 * A Dropbox app key is public; never put an app secret here.
 */
import {createLocalSyncBridge,loadLocalDropboxSession,sameDropboxLink} from './dropbox-local.js';
import {createDropboxTransport} from './dropbox-sync.js';
import {createSyncController,createSyncScheduler} from './dropbox-controller.js';
import {readDropboxCredential} from './storage.js';
import {refreshAuthorization} from './dropbox-oauth.js';
export const DROPBOX_CLIENT_ID='';
export const DROPBOX_ORIGIN='https://appnotas-docente.pages.dev';
export const dropboxConfigured=origin=>origin===DROPBOX_ORIGIN&&/^[a-zA-Z0-9_-]{5,128}$/.test(DROPBOX_CLIENT_ID);
export function createSessionTokenProvider({clientId,refreshToken,refresh=refreshAuthorization,now=Date.now}){
  let token=null,expiry=0,pending=null,stopped=false,secret=refreshToken;
  const abort=new AbortController();
  async function getAccessToken(){
    if(stopped)throw new Error('Dropbox session stopped.');
    if(token&&now()<expiry-60000)return token;
    if(pending)return pending;
    const task=Promise.resolve().then(async()=>{
      if(stopped)throw new Error('Dropbox session stopped.');
      const result=await refresh({clientId,refreshToken:secret,signal:abort.signal});
      if(stopped)throw new Error('Dropbox session stopped.');
      // Dropbox refresh tokens are reusable; unexpected rotation requires
      // relinking until persistence of the replacement is implemented.
      if(result.refreshToken&&result.refreshToken!==secret)throw new Error('Dropbox relinking required.');
      token=result.accessToken;expiry=now()+result.expiresIn*1000;return token;
    }).finally(()=>{if(pending===task)pending=null;});
    pending=task;return task;
  }
  function stop(){stopped=true;abort.abort();token=null;secret=null;expiry=0;}
  return Object.freeze({getAccessToken,stop});
}
export function createDropboxSession({state,enqueue,canApply,adopt,onStatus,windowTarget,documentTarget,origin,
    load=loadLocalDropboxSession,readLink=readDropboxCredential,clientId=DROPBOX_CLIENT_ID}){
  let generation=0,scheduler=null,provider=null;
  function stop(){generation++;scheduler?.stop();provider?.stop();scheduler=null;provider=null;}
  async function start(){
    stop();
    if(!dropboxConfigured(origin)||clientId!==DROPBOX_CLIENT_ID){onStatus({status:'not-configured'});return;}
    const gen=generation,key=state.key;
    if(!key||!state.doc)return;
    let link;
    try{link=await load({state,clientId});}
    catch{if(gen===generation)onStatus({status:'error'});return;}
    if(gen!==generation||state.key!==key)return;
    if(!link){onStatus({status:'not-linked'});return;}
    provider=createSessionTokenProvider({clientId,refreshToken:link.token});
    const sessionProvider=provider;
    const checkLink=async()=>{
      if(gen!==generation||state.key!==key||state.doc?.id!==link.record.bookId||
        !sameDropboxLink(await readLink(state.db),link.record)||gen!==generation||state.key!==key){
        sessionProvider.stop();throw Object.assign(new Error('Dropbox link changed.'),{code:'link-changed'});
      }
    };
    const transport=createDropboxTransport({getAccessToken:async()=>{
      await checkLink();const token=await sessionProvider.getAccessToken();await checkLink();return token;
    }});
    const bridge=createLocalSyncBridge({state,enqueue,canApply,adopt});
    const controller=createSyncController({transport,...bridge,onStatus,isOnline:()=>windowTarget.navigator.onLine!==false});
    scheduler=createSyncScheduler({controller,windowTarget,documentTarget});
    scheduler.start();
  }
  return Object.freeze({start,stop,changed:()=>scheduler?.changed(),manual:()=>scheduler?.manual()??Promise.resolve({status:'not-linked'}),active:()=>!!scheduler});
}
