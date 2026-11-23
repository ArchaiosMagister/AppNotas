import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {emptyNotebook,addGroup,addStudent,addAssessment,setOrthographyGrade,assertModel}
  from '../src/model.js';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const fragment=(source,start,end)=>source.slice(source.indexOf(start),end?source.indexOf(end,source.indexOf(start)):undefined);

test('etimología griega no modifica la anchura de la columna',async()=>{
  const [css,js]=await Promise.all([read('styles.css'),read('app.js')]);
  assert.match(css,/\.table-scroller>\.grade-table\{[^}]*table-layout:fixed;/);
  assert.match(css,/\.table-scroller>\.grade-table th\.category-tinted,[\s\S]*?\{[^}]*width:165px;[^}]*min-width:165px;[^}]*max-width:165px;/);
  assert.match(css,/\.table-scroller>\.grade-table tbody td \.orthography-meta\{[^}]*overflow-wrap:anywhere;/);
  assert(js.includes("table.style.setProperty('--notebook-table-min-width'"));
  assert(js.includes("a.greekEtymologyBonusEnabled?' · +1 etimología griega'"));
});

test('al introducir una nota se conserva scroll vertical y horizontal aunque se reconstruya el DOM',async()=>{
  const js=await read('app.js');
  const commit=fragment(js,'function commit(action,','function navigateHistory');
  const notebook=fragment(js,'function bindNotebook(){','function openGradeCellActions(');
  assert(commit.includes("label==='Editar nota'&&STATE.tab==='cuaderno'"));
  assert(commit.includes("scrollLeft:$('.table-scroller')?.scrollLeft"));
  assert(commit.includes("scrollTop:$('.table-scroller')?.scrollTop"));
  assert(commit.includes("window.scrollTo(notebookScroll.x,notebookScroll.y)"));
  assert(commit.includes('requestAnimationFrame(restore)'));
  assert(notebook.includes("field.addEventListener('input',()=>{lastInputScroll=snapshotGradeScroll();})"));
  assert(notebook.includes('positionAtEnter||lastInputScroll||snapshotGradeScroll()'));
  assert(notebook.includes('next.focus({preventScroll:true})'));
});

test('el número de faltas se deja en blanco y se interpreta como cero únicamente al guardar',async()=>{
  const js=await read('app.js');
  const modal=fragment(js,'function openOrthographyGrade(','function openAssessmentTools(');
  assert(modal.includes('id="orth-count"'));
  assert(modal.includes("current?.orthographyFaults?esc(current.orthographyFaults):''"));
  assert(modal.includes("count.value.trim()===''||/^\\d{1,4}$/.test(count.value)"));
  assert(modal.includes("faults:count.value.trim()===''?'0':count.value"));
  const doc=emptyNotebook();
  const group=addGroup(doc,'Prueba','Latín 4.º','2026-27','4eso');
  const student=addStudent(doc,group.id,'Alumno ficticio');
  const cat=doc.categories.find(c=>c.name==='Exámenes');
  const exam=addAssessment(doc,{groupId:group.id,periodId:doc.periods[0].id,categoryId:cat.id,name:'Etimología',maxScore:10,convertToTen:true,
    orthography:{enabled:true,penaltyPerFault:0.1,repetitions:30,refundable:true},greekEtymologyBonusEnabled:true});
  setOrthographyGrade(doc,student.id,exam.id,{score:'7',faults:'0',delivered:false,greekEtymologyBonus:'0.5'});
  assert.equal(doc.grades.find(g=>g.assessmentId===exam.id).orthographyFaults,0);
  assertModel(doc);
});

test('zoom accesible 80–140 %, persistente y sin modificar datos',async()=>{
  const [js,css]=await Promise.all([read('app.js'),read('styles.css')]);
  assert(js.includes("notebookZoom:savedNotebookZoom()"));
  assert(js.includes("localStorage.setItem('appnotas-notebook-zoom'"));
  assert(js.includes('NOTEBOOK_ZOOM_MIN=80,NOTEBOOK_ZOOM_MAX=140'));
  for(const id of ['notebook-zoom-out','notebook-zoom-in','notebook-zoom-value'])assert(js.includes(id));
  assert(js.includes("paintNotebookZoom(root)"));
  assert(js.includes("table.style.setProperty('--notebook-zoom'"));
  assert.match(css,/\.table-scroller>\.grade-table\{[^}]*zoom:var\(--notebook-zoom,1\)/);
  assert.match(css,/@media print\{\.notebook-zoom-tools\{display:none!important\}\}/);
  assert(!js.includes('style="--notebook-zoom'),'Los estilos deben usar CSSOM por la CSP');
});
