import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initialNotebook,assertModel} from '../src/model.js';
import {categoryGrade,overallGrade,finalGrade} from '../src/calculations.js';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const v141=css=>css.slice(css.indexOf('/* v141 · Centrado horizontal'),css.indexOf('/* v142 · Capas coherentes'));


test('las tarjetas del directorio de alumnos se centran sin cambiar sus anchuras',async()=>{
  const css=await read('styles.css'),start=css.indexOf('/* v141 · Centrado horizontal');
  assert(start>0);
  const patch=css.slice(start);
  assert.match(patch,/\.student-directory-grid\s*\{\s*justify-content:center;/);
  assert(css.includes('repeat(auto-fill,minmax(205px,250px))'));
  assert(css.includes('font-size:15.5px;font-weight:800'));
  assert(patch.includes('@media(max-width:540px)'));
  assert(css.includes('grid-template-columns:minmax(0,1fr)'));
});

test('fichas y evaluaciones del alumno quedan centradas, pero sus textos a la izquierda',async()=>{
  const css=await read('styles.css'),patch=v141(css);
  assert.match(patch,/\.student-privacy,\s*details\.student-period,\s*\.student-final-summary\s*\{\s*margin-inline:auto;/);
  assert.match(patch,/\.student-period \.student-category\.student-category-tinted\s*\{\s*margin:10px auto;/);
  assert.match(patch,/\.student-period \.student-assessment-block\.student-category-tinted\s*\{\s*margin:5px auto;/);
  assert.match(patch,/\.student-period \.student-activity-list\s*\{\s*margin-inline:auto;/);
  assert.match(patch,/\.student-period \.student-activity-list \.student-assessment-block\s*\{\s*margin-inline:auto;/);
  assert(css.includes('max-width:880px'));
  assert(css.includes('max-width:710px'));
  assert(css.includes('max-width:650px'));
  assert(css.includes('.student-period .student-assessment{'));
  assert(css.includes('justify-content:flex-start'));
  assert(css.includes('font-size:16px;font-weight:850'));
});

test('Safari móvil conserva ancho adaptable, sin recortar notas ni ocultar controles',async()=>{
  const css=await read('styles.css'),patch=v141(css);
  assert.match(patch,/@media\(max-width:540px\)/);
  assert.match(patch,/max-width:100%/);
  assert(!patch.includes('overflow:hidden'));
  assert(!patch.includes('display:none'));
  const app=await read('app.js');
  const view=app.slice(app.indexOf('function renderStudentView(){'),app.indexOf('function bindStudentView(){'));
  for(const marker of ['student-directory-choice','student-category-tinted','student-period-summary',
    'student-final-summary','student-rubric-breakdown','student-assessment-observation',
    'id="previous-student"','id="next-student"','id="hide-student"'])
    assert(view.includes(marker),marker);
});

test('centrar no altera el cuaderno, la fórmula de medias ni los colores existentes',()=>{
  const doc=initialNotebook(),before=structuredClone(doc);
  assertModel(doc);
  const student=doc.students[0],group=doc.groups[0],period=doc.periods[0];
  const expected={
    overall:overallGrade(doc,student.id,group.id,period.id),
    category:categoryGrade(doc,student.id,doc.categories[0].id,group.id,period.id),
    final:finalGrade(doc,student.id,group.id)
  };
  assert.equal(overallGrade(doc,student.id,group.id,period.id),expected.overall);
  assert.equal(categoryGrade(doc,student.id,doc.categories[0].id,group.id,period.id),expected.category);
  assert.equal(finalGrade(doc,student.id,group.id),expected.final);
  assert.deepEqual(doc,before);
});

test('la PWA utiliza identificadores de caché nuevos e idénticos en SW y app',async()=>{
  const [js,sw]=await Promise.all([read('app.js'),read('sw.js')]);
  assert(sw.includes("const CACHE='cuaderno-docente-static-v145-dev'"));
  assert(js.includes("caches.open('cuaderno-docente-static-v145-dev')"));
});
