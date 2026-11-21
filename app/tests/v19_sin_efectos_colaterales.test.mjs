import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initialNotebook,addGroup,addStudent,addAssessment,setGrade,setFinalOverride,
  setPeriodCategory,removeCategoryFromGroup,renameStudent,updateGroupInfo,
  renamePeriod,setSubjectAccent,setOrthographyDefaults,setFinalConfig,
  copyPeriodAssessments,assertModel
} from '../src/model.js';
import {overallGrade,finalGrade} from '../src/calculations.js';
import {addAcademicYear,saveTask} from '../src/planner.js';

function fixture(){
 const doc=initialNotebook();const a=doc.groups[0];const b=addGroup(doc,'Griego I grupo B','Griego I','2026-2027','1bach');
 const s=addStudent(doc,b.id,'Alumno independiente');const p=doc.periods[0];
 const exam=addAssessment(doc,{name:'Examen B',groupId:b.id,periodId:p.id,categoryId:doc.categories[0].id,orthography:null});setGrade(doc,s.id,exam.id,8.25);
 setFinalOverride(doc,s.id,p.id,9.2);
 return {doc,a,b,p,s,exam};
}

test('cambios administrativos o de aspecto no modifican ninguna calificación, rúbrica, actividad o sustitución manual',()=>{
 const {doc,a,b,p,s}=fixture();
 const protectedBefore=structuredClone({grades:doc.grades,assessments:doc.assessments,finalOverrides:doc.finalOverrides,rubrics:doc.rubrics,competencies:doc.competencies});
 const originalGrade=overallGrade(doc,doc.students[0].id,a.id,p.id),otherGrade=overallGrade(doc,s.id,b.id,p.id),finalOther=finalGrade(doc,s.id,b.id);
 renameStudent(doc,s.id,'Alumno renombrado');updateGroupInfo(doc,b.id,'Grupo renombrado','2026-2027');renamePeriod(doc,p.id,'Periodo cambiado');
 setSubjectAccent(doc,'1bach','Griego I','#334455');setOrthographyDefaults(doc,{repetitions:45});
 assert.deepEqual({grades:doc.grades,assessments:doc.assessments,finalOverrides:doc.finalOverrides,rubrics:doc.rubrics,competencies:doc.competencies},protectedBefore);
 assert.equal(overallGrade(doc,doc.students[0].id,a.id,p.id),originalGrade);
 assert.equal(overallGrade(doc,s.id,b.id,p.id),otherGrade);
 assert.equal(finalGrade(doc,s.id,b.id),finalOther);
 assertModel(doc);
});

test('ajustes de otras materias o evaluaciones no afectan notas ni ponderaciones del grupo original',()=>{
 const {doc,a,b,p,s}=fixture();
 const initialGrade=overallGrade(doc,doc.students[0].id,a.id,p.id),ownManual=doc.finalOverrides.map(o=>({...o}));
 const aGrades=structuredClone(doc.grades.filter(g=>doc.students.some(s=>s.id===g.studentId&&s.groupId===a.id)));
 setPeriodCategory(doc,b.id,p.id,doc.categories[0].id,{weight:20});
 setPeriodCategory(doc,b.id,p.id,doc.categories[1].id,{weight:70});
 setFinalConfig(doc,b.id,{rule:'weighted_mean',weights:{[p.id]:4}});
 const work=doc.categories.find(c=>c.name==='Trabajos');
 assert.equal(removeCategoryFromGroup(doc,b.id,work.id),'hidden');
 assert.equal(overallGrade(doc,doc.students[0].id,a.id,p.id),initialGrade);
 assert.deepEqual(doc.grades.filter(g=>doc.students.some(s=>s.id===g.studentId&&s.groupId===a.id)),aGrades);
 assert.deepEqual(doc.finalOverrides,ownManual);
 assertModel(doc);
});

test('la copia de actividades a otros periodos no copia ninguna nota ni falta ni cambia las actividades previas',()=>{
 const {doc,a}=fixture();const beforeGrades=structuredClone(doc.grades),beforeFinals=structuredClone(doc.finalOverrides);
 const source=doc.periods[0],target=doc.periods[1];const beforeActs=structuredClone(doc.assessments);
 copyPeriodAssessments(doc,a.id,source.id,[target.id]);
 assert.deepEqual(doc.grades,beforeGrades);assert.deepEqual(doc.finalOverrides,beforeFinals);
 for(const act of beforeActs)assert.deepEqual(doc.assessments.find(a=>a.id===act.id),act);
 const copied=doc.assessments.filter(x=>x.groupId===a.id&&x.periodId===target.id);
 assert(copied.length>0);assert(copied.every(x=>!doc.grades.some(g=>g.assessmentId===x.id)));
 assertModel(doc);
});

test('repetir una nota numérica idéntica o vaciar una celda ya vacía no altera ninguna marca ni dato',()=>{
 const {doc,b,p,s,exam}=fixture();let before=structuredClone(doc);
 setGrade(doc,s.id,exam.id,8.25);
 assert.deepEqual(doc,before);
 setGrade(doc,s.id,exam.id,null);
 before=structuredClone(doc);
 setGrade(doc,s.id,exam.id,null);
 assert.deepEqual(doc,before);
 setFinalOverride(doc,s.id,p.id,9.2);
 assert.deepEqual(doc,before);
 setFinalOverride(doc,s.id,p.id,null);
 before=structuredClone(doc);
 setFinalOverride(doc,s.id,p.id,null);
 assert.deepEqual(doc,before);
 assertModel(doc);
});

test('tareas y cursos académicos no cambian notas de ninguna clase',()=>{
 const {doc,a,b,p,s}=fixture(),before=structuredClone({grades:doc.grades,assessments:doc.assessments,finalOverrides:doc.finalOverrides});
 addAcademicYear(doc,{name:'2027-2028',start:'2027-09-01',end:'2028-06-30'});
 saveTask(doc,{title:'Preparar unidad',dueDate:'2027-11-05',done:false});
 assert.deepEqual({grades:doc.grades,assessments:doc.assessments,finalOverrides:doc.finalOverrides},before);
 assertModel(doc);
});

test('guardado repetido de faltas y rúbricas sin cambios no modifica marcas ni historial',async()=>{
 const {doc,b,p,s}=fixture();
 const {setOrthographyGrade,createRubric,setRubricGrade}=await import('../src/model.js');
 const orth=addAssessment(doc,{name:'Examen faltas',groupId:b.id,periodId:p.id,categoryId:doc.categories[0].id,orthography:{enabled:true,penaltyPerFault:0.1,repetitions:30,refundable:true}});
 setOrthographyGrade(doc,s.id,orth.id,{score:7.5,faults:3,delivered:false});
 let copy=structuredClone(doc);
 await new Promise(resolve=>setTimeout(resolve,20));
 setOrthographyGrade(doc,s.id,orth.id,{score:7.5,faults:3,delivered:false});
 assert.deepEqual(doc,copy);
 const rubric=createRubric(doc,'Rúbrica de prueba',[{name:'Expresión',maxScore:2,weight:1},{name:'Trabajo',maxScore:3,weight:2}]);
 const a=addAssessment(doc,{name:'Trabajo rubricado',groupId:b.id,periodId:p.id,categoryId:doc.categories[1].id,rubricId:rubric.id,orthography:null});
 const data={[rubric.criteria[0].id]:1,[rubric.criteria[1].id]:2};
 setRubricGrade(doc,s.id,a.id,data);
 copy=structuredClone(doc);
 await new Promise(resolve=>setTimeout(resolve,20));
 setRubricGrade(doc,s.id,a.id,data);
 assert.deepEqual(doc,copy);
 assertModel(doc);
});
