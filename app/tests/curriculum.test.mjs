import test from 'node:test';
import assert from 'node:assert/strict';
import {initialNotebook,assertModel,migrateNotebook,COURSE_SUBJECTS,SUBJECT_COLORS,levelForSubject,validSubject,subjectKey,setSubjectAccent,addGroup,classifyGroup,addStudent,addAssessment,setGrade} from '../src/model.js';
import {overallGrade} from '../src/calculations.js';

const pairs = [
  ['4eso','Latín 4.º'],['1bach','Latín I'],['1bach','Griego I'],
  ['2bach','Latín II'],['2bach','Griego II']
];
test('catálogo de tres cursos y cinco asignaturas estrictamente agrupadas',()=>{
  assert.deepEqual(Object.keys(COURSE_SUBJECTS),['4eso','1bach','2bach']);
  for(const [level,subject] of pairs){
    assert.equal(validSubject(level,subject),true);
    assert.equal(levelForSubject(subject),level);
  }
  assert.equal(validSubject('4eso','Griego I'),false);
  assert.equal(validSubject('2bach','Latín I'),false);
  assert.equal(validSubject('1bach','Griego II'),false);
});
test('un grupo se guarda en curso/asignatura válidos y conserva el año escolar',()=>{
  const doc=initialNotebook();
  for(const [level,subject] of pairs){
    const g=addGroup(doc,'Grupo '+subject,subject,'2027-2028',level);
    assert.equal(g.level,level);assert.equal(g.subject,subject);assert.equal(g.course,'2027-2028');
  }
  assert.equal(doc.groups.length,6);
  assert.throws(()=>addGroup(doc,'Inválido','Griego I','2027-2028','2bach'),/compatible/);
  assertModel(doc);
});
test('cada combinación retiene un acento independiente, con validación estricta',()=>{
  const d=initialNotebook();
  const before={...d.settings.subjectAccents};
  assert.deepEqual(before,SUBJECT_COLORS);
  setSubjectAccent(d,'1bach','Latín I','#abcdef');
  assert.equal(d.settings.subjectAccents[subjectKey('1bach','Latín I')],'#ABCDEF');
  for(const [level,subject] of pairs.filter(([l,s])=>s!=='Latín I')){
    assert.equal(d.settings.subjectAccents[subjectKey(level,subject)],before[subjectKey(level,subject)]);
  }
  assert.throws(()=>setSubjectAccent(d,'4eso','Griego I','#aabbcc'),/inválidos/);
  assert.throws(()=>setSubjectAccent(d,'2bach','Latín II','red; background:url(x)'),/inválidos/);
  assertModel(d);
});
test('migración de versión 2 conserva alumnos, grupos, notas, reglas y año escolar',()=>{
  const doc=initialNotebook();
  const g=addGroup(doc,'Grupo clásico','Griego I','2025-2026','1bach');
  const s=addStudent(doc,g.id,'Alumno ficticio');
  const a=addAssessment(doc,{name:'Examen',groupId:g.id,periodId:doc.periods[0].id,categoryId:doc.categories[0].id});
  setGrade(doc,s.id,a.id,7);
  const legacy=structuredClone(doc);legacy.schemaVersion=2;
  delete legacy.settings.subjectAccents;
  legacy.groups.forEach(x=>delete x.level);
  const beforeGrades=structuredClone(legacy.grades),beforeStudents=structuredClone(legacy.students);
  const after=migrateNotebook(legacy);
  assert.equal(after.migrated,true);
  assert.equal(after.doc.schemaVersion,8);
  assert.deepEqual(after.doc.grades,beforeGrades);
  assert.deepEqual(after.doc.students,beforeStudents);
  assert.equal(after.doc.groups.find(x=>x.id===g.id).course,'2025-2026');
  assert.equal(after.doc.groups.find(x=>x.id===g.id).level,'1bach');
  assert.equal(migrateNotebook(after.doc).migrated,false);
  assert.equal(overallGrade(after.doc,doc.students[0].id,doc.groups[0].id,doc.periods[0].id),overallGrade(doc,doc.students[0].id,doc.groups[0].id,doc.periods[0].id));
  assertModel(after.doc);
});
test('materia antigua desconocida no se clasifica arbitrariamente y se puede reparar',()=>{
  const doc=initialNotebook();
  const old=structuredClone(doc);old.schemaVersion=2;
  delete old.settings.subjectAccents;
  old.groups[0].subject='Taller experimental';delete old.groups[0].level;
  const beforeGrades=structuredClone(old.grades);
  const migrated=migrateNotebook(old).doc;
  assert.equal(migrated.groups[0].level,null);
  assert.equal(migrated.groups[0].legacyUnclassified,true);
  assert.deepEqual(migrated.grades,beforeGrades);
  classifyGroup(migrated,migrated.groups[0].id,'4eso','Latín 4.º');
  assert.equal(migrated.groups[0].level,'4eso');
  assert.equal(migrated.groups[0].legacyUnclassified,false);
  assert.deepEqual(migrated.grades,beforeGrades);
  assertModel(migrated);
});
test('restringe la mutación inválida en el modelo',()=>{
  const d=initialNotebook();
  d.groups[0].level='2bach';
  assert.throws(()=>assertModel(d),/curso o asignatura/);
  d.groups[0].level='1bach';
  d.settings.subjectAccents['1bach:Latín I']='javascript:';
  assert.throws(()=>assertModel(d),/Colores/);
});
