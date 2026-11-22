import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  initialNotebook,emptyNotebook,assertModel,addGroup,COURSE_SUBJECTS,SUBJECT_COLORS,
  subjectKey,catalogForNotebook,validSubject,addNotebookSubject,removeNotebookSubject,
  setSubjectAccent
} from '../src/model.js';
import {overallGrade} from '../src/calculations.js';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const defaults=['4eso:Latín 4.º','1bach:Latín I','1bach:Griego I','2bach:Latín II','2bach:Griego II'];
const entries=doc=>catalogForNotebook(doc).flatMap(x=>x.subjects.map(subject=>subjectKey(x.level,subject)));

test('los nuevos cuadernos mantienen exactamente las cinco asignaturas iniciales y sus colores',()=>{
  const doc=emptyNotebook();
  assert.deepEqual(entries(doc),defaults);
  assert.deepEqual(doc.settings.customSubjects,[]);
  assert.deepEqual(doc.settings.hiddenSubjects,[]);
  assert.deepEqual(Object.keys(doc.settings.subjectAccents),Object.keys(SUBJECT_COLORS));
  assert.equal(Object.keys(COURSE_SUBJECTS).length,3);
  assertModel(doc);
});

test('añadir materia libre no modifica notas, grupos ni los colores predeterminados',()=>{
  const doc=initialNotebook(),old=structuredClone(doc.grades),student=doc.students[0],
    group=doc.groups[0],period=doc.periods[0],original=overallGrade(doc,student.id,group.id,period.id);
  addNotebookSubject(doc,'1bach','Historia','#1E6D72');
  addNotebookSubject(doc,'4eso','Atención Educativa','#8F5A9D');
  assert(validSubject('1bach','Historia',doc));
  assert(validSubject('4eso','Atención Educativa',doc));
  assert.equal(doc.settings.subjectAccents['1bach:Historia'],'#1E6D72');
  assert.equal(entries(doc).length,7);
  assert.deepEqual(doc.grades,old);
  assert.equal(overallGrade(doc,student.id,group.id,period.id),original);
  assert.equal(doc.settings.subjectAccents['2bach:Griego II'],'#1D4ED8');
  assertModel(doc);
});

test('materia nueva admite crear grupos con diferentes cursos, sin influir en otros',()=>{
  const doc=emptyNotebook();
  addNotebookSubject(doc,'2bach','Historia del Arte','#336699');
  const group=addGroup(doc,'Grupo 2BA','Historia del Arte','2026-2027','2bach');
  assert.equal(group.subject,'Historia del Arte');
  assert.equal(group.level,'2bach');
  assert.throws(()=>removeNotebookSubject(doc,'2bach','Historia del Arte'),/tiene grupos/);
  assert(doc.groups.some(x=>x.id===group.id));
  assertModel(doc);
});

test('retirar una materia sin grupos no borra la plantilla ni la personalización de las demás',()=>{
  const doc=emptyNotebook(),colors={...doc.settings.subjectAccents};
  removeNotebookSubject(doc,'1bach','Griego I');
  assert(!entries(doc).includes('1bach:Griego I'));
  assert(entries(doc).includes('2bach:Griego II'));
  assert.deepEqual(doc.settings.subjectAccents,colors);
  addNotebookSubject(doc,'1bach','Griego I','#0284C7');
  assert(entries(doc).includes('1bach:Griego I'));
  assertModel(doc);
});

test('materias personalizadas retiradas desaparecen sin dejar colores ajenos',()=>{
  const doc=emptyNotebook();
  addNotebookSubject(doc,'1bach','Cultura Clásica','#3F7E55');
  assert.equal(doc.settings.customSubjects.length,1);
  removeNotebookSubject(doc,'1bach','Cultura Clásica');
  assert(!entries(doc).includes('1bach:Cultura Clásica'));
  assert.equal(doc.settings.subjectAccents['1bach:Cultura Clásica'],undefined);
  assert.equal(doc.settings.customSubjects.length,0);
  assertModel(doc);
});

test('materia con alumnos y notas nunca puede retirarse accidentalmente',()=>{
  const doc=initialNotebook(),old=structuredClone(doc.grades);
  assert.throws(()=>removeNotebookSubject(doc,'1bach','Latín I'),/tiene grupos/);
  assert.deepEqual(doc.grades,old);
  assert(entries(doc).includes('1bach:Latín I'));
  assertModel(doc);
});

test('no se admite un cuaderno sin materias ni nombres sospechosos',()=>{
  const doc=emptyNotebook();
  for(const bad of ['','Mal:Nombre','<script>alert(1)</script>','X'.repeat(66)])
    assert.throws(()=>addNotebookSubject(doc,'1bach',bad),/nombre/i);
  assert.throws(()=>addNotebookSubject(doc,'tercero','Historia'),/Etapa/);
  assert.throws(()=>addNotebookSubject(doc,'1bach','Latín I'),/ya está disponible/);
  const all=entries(doc);
  all.slice(0,-1).forEach(k=>{const p=k.indexOf(':');removeNotebookSubject(doc,k.slice(0,p),k.slice(p+1));});
  assert.throws(()=>removeNotebookSubject(doc,'2bach','Griego II'),/al menos una materia/);
  assertModel(doc);
});

test('el catálogo viejo sin campos opcionales sigue abriéndose sin una migración destructiva',async()=>{
  const {migrateNotebook}=await import('../src/model.js');
  const doc=initialNotebook(),before=structuredClone(doc.grades);
  delete doc.settings.customSubjects;delete doc.settings.hiddenSubjects;
  const {doc:restored,migrated}=migrateNotebook(doc);
  assert.equal(migrated,false);
  assert.deepEqual(entries(restored),defaults);
  assert.deepEqual(restored.grades,before);
  assertModel(restored);
});

test('los nuevos acentos admiten personalización y conservan los cinco por defecto',()=>{
  const doc=emptyNotebook();
  addNotebookSubject(doc,'2bach','Geografía','#557799');
  setSubjectAccent(doc,'2bach','Geografía','#AA33FF');
  assert.equal(doc.settings.subjectAccents['2bach:Geografía'],'#AA33FF');
  assert.equal(doc.settings.subjectAccents['2bach:Latín II'],'#EA580C');
  assertModel(doc);
});

test('el gestor de materias tiene controles interactivos, foco y protección contra borrado con notas',async()=>{
  const app=await read('app.js');
  assert(app.includes('id="manage-subjects"'));
  assert(app.includes('function openSubjectsManager(){'));
  assert(app.includes('data-remove-subject='));
  assert(app.includes("addNotebookSubject(doc,values.level,values.subject,values.color)"));
  assert(app.includes("removeNotebookSubject(doc,level,subject)"));
  assert(app.includes('window.confirm('));
  assert(app.includes("catalogForNotebook(STATE.doc)"));
  assert(app.includes('id="subject-manager-create"'));
  assert(app.includes('autocomplete="off"')||app.includes('subject-manager-fields'));
  assert(app.includes('Gestión')||app.includes('Gestionar materias'));
});

test('la portada presenta ayuda visible con advertencias de seguridad, restauración y guía de notas',async()=>{
 const [app,css]=await Promise.all([read('app.js'),read('styles.css')]);
 assert(app.includes('id="how-it-works"'));
 assert(app.includes("$('#how-it-works').onclick="));
 assert(app.includes('¿Cómo funciona AppNotas?'));
 for(const marker of ['onboarding-guide','NP','AJ','Modo sesión de evaluación','Ajustes → Copias de seguridad cifradas',
  'Verificar copia','Restaurar copia','.cuaderno','dos copias','no es recuperable',
  'No uses información real de alumnado','Atención Educativa'])
  assert(app.includes(marker),'No aparece en la guía: '+marker);
 assert(css.includes('/* v143 · Acceso guiado'));
 assert(css.includes('.unlock-box .unlock-help-primary'));
 assert(css.includes('min-height:56px'));
});

test('la app no usa el catálogo fijo para renderizar los botones de materias',async()=>{
 const app=await read('app.js');
 assert(app.includes('catalogForNotebook(STATE.doc).flatMap'));
 assert(app.includes('validSubject(level,subject,STATE.doc)'));
 assert(app.includes("pairOptions=()=>catalogForNotebook(STATE.doc)"));
});
