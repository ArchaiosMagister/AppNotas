import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CURRICULA} from '../src/curriculum-data.js';
import {initialNotebook,SCHEMA_VERSION} from '../src/model.js';
import {overallGrade,finalGrade} from '../src/calculations.js';
const pdfs=['gr1y2-nuevo.pdf','lat1y2-nuevo.pdf','lat4.pdf','lat2-2022.pdf'];
const keys=['lat1','lat2','gr1','gr2','lat4'];
for(const key of keys){
 test(`v0.8: currículo ${key} completo y referenciado por PDF`,async()=>{
   const data=CURRICULA[key];assert(data);assert.equal(data.competencias.length,5);
   assert.equal(data.saberes.length,key==='lat4'?4:5);
   assert.equal(data.criterios.length,key==='lat4'?21:key.startsWith('lat')?19:18);
   assert.equal(data.competencias.at(-1).id,5);
   for(const c of data.competencias){assert.equal(c.enunciado.length>70,true);assert(c.descripcion.length>100);assert(Number.isInteger(c.page));}
   for(const item of data.criterios){assert(item.texto.length>50);assert(item.competencia>=1&&item.competencia<=5);assert(Number.isInteger(item.page));}
   const bytes=await readFile(new URL('../'+data.fuente_pdf.replace(/^\.\//,''),import.meta.url));
   assert(bytes.byteLength>150000);assert.equal(bytes.subarray(0,4).toString(),'%PDF');
 });
}
test('v0.8: cada curso tiene criterios propios, sin colisiones de identificadores',()=>{
 for(const k of ['lat1','lat2','gr1','gr2']){
  const d=CURRICULA[k];assert.equal(new Set(d.criterios.map(c=>c.codigo)).size,d.criterios.length);
  for(const c of d.criterios)assert(c.codigo.startsWith(c.competencia+'.'));
 }
 assert.notDeepEqual(CURRICULA.lat1.criterios,CURRICULA.lat2.criterios);
 assert.notDeepEqual(CURRICULA.gr1.criterios,CURRICULA.gr2.criterios);
 assert.deepEqual(CURRICULA.lat1.competencias,CURRICULA.lat2.competencias);
 assert.deepEqual(CURRICULA.gr1.competencias,CURRICULA.gr2.competencias);
});
test('v0.8: no se ha importado programación de aula del Pages a la biblioteca',()=>{
 const old=CURRICULA['lat2-2022'];
 assert.equal(old.estado,'vigente-2026-2027');
 assert.equal(old.competencias.length,5);
 assert.equal(old.criterios.length,22);
 assert.equal(old.saberes.length,4);
 assert.equal(old.criterios[0].codigo,'5.1.1');
 assert.equal(old.criterios.at(-1).codigo,'5.5.4');
 assert(old.criterios.every(c=>c.texto.endsWith('.')&&c.codigo.startsWith('5.'+c.competencia+'.')));
 assert.deepEqual(old.competencias[0].claves,['CCL1','CCL2','CP2','STEM2']);
 const all=Object.values(CURRICULA).map(d=>(d.competencias||[]).map(c=>c.enunciado).join(' ')).join(' ');
 assert(!/PROGRAMACIÓN DE AULA|Situación de aprendizaje 3: Textos variados/.test(all));
});
test('v0.8: currículo no modifica esquema de datos ni notas iniciales',()=>{
 const before=initialNotebook(),json=JSON.stringify(before),s=before.students[0],g=before.groups[0];
 const period=before.periods[0],old=overallGrade(before,s.id,g.id,period.id);
 assert.equal(SCHEMA_VERSION,8);
 for(const key of [...keys,'lat2-2022']){const d=CURRICULA[key];assert(d.titulo);assert(Array.isArray(d.competencias));}
 assert.equal(JSON.stringify(before),json);assert.equal(overallGrade(before,s.id,g.id,period.id),old);
 assert.equal(finalGrade(before,s.id,g.id),finalGrade(JSON.parse(json),s.id,g.id));
});
test('v0.8: PWA precarga todas las fuentes curriculares y el módulo de datos',async()=>{
 const sw=await readFile(new URL('../sw.js',import.meta.url),'utf8');
 for(const x of [...pdfs.map(p=>'./data/curriculos/'+p),'./src/curriculum-data.js','./src/official-competencies.js'])assert(sw.includes("'"+x+"'"));
 assert(/const CACHE='cuaderno-docente-static-v[0-9]+-dev'/.test(sw));
 const server=await readFile(new URL('../server.mjs',import.meta.url),'utf8');
 for(const p of pdfs)assert(server.includes("'/data/curriculos/"+p+"'"));
 assert(server.includes("'.pdf':'application/pdf'"));
});
