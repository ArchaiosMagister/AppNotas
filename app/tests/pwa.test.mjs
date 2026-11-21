import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
const path=new URL('../',import.meta.url);
test('manifest es PWA independiente instalable',async()=>{
  const p=JSON.parse(await readFile(new URL('../manifest.webmanifest',import.meta.url)));
  assert.equal(p.display,'standalone');assert(p.start_url.startsWith('./'));
});
test('todos los recursos del precache existen',async()=>{
  const sw=await readFile(new URL('../sw.js',import.meta.url),'utf8');
  const contents=sw.match(/const ASSETS=\[(.*?)\];/s)?.[1];assert(contents);
  const resources=[...contents.matchAll(/'([^']+)'/g)].map(x=>x[1]);
  for(const asset of resources){if(asset==='./')continue;await access(new URL('../'+asset.replace(/^\.\//,''),import.meta.url));}
});
test('sin CDN ni endpoints remotos en los recursos ejecutables',async()=>{
  for(const p of ['index.html','app.js','sw.js','styles.css']){
    const content=await readFile(new URL('../'+p,import.meta.url),'utf8');
    assert(!/https?:\/\//.test(content),`${p} contiene URL externa`);
  }
});
