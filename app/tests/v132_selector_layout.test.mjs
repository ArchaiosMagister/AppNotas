import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initialNotebook,assertModel} from '../src/model.js';
import {overallGrade} from '../src/calculations.js';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const v132=css=>css.slice(css.indexOf('/* v132 · Los selectores'));

test('materias en botones visibles y grupos contextuales, sin desplegables',async()=>{
  const [app,css]=await Promise.all([read('app.js'),read('styles.css')]);
  const view=app.slice(app.indexOf('function render(){'),app.indexOf('function renderNotebook(){'));
  assert(view.includes('class="course-switch"'));
  assert(view.includes('class="course-buttons"'));
  assert(view.includes('class="group-buttons"'));
  assert(view.includes('data-group-choice='));
  assert(!view.includes('id="group-select"'));
  assert(!view.includes('data-shell-disclosure="course"'));
  assert(css.includes('/* v138 · Selección directa de materia y grupos contextuales'));
  assert(css.includes('.class-toolbar .course-switch .course-buttons'));
  assert(css.includes('grid-template-columns:repeat(5,minmax(0,1fr))'));
  assert(css.includes('.class-toolbar .group-choice[aria-pressed="true"]'));
  assert(css.includes('min-height:44px'));
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
  const cacheId=sw.match(/const CACHE='(cuaderno-docente-static-v(\d+)-dev)'/)?.[1];
  assert(cacheId&&Number(cacheId.match(/v(\d+)/)?.[1])>=142,'La caché PWA debe tener versión actualizada');
  assert(app.includes(`caches.open('${cacheId}')`));
  assert(sw.includes(`const CACHE='${cacheId}'`));
  assert(!app.includes('indexedDB.deleteDatabase'));
  assert(!sw.includes('indexedDB.deleteDatabase'));
});
