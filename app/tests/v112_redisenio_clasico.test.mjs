import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const root=new URL('..',import.meta.url);
const read=rel=>readFileSync(new URL(rel,root),'utf8');
const js=read('app.js'),css=read('styles.css'),index=read('index.html');

test('v1.12: conserva las ocho rutas y acciones originales de las secciones',()=>{
  for(const tab of ['cuaderno','planificador','alumno','calculos','competencias','curriculo','rubricas','ajustes']){
    assert(js.includes(`['${tab}',`),`No existe la pestaña ${tab}`);
  }
  assert(js.includes('data-tab="${k}"'));
  assert(js.includes('id="tab-content"'));
  assert(js.includes('id="new-student"'));
  assert(js.includes('id="new-assessment"'));
  assert(js.includes('id="copy-structure"'));
  assert(js.includes('id="schedule-exam"'));
});

test('v1.12: sidebar plegable es una preferencia visual y no altera el modelo',()=>{
  assert(js.includes('cuaderno-docente-nav-collapsed'));
  assert(js.includes("$('.shell')?.classList.toggle('nav-collapsed',STATE.navCollapsed)"));
  assert(js.includes('aria-expanded'));
  assert(css.includes('.shell.nav-collapsed .workspace'));
  assert(css.includes('.student-focus .workspace'));
  assert(!js.includes('commit(d=>d.navCollapsed'));
});

test('v1.12: tema clásico adapta claro, oscuro y OLED sin sustituir el acento por asignatura',()=>{
  assert(css.includes('html[data-theme="light"]'));
  assert(css.includes('html[data-theme="dark"]'));
  assert(css.includes('html[data-theme="oled"]'));
  assert(css.includes('--stone:#f5f1e9'));
  assert(css.includes('background:#000!important'));
  assert(css.includes('var(--accent)'));
  assert(js.includes('setSubjectAccent'));
  for(const t of ['light','dark','oled'])assert(js.includes(`'${t}'`));
});

test('v1.12: no se rompen las notas ni las tarjetas de estadísticas en la UI',()=>{
  for(const token of ['gradeChip(', 'gradeTone(', 'normalizedScore(', 'orthographyPenalty(', 'overallGrade(', 'classStatButton('])
    assert(js.includes(token),`Falta ${token}`);
  assert(css.includes('.grade-table'));
  assert(css.includes('.grade-table tbody tr:nth-child(even)'));
  assert(css.includes('.table-scroller'));
});

test('v1.12: los controles avanzados conservan nombres y secciones accesibles',()=>{
  assert(js.includes('<details class="activity-disclosure" open>'));
  assert(js.includes('Penalización ortográfica'));
  for(const key of ['rubricFile','orthRate','orthCopies','orthRecoverable','maxScore','weight'])
    assert(js.includes(`name="${key}"`),`Perdido el dato ${key}`);
  assert(css.includes('.activity-disclosure>summary:focus-visible'));
});

test('v1.12: página mobile mantiene navegación, tablas desplazables y recursos locales',()=>{
  assert(css.includes('@media (max-width:900px)'));
  assert(css.includes('.workspace{display:grid'));
  assert(css.includes('overflow-x:auto'));
  assert(index.includes('styles.css'));
  assert(index.includes('src="./app.js"'));
  assert(!index.includes('http://')&&!index.includes('https://'));
});
