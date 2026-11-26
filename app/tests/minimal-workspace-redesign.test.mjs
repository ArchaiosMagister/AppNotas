import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {initialNotebook,assertModel} from '../src/model.js';
import {overallGrade,finalGrade} from '../src/calculations.js';
import {renderPlanner} from '../src/planner-ui.js';

const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const js=read('app.js');
const css=read('styles.css');

test('navegación: Cuaderno, Agenda, Evaluaciones y Extraescolares son primarias',()=>{
 const a=js.indexOf('/** Navegación minimalista:'),b=js.indexOf('function renderPeriodButtons(){',a);
 assert(a>=0&&b>a);
 const src=js.slice(a,b);
 const api=runInNewContext(src+';({renderNavigation,renderAcademicQuickNav})',{
  STATE:{tab:'cuaderno',navCollapsed:false}
 });
 const nav=api.renderNavigation(),quick=api.renderAcademicQuickNav();
 const main=nav.slice(nav.indexOf('class="nav-primary"'),nav.indexOf('class="nav-secondary"'));
 assert.deepEqual([...main.matchAll(/data-tab="([^"]+)"/g)].map(m=>m[1]),['cuaderno','planificador','evaluaciones','extraescolares']);
 for(const label of ['Notas','Cálculos','Competencias','Vista alumno'])assert(quick.includes(label));
 assert(!quick.includes('Evaluación final'));
 assert(js.includes('class="term-button term-final'),'La evaluación final debe estar junto a los períodos');
 for(const name of ['curriculo','rubricas','ajustes'])assert(nav.includes('data-tab="'+name+'"'));
 assert(!nav.includes('data-tab="final"'));
 assert(!nav.includes('data-tab="alumno"'));
});

test('vistas de cuaderno mantienen motor y control de acceso desde navegación secundaria',()=>{
 for(const tab of ['cuaderno','calculos','competencias','final','alumno']){
  assert(js.includes("'"+tab+"'"),tab);
 }
 assert(js.includes("['cuaderno','calculos','competencias','final','alumno'].includes(STATE.tab)"));
 assert(js.includes("STATE.studentId=null"),'Mantener salida segura de la vista alumno');
 assert(js.includes('renderFinalEvaluation()'));
 assert(js.includes('renderStudentView()'));
 assert(js.includes('renderCompetencies()'));
 assert(js.includes('renderRules()'));
});

test('la tabla reduce controles visibles sin eliminar NP, AJ ni observaciones',()=>{
 const a=js.indexOf('  const gradeCellActions='),b=js.indexOf('  const gradesByStudent=',a);
 assert(a>=0&&b>a);
 const src=js.slice(a,b);
 const cell=runInNewContext('(function(){'+src+'return gradeCellActions;})()',{
  gradeObservationsByPair:new Map([['s|a',{text:'Observación'}]]),
  observationButton:(id,aid)=>'<button data-observation-student="'+id+'" data-observation-assessment="'+aid+'">Obs.</button>',
  esc:v=>String(v)
 });
 const html=cell({id:'s',name:'Alumna A'},{id:'a',name:'Examen'},{notSubmitted:true},
  '<button data-np-student="s">NP</button>','<button data-aj-student="s">AJ</button>');
 assert(html.includes('data-grade-cell-actions-student="s"'));
 assert(html.includes('data-grade-cell-actions-assessment="a"'));
 assert(html.includes('aria-haspopup="dialog"'));
 assert(html.includes('grade-cell-original-actions" hidden'));
 assert(html.includes('data-np-student="s"'));
 assert(html.includes('data-aj-student="s"'));
 assert(html.includes('data-observation-student="s"'));
 assert(html.includes('grade-cell-observation-mark'));
 assert(html.includes('Estado: NP'));
 assert(css.includes('.grade-cell-original-actions[hidden]{display:none!important}'));
});

test('el cuadro de opciones conserva exactamente los controladores de las tres acciones',()=>{
 const start=js.indexOf('function openGradeCellActions('),end=js.indexOf('function bindNotebook(){',start);
 assert(start>=0&&end>start);
 const doc=initialNotebook(),student=doc.students[0],group=doc.groups[0],activity=doc.assessments[0];
 assert(student&&group&&activity,'El cuaderno de muestra debe tener actividad');
 const original={np:0,aj:0,obs:0};
 const native={
  '[data-np-student]':[{dataset:{npStudent:student.id,npAssessment:activity.id},click(){original.np++;}}],
  '[data-aj-student]':[{dataset:{ajStudent:student.id,ajAssessment:activity.id},click(){original.aj++;}}],
  '[data-observation-student]':[{dataset:{observationStudent:student.id,observationAssessment:activity.id},click(){original.obs++;}}]
 };
 const buttons=new Map();
 const dialog={innerHTML:'',opened:0,closed:0,showModal(){this.opened++;},close(){this.closed++;}};
 const $=(id)=>{if(!buttons.has(id))buttons.set(id,{});return buttons.get(id);};
 const fn=runInNewContext(js.slice(start,end)+';openGradeCellActions',{
  STATE:{doc,groupId:group.id,periodId:activity.periodId},dialog,$,esc:v=>String(v),
  document:{querySelectorAll:k=>native[k]||[]}
 });
 for(const [id,name] of [['grade-action-np','np'],['grade-action-aj','aj'],['grade-action-observation','obs']]){
  fn(student.id,activity.id);
  assert.equal(dialog.opened,dialog.closed+1);
  buttons.get('#'+id).onclick();
  assert.equal(dialog.opened,dialog.closed);
  assert.equal(original[name],1);
 }
 assert(dialog.innerHTML.includes('Opciones de calificación'));
 assertModel(doc);
});

test('Agenda contiene un único + Nuevo con las siete operaciones previas',()=>{
 const doc=initialNotebook(),before=structuredClone(doc);
 const html=renderPlanner(doc,{plannerMode:'week',plannerDate:'2026-11-23'});
 assert(html.includes('id="planner-create-menu"'));
 assert(html.includes('Crear un elemento nuevo en la agenda'));
 for(const key of ['plan-add-slot','plan-add-event','plan-add-lesson','plan-add-task',
  'plan-add-holiday','plan-add-exception','plan-import-patio']){
  assert.equal(html.split('id="'+key+'"').length-1,1,'Acción perdida o duplicada: '+key);
 }
 assert(html.includes('id="plan-show-evaluations"'));
 assert(!html.includes('id="plan-evaluation-shortcut"'));
 assert.deepEqual(doc,before);
});

test('se mantiene la edición directa de notas, rúbricas, ortografía y excepciones',()=>{
 for(const field of ['data-student','data-assessment','data-rubric-grade','data-orthography-grade',
  'data-np-student','data-aj-student','data-observation-student','data-itaca-student',
  'data-explain','id="new-student"','id="new-assessment"']){
  assert(js.includes(field),field);
 }
 assert(js.includes('original?.click()'));
 assert(js.includes('id="itaca-general-rule"'));
 assert(js.includes('id="manage-origin-groups"'));
 assert(js.includes('id="copy-structure"'));
 assert(js.includes('id="schedule-exam"'));
});

test('los ajustes del grupo y la leyenda se pueden desplegar sin ocupar el cuaderno',()=>{
 assert(js.includes('<details class="notebook-grade-options">'));
 assert(js.includes('<details class="legend notebook-legend">'));
 assert(js.includes('id="itaca-general-rule"'));
 assert(css.includes('.notebook-grade-options>summary:focus-visible'));
 assert(css.includes('.notebook-legend>summary:focus-visible'));
});

test('diseño accesible y adaptable a móvil y OLED',()=>{
 for(const selector of ['.planner-create-menu>summary:focus-visible',
  '.grade-cell-actions-trigger:focus-visible','.grade-cell-actions-dialog',
  'html[data-theme="oled"] .planner-create-options','@media(max-width:650px)']){
  assert(css.includes(selector),selector);
 }
 assert(js.includes('aria-haspopup="dialog"'));
 assert(css.includes('.student-focus .academic-quick-nav{display:none!important}'));
});

test('la reorganización visual no muta calificaciones ni modelos académicos',()=>{
 const doc=initialNotebook(),before=structuredClone(doc);
 const student=doc.students[0],group=doc.groups[0],period=doc.periods[0];
 const b=overallGrade(doc,student.id,group.id,period.id),f=finalGrade(doc,student.id,group.id);
 const a=overallGrade(doc,student.id,group.id,period.id),z=finalGrade(doc,student.id,group.id);
 assert.equal(a,b);assert.equal(z,f);
 assert.deepEqual(doc,before);
 assertModel(doc);
});
