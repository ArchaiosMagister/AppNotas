import test from 'node:test';
import assert from 'node:assert/strict';
import {createDropboxSession,createSessionTokenProvider,dropboxConfigured} from '../src/dropbox-session.js';
test('a release without Dropbox app key performs no credential or network work',async()=>{
  let loads=0;const statuses=[];
  const session=createDropboxSession({state:{key:{}},origin:'https://appnotas-docente.pages.dev',
    onStatus:s=>statuses.push(s.status),load:async()=>{loads++;throw Error();}});
  await session.start();assert.equal(loads,0);assert.deepEqual(statuses,['not-configured']);
  assert.equal(dropboxConfigured('https://appnotas-docente.pages.dev'),false);
  assert.equal(session.active(),false);
});
test('session refresh coalesces calls and expires access tokens before use',async()=>{
  let now=0,calls=0;
  const p=createSessionTokenProvider({clientId:'fictional',refreshToken:'fictional-secret',now:()=>now,
    refresh:async()=>({accessToken:'token-'+(++calls),expiresIn:120})});
  assert.deepEqual(await Promise.all([p.getAccessToken(),p.getAccessToken()]),['token-1','token-1']);
  now=30000;assert.equal(await p.getAccessToken(),'token-1');
  now=61000;assert.equal(await p.getAccessToken(),'token-2');
  p.stop();await assert.rejects(p.getAccessToken());
});
test('locking while refresh is in progress does not revive credentials',async()=>{
  let release,entered;const begun=new Promise(r=>entered=r);
  const p=createSessionTokenProvider({clientId:'fictional',refreshToken:'fictional-secret',
    refresh:async()=>{entered();return new Promise(r=>release=r);}});
  const pending=p.getAccessToken();await begun;p.stop();
  release({accessToken:'token',expiresIn:120});
  await assert.rejects(pending);await assert.rejects(p.getAccessToken());
});
