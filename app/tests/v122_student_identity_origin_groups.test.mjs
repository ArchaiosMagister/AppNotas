import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initialNotebook,emptyNotebook,assertModel,addGroup,addStudent,updateStudentIdentity,
  renameStudent,sortStudents,STUDENT_SORT_MODES,addAssessment,setGrade} from '../src/model.js';
import {studentsFromCsv,namesFromCsv} from '../src/csv.js';
import {overallGrade} from '../src/calculations.js';
import {createVault,unlockVault,saltFromEnvelope} from '../src/vault.js';
import {ensureBookMetadata,createPortableCopy,readBackupFile} from '../src/cuaderno.js';

const fixture=()=>{
 const doc=emptyNotebook(),group=addGroup(doc,'Griego optativa','Griego I','2026-2027','1bach');
 return {doc,group};
};
test('alta de alumno con apellidos, nombre y procedencia mantiene una sola optativa',()=>{
 const {doc,group}=fixture();
 const student=addStudent(doc,group.id,{lastName:'García López',firstName:'Ana María',originGroup:'1.º A'});
 assert.equal(student.name,'García López, Ana María');
 assert.equal(student.lastName,'García López');
 assert.equal(student.firstName,'Ana María');
 assert.equal(student.originGroup,'1.º A');
 assert.equal(student.groupId,group.id);
 assert.equal(doc.groups.length,1);
 assertModel(doc);
});

test('editar la identidad no cambia ID, notas, nota final, grupo de optativa ni reglas',()=>{
 const {doc,group}=fixture();
 const a=addStudent(doc,group.id,{lastName:'López',firstName:'Marta',originGroup:'2.º B'});
 const exam=addAssessment(doc,{name:'Examen',groupId:group.id,periodId:doc.periods[0].id,categoryId:doc.categories[0].id,maxScore:5});
 setGrade(doc,a.id,exam.id,4);
 const before=overallGrade(doc,a.id,group.id,doc.periods[0].id);
 const grade=structuredClone(doc.grades),id=a.id;
 updateStudentIdentity(doc,id,{lastName:'Álvarez de la Cruz',firstName:'María del Mar',originGroup:'2.º C'});
 assert.equal(doc.students[0].id,id);
 assert.equal(doc.students[0].groupId,group.id);
 assert.deepEqual(doc.grades,grade);
 assert.equal(overallGrade(doc,id,group.id,doc.periods[0].id),before);
 assert.equal(doc.students[0].name,'Álvarez de la Cruz, María del Mar');
 assertModel(doc);
});

test('apellidos A-Z por defecto, nombre, grupo y manual producen orden estable sin mutar datos',()=>{
 const {doc,group}=fixture();
 const a=addStudent(doc,group.id,{lastName:'Zúñiga',firstName:'Beatriz',originGroup:'1.º B'});
 const b=addStudent(doc,group.id,{lastName:'Álvarez',firstName:'Carlos',originGroup:'2.º A'});
 const c=addStudent(doc,group.id,{lastName:'Martín',firstName:'Ana',originGroup:'1.º B'});
 const d=addStudent(doc,group.id,{lastName:'García',firstName:'Diego',originGroup:'1.º A'});
 const e=addStudent(doc,group.id,{lastName:'Pérez',firstName:'Eva'});
 const original=structuredClone(doc.students);
 const ids=list=>list.map(x=>x.id);
 assert.deepEqual(ids(sortStudents(doc.students)),[b.id,d.id,c.id,e.id,a.id]);
 assert.deepEqual(ids(sortStudents(doc.students,'surname')),[b.id,d.id,c.id,e.id,a.id]);
 assert.deepEqual(ids(sortStudents(doc.students,'firstName')),[c.id,a.id,b.id,d.id,e.id]);
 assert.deepEqual(ids(sortStudents(doc.students,'originGroup')),[d.id,c.id,a.id,b.id,e.id]);
 assert.deepEqual(ids(sortStudents(doc.students,'manual')),[a.id,b.id,c.id,d.id,e.id]);
 assert.deepEqual(doc.students,original);
 assert.deepEqual(STUDENT_SORT_MODES,['surname','firstName','originGroup','manual']);
 assertModel(doc);
});

test('alumnos antiguos no se separan automáticamente ni se pierden al ordenar o renombrar',()=>{
 const doc=initialNotebook(),legacy=doc.students[0],id=legacy.id,name=legacy.name;
 assert.equal(legacy.lastName,undefined);
 assert.equal(legacy.firstName,undefined);
 assert.equal(legacy.name,'Alumno 01');
 assert.equal(sortStudents(doc.students)[0].id,id);
 assert.equal(legacy.name,name);
 assertModel(doc);
 renameStudent(doc,id,'Alumno antiguo');
 assert.equal(doc.students.find(s=>s.id===id).name,'Alumno antiguo');
 assert.equal(doc.students.find(s=>s.id===id).lastName,undefined);
 assertModel(doc);
});

test('cuadernos antiguos conservan nombres largos sin que el nuevo esquema los invalide',()=>{
  const doc=initialNotebook(),legacy=doc.students[0];
  legacy.name='Nombre histórico de demostración '.repeat(7).trim();
  assert(legacy.name.length>150);
  const previous=structuredClone(doc.grades);
  assertModel(doc);
  assert(sortStudents(doc.students).some(student=>student.id===legacy.id&&student.name===legacy.name));
  assert.deepEqual(doc.grades,previous);
});

test('rechazo de datos malformados, inyección en campos y campos incompletos sin cambios',()=>{
 const {doc,group}=fixture(),before=structuredClone(doc);
 for(const bad of [
  {firstName:'Ana',lastName:''},
  {firstName:'Ana'},
  {firstName:'',lastName:'Pérez'},
  {firstName:'Ana',lastName:'Pérez',originGroup:'X'.repeat(61)},
  {firstName:'Ana',lastName:'Pérez',groupId:'otro'},
  {firstName:'Ana',lastName:'Pérez',originGroup:99}
 ]){
  assert.throws(()=>addStudent(doc,group.id,bad));
  assert.deepEqual(doc,before);
 }
 const student=addStudent(doc,group.id,{firstName:'Ana',lastName:'Pérez',originGroup:'1A'});
 const snapshot=structuredClone(doc);
 assert.throws(()=>updateStudentIdentity(doc,student.id,{firstName:'',lastName:'Perez'}));
 assert.deepEqual(doc,snapshot);
 const broken=structuredClone(doc);broken.students[0].name='Nombre incoherente';
 assert.throws(()=>assertModel(broken),/Identidad/);
 const brokenGroup=structuredClone(doc);brokenGroup.students[0].originGroup='X'.repeat(61);
 assert.throws(()=>assertModel(brokenGroup),/Identidad/);
});

test('CSV con tres columnas admite comas entrecomilladas, diacríticos y grupo; CSV antiguo sigue intacto',()=>{
 const rows=studentsFromCsv('\uFEFFApellidos;Nombre;Grupo de procedencia\n"García, López";Ana María;1.º A\nMartín;Juan;2.º B\n');
 assert.deepEqual(rows,[
  {firstName:'Ana María',lastName:'García, López',originGroup:'1.º A'},
  {firstName:'Juan',lastName:'Martín',originGroup:'2.º B'}
 ]);
 assert.deepEqual(studentsFromCsv('nombre\nLuis Pérez\n'),[{name:'Luis Pérez',originGroup:''}]);
 assert.deepEqual(namesFromCsv('nombre\nLuis Pérez\n'),['Luis Pérez']);
 assert.throws(()=>studentsFromCsv('apellidos;nombre;grupo\n;Ana;1A\n'),/fila 2/i);
 assert.throws(()=>studentsFromCsv('apellidos;nombre;grupo\nLópez;;1A\n'),/fila 2/i);
 assert.throws(()=>studentsFromCsv('apellidos;nombre;grupo\nLópez;Ana;'+'X'.repeat(61)),/fila 2/i);
});

test('cifrado, exportación y recuperación preservan apellidos, etiquetas, notas y revisión',async()=>{
 const {doc,group}=fixture();
 const a=addStudent(doc,group.id,{firstName:'Ana',lastName:'Sánchez',originGroup:'1.º B'});
 const b=addStudent(doc,group.id,{firstName:'Pedro',lastName:'Ávila',originGroup:'1.º A'});
 const exam=addAssessment(doc,{name:'Trabajo',groupId:group.id,periodId:doc.periods[0].id,categoryId:doc.categories[1].id,maxScore:10});
 setGrade(doc,a.id,exam.id,8.75);setGrade(doc,b.id,exam.id,9.5);
 assertModel(doc);ensureBookMetadata(doc);
 const password='Contraseña de prueba con mucho margen 2026';
 const {key,envelope}=await createVault(password,doc);
 const opened=await unlockVault(password,envelope);
 assert.deepEqual(opened.doc,doc);
 const portable=await createPortableCopy(doc,key,saltFromEnvelope(envelope));
 const bytes=JSON.stringify(portable.file);
 assert(!bytes.includes('Sánchez')&&!bytes.includes('Ávila')&&!bytes.includes('1.º A'));
 const decoded=await readBackupFile({size:bytes.length,text:async()=>bytes},password);
 assert.deepEqual(decoded.doc,doc);
 assert.deepEqual(sortStudents(decoded.doc.students).map(s=>s.name),['Ávila, Pedro','Sánchez, Ana']);
 assert.equal(overallGrade(decoded.doc,a.id,group.id,doc.periods[0].id),8.75);
});

test('la interfaz agrupa solo para ver y muestra las mismas fichas y notas',async()=>{
 const [app,css]=await Promise.all(['app.js','styles.css'].map(file=>readFile(new URL('../'+file,import.meta.url),'utf8')));
 assert(app.includes("studentSort:savedStudentSort(),studentPlainSort:savedStudentPlainSort()"));
 assert(app.includes("sortStudents(STATE.doc.students.filter(x=>x.groupId===STATE.groupId),STATE.studentSort)"));
 assert(app.includes("const studentSortControls=()=>"));
 assert(app.includes("originGroupHeader(students,i,assessments.length+3)"));
 assert(app.includes("originGroupHeader(students,i,periods.length+2)"));
 assert(app.includes('originDirectoryHeader(students,i)'));
 assert(app.includes('studentOriginBadge(s)'));
 assert(app.includes('id="student-sort-mode"'));
 assert(app.includes("updateStudentIdentity(d,studentId,"));
 assert(app.includes("studentsFromCsv(await file.text())"));
 assert(css.includes('.student-origin-divider'));
 assert(css.includes('.student-origin-badge'));
 assert(css.includes('html[data-theme="oled"] .student-origin-divider'));
});
