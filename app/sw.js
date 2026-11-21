const CACHE='cuaderno-docente-static-v124-dev';
const ASSETS=['./','./index.html','./styles.css','./app.js','./manifest.webmanifest','./icons/icon.svg','./icons/icon-192.png','./icons/icon-512.png','./icons/icon-maskable-512.png','./icons/apple-touch-icon.png','./src/pwa-controls.js','./src/model.js','./src/cuaderno.js','./src/planner.js','./src/planner-ui.js','./src/attitude-template.js','./src/rubric-xlsx.js','./vendor/jszip.min.js','./src/calculations.js','./src/statistics.js','./src/csv.js','./src/rubric-import.js','./src/rubric-ui.js','./src/history.js','./src/vault.js','./src/storage.js','./src/diagnostics.js','./src/curriculum-data.js','./src/official-competencies.js','./data/curriculos/gr1y2-nuevo.pdf','./data/curriculos/lat1y2-nuevo.pdf','./data/curriculos/lat4.pdf','./data/curriculos/lat2-2022.pdf'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
});
self.addEventListener('activate',event=>{
  event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('cuaderno-docente-static-')&&k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()]));
});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET'||new URL(req.url).origin!==self.location.origin)return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    const hit=await cache.match(req);
    if(hit)return hit;
    return fetch(req);
  })());
});

// No interrumpir una sesión de calificaciones: la activación exige decisión explícita.
self.addEventListener('message',event=>{
  if(event.data?.type==='SKIP_WAITING')self.skipWaiting();
});
