/** Recrea el HTML autónomo y sus hashes CSP a partir de los mismos módulos de la PWA.
 * Herramienta de mantenimiento; requiere TypeScript (transpileModule) instalado
 * en el entorno de construcción, pero la app final no depende de TypeScript.
 */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import path from 'node:path';
const require=createRequire(import.meta.url);
let ts;
try{ts=require('typescript');}catch{
  // También admitir una instalación global sin asumir rutas específicas del equipo.
  try{
    const globalRoot=execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim();
    ts=require(path.join(globalRoot,'typescript'));
  }catch{throw new Error('Para regenerar el HTML autónomo instala TypeScript (npm i -D typescript).');}
}
const base=path.resolve(import.meta.dirname,'..');
const read=n=>readFileSync(path.join(base,n),'utf8');
const name='CuadernoDocente_sin_instalar.html';
let html=read(name);
const start=html.indexOf('const __modules=');
const end=html.indexOf('const __cache=Object.create(null);',start);
if(start<0||end<0)throw new Error('No se encuentra la envoltura autónoma conocida.');
const seen=new Set(),queue=['app.js'];
for(let i=0;i<queue.length;i++){
  const file=queue[i];if(seen.has(file))continue;
  if(!existsSync(path.join(base,file)))throw new Error('Módulo ausente: '+file);
  seen.add(file);
  for(const match of read(file).matchAll(/\b(?:import|export)\s+(?:[^;\n]*?\s+from\s+)?['"](\.[^'"]+)['"]/g)){
    queue.push(path.posix.normalize(path.posix.join(path.posix.dirname(file),match[1])));
  }
}
const entries=[...seen].sort().map(file=>{
  const result=ts.transpileModule(read(file),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,allowJs:true}}).outputText;
  return `${JSON.stringify(file)}:function(require,module,exports){\n${result}\n}`;
});
html=html.slice(0,start)+'const __modules={'+entries.join(',\n')+'};\n'+html.slice(end);
html=html.replace(/<style>[\s\S]*?<\/style>/,'<style>'+read('styles.css')+'</style>');
html=html.replace(/CuadernoDocente · v1\.\d+ · sin instalar/,'CuadernoDocente · v1.19 · sin instalar')
  .replace(/CuadernoDocente v1\.\d+ autónomo de pruebas/,'CuadernoDocente v1.19 autónomo de pruebas');
const hashes=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>createHash('sha256').update(m[1]).digest('base64'));
if(hashes.length!==2)throw new Error('Número inesperado de scripts; no se puede construir CSP.');
const style=html.match(/<style>([\s\S]*?)<\/style>/)?.[1];
const styleHash=createHash('sha256').update(style).digest('base64');
const policy=`default-src 'none'; script-src ${hashes.map(h=>`'sha256-${h}'`).join(' ')}; style-src 'sha256-${styleHash}'; img-src data: blob:; font-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`;
html=html.replace(/(<meta http-equiv="Content-Security-Policy" content=")[^"]+("\s*\/?>)/,`$1${policy}$2`);
writeFileSync(path.join(base,name),html);
console.log(`Generado HTML autónomo de ${html.length} caracteres y ${seen.size} módulos con hashes CSP.`);
