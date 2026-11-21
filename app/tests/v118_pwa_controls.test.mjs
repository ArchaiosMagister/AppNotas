import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {installInstructions,mayReloadForUpdate} from '../src/pwa-controls.js';
const read=name=>readFile(new URL('../'+name,import.meta.url),'utf8');

test('PWA v1.19 declara iconos instalables, Apple y máscara',async()=>{
  const manifest=JSON.parse(await read('manifest.webmanifest'));
  assert.equal(manifest.display,'standalone');
  for(const size of ['192x192','512x512'])assert(manifest.icons.some(x=>x.sizes===size&&x.purpose==='any'&&x.type==='image/png'));
  assert(manifest.icons.some(x=>x.sizes==='512x512'&&x.purpose==='maskable'));
  for(const file of ['icon-192.png','icon-512.png','icon-maskable-512.png','apple-touch-icon.png']){
    const bytes=await readFile(new URL('../icons/'+file,import.meta.url));
    assert.equal(bytes.subarray(1,4).toString(),'PNG');assert(bytes.length>1000);
  }
  const html=await read('index.html');
  assert(html.includes('rel="apple-touch-icon"'));assert(html.includes('rel="manifest"'));
});

test('los botones aparecen en pantalla bloqueada y desbloqueada, con iconos legibles',async()=>{
  const js=await read('app.js');
  assert(js.includes('data-pwa-install'));assert(js.includes('data-pwa-update'));
  assert(js.includes('Instalar aplicación'));assert(js.includes('Buscar actualizaciones'));
  assert(js.includes('aria-label="Instalación y actualizaciones"'));
  assert(js.includes('wirePwaButtons();'));
  assert(js.includes('${pwaButtons()}<form id="unlock-form">'));
  assert(js.includes('<div class="header-tools-heading">Aplicación</div>${pwaButtons()}'),'Los controles PWA siguen accesibles en Herramientas');
  assert(js.includes('data-shell-disclosure="tools"'));
  assert(js.includes('installIcon='));assert(js.includes('updateIcon='));
});

test('nunca se activa automáticamente el service worker pendiente; sí al recibir mensaje explícito',async()=>{
  const sw=await read('sw.js');
  const installing=sw.match(/self\.addEventListener\('install'[\s\S]*?\n\}\);/)?.[0];
  assert(installing);assert(!installing.includes('skipWaiting'));
  assert(sw.includes("event.data?.type==='SKIP_WAITING'"));
  const js=await read('app.js');
  assert(js.includes("window.confirm('Hay una nueva versión"));
  assert(js.includes('await STATE.mutationQueue'));
  assert(js.includes('await STATE.saveQueue'));
  assert(js.includes('mayReloadForUpdate(STATE)'));
  assert(js.includes("navigator.serviceWorker.addEventListener('controllerchange'"));
  assert(!js.includes("setInterval("));
});

test('la comprobación de actualización tiene estado sin conexión y consulta registro',async()=>{
  const js=await read('app.js');
  assert(js.includes('navigator.onLine'));
  assert(js.includes('await reg.update()'));
  assert(js.includes('await waitForPwaInstall(reg)'));
  assert(js.includes('reg.waiting&&navigator.serviceWorker.controller'));
  assert(js.includes('updateViaCache:\'none\''));
  assert(js.includes('root.inert=true'));
  assert(js.includes('root.inert=false'));
});

test('bloqueo de recarga durante guardado pendiente, error y cambios',()=>{
  assert(mayReloadForUpdate({pending:0,saving:0,saveError:null,updateReloading:false}));
  for(const x of [{pending:1},{saving:1},{saveError:Error('No escrito')},{updateReloading:true}]){
    assert(!mayReloadForUpdate({pending:0,saving:0,saveError:null,updateReloading:false,...x}));
  }
});

test('guías de instalación identifican correctamente Safari iOS, Safari macOS y Chromium',()=>{
  assert.match(installInstructions('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15','iPhone'),/Safari/);
  assert.match(installInstructions('Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)','iPad'),/pantalla de inicio/);
  assert.match(installInstructions('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15','MacIntel'),/Dock/);
  assert.match(installInstructions('Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36','Linux'),/Chrome/);
});
