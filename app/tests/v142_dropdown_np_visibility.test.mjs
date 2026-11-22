import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {emptyNotebook,addGroup,addStudent,addAssessment,createRubric,
  setGrade,setRubricGrade,setOrthographyGrade,setNotSubmitted,assertModel}
  from '../src/model.js';
import {overallGrade} from '../src/calculations.js';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const slice=src=>src.slice(src.indexOf('/* v142 · Capas coherentes'),src.length);
const scene=()=>{
  const doc=emptyNotebook(),group=addGroup(doc,'Grupo A','Latín I','2026-2027','1bach');
  const student=addStudent(doc,group.id,{firstName:'Lucia',lastName:'García'});
  const period=doc.periods[0],categoryId=doc.categories[0].id;
  return {doc,group,student,period,categoryId};
};

test('Herramientas supera la navegación sticky y los controles del cuaderno pese al aislamiento de cabecera',async()=>{
  const [css,js]=await Promise.all([read('styles.css'),read('app.js')]);
  const p=slice(css);
  assert(css.includes('isolation:isolate'),'La cabecera clásica usa un contexto de apilamiento');
  assert.match(p,/\.topbar\s*\{\s*position:relative;\s*z-index:120;\s*overflow:visible;/);
  assert.match(p,/\.topbar \.topmeta\{position:relative;z-index:2\}/);
  assert.match(p,/\.topbar \.header-tools\[open\]\{z-index:30\}/);
  assert.match(p,/\.topbar \.header-tools-panel\s*\{\s*z-index:150;/);
  assert(css.includes('max-height:min(70dvh,calc(100dvh - 150px))'));
  assert(js.includes('class="header-tools-panel"'));
  assert(js.includes('data-shell-disclosure="tools"'));
  assert(css.includes('html[data-theme="oled"] .header-tools-panel'));
});

test('Opciones de grupo, Más acciones y Gestión académica no quedan tapados ni recortados',async()=>{
  const [css,js]=await Promise.all([read('styles.css'),read('app.js')]);
  const p=slice(css);
  assert(p.includes('.toolbar.class-toolbar:has(.group-actions-disclosure[open])'));
  assert(p.includes('position:relative;z-index:100;overflow:visible'));
  assert(p.includes('.class-toolbar .group-actions-disclosure[open]'));
  assert(p.includes('.panel:has(> .panel-header .notebook-more-actions[open])'));
  assert(p.includes('overflow:visible;'));
  assert(p.includes('z-index:85'));
  assert(p.includes('.notebook-more-actions[open]{z-index:60}'));
  assert(p.includes('.tabs:has(.academic-disclosure[open]){z-index:35}'));
  assert(p.includes('.class-stat-popover{z-index:180}'));
  for(const klass of ['group-actions-panel','notebook-more-panel','nav-academic-links'])
    assert(css.includes(klass),'No alterar menú '+klass);
  for(const menu of ['group-actions-disclosure','notebook-more-actions','academic-disclosure'])
    assert(js.includes(menu),'El menú original '+menu+' sigue disponible');
  assert(css.includes('@media(max-width:640px)'));
  assert(css.includes('.class-toolbar .group-actions-panel{position:static'));
  assert(css.includes('.notebook-more-panel{position:static'));
});

test('NP aparece en la posición principal de la nota para escala común, rúbrica y ortografía',async()=>{
  const app=await read('app.js');
  const view=app.slice(app.indexOf('function renderNotebook(){'),app.indexOf('const ITACA_OPTIONS=',app.indexOf('function renderNotebook(){')));
  assert(view.includes('const npGradeMarker='));
  assert(view.includes('class="np-grade-marker" aria-label="No presentado"'));
  assert(view.includes("g?.notSubmitted?npGradeMarker:g?gradeChip(score)"));
  assert(view.includes("g?.notSubmitted?`${npGradeMarker}<small class=\"np-edit-hint\">Pulsar para editar</small>`"));
  assert(view.includes("g?.notSubmitted?'np-grade-input'"));
  assert(view.includes("placeholder=\"${g?.pendingJustified?'AJ':g?.notSubmitted?'NP':'—'}\""));
  assert(view.includes('data-rubric-grade='));
  assert(view.includes('data-orthography-grade='));
  assert(view.includes('data-student='));
  assert(view.includes('data-assessment='));
  assert(view.includes('data-np-student='));
  assert(view.includes('aria-pressed="${!!g?.notSubmitted}"'));
});

test('la insignia NP tiene contraste fuerte y el input continúa enfocable y editable en claro/oscuro/OLED',async()=>{
  const css=await read('styles.css'),p=slice(css);
  assert(p.includes('.grade-table .note-input.np-grade-input{'));
  assert(p.includes('background:#74263f!important;'));
  assert(p.includes('color:#fff!important;'));
  assert(p.includes('.grade-table .note-input.np-grade-input::placeholder{'));
  assert(p.includes('opacity:1;'));
  assert(p.includes('font-weight:900'));
  assert(p.includes('.grade-table .note-input.np-grade-input:focus{'));
  assert(p.includes('background:var(--surface)!important;'));
  assert(p.includes('border-color:var(--accent)!important;'));
  assert(p.includes('.grade-table .np-grade-marker{'));
  assert(p.includes('min-height:37px;'));
  assert(p.includes('.grade-table .rubric-grade-button:has(.np-grade-marker)'));
  assert(p.includes('.grade-table .orthography-grade-button:has(.np-grade-marker)'));
  assert(p.includes('html[data-theme="oled"] .grade-table .np-button[aria-pressed="true"]'));
});

test('al escribir nota nueva, NP desaparece y se restaura el cálculo normal sin alterar otras actividades',()=>{
  const {doc,student,group,period,categoryId}=scene();
  const standard=addAssessment(doc,{name:'Oración',groupId:group.id,periodId:period.id,categoryId});
  const other=addAssessment(doc,{name:'Texto',groupId:group.id,periodId:period.id,categoryId});
  setGrade(doc,student.id,other.id,6);
  setNotSubmitted(doc,student.id,standard.id,true);
  assert.equal(doc.grades.find(g=>g.assessmentId===standard.id).notSubmitted,true);
  const withNP=overallGrade(doc,student.id,group.id,period.id);
  setGrade(doc,student.id,standard.id,7.5);
  const restored=doc.grades.find(g=>g.assessmentId===standard.id);
  assert.equal(restored.score,7.5);
  assert.equal(restored.notSubmitted,undefined);
  assert.notEqual(overallGrade(doc,student.id,group.id,period.id),withNP);
  assert.equal(doc.grades.find(g=>g.assessmentId===other.id).score,6);
  assertModel(doc);
});

test('las rúbricas permiten sustituir NP con su editor habitual',()=>{
  const {doc,student,group,period,categoryId}=scene();
  const rubric=createRubric(doc,'Exposición',[{name:'Contenido',maxScore:10,weight:1}]);
  const assessment=addAssessment(doc,{name:'Exposición',groupId:group.id,periodId:period.id,categoryId,rubricId:rubric.id});
  setNotSubmitted(doc,student.id,assessment.id,true);
  assert(doc.grades.find(g=>g.assessmentId===assessment.id).notSubmitted);
  setRubricGrade(doc,student.id,assessment.id,{[rubric.criteria[0].id]:8});
  const updated=doc.grades.find(g=>g.assessmentId===assessment.id);
  assert.equal(updated.notSubmitted,undefined);
  assert.equal(updated.score,8);
  assert.equal(updated.rubricRatings.length,1);
  assertModel(doc);
});

test('los exámenes ortográficos permiten sustituir NP con su editor habitual',()=>{
  const {doc,student,group,period,categoryId}=scene();
  const assessment=addAssessment(doc,{
    name:'Examen con faltas',groupId:group.id,periodId:period.id,categoryId,
    convertToTen:true,
    orthography:{enabled:true,penaltyPerFault:0.1,repetitions:30,refundable:true}
  });
  setNotSubmitted(doc,student.id,assessment.id,true);
  assert.equal(doc.grades.find(g=>g.assessmentId===assessment.id).notSubmitted,true);
  setOrthographyGrade(doc,student.id,assessment.id,{score:8,faults:2,delivered:false});
  const updated=doc.grades.find(g=>g.assessmentId===assessment.id);
  assert.equal(updated.notSubmitted,undefined);
  assert.equal(updated.score,8);
  assert.equal(updated.orthographyFaults,2);
  assertModel(doc);
});

test('la PWA fuerza la renovación de estilos tanto en app como en service worker',async()=>{
  const [app,sw]=await Promise.all([read('app.js'),read('sw.js')]);
  assert(app.includes("caches.open('cuaderno-docente-static-v143-dev')"));
  assert(sw.includes("const CACHE='cuaderno-docente-static-v143-dev'"));
});
