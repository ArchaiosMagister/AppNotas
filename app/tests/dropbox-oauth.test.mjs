import test from 'node:test';
import assert from 'node:assert/strict';
import {createVault,saltFromEnvelope,unlockVault} from '../src/vault.js';
import {beginAuthorization,completeAuthorization,refreshAuthorization,sealDropboxCredential,openDropboxCredential} from '../src/dropbox-oauth.js';
const clientId='test-app-key',now=1000,refreshToken='fictional-refresh-token';
const tokenResponse=()=>new Response(JSON.stringify({access_token:'fake-access',refresh_token:refreshToken,token_type:'bearer',expires_in:14400,scope:'files.content.read files.content.write'}));
test('PKCE uses unique random state and verifier, S256 and minimum scopes',async()=>{
  const a=await beginAuthorization(clientId,now),b=await beginAuthorization(clientId,now);
  const url=new URL(a.url),p=url.searchParams;
  assert.equal(url.origin,'https://www.dropbox.com');
  assert.equal(p.get('code_challenge_method'),'S256');
  const expected=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(a.pending.verifier))).toString('base64url');
  assert.equal(p.get('code_challenge'),expected);
  assert.equal(p.get('scope'),'files.content.read files.content.write');
  assert.equal(p.get('token_access_type'),'offline');
  assert.equal(p.get('state'),a.pending.state);
  assert.notEqual(a.pending.state,b.pending.state);
  assert.notEqual(a.pending.verifier,b.pending.verifier);
  assert.equal(a.url.includes(a.pending.verifier),false);
});
test('callback rejects wrong state, stale state, wrong origin and duplicate code before fetch',async()=>{
  const {pending}=await beginAuthorization(clientId,now);
  const base='https://appnotas-docente.pages.dev/?code=fake&state='+pending.state;
  let calls=0;
  const fetchImpl=async()=>{calls++;return tokenResponse();};
  for(const options of [{callbackUrl:base+'x'},{callbackUrl:base+'&code=second'},{callbackUrl:base.replace('appnotas-docente.pages.dev','example.org')},{now:now+600001}]){
    await assert.rejects(completeAuthorization({clientId,pending,callbackUrl:base,now,fetchImpl,...options}));
  }
  assert.equal(calls,0);
  const result=await completeAuthorization({clientId,pending,callbackUrl:base,now,fetchImpl:async(url,init)=>{
    assert.equal(url,'https://api.dropboxapi.com/oauth2/token');
    const p=new URLSearchParams(init.body);
    assert.equal(p.get('code_verifier'),pending.verifier);
    assert.equal(p.get('client_secret'),null);assert.equal(init.redirect,'error');
    return tokenResponse();
  }});
  assert.equal(result.refreshToken,refreshToken);
});
test('refresh is direct and credential is encrypted with separate context',async()=>{
  const result=await refreshAuthorization({clientId,refreshToken,fetchImpl:async(url,init)=>{
    assert.equal(url,'https://api.dropboxapi.com/oauth2/token');
    const p=new URLSearchParams(init.body);
    assert.equal(p.get('grant_type'),'refresh_token');assert.equal(p.get('refresh_token'),refreshToken);
    assert.equal(p.get('client_secret'),null);
    return tokenResponse();
  }});
  assert.equal(result.accessToken,'fake-access');
  const password='fictional strong long password';
  const {key,envelope}=await createVault(password,{demo:true}),salt=saltFromEnvelope(envelope);
  const credential=await sealDropboxCredential({clientId,refreshToken},key,salt);
  assert.equal(JSON.stringify(credential).includes(refreshToken),false);
  assert.equal(await openDropboxCredential(credential,key,salt,clientId),refreshToken);
  await assert.rejects(openDropboxCredential(credential,key,salt,'another-app-key'));
  await assert.rejects(unlockVault(password,credential));
  await assert.rejects(openDropboxCredential(envelope,key,salt,clientId));
});
test('token endpoint errors and missing scopes fail closed',async()=>{
  await assert.rejects(refreshAuthorization({clientId,refreshToken,fetchImpl:async()=>new Response('{}',{status:401})}));
  await assert.rejects(refreshAuthorization({clientId,refreshToken,fetchImpl:async()=>new Response(JSON.stringify({access_token:'fake',token_type:'bearer',expires_in:100,scope:'files.content.read'}))}));
});

test('preview OAuth redirect is bound to its pending state and token exchange',async()=>{
  const redirect='https://feature-dropbox-e2ee-sync.appnotas-docente.pages.dev/';
  const {url,pending}=await beginAuthorization(clientId,now,redirect);
  assert.equal(new URL(url).searchParams.get('redirect_uri'),redirect);
  await assert.rejects(completeAuthorization({clientId,pending,now,callbackUrl:'https://appnotas-docente.pages.dev/?code=fake&state='+pending.state,fetchImpl:async()=>{throw Error('unexpected network');}}));
  await completeAuthorization({clientId,pending,now,callbackUrl:redirect+'?code=fake&state='+pending.state,fetchImpl:async(url,init)=>{
    assert.equal(new URLSearchParams(init.body).get('redirect_uri'),redirect);return tokenResponse();
  }});
  await assert.rejects(beginAuthorization(clientId,now,'https://untrusted.example/'));
});
