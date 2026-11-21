import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initialNotebook,emptyNotebook,assertModel,addGroup,addStudent,addAssessment,setGrade} from '../src/model.js';
import {createVault,unlockVault,saltFromEnvelope} from '../src/vault.js';
import {ensureBookMetadata,createPortableCopy,readBackupFile,compareBookVersions} from '../src/cuaderno.js';
import {overallGrade} from '../src/calculations.js';

test('cuaderno vacío: tres evaluaciones y categorías sin ningún dato académico ficticio',()=>{
  const doc=emptyNotebook();assertModel(doc);
  for(const name of ['groups','students','assessments','grades','competencies','rubrics','finalConfigs','finalOverrides','individualCategoryRules','gradingProfiles'])
    assert.deepEqual(doc[name],[],name);
  assert.deepEqual(doc.periods.map(p=>p.name),['1.ª evaluación','2.ª evaluación','3.ª evaluación']);
  assert.deepEqual(doc.categories.map(c=>[c.name,c.weight]),[['Exámenes',60],['Trabajos',30],['Actitud',10]]);
  assert(doc.planner.years.length===1);
  const year=doc.planner.years[0];
  for(const key of ['slots','events','lessons','holidays','exceptions','tasks'])assert.deepEqual(year[key],[]);
});

test('demostración original permanece intacta y la generación de un cuaderno vacío no la cambia',()=>{
  const demo=initialNotebook(),same=structuredClone(demo);
  assert.equal(demo.groups.length,1);assert.equal(demo.students.length,8);
  assert.equal(demo.assessments.length,4);assert.equal(demo.grades.length,32);
  assert.deepEqual(demo,same);assertModel(demo);
  const blank=emptyNotebook();assertModel(blank);
  assert.deepEqual(demo,same);
  assert.notEqual(blank.id,demo.id);
});

test('cuaderno vacío admite grupos, alumnos, actividades, notas y cálculos correctos',()=>{
  const blank=emptyNotebook(),group=addGroup(blank,'Grupo ficticio','Latín I','2026-2027','1bach');
  const student=addStudent(blank,group.id,'Alumna ficticia');
  const exam=addAssessment(blank,{name:'Examen de prueba',groupId:group.id,periodId:blank.periods[0].id,categoryId:blank.categories[0].id,maxScore:5});
  setGrade(blank,student.id,exam.id,4);
  assertModel(blank);
  assert.equal(overallGrade(blank,student.id,group.id,blank.periods[0].id),8);
});

test('cuaderno vacío conserva datos y estructura tras cifrar, exportar y reabrir',async()=>{
  const password='Una contraseña de prueba robusta 2026!';
  const blank=emptyNotebook();ensureBookMetadata(blank);assertModel(blank);
  const {key,envelope}=await createVault(password,blank);
  const restored=await unlockVault(password,envelope);
  assert.deepEqual(restored.doc,blank);
  const prepared=await createPortableCopy(blank,key,saltFromEnvelope(envelope));
  const bytes=JSON.stringify(prepared.file);
  const reopened=await readBackupFile({size:bytes.length,text:async()=>bytes},password);
  assert.deepEqual(reopened.doc,blank);
  assert.equal(compareBookVersions(blank,reopened.doc),'same');
  await assert.rejects(readBackupFile({size:bytes.length,text:async()=>bytes},'Contraseña de prueba incorrecta 123'),/Contraseña incorrecta|dañados/);
});

test('interfaz: inicio ofrece vacío y demostración, y reinicio exige copia exacta y texto',async()=>{
  const [js,sw]=await Promise.all(['app.js','sw.js'].map(file=>readFile(new URL('../'+file,import.meta.url),'utf8')));
  assert(js.includes('data-create-mode="empty"'));
  assert(js.includes('data-create-mode="demo"'));
  assert(js.includes("creationMode==='demo'?initialNotebook():emptyNotebook()"));
  assert(js.includes('id="reset-notebook"'));
  assert(js.includes('id="reset-notebook-file"'));
  assert(js.includes("opened.legacy||compareBookVersions(previousDoc,opened.doc)!=='same'"));
  assert(js.includes('JSON.stringify(previousDoc)!==JSON.stringify(opened.doc)'));
  assert(js.includes("$('#reset-notebook-phrase',dialog).value!=='REINICIAR'"));
  assert(js.includes('replaceEnvelopeWithRecovery(STATE.db,replacement,previousEnvelope)'));
  assert(js.includes('await readEnvelope(STATE.db),previousEnvelope'));
  const cache=sw.match(/const CACHE='(cuaderno-docente-static-v\d+-dev)'/)?.[1];
  assert(cache,'El service worker debe usar una caché versionada');
  assert(js.includes("caches.open('"+cache+"')"),'La comprobación offline debe usar la misma caché');
});
