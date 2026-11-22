import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {initialNotebook,assertModel,sortStudents} from '../src/model.js';
import {overallGrade,finalGrade} from '../src/calculations.js';

const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const files=()=>Promise.all([read('app.js'),read('styles.css'),read('sw.js'),read('index.html')]);

async function skins(){
  const js=await read('app.js');
  const begin=js.indexOf('function classicalSkinFor(level,subject){');
  const end=js.indexOf('function applyTheme(){',begin);
  assert(begin>0&&end>begin,'La identidad visual está aislada de la lógica académica');
  return runInNewContext(js.slice(begin,end)+';({classicalSkinFor,CLASSICAL_SKIN_TITLES})');
}
test('los tres diseños corresponden a cursos reales, sin modificar categorías de materias',async()=>{
  const {classicalSkinFor,CLASSICAL_SKIN_TITLES}=await skins();
  const sample=[
    ['4eso','Latín 4.º','marmorea'],['1bach','Latín I','marmorea'],
    ['2bach','Latín II','tabularium'],['1bach','Griego I','attica'],
    ['2bach','Griego II','attica'],['legacy','Latín I','marmorea']
  ];
  for(const [level,subject,expected] of sample)
    assert.equal(classicalSkinFor(level,subject),expected,subject);
  assert.equal(CLASSICAL_SKIN_TITLES.marmorea,'SCHOLA MARMOREA');
  assert.equal(CLASSICAL_SKIN_TITLES.tabularium,'TABULARIUM');
  assert.equal(CLASSICAL_SKIN_TITLES.attica,'ACADEMIA ATTICA');
});
test('cambiar materia actualiza solo data-course-skin, compatible con Claro, Oscuro y OLED',async()=>{
  const js=await read('app.js');
  const block=js.slice(js.indexOf('function applyTheme(){'),js.indexOf('const pairOptions=',js.indexOf('function applyTheme(){')));
  assert(block.includes('document.documentElement.dataset.theme=STATE.theme'));
  assert(block.includes('document.documentElement.dataset.courseSkin=classicalSkinFor(STATE.level,STATE.subject)'));
  assert(block.includes("document.documentElement.style.setProperty('--accent',color)"),
    'No se pierde el color de acento configurado por el docente');
  assert(js.includes("function setSubjectChoice(level,subject){"));
  assert(js.includes("STATE.groupId=groupsForSubject()[0]?.id||null;"));
  assert(js.includes('render();'));
});
test('la banda de Safari aporta 50 px libres encima de los botones sin superposición',async()=>{
  const css=await read('styles.css');
  assert(css.includes('.topbar::before{'));
  assert(/\.topbar::before\{[^}]*height:50px/.test(css));
  assert(css.includes('padding-top:calc(62px + env(safe-area-inset-top,0px))!important'));
  assert(css.includes('padding-top:calc(60px + env(safe-area-inset-top,0px))!important'));
  assert(css.includes('pointer-events:none;z-index:0'));
  assert(css.includes('.topbar>.brand,.topbar>.topmeta{position:relative;z-index:1}'));
  assert(css.includes('@media print{'));
  assert(css.includes('.topbar::before{display:none!important}'));
});
test('tres tratamientos visuales autónomos, con motivos clásicos sin peticiones remotas',async()=>{
  const css=await read('styles.css');
  for(const key of ['marmorea','tabularium','attica']){
    assert(css.includes(`html[data-theme="light"][data-course-skin="${key}"]`),key);
    assert(css.includes(`html[data-theme="light"][data-course-skin="${key}"] .topbar`),key);
    assert(css.includes(`html[data-theme="light"][data-course-skin="${key}"] .tabs::after`),key);
  }
  assert((css.match(/data:image\/svg\+xml/g)||[]).length>=3);
  assert(!css.includes('fonts.googleapis.com'),'No dependemos de fuentes de terceros');
  assert(!css.includes('cdn.jsdelivr.net'),'No dependemos de recursos externos');
  assert(css.includes('Baskerville'));
  assert(css.includes('Palatino Linotype'));
  assert(css.includes('html[data-theme="oled"][data-course-skin] .shell,'));
  assert(css.includes('background:#000!important'));
  assert(css.includes('html[data-course-skin] .tabs::after{display:none!important}'));
});
test('la interfaz existente conserva controles docentes y el modo grupo',async()=>{
  const [app]=await files();
  for(const id of ['save-status','close-notebook','open-notebook','lock','theme-select',
    'new-group','new-student','new-assessment','student-sort-mode',
    'student-group-mode','itaca-general-rule','csv-import','undo-change','redo-change'])
    assert(app.includes('id="'+id+'"'),id);
  assert(app.includes('data-group-choice='));
  assert(app.includes('class="course-switch"'));
  assert(app.includes("$('#close-notebook')?.addEventListener('click',()=>closeNotebook().catch(fail))"));
  assert(app.includes("sortStudents(STATE.doc.students.filter(x=>x.groupId===STATE.groupId),STATE.studentSort)"));
  assert(app.includes('renderFinalEvaluation()'));
  assert(app.includes('renderPlanner(STATE.doc,STATE)'));
  assert(app.includes('renderStudentView()'));
});
test('las notas, identidad de alumno y cálculos mantienen su semántica con cualquier diseño',()=>{
  const doc=initialNotebook();
  assertModel(doc);
  const before=structuredClone(doc);
  for(const mode of ['surname','originGroup','firstName','manual']){
    const students=sortStudents(doc.students,mode);
    assert.equal(students.length,doc.students.length);
    for(const s of students){
      const group=doc.groups.find(g=>g.id===s.groupId);
      if(group){
        overallGrade(doc,s.id,group.id,doc.periods[0].id);
        finalGrade(doc,s.id,group.id);
      }
    }
  }
  assert.deepEqual(doc,before);
});
test('la PWA precarga los mismos archivos y usa una caché nueva en SW y aplicación',async()=>{
  const [app,css,sw,index]=await files();
  assert(sw.includes("const CACHE='cuaderno-docente-static-v140-dev'"));
  assert(app.includes("caches.open('cuaderno-docente-static-v140-dev')"));
  assert(sw.includes("'./styles.css'"));
  assert(index.includes('href="./styles.css"'));
  assert(index.includes("img-src 'self' data:"));
  assert(css.includes('data:image/svg+xml'));
});
