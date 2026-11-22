import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const html=readFileSync(path.join(root,'CuadernoDocente_sin_instalar.html'),'utf8');
const getHash=value=>createHash('sha256').update(value).digest('base64');
const scriptBodies=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x=>x[1]);
const modulePaths=()=>{
 const found=new Set();const queue=['app.js'];
 while(queue.length){
  const current=queue.pop();if(found.has(current))continue;
  assert(existsSync(path.join(root,current)),`El módulo fuente ${current} no existe`);
  found.add(current);
  const source=readFileSync(path.join(root,current),'utf8');
  for(const [,relative] of source.matchAll(/\b(?:import|export)\s+(?:[^;\n]*?\s+from\s+)?['"](\.[^'"]+)['"]/g)){
   const dependency=path.posix.normalize(path.posix.join(path.posix.dirname(current),relative));
   queue.push(dependency);
  }
 }
 return [...found].sort();
};

test('HTML autónomo incorpora todos los módulos importados y no deja dependencias sin resolver',()=>{
 assert.equal(scriptBodies.length,2,'Debe contener un script de JSZip y otro de aplicación');
 const appRuntime=scriptBodies[1];
 // Este HTML es una instantánea histórica v1.19 y no se despliega en Cloudflare:
 // las nuevas dependencias deben precargarse en la PWA canónica, no fingir que
 // se añadieron retroactivamente al archivo autónomo ya publicado.
 const sources=modulePaths();
 const sw=readFileSync(path.join(root,'sw.js'),'utf8');
 for(const item of sources){
  const embedded=`${JSON.stringify(item)}:function(require,module,exports)`;
  assert(appRuntime.includes(embedded)||sw.includes(`'./${item}'`),
   `Falta ${item}: ni incluido en el HTML histórico ni precargado en la PWA`);
 }
 assert(appRuntime.includes('"src/statistics.js":function(require,module,exports)'),
  'El paquete autónomo histórico conserva el módulo de estadísticas');
 assert(appRuntime.includes("__require('app.js')"),'La aplicación no se inicia');
});

test('CSP del archivo autónomo autoriza el contenido exacto, sin relajar seguridad',()=>{
 const policy=html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)">/)?.[1];
 assert(policy,'Falta Content Security Policy');
 for(const script of scriptBodies){
  assert(policy.includes(`script-src 'sha256-${getHash(script)}'`)||policy.includes(`'sha256-${getHash(script)}'`),
   'CSP desactualizada respecto a uno de los scripts incrustados');
 }
 const css=html.match(/<style>([\s\S]*?)<\/style>/)?.[1];
 assert(css);
 assert(policy.includes(`'sha256-${getHash(css)}'`),'CSP de CSS desactualizada');
 assert(policy.includes("connect-src 'none'"),'El HTML autónomo no debe depender de conexiones externas');
});

test('El paquete autónomo contiene los currículos y no carga scripts externos',()=>{
 assert(!/<script\b[^>]*\bsrc\s*=/.test(html),'La versión sin instalar no debe cargar scripts externos');
 assert(scriptBodies[1].includes('gr1y2-nuevo.pdf'));
 assert(scriptBodies[1].includes('lat1y2-nuevo.pdf'));
 assert(scriptBodies[1].includes('lat4.pdf'));
 assert(scriptBodies[1].includes('lat2-2022.pdf'));
});
