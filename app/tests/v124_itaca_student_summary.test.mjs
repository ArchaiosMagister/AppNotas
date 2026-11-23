import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {emptyNotebook,addGroup,addStudent,addAssessment,setGrade,setItacaGroupRule,setItacaStudentRule,assertModel} from '../src/model.js';
import {overallGrade,itacaGrade} from '../src/calculations.js';

function fixture(){
  const doc=emptyNotebook();
  const group=addGroup(doc,'Optativa Latín I','Latín I','2026-2027','1bach');
  const student=addStudent(doc,group.id,{firstName:'Ana',lastName:'Pérez',originGroup:'1.º A'});
  const another=addStudent(doc,group.id,{firstName:'Luis',lastName:'López',originGroup:'1.º B'});
  const period=doc.periods[0];
  const assessment=addAssessment(doc,{name:'Prueba',groupId:group.id,periodId:period.id,categoryId:doc.categories[0].id,maxScore:10});
  setGrade(doc,student.id,assessment.id,6.65);
  return {doc,group,student,another,period};
}

test('la nota Ítaca se obtiene del cálculo central y respeta umbrales, excepciones y sin redondeo',()=>{
  const {doc,group,student,another,period}=fixture();
  const before=structuredClone(doc);
  assert.equal(overallGrade(doc,student.id,group.id,period.id),6.65);
  assert.equal(itacaGrade(doc,student.id,group.id,period.id),7);
  assert.equal(itacaGrade(doc,another.id,group.id,period.id),null);
  assert.equal(itacaGrade(doc,student.id,group.id,doc.periods[1].id),null);
  assert.deepEqual(doc,before,'La consulta de notas es de solo lectura');
  setItacaGroupRule(doc,group.id,'seven');
  assert.equal(itacaGrade(doc,student.id,group.id,period.id),6);
  setItacaStudentRule(doc,student.id,period.id,'half');
  assert.equal(itacaGrade(doc,student.id,group.id,period.id),7);
  setItacaStudentRule(doc,student.id,period.id,'general');
  assert.equal(itacaGrade(doc,student.id,group.id,period.id),6);
  setItacaGroupRule(doc,group.id,'none');
  assert.equal(itacaGrade(doc,student.id,group.id,period.id),6);
  assertModel(doc);
});

test('visor muestra la media original primero y a su derecha Ítaca mediante el mismo renderizador docente',async()=>{
  const [js,css,sw]=await Promise.all(['app.js','styles.css','sw.js']
    .map(path=>readFile(new URL('../'+path,import.meta.url),'utf8')));
  const start=js.indexOf('function renderStudentView(){');
  const end=js.indexOf('function bindStudentView(){',start);
  assert(start>=0&&end>start);
  const view=js.slice(start,end);
  const header=view.slice(view.indexOf('<div class="student-period-grades">'),view.indexOf('${warnings.length?'));
  assert(view.includes('id="student-period-select"'));
  assert(header.includes("'academic','Media académica'"));
  assert(header.includes("'itaca','Nota Ítaca'"));
  assert(header.includes('gradeChip(overallGrade(STATE.doc,student.id,STATE.groupId,p.id))'));
  assert(header.includes('itacaChip(STATE.doc,student.id,STATE.groupId,p.id)'));
  assert(header.indexOf("'academic'")<header.indexOf("'itaca'"));
  assert(!view.includes('setItacaStudentRule('));
  assert(!view.includes('setItacaGroupRule('));
  assert(!view.includes('commit('));
  assert(css.includes('.student-period-grades{display:flex'));
  assert(css.includes('.student-period-summary>.student-period-name'));
  assert(css.includes('.student-period-itaca'));
  const activeCache=sw.match(/const CACHE='(cuaderno-docente-static-v(\d+)-dev)'/)?.[1];
  assert(activeCache,'El SW debe declarar una caché versionada');
  assert(Number(activeCache.match(/v(\d+)-dev/)[1])>=126);
  assert(js.includes("caches.open('"+activeCache+"')"),'El visor y la comprobación offline deben usar la versión del SW');
});
