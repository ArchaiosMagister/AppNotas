import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {initialNotebook,assertModel,COURSE_SUBJECTS,SUBJECT_COLORS,subjectKey,addGroup,setSubjectAccent} from '../src/model.js';
import {overallGrade} from '../src/calculations.js';

const read=file=>readFile(new URL('../'+file,import.meta.url),'utf8');

async function palette(doc){
  const app=await read('app.js');
  const a=app.indexOf('function colorFor(level,subject){');
  const b=app.indexOf('function contrastFor(',a);
  assert(a>0&&b>a,'La paleta de presentación debe estar aislada');
  return runInNewContext(app.slice(a,b)+';({colorFor})',{
    STATE:{doc},SUBJECT_COLORS,subjectKey
  });
}
test('hay cinco materias visibles y ninguna necesita desplegable de asignatura o grupo',async()=>{
  const js=await read('app.js');
  const a=js.indexOf('function render(){'),b=js.indexOf('function renderNotebook(){',a);
  const html=js.slice(a,b);
  assert(html.includes('class="course-switch" role="group" aria-label="Seleccionar asignatura"'));
  assert(html.includes('courseChoices.map('));
  assert(html.includes('<strong class="course-name">${esc(x.subjectName)}</strong>'));
  assert(html.includes('level,subject,subjectName:subject,stage:entry.label'));
  assert(!html.includes('class="course-picker course-disclosure"'));
  assert(!html.includes('id="group-select"'));
  const pairs=Object.entries(COURSE_SUBJECTS).flatMap(([level,entry])=>entry.subjects.map(subject=>[level,subject]));
  assert.equal(pairs.length,5);
  assert.deepEqual(pairs.map(([,name])=>name).sort(),['Griego I','Griego II','Latín 4.º','Latín I','Latín II'].sort());
});
test('grupos: botones solo cuando hay varios y su elección no altera datos',async()=>{
  const js=await read('app.js');
  assert(js.includes("matching.length>1?"));
  assert(js.includes('class="group-switch" role="group"'));
  assert(js.includes('data-group-choice='));
  assert(js.includes('aria-pressed="${x.id===STATE.groupId}"'));
  assert(js.includes("document.querySelectorAll('[data-group-choice]').forEach(button=>{"));
  assert(js.includes("!groupsForSubject().some(g=>g.id===groupId)"));
  assert(js.includes('STATE.groupId=groupId;STATE.competencyVersion=\'auto\';'));
  assert(js.includes('focus({preventScroll:true})'));
  assert(js.includes('id="new-group"'),'Crear grupo debe continuar disponible');
  const doc=initialNotebook(),g=doc.groups[0];
  addGroup(doc,'Grupo B',g.subject,g.course,g.level);
  assertModel(doc);
  const copy=structuredClone(doc);
  for(const student of doc.students)overallGrade(doc,student.id,g.id,doc.periods[0].id);
  assert.deepEqual(doc,copy);
});
test('se conservan exactamente los cinco colores originales de acento',async()=>{
  const doc=initialNotebook(),{colorFor}=await palette(doc);
  const expected={
    '4eso:Latín 4.º':'#EAB308',
    '1bach:Latín I':'#F59E0B',
    '2bach:Latín II':'#EA580C',
    '1bach:Griego I':'#0284C7',
    '2bach:Griego II':'#1D4ED8'
  };
  assert.equal(Object.keys(expected).length,5);
  for(const [key,color] of Object.entries(expected)){
    const pivot=key.indexOf(':'),level=key.slice(0,pivot),subject=key.slice(pivot+1);
    assert.equal(SUBJECT_COLORS[key],color,'Paleta original '+key);
    assert.equal(colorFor(level,subject),color,'Color visible '+key);
  }
  assert.equal(new Set(Object.values(expected)).size,5);
});
test('los colores personalizados se preservan sin mutar el cuaderno',async()=>{
  const doc=initialNotebook(),before=structuredClone(doc);
  const {colorFor}=await palette(doc);
  assert.equal(colorFor('1bach','Latín I'),'#F59E0B');
  assert.deepEqual(doc,before);
  setSubjectAccent(doc,'1bach','Latín I','#742AC6');
  const next=await palette(doc);
  assert.equal(next.colorFor('1bach','Latín I'),'#742AC6');
  assert.equal(next.colorFor('1bach','Griego I'),'#0284C7');
  assertModel(doc);
});
test('la barra de materias conserva los bordes coloreados sin romper móvil, oscuro u OLED',async()=>{
  const css=await read('styles.css');
  assert(css.includes('/* v138 · Selección directa de materia y grupos contextuales'));
  assert(css.includes('.class-toolbar .course-switch .course-buttons'));
  assert(css.includes('grid-template-columns:repeat(5,minmax(0,1fr))'));
  assert(css.includes('grid-template-columns:repeat(3,minmax(0,1fr))'));
  assert(css.includes('grid-template-columns:repeat(2,minmax(0,1fr))'));
  assert(css.includes('border-top:4px solid var(--course-accent)'));
  assert(css.includes('.class-toolbar .course-switch .course-choice[aria-pressed="true"]'));
  assert(css.includes('.class-toolbar .group-choice[aria-pressed="true"]'));
  assert(css.includes('html[data-theme="oled"] .class-toolbar .course-switch .course-choice'));
  assert(css.includes('min-height:44px'));
});
test('los controles académicos y la PWA siguen intactos',async()=>{
  const [app,sw]=await Promise.all([read('app.js'),read('sw.js')]);
  for(const id of ['new-group','edit-group','csv-import','accent-select','new-student','new-assessment',
    'close-notebook','open-notebook','lock','student-group-mode','student-sort-mode'])
    assert(app.includes('id="'+id+'"'),id);
  assert(app.includes("document.documentElement.style.setProperty('--classic-accent',color)"));
  assert(app.includes("button.style.setProperty('--course-accent',"));
  assert(app.includes("caches.open('cuaderno-docente-static-v143-dev')"));
  assert(sw.includes("const CACHE='cuaderno-docente-static-v143-dev'"));
  assert(!app.includes('indexedDB.deleteDatabase'));
});
