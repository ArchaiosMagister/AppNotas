import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const load=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('v1.0 estable: etiquetas, descripción y versión sin avisos experimentales obsoletos',()=>{
 const app=load('app.js'),html=load('index.html'),pkg=JSON.parse(load('package.json'));
 assert.equal(pkg.version,'1.0.0');
 assert(html.includes('<title>CuadernoDocente · v1.0 · Tabularium</title>'));
 assert(app.includes('CUADERNO ACADÉMICO · v1.0'));
 assert(!app.includes('Solo uso experimental'));
 assert(!app.includes('versión experimental pendiente'));
 assert(app.includes('No se ha realizado una auditoría independiente de seguridad'));
 assert(app.includes('⚠ Copias solo en almacenamiento local'));
 assert(app.includes('Modo sesión de evaluación'));
});
test('v1.0 estable: cache PWA renueva versión para garantizar contenido fresco',()=>{
 const app=load('app.js'),sw=load('sw.js');
 const current=sw.match(/const CACHE='(cuaderno-docente-static-v(\d+)-dev)'/);
  assert(current&&Number(current[2])>=150,'La nueva caché no puede retroceder de v150');
  assert(app.includes(`caches.open('${current[1]}')`),'La UI y el service worker deben usar la misma caché');
 
 assert(!sw.includes('indexedDB.deleteDatabase'));
 assert(!app.includes('indexedDB.deleteDatabase'));
});
