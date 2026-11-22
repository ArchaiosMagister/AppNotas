import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initialNotebook,assertModel} from '../src/model.js';
import {overallGrade} from '../src/calculations.js';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const v132=css=>css.slice(css.indexOf('/* v132 · Los selectores'));

test('Asignatura y Grupo ofrecen títulos equivalentes y campos de igual altura',async()=>{
  const [app,css]=await Promise.all([read('app.js'),read('styles.css')]);
  assert(app.includes('<span class="course-picker-label">Asignatura</span><span class="course-selection">'));
  assert(app.includes('<label class="current-group-label"><span class="group-picker-label">Grupo</span><select id="group-select"'));
  const patch=v132(css);
  assert(patch.startsWith('/* v132 · Los selectores'));
  assert(patch.includes('.course-picker-label,\n.class-toolbar .selectors label.current-group-label .group-picker-label'));
  assert(patch.includes('line-height:14px'));
  assert(patch.includes('min-height:44px'));
  assert(patch.includes('height:44px'));
  assert(patch.includes('text-overflow:ellipsis'));
  assert(patch.includes('label.current-group-label{\n    flex:none;'));
  assert(patch.includes('html[data-theme="oled"] .class-toolbar'));
});

test('Herramientas cabe en el ancho disponible de iPhone y mantiene desplazamiento vertical',async()=>{
  const css=await read('styles.css');
  const patch=v132(css);
  for(const property of [
    '.topmeta{position:relative;z-index:80}',
    '.topmeta .header-tools{position:static}',
    'left:auto;',
    'right:0;',
    'width:min(340px,100%);',
    'max-width:100%;',
    'max-height:min(70dvh,calc(100dvh - 150px));',
    'overflow-y:auto;',
    '-webkit-overflow-scrolling:touch;',
    '.theme-picker select{'
  ])assert(patch.includes(property),'Herramientas: falta '+property);
  assert(css.includes('.notebook-more-panel'));
  assert(css.includes('.class-toolbar .group-actions-panel'));
  assert(css.includes('.tabs .nav-academic-links'));
});

test('Cambio visual no modifica modelo, cálculos ni contenido privado',async()=>{
  const doc=initialNotebook(),before=structuredClone(doc);
  assertModel(doc);
  const student=doc.students[0],group=doc.groups[0],period=doc.periods[0];
  const score=overallGrade(doc,student.id,group.id,period.id);
  assert.equal(overallGrade(doc,student.id,group.id,period.id),score);
  assert.deepEqual(doc,before);
  const [app,sw]=await Promise.all([read('app.js'),read('sw.js')]);
  assert(app.includes("caches.open('cuaderno-docente-static-v133-dev')"));
  assert(sw.includes("const CACHE='cuaderno-docente-static-v133-dev'"));
  assert(!app.includes('indexedDB.deleteDatabase'));
  assert(!sw.includes('indexedDB.deleteDatabase'));
});
