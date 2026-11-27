/** Cifrado autenticado AES-GCM, clave PBKDF2-SHA-256 derivada exclusivamente en el dispositivo. */
export const LEGACY_KDF_ITERATIONS=310000;
export const KDF_ITERATIONS=600000;
const validIterations=n=>n===LEGACY_KDF_ITERATIONS||n===KDF_ITERATIONS;
// Keep KDF metadata with the non-exportable key, never with the password.
const keyInfo=new WeakMap();
const bytes=n=>crypto.getRandomValues(new Uint8Array(n));
const encode=u=>{let s='';for(const b of u)s+=String.fromCharCode(b);return btoa(s);};
const decode=s=>Uint8Array.from(atob(s),x=>x.charCodeAt(0));
/** 192 random bits, generated locally; never persisted or sent to any service. */
export function generateStrongPassphrase(){return encode(bytes(24)).replace(/\+/g,'-').replace(/\//g,'_');}
export async function deriveKey(password,salt,iterations=KDF_ITERATIONS){
  if(typeof password!=='string'||password.length<12)throw new Error('La contraseña debe tener al menos 12 caracteres.');
  if(!(salt instanceof Uint8Array)||salt.length!==16)throw new Error('Sal inválida.');
  if(!validIterations(iterations))throw new Error('Parámetros KDF no admitidos.');
  const base=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
  const key=await crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  keyInfo.set(key,{iterations,salt:encode(salt)});return key;
}
export async function createVault(password,doc){
  const salt=bytes(16),key=await deriveKey(password,salt);
  return {key,envelope:await seal(doc,key,salt)};
}
export function keyIterations(key){return keyInfo.get(key)?.iterations??null;}
export async function seal(doc,key,salt,iterations=undefined,additionalData=null){
  const info=keyInfo.get(key);
  if(!info||!(salt instanceof Uint8Array)||encode(salt)!==info.salt||
    (iterations!==undefined&&iterations!==info.iterations))throw new Error('Clave o parametros KDF inconsistentes.');
  iterations=info.iterations;
  const iv=bytes(12);
  const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,...(additionalData?{additionalData:new TextEncoder().encode(additionalData)}:{})},key,new TextEncoder().encode(JSON.stringify(doc)));
  return {format:'CuadernoDocenteEncrypted',version:1,kdf:'PBKDF2-SHA-256',iterations,salt:encode(salt),iv:encode(iv),data:encode(new Uint8Array(encrypted))};
}
export function validateEnvelope(e){
  if(!e||e.format!=='CuadernoDocenteEncrypted'||e.version!==1||e.kdf!=='PBKDF2-SHA-256'||!validIterations(e.iterations)||typeof e.salt!=='string'||typeof e.iv!=='string'||typeof e.data!=='string')throw new Error('Copia cifrada no compatible o mal formada.');
  const salt=decode(e.salt),iv=decode(e.iv);
  if(salt.length!==16||iv.length!==12)throw new Error('Parámetros de cifrado inválidos.');
  return {salt,iv};
}
export async function unlockVault(password,envelope,additionalData=null){
  const {salt,iv}=validateEnvelope(envelope);
  const key=await deriveKey(password,salt,envelope.iterations);
  try{
    const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv,...(additionalData?{additionalData:new TextEncoder().encode(additionalData)}:{})},key,decode(envelope.data));
    return {key,salt,doc:JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(plain))};
  }catch{throw new Error('Contraseña incorrecta o datos cifrados dañados.');}
}
export function saltFromEnvelope(envelope){return validateEnvelope(envelope).salt;}

/** Prepare a verified stronger envelope without writing or removing the old one.
 * Caller must validate the notebook and use a transactional CAS to replace it.
 * A new password is required so old copies do not weaken the new credential.
 */
export async function prepareVaultUpgrade(oldPassword,newPassword,envelope){
  if(typeof newPassword!=='string'||newPassword.length<16||newPassword===oldPassword)
    throw new Error('Choose a new, distinct passphrase of at least 16 characters.');
  const previous=await unlockVault(oldPassword,envelope);
  const upgraded=await createVault(newPassword,previous.doc);
  const verified=await unlockVault(newPassword,upgraded.envelope);
  if(JSON.stringify(previous.doc)!==JSON.stringify(verified.doc))throw new Error('Vault upgrade verification failed.');
  return {...upgraded,salt:verified.salt,doc:verified.doc};
}
