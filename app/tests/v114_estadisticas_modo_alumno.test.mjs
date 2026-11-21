import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initialNotebook,addStudent,addAssessment,setGrade,setNotSubmitted,assertModel} from '../src/model.js';
import {categoryGrade,overallGrade,finalGrade} from '../src/calculations.js';
import {assessmentClassStatistics,periodClassStatistics} from '../src/statistics.js';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
const statsHandler=app.slice(app.indexOf('function bindClassStatistics(){'),app.indexOf('const visibleCategories='));
const studentView=app.slice(app.indexOf('function renderStudentView(){'),app.indexOf('const FINAL_RULE_LABELS='));

test('v1.14: estadísticas se abren SOLO mediante clic o toque en ⓘ',()=>{
  assert.match(statsHandler,/listen\(trigger,'click'/);
  assert.doesNotMatch(statsHandler,/listen\([^,]+,'(?:pointerenter|mouseenter|mouseover|focus)'/);
  assert.doesNotMatch(statsHandler,/\.onpointerenter\s*=/);
  assert.equal((statsHandler.match(/show\(trigger/g)||[]).length,2);
  assert.match(statsHandler,/if\(active===trigger\)hide\(\);else show\(trigger\)/);
  assert.match(statsHandler,/listen\(document,'pointerdown',onOutside\)/);
  assert.match(statsHandler,/e\.key==='Escape'/);
  assert.match(statsHandler,/aria-expanded/);
  assert.match(statsHandler,/aria-controls/);
  assert.match(statsHandler,/un[bB]indClassStats=/);
});

test('v1.14: lista docente muestra solo alumnos del grupo activo y permite seleccionarlos',()=>{
  assert.match(studentView,/const students=allStudents\(\)/);
  assert.match(studentView,/data-open-student/);
  assert.match(studentView,/student-directory-grid/);
  assert.match(studentView,/Selecciona un alumno/);
  assert.match(studentView,/allStudents\(\)\.some\(student=>student\.id===id\)/);
  assert.match(studentView,/STATE\.studentId=id;render\(\)/);
});

test('v1.14: ficha individual dispone de siguiente/anterior sin mostrar otros nombres',()=>{
  assert.match(studentView,/id="previous-student"/);
  assert.match(studentView,/id="next-student"/);
  assert.match(studentView,/id="hide-student">Volver al listado/);
  assert.match(studentView,/STATE\.studentId=null;render\(\)/);
  assert.match(studentView,/students\[index\+offset\]/);
  assert.match(studentView,/const previous=students\[position-1\],next=students\[position\+1\]/);
  assert.match(studentView,/allStudents\(\)\.some\(student=>student\.id===id\)/);
  assert.match(css,/\.student-focus \.toolbar,\.student-focus \.tabs,\.student-focus \.headrow\{display:none\}/);
});

test('v1.14: ficha reutiliza las reglas originales de cálculo y conserva NP/ortografía/rúbrica',()=>{
  for(const signature of ['overallGrade(', 'categoryGrade(', 'finalGrade(', 'effectiveAssessmentScore(', 'orthographyPenalty(', 'grade.notSubmitted?', 'rubricId', 'normalizedScore(']){
    assert(studentView.includes(signature), signature);
  }
  assert.match(studentView,/NP · No presentado/);
});

test('v1.14: navegación del modo alumno es estrictamente visual',()=>{
  assert.doesNotMatch(studentView,/\bcommit\(/);
  assert.doesNotMatch(studentView,/\bpersist\(/);
  assert.doesNotMatch(statsHandler,/\bcommit\(/);
  assert.doesNotMatch(statsHandler,/\bpersist\(/);
});

test('v1.14: estadística y ficha respetan NP = 0 y vacía = sin calificar sin mutación',()=>{
  const doc=initialNotebook();
  const group=doc.groups[0],period=doc.periods[0],category=doc.categories[0];
  const student0=doc.students.find(s=>s.groupId===group.id);
  const another=addStudent(doc,group.id,'Alumno adicional');
  const act=addAssessment(doc,{groupId:group.id,periodId:period.id,categoryId:category.id,name:'Prueba con NP',maxScore:10,convertToTen:true});
  setNotSubmitted(doc,student0.id,act.id,true);
  setGrade(doc,another.id,act.id,8);
  const before=structuredClone(doc);
  const stats=assessmentClassStatistics(doc,group.id,act.id);
  assert.equal(stats.graded,2);
  assert.equal(stats.passed,1);
  assert.equal(stats.mean,4);
  const all=periodClassStatistics(doc,group.id,period.id);
  assert(all);
  assert.equal(typeof categoryGrade(doc,student0.id,category.id,group.id,period.id),'number');
  assert.equal(typeof overallGrade(doc,student0.id,group.id,period.id),'number');
  finalGrade(doc,student0.id,group.id);
  assert.deepEqual(doc,before);
  assertModel(doc);
});
