import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {initialNotebook,addGroup,addStudent,addAssessment,setGrade,assertModel} from '../src/model.js';
import {activeYear,saveEvaluationSession,addAcademicYear,saveEvent} from '../src/planner.js';
import {saveTutorship,saveTutorshipEvaluation,linkStudentRecords} from '../src/evaluation-groups.js';
import {renderPlanner} from '../src/planner-ui.js';
import {renderEvaluationWorkspace} from '../src/evaluation-workspace.js';

const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=path=>readFileSync(pathJoin(path),'utf8');
const pathJoin=p=>path.join(base,p);
function fixture(){
 const doc=initialNotebook({empty:true});
 const latin=addGroup(doc,'1.º BACH','Latín I','2026-2027','1bach');
 const greek=addGroup(doc,'1.º BACH','Griego I','2026-2027','1bach');
 const l=addStudent(doc,latin.id,{firstName:'María',lastName:'García',originGroup:'A'});
 const g=addStudent(doc,greek.id,{firstName:'María',lastName:'García',originGroup:'A'});
 return {doc,latin,greek,l,g,period:doc.periods[0],year:activeYear(doc)};
}
test('separación real: Agenda muestra un acceso pero no formularios de configuración duplicados',()=>{
 const f=fixture(),html=renderPlanner(f.doc,{plannerMode:'week',plannerDate:'2026-12-18'});
 assert(html.includes('id="plan-show-evaluations"'));
 assert(html.includes('id="planner-create-menu"'));
 assert(!html.includes('id="plan-evaluation-shortcut"'),'La Agenda no duplica el panel de Evaluaciones');
 assert(!html.includes('id="plan-evaluations"'));
 assert(!html.includes('id="plan-shared-management"'));
 assert(!html.includes('data-eval-confirm-session='));
 assert(!html.includes('data-eval-tutor-session='));
 assertModel(f.doc);
});
test('el nuevo módulo tiene tres pestañas, selector de curso y resumen de pendientes',()=>{
 const f=fixture(),html=renderEvaluationWorkspace(f.doc,{evaluationWorkspaceTab:'sesiones'});
 assert(html.includes('id="eval-workspace-year"'));
 assert(html.includes('data-eval-workspace-tab="sesiones"'));
 assert(html.includes('data-eval-workspace-tab="tutorias"'));
 assert(html.includes('data-eval-workspace-tab="notas"'));
 assert(html.includes('Coincidencias por revisar'));
 assert(html.includes('id="plan-evaluations"'));
 assert(html.includes('data-eval-switch-tab="tutorias"'));
 assert(!html.includes('data-eval-confirm-session='));
});
test('la identificación semiautomática y la gestión manual residen en Tutorías',()=>{
 const f=fixture(),html=renderEvaluationWorkspace(f.doc,{evaluationWorkspaceTab:'tutorias'});
 assert(html.includes('data-eval-confirm-session='));
 assert(html.includes('id="plan-manual-tutorship"'));
 assert(html.includes('id="eval-link-students"'));
 assert(html.includes('Gestionar tutorías y vínculos de alumnos'));
 assert(!html.includes('id="plan-evaluations"'));
});
test('el visor conjunto muestra una persona y notas separadas por materia, sin modificar los cálculos',()=>{
 const f=fixture();
 const a=addAssessment(f.doc,{name:'Examen Latín',groupId:f.latin.id,periodId:f.period.id,
  categoryId:f.doc.categories[0].id,maxScore:10,weight:1,convertToTen:true});
 const b=addAssessment(f.doc,{name:'Examen Griego',groupId:f.greek.id,periodId:f.period.id,
  categoryId:f.doc.categories[0].id,maxScore:10,weight:1,convertToTen:true});
 setGrade(f.doc,f.l.id,a.id,'8.25');setGrade(f.doc,f.g.id,b.id,'6.75');
 linkStudentRecords(f.doc,[f.l.id,f.g.id]);
 const tutor=saveTutorship(f.doc,{name:'1.º BACH A',sources:[
  {groupId:f.latin.id,originGroup:'A'},{groupId:f.greek.id,originGroup:'A'}]});
 const original=structuredClone(f.doc);
 const html=renderEvaluationWorkspace(f.doc,{evaluationWorkspaceTab:'notas'});
 assert(html.includes('id="eval-view-tutor"'));
 assert(html.includes('id="eval-view-period"'));
 assert(html.includes('eval-combined-table'));
 assert(html.includes('Ítaca'));
 assert(html.includes('Latín I')&&html.includes('Griego I'));
 assert(html.includes(tutor.name));
 assert(!html.includes('data-assessment='));
 assert.deepEqual(f.doc,original);
 assertModel(f.doc);
});
test('sin tutorías confirmadas, las notas muestran ayuda y no crean identidades ficticias',()=>{
 const f=fixture(),before=structuredClone(f.doc);
 const html=renderEvaluationWorkspace(f.doc,{evaluationWorkspaceTab:'notas'});
 assert(html.includes('Aún no hay tutorías confirmadas'));
 assert(html.includes('data-eval-workspace-tab="tutorias"'));
 assert(!html.includes('eval-combined-table'));
 assert.deepEqual(f.doc,before);
});
test('convocatorias antiguas y del calendario no se pierden al cambiar solo de vista',()=>{
 const f=fixture(),event=saveEvaluationSession(f.doc,{
  groupId:f.latin.id,originGroup:'A',periodId:f.period.id,date:'2026-12-18',time:'15:30',endTime:'16:45'
 });
 const other=saveEvent(f.doc,{type:'meeting',title:'Claustro',date:'2026-12-17',time:'17:00'});
 const before=structuredClone(f.doc);
 renderPlanner(f.doc,{plannerMode:'week',plannerDate:'2026-12-14'});
 const html=renderEvaluationWorkspace(f.doc,{evaluationWorkspaceTab:'sesiones'});
 assert(html.includes('15:30–16:45'));
 assert(html.includes('data-export-event="'+event.id+'"'));
 assert(f.year.events.some(e=>e.id===other.id));
 assert.deepEqual(f.doc,before);
});
test('edición de tutorías confirma sin borrar convocatorias antiguas y conserva año académico',()=>{
 const f=fixture();
 const legacy=saveEvaluationSession(f.doc,{groupId:f.latin.id,originGroup:'A',
  periodId:f.period.id,date:'2026-12-18',time:'15:30'});
 const t=saveTutorship(f.doc,{name:'1.º BACH A',sources:[{groupId:f.latin.id,originGroup:'A'},
  {groupId:f.greek.id,originGroup:'A'}]});
 const html=renderEvaluationWorkspace(f.doc,{evaluationWorkspaceTab:'sesiones'});
 assert(html.includes('data-eval-consolidate="'+t.id+'"'));
 assert(f.year.events.some(e=>e.id===legacy.id));
 assertModel(f.doc);
});
test('el módulo es independiente de la materia seleccionada y admite cursos adicionales',()=>{
 const f=fixture();
 const second=addAcademicYear(f.doc,{name:'2027-2028',start:'2027-09-01',end:'2028-06-30',copyFrom:f.year.id});
 const html=renderEvaluationWorkspace(f.doc,{evaluationWorkspaceTab:'sesiones'});
 assert(html.includes('value="'+second.id+'"'));
 assert(html.includes('2026-2027'));
 assert(html.includes('2027-2028'));
 const app=read('app.js');
 assert(app.includes("['evaluaciones','Evaluaciones'"));
 assert(app.includes("STATE.tab==='evaluaciones'?renderEvaluationWorkspace"));
 assert(app.includes("STATE.tab==='evaluaciones')bindEvaluationWorkspace"));
});
test('módulo incluido en la PWA offline y formulario adaptado al móvil',()=>{
 const app=read('app.js'),sw=read('sw.js'),css=read('styles.css');
 assert(app.includes('cuaderno-docente-static-v161-dev'));
 assert(sw.includes('cuaderno-docente-static-v161-dev'));
 assert(sw.includes("'./src/evaluation-workspace.js'"));
 assert(css.includes('dialog.evaluation-session-dialog'));
 assert(css.includes('@media(max-width:720px)'));
});
