import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initialNotebook,addGroup,addStudent,originGroupOptions,assignStudentOriginGroup,assertModel,addNotebookSubject,classifyGroup,COURSE_SUBJECTS} from '../src/model.js';
test('procedencias compartidas solo por curso escolar y nivel, conservadas aunque queden sin alumnos',()=>{
 const doc=initialNotebook(),latin=doc.groups[0],greek=addGroup(doc,'Griego','Griego I',latin.course,'1bach'),other=addGroup(doc,'Otro','Griego I','2027-2028','1bach'),eso=addGroup(doc,'ESO','Latín 4.º',latin.course,'4eso');
 const a=doc.students[0],b=addStudent(doc,greek.id,'Alumno B'),c=addStudent(doc,other.id,'Alumno C'),d=addStudent(doc,eso.id,'Alumno D');
 const grades=structuredClone(doc.grades),activities=structuredClone(doc.assessments),id=a.id,name=a.name;
 assignStudentOriginGroup(doc,a.id,'A');assignStudentOriginGroup(doc,b.id,'B');assignStudentOriginGroup(doc,c.id,'C');assignStudentOriginGroup(doc,d.id,'D');
 assert.deepEqual(originGroupOptions(doc,latin.id),['A','B']);assert.deepEqual(originGroupOptions(doc,greek.id),['A','B']);
 assignStudentOriginGroup(doc,a.id,'B');assert.deepEqual(originGroupOptions(doc,latin.id),['A','B']);
 assignStudentOriginGroup(doc,a.id,'');assert.equal(a.originGroup,'');assert.equal(a.id,id);assert.equal(a.name,name);assert.equal(a.groupId,latin.id);
 assert.deepEqual(doc.grades,grades);assert.deepEqual(doc.assessments,activities);assertModel(doc);
});
test('fichas vinculadas requieren confirmación y conservan notas y nombres',()=>{
 const doc=initialNotebook(),latin=doc.groups[0],greek=addGroup(doc,'Griego','Griego I',latin.course,'1bach');
 const a=doc.students[0],b=addStudent(doc,greek.id,'Otra ficha'),id=crypto.randomUUID();a.personId=id;b.personId=id;
 const before=structuredClone(doc);assert.throws(()=>assignStudentOriginGroup(doc,a.id,'A'),/Confirma/);assert.deepEqual(doc,before);
 assignStudentOriginGroup(doc,a.id,'A',{linked:true});assert.equal(a.originGroup,'A');assert.equal(b.originGroup,'A');assert.deepEqual(doc.grades,before.grades);assertModel(doc);
});
test('asignaturas oficiales conservan nivel fijo sin migrar grupos antiguos',()=>{
 const doc=initialNotebook(),old=structuredClone(doc);
 for(const [level,entry] of Object.entries(COURSE_SUBJECTS))for(const subject of entry.subjects){
  const wrong=Object.keys(COURSE_SUBJECTS).find(x=>x!==level);
  assert.throws(()=>addNotebookSubject(doc,wrong,subject),/corresponde/);
  assert.throws(()=>addGroup(doc,'Erróneo',subject,'2026-2027',wrong),/corresponde/);
 }
 assert.deepEqual(doc,old);assertModel(doc);
 // Un catálogo histórico de otro nivel sigue siendo legible; no se reclasifica.
 const legacy=structuredClone(doc);legacy.settings.customSubjects.push({level:'4eso',subject:'Latín I'});legacy.settings.subjectAccents['4eso:Latín I']='#64748B';
 assertModel(legacy);assert.throws(()=>addGroup(legacy,'Erróneo','Latín I','2026-2027','4eso'),/corresponde/);
 assert.throws(()=>classifyGroup(legacy,legacy.groups[0].id,'4eso','Latín I'),/corresponde/);
});
test('selector editable nativo con opción de alta y sin exponerlo en presentación del alumno',()=>{
 const s=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert(s.includes('studentOriginSelector(s,originOptions)'));assert(s.includes("opt('add','+ Añadir grupo…'"));
 assert(s.includes('bindOriginSelectors();'));assert(s.includes('assignStudentOriginGroup(d,studentId,label'));
 const view=s.slice(s.indexOf('function renderStudentView(){'),s.indexOf('function bindStudentView(){'));
 assert(!view.includes('studentOriginSelector('));
});
