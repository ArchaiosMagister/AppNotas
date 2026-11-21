import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initialNotebook,SCHEMA_VERSION,assertModel,migrateNotebook,addGroup,addStudent,addAssessment,setGrade,setOrthographyGrade,setOrthographyDefaults,updateAssessment,copyPeriodAssessments,createRubric,addCompetency,setCompetencyLink} from '../src/model.js';
import {categoryGrade,overallGrade,finalGrade,competencyGrade,effectiveAssessmentScore,orthographyPenalty,categoryEvidence} from '../src/calculations.js';
const close=(a,b)=>assert(Math.abs(a-b)<1e-9,`Esperado ${b}; obtenido ${a}`);
const setup=()=>{
 const d=initialNotebook();const g=addGroup(d,'Grupo de prueba','Latín I','2026-2027','1bach');const s=addStudent(d,g.id,'Ficticio');
 return {d,g,s,p:d.periods[0],cat:d.categories.find(c=>c.name==='Exámenes')};
};
function exam({d,g,p,cat},options={}){
 return addAssessment(d,{name:'Parcial',groupId:g.id,periodId:p.id,categoryId:cat.id,maxScore:10,convertToTen:true,...options});
}
test('v1.5 establece valores editables sin cambiar las notas iniciales',()=>{
 const d=initialNotebook();assert.equal(d.schemaVersion,8);
 assert.deepEqual(d.settings.orthographyDefaults,{enabledForExams:true,penaltyPerFault:0.1,repetitions:30,refundable:true});
 const old=structuredClone(d);old.schemaVersion=5;delete old.settings.orthographyDefaults;
 const grades=structuredClone(old.grades),assessments=structuredClone(old.assessments);
 const migrated=migrateNotebook(old);assert.equal(migrated.migrated,true);
 assert.deepEqual(migrated.doc.grades,grades);assert.deepEqual(migrated.doc.assessments,assessments);assertModel(migrated.doc);
 assert.equal(migrateNotebook(migrated.doc).migrated,false);
});
test('categoría Exámenes activa 0,10 y 30 repeticiones por defecto, no otras categorías',()=>{
 const t=setup(),a=exam(t),c=t.d.categories.find(x=>x.name==='Trabajos');
 assert.deepEqual(a.orthography,{enabled:true,penaltyPerFault:0.1,repetitions:30,refundable:true});
 const other=addAssessment(t.d,{name:'Tarea',groupId:t.g.id,periodId:t.p.id,categoryId:c.id});
 assert.equal(other.orthography,null);assertModel(t.d);
});
test('nota 8,50 y cuatro faltas da 8,10; entregadas devuelve 8,50 y desmarcar 8,10',()=>{
 const t=setup(),a=exam(t);
 setOrthographyGrade(t.d,t.s.id,a.id,{score:'8,50',faults:'4',delivered:false});
 let grade=t.d.grades.find(g=>g.assessmentId===a.id);
 assert.equal(grade.score,8.5);close(orthographyPenalty(a,grade),0.4);close(effectiveAssessmentScore(t.d,a,grade),8.1);
 close(categoryGrade(t.d,t.s.id,t.cat.id,t.g.id,t.p.id),8.1);
 close(overallGrade(t.d,t.s.id,t.g.id,t.p.id),8.1);close(finalGrade(t.d,t.s.id,t.g.id),8.1);
 setOrthographyGrade(t.d,t.s.id,a.id,{score:'8,50',faults:'4',delivered:true});
 grade=t.d.grades.find(g=>g.assessmentId===a.id);
 assert.equal(grade.score,8.5);close(orthographyPenalty(a,grade),0);close(finalGrade(t.d,t.s.id,t.g.id),8.5);
 setOrthographyGrade(t.d,t.s.id,a.id,{score:'8,50',faults:'4',delivered:false});
 close(finalGrade(t.d,t.s.id,t.g.id),8.1);assertModel(t.d);
});
test('descuenta sobre /10 después de convertir desde 0–5, sin alterar el dato base',()=>{
 const t=setup(),a=exam(t,{maxScore:5});
 setOrthographyGrade(t.d,t.s.id,a.id,{score:'4,25',faults:'2',delivered:false});
 const grade=t.d.grades.find(g=>g.assessmentId===a.id);assert.equal(grade.score,4.25);
 close(effectiveAssessmentScore(t.d,a,grade),8.3);close(finalGrade(t.d,t.s.id,t.g.id),8.3);
});
test('mínimo cero; cuarenta faltas por 0,10 no generan nota negativa',()=>{
 const t=setup(),a=exam(t);setOrthographyGrade(t.d,t.s.id,a.id,{score:'2',faults:'40',delivered:false});
 assert.equal(finalGrade(t.d,t.s.id,t.g.id),0);assertModel(t.d);
});
test('cambiar la nota original preserva las faltas y la entrega, salvo al borrar la nota',()=>{
 const t=setup(),a=exam(t);setOrthographyGrade(t.d,t.s.id,a.id,{score:'8',faults:3,delivered:false});
 setGrade(t.d,t.s.id,a.id,'9');
 const g=t.d.grades.find(g=>g.assessmentId===a.id);assert.equal(g.score,9);assert.equal(g.orthographyFaults,3);
 close(finalGrade(t.d,t.s.id,t.g.id),8.7);
 setGrade(t.d,t.s.id,a.id,'');assert(!t.d.grades.some(g=>g.assessmentId===a.id));assertModel(t.d);
});
test('impide valores erróneos y preserva la nota al fallar el editor',()=>{
 const t=setup(),a=exam(t);setOrthographyGrade(t.d,t.s.id,a.id,{score:'7',faults:2,delivered:false});
 const before=JSON.stringify(t.d.grades);
 const bad=[{score:'7,456',faults:2,delivered:false},{score:'7',faults:1.5,delivered:false},{score:'7',faults:-1,delivered:false},{score:'7',faults:1001,delivered:false},{score:'11',faults:2,delivered:false},{score:'7',faults:0,delivered:true}];
 for(const x of bad){assert.throws(()=>setOrthographyGrade(t.d,t.s.id,a.id,x));assert.equal(JSON.stringify(t.d.grades),before);}
 assert.throws(()=>setOrthographyGrade(t.d,t.s.id,a.id,{score:'',faults:1,delivered:false}));assert.equal(JSON.stringify(t.d.grades),before);
 assertModel(t.d);
});
test('la entrega está bloqueada cuando el examen no admite recuperar la nota',()=>{
 const t=setup(),a=exam(t,{orthography:{enabled:true,penaltyPerFault:0.1,repetitions:20,refundable:false}});
 assert.throws(()=>setOrthographyGrade(t.d,t.s.id,a.id,{score:'7',faults:2,delivered:true}),/entrega/i);
 setOrthographyGrade(t.d,t.s.id,a.id,{score:'7',faults:2,delivered:false});close(categoryGrade(t.d,t.s.id,t.cat.id,t.g.id,t.p.id),6.8);assertModel(t.d);
});
test('se permiten valores por examen y ajustes para futuros exámenes sin cambiar los existentes',()=>{
 const t=setup(),one=exam(t);setOrthographyDefaults(t.d,{penaltyPerFault:0.15,repetitions:50,refundable:true,enabledForExams:true});
 const two=exam(t);assert.equal(one.orthography.penaltyPerFault,0.1);assert.equal(two.orthography.penaltyPerFault,0.15);assert.equal(two.orthography.repetitions,50);
 setOrthographyDefaults(t.d,{enabledForExams:false});const three=exam(t);assert.equal(three.orthography,null);
 updateAssessment(t.d,one.id,{orthography:{enabled:true,penaltyPerFault:0.2,repetitions:10,refundable:true}});
 assert.equal(one.orthography.penaltyPerFault,0.2);assertModel(t.d);
});
test('se preservan las reglas al copiar estructura trimestral, pero nunca los datos ni las faltas',()=>{
 const t=setup(),a=exam(t);setOrthographyGrade(t.d,t.s.id,a.id,{score:'6,5',faults:2,delivered:true});
 const next=t.d.periods[1];copyPeriodAssessments(t.d,t.g.id,t.p.id,[next.id]);
 const b=t.d.assessments.find(x=>x.groupId===t.g.id&&x.periodId===next.id);
 assert.notEqual(a.id,b.id);assert.deepEqual(a.orthography,b.orthography);
 assert(!t.d.grades.some(g=>g.assessmentId===b.id));assertModel(t.d);
});
test('recuperaciones y competencias usan la nota efectiva solo una vez',()=>{
 const t=setup(),a=exam(t);setOrthographyGrade(t.d,t.s.id,a.id,{score:'7',faults:5,delivered:false});
 const recovery=addAssessment(t.d,{name:'Recuperación',groupId:t.g.id,periodId:t.p.id,categoryId:t.cat.id,maxScore:10,convertToTen:true,orthography:a.orthography,recoveryOf:a.id,recoveryMode:'higher'});
 setOrthographyGrade(t.d,t.s.id,recovery.id,{score:'8',faults:1,delivered:false});
 const evidence=categoryEvidence(t.d,t.s.id,t.cat.id,t.g.id,t.p.id);
 assert.equal(evidence.evidence.length,1);close(evidence.grade,7.9);
 const c=addCompetency(t.d,'Competencia experimental',t.g.id);setCompetencyLink(t.d,c.id,t.cat.id,1);
 close(competencyGrade(t.d,t.s.id,c.id,t.g.id,t.p.id),7.9);close(finalGrade(t.d,t.s.id,t.g.id),7.9);assertModel(t.d);
});
test('no se puede aplicar la penalización a una rúbrica ni a actividades sin conversión',()=>{
 const t=setup();assert.throws(()=>exam(t,{convertToTen:false,orthography:{enabled:true,penaltyPerFault:0.1,repetitions:30,refundable:true}}),/ortogr[aá]fica/i);
 const r=createRubric(t.d,'Matriz',[{name:'Contenido',maxScore:2,weight:1}]);
 assert.throws(()=>exam(t,{rubricId:r.id,orthography:{enabled:true,penaltyPerFault:0.1,repetitions:30,refundable:true}}),/ortogr[aá]fica/i);
 assertModel(t.d);
});
test('modelo detecta un contador manipulado o entregas incoherentes',()=>{
 const t=setup(),a=exam(t);setOrthographyGrade(t.d,t.s.id,a.id,{score:'8',faults:3,delivered:false});
 const grade=t.d.grades.find(g=>g.assessmentId===a.id);
 grade.orthographyFaults=2.5;assert.throws(()=>assertModel(t.d),/faltas/i);
 grade.orthographyFaults=3;grade.orthographyDelivered=true;assertModel(t.d);
 a.orthography.refundable=false;assert.throws(()=>assertModel(t.d),/entrega/i);
});
test('alumnos de otros grupos mantienen notas y desglose sin contaminación',()=>{
 const t=setup(),a=exam(t);setOrthographyGrade(t.d,t.s.id,a.id,{score:'8',faults:10,delivered:false});
 const first=t.d.groups[0],other=t.d.students.find(x=>x.groupId===first.id);
 assert.notEqual(overallGrade(t.d,t.s.id,t.g.id,t.p.id),overallGrade(t.d,other.id,first.id,t.p.id));
 assert.equal(categoryGrade(t.d,other.id,t.cat.id,first.id,t.p.id),categoryGrade(t.d,other.id,t.cat.id,first.id,t.p.id));
 assertModel(t.d);
});
test('interfaz incluye editor, casilla entregadas y preferencias sin alterar el planificador',()=>{
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');const planner=readFileSync(new URL('../src/planner.js',import.meta.url),'utf8');
 for(const key of ['openOrthographyGrade','data-orthography-grade','id="orth-delivered"','id="orth-default-rate"','id="activity-orth-enabled"','orthographyPenalty'])assert(app.includes(key),key);
 assert(planner.includes('createPlanner'));assert(app.includes('renderPlanner'));
});
test('copia cifrada conserva la nota original, faltas y estado al restaurar',async()=>{
 const {createVault,unlockVault}=await import('../src/vault.js');
 const t=setup(),a=exam(t);setOrthographyGrade(t.d,t.s.id,a.id,{score:'8,50',faults:4,delivered:true});
 const {envelope}=await createVault('contraseña de pruebas robusta 2026',t.d);
 assert(!JSON.stringify(envelope).includes('Ficticio'));
 const restored=(await unlockVault('contraseña de pruebas robusta 2026',envelope)).doc;
 assertModel(restored);assert.equal(restored.grades.find(g=>g.assessmentId===a.id).orthographyFaults,4);
 assert.equal(restored.grades.find(g=>g.assessmentId===a.id).orthographyDelivered,true);
 close(finalGrade(restored,t.s.id,t.g.id),8.5);
});
test('no cambia notas ajenas cuando se desactiva la penalización de un examen',()=>{
 const t=setup(),a=exam(t);setOrthographyGrade(t.d,t.s.id,a.id,{score:'8',faults:4,delivered:false});
 const old=structuredClone(t.d.grades);
 updateAssessment(t.d,a.id,{orthography:{...a.orthography,enabled:false}});
 close(finalGrade(t.d,t.s.id,t.g.id),8);
 assert.deepEqual(t.d.grades,old);
 updateAssessment(t.d,a.id,{orthography:{...a.orthography,enabled:true}});
 close(finalGrade(t.d,t.s.id,t.g.id),7.6);
 assertModel(t.d);
});
