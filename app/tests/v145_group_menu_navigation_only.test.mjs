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
test('Cálculos y Competencias salen del lateral, Currículo y Rúbricas permanecen',()=>{
  const app=read('app.js');
  const nav=app.slice(app.indexOf('const ACADEMIC_WORKSPACE_TABS='),app.indexOf('function workspaceTab('));
  assert(!nav.includes("['calculos'"));
  assert(!nav.includes("['competencias'"));
  assert(nav.includes("['curriculo'"));
  assert(nav.includes("['rubricas'"));
});
test('los cuatro accesos están contiguos en la cabecera del cuaderno',()=>{
  const app=read('app.js');
  const notebook=app.slice(app.indexOf('function renderNotebook(){'),app.indexOf('const ITACA_OPTIONS=',app.indexOf('function renderNotebook(){')));
  const names=['id="new-student"','id="new-assessment"','id="notebook-calculations"','id="notebook-competencies"'];
  const positions=names.map(token=>notebook.indexOf(token));
  assert(positions.every(x=>x>=0));
  for(let i=1;i<positions.length;i++)assert(positions[i]>positions[i-1]);
  assert(notebook.includes('data-academic-quick="calculos"'));
  assert(notebook.includes('data-academic-quick="competencias"'));
});
test('Cálculos y Competencias disponen de vuelta al cuaderno y navegación entre vistas',()=>{
  const app=read('app.js');
  const nav=app.slice(app.indexOf('function renderAcademicQuickNav(){'),app.indexOf('function renderPeriodButtons(){'));
  for(const path of ['cuaderno','calculos','competencias'])
    assert(nav.includes('data-academic-quick="'+path+'"'));
  assert(nav.includes('aria-current="page"'));
  assert(app.includes("hasGroup&&['calculos','competencias'].includes(STATE.tab)?renderAcademicQuickNav():''"));
  assert(app.includes("document.querySelectorAll('[data-academic-quick]').forEach"));
  assert(app.includes("if(!['cuaderno','calculos','competencias'].includes(destination)||!STATE.groupId)return"));
  assert(!app.includes("$('#notebook-calculations')?.addEventListener("));
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
  assert(sw.includes("const CACHE='cuaderno-docente-static-v150-dev'"));
  assert(app.includes("caches.open('cuaderno-docente-static-v150-dev')"));
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
