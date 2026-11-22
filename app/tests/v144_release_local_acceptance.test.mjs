import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {
 initialNotebook,assertModel,addNotebookSubject,addGroup,setSubjectAccent,setGrade
} from '../src/model.js';
import {overallGrade,finalGrade} from '../src/calculations.js';
import {activeYear,saveSlot,saveTimetableBand,scheduleBands} from '../src/planner.js';
import {createVault,saltFromEnvelope} from '../src/vault.js';
import {
 ensureBookMetadata,markBookChange,createPortableCopy,readBackupFile,
 compareBookVersions
} from '../src/cuaderno.js';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const password='Contraseña larga única para pruebas locales AppNotas 2026';

function createReleaseCandidateBook(){
 const first=initialNotebook();
 ensureBookMetadata(first);
 const doc=structuredClone(first);
 addNotebookSubject(doc,'1bach','Historia','#517AA9');
 addNotebookSubject(doc,'4eso','Atención Educativa','#8567AB');
 const custom=addGroup(doc,'Grupo de Historia','Historia','2026-2027','1bach');
 setSubjectAccent(doc,'1bach','Historia','#316F9C');
 const year=activeYear(doc);
 const band=scheduleBands(year)[0];
 saveSlot(doc,{day:1,start:band.start,end:band.end,type:'class',groupId:custom.id,
   bandId:band.id,room:'Aula 2.15'});
 saveTimetableBand(doc,{...band,start:'08:05'});
 const other=scheduleBands(year)[3];
 saveSlot(doc,{day:2,start:other.start,end:other.end,type:'class',
   label:'Atención Educativa',room:'Biblioteca',bandId:other.id});
 setGrade(doc,doc.students[0].id,doc.assessments[0].id,8.5);
 markBookChange(doc,first);
 assertModel(doc);
 return doc;
}
function gradeSummary(doc){
 return doc.students.map(student=>{
  const group=doc.groups.find(g=>g.id===student.groupId);
  return {
   studentId:student.id,
   period:doc.periods.map(period=>overallGrade(doc,student.id,group.id,period.id)),
   final:finalGrade(doc,student.id,group.id)
  };
 });
}
const makeFile=text=>({size:Buffer.byteLength(text),text:async()=>text});

test('aceptación local: exportar y restaurar en una sesión distinta mantiene materias, aulas y todas las notas',async()=>{
 const original=createReleaseCandidateBook();
 const before=structuredClone(original),scores=gradeSummary(original);
 const {key,envelope}=await createVault(password,original);
 const copy=await createPortableCopy(original,key,saltFromEnvelope(envelope),new Date('2026-11-22T11:00:00.000Z'));
 const bytes=JSON.stringify(copy.file);
 const names=original.students.map(x=>x.name);
 for(const name of names)assert(!bytes.includes(name),'El archivo portable nunca expone nombres legibles');
 assert(!bytes.includes('Historia')&&!bytes.includes('Atención Educativa')&&!bytes.includes('Aula 2.15'));
 const imported=await readBackupFile(makeFile(bytes),password);
 assert.deepEqual(imported.doc,before);
 assert.deepEqual(gradeSummary(imported.doc),scores);
 assert.equal(compareBookVersions(original,imported.doc),'same');
 assert.equal(imported.doc.planner.years[0].slots.length,2);
 assert(imported.doc.planner.years[0].slots.some(x=>x.room==='Aula 2.15'));
 assert(imported.doc.planner.years[0].slots.some(x=>x.label==='Atención Educativa'));
 assert(imported.doc.settings.customSubjects.some(x=>x.subject==='Historia'));
 assert.equal(imported.doc.settings.subjectAccents['1bach:Historia'],'#316F9C');
 assert.deepEqual(original,before,'La exportación no modifica el cuaderno original');
 assertModel(imported.doc);
});

test('aceptación local: contraseña equivocada y archivo alterado no producen restauración parcial',async()=>{
 const doc=createReleaseCandidateBook(),untouched=structuredClone(doc);
 const {key,envelope}=await createVault(password,doc);
 const {file}=await createPortableCopy(doc,key,saltFromEnvelope(envelope));
 const raw=JSON.stringify(file);
 await assert.rejects(readBackupFile(makeFile(raw),'Clave incorrecta 2026 suficientemente larga'));
 const tampered={...file,vault:{...file.vault,data:file.vault.data.slice(0,-8)+'AAAAAAA='}};
 await assert.rejects(readBackupFile(makeFile(JSON.stringify(tampered)),password));
 assert.deepEqual(doc,untouched);
 assertModel(doc);
});

test('aceptación local: contenido docente y configuraciones personales no usan API de red ni conectores cloud',async()=>{
 const paths=['app.js','src/model.js','src/planner.js','src/planner-ui.js','src/vault.js','src/storage.js','src/cuaderno.js'];
 for(const path of paths){
  const content=await read(path);
  assert.doesNotMatch(content,/\bfetch\s*\(|\bXMLHttpRequest\b|\bsendBeacon\s*\(|\bWebSocket\s*\(|\bEventSource\s*\(/,'Sin llamadas de red en '+path);
  assert.doesNotMatch(content,/https?:\/\/[^\s'"`]*?(?:upload|save-notebook|grades|telemetry)/i);
 }
 const index=await read('index.html'),worker=await read('sw.js');
 assert(index.includes("connect-src 'self'"));
 assert(index.includes("script-src 'self'"));
 assert(!/https:\/\/(?:cdn\.|fonts\.|api\.)/.test(index));
 assert(worker.includes("req.method!=='GET'||new URL(req.url).origin!==self.location.origin"));
 const serviceWorkerWrite=worker.match(/self\.addEventListener\('fetch'[\s\S]+/);
 assert(serviceWorkerWrite);
 assert(!serviceWorkerWrite[0].includes('POST'));
});

test('aceptación offline: el service worker precarga todas las dependencias, también horario y rúbricas',async()=>{
 const sw=await read('sw.js');
 const list=sw.match(/const ASSETS=\[([^\]]+)\]/)?.[1];
 assert(list,'Lista de precarga obligatoria');
 const assets=[...list.matchAll(/'\.\/([^']+)'/g)].map(x=>x[1]);
 for(const required of ['index.html','app.js','styles.css','src/model.js','src/planner.js',
  'src/planner-ui.js','src/cuaderno.js','src/storage.js','src/vault.js','src/calculations.js','src/rubric-ui.js'])
  assert(assets.includes(required),'No precargado: '+required);
 for(const path of assets){
  const info=await stat(new URL('../'+path,import.meta.url));
  assert(info.isFile()&&info.size>0,'Dependencia precargada ausente: '+path);
 }
 assert(sw.includes('cache.addAll(ASSETS)'));
 assert(sw.includes('cache.match(req)'));
 assert(sw.includes('SKIP_WAITING'));
});

test('aceptación organización local: guía y exportación prohíben recomendar nubes o sincronización',async()=>{
 const app=await read('app.js');
 for(const visible of ['Solo almacenamiento local autorizado por el centro',
  'No elijas iCloud Drive, OneDrive ni carpetas sincronizadas',
  'En mi iPad','En mi iPhone','dos copias locales',
  'La aplicación no puede detectar si la carpeta elegida se sincroniza'])
  assert(app.includes(visible),'Debe informarse claramente sobre '+visible);
 const snippet=app.slice(app.indexOf('async function closeNotebook(){'),app.indexOf('function preparedSaveCompleted(){'));
 assert(!snippet.includes('Selecciona una carpeta de OneDrive institucional'));
 assert(snippet.includes('El cuaderno local permanece intacto aunque canceles'));
 assert(app.includes("$('#backup-verify')"));
});
