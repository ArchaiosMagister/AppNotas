import test from 'node:test';
import assert from 'node:assert/strict';
import {initialNotebook,assertModel,addGroup,addPeriod,addStudent,addAssessment,addCategory,setGrade,setCategory,addCompetency,setCompetencyLink} from '../src/model.js';
const setup=()=>{const d=initialNotebook();return {d,group:d.groups[0],period:d.periods[0],student:d.students[0]};};
test('modelo inicial válido y con datos únicamente ficticios',()=>{
  const {d}=setup();assert.equal(assertModel(d),true);assert.equal(d.students.length,8);
  assert(d.students.every(x=>/^Alumno \d{2}$/.test(x.name)));
  assert.equal(d.categories.reduce((sum,c)=>sum+c.weight,0),100);
});
test('grupo, periodo, alumno, actividad y nota modificables',()=>{
  const {d}=setup();const g=addGroup(d,'Griego I','Griego I','2026-2027'),p=addPeriod(d,'Extraordinaria');
  const s=addStudent(d,g.id,'Alumno A'),a=addAssessment(d,{name:'Traducción',groupId:g.id,periodId:p.id,categoryId:d.categories[0].id,maxScore:5});
  setGrade(d,s.id,a.id,2.5);assert.equal(d.grades.find(x=>x.studentId===s.id).score,2.5);
  assert.equal(assertModel(d),true);
  setGrade(d,s.id,a.id,null);assert.equal(d.grades.filter(x=>x.studentId===s.id).length,0);
  assert.equal(assertModel(d),true);
});
test('acepta cero y rechaza sobresalir del máximo, NaN y referencias cruzadas',()=>{
  const {d,group,student}=setup();const a=d.assessments[0];
  setGrade(d,student.id,a.id,0);assert.equal(d.grades.find(x=>x.studentId===student.id&&x.assessmentId===a.id).score,0);
  assert.throws(()=>setGrade(d,student.id,a.id,-1));assert.throws(()=>setGrade(d,student.id,a.id,11));assert.throws(()=>setGrade(d,student.id,a.id,'abc'));
  const g=addGroup(d,'Otro grupo');const s=addStudent(d,g.id,'Otro');assert.throws(()=>setGrade(d,s.id,a.id,5));
});
test('categorías y competencias configurables y validadas',()=>{
  const {d}=setup();const c=addCategory(d,'Lecturas',0,'highest');setCategory(d,c.id,{weight:10,rule:'mean'});
  const comp=addCompetency(d,'CE2');setCompetencyLink(d,comp.id,c.id,50);assert.equal(comp.links[0].weight,50);
  setCompetencyLink(d,comp.id,c.id,null);assert.equal(comp.links.length,0);assert.equal(assertModel(d),true);
  assert.throws(()=>setCategory(d,c.id,{weight:-5}));assert.throws(()=>setCompetencyLink(d,comp.id,c.id,-1));
});
test('modelo no admite calificacions duplicadas o referencias rotas',()=>{
  const {d}=setup();d.grades.push({...d.grades[0],id:crypto.randomUUID()});assert.throws(()=>assertModel(d),/duplicada/);
  d.grades.pop();d.assessments[0].categoryId='inexistente';assert.throws(()=>assertModel(d),/referencia/);
});
