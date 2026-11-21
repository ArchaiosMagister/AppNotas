import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initialNotebook,emptyNotebook,addGroup,addStudent,addAssessment,
  createRubric,setGrade,setRubricGrade,setOrthographyGrade,
  setNotSubmitted,setPendingJustified,removeStudent,removeAssessment,
  getGradeObservation,setGradeObservation,assertModel} from '../src/model.js';
import {overallGrade,itacaGrade} from '../src/calculations.js';
import {createVault,unlockVault,saltFromEnvelope} from '../src/vault.js';
import {ensureBookMetadata,createPortableCopy,readBackupFile} from '../src/cuaderno.js';

function fixture(){
 const doc=emptyNotebook();
 const group=addGroup(doc,'Latín I optativa','Latín I','2026-2027','1bach');
 const student=addStudent(doc,group.id,{firstName:'Ana',lastName:'García',originGroup:'1.º A'});
 const period=doc.periods[0];
 const assessment=addAssessment(doc,{name:'Examen UD1',groupId:group.id,periodId:period.id,categoryId:doc.categories[0].id});
 return {doc,group,student,period,assessment};
}

test('observación libre y privada sin calificación, por alumno y actividad concretos',()=>{
 const {doc,group,student,period,assessment}=fixture();
 const other=addStudent(doc,group.id,{firstName:'Luis',lastName:'Pérez'});
 const second=addAssessment(doc,{name:'Trabajo de prueba',groupId:group.id,periodId:period.id,categoryId:doc.categories[1].id});
 const originalAverage=overallGrade(doc,student.id,group.id,period.id);
 setGradeObservation(doc,student.id,assessment.id,'  Realizó el examen otro día.  ');
 const note=getGradeObservation(doc,student.id,assessment.id);
 assert.equal(note.text,'Realizó el examen otro día.');
 assert.equal(note.visibleToStudent,false);
 assert.equal(getGradeObservation(doc,other.id,assessment.id),null);
 assert.equal(getGradeObservation(doc,student.id,second.id),null);
 assert.equal(doc.grades.length,0,'Las observaciones no son calificaciones');
 assert.equal(overallGrade(doc,student.id,group.id,period.id),originalAverage);
 assertModel(doc);
});

test('nota y observación son independientes: editar o borrar nota conserva comentario',()=>{
 const {doc,student,assessment,group,period}=fixture();
 setGradeObservation(doc,student.id,assessment.id,'Llegó tarde',false);
 const first=getGradeObservation(doc,student.id,assessment.id).id;
 setGrade(doc,student.id,assessment.id,7.75);
 const average=overallGrade(doc,student.id,group.id,period.id),itaca=itacaGrade(doc,student.id,group.id,period.id);
 assert.equal(average,7.75);assert.equal(itaca,8);
 setGradeObservation(doc,student.id,assessment.id,'Llegó diez minutos tarde',true);
 assert.equal(getGradeObservation(doc,student.id,assessment.id).id,first);
 assert.equal(getGradeObservation(doc,student.id,assessment.id).visibleToStudent,true);
 assert.equal(overallGrade(doc,student.id,group.id,period.id),average);
 assert.equal(itacaGrade(doc,student.id,group.id,period.id),itaca);
 setGrade(doc,student.id,assessment.id,null);
 assert.equal(doc.grades.length,0);
 assert.equal(getGradeObservation(doc,student.id,assessment.id).text,'Llegó diez minutos tarde');
 assertModel(doc);
});

test('NP y AJ conservan observaciones también tras eliminar la ausencia',()=>{
 const {doc,student,assessment}=fixture();
 setGradeObservation(doc,student.id,assessment.id,'Se examinará en convocatoria posterior');
 setNotSubmitted(doc,student.id,assessment.id,true);
 assert.equal(doc.grades[0].notSubmitted,true);
 assert.equal(getGradeObservation(doc,student.id,assessment.id).text,'Se examinará en convocatoria posterior');
 setNotSubmitted(doc,student.id,assessment.id,false);
 assert.equal(doc.grades.length,0);
 setPendingJustified(doc,student.id,assessment.id,true);
 assert.equal(doc.grades[0].pendingJustified,true);
 setPendingJustified(doc,student.id,assessment.id,false);
 assert.equal(doc.grades.length,0);
 assert.equal(getGradeObservation(doc,student.id,assessment.id).visibleToStudent,false);
 assertModel(doc);
});

test('rúbrica y examen con faltas admiten observaciones aunque se borre la rúbrica',()=>{
 const {doc,student,group,period}=fixture();
 const rubric=createRubric(doc,'Trabajo con criterios',[{name:'Contenido',maxScore:5,weight:1}]);
 const work=addAssessment(doc,{name:'Trabajo',groupId:group.id,periodId:period.id,categoryId:doc.categories[1].id,rubricId:rubric.id});
 const exam=addAssessment(doc,{name:'Dictado',groupId:group.id,periodId:period.id,categoryId:doc.categories[0].id});
 setGradeObservation(doc,student.id,work.id,'Rúbrica completada con demora');
 setGradeObservation(doc,student.id,exam.id,'Se repitió el dictado',true);
 setRubricGrade(doc,student.id,work.id,{[rubric.criteria[0].id]:4});
 setOrthographyGrade(doc,student.id,exam.id,{score:7,faults:1,delivered:false});
 assert.equal(doc.grades.length,2);
 assert.equal(getGradeObservation(doc,student.id,work.id).text,'Rúbrica completada con demora');
 assert.equal(getGradeObservation(doc,student.id,exam.id).visibleToStudent,true);
 setRubricGrade(doc,student.id,work.id,null);
 assert.equal(getGradeObservation(doc,student.id,work.id).text,'Rúbrica completada con demora');
 assertModel(doc);
});

test('borrado de observación independiente, sin modificar nota ni notas de otro alumno',()=>{
 const {doc,student,assessment,group,period}=fixture();
 const other=addStudent(doc,group.id,{firstName:'Beatriz',lastName:'López'});
 setGrade(doc,student.id,assessment.id,8);
 setGradeObservation(doc,student.id,assessment.id,'Antes de la hora',true);
 setGradeObservation(doc,other.id,assessment.id,'Hizo una recuperación',false);
 const before=structuredClone(doc.grades);
 const firstAvg=overallGrade(doc,student.id,group.id,period.id);
 setGradeObservation(doc,student.id,assessment.id,'');
 assert.equal(getGradeObservation(doc,student.id,assessment.id),null);
 assert.equal(getGradeObservation(doc,other.id,assessment.id).text,'Hizo una recuperación');
 assert.deepEqual(doc.grades,before);
 assert.equal(overallGrade(doc,student.id,group.id,period.id),firstAvg);
 assertModel(doc);
});

test('validación rechaza observaciones excesivas, fuera de grupo, visibilidad inválida y duplicados',()=>{
 const {doc,student,assessment,group}=fixture();
 const otherGroup=addGroup(doc,'Griego','Griego I','2026-2027','1bach');
 const otherStudent=addStudent(doc,otherGroup.id,{firstName:'Pablo',lastName:'Pérez'});
 const before=structuredClone(doc);
 for(const [id,aid,value,visible] of [
   [student.id,assessment.id,'x'.repeat(1501),false],
   [student.id,assessment.id,123,false],
   [student.id,assessment.id,'Texto','sí'],
   [otherStudent.id,assessment.id,'Otro grupo',false],
   ['desconocido',assessment.id,'Sin alumno',false],
   [student.id,'inexistente','Sin actividad',false]
 ]){assert.throws(()=>setGradeObservation(doc,id,aid,value,visible));assert.deepEqual(doc,before);}
 setGradeObservation(doc,student.id,assessment.id,'  Comentario  ',false);
 const invalid=structuredClone(doc);
 invalid.gradeObservations.push({...invalid.gradeObservations[0],id:'duplicado'});
 assert.throws(()=>assertModel(invalid),/Observación/);
 const bad=structuredClone(doc);
 bad.gradeObservations[0].text='a'.repeat(1501);
 assert.throws(()=>assertModel(bad),/Observación/);
 const badVisibility=structuredClone(doc);
 badVisibility.gradeObservations[0].visibleToStudent='yes';
 assert.throws(()=>assertModel(badVisibility),/Observación/);
});

test('borrar alumno o actividad limpia sus observaciones y no afecta al resto',()=>{
 const {doc,student,assessment,group,period}=fixture();
 const second=addStudent(doc,group.id,{firstName:'Carlos',lastName:'Martín'});
 const extra=addAssessment(doc,{name:'Trabajo',groupId:group.id,periodId:period.id,categoryId:doc.categories[1].id});
 setGradeObservation(doc,student.id,assessment.id,'A');
 setGradeObservation(doc,student.id,extra.id,'B');
 setGradeObservation(doc,second.id,assessment.id,'C');
 removeAssessment(doc,extra.id);
 assert.equal(getGradeObservation(doc,student.id,extra.id),null);
 removeStudent(doc,student.id);
 assert.equal(doc.gradeObservations.length,1);
 assert.equal(getGradeObservation(doc,second.id,assessment.id).text,'C');
 assertModel(doc);
});

test('cuaderno histórico sin campo de observaciones se abre sin migración destructiva',()=>{
 const old=initialNotebook();delete old.gradeObservations;
 assertModel(old);
 assert.equal(getGradeObservation(old,old.students[0].id,old.assessments[0].id),null);
 setGradeObservation(old,old.students[0].id,old.assessments[0].id,'Comentario privado');
 assert.equal(old.gradeObservations.length,1);
 assertModel(old);
});

test('las observaciones privadas permanecen cifradas en copias portátiles y la restauración',async()=>{
 const {doc,student,assessment,group,period}=fixture();
 setGrade(doc,student.id,assessment.id,8.5);
 setGradeObservation(doc,student.id,assessment.id,'Privado: llegó tarde <script>alert(1)</script>',false);
 ensureBookMetadata(doc);assertModel(doc);
 const password='Frase muy larga para probar cifrado de las notas 2026!';
 const {key,envelope}=await createVault(password,doc);
 const recovered=await unlockVault(password,envelope);
 assert.deepEqual(recovered.doc,doc);
 const portable=await createPortableCopy(doc,key,saltFromEnvelope(envelope));
 const bytes=JSON.stringify(portable.file);
 assert(!bytes.includes('Privado: llegó tarde'));
 assert(!bytes.includes('<script>'));
 const restored=await readBackupFile({size:bytes.length,text:async()=>bytes},password);
 assert.deepEqual(restored.doc.gradeObservations,doc.gradeObservations);
 assert.equal(overallGrade(restored.doc,student.id,group.id,period.id),
              overallGrade(doc,student.id,group.id,period.id));
});

test('interfaz: editar desde todas las casillas y mostrar al alumno solo con permiso explícito',async()=>{
 const [app,css,sw]=await Promise.all(['app.js','styles.css','sw.js']
   .map(path=>readFile(new URL('../'+path,import.meta.url),'utf8')));
 const table=app.slice(app.indexOf('function renderNotebook(){'),app.indexOf('const ITACA_OPTIONS='));
 assert.equal((table.match(/observationButton\(s\.id,a\.id\)/g)||[]).length,3);
 assert(table.includes('data-observation-student='));
 assert(table.includes('data-observation-assessment='));
 assert(app.includes("setGradeObservation(d,studentId,assessmentId,text.value,checkbox.checked)"));
 assert(app.includes('openGradeObservation(b.dataset.observationStudent,b.dataset.observationAssessment)'));
 assert(app.includes('const scroll={x:window.scrollX,y:window.scrollY'));
 const student=app.slice(app.indexOf('function renderStudentView(){'),app.indexOf('function bindStudentView(){'));
 assert(student.includes('observation?.visibleToStudent?'));
 assert(student.includes('esc(observation.text)'));
 assert(student.includes('student-assessment-observation'));
 assert(app.includes('Mostrar también en el modo alumno'));
 assert(app.includes('Privada por defecto'));
 assert(css.includes('.grade-table .grade-observation-button.has-observation'));
 assert(css.includes('.student-assessment-observation>p'));
 assert(css.includes('white-space:pre-wrap'));
 const cache=sw.match(/const CACHE='(cuaderno-docente-static-v(\d+)-dev)'/)?.[1];
 assert(cache,'El servicio offline debe declarar una caché versionada');
 assert(Number(cache.match(/v(\d+)-dev/)[1])>=129);
 assert(app.includes("caches.open('"+cache+"')"),'La interfaz y el SW deben usar la misma caché');
});
