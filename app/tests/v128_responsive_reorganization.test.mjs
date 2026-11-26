import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {initialNotebook,assertModel} from '../src/model.js';
import {overallGrade,itacaGrade,finalGrade} from '../src/calculations.js';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const entry=async()=>read('app.js');

function navigationFor(tab='cuaderno',collapsed=false){
  return entry().then(js=>{
    const a=js.indexOf('/** Navegación minimalista:');
    const b=js.indexOf('function renderPeriodButtons(){',a);
    assert(a>=0&&b>a,'Bloque de navegación no encontrado');
    const nav=js.slice(a,b);
    const api=runInNewContext(nav+';({renderNavigation,renderAcademicQuickNav,workspaceDisclosures})',{
      STATE:{tab,navCollapsed:collapsed}
    });
    return {html:api.renderNavigation(),quick:api.renderAcademicQuickNav(),preferences:api.workspaceDisclosures};
  });
}

test('cuatro accesos principales, tres herramientas y cinco vistas de cuaderno separadas',async()=>{
  const {html}=await navigationFor();
  const ids=[...html.matchAll(/data-tab="([^"]+)"/g)].map(x=>x[1]);
  assert.deepEqual(ids,['cuaderno','planificador','evaluaciones','extraescolares',
    'curriculo','rubricas','ajustes']);
  assert.equal(new Set(ids).size,7);
  assert(!ids.includes('calculos')&&!ids.includes('competencias'),'Los accesos rápidos no deben duplicarse');
  for(const key of ids)assert(html.includes('data-tab="'+key+'"'));
  assert(html.includes('id="toggle-navigation"'),'La opción de plegar el menú permanece');
  assert(html.includes('aria-label="Trabajo diario"'));
  assert(html.includes('aria-label="Recursos académicos y ajustes"'));
  assert(html.includes('Recursos'));
  const secondary=await navigationFor('final');
  for(const key of ['cuaderno','calculos','competencias','alumno'])
    assert(secondary.quick.includes('data-academic-quick="'+key+'"'));
  assert(!secondary.quick.includes('data-academic-quick="final"'),'Final se ubica en la barra de períodos');
  assert(html.includes('Ajustes y copias'));
  assert(html.includes('aria-current="page"'));
});

test('el destino activo se marca y Recursos abre automáticamente el panel secundario',async()=>{
  const main=await navigationFor('alumno');
  assert(main.html.includes('data-tab="cuaderno" class="tab active" aria-current="page"'));
  assert(main.quick.includes('data-academic-quick="alumno"'));
  assert(!/class="academic-disclosure"[^>]*\bopen\b/.test(main.html));
  for(const screen of ['curriculo','rubricas','ajustes']){
    const result=await navigationFor(screen);
    assert(result.html.includes('data-tab="'+screen+'" class="tab active" aria-current="page"'));
    assert(/class="academic-disclosure"[^>]*\bopen\b/.test(result.html),screen);
  }
  for(const screen of ['calculos','competencias']){
    const result=await navigationFor(screen);
    assert(result.quick.includes('data-academic-quick="'+screen+'"'));
    assert(result.quick.includes('data-academic-quick="'+screen+'"'));
    assert(result.quick.includes('aria-current="page"'));
    assert(result.quick.includes('data-academic-quick="'+screen+'" aria-pressed="true"'));
    assert(!result.html.includes('data-tab="'+screen+'"'),'No duplicar en el lateral');
  }
  const sessions=await navigationFor('evaluaciones');
  assert(sessions.html.includes('data-tab="evaluaciones" class="tab active" aria-current="page"'));
  const final=await navigationFor('final');
  assert(!final.quick.includes('data-academic-quick="final"'),'Final debe seleccionarse junto al último período');
  assert(final.html.includes('data-tab="cuaderno" class="tab active" aria-current="page"'));
  assert(!final.html.includes('data-tab="final"'));
});

test('cabecera y barra de grupo reorganizadas conservan todas las acciones existentes',async()=>{
  const js=await entry(),start=js.indexOf('function render(){'),end=js.indexOf('function renderNotebook(){',start);
  const view=js.slice(start,end);
  assert(start>=0&&end>start);
  const required=[
    'id="save-status"','id="theme-select"','id="open-notebook"',
    'id="close-notebook"','id="undo-change"','id="redo-change"',
    'id="lock"','data-shell-disclosure="tools"',
    'class="course-switch"','class="group-switch"',
    'id="new-group"','data-shell-disclosure="group"',
    'id="edit-group"','id="csv-file"','id="accent-select"',
    'renderPeriodButtons()','renderPlanner(STATE.doc,STATE)',
    'renderStudentView()','renderRules()','renderRubrics()',
    'renderCompetencies()','renderCurriculum()','renderSettings()',
    'renderFinalEvaluation()', 'renderNavigation()'
  ];
  for(const item of required)assert(view.includes(item),'Falta '+item);
  assert(view.includes('courseChoices.map('),'Los botones mantienen todos los cursos');
  assert(!view.includes('id="group-select"'));
  assert(!view.includes('data-shell-disclosure="course"'));
  assert(js.includes("document.querySelectorAll('[data-shell-disclosure]')"));
  assert(js.includes("document.querySelectorAll('[data-course-level][data-course-subject]')"));
  assert(js.includes("document.querySelectorAll('[data-tab]')"));
  assert(js.includes("wirePwaButtons()"),'Se conservan instalación y actualizaciones');
  assert(!js.includes('localStorage.setItem("cuaderno-docente-course-default"'),'No introducir migraciones');
});

test('en la tabla se conservan notas, NP, AJ, Obs, rúbricas, cambios y navegación por período',async()=>{
  const js=await entry();
  const start=js.indexOf('function renderNotebook(){'),end=js.indexOf('const ITACA_OPTIONS=',start);
  const table=js.slice(start,end);
  assert(table.includes('id="new-student"'));
  assert(table.includes('id="new-assessment"'));
  assert(table.includes('id="copy-structure"'));
  assert(table.includes('id="schedule-exam"'));
  assert(table.includes('notebook-more-actions'));
  for(const key of [
    'data-observation-student','data-rubric-grade','data-orthography-grade',
    'data-aj-student','data-np-student','data-student','data-assessment',
    'data-explain','data-itaca-student','category-tinted',
    'overallGrade(','itacaChip('
  ])assert(table.includes(key),'Tabla: falta '+key);
  assert(js.includes('id="new-period"'));
  assert(js.includes('data-period-choice'));
  assert(js.includes('data-rename-period'));
  for(const action of ['csv-import','new-recovery'])assert(table.includes('id="'+action+'"'));
  assert(!js.includes('data-final-choice'),'Evaluación final tiene un único acceso en las vistas del cuaderno');
});

test('responsive: teléfono estrecho, teléfonos grandes, iPad y escritorio mantienen todos los controles accesibles',async()=>{
  const css=await read('styles.css');
  assert(css.includes('v130 · Reorganización visual de AppNotas'));
  for(const breakpoint of ['@media(max-width:1120px)','@media(max-width:900px)','@media(max-width:640px)','@media(max-width:360px)'])
    assert(css.includes(breakpoint),'No está diseñado '+breakpoint);
  for(const selector of [
    '.header-tools-panel','.course-switch','.group-actions-disclosure',
    '.nav-primary','.nav-secondary','.nav-academic-links',
    '.notebook-more-actions','.notebook-more-panel',
    '.grade-table th.name-col','.student-period-summary',
    '.table-scroller','dialog{max-width:calc(100vw - 16px)',
    'html[data-theme="oled"]'
  ])assert(css.includes(selector),'Falta diseño '+selector);
  assert(css.includes('grid-template-columns:repeat(4,minmax(0,1fr))'));
  assert(css.includes('grid-template-columns:repeat(2,minmax(0,1fr))'));
  assert(css.includes('min-height:44px'));
  assert(css.includes('overscroll-behavior-x:contain'));
  assert(css.includes('position:sticky;top:0;z-index:30'));
  assert(!css.includes('display:none!important} /* observaciones */'));
});

test('rediseño no modifica cálculos: el cuaderno de demostración conserva sus resultados',()=>{
  const doc=initialNotebook();assertModel(doc);
  const before=structuredClone(doc);
  const student=doc.students[0],group=doc.groups[0],period=doc.periods[0];
  const score=[overallGrade(doc,student.id,group.id,period.id),
    itacaGrade(doc,student.id,group.id,period.id),
    finalGrade(doc,student.id,group.id)];
  assert.deepEqual(doc,before,'Ni visualización ni notas se deben mutar');
  assert.equal(score.length,3);
});

test('SW y aplicación usan una misma nueva caché sin borrar IndexedDB',async()=>{
  const [app,sw]=await Promise.all([read('app.js'),read('sw.js')]);
  const cacheId=sw.match(/const CACHE='(cuaderno-docente-static-v(\d+)-dev)'/)?.[1];
  assert(cacheId&&Number(cacheId.match(/v(\d+)/)?.[1])>=142,'La caché PWA debe tener versión actualizada');
  assert(app.includes(`caches.open('${cacheId}')`));
  assert(sw.includes(`const CACHE='${cacheId}'`));
  assert(!sw.includes('indexedDB.deleteDatabase'));
  assert(!app.includes('indexedDB.deleteDatabase'));
});
