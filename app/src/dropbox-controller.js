/** Synchronization orchestration; intentionally independent of UI and IndexedDB.
 * readLocal returns an immutable committed state {doc,key,salt}.
 * acceptRemote MUST compare the expected state inside the existing mutation
 * queue and IndexedDB transaction, persist encrypted data before replacing UI,
 * and return false when the local revision or unlock session changed.
 */
import {openDropboxSnapshot,dropboxSyncDecision} from './dropbox-sync.js';
import {compareBookVersions} from './cuaderno.js';

export function createSyncController({transport,readLocal,acceptRemote,verifyLocal=async()=>true,onStatus=()=>{},isOnline=()=>true}){
  let generation=0,session=null,flight=null;
  function report(status,details={}){
    const value={status,...details};
    onStatus(value);return value;
  }
  function stop(){
    generation++;
    if(session)session.abort();
    session=null;flight=null;
    return report('locked');
  }
  function start(){
    if(session)return;
    generation++;session=new AbortController();
    report('idle');
  }
  function current(gen,signal){return generation===gen&&!signal.aborted&&session!==null;}
  function unchanged(before){
    const after=readLocal();
    return !!after&&after.key===before.key&&after.doc===before.doc;
  }
  function sync({allowInitialize=false}={}){
    if(!session)return Promise.resolve({status:'locked'});
    if(flight)return flight;
    const gen=generation,signal=session.signal;
    const active=()=>current(gen,signal);
    const status=(s,d)=>active()?report(s,d):{status:'locked'};
    const run=async()=>{
      if(!isOnline())return status('offline');
      const local=readLocal();
      if(!local?.doc||!local.key||!local.salt)return status('unavailable');
      status('syncing');
      try{
        if(!await verifyLocal(local,signal)||!active()||!unchanged(local))return status('pending');
        const entry=await transport.download({signal});
        if(!active())return {status:'locked'};
        if(!unchanged(local))return status('pending');
        const remote=entry?await openDropboxSnapshot(entry.snapshot,local.key,local.salt):null;
        if(!active())return {status:'locked'};
        if(!unchanged(local))return status('pending');
        if(!await verifyLocal(local,signal)||!active()||!unchanged(local))return status('pending');
        const decision=dropboxSyncDecision(local.doc,remote,{allowInitialize});
        if(decision==='stop')return status('remote-missing');
        if(decision==='conflict')return status('conflict',{reason:compareBookVersions(local.doc,remote)});
        if(decision==='current')return status('synced');
        if(decision==='download'){
          const accepted=await acceptRemote({expected:local,doc:remote,signal});
          if(!active())return {status:'locked'};
          if(!accepted)return status('pending');
          const after=readLocal();
          return status(after?.key===local.key&&after.doc===remote?'synced':'pending');
        }
        await transport.upload({doc:local.doc,key:local.key,salt:local.salt,expectedRev:entry?.rev??null,signal,beforeSend:async()=>active()&&unchanged(local)&&await verifyLocal(local,signal)&&active()&&unchanged(local)});
        if(!active())return {status:'locked'};
        return status(unchanged(local)?'synced':'pending');
      }catch(error){
        if(!active())return {status:'locked'};
        // Never display provider responses, tokens, notebook data or stack traces.
        if(error?.code==='local-changed')return status('pending');
        if(error?.code==='link-changed')return status('not-linked');
        if(error?.code==='conflict')return status('conflict',{reason:'remote-revision-changed'});
        return status(isOnline()?'error':'offline');
      }
    };
    // Start in a microtask so duplicate triggers share one operation, even if
    // an offline or locked check returns immediately.
    const job=Promise.resolve().then(run).finally(()=>{if(flight===job)flight=null;});
    flight=job;return job;
  }
  return Object.freeze({start,stop,sync,markPending:()=>{if(session)report(isOnline()?'pending':'offline');}});
}

/** Active-page scheduler; not a background service worker.
 * Hooks are installed once per unlocked session; no initialization or
 * destructive operation may be triggered automatically.
 */
export function createSyncScheduler({controller,windowTarget,documentTarget,
  debounceMs=1500,pollMs=60000,setTimer=setTimeout,clearTimer=clearTimeout,
  setPoll=setInterval,clearPoll=clearInterval}){
  let enabled=false,timeout=null,poll=null;
  const visible=()=>documentTarget.visibilityState!=='hidden';
  const cancel=()=>{if(timeout!==null){clearTimer(timeout);timeout=null;}};
  const trigger=()=>{if(enabled&&visible()){cancel();return controller.sync();}};
  const onVisible=()=>{if(visible())trigger();else cancel();};
  function start(){
    if(enabled)return;
    enabled=true;controller.start();
    windowTarget.addEventListener('online',trigger);
    windowTarget.addEventListener('pageshow',trigger);
    documentTarget.addEventListener('visibilitychange',onVisible);
    poll=setPoll(trigger,pollMs);
    trigger();
  }
  function changed(){
    if(!enabled)return;
    controller.markPending?.();
    if(!visible())return;
    cancel();timeout=setTimer(()=>{timeout=null;trigger();},debounceMs);
  }
  function stop(){
    if(!enabled)return;
    enabled=false;cancel();
    if(poll!==null){clearPoll(poll);poll=null;}
    windowTarget.removeEventListener('online',trigger);
    windowTarget.removeEventListener('pageshow',trigger);
    documentTarget.removeEventListener('visibilitychange',onVisible);
    controller.stop();
  }
  return Object.freeze({start,changed,stop,manual:()=>enabled?(cancel(),controller.sync()):Promise.resolve({status:'locked'})});
}
