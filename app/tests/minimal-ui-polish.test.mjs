import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {initialNotebook,addGroup,addStudent,assertModel} from '../src/model.js';
import {overallGrade,finalGrade} from '../src/calculations.js';
import {renderPlanner} from '../src/planner-ui.js';
import {renderEvaluationWorkspace} from '../src/evaluation-workspace.js';

const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const app=read('app.js'),css=read('styles.css');
const esc=value=>String(value).replace(/[&<>"']/g,c=>({
 '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));
function groupSelector(groups,active=groups[0]?.id){
 const start=app.indexOf('${matching.length>2?');
 const end=app.indexOf('\n  </div>\n  <div class="actions class-more-actions">',start);
 assert(start>=0&&end>start,'Selector contextual del grupo no encontrado');
 return runInNewContext('`'+app.slice(start,end)+'`',{
  matching:groups,STATE:{groupId:active},subjectLabel:'Latín I',esc
 });
}
const group=(id,name,course='2026-2027')=>({id,name,course});

test('uno o ningún grupo: no aparece un selector redundante',()=>{
 assert.equal(groupSelector([]),'');
 assert.equal(groupSelector([group('a','A')]),'');
});
test('dos grupos: botones accesibles de acceso directo y grupo seleccionado',()=>{
 const html=groupSelector([group('a','A'),group('b','B')],'b');
 assert(html.includes('class="group-buttons"'));
 assert(html.includes('data-group-choice="a"'));
 assert(html.includes('data-group-choice="b" aria-pressed="true"'));
 assert(!html.includes('id="group-quick-select"'));
 assert(html.includes('role="group"'));
});
test('tres o más grupos: un único selector, con nombre y año escolar para distinguir duplicados',()=>{
 const html=groupSelector([group('a','1.º A'),group('b','1.º A','2027-2028'),group('c','1.º B')],'b');
 assert(html.includes('<label class="group-switch-label" for="group-quick-select">Grupo</label>'));
 assert(html.includes('id="group-quick-select"'));
 assert(html.includes('aria-label="Seleccionar grupo de Latín I"'));
 assert(html.includes('value="b" selected'));
 assert(html.includes('1.º A · 2026-2027'));
 assert(html.includes('1.º A · 2027-2028'));
 assert(!html.includes('data-group-choice='));
 assert.equal((html.match(/<option /g)||[]).length,3);
});
test('los nombres de grupo se escapan: un grupo importado no inyecta HTML',()=>{
 const html=groupSelector([group('a','A'),group('b','B'),group('c','<script>alert(1)</script>')]);
 assert(!html.includes('<script>alert(1)</script>'));
 assert(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
});
test('cambiar grupo modifica solo el estado de navegación, no notas, curso ni evaluación',()=>{
 const doc=initialNotebook({empty:true}),a=addGroup(doc,'1.º A','Latín I','2026-2027','1bach'),
 b=addGroup(doc,'1.º B','Latín I','2026-2027','1bach'),
 c=addGroup(doc,'1.º C','Latín I','2026-2027','1bach');
 addStudent(doc,a.id,{name:'Alba'});
 const before=structuredClone(doc);
 const STATE={doc,groupId:a.id,periodId:doc.periods[0].id,competencyVersion:'2022'};
 let onchange,renderCount=0,focusCount=0;
 const select={addEventListener(name,callback){assert.equal(name,'change');onchange=callback;},
  focus(options){assert.equal(options.preventScroll,true);focusCount++}};
 const start=app.indexOf("  $('#group-quick-select')?.addEventListener('change'");
 const end=app.indexOf("  document.querySelectorAll('[data-group-choice]')",start);
 assert(start>0&&end>start);
 runInNewContext('(function(){'+app.slice(start,end)+'})()',{
  $:key=>{assert.equal(key,'#group-quick-select');return select;},
  STATE,groupsForSubject:()=>[a,b,c],render:()=>{renderCount++;}
 });
 onchange({target:{value:b.id}});
 assert.equal(STATE.groupId,b.id);
 assert.equal(STATE.competencyVersion,'auto');
 assert.equal(STATE.periodId,doc.periods[0].id);
 assert.equal(renderCount,1);
 assert.equal(focusCount,1);
 onchange({target:{value:'grupo-de-otra-asignatura'}});
 assert.equal(STATE.groupId,b.id);
 assert.equal(renderCount,1);
 assert.deepEqual(doc,before);
 assertModel(doc);
});
test('la barra de materias mantiene los botones y sus colores, sin menú oculto',()=>{
 assert(app.includes('data-course-level='));
 assert(app.includes('data-course-subject='));
 assert(app.includes('aria-pressed="${STATE.level===x.level&&STATE.subject===x.subject}"'));
 assert(app.includes("button.style.setProperty('--course-accent'"));
 assert(css.includes('.class-toolbar .course-switch .course-buttons{'));
 assert(css.includes('scroll-snap-type:x proximity'));
 assert(css.includes('overscroll-behavior-x:contain'));
 assert(css.includes('.course-choice[aria-pressed="true"]'));
 assert(css.includes('min-height:44px'));
});
test('Agenda y Evaluaciones muestran un único título, sin ocultar el estado de guardado',()=>{
 assert(app.includes("!['planificador','evaluaciones'].includes(STATE.tab)?"));
 assert(app.includes('id="save-status"'));
 assert(app.includes('id="portable-status"'));
 assert(app.includes('id="lock"'));
 assert(app.includes('id="open-notebook"'));
 const doc=initialNotebook(),before=structuredClone(doc);
 const agenda=renderPlanner(doc,{plannerMode:'week',plannerDate:'2026-11-23'});
 const evaluations=renderEvaluationWorkspace(doc,{evaluationWorkspaceTab:'sesiones'});
 assert(agenda.includes('<h2>Mi planificador</h2>'));
 assert(evaluations.includes('<h2>Sesiones de evaluación</h2>'));
 assert.deepEqual(doc,before);
});
test('los tres temas, la legibilidad táctil y el modo impresión conservan sus excepciones',()=>{
 for(const token of ['html[data-theme="oled"] .eval-workspace-stats',
  'html[data-theme="oled"] .class-toolbar .group-quick-select',
  '@media(max-width:900px)','@media(max-width:650px)','@media print',
  '.group-quick-select:focus-visible','scrollbar-width:thin'])assert(css.includes(token),token);
 assert(css.includes('.class-toolbar .course-switch .course-choice:focus-visible'));
 assert(css.includes('.grade-cell-actions-trigger:focus-visible'));
});
test('la mejora estética no cambia notas, evaluaciones ni medias anuales',()=>{
 const doc=initialNotebook(),before=structuredClone(doc),student=doc.students[0],
 group=doc.groups[0],period=doc.periods[0];
 const overall=overallGrade(doc,student.id,group.id,period.id),annual=finalGrade(doc,student.id,group.id);
 assert.equal(overallGrade(doc,student.id,group.id,period.id),overall);
 assert.equal(finalGrade(doc,student.id,group.id),annual);
 assert.deepEqual(doc,before);
 assertModel(doc);
});

test('Evaluaciones no oculta las materias: cabecera consistente entre módulos',()=>{
 assert(app.includes('class="toolbar class-toolbar" aria-label="Asignatura y grupo"'));
 assert(!app.includes("STATE.tab==='evaluaciones'?'hidden':''"));
 assert(app.includes("revealSelectedButton($('.course-buttons')"));
 assert(app.includes('title="${esc(x.subjectName+\' · \'+x.stage)}"'));
});
test('iPhone/iPad: controles de 44 px y scroll horizontal accesible',()=>{
 const stable=css.slice(css.indexOf('/* v163 · Materias estables'));
 assert(stable.includes('scroll-snap-type:x proximity'));
 assert(stable.includes('-webkit-overflow-scrolling:touch'));
 assert(stable.includes('max-width:min(175px,58vw)'));
 assert(stable.includes('overflow-wrap:anywhere'));
 assert(stable.includes('@media(pointer:coarse)'));
 assert(stable.includes('.eval-workspace-tab{min-height:44px'));
 assert(stable.includes('.class-toolbar .group-choice{min-height:44px'));
 assert(stable.includes('.academic-quick-nav .btn'));
 assert(!stable.includes('@media(max-width:900px)'));
});
