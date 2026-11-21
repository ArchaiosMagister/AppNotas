import test from 'node:test';
import assert from 'node:assert/strict';
import {initialNotebook,assertModel,addAssessment,addStudent,setGrade,createRubric,duplicateRubric,setRubricGrade,removeAssessment} from '../src/model.js';
import {categoryGrade} from '../src/calculations.js';
import {emptyHistory,recordChange,stepHistory,HISTORY_LIMIT} from '../src/history.js';
import {previewRubric,validateRubricDraft} from '../src/rubric-ui.js';

const fx=()=>{const d=initialNotebook();return {d,s:d.students[0],g:d.groups[0],p:d.periods[0]};};
test('historial conserva el estado anterior y permite deshacer/rehacer',()=>{
 const {d,s}=fx(),before=structuredClone(d),a=d.assessments[0];
 setGrade(d,s.id,a.id,8.5);
 let h=recordChange(emptyHistory(),before,d,'Modificar nota');
 let step=stepHistory(h,d,'undo');assert.deepEqual(step.doc,before);assert.equal(step.label,'Modificar nota');assertModel(step.doc);
 h=step.history; step=stepHistory(h,before,'redo');assert.deepEqual(step.doc,d);assertModel(step.doc);
});
test('cambio nuevo después de deshacer invalida rehacer',()=>{
 const {d}=fx();const h=recordChange(emptyHistory(),d,{...d,updatedAt:'cambio'},'A');
 const undone=stepHistory(h,{...d,updatedAt:'cambio'},'undo');
 const changed=recordChange(undone.history,undone.doc,{...d,updatedAt:'otro'},'B');
 assert.equal(changed.future.length,0);assert.equal(stepHistory(changed,d,'redo'),null);
});
test('las acciones sin cambios no ocupan historial; tope de 30',()=>{
 const {d}=fx();let h=recordChange(emptyHistory(),d,structuredClone(d),'igual');assert.equal(h.past.length,0);
 for(let i=0;i<45;i++)h=recordChange(h,{...d,updatedAt:String(i)},{...d,updatedAt:String(i+1)},'edición');
 assert.equal(h.past.length,HISTORY_LIMIT);
 assert.throws(()=>stepHistory(h,d,'otra'),/Dirección/);
});
test('deshacer restauraría una actividad eliminada y sus notas',()=>{
 const {d,s}=fx(),a=d.assessments[0],before=structuredClone(d),n=d.grades.filter(x=>x.assessmentId===a.id).length;
 removeAssessment(d,a.id);assert.equal(d.grades.filter(x=>x.assessmentId===a.id).length,0);
 const back=stepHistory(recordChange(emptyHistory(),before,d,'Eliminar actividad'),d,'undo').doc;
 assert.equal(back.grades.filter(x=>x.assessmentId===a.id).length,n);assertModel(back);
});
test('previsualización distingue pendiente, cero real y total completado',()=>{
 const rubric={criteria:[{id:'a',name:'Contenido',maxScore:5,weight:2},{id:'b',name:'Presentación',maxScore:4,weight:1}]};
 let p=previewRubric(rubric,{a:'0',b:''});assert.equal(p.completed,1);assert.equal(p.grade,null);assert.equal(p.minimum,0);assert.equal(p.maximum,10/3);
 p=previewRubric(rubric,{a:'4',b:'2'});assert.equal(p.completed,2);assert(Math.abs(p.grade-7)<1e-10);
 assert.throws(()=>previewRubric(rubric,{a:'6',b:2}),/entre/);
});
test('las puntuaciones de la rúbrica con coma decimal se calculan sin redondeo parcial',()=>{
 const rubric={criteria:[{id:'a',name:'Contenido',maxScore:3,weight:2},{id:'b',name:'Estilo',maxScore:2,weight:1}]};
 const p=previewRubric(rubric,{a:'2,4',b:'1'});assert.equal(p.grade,7);
});
test('el editor de rúbricas valida límites, pesos y criterios',()=>{
 assert.deepEqual(validateRubricDraft([{name:' Rigor ',maxScore:'5',weight:'2,5'}]),[{name:'Rigor',maxScore:5,weight:2.5}]);
 assert.throws(()=>validateRubricDraft([{name:'',maxScore:5,weight:1}]),/criterio 1/);
 assert.throws(()=>validateRubricDraft([]),/entre 1 y 40/);
 assert.throws(()=>validateRubricDraft([{name:'R',maxScore:5,weight:0}]),/criterio 1/);
});
test('duplicar rúbrica ya evaluada crea IDs independientes sin modificar sus notas',()=>{
 const {d,s,g,p}=fx();const r=createRubric(d,'Trabajo',[{name:'Contenido',maxScore:5,weight:2}]);
 const a=addAssessment(d,{name:'Ensayo',groupId:g.id,periodId:p.id,categoryId:d.categories[1].id,rubricId:r.id});
 setRubricGrade(d,s.id,a.id,{[r.criteria[0].id]:4});const before=structuredClone(d.grades);
 const copy=duplicateRubric(d,r.id);assert.notEqual(copy.id,r.id);assert.notEqual(copy.criteria[0].id,r.criteria[0].id);assert.deepEqual(d.grades,before);
 assertModel(d);
});
test('historial de notas también restaura cálculos derivados por categoría',()=>{
 const {d,s,g,p}=fx();const cat=d.categories[0];const before=structuredClone(d),a=d.assessments.find(x=>x.categoryId===cat.id);
 const previous=categoryGrade(d,s.id,cat.id,g.id,p.id);setGrade(d,s.id,a.id,0);
 const back=stepHistory(recordChange(emptyHistory(),before,d),d,'undo').doc;
 assert.equal(categoryGrade(back,s.id,cat.id,g.id,p.id),previous);
});

test('duplicar rúbrica con nombre máximo respeta el límite',()=>{
 const {d}=fx(),r=createRubric(d,'R'.repeat(150),[{name:'A',maxScore:10,weight:1}]);
 const clone=duplicateRubric(d,r.id);assert.equal(clone.name.length,150);assertModel(d);
});
