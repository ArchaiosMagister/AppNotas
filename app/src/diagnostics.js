/** Comprobación de persistencia entre recargas, sin escribir notas ni claves.
 * Solo se conserva temporalmente un SHA-256 del SOBRE CIFRADO en sessionStorage.
 * No equivale a una prueba de cierre del navegador ni de uso offline real. */
export const RELOAD_PROBE_KEY='cuaderno-docente-reload-probe-v1';
const MAX_AGE_MS=30*60*1000;

export async function envelopeFingerprint(envelope){
  if(!envelope||typeof envelope!=='object')throw new Error('No hay copia cifrada que comprobar.');
  const fields=['format','version','kdf','iterations','salt','iv','data'];
  const canonical=JSON.stringify(fields.map(key=>envelope[key]??null));
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
}
export async function makeReloadProbe(envelope,now=Date.now()){
  if(!Number.isFinite(now)||now<0)throw new Error('Fecha de comprobación inválida.');
  return {version:1,createdAt:now,digest:await envelopeFingerprint(envelope)};
}
export async function evaluateReloadProbe(probe,envelope,now=Date.now()){
  if(!probe||probe.version!==1||!Number.isFinite(probe.createdAt)||typeof probe.digest!=='string'||!/^[a-f0-9]{64}$/.test(probe.digest))
    return {ok:false,reason:'invalid'};
  if(!Number.isFinite(now)||now<probe.createdAt||now-probe.createdAt>MAX_AGE_MS)
    return {ok:false,reason:'expired'};
  if(!envelope)return {ok:false,reason:'missing'};
  return (await envelopeFingerprint(envelope))===probe.digest
    ? {ok:true,reason:'matched'} : {ok:false,reason:'changed'};
}
