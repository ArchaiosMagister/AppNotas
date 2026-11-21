import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initialNotebook,addGroup,addStudent,addAssessment,setGrade,setOrthographyGrade,addCompetency,setCompetencyLink,setPeriodCategory,setFinalOverride,setFinalConfig,createRubric,setRubricGrade,assertModel} from '../src/model.js';
import {overallGrade,categoryGrade,finalGrade} from '../src/calculations.js';
import {summarizeClass,assessmentClassStatistics,periodClassStatistics,finalClassStatistics,categoryClassStatistics,competencyClassStatistics} from '../src/statistics.js';
const near=(value,expected)=>assert(Math.abs(value-expected)<1e-9,`${value} !== ${expected}`);
function fixture(){
 const doc=initialNotebook();const group=addGroup(doc,'Grupo ensayo','Latín I','2026-2027','1bach');
 const students=['Ada','Beto','Ceci'].map(name=>addStudent(doc,group.id,name));
 const period=doc.periods[0];const category=doc.categories.find(c=>c.name==='Exámenes');
 for(const c of doc.categories)setPeriodCategory(doc,group.id,period.id,c.id,{weight:c.id===category.id?100:0});
 return {doc,group,students,period,category};
}
const activity=(t,extra={})=>addAssessment(t.doc,{groupId:t.group.id,periodId:t.period.id,categoryId:t.category.id,name:'Examen ficticio',maxScore:10,convertToTen:true,...extra});
test('falta de notas: no hay medias ni porcentajes inventados',()=>{
 const empty=summarizeClass([null,undefined,NaN]);
 assert.deepEqual([empty.total,empty.graded,empty.passed,empty.mean,empty.percentTotal,empty.percentGraded],[3,0,0,null,0,null]);
 const zero=summarizeClass([]);assert.equal(zero.percentTotal,null);assert.equal(zero.mean,null);
});
test('aprobados sobre total del grupo; pendientes separados y no se consideran suspensos',()=>{
 const s=summarizeClass([8,4,null,0,10]);
 assert.equal(s.total,5);assert.equal(s.graded,4);assert.equal(s.ungraded,1);assert.equal(s.passed,2);assert.equal(s.failed,2);near(s.mean,5.5);near(s.percentTotal,40);near(s.percentGraded,50);
});
test('el umbral de aprobado usa precisión real, sin redondear 4,995 a 5',()=>{
 const s=summarizeClass([4.995,5,5.00001]);assert.equal(s.passed,2);
});
test('media original sobre cinco sin conversión; escala y umbral correctos',()=>{
 const t=fixture(),a=activity(t,{maxScore:5,convertToTen:false});
 setGrade(t.doc,t.students[0].id,a.id,'2.5');setGrade(t.doc,t.students[1].id,a.id,'1.25');
 const s=assessmentClassStatistics(t.doc,t.group.id,a.id);assert.equal(s.maximum,5);near(s.mean,1.875);assert.equal(s.passed,1);near(s.percentTotal,100/3);
});
test('actividad convertida desde 0–5 usa nota sobre diez para estadística',()=>{
 const t=fixture(),a=activity(t,{maxScore:5});setGrade(t.doc,t.students[0].id,a.id,'4.25');setGrade(t.doc,t.students[1].id,a.id,'2.0');
 const s=assessmentClassStatistics(t.doc,t.group.id,a.id);assert.equal(s.maximum,10);near(s.mean,6.25);assert.equal(s.passed,1);
});
test('faltas recuperables: penalización efectiva y casilla Entregadas recalculan estadística',()=>{
 const t=fixture(),a=activity(t,{orthography:{enabled:true,penaltyPerFault:0.1,repetitions:30,refundable:true}});
 setOrthographyGrade(t.doc,t.students[0].id,a.id,{score:'5.1',faults:2,delivered:false});
 let s=assessmentClassStatistics(t.doc,t.group.id,a.id);near(s.mean,4.9);assert.equal(s.passed,0);
 setOrthographyGrade(t.doc,t.students[0].id,a.id,{score:'5.1',faults:2,delivered:true});
 s=assessmentClassStatistics(t.doc,t.group.id,a.id);near(s.mean,5.1);assert.equal(s.passed,1);
});
test('recuperación: medias de columnas respetan lo visible y la final no duplica evidencias',()=>{
 const t=fixture(),a=activity(t);setGrade(t.doc,t.students[0].id,a.id,3);
 const recovery=activity(t,{name:'Recuperación',recoveryOf:a.id,recoveryMode:'higher'});
 setGrade(t.doc,t.students[0].id,recovery.id,7);
 assert.equal(assessmentClassStatistics(t.doc,t.group.id,a.id).mean,3);
 assert.equal(assessmentClassStatistics(t.doc,t.group.id,recovery.id).mean,7);
 assert.equal(periodClassStatistics(t.doc,t.group.id,t.period.id).mean,7);
});
test('las rúbricas forman medias /10 desde la nota calculada, sin guardar estadística',()=>{
 const t=fixture(),rubric=createRubric(t.doc,'Trabajo',[{name:'Criterio único',maxScore:10,weight:1}]);
 const a=activity(t,{rubricId:rubric.id});setRubricGrade(t.doc,t.students[0].id,a.id,{[rubric.criteria[0].id]:7});
 const s=assessmentClassStatistics(t.doc,t.group.id,a.id);assert.equal(s.maximum,10);near(s.mean,7);
});
test('final trimestral y anual distinguen anulaciones, pesos y notas manuales',()=>{
 const t=fixture(),a=activity(t);setGrade(t.doc,t.students[0].id,a.id,'8');setGrade(t.doc,t.students[1].id,a.id,'4');
 const current=periodClassStatistics(t.doc,t.group.id,t.period.id);near(current.mean,6);assert.equal(current.passed,1);
 setFinalOverride(t.doc,t.students[1].id,t.period.id,7);
 const annualPeriod=periodClassStatistics(t.doc,t.group.id,t.period.id,{finalView:true});near(annualPeriod.mean,7.5);assert.equal(annualPeriod.passed,2);
 const annual=finalClassStatistics(t.doc,t.group.id);near(annual.mean,7.5);assert.equal(annual.passed,2);
 setFinalConfig(t.doc,t.group.id,{excludedPeriodIds:[t.period.id]});assert.equal(finalClassStatistics(t.doc,t.group.id).graded,0);
});
test('estadísticas de categorías y competencias siguen las mismas reglas efectivas',()=>{
 const t=fixture(),a=activity(t);setGrade(t.doc,t.students[0].id,a.id,9);setGrade(t.doc,t.students[1].id,a.id,3);
 const comp=addCompetency(t.doc,'CE de prueba',t.group.id);setCompetencyLink(t.doc,comp.id,t.category.id,1);
 const c=categoryClassStatistics(t.doc,t.group.id,t.period.id,t.category.id);
 const ce=competencyClassStatistics(t.doc,t.group.id,t.period.id,comp.id);
 near(c.mean,6);near(ce.mean,6);assert.equal(ce.passed,1);
});
test('aislamiento por grupo, identificadores ajenos y consultas sin mutación',()=>{
 const t=fixture(),a=activity(t);setGrade(t.doc,t.students[0].id,a.id,9);
 const before=JSON.stringify(t.doc);
 assert.equal(assessmentClassStatistics(t.doc,t.doc.groups[0].id,a.id),null);
 assert.equal(periodClassStatistics(t.doc,t.group.id,'desconocido'),null);
 assert.equal(competencyClassStatistics(t.doc,t.group.id,t.period.id,'desconocida').graded,0);
 assert.equal(finalClassStatistics(t.doc,t.group.id).total,3);
 assert.equal(JSON.stringify(t.doc),before);assertModel(t.doc);
});
test('la interfaz docente incluye información por columna, categorías, competencias y ambas finales',()=>{
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 for(const keyword of ["classStatButton('assessment'","classStatButton('period'","classStatButton('annual-period'","classStatButton('course'","classStatButton('competency'","classStatButton('category'",'bindClassStatistics()','pointerdown','data-class-stat','aria-expanded','Las notas vacías no se cuentan'])assert(app.includes(keyword),keyword);
 assert(app.indexOf('function renderStudentView()')<app.indexOf('function renderFinalEvaluation()'));
});
