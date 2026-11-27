/** Dropbox OAuth for a public client. No app secret; no persistent plaintext tokens.
 * UI must retain pending authorization only in sessionStorage, consume once,
 * and remove callback parameters before calling completeAuthorization.
 */
import {seal,validateEnvelope,KDF_ITERATIONS,keyIterations} from './vault.js';
const AUTH='https://www.dropbox.com/oauth2/authorize';
const TOKEN='https://api.dropboxapi.com/oauth2/token';
import {DROPBOX_ORIGIN,validDropboxRedirect} from './dropbox-config.js';
const REDIRECT=DROPBOX_ORIGIN+'/';
const AAD='AppNotas/DropboxCredential/v1';
const SCOPE='files.content.read files.content.write';
const TTL=10*60*1000;
const enc=new TextEncoder();
const b64url=b=>btoa(String.fromCharCode(...b)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const random=()=>b64url(crypto.getRandomValues(new Uint8Array(32)));
const validKey=k=>typeof k==='string'&&/^[a-zA-Z0-9_-]{5,128}$/.test(k);
const validToken=t=>typeof t==='string'&&t.length>0&&t.length<=8192&&!/[\s\x00-\x1f]/.test(t);
const validNonce=s=>typeof s==='string'&&/^[A-Za-z0-9_-]{43}$/.test(s);
const checkKey=k=>{if(!validKey(k))throw new Error('Dropbox app key not configured.');};
export async function beginAuthorization(clientId,now=Date.now(),redirectUri=REDIRECT){
  checkKey(clientId);if(!validDropboxRedirect(redirectUri))throw new Error('Invalid Dropbox redirect.');
  const verifier=random(),state=random();
  const challenge=b64url(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(verifier))));
  const url=new URL(AUTH);
  url.search=new URLSearchParams({client_id:clientId,response_type:'code',redirect_uri:redirectUri,
    code_challenge:challenge,code_challenge_method:'S256',state,token_access_type:'offline',scope:SCOPE}).toString();
  return {url:url.href,pending:{version:1,clientId,verifier,state,createdAt:now,redirectUri}};
}
function validatePending(p,clientId,now){
  if(!p||p.version!==1||p.clientId!==clientId||!validDropboxRedirect(p.redirectUri)||!validNonce(p.state)||!validNonce(p.verifier)||
    !Number.isFinite(p.createdAt)||now<p.createdAt||now-p.createdAt>TTL)throw new Error('Dropbox authorization expired or invalid.');
}
async function tokenRequest(params,fetchImpl,signal){
  const res=await fetchImpl(TOKEN,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams(params).toString(),credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',signal});
  if(!res.ok)throw new Error('Dropbox authorization failed (HTTP '+res.status+').');
  let data;try{data=await res.json();}catch{throw new Error('Invalid Dropbox token response.');}
  if(!validToken(data?.access_token)||String(data.token_type).toLowerCase()!=='bearer'||
    !Number.isFinite(data.expires_in)||data.expires_in<=0||data.expires_in>86400||
    (data.refresh_token!==undefined&&!validToken(data.refresh_token)))throw new Error('Invalid Dropbox credentials.');
  if(typeof data.scope==='string'){
    const actual=new Set(data.scope.split(/\s+/));
    if(SCOPE.split(' ').some(s=>!actual.has(s)))throw new Error('Dropbox permissions are insufficient.');
  }
  return {accessToken:data.access_token,expiresIn:data.expires_in,refreshToken:data.refresh_token};
}
/** The caller must atomically consume the pending record before invoking this. */
export async function completeAuthorization({clientId,pending,callbackUrl,now=Date.now(),fetchImpl=globalThis.fetch,signal}){
  checkKey(clientId);validatePending(pending,clientId,now);
  const url=new URL(callbackUrl);
  if(url.origin+url.pathname!==pending.redirectUri||url.hash||url.searchParams.getAll('state').length!==1||
    url.searchParams.get('state')!==pending.state)throw new Error('Invalid Dropbox authorization callback.');
  if(url.searchParams.has('error'))throw new Error('Dropbox authorization cancelled.');
  const code=url.searchParams.get('code');
  if(url.searchParams.getAll('code').length!==1||!validToken(code))throw new Error('Missing Dropbox authorization code.');
  const result=await tokenRequest({grant_type:'authorization_code',code,client_id:clientId,
    redirect_uri:pending.redirectUri,code_verifier:pending.verifier},fetchImpl,signal);
  if(!result.refreshToken)throw new Error('Dropbox did not grant offline authorization.');
  return result;
}
export async function refreshAuthorization({clientId,refreshToken,fetchImpl=globalThis.fetch,signal}){
  checkKey(clientId);if(!validToken(refreshToken))throw new Error('Missing Dropbox credential.');
  return tokenRequest({grant_type:'refresh_token',refresh_token:refreshToken,client_id:clientId},fetchImpl,signal);
}
/** Separate AAD prevents a token envelope from being mistaken for a notebook.
 * This credential is device-local; it must NEVER be included in a sync snapshot.
 */
export async function sealDropboxCredential({clientId,refreshToken},key,salt){
  checkKey(clientId);if(!validToken(refreshToken))throw new Error('Invalid Dropbox credential.');
  if(keyIterations(key)!==KDF_ITERATIONS)throw new Error('Dropbox requires the strengthened vault.');
  return seal({version:1,clientId,refreshToken},key,salt,undefined,AAD);
}
export async function openDropboxCredential(envelope,key,salt,clientId){
  checkKey(clientId);
  const params=validateEnvelope(envelope);
  if(envelope.iterations!==KDF_ITERATIONS||keyIterations(key)!==KDF_ITERATIONS)throw new Error('Dropbox requires the strengthened vault.');
  if(!(salt instanceof Uint8Array)||!params.salt.every((b,i)=>b===salt[i])||salt.length!==params.salt.length)throw new Error('Dropbox credential belongs to another vault.');
  let data;
  try{
    const raw=Uint8Array.from(atob(envelope.data),x=>x.charCodeAt(0));
    const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:params.iv,additionalData:enc.encode(AAD)},key,raw);
    data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(plain));
  }catch{throw new Error('Dropbox credential failed authentication.');}
  if(data?.version!==1||data.clientId!==clientId||!validToken(data.refreshToken))throw new Error('Invalid Dropbox credential.');
  return data.refreshToken;
}
