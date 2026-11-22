import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initialNotebook,assertModel} from '../src/model.js';
import {overallGrade,finalGrade} from '../src/calculations.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('«Opciones de grupo» se renombra exactamente como «Materias y grupos»',()=>{
  const app=read('app.js');
  assert(app.includes('<summary>Materias y grupos '));
  assert(!app.includes('<summary>Opciones de grupo '));
  for(const id of ['new-group','edit-group','accent-select','csv-import','new-recovery'])
    assert(app.includes('id="'+id+'"'),id);
});
test('Cálculos y Competencias salen del lateral y conservan su acceso dentro del cuaderno',()=>{
 const app=read('app.js');
 const tools=app.slice(app.indexOf('const ACADEMIC_WORKSPACE_TABS='),app.indexOf('const NOTEBOOK_WORKSPACE_TABS='));
 assert(!tools.includes("['calculos'"));
 assert(!tools.includes("['competencias'"));
 assert(tools.includes("['curriculo'"));
 assert(tools.includes("['rubricas'"));
 assert(tools.includes("['ajustes'"));
 const notebooks=app.slice(app.indexOf('const NOTEBOOK_WORKSPACE_TABS='),app.indexOf('function renderPeriodButtons(){'));
 assert(notebooks.includes("['calculos'"));
 assert(notebooks.includes("['competencias'"));
});
test('las acciones principales del cuaderno son dos, con resto de opciones accesibles',()=>{
 const app=read('app.js');
 const notebook=app.slice(app.indexOf('function renderNotebook(){'),app.indexOf('const ITACA_OPTIONS=',app.indexOf('function renderNotebook(){')));
 assert(notebook.includes('id="new-student"'));
 assert(notebook.includes('id="new-assessment"'));
 assert(!notebook.includes('id="notebook-calculations"'));
 assert(!notebook.includes('id="notebook-competencies"'));
 assert(notebook.includes('class="notebook-grade-options"'));
 assert(notebook.includes('class="notebook-more-actions"'));
});
test('las cinco vistas del cuaderno tienen acceso directo y pueden volver a Notas',()=>{
 const app=read('app.js');
 const nav=app.slice(app.indexOf('const NOTEBOOK_WORKSPACE_TABS='),app.indexOf('function renderPeriodButtons(){'));
 for(const path of ['cuaderno','calculos','competencias','final','alumno'])
  assert(nav.includes("['"+path+"'"),path);
 assert(nav.includes('data-academic-quick="${key}"'));
 assert(nav.includes('aria-current="page"'));
 assert(app.includes("hasGroup&&['cuaderno','calculos','competencias','final','alumno'].includes(STATE.tab)?renderAcademicQuickNav():''"));
 assert(app.includes("document.querySelectorAll('[data-academic-quick]').forEach"));
 assert(app.includes("if(!['cuaderno','calculos','competencias','final','alumno'].includes(destination)||!STATE.groupId)return"));
});
test('los botones son accesibles en iPad, móvil, oscuro y OLED',()=>{
  const css=read('styles.css');
  assert(css.includes('.academic-quick-nav'));
  assert(css.includes('.notebook-primary-actions #notebook-calculations'));
  assert(css.includes('.notebook-primary-actions #notebook-competencies'));
  assert(css.includes('html[data-theme="oled"] .notebook-primary-actions #notebook-competencies'));
  assert(css.includes('@media(max-width:540px)'));
  assert(css.includes('grid-column:auto;min-width:0;width:100%'));
  assert(css.includes('min-height:43px'));
});
test('caché PWA renovada y sincronizada: no se modifica IndexedDB',()=>{
  const app=read('app.js'),sw=read('sw.js');
  
  const current=sw.match(/const CACHE='(cuaderno-docente-static-v(\d+)-dev)'/);
  assert(current&&Number(current[2])>=150,'La nueva caché no puede retroceder de v150');
  assert(app.includes(`caches.open('${current[1]}')`),'La UI y el service worker deben usar la misma caché');
  assert(!app.includes('indexedDB.deleteDatabase'));
  assert(!sw.includes('indexedDB.deleteDatabase'));
});
test('el cambio de navegación es solo de presentación: persistencia y notas intactas',()=>{
  const doc=initialNotebook(),before=structuredClone(doc);
  const st=doc.students[0],g=doc.groups[0],p=doc.periods[0];
  const note=overallGrade(doc,st.id,g.id,p.id),annual=finalGrade(doc,st.id,g.id);
  assert.equal(overallGrade(doc,st.id,g.id,p.id),note);
  assert.equal(finalGrade(doc,st.id,g.id),annual);
  assert.deepEqual(doc,before);
  assertModel(doc);
});
