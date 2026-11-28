const CACHE='cuaderno-docente-static-v216-dev';
const ASSETS=['./','./index.html','./styles.css','./app.js','./manifest.webmanifest','./icons/icon.svg','./icons/icon-192.png','./icons/icon-512.png','./icons/icon-maskable-512.png','./icons/apple-touch-icon.png','./src/pwa-controls.js','./src/model.js','./src/cuaderno.js','./src/planner.js','./src/planner-ui.js','./src/evaluation-groups.js','./src/evaluation-ui.js','./src/evaluation-workspace.js','./src/notebook-evaluation-notice.js','./src/evaluation-period-board.js','./src/evaluation-session-presentation.js','./src/student-link-ui.js','./src/extracurricular.js','./src/extracurricular-export.js','./src/extracurricular-ui.js','./src/timetable-export.js','./src/patio-rotation.js','./src/attitude-template.js','./src/rubric-xlsx.js','./vendor/jszip.min.js','./src/calculations.js','./src/statistics.js','./src/csv.js','./src/rubric-import.js','./src/rubric-ui.js','./src/history.js','./src/dropbox-conflict.js','./src/dropbox-config.js','./src/dropbox-onboarding.js','./src/dropbox-session.js','./src/period-preferences.js','./src/dropbox-controller.js','./src/dropbox-local.js','./src/dropbox-sync.js','./src/dropbox-oauth.js','./src/vault.js','./src/storage.js','./src/diagnostics.js','./src/curriculum-data.js','./src/official-competencies.js','./data/curriculos/gr1y2-nuevo.pdf','./data/curriculos/lat1y2-nuevo.pdf','./data/curriculos/lat4.pdf','./data/curriculos/lat2-2022.pdf'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
});
self.addEventListener('activate',event=>{
  event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('cuaderno-docente-static-')&&k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()]));
});
/** Safari/WebKit rechaza respuestas de navegación con la marca redirect,
 * aunque Cloudflare haya seguido la redirección de /index.html a /.
 * Conservar exactamente el cuerpo, código y cabeceras, pero sin los metadatos
 * del redirect en la respuesta entregada por el service worker. */
function safeNavigationResponse(response,request){
  if(request.mode!=='navigate'||!response?.ok||!response.redirected)return response;
  const target=new URL(response.url);
  const scope=new URL(self.registration.scope);
  const home=new URL('./',scope);
  const index=new URL('index.html',scope);
  // Solo normalizar redirecciones del shell dentro del mismo origen y ámbito.
  if(target.origin!==scope.origin||![home.pathname,index.pathname].includes(target.pathname))return response;
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers:response.headers});
}
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET'||new URL(req.url).origin!==self.location.origin)return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    const hit=await cache.match(req);
    if(hit)return safeNavigationResponse(hit,req);
    const response=await fetch(req);
    return safeNavigationResponse(response,req);
  })());
});

// No interrumpir una sesión de calificaciones: la activación exige decisión explícita.
self.addEventListener('message',event=>{
  if(event.data?.type==='SKIP_WAITING')self.skipWaiting();
});
