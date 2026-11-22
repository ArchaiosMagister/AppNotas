import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {COURSE_SUBJECTS,SUBJECT_COLORS,initialNotebook,assertModel,setSubjectAccent} from '../src/model.js';
import {overallGrade,finalGrade} from '../src/calculations.js';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('la paleta vigente se usa en la interfaz sin alterar el cuaderno',async()=>{
  const source=await read('app.js');
  const a=source.indexOf('function colorFor(level,subject){');
  const b=source.indexOf('function contrastFor(',a);
  assert(a>0&&b>a);
  const doc=initialNotebook(),unchanged=structuredClone(doc);
  const colorFor=runInNewContext(source.slice(a,b)+';colorFor',{
    STATE:{doc},SUBJECT_COLORS,subjectKey:(level,subject)=>level+':'+subject
  });
  const original={
    '4eso:Latín 4.º':'#B43F60',
    '1bach:Latín I':'#F59E0B',
    '1bach:Griego I':'#0284C7',
    '2bach:Latín II':'#EA580C',
    '2bach:Griego II':'#1D4ED8'
  };
  assert.equal(Object.keys(original).length,5);
  for(const [level,entry] of Object.entries(COURSE_SUBJECTS)){
    for(const subject of entry.subjects){
      const key=level+':'+subject;
      assert.equal(SUBJECT_COLORS[key],original[key]);
      assert.equal(colorFor(level,subject),original[key]);
    }
  }
  assert.deepEqual(doc,unchanged,'La presentación no modifica el cuaderno');
  setSubjectAccent(doc,'1bach','Griego I','#125A7E');
  assert.equal(colorFor('1bach','Griego I'),'#125A7E','Respetar colores elegidos anteriormente');
  assert.equal(colorFor('2bach','Griego II'),'#1D4ED8','No modificar otra asignatura');
  assertModel(doc);
  assert(!source.includes('CLASSICAL_SUBJECT_ACCENTS'),'No mantener paletas sustitutivas');
});

test('la cabecera de Griego conserva sus variantes, pero el acento de los controles es el original',async()=>{
  const [app,css]=await Promise.all([read('app.js'),read('styles.css')]);
  assert(app.includes("dataset.courseVariant=STATE.subject==='Griego II'?'griego-ii'"));
  assert(app.includes("document.documentElement.style.setProperty('--accent',color)"));
  assert(css.includes('html[data-course-skin="attica"][data-course-variant="griego-i"]'));
  assert(css.includes('html[data-course-skin="attica"][data-course-variant="griego-ii"]'));
  assert(css.includes('background:var(--accent);'));
  assert(css.includes('border-left-color:var(--accent);'));
  assert(!css.includes('--attica-button'),'Evitar acentos alternativos que tapen preferencias');
});

test('fichas individuales y tarjetas de evaluaciones quedan más estrechas que el área de trabajo',async()=>{
  const css=await read('styles.css');
  const patch=css.slice(css.indexOf('/* v140 · Modo alumno:'));
  assert(patch.startsWith('/* v140 · Modo alumno:'));
  assert(patch.includes('.student-privacy,details.student-period,.student-final-summary{'));
  assert(patch.includes('max-width:880px'));
  assert(patch.includes('.student-period .student-category.student-category-tinted{'));
  assert(patch.includes('max-width:710px'));
  assert(patch.includes('.student-period .student-assessment-block.student-category-tinted{'));
  assert(patch.includes('max-width:650px'));
  assert(patch.includes('.student-directory-grid{'));
  assert(patch.includes('repeat(auto-fill,minmax(205px,250px))'));
  assert(patch.includes('@media(max-width:540px)'));
  assert(patch.includes('grid-template-columns:minmax(0,1fr)'));
});

test('los rótulos de actividades y categorías aumentan de tamaño, son negrita y quedan junto a la nota',async()=>{
  const css=await read('styles.css');
  const patch=css.slice(css.indexOf('/* v140 · Modo alumno:'));
  assert(patch.includes('.student-period .student-assessment{'));
  assert(patch.includes('justify-content:flex-start'));
  assert(patch.includes('gap:5px 12px'));
  assert(patch.includes('.student-period .student-assessment>span:first-child{'));
  assert(patch.includes('font-size:16px;font-weight:800'));
  assert(patch.includes('.student-period .student-assessment>strong{'));
  assert(patch.includes('font-size:16px;font-weight:850'));
  assert(patch.includes('.student-period .student-category>.cardline>strong{'));
  assert(patch.includes('font-size:17px;line-height:1.35;font-weight:850'));
  assert(patch.includes('.student-period .grade-chip,.student-final-summary .grade-chip{'));
  assert(patch.includes('font-size:17px;font-weight:850'));
  assert(patch.includes('.student-period-summary>.student-period-name{'));
  assert(patch.includes('flex:0 1 auto'));
  assert(patch.includes('.student-period-grades{'));
  assert(patch.includes('justify-content:flex-start'));
});

test('los controles y datos del modo alumno siguen presentes, sin exponer a otros alumnos',async()=>{
  const app=await read('app.js');
  const start=app.indexOf('function renderStudentView(){');
  const end=app.indexOf('function bindStudentView(){',start);
  assert(start>0&&end>start);
  const view=app.slice(start,end);
  for(const marker of [
    'student-privacy','student-category','student-assessment-block',
    'student-rubric-breakdown','student-assessment-observation',
    'student-period-summary','student-final-summary','previous-student',
    'next-student','hide-student','categoryGrade(','overallGrade(','finalGrade('
  ])assert(view.includes(marker),'Falta funcionalidad original: '+marker);
  assert(view.includes('Solo aparecen las calificaciones de este alumno.'));
  assert(!view.includes('group.students.map('));
  const doc=initialNotebook(),before=structuredClone(doc),student=doc.students[0];
  const group=doc.groups[0],period=doc.periods[0];
  const mean=overallGrade(doc,student.id,group.id,period.id);
  const final=finalGrade(doc,student.id,group.id);
  assert.equal(overallGrade(doc,student.id,group.id,period.id),mean);
  assert.equal(finalGrade(doc,student.id,group.id),final);
  assert.deepEqual(doc,before);
});

test('el visor sigue legible con pantalla estrecha, claro, oscuro y OLED',async()=>{
  const css=await read('styles.css');
  const start=css.indexOf('/* v140 · Modo alumno:');
  const next=css.indexOf('/* v141 · Centrado',start);
  assert(start>=0&&next>start);
  const patch=css.slice(start,next);
  assert(patch.includes('@media(max-width:700px)'));
  assert(patch.includes('@media(max-width:540px)'));
  assert(patch.includes('flex-direction:row;flex-wrap:wrap;align-items:center'));
  assert(patch.includes('justify-content:flex-start'));
  assert(css.includes('html[data-theme="oled"] .student-period .student-category.student-category-tinted'));
  assert(css.includes('background:#000!important'));
  assert(!patch.includes('display:none'));
});
