import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {initialNotebook,addGroup,addStudent,assertModel} from '../src/model.js';
import {saveEvaluationSession,activeYear} from '../src/planner.js';
import {saveTutorship,consolidateTutorshipEvaluation,tutorshipLegacyEvents,tutorshipEvent} from '../src/evaluation-groups.js';
import {sessionPresentation} from '../src/evaluation-session-presentation.js';
import {renderPlanner} from '../src/planner-ui.js';
import {renderEvaluationWorkspace} from '../src/evaluation-workspace.js';

const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function fixture(){
 const doc=initialNotebook({empty:true});
 const latin=addGroup(doc,'1.º BACH','Latín I','2026-2027','1bach');
 const greek=addGroup(doc,'1ºBACH','Griego I','2026-2027','1bach');
 const a=addStudent(doc,latin.id,{name:'Alba',originGroup:'1.º BACH A'});
 const b=addStudent(doc,greek.id,{name:'Beatriz',originGroup:'A'});
 const c=addStudent(doc,latin.id,{name:'Carlos',originGroup:'B'});
 const d=addStudent(doc,greek.id,{name:'Daniel',originGroup:'1.º BACH B'});
 return {doc,latin,greek,period:doc.periods[0],y:activeYear(doc),a,b,c,d};
}
test('dos asignaturas con procedencias equivalentes producen solo una propuesta por tutoría A y B',()=>{
 const f=fixture(),cards=sessionPresentation(f.doc,f.y);
 assert.equal(cards.length,2);
 assert(cards.every(x=>x.kind==='suggested'));
 assert.deepEqual(cards.map(c=>c.sources.length),[2,2]);
 assert(cards.some(c=>c.name.endsWith(' A')));
 assert(cards.some(c=>c.name.endsWith(' B')));
 assert.equal(f.doc.tutorships?.length||0,0,'Las sugerencias nunca vinculan por sí solas');
 assertModel(f.doc);
});
test('las sesiones se agrupan por evaluación con tarjetas pequeñas y acciones directas',()=>{
 const f=fixture(),html=renderEvaluationWorkspace(f.doc,{evaluationWorkspaceTab:'sesiones'});
 assert.equal(html.split('id="plan-evaluations"').length-1,1);
 assert(!html.includes('id="plan-tutorship-sessions"'));
 assert(html.includes('data-eval-switch-tab="tutorias"'));
 assert(renderEvaluationWorkspace(f.doc,{evaluationWorkspaceTab:'tutorias'}).includes('data-eval-confirm-session'));
 assert(html.includes('eval-period-section'));
 assert(html.includes('eval-period-small-card'));
 assert(html.includes('data-eval-origin="A"'));
 assert(html.includes('data-eval-origin="1.º BACH A"'));
 const src=readFileSync(path.join(base,'src/planner-ui.js'),'utf8');
 assert(!src.includes('function evaluationOverview('),'El antiguo listado independiente debe desaparecer');
 assert(src.includes('ctx.openEvaluations()'));
 assertModel(f.doc);
});
test('se muestran dos convocatorias de Latín y Griego, sin modificarlas ni elegir una automáticamente',()=>{
 const f=fixture();
 const a=saveEvaluationSession(f.doc,{groupId:f.latin.id,originGroup:'1.º BACH A',periodId:f.period.id,date:'2026-12-18',time:'15:30',notes:'Latín'});
 const b=saveEvaluationSession(f.doc,{groupId:f.greek.id,originGroup:'A',periodId:f.period.id,date:'2026-12-19',time:'16:00',notes:'Griego'});
 const before=structuredClone(f.doc),html=renderEvaluationWorkspace(f.doc,{evaluationWorkspaceTab:'sesiones'});
 assert(html.includes('2026-12-18 · 15:30'));
 assert(html.includes('2026-12-19 · 16:00'));
 assert(!html.includes('Convocatoria oficial'),'No debe elegirse una cita automáticamente');
 assert(html.includes('data-export-event="'+a.id+'"'));
 assert(html.includes('data-export-event="'+b.id+'"'));
 assert.deepEqual(f.doc,before);
 assertModel(f.doc);
});
test('al confirmar tutoría se consolida el panel pero no la agenda ni los datos originales',()=>{
 const f=fixture();
 saveEvaluationSession(f.doc,{groupId:f.latin.id,originGroup:'1.º BACH A',periodId:f.period.id,date:'2026-12-18',time:'15:30',notes:'Aula latín'});
 saveEvaluationSession(f.doc,{groupId:f.greek.id,originGroup:'A',periodId:f.period.id,date:'2026-12-19',time:'16:00',notes:'Aula griego'});
 const candidate=sessionPresentation(f.doc,f.y).find(c=>c.name.endsWith(' A'));
 const grades=structuredClone(f.doc.grades),events=structuredClone(f.y.events);
 const t=saveTutorship(f.doc,{name:candidate.name,sources:candidate.sources.map(x=>({groupId:x.groupId,originGroup:x.originGroup}))});
 assert.deepEqual(f.y.events,events);
 assert.deepEqual(f.doc.grades,grades);
 const cards=sessionPresentation(f.doc,f.y);
 assert.equal(cards.filter(c=>c.kind==='confirmed').length,1);
 assert.equal(cards.filter(c=>c.kind==='suggested').length,1);
 const html=renderEvaluationWorkspace(f.doc,{evaluationWorkspaceTab:'sesiones'});
 assert(html.includes('data-eval-consolidate="'+t.id+'"'));
 assert(!html.includes('data-eval-confirm-session="'+candidate.id+'"'));
 assert.equal(tutorshipLegacyEvents(f.doc,t.id,f.period.id).length,2);
 assertModel(f.doc);
});
test('la conciliación explícita conserva los dos eventos en el historial cifrado',()=>{
 const f=fixture();
 const la=saveEvaluationSession(f.doc,{groupId:f.latin.id,originGroup:'1.º BACH A',periodId:f.period.id,date:'2026-12-18',time:'15:30',notes:'Latín'});
 const gr=saveEvaluationSession(f.doc,{groupId:f.greek.id,originGroup:'A',periodId:f.period.id,date:'2026-12-19',time:'16:00',notes:'Griego'});
 const candidate=sessionPresentation(f.doc,f.y).find(c=>c.name.endsWith(' A'));
 const t=saveTutorship(f.doc,{name:candidate.name,sources:candidate.sources.map(s=>({groupId:s.groupId,originGroup:s.originGroup}))});
 consolidateTutorshipEvaluation(f.doc,{tutorshipId:t.id,periodId:f.period.id,chosenEventId:gr.id});
 assert.equal(tutorshipEvent(f.doc,t.id,f.period.id).date,'2026-12-19');
 assert.equal(f.doc.evaluationArchive.length,2);
 assert.deepEqual(f.doc.evaluationArchive.map(a=>a.event.id).sort(),[la.id,gr.id].sort());
 assertModel(f.doc);
});
test('nunca se sugieren mezclas de tutorías A y B ni grupos distintos de la misma asignatura',()=>{
 const f=fixture();
 const extra=addGroup(f.doc,'1.º BACH','Latín I','2026-2027','1bach');
 addStudent(f.doc,extra.id,{name:'Elena',originGroup:'A'});
 const cards=sessionPresentation(f.doc,f.y);
 assert(!cards.some(c=>c.kind==='suggested'&&c.sources.some(s=>s.groupId===extra.id)));
 assert(cards.some(c=>c.kind==='single'&&c.sources.some(s=>s.groupId===extra.id)));
 assertModel(f.doc);
});
test('una asignatura sin alumnado o fechas no se identifica automáticamente como la misma tutoría',()=>{
 const f=fixture();
 f.doc.students=f.doc.students.filter(s=>s.groupId!==f.greek.id);
 const cards=sessionPresentation(f.doc,f.y);
 assert(!cards.some(c=>c.kind==='suggested'));
 assertModel(f.doc);
});
test('el HTML escapa nombres de grupos no confiables y conserva accesibilidad del acordeón',()=>{
 const f=fixture();f.latin.name='<script>alert(1)</script>';
 const html=renderEvaluationWorkspace(f.doc,{evaluationWorkspaceTab:'sesiones'});
 assert(!html.includes('<script>alert(1)</script>'));
 assert(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
 assert(html.includes('<details')&&html.includes('<summary'));
});
test('cache PWA renovada y módulo agrupador incluido para modo offline',()=>{
 const app=readFileSync(path.join(base,'app.js'),'utf8');
 const sw=readFileSync(path.join(base,'sw.js'),'utf8');
 assert(app.includes('cuaderno-docente-static-v157-dev'));
 assert(sw.includes('cuaderno-docente-static-v157-dev'));
 assert(sw.includes("'./src/evaluation-session-presentation.js'"));
});
