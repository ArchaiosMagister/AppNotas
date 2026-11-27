import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=name=>readFile(new URL('../'+name,import.meta.url),'utf8');
test('Dropbox UI onboarding is gated and added to offline cache',async()=>{
  const [app,sw,session]=await Promise.all(['app.js','sw.js','src/dropbox-session.js'].map(read));
  assert.match(session,/DROPBOX_CLIENT_ID='';/);
  assert(app.includes("dropboxConfigured(location.origin)&&isNew"));
  assert(app.includes("if(dropboxCallback?.mode==='link')"));
  assert(app.includes('writeDropboxCredential(STATE.db,null,STATE.envelope)'));
  assert(app.includes('prepareDropboxNavigation({clientId:DROPBOX_CLIENT_ID'));
  assert(app.includes('captureDropboxCallback({location,history:window.history'));
  assert(sw.includes("'./src/dropbox-onboarding.js'"));
  assert(app.includes("caches.open('cuaderno-docente-static-v187-dev')"));
});
