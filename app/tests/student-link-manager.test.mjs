import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {initialNotebook,addGroup,addStudent,addAssessment,setGrade,assertModel} from '../src/model.js';
import {linkStudentRecords,linkedStudentFamilies} from '../src/evaluation-groups.js';
import {manualLinkGroups,manualLinkStudents,manualLinkSuggestions,renderStudentLinksManager} from '../src/student-link-ui.js';

function fixture(){
 const d=initialNotebook({empty:true});
 const latin=addGroup(d,'1.º BACH','Latín I','2026-2027','1bach');
 const greek=addGroup(d,'1.º BACH','Griego I','2026-2027','1bach');
 const otherLatin=addGroup(d,'Otro grupo','Latín I','2026-2027','1bach');
 const latin4=addGroup(d,'4.º ESO','Latín 4.º','2026-2027','4eso');
 const prevGreek=addGroup(d,'1.º BACH','Griego I','2025-2026','1bach');
 const l=addStudent(d,latin.id,{name:'García López, María',originGroup:'A'});
 const g=addStudent(d,greek.id,{name:'María García L.',originGroup:'A'});
 const wrong=addStudent(d,greek.id,{name:'García López, Lucía',originGroup:'B'});
 addStudent(d,otherLatin.id,{name:'García López, María',originGroup:'A'});
 addStudent(d,latin4.id,{name:'García López, María',originGroup:'A'});
 addStudent(d,prevGreek.id,{name:'García López, María',originGroup:'A'});
 return {d,latin,greek,otherLatin,latin4,prevGreek,l,g,wrong};
}
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('acceso permanente en Materias y grupos, independiente de Agenda',()=>{
 const app=readFileSync(path.join(root,'app.js'),'utf8');
 assert.match(app,/<button[^>]*id="manage-shared-students"[^>]*>Vincular alumnos entre asignaturas<\/button>/);
 assert.match(app,/\$\('#manage-shared-students'\).*openStudentLinksManager/);
 const start=app.indexOf('<div class="group-actions-panel">');
 const html=app.slice(start,app.indexOf('</details>',start));
 assert(html.includes('id="manage-shared-students"'));
 assert(html.indexOf('id="manage-shared-students"')>html.indexOf('id="manage-subjects"'));
});
test('el selector manual no exige nombres coincidentes',()=>{
 const f=fixture();
 assert.equal(manualLinkSuggestions(f.d,'2026-2027').some(p=>p.a.id===f.l.id&&p.b.id===f.g.id),false);
 assert(manualLinkStudents(f.d,f.latin.id,'García').some(s=>s.id===f.l.id));
 assert(manualLinkStudents(f.d,f.greek.id,'María García L').some(s=>s.id===f.g.id));
 assert.match(renderStudentLinksManager(f.d,{year:'2026-2027',groupA:f.latin.id,groupB:f.greek.id}),/student-link-manual-form/);
 const originalStudents=structuredClone(f.d.students);
 const originalGrades=structuredClone(f.d.grades);
 assert.equal(f.l.personId,undefined);assert.equal(f.g.personId,undefined);
 assert.deepEqual(f.d.students,originalStudents);assert.deepEqual(f.d.grades,originalGrades);
});
test('selector por curso, etapa y materia distinta sin confundir grupos de Latín ni 4.º ESO',()=>{
 const f=fixture();
 const pairs=manualLinkGroups(f.d,'2026-2027',f.latin.id);
 assert.deepEqual(pairs.map(g=>g.id),[f.greek.id]);
 const sameGroup=manualLinkGroups(f.d,'2026-2027');
 assert(sameGroup.some(g=>g.id===f.otherLatin.id));
 assert(!pairs.some(g=>g.id===f.otherLatin.id||g.id===f.latin4.id||g.id===f.prevGreek.id));
});
test('se pueden vincular manualmente nombres distintos sin alterar ningún dato de evaluación',()=>{
 const f=fixture();
 const a=addAssessment(f.d,{name:'Examen Latín',groupId:f.latin.id,periodId:f.d.periods[0].id,categoryId:f.d.categories[0].id,maxScore:10,weight:1,convertToTen:true});
 const b=addAssessment(f.d,{name:'Examen Griego',groupId:f.greek.id,periodId:f.d.periods[0].id,categoryId:f.d.categories[0].id,maxScore:10,weight:1,convertToTen:true});
 setGrade(f.d,f.l.id,a.id,'8.50');setGrade(f.d,f.g.id,b.id,'6.75');
 const beforeGrades=structuredClone(f.d.grades),beforeAssess=structuredClone(f.d.assessments);
 const pid=linkStudentRecords(f.d,[f.l.id,f.g.id]);
 assert.equal(f.l.personId,pid);assert.equal(f.g.personId,pid);
 assert.equal(linkedStudentFamilies(f.d,'2026-2027').length,1);
 assert.deepEqual(f.d.grades,beforeGrades);assert.deepEqual(f.d.assessments,beforeAssess);
 assertModel(f.d);
});
test('no puede asociarse un alumno de la tutoría A con otro de la B',()=>{
 const f=fixture(),before=structuredClone(f.d);
 assert.throws(()=>linkStudentRecords(f.d,[f.l.id,f.wrong.id]),/tutorías compatibles/);
 assert.deepEqual(f.d,before);
});
test('la interfaz muestra procedencia y asignatura para confirmar la identidad',()=>{
 const f=fixture();
 linkStudentRecords(f.d,[f.l.id,f.g.id]);
 const html=renderStudentLinksManager(f.d,{year:'2026-2027',groupA:f.latin.id,groupB:f.greek.id});
 assert(html.includes('Vínculos confirmados · 1'));
 assert(html.includes('data-unlink-student="'+f.l.id+'"'));
 assert(html.includes('data-unlink-student="'+f.g.id+'"'));
 assert(html.includes('María García L.'));
 assert(html.includes('Griego I'));
 assert(html.includes('Latín I'));
 assert(html.includes('Buscar alumno'));
 assert(html.includes('Vincular fichas seleccionadas'));
});
test('los nombres y los campos de búsqueda escapan contenido HTML no confiable',()=>{
 const f=fixture();
 f.g.name='<img src=x onerror=alert(1)>';
 const html=renderStudentLinksManager(f.d,{year:'2026-2027',groupA:f.latin.id,groupB:f.greek.id,queryA:'"><script>'});
 assert(!html.includes('<img src=x'));
 assert(!html.includes('value=""><script>'));
 assert(html.includes('&lt;script&gt;'));
});
test('la nueva pantalla entra en la PWA offline y su caché coincide con el comprobador',()=>{
 const app=readFileSync(path.join(root,'app.js'),'utf8');
 const worker=readFileSync(path.join(root,'sw.js'),'utf8');
 assert.match(app,/cuaderno-docente-static-v162-dev/);
 assert.match(worker,/cuaderno-docente-static-v162-dev/);
 assert(worker.includes("'./src/student-link-ui.js'"));
});
