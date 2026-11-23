import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {initialNotebook,setCategoryColumnColor,categoryColumnColor,assertModel} from '../src/model.js';
import {overallGrade,itacaGrade} from '../src/calculations.js';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('modo alumno comparte el color de cada categoría en vista agrupada y lista libre',async()=>{
  const js=await read('app.js');
  const start=js.indexOf('function renderStudentView(){');
  const end=js.indexOf('function bindStudentView(){',start);
  assert(start>=0&&end>start);
  const view=js.slice(start,end);
  assert(view.includes('<div class="student-category student-category-tinted" data-column-category="${esc(c.id)}">'));
  assert(view.includes('<div class="student-assessment-block student-category-tinted" data-column-category="${esc(a.categoryId)}">'));
  assert(view.includes("mode==='category'?categories.map("));
  assert(view.includes("ordered.map(a=>renderActivity(a,categories.find("));
  assert(view.includes('ordered.filter(a=>a.categoryId===c.id).map(a=>renderActivity(a))'));
  assert(!view.includes('style="--category-color:'));
  assert(!view.includes('setCategoryColumnColor('),'El visor no modifica los colores del modelo');
  assert(!view.includes('setGrade('),'El visor no altera las calificaciones');
});

test('pintado CSSOM: las tarjetas comparten tonalidades con el cuaderno y no recolorean la nota',async()=>{
  const js=await read('app.js');
  const snippet=js.slice(js.indexOf('function paintStudentCategoryCards('),js.indexOf('const gradeChip='));
  assert(snippet.startsWith('function paintStudentCategoryCards('));
  const doc=initialNotebook(),before=structuredClone(doc);
  const exams=doc.assessments.filter(a=>a.categoryId===doc.categories[0].id);
  const work=doc.assessments.find(a=>a.categoryId===doc.categories[1].id);
  const attitude=doc.assessments.find(a=>a.categoryId===doc.categories[2].id);
  const ids=[...exams.map(a=>a.categoryId),work.categoryId,attitude.categoryId];
  const painted=[];
  const cards=ids.map(categoryId=>({
    dataset:{columnCategory:categoryId},
    style:{setProperty:(property,value)=>painted.push({categoryId,property,value})}
  }));
  const paint=runInNewContext(snippet+'; paintStudentCategoryCards;',{
    STATE:{doc},categoryColumnColor,document:{querySelectorAll:()=>{throw Error('Usar contexto del visor');}}
  });
  paint({querySelectorAll(selector){
    assert.equal(selector,'.student-period .student-category-tinted[data-column-category]');
    return cards;
  }});
  assert.equal(painted.length,4);
  assert(painted.every(item=>item.property==='--category-color'));
  assert.equal(painted[0].value,painted[1].value);
  assert.notEqual(painted[1].value,painted[2].value);
  assert.notEqual(painted[2].value,painted[3].value);
  assert.deepEqual(doc,before);
});

test('color personalizado del cuaderno se refleja en alumno, sin alterar medias ni Ítaca',()=>{
  const doc=initialNotebook(),category=doc.categories[0],student=doc.students[0],group=doc.groups[0],period=doc.periods[0];
  const average=overallGrade(doc,student.id,group.id,period.id);
  const itaca=itacaGrade(doc,student.id,group.id,period.id);
  const before=structuredClone(doc.grades);
  setCategoryColumnColor(doc,category.id,'#7298D8');
  assert.equal(categoryColumnColor(doc,doc.assessments[0].categoryId),'#7298D8');
  assert.equal(categoryColumnColor(doc,doc.assessments[1].categoryId),'#7298D8');
  assert.equal(overallGrade(doc,student.id,group.id,period.id),average);
  assert.equal(itacaGrade(doc,student.id,group.id,period.id),itaca);
  assert.deepEqual(doc.grades,before);
  assertModel(doc);
});

test('estilos: mismos colores en claro/oscuro, bandas de categoría en OLED y chips intactos',async()=>{
  const [js,css,sw,html]=await Promise.all(['app.js','styles.css','sw.js','index.html'].map(read));
  assert(js.includes('paintStudentCategoryCards(root)'));
  assert(css.includes('.student-period .student-category.student-category-tinted'));
  assert(css.includes('.student-period .student-assessment-block.student-category-tinted'));
  assert(css.includes('.student-period .student-activity-list .student-assessment-block.student-category-tinted'));
  assert(css.includes('html[data-theme="dark"] .student-period .student-category.student-category-tinted'));
  assert(css.includes('html[data-theme="oled"] .student-period .student-category.student-category-tinted'));
  assert(css.includes('html[data-theme="oled"] .student-period .student-assessment-block.student-category-tinted'));
  assert(css.includes('background:#000!important;'));
  assert(css.includes('--grade-bg')&&css.includes('--grade-fg'),'Se mantienen chips de notas');
  assert(html.includes("style-src 'self'"));
  const cache=sw.match(/const CACHE='(cuaderno-docente-static-v(\d+)-dev)'/)?.[1];
  assert(cache,'La caché debe tener versión');
  assert(Number(cache.match(/v(\d+)-dev/)[1])>=128);
  assert(js.includes("caches.open('"+cache+"')"),'La UI usa la misma versión offline');
});
