import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initialNotebook,addGroup,addStudent,assertModel} from '../src/model.js';
import {activeYear,saveEvaluationSession} from '../src/planner.js';
import {saveTutorship,saveTutorshipEvaluation} from '../src/evaluation-groups.js';
import {renderEvaluationPeriodBoard,bindEvaluationCardMenus} from '../src/evaluation-period-board.js';
import {renderEvaluationWorkspace} from '../src/evaluation-workspace.js';

function fixture(){
 const doc=initialNotebook({empty:true});
 const latin=addGroup(doc,'1.º BACH','Latín I','2026-2027','1bach');
 const greek=addGroup(doc,'1.º BACH','Griego I','2026-2027','1bach');
 addStudent(doc,latin.id,{name:'Alba',originGroup:'A'});
 addStudent(doc,greek.id,{name:'Beatriz',originGroup:'A'});
 return {doc,latin,greek,year:activeYear(doc),period:doc.periods[0]};
}
function confirmTutor(f){
 return saveTutorship(f.doc,{name:'1.º BACH A',sources:[
  {groupId:f.latin.id,originGroup:'A'},
  {groupId:f.greek.id,originGroup:'A'}
 ]});
}
const cards=f=>renderEvaluationPeriodBoard(f.doc,f.year);
const stateAttr=state=>'data-eval-card-state="'+state+'"';

test('A: una tutoría programada mantiene Editar visible y oculta Calendario y Ver notas bajo ···',()=>{
 const f=fixture(),t=confirmTutor(f);
 const appointment=saveTutorshipEvaluation(f.doc,{tutorshipId:t.id,periodId:f.period.id,
  date:'2026-12-18',time:'15:30',endTime:'17:15'});
 const before=structuredClone(f.doc),html=cards(f);
 const first=html.slice(html.indexOf('data-evaluation-section="'+f.period.id+'"'),
  html.indexOf('</article>')+10);
 assert(first.includes('Editar sesión'));
 assert(first.includes('data-eval-tutor-session="'+t.id+'"'));
 assert(first.includes('15:30–17:15'));
 assert(first.includes('<details class="eval-period-more"'));
 assert(first.includes('<summary aria-label="Más acciones de 1.º BACH A"'));
 const menu=first.slice(first.indexOf('class="eval-period-more-items"'));
 assert(menu.includes('data-eval-tutor-export="'+appointment.id+'"'));
 assert(menu.includes('data-eval-open-tutor="'+t.id+'"'));
 assert(!first.slice(0,first.indexOf('class="eval-period-more-items"')).includes('data-eval-open-tutor='));
 assert(first.includes(stateAttr('scheduled')));
 assert(first.includes('>Programada</span>'));
 assert.deepEqual(f.doc,before);
 assertModel(f.doc);
});

test('A: una tutoría sin cita conserva Programar visible y mantiene Ver notas en el menú',()=>{
 const f=fixture(),t=confirmTutor(f),html=cards(f);
 assert(html.includes(stateAttr('unscheduled')));
 assert(html.includes('>Sin programar</span>'));
 assert(html.includes('Programar sesión'));
 assert(html.includes('data-eval-open-tutor="'+t.id+'"'));
 assert(!html.includes('data-eval-tutor-export='));
 assert(html.includes('<details class="eval-period-more"'));
 assertModel(f.doc);
});

test('A: una materia individual programada tiene Calendario en el menú; no hay menú sin cita',()=>{
 const f=fixture();
 f.doc.students=f.doc.students.filter(s=>s.groupId===f.latin.id);
 const e=saveEvaluationSession(f.doc,{groupId:f.latin.id,periodId:f.period.id,originGroup:'A',
  date:'2026-12-18',time:'15:30',endTime:'16:00'});
 const html=cards(f);
 assert(html.includes('data-eval-group="'+f.latin.id+'"'));
 assert(html.includes('data-export-event="'+e.id+'"'));
 assert(html.includes('data-eval-more name="eval-card-actions"'));
 assert(html.includes(stateAttr('scheduled')));
 assert(html.includes(stateAttr('unscheduled')));
 assert(!html.includes('data-eval-open-tutor='));
 assertModel(f.doc);
});

test('A/B: coincidencia no confirmada conserva programaciones separadas y muestra pendiente',()=>{
 const f=fixture();
 const l=saveEvaluationSession(f.doc,{groupId:f.latin.id,originGroup:'A',
  periodId:f.period.id,date:'2026-12-18',time:'15:30'});
 const g=saveEvaluationSession(f.doc,{groupId:f.greek.id,originGroup:'A',
  periodId:f.period.id,date:'2026-12-19',time:'16:00'});
 const before=structuredClone(f.doc),html=cards(f);
 assert(html.includes(stateAttr('review')));
 assert(html.includes('>Pendiente de revisar</span>'));
 assert(html.includes('Coincidencia pendiente de confirmar'));
 assert(html.includes('data-eval-group="'+f.latin.id+'"'));
 assert(html.includes('data-eval-group="'+f.greek.id+'"'));
 assert(html.includes('data-export-event="'+l.id+'"'));
 assert(html.includes('data-export-event="'+g.id+'"'));
 assert.equal((html.match(/class="eval-period-more"/g)||[]).length,2*f.doc.periods.length);
 assert.deepEqual(f.doc,before);
 assertModel(f.doc);
});

test('B: convocatorias históricas pendientes siguen visibles y priorizan estado revisar',()=>{
 const f=fixture();
 const legacy=saveEvaluationSession(f.doc,{groupId:f.latin.id,originGroup:'A',
  periodId:f.period.id,date:'2026-12-18',time:'15:30'});
 const t=confirmTutor(f);
 const before=structuredClone(f.doc),html=cards(f);
 assert(html.includes(stateAttr('review')));
 assert(html.includes('>Pendiente de revisar</span>'));
 assert(html.includes('data-eval-consolidate="'+t.id+'"'));
 assert(html.includes('2026-12-18 · 15:30'));
 assert(html.includes('Ver notas'));
 assert(!html.includes('data-eval-tutor-export="'+legacy.id+'"'));
 assert.deepEqual(f.doc,before);
});

test('B: si hay convocatoria común más citas antiguas se conserva alerta y fecha oficial',()=>{
 const f=fixture(),t=confirmTutor(f);
 const official=saveTutorshipEvaluation(f.doc,{tutorshipId:t.id,periodId:f.period.id,
  date:'2026-12-20',time:'17:00'});
 // Dato histórico compatible con una convocatoria común: se mantiene para revisión.
 saveEvaluationSession(f.doc,{groupId:f.latin.id,originGroup:'A',
  periodId:f.period.id,date:'2026-12-18',time:'15:30'});
 const html=cards(f);
 assert(html.includes(stateAttr('review')));
 assert(html.includes('2026-12-20'));
 assert(html.includes('data-eval-tutor-export="'+official.id+'"'));
 assert(html.includes('Hay convocatorias anteriores pendientes de revisar'));
 assertModel(f.doc);
});

test('B: los tres estados tienen estilo discreto también en modo oscuro y OLED',()=>{
 const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
 for(const kind of ['scheduled','unscheduled','review']){
  assert(css.includes('.eval-period-small-card[data-eval-card-state="'+kind+'"] .eval-period-status'));
  for(const theme of ['dark','oled'])
   assert(css.includes('html[data-theme="'+theme+'"] .eval-period-small-card[data-eval-card-state="'+kind+'"] .eval-period-status'));
 }
 assert(css.includes('.eval-period-more>summary:focus-visible'));
 assert(css.includes('.eval-period-more-items>.btn'));
 assert(css.includes('@media print{.eval-period-more{display:none!important}}'));
});

function fakeMenu(){
 const events={},pressed={};
 let focusCount=0;
 const summary={addEventListener(type,cb){events[type]=cb;},
  focus(){focusCount++;}};
 const button={addEventListener(type,cb){pressed[type]=cb;}};
 return {open:false,querySelector(key){assert.equal(key,'summary');return summary;},
  querySelectorAll(key){assert.equal(key,'button');return [button];},
  run(type){events[type]?.();},clickAction(){pressed.click?.();},
  get focusCount(){return focusCount;}};
}
test('A: el menú cierra otros al abrir, se cierra al actuar y admite Escape',()=>{
 const a=fakeMenu(),b=fakeMenu(),events={};
 const root={querySelectorAll(selector){assert.equal(selector,'[data-eval-more]');return [a,b];},
  addEventListener(name,handler){events[name]=handler;}};
 bindEvaluationCardMenus(root);
 a.open=true;b.open=true;
 b.run('click');
 assert.equal(a.open,false);
 assert.equal(b.open,true);
 b.clickAction();
 assert.equal(b.open,false);
 b.open=true;
 let prevented=0,stopped=0;
 events.keydown({key:'Escape',preventDefault(){prevented++;},stopPropagation(){stopped++;}});
 assert.equal(b.open,false);
 assert.equal(b.focusCount,1);
 assert.equal(prevented,1);assert.equal(stopped,1);
 a.open=true;
 events.pointerdown({target:{closest(){return null;}}});
 assert.equal(a.open,false);
});

test('A: pulsar dentro del menú no cierra prematuramente otras acciones',()=>{
 const a=fakeMenu(),events={};
 const root={querySelectorAll(){return [a];},addEventListener(type,cb){events[type]=cb;}};
 bindEvaluationCardMenus(root);
 a.open=true;
 events.pointerdown({target:{closest(){return a;}}});
 assert.equal(a.open,true);
 events.keydown({key:'Tab'});
 assert.equal(a.open,true);
});

test('las tarjetas no cambian cálculos, notas ni calendario al cambiar su presentación',()=>{
 const f=fixture(),t=confirmTutor(f);
 saveTutorshipEvaluation(f.doc,{tutorshipId:t.id,periodId:f.period.id,
  date:'2026-12-18',time:'15:30',endTime:'17:00'});
 const original=structuredClone(f.doc);
 const html=renderEvaluationWorkspace(f.doc,{evaluationWorkspaceTab:'sesiones'});
 assert(html.includes('eval-period-more'));
 assert(html.includes(stateAttr('scheduled')));
 assert.deepEqual(f.doc,original);
 assertModel(f.doc);
});
