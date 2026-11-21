import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const read=name=>readFile(new URL('../'+name,import.meta.url),'utf8');
test('el comprobador offline usa exactamente la misma caché que Service Worker',async()=>{
 const app=await read('app.js'),sw=await read('sw.js');
 const active=sw.match(/const CACHE='([^']+)'/)?.[1],lookup=app.match(/caches\.open\('([^']+)'\)/)?.[1];
 assert(active);assert.equal(lookup,active);
 assert(/^cuaderno-docente-static-v[0-9]+-dev$/.test(active));
});
test('HTML autónomo contiene exactamente dos scripts autorizados por hash CSP y CSS íntegro',async()=>{
 const html=await read('CuadernoDocente_sin_instalar.html');
 const csp=html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/i)?.[1];
 assert(csp);assert(csp.includes("connect-src 'none'"));
 const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
 assert.equal(scripts.length,2);
 for(const script of scripts){const digest=createHash('sha256').update(script).digest('base64');assert(csp.includes(`'sha256-${digest}'`));}
 const css=html.match(/<style>([\s\S]*?)<\/style>/)?.[1];
 assert(css);const cssDigest=createHash('sha256').update(css).digest('base64');assert(csp.includes(`'sha256-${cssDigest}'`));
 assert(html.includes('URL.createObjectURL'));assert(!html.includes('globalThis.__cdSmoke'));
 assert(html.includes('v1.14'));
});
