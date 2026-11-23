import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {initialNotebook,addGroup,addStudent,assertModel} from '../src/model.js';
import {activeYear,addAcademicYear,setActiveYear,saveEvaluationSession} from '../src/planner.js';
import {saveTutorship,saveTutorshipEvaluation} from '../src/evaluation-groups.js';
import {notebookEvaluationDates,renderNotebookEvaluationNotice} from '../src/notebook-evaluation-notice.js';

function fixture(){
 const doc=initialNotebook({empty:true});
 const latin=addGroup(doc,'1.º BACH','Latín I','2026-2027','1bach');
 const greek=addGroup(doc,'1.º BACH','Griego I','2026-2027','1bach');
 addStudent(doc,latin.id,{name:'Alba',originGroup:'A'});
 addStudent(doc,greek.id,{name:'Beatriz',originGroup:'A'});
 return {doc,latin,greek,periods:[...doc.periods].sort((a,b)=>a.order-b.order),year:activeYear(doc)};
}
const render=(f,group=f.latin,period=f.periods[0])=>
 renderNotebookEvaluationNotice(f.doc,group.id,period.id);
const tutor=f=>saveTutorship(f.doc,{name:'1.º BACH A',sources:[
 {groupId:f.latin.id,originGroup:'A'}, {groupId:f.greek.id,originGroup:'A'}]});

test('la fecha y horas de una convocatoria común aparecen en ambos cursos de materia',()=>{
 const f=fixture(),t=tutor(f);
 saveTutorshipEvaluation(f.doc,{tutorshipId:t.id,periodId:f.periods[0].id,
  date:'2026-12-18',time:'15:30',endTime:'17:15'});
 const original=structuredClone(f.doc);
 for(const group of [f.latin,f.greek]){
  const html=render(f,group);
  assert(html.includes('Sesión de 1.ª evaluación:'));
  assert(html.includes('18/12/2026 · 15:30–17:15'));
  assert(html.includes('data-notebook-evaluation-open="'+f.periods[0].id+'"'));
  assert(html.includes('data-notebook-evaluation-year="'+f.year.id+'"'));
  assert(html.includes('notebook-eval-open'));
 }
 assert.deepEqual(f.doc,original);
 assertModel(f.doc);
});

test('al cambiar la evaluación se actualizan las fechas sin mostrar una de otro trimestre',()=>{
 const f=fixture(),t=tutor(f);
 saveTutorshipEvaluation(f.doc,{tutorshipId:t.id,periodId:f.periods[0].id,
  date:'2026-12-18',time:'15:30',endTime:'16:30'});
 saveTutorshipEvaluation(f.doc,{tutorshipId:t.id,periodId:f.periods[1].id,
  date:'2027-03-12',time:'16:15'});
 const first=render(f),second=render(f,f.latin,f.periods[1]),third=render(f,f.latin,f.periods[2]);
 assert(first.includes('18/12/2026 · 15:30–16:30'));
 assert(!first.includes('12/03/2027'));
 assert(second.includes('12/03/2027 · 16:15'));
 assert(!second.includes('18/12/2026'));
 assert(third.includes('Sin programar'));
 assert(!third.includes('15:30'));
 assertModel(f.doc);
});

test('las procedencias A y B conservan fechas distintas y etiquetas visibles',()=>{
 const f=fixture();addStudent(f.doc,f.latin.id,{name:'Carlos',originGroup:'B'});
 saveEvaluationSession(f.doc,{groupId:f.latin.id,originGroup:'A',
  periodId:f.periods[0].id,date:'2026-12-18',time:'15:30'});
 saveEvaluationSession(f.doc,{groupId:f.latin.id,originGroup:'B',
  periodId:f.periods[0].id,date:'2026-12-20',time:'16:00',endTime:'17:00'});
 const html=render(f);
 assert(html.includes('18/12/2026 · 15:30'));
 assert(html.includes('20/12/2026 · 16:00–17:00'));
 assert(html.includes('· A:'));
 assert(html.includes('· B:'));
 assert.equal((html.match(/class="notebook-eval-entry"/g)||[]).length,2);
 assertModel(f.doc);
});

test('una propuesta no confirmada utiliza exclusivamente las citas de la asignatura elegida',()=>{
 const f=fixture();
 saveEvaluationSession(f.doc,{groupId:f.latin.id,originGroup:'A',periodId:f.periods[0].id,
  date:'2026-12-18',time:'15:30'});
 saveEvaluationSession(f.doc,{groupId:f.greek.id,originGroup:'A',periodId:f.periods[0].id,
  date:'2026-12-19',time:'16:30'});
 const latin=render(f,f.latin),greek=render(f,f.greek);
 assert(latin.includes('18/12/2026 · 15:30'));
 assert(!latin.includes('19/12/2026'));
 assert(greek.includes('19/12/2026 · 16:30'));
 assert(!greek.includes('18/12/2026'));
 assert(latin.includes('Tutoría pendiente de confirmar'));
 assert(greek.includes('Tutoría pendiente de confirmar'));
 assert.equal(f.doc.tutorships.length,0);
 assertModel(f.doc);
});

test('las citas anteriores de una tutoría confirmada permanecen diferenciadas hasta unificarlas',()=>{
 const f=fixture();
 saveEvaluationSession(f.doc,{groupId:f.latin.id,originGroup:'A',periodId:f.periods[0].id,
  date:'2026-12-18',time:'15:30'});
 saveEvaluationSession(f.doc,{groupId:f.greek.id,originGroup:'A',periodId:f.periods[0].id,
  date:'2026-12-19',time:'16:30'});
 tutor(f);
 const before=structuredClone(f.doc),html=render(f);
 assert(html.includes('Por unificar:'));
 assert(html.includes('Latín I · 18/12/2026 · 15:30'));
 assert(html.includes('Griego I · 19/12/2026 · 16:30'));
 assert(!html.includes('Sin programar'));
 assert.deepEqual(f.doc,before);
 assertModel(f.doc);
});

test('si hay convocatoria común y otra anterior, se indica que está pendiente de revisar',()=>{
 const f=fixture(),t=tutor(f);
 saveTutorshipEvaluation(f.doc,{tutorshipId:t.id,periodId:f.periods[0].id,
  date:'2026-12-20',time:'17:00',endTime:'18:30'});
 saveEvaluationSession(f.doc,{groupId:f.latin.id,originGroup:'A',
  periodId:f.periods[0].id,date:'2026-12-18',time:'15:30'});
 const html=render(f);
 assert(html.includes('20/12/2026 · 17:00–18:30'));
 assert(html.includes('Citas anteriores por unificar'));
 assert(!html.includes('Por unificar:'));
 assertModel(f.doc);
});

test('el calendario activo de otro año no cambia la información del curso seleccionado',()=>{
 const f=fixture(),t=tutor(f);
 saveTutorshipEvaluation(f.doc,{tutorshipId:t.id,periodId:f.periods[0].id,
  date:'2026-12-18',time:'15:30'});
 const other=addAcademicYear(f.doc,{name:'2027-2028',start:'2027-09-01',end:'2028-06-30'});
 setActiveYear(f.doc,other.id);
 const original=structuredClone(f.doc),html=render(f);
 assert(html.includes('18/12/2026 · 15:30'));
 assert(html.includes('data-notebook-evaluation-year="'+f.year.id+'"'));
 assert(!html.includes('data-notebook-evaluation-year="'+other.id+'"'));
 assert.deepEqual(f.doc,original);
 assertModel(f.doc);
});

test('sin Agenda del curso se muestra aviso neutral, no una cita de otro año',()=>{
 const f=fixture(),group=addGroup(f.doc,'1.º BACH','Latín I','2028-2029','1bach');
 const html=render(f,group);
 assert(html.includes('Curso sin Agenda configurada'));
 assert(!html.includes('data-notebook-evaluation-open='));
});

test('los nombres de grupo y tutoría son escapados al mostrarse como texto',()=>{
 const f=fixture();
 addStudent(f.doc,f.latin.id,{name:'Carlos',originGroup:'B'});
 f.latin.name='<em>Grupo</em>';
 f.greek.name='<em>Grupo</em>';
 const html=render(f);
 assert(!html.includes('<em>Grupo</em>'));
 assert(html.includes('&lt;em&gt;Grupo&lt;/em&gt;'));
});

test('la nota solo se dibuja al entrar al Cuaderno, no en Evaluación final',()=>{
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const start=app.indexOf('function renderPeriodButtons(){'),end=app.indexOf('function render(){',start);
 assert(start>=0&&end>start);
 const script=app.slice(start,end)+';renderPeriodButtons';
 const f=fixture(),pid=f.periods[0].id,calls=[];
 const base={doc:f.doc,groupId:f.latin.id,periodId:pid,tab:'cuaderno'};
 const make=tab=>runInNewContext(script,{STATE:{...base,tab},esc:String,
  renderNotebookEvaluationNotice:(doc,groupId,p)=>{calls.push({doc,groupId,p});return '<aside class="notebook-eval-notice">Cita</aside>';}})();
 assert(make('cuaderno').includes('class="notebook-eval-notice"'));
 assert(!make('final').includes('class="notebook-eval-notice"'));
 assert.equal(calls.length,1);
 assert.equal(calls[0].groupId,f.latin.id);
 assert.equal(calls[0].p,pid);
 assert(app.includes('data-notebook-evaluation-open'));
 assert(app.includes("STATE.evaluationWorkspaceTab='sesiones'"));
 assert(app.includes('setActiveYear(d,year.id)'));
});

test('el aviso se precarga para funcionamiento offline y no altera el documento',()=>{
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
 assert(sw.includes("'./src/notebook-evaluation-notice.js'"));
 assert(sw.includes('cuaderno-docente-static-v170-dev'));
 assert(css.includes('.notebook-eval-notice'));
 assert(css.includes('.notebook-eval-open:focus-visible'));
 assert(css.includes('html[data-theme="oled"] .notebook-eval-open'));
 const f=fixture(),before=structuredClone(f.doc);
 notebookEvaluationDates(f.doc,f.latin.id,f.periods[0].id);render(f);
 assert.deepEqual(f.doc,before);
 assertModel(f.doc);
});
