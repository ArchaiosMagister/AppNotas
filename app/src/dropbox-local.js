/** Bridge from the sync controller to AppNotas' existing mutation queue.
 * Remote data is committed with a CAS, under the same local key, before adoption.
 * No network calls here. The host must stop the session on restore/reset/lock.
 */
import {seal,KDF_ITERATIONS,keyIterations} from './vault.js';
import {assertModel} from './model.js';
import {compareBookVersions,validateBookMetadata} from './cuaderno.js';
import {writeEnvelope,sameEnvelope,readEnvelope,readDropboxCredential,writeDropboxCredential} from './storage.js';
import {sealDropboxCredential,openDropboxCredential} from './dropbox-oauth.js';
export function createLocalSyncBridge({state,enqueue,canApply=()=>true,adopt,onChanged=()=>{},write=writeEnvelope,read=readEnvelope}){
  const readLocal=()=>{
    if(!state.doc||!state.envelope||!state.key||!state.salt||state.saveError||state.failedEnvelope||
      state.saving||state.pending||keyIterations(state.key)!==KDF_ITERATIONS||!canApply())return null;
    return {doc:state.doc,key:state.key,salt:state.salt,envelope:state.envelope};
  };
  const matches=(expected,signal)=>!signal?.aborted&&state.doc===expected.doc&&state.key===expected.key&&
    sameEnvelope(state.envelope,expected.envelope)&&!state.saveError&&!state.failedEnvelope&&!state.saving&&canApply();
  async function verifyLocal(expected,signal){
    return !!expected?.envelope&&matches(expected,signal)&&sameEnvelope(await read(state.db),expected.envelope)&&matches(expected,signal);
  }
  async function acceptRemote({expected,doc,signal}){
    if(!expected?.envelope||!matches(expected,signal))return false;
    return enqueue(async()=>{
      await state.saveQueue;
      if(!matches(expected,signal))return false;
      assertModel(doc);validateBookMetadata(doc);
      if(compareBookVersions(expected.doc,doc)!=='newer')return false;
      const replacement=await seal(doc,expected.key,expected.salt);
      if(!matches(expected,signal))return false;
      try{await write(state.db,replacement,expected.envelope);}
      catch(e){if(e?.code==='ENVELOPE_CONFLICT')return false;throw e;}
      // Even if locking occurred during the final transaction, keep the
      // in-memory envelope coherent; never re-expose decrypted data on lock.
      if(state.key!==expected.key||state.doc!==expected.doc){
        if(sameEnvelope(state.envelope,expected.envelope))state.envelope=replacement;
        return false;
      }
      state.envelope=replacement;state.doc=doc;
      adopt(doc);
      onChanged();
      return true;
    });
  }
  return Object.freeze({readLocal,acceptRemote,verifyLocal});
}
export async function saveLocalDropboxLink({state,clientId,refreshToken,expected=state.envelope}){
  if(!state.doc||!state.key||!state.salt||!expected||!sameEnvelope(state.envelope,expected))
    throw new Error('Unlock the current notebook before linking Dropbox.');
  const doc=state.doc,key=state.key;
  const envelope=await sealDropboxCredential({clientId,refreshToken},key,state.salt);
  if(state.doc!==doc||state.key!==key||!sameEnvelope(state.envelope,expected))throw new Error('Notebook changed during linking.');
  await writeDropboxCredential(state.db,{version:1,bookId:doc.id,envelope},expected);
}
export async function loadLocalDropboxSession({state,clientId}){
  const doc=state.doc,key=state.key,salt=state.salt;
  if(!doc||!key||!salt||keyIterations(key)!==KDF_ITERATIONS)return null;
  const record=await readDropboxCredential(state.db);
  if(!record||record.version!==1||record.bookId!==doc.id||state.doc!==doc||state.key!==key)return null;
  const token=await openDropboxCredential(record.envelope,key,salt,clientId);
  return state.doc===doc&&state.key===key?{token,record}:null;
}

export async function loadLocalDropboxLink(options){return (await loadLocalDropboxSession(options))?.token??null;}
/** A different credential, book or deletion invalidates this unlocked session. */
export function sameDropboxLink(a,b){
  return !!a&&!!b&&a.version===1&&b.version===1&&a.bookId===b.bookId&&sameEnvelope(a.envelope,b.envelope);
}
