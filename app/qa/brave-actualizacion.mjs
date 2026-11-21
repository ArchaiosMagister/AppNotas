import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tab} from './cdp-tab.mjs';

const port=process.env.PORT||'4176';
const base='http://127.0.0.1:'+port+'/';
const password='Cuaderno ficticio para actualización';
const original=resolve(process.argv[2]||'../CuadernoDocente_v0.9','server.mjs');
const candidate=fileURLToPath(new URL('../server.mjs',import.meta.url));

async function start(path){
  const child=spawn(process.execPath,[path],{env:{...process.env,PORT:port},stdio:['ignore','pipe','inherit']});
  await Promise.race([
    once(child.stdout,'data'),
    once(child,'exit').then(([code])=>{throw new Error('El servidor terminó con código '+code);})
  ]);
  return child;
}
async function stop(child){
  if(!child||child.exitCode!==null||child.signalCode!==null)return;
  child.kill();
  await once(child,'exit');
}

const page=await tab(base,password);
let server;
try{
  server=await start(original);
  await page.open();
  assert.equal(await page.run("Boolean(document.querySelector('#confirm-password'))"),true,'Usa un perfil desechable vacío.');
  await page.unlock(password,true);
  await page.wait('Boolean(navigator.serviceWorker.controller)');
  await page.edit('.note-input','6,25');
  await page.wait("document.querySelector('.note-input').defaultValue==='6,25'");
  assert.match(await page.run('document.title'),/v0\.9/);
  await stop(server);
  server=await start(candidate);
  await page.run('navigator.serviceWorker.ready.then(reg=>reg.update()).then(()=>true)');
  await page.wait("caches.keys().then(keys=>keys.includes('cuaderno-docente-static-v10-rc1')&&!keys.includes('cuaderno-docente-static-v09'))");
  await page.open();await page.unlock();
  assert.match(await page.run('document.title'),/v1\.0-rc1/);
  assert.equal(await page.run("document.querySelector('.note-input').value"),'6,25');
  const {installabilityErrors}=await page.send('Page.getInstallabilityErrors');
  console.log('Diagnóstico Chromium de instalación:',JSON.stringify(installabilityErrors));
  await stop(server);server=null;
  await page.open();await page.unlock();
  assert.equal(await page.run("document.querySelector('.note-input').value"),'6,25');
  console.log('Actualización real v0.9 → v1.0-rc1: caché sustituida, misma nota desde IndexedDB y recarga con el servidor detenido.');
}finally{
  await stop(server);
  page.close();
}
