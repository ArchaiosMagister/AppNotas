import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {initialNotebook,emptyNotebook,addGroup,addCategory,addAssessment,
  assertModel,categoryColumnColor,setCategoryColumnColor,
  DEFAULT_CATEGORY_COLUMN_COLORS} from '../src/model.js';
import {overallGrade} from '../src/calculations.js';

test('exámenes, trabajos y actitud tienen colores distintos sin configuración inicial',()=>{
  const doc=initialNotebook();
  const colors=doc.categories.map(c=>categoryColumnColor(doc,c.id));
  assert.deepEqual(colors,[
    DEFAULT_CATEGORY_COLUMN_COLORS.examenes,
    DEFAULT_CATEGORY_COLUMN_COLORS.trabajos,
    DEFAULT_CATEGORY_COLUMN_COLORS.actitud
  ]);
  assert.equal(new Set(colors).size,3);
  for(const color of colors)assert.match(color,/^#[0-9A-F]{6}$/);
  const exams=doc.assessments.filter(a=>a.categoryId===doc.categories[0].id);
  assert.equal(exams.length,2);
  assert.equal(categoryColumnColor(doc,exams[0].categoryId),categoryColumnColor(doc,exams[1].categoryId));
  assert.equal(categoryColumnColor(doc,'missing'),null);
  assertModel(doc);
});

test('colores personalizados compartidos por todas las columnas, reversibles sin cambiar notas ni medias',()=>{
  const doc=initialNotebook();
  const exam=doc.categories[0],st=doc.students[0],group=doc.groups[0],period=doc.periods[0];
  const gradeBefore=overallGrade(doc,st.id,group.id,period.id);
  const scores=structuredClone(doc.grades);
  setCategoryColumnColor(doc,exam.id,'#4F75A1');
  assert.equal(categoryColumnColor(doc,doc.assessments[0].categoryId),'#4F75A1');
  assert.equal(categoryColumnColor(doc,doc.assessments[1].categoryId),'#4F75A1');
  assert.notEqual(categoryColumnColor(doc,doc.categories[1].id),'#4F75A1');
  assert.equal(overallGrade(doc,st.id,group.id,period.id),gradeBefore);
  assert.deepEqual(doc.grades,scores);
  assertModel(doc);
  const saved=structuredClone(doc);
  assert.equal(categoryColumnColor(saved,exam.id),'#4F75A1');
  setCategoryColumnColor(saved,exam.id,null);
  assert.equal(categoryColumnColor(saved,exam.id),DEFAULT_CATEGORY_COLUMN_COLORS.examenes);
  assert.equal(overallGrade(saved,st.id,group.id,period.id),gradeBefore);
  assert.deepEqual(saved.grades,scores);
  assert.throws(()=>setCategoryColumnColor(saved,exam.id,'red'),/Color de columna inválido/);
});

test('categorías con el mismo nombre de grupos distintos comparten color de tipo, incluso con acentos o mayúsculas',()=>{
  const doc=emptyNotebook();
  const g1=addGroup(doc,'Grupo 1','Griego I','2026-2027','1bach');
  const g2=addGroup(doc,'Grupo 2','Griego I','2026-2027','1bach');
  const a=addCategory(doc,'Lectura crítica',0,'mean',g1.id);
  const b=addCategory(doc,'LECTURA CRÍTICA',0,'mean',g2.id);
  assert.equal(categoryColumnColor(doc,a.id),categoryColumnColor(doc,b.id));
  assert.notEqual(categoryColumnColor(doc,a.id),categoryColumnColor(doc,doc.categories[0].id));
  const act1=addAssessment(doc,{name:'Actividad A',groupId:g1.id,periodId:doc.periods[0].id,categoryId:a.id});
  const act2=addAssessment(doc,{name:'Actividad B',groupId:g2.id,periodId:doc.periods[1].id,categoryId:b.id});
  assert.equal(categoryColumnColor(doc,act1.categoryId),categoryColumnColor(doc,act2.categoryId));
  assertModel(doc);
});

test('la aplicación usa CSSOM, no atributos style bloqueados por CSP; cabecera y celdas comparten identificador',async()=>{
  const [app,css,html,sw]=await Promise.all(['app.js','styles.css','index.html','sw.js']
    .map(path=>readFile(new URL('../'+path,import.meta.url),'utf8')));
  const notebook=app.slice(app.indexOf('function renderNotebook(){'),app.indexOf('const ITACA_OPTIONS='));
  const paint=app.slice(app.indexOf('function paintCategoryColumns('),app.indexOf('const gradeChip='));
  assert(notebook.includes('<th class="category-tinted" data-column-category="\${esc(a.categoryId)}"'.replace('\\','')));
  assert(notebook.includes('const categoryCell=a=>'));
  assert(notebook.includes('class="category-tinted" data-column-category="\${esc(a.categoryId)}"'.replace('\\','')));
  assert(!notebook.includes('style="--category-color:'));
  assert(app.includes('paintCategoryColumns(root)'));
  assert(paint.includes("cell.style.setProperty('--category-color',color)"));
  assert(html.includes("style-src 'self'"));
  assert(css.includes('.grade-table thead th.category-tinted'));
  assert(css.includes('.grade-table tbody tr:nth-child(odd) td.category-tinted'));
  assert(css.includes('.grade-table tbody tr:nth-child(even) td.category-tinted'));
  assert(css.includes('html[data-theme="dark"] .grade-table'));
  assert(css.includes('html[data-theme="oled"] .grade-table'));
  assert(css.includes('--grade-bg')&&css.includes('--grade-fg'),'No tocar los colores por nota individual');
  assert(css.indexOf('/* Categorías del cuaderno v127')>css.indexOf('.grade-table tbody tr:nth-child(odd) td'));
  assert(app.includes('categoryColumnColor(STATE.doc,c.id)'));
  assert(app.includes('Color predeterminado'));
  assert(app.includes("caches.open('cuaderno-docente-static-v127-dev')"));
  assert(sw.includes("const CACHE='cuaderno-docente-static-v127-dev'"));
});

test('pintado en DOM: dos celdas y cabecera del mismo tipo reciben la misma variable sin tocar puntuaciones',async()=>{
  const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
  const fragment=app.slice(app.indexOf('function paintCategoryColumns('),app.indexOf('const gradeChip='));
  assert(fragment.startsWith('function paintCategoryColumns('));
  const doc=initialNotebook();
  const seen=[];
  const elements=doc.assessments.map(a=>({
    dataset:{columnCategory:a.categoryId},
    style:{setProperty:(property,color)=>seen.push([a.id,property,color])}
  }));
  const context={querySelectorAll:selector=>{
    assert.equal(selector,'.grade-table .category-tinted[data-column-category]');
    return elements;
  }};
  const fn=runInNewContext(fragment+'; paintCategoryColumns;',{
    STATE:{doc},
    categoryColumnColor,
    document:{querySelectorAll:()=>{throw Error('Se debe usar el contexto proporcionado');}}
  });
  fn(context);
  assert.equal(seen.length,doc.assessments.length);
  assert.deepEqual(seen.map(x=>x[1]),['--category-color','--category-color','--category-color','--category-color']);
  assert.equal(seen[0][2],seen[1][2]);
  assert.notEqual(seen[0][2],seen[2][2]);
  assert.notEqual(seen[2][2],seen[3][2]);
  assert(!seen.some(x=>x[1]==='--grade-bg'||x[1]==='--grade-fg'));
});
