/** Almacén local: una sola copia cifrada; bloqueo optimista transaccional para evitar
 * que dos pestañas sobrescriban notas por accidente. */
const DB_NAME='cuaderno-docente-v1';
const STORE='vault';
const DROPBOX_KEY='dropbox-credential-v1';

function durableWrite(db){
  try{
    return db.transaction(STORE,'readwrite',{durability:'strict'});
  }catch(error){
    if(!(error instanceof TypeError))throw error;
    return db.transaction(STORE,'readwrite');
  }
}

export function sameEnvelope(a,b){
  if(a===null||a===undefined||b===null||b===undefined)return (a??null)===(b??null);
  return a.format===b.format&&a.version===b.version&&a.kdf===b.kdf&&
    a.iterations===b.iterations&&a.salt===b.salt&&a.iv===b.iv&&a.data===b.data;
}
export class EnvelopeConflictError extends Error{
  constructor(){
    super('Otra pestaña o proceso ha modificado el cuaderno. NO se ha sobrescrito ninguna nota. Cierra esta pestaña y vuelve a abrir el cuaderno para cargar la versión más reciente.');
    this.name='EnvelopeConflictError';this.code='ENVELOPE_CONFLICT';
  }
}
export async function openDb(){
  if(!('indexedDB' in globalThis))throw new Error('Este navegador no admite IndexedDB.');
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,1);
    req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE);};
    req.onsuccess=()=>{const db=req.result;db.onversionchange=()=>db.close();resolve(db);};
    req.onerror=()=>reject(req.error||new Error('No se puede abrir el almacenamiento.'));
    req.onblocked=()=>reject(new Error('Cierra las otras pestañas del cuaderno.'));
  });
}
export async function readEnvelope(db){return new Promise((resolve,reject)=>{
  const t=db.transaction(STORE,'readonly'),r=t.objectStore(STORE).get('main');
  r.onsuccess=()=>resolve(r.result??null);r.onerror=()=>reject(r.error||new Error('No se puede leer el cuaderno.'));
  t.onabort=()=>reject(t.error||new Error('Lectura interrumpida.'));
});}
/**
 * expected es obligatorio: null = almacén vacío; objeto = versión exacta que se leyó.
 * Leer y escribir EN LA MISMA transacción evita carreras entre pestañas.
 */
export async function writeEnvelope(db,envelope,expected,expectedDropbox=undefined){return new Promise((resolve,reject)=>{
  let settled=false;
  if(expected===undefined){reject(new Error('Falta la versión esperada: se ha rechazado un guardado inseguro.'));return;}
  const done=(err)=>{if(settled)return;settled=true;err?reject(err):resolve();};
  let t;
  try { t=durableWrite(db); }catch(e){done(e);return;}
  t.oncomplete=()=>done();
  t.onerror=()=>done(t.error||new Error('Fallo al guardar.'));
  t.onabort=()=>done(t.error||new Error('Guardado interrumpido.'));
  const store=t.objectStore(STORE);
  const abort=e=>{done(e);try{t.abort();}catch{}};
  const get=store.get('main');
  get.onerror=()=>abort(get.error||new Error('No se ha podido verificar la copia anterior.'));
  function finish(previous){
    try{
      // A key change or empty installation invalidates any stale device link.
      if(!previous||previous.salt!==envelope.salt||previous.iterations!==envelope.iterations)store.delete(DROPBOX_KEY);
      store.put(envelope,'main');
    }catch(e){abort(e);}
  }
  get.onsuccess=()=>{
    const previous=get.result??null;
    if(!sameEnvelope(previous,expected)){abort(new EnvelopeConflictError());return;}
    if(expectedDropbox===undefined){finish(previous);return;}
    // Incoming sync must also compare the link inside this same transaction.
    const link=store.get(DROPBOX_KEY);
    link.onerror=()=>abort(link.error||new Error('No se ha podido verificar la vinculación.'));
    link.onsuccess=()=>{
      const current=link.result??null;
      if(!current||!expectedDropbox||current.version!==expectedDropbox.version||
        current.bookId!==expectedDropbox.bookId||!sameEnvelope(current.envelope,expectedDropbox.envelope)){
        abort(new EnvelopeConflictError());return;
      }
      finish(previous);
    };
  };
});}

/** Solo para restauraciones: conserva el sobre cifrado previo y sustituye el principal
 * en UNA transacción. Una restauración fallida no debe borrar el cuaderno anterior. */
const RECOVERY_KEY='pre-restore';
export function readRecoveryEnvelope(db){return new Promise((resolve,reject)=>{
  let t,record=null;
  try{t=db.transaction(STORE,'readonly');}catch(e){reject(e);return;}
  t.oncomplete=()=>resolve(record);
  t.onerror=()=>reject(t.error||new Error('No se puede leer el punto de recuperación.'));
  t.onabort=()=>reject(t.error||new Error('Lectura de recuperación interrumpida.'));
  const req=t.objectStore(STORE).get(RECOVERY_KEY);
  req.onsuccess=()=>{record=req.result??null;};
  req.onerror=()=>reject(req.error||new Error('No se puede recuperar la copia anterior.'));
});}

export function replaceEnvelopeWithRecovery(db,envelope,expected){return new Promise((resolve,reject)=>{
  if(expected===undefined){reject(new Error('Falta la versión esperada para restaurar.'));return;}
  let t,rescue=null,settled=false;
  const done=err=>{if(settled)return;settled=true;err?reject(err):resolve(rescue);};
  try{t=durableWrite(db);}catch(e){done(e);return;}
  t.oncomplete=()=>done();
  t.onerror=()=>done(t.error||new Error('No se pudo restaurar el cuaderno.'));
  t.onabort=()=>done(t.error||new Error('Restauración interrumpida.'));
  const store=t.objectStore(STORE),get=store.get('main');
  get.onerror=()=>{done(get.error||new Error('No se pudo comprobar la versión actual.'));try{t.abort();}catch{}};
  get.onsuccess=()=>{
    const previous=get.result??null;
    if(!sameEnvelope(previous,expected)){
      done(new EnvelopeConflictError());try{t.abort();}catch{}return;
    }
    try{
      if(previous){rescue={version:1,createdAt:new Date().toISOString(),envelope:previous};store.put(rescue,RECOVERY_KEY);}
      else store.delete(RECOVERY_KEY);
      store.delete(DROPBOX_KEY);
      store.put(envelope,'main');
    }catch(e){done(e);try{t.abort();}catch{}}
  };
});}

/** Intercambia la copia restaurada con la copia de rescate, verificando ambas
 * versiones en la misma transacción para que otra pestaña no invalide la operación. */
export function swapRecoveryEnvelope(db,expectedMain,expectedRecovery,replacement=expectedRecovery?.envelope){return new Promise((resolve,reject)=>{
  if(expectedMain===undefined||!expectedRecovery?.envelope){reject(new Error('Falta una versión verificada para recuperar.'));return;}
  let t,rescue=null,settled=false,main,previous,mainRead=false,recoveryRead=false;
  const done=err=>{if(settled)return;settled=true;err?reject(err):resolve(rescue);};
  try{t=durableWrite(db);}catch(e){done(e);return;}
  t.oncomplete=()=>done();
  t.onerror=()=>done(t.error||new Error('No se pudo recuperar el cuaderno.'));
  t.onabort=()=>done(t.error||new Error('Recuperación interrumpida.'));
  const store=t.objectStore(STORE);
  const verify=()=>{
    if(!mainRead||!recoveryRead)return;
    if(!sameEnvelope(main??null,expectedMain)||!previous||previous.version!==1||
      previous.createdAt!==expectedRecovery.createdAt||!sameEnvelope(previous.envelope,expectedRecovery.envelope)){
      done(new EnvelopeConflictError());try{t.abort();}catch{}return;
    }
    try{
      if(main){rescue={version:1,createdAt:new Date().toISOString(),envelope:main};store.put(rescue,RECOVERY_KEY);}
      else store.delete(RECOVERY_KEY);
      store.delete(DROPBOX_KEY);
      store.put(replacement,'main');
    }catch(e){done(e);try{t.abort();}catch{}}
  };
  const a=store.get('main'),b=store.get(RECOVERY_KEY);
  a.onsuccess=()=>{main=a.result??null;mainRead=true;verify();};
  b.onsuccess=()=>{previous=b.result??null;recoveryRead=true;verify();};
  a.onerror=b.onerror=()=>{done(new Error('No se ha podido comprobar el punto de recuperación.'));try{t.abort();}catch{}};
});}

/** Acuse local de exportación: solo se crea si el selector confirmó la escritura del
 * archivo. No indica sincronización efectiva con OneDrive/iCloud. No contiene notas. */
const EXPORT_RECEIPT_KEY='last-verified-export-v1';
export function readExportReceipt(db){return new Promise((resolve,reject)=>{
  let t,value=null;
  try{t=db.transaction(STORE,'readonly');}catch(e){reject(e);return;}
  t.oncomplete=()=>resolve(value);
  t.onerror=()=>reject(t.error||new Error('No se pudo leer el registro de exportación.'));
  t.onabort=()=>reject(t.error||new Error('Lectura de exportación interrumpida.'));
  const r=t.objectStore(STORE).get(EXPORT_RECEIPT_KEY);
  r.onsuccess=()=>{value=r.result??null;};
});}
export function recordExportReceipt(db,receipt,expected){return new Promise((resolve,reject)=>{
  if(!receipt||receipt.version!==1||!receipt.bookId||!receipt.head||!receipt.exportedAt||expected===undefined){
    reject(new Error('Registro de exportación incompleto.'));return;
  }
  let t,settled=false;
  const done=e=>{if(settled)return;settled=true;e?reject(e):resolve();};
  try{t=durableWrite(db);}catch(e){done(e);return;}
  t.oncomplete=()=>done();
  t.onerror=()=>done(t.error||new Error('No se pudo registrar la exportación.'));
  t.onabort=()=>done(t.error||new Error('Registro de exportación interrumpido.'));
  const store=t.objectStore(STORE),r=store.get('main');
  r.onerror=()=>{done(r.error);try{t.abort();}catch{}};
  r.onsuccess=()=>{
    if(!sameEnvelope(r.result??null,expected)){
      done(new EnvelopeConflictError());try{t.abort();}catch{}return;
    }
    try{store.put(receipt,EXPORT_RECEIPT_KEY);}catch(e){done(e);try{t.abort();}catch{}}
  };
});}

/** Device-local credential, separate from notebook, export and rescue.
 * Only ciphertext is accepted. All writes check the exact notebook revision.
 */
function validDropboxRecord(record,main){
  const e=record?.envelope;
  return record?.version===1&&typeof record.bookId==='string'&&record.bookId.length>0&&record.bookId.length<=128&&
    Object.keys(record).sort().join(',')==='bookId,envelope,version'&&
    e&&Object.keys(e).sort().join(',')==='data,format,iterations,iv,kdf,salt,version'&&
    e.format==='CuadernoDocenteEncrypted'&&e.version===1&&e.kdf==='PBKDF2-SHA-256'&&
    e.iterations===600000&&main?.iterations===e.iterations&&e.salt===main.salt&&
    typeof e.iv==='string'&&/^[A-Za-z0-9+/]{16}$/.test(e.iv)&&
    typeof e.data==='string'&&e.data.length>=24&&e.data.length<=24000&&/^[A-Za-z0-9+/]+={0,2}$/.test(e.data);
}
export function readDropboxCredential(db){return new Promise((resolve,reject)=>{
  let t,value=null;
  try{t=db.transaction(STORE,'readonly');}catch(e){reject(e);return;}
  t.oncomplete=()=>resolve(value);
  t.onerror=()=>reject(t.error||new Error('Dropbox credential read failed.'));
  t.onabort=()=>reject(t.error||new Error('Dropbox credential read aborted.'));
  const r=t.objectStore(STORE).get(DROPBOX_KEY);r.onsuccess=()=>{value=r.result??null;};
});}
export function writeDropboxCredential(db,record,expected){return new Promise((resolve,reject)=>{
  if(expected===undefined||record!==null&&!validDropboxRecord(record,expected)){
    reject(new Error('Invalid encrypted Dropbox credential.'));return;
  }
  let t,settled=false;
  const done=e=>{if(settled)return;settled=true;e?reject(e):resolve();};
  try{t=durableWrite(db);}catch(e){done(e);return;}
  t.oncomplete=()=>done();
  t.onerror=()=>done(t.error||new Error('Dropbox credential write failed.'));
  t.onabort=()=>done(t.error||new Error('Dropbox credential write aborted.'));
  const store=t.objectStore(STORE),r=store.get('main');
  const abort=e=>{done(e);try{t.abort();}catch{}};
  r.onerror=()=>abort(r.error||new Error('Cannot check local revision.'));
  r.onsuccess=()=>{
    if(!sameEnvelope(r.result??null,expected)){abort(new EnvelopeConflictError());return;}
    try{if(record===null)store.delete(DROPBOX_KEY);else store.put(record,DROPBOX_KEY);}catch(e){abort(e);}
  };
});}

/** Install a recovered notebook and its encrypted Dropbox credential together.
 * Never replace an existing notebook or the recovery slot during onboarding.
 */
export function installDropboxNotebook(db,envelope,record){return new Promise((resolve,reject)=>{
  if(!validDropboxRecord(record,envelope)||envelope?.format!=='CuadernoDocenteEncrypted'||
     typeof envelope.data!=='string'||typeof envelope.iv!=='string'){
    reject(new Error('Invalid encrypted Dropbox installation.'));return;
  }
  let t,settled=false;
  const done=e=>{if(settled)return;settled=true;e?reject(e):resolve();};
  try{t=durableWrite(db);}catch(e){done(e);return;}
  t.oncomplete=()=>done();
  t.onerror=()=>done(t.error||new Error('Dropbox installation failed.'));
  t.onabort=()=>done(t.error||new Error('Dropbox installation aborted.'));
  const store=t.objectStore(STORE),r=store.get('main');
  const abort=e=>{done(e);try{t.abort();}catch{}};
  r.onerror=()=>abort(r.error||new Error('Cannot check local notebook.'));
  r.onsuccess=()=>{
    if(r.result!=null){abort(new EnvelopeConflictError());return;}
    try{store.put(envelope,'main');store.put(record,DROPBOX_KEY);}catch(e){abort(e);}
  };
});}

/** Separate encrypted preferences slot. No writes to main, recovery or academic metadata. */
const periodPreferenceSlot=main=>'period-preferences-v1:'+main.salt;
export function readPeriodPreferences(db,main){return new Promise((resolve,reject)=>{
 const t=db.transaction(STORE,'readonly'),r=t.objectStore(STORE).get(periodPreferenceSlot(main));
 r.onsuccess=()=>resolve(r.result??null);r.onerror=()=>reject(r.error);t.onabort=()=>reject(t.error||Error('Lectura interrumpida.'));
});}
export function writePeriodPreferences(db,main,expected,envelope){return new Promise((resolve,reject)=>{
 const t=durableWrite(db),store=t.objectStore(STORE),key=periodPreferenceSlot(main);
 let saved=false;
 t.oncomplete=()=>resolve(saved);t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||Error('Escritura interrumpida.'));
 const m=store.get('main'),p=store.get(key);
 const finish=()=>{
  if(m.readyState!=='done'||p.readyState!=='done')return;
  if(!sameEnvelope(m.result??null,main)||!sameEnvelope(p.result??null,expected))return;
  if(envelope.salt!==main.salt||envelope.iterations!==main.iterations){t.abort();return;}
  store.put(envelope,key);saved=true;
 };
 m.onsuccess=finish;p.onsuccess=finish;
});}
