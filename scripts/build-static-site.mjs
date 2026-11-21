#!/usr/bin/env node
/**
 * Generador estático común para GitHub Pages y un alojamiento HTTPS aislado.
 * No incorpora cuadernos privados ni requiere servicios externos en build.
 */
import {cp,mkdir,readFile,readdir,rm,lstat,stat,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const repo=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const source=path.join(repo,'app');
const outputName=process.env.APPNOTAS_BUILD_DIR||'dist';
if(!['dist','_site'].includes(outputName)){
  throw new Error('Destino de construcción no autorizado: usar dist o _site.');
}
const output=path.join(repo,outputName);
const files=['index.html','styles.css','app.js','sw.js','manifest.webmanifest'];
const dirs=['icons','src','vendor',path.join('data','curriculos')];
const csp="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";
const headers=[
  '/*',
  '  Content-Security-Policy: '+csp,
  '  X-Content-Type-Options: nosniff',
  '  X-Frame-Options: DENY',
  '  Referrer-Policy: no-referrer',
  '  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()',
  '  Cross-Origin-Resource-Policy: same-origin',
  '',
  '/index.html',
  '  Cache-Control: no-cache, must-revalidate',
  '',
  '/',
  '  Cache-Control: no-cache, must-revalidate',
  '',
  '/sw.js',
  '  Cache-Control: no-cache, no-store, must-revalidate',
  ''
].join('\n');

async function validateNoSymlinks(directory){
  for(const item of await readdir(directory,{withFileTypes:true})){
    const full=path.join(directory,item.name);
    if(item.isSymbolicLink()||!item.isFile()&&!item.isDirectory()){
      throw new Error('Recurso no ordinario: '+path.relative(repo,full));
    }
    if(item.isDirectory())await validateNoSymlinks(full);
  }
}
for(const file of files){
  if(!(await stat(path.join(source,file))).isFile())throw new Error('No existe '+file);
}
for(const dir of dirs){
  const full=path.join(source,dir);
  if(!(await stat(full)).isDirectory())throw new Error('No existe '+dir);
  await validateNoSymlinks(full);
}
const sw=await readFile(path.join(source,'sw.js'),'utf8');
const precache=sw.match(/const ASSETS=\[([^\]]+)\]/)?.[1];
if(!precache)throw new Error('No se encontró el inventario PWA en sw.js');
const assets=[...precache.matchAll(/'(\.[^']+)'/g)].map(m=>m[1]);
if(assets.length<25)throw new Error('Inventario PWA inesperadamente corto');
for(const item of assets){
  if(item==='./')continue;
  const rel=item.replace(/^\.\//,'');
  if(rel.includes('..')||path.isAbsolute(rel))throw new Error('Ruta SW insegura '+rel);
  if(!(await stat(path.join(source,rel))).isFile())throw new Error('Recurso PWA faltante '+rel);
}
const html=await readFile(path.join(source,'index.html'),'utf8');
if(!html.includes("script-src 'self'")||!html.includes('src="./app.js"')){
  throw new Error('No se reconoce el arranque seguro de la PWA');
}
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
for(const file of files)await cp(path.join(source,file),path.join(output,file));
for(const dir of dirs){
  const dest=path.join(output,dir);
  await mkdir(path.dirname(dest),{recursive:true});
  await cp(path.join(source,dir),dest,{recursive:true,force:false,dereference:false});
}
await writeFile(path.join(output,'_headers'),headers,'utf8');
await writeFile(path.join(output,'.nojekyll'),'','utf8');
for(const rel of assets){
  if(rel==='./')continue;
  if(!(await stat(path.join(output,rel))).isFile()){
    throw new Error('Recurso ausente en compilación '+rel);
  }
}
await validateNoSymlinks(output);
for(const forbidden of ['tests','qa','.github','MANIFEST_SHA256.txt','CuadernoDocente_sin_instalar.html','package.json','server.mjs']){
  try{
    await lstat(path.join(output,forbidden));
    throw new Error('Archivo de desarrollo publicado: '+forbidden);
  }catch(e){
    if(e.code!=='ENOENT')throw e;
  }
}
console.log('Sitio estático validado en '+outputName+'; '+assets.length+' entradas precargadas.');
