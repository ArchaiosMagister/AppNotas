import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const app=path.join(root,'app');
const dist=path.join(root,'dist');
const read=(p)=>readFile(path.join(root,p),'utf8');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

test('la compilación conserva byte a byte todos los recursos publicados de la PWA',async()=>{
  const sw=await read('app/sw.js');
  const list=sw.match(/const ASSETS=\[([^\]]+)\]/)?.[1];
  assert.ok(list);
  const assets=[...list.matchAll(/'(\.[^']+)'/g)].map(m=>m[1]).filter(x=>x!=='./');
  assert.ok(assets.length>=25);
  for(const item of assets){
    const file=item.slice(2);
    assert.equal(sha(await readFile(path.join(dist,file))),sha(await readFile(path.join(app,file))),file);
  }
  assert.equal(sha(await readFile(path.join(dist,'index.html'))),sha(await readFile(path.join(app,'index.html'))));
  const manifest=JSON.parse(await read('dist/manifest.webmanifest'));
  assert.equal(manifest.display,'standalone');
});

test('el alojamiento exclusivo no publica cuadernos, pruebas, servidor ni HTML histórico',async()=>{
  const top=await readdir(dist);
  const allowed=new Set(['index.html','styles.css','app.js','sw.js','manifest.webmanifest','icons','src','vendor','data','_headers','.nojekyll']);
  assert.ok(top.length<=allowed.size);
  assert.deepEqual(top.filter(x=>!allowed.has(x)),[]);
  for(const sensitive of ['MANIFEST_SHA256.txt','package.json','server.mjs','CuadernoDocente_sin_instalar.html','tests','qa','examples']){
    await assert.rejects(stat(path.join(dist,sensitive)),{code:'ENOENT'});
  }
});

test('Cloudflare Pages y Vercel tienen cabeceras HTTP de aislamiento del navegador',async()=>{
  const cf=await read('dist/_headers');
  const vercel=JSON.parse(await read('vercel.json'));
  assert.equal(vercel.outputDirectory,'dist');
  assert.equal(vercel.buildCommand,'node scripts/build-static-site.mjs');
  const security=new Map(vercel.headers[0].headers.map(x=>[x.key,x.value]));
  for(const header of ['Content-Security-Policy','X-Frame-Options','X-Content-Type-Options','Referrer-Policy']){
    assert.ok(security.has(header));
    assert.ok(cf.includes(header+': '+security.get(header)));
  }
  assert.match(security.get('Content-Security-Policy'),/frame-ancestors 'none'/);
  assert.match(security.get('Content-Security-Policy'),/script-src 'self'/);
  assert.equal(security.get('X-Frame-Options'),'DENY');
  assert.match(cf,/\/sw\.js[\s\S]*Cache-Control: no-cache, no-store, must-revalidate/);
  assert.ok(vercel.headers.some(x=>x.source==='/sw.js'&&x.headers.some(y=>y.key==='Cache-Control'&&y.value.includes('no-store'))));
});
