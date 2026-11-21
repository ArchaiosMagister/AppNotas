import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseCsv,namesFromCsv} from '../src/csv.js';
import {parseRubricImport} from '../src/rubric-import.js';
import {parseRubricXlsx} from '../src/rubric-xlsx.js';
import {initialNotebook,assertModel,addGroup,addAssessment,addStudent,setGrade,setOrthographyGrade,updateAssessment,renamePeriod,renameStudent,updateGroupInfo,setSubjectAccent} from '../src/model.js';
import {saveTask,saveHoliday,saveSlot,saveLesson,saveEvent} from '../src/planner.js';
import {overallGrade,finalGrade} from '../src/calculations.js';

const clone=structuredClone;
function fakeNode(text,attrs={}){
 return {textContent:text,getAttribute:key=>attrs[key]??null,getElementsByTagName(tag){
  const re=new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)<\\/${tag}>`,'gi');
  return [...text.matchAll(re)].map(m=>fakeNode(m[2],Object.fromEntries([...m[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(x=>[x[1],x[2]]))));
 }};
}
class MiniParser {parseFromString(xml){return fakeNode(xml);}}
const cell=(name,row,value)=>`<c r="${name}${row}" t="inlineStr"><is><t>${value}</t></is></c>`;
const sheet=rows=>`<?xml version="1.0"?><worksheet><sheetData>${rows.map((r,i)=>`<row r="${i+1}">${r.map(([name,value])=>cell(name,i+1,value)).join('')}</row>`).join('')}</sheetData></worksheet>`;
async function fromXml(xml){
 const name='xl/worksheets/sheet1.xml';
 const zip={files:{[name]:{}},file:n=>n===name?{_data:{uncompressedSize:xml.length},async:async()=>xml}:null};
 return parseRubricXlsx(new ArrayBuffer(4),'Rubrica.xlsx',{loadAsync:async()=>zip},MiniParser);
}

test('v1.11: el delimitador CSV se detecta fuera de las comillas, también con salto de línea citado',()=>{
 assert.deepEqual(parseCsv('nombre;grupo;observaciones\n"Ana, María";A;"Texto, con comas"\nLuis;B;ok'),[
  ['nombre','grupo','observaciones'],['Ana, María','A','Texto, con comas'],['Luis','B','ok']
 ]);
 assert.deepEqual(namesFromCsv('nombre;grupo\n"Ana, María";A\nLuis;B'),['Ana, María','Luis']);
 assert.deepEqual(parseCsv('nombre;grupo\n"Ana\nMaría";A'),[['nombre','grupo'],['Ana\nMaría','A']]);
});

test('v1.11: importar alumnos no omite silenciosamente filas con datos y nombre vacío',()=>{
 assert.throws(()=>namesFromCsv('nombre;grupo\nAna;A\n;B\nLuis;A'),/fila 3|sin nombre/i);
 assert.deepEqual(namesFromCsv('nombre;grupo\nAna;A\n\nLuis;A'),['Ana','Luis']);
});

test('v1.11: un nivel JSON sin puntuación explícita no se convierte silenciosamente en 0',()=>{
 const base={name:'Prueba',criteria:[{name:'Criterio',maxScore:2,weight:1,levels:[{score:2,label:'Bien',description:'Bien'},{score:0,label:'Mal',description:'Mal'}]}]};
 for(const missing of [{label:'Mal',description:'Mal'},{score:null,label:'Mal',description:'Mal'},{score:'',label:'Mal',description:'Mal'},{score:'  ',label:'Mal',description:'Mal'}]){
  const bad=clone(base);bad.criteria[0].levels[1]=missing;
  assert.throws(()=>parseRubricImport(JSON.stringify(bad),'prueba.json'),/sin puntuaci[oó]n/i);
 }
 assert.equal(parseRubricImport(JSON.stringify(base),'prueba.json').criteria[0].levels[1].score,0);
});

test('v1.11: Excel de máximos rechaza criterios omitidos que tengan valores en otras columnas',async()=>{
 const xml=sheet([[['A','Criterio'],['B','Máximo'],['C','Peso']],[['A','Participación'],['B','2'],['C','20']],[['B','3'],['C','30']]]);
 await assert.rejects(fromXml(xml),/sin nombre/i);
});

test('v1.11: Excel de niveles rechaza descriptores sin criterio asociado',async()=>{
 const xml=sheet([[['A','Criterio y peso'],['B','Bien 2'],['C','Mal 0']],[['A','Participación 50%'],['B','Participa'],['C','No participa']],[['B','Se comporta bien']]]);
 await assert.rejects(fromXml(xml),/sin nombre/i);
});

test('v1.11: Excel válido sigue importándose íntegro con todos los criterios',async()=>{
 const xml=sheet([[['A','Criterio'],['B','Máximo'],['C','Peso']],[['A','Participación'],['B','2'],['C','20']],[['A','Puntualidad'],['B','3'],['C','30']]]);
 const out=await fromXml(xml);
 assert.deepEqual(out.criteria.map(x=>[x.name,x.maxScore,x.weight]),[['Participación',2,20],['Puntualidad',3,30]]);
});

test('v1.11: cambiar un ajuste ortográfico no puede deshacer entregas confirmadas de alumnos',()=>{
 const d=initialNotebook(),g=d.groups[0],p=d.periods[0],s=d.students[0];
 const exam=addAssessment(d,{name:'Prueba',groupId:g.id,periodId:p.id,categoryId:d.categories[0].id,orthography:{enabled:true,refundable:true,penaltyPerFault:.1,repetitions:30}});
 setOrthographyGrade(d,s.id,exam.id,{score:8.75,faults:4,delivered:true});
 const snapshot=clone(d),before=overallGrade(d,s.id,g.id,p.id);
 assert.throws(()=>updateAssessment(d,exam.id,{orthography:{enabled:true,refundable:false,penaltyPerFault:.1,repetitions:30}}),/entregadas/i);
 assert.deepEqual(d,snapshot);
 assert.equal(overallGrade(d,s.id,g.id,p.id),before);
 assertModel(d);
});

test('v1.11: editor no debe revocar las entregas en bloque en una operación de configuración',()=>{
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert.match(app,/Desm[aá]rcalas individualmente/);
 assert.doesNotMatch(app,/if\(!orthography\.refundable\)d\.grades\.filter\(/);
 assert.doesNotMatch(app,/g\.orthographyDelivered\s*=\s*false/);
});

test('v1.11: operaciones ajenas de agenda, apariencia y nombres preservan exactamente las calificaciones y medias',()=>{
 for(let i=1;i<=100;i++){
  const d=initialNotebook(),g=d.groups[0],p=d.periods[0],s=d.students[0];
  const other=addGroup(d,'Otro','Griego I','2026-2027','1bach'),otherStudent=addStudent(d,other.id,'Otro');
  const a=addAssessment(d,{name:'Examen de otro grupo',groupId:other.id,periodId:p.id,categoryId:d.categories[0].id,orthography:null});
  setGrade(d,otherStudent.id,a.id,Math.round((i*0.093%10)*100)/100);
  const grades=clone(d.grades),firstScore=overallGrade(d,s.id,g.id,p.id),otherScore=overallGrade(d,otherStudent.id,other.id,p.id);
  const annual=finalGrade(d,s.id,g.id),otherAnnual=finalGrade(d,otherStudent.id,other.id);
  renameStudent(d,s.id,`Alumno revisado ${i}`);renamePeriod(d,p.id,`Periodo revisado ${i}`);
  updateGroupInfo(d,g.id,`Curso renombrado ${i}`,g.course);
  setSubjectAccent(d,'1bach','Latín I',`#${i.toString(16).padStart(6,'0')}`);
  saveTask(d,{title:`Tarea ${i}`,dueDate:'2026-11-23',groupId:g.id});
  saveHoliday(d,{name:`Fiesta ${i}`,start:'2026-12-07'});
  const sl=saveSlot(d,{day:2,start:'10:00',end:'10:55',type:'class',groupId:g.id});
  saveLesson(d,{date:'2026-11-25',slotId:sl.id,groupId:g.id,planned:'Texto latino'});
  assert.deepEqual(d.grades,grades);
  assert.equal(overallGrade(d,s.id,g.id,p.id),firstScore);
  assert.equal(overallGrade(d,otherStudent.id,other.id,p.id),otherScore);
  assert.equal(finalGrade(d,s.id,g.id),annual);
  assert.equal(finalGrade(d,otherStudent.id,other.id),otherAnnual);
  assertModel(d);
 }
});

test('v1.11: CSV mal formado no concatena basura a nombres ni cambia la lista de alumnos',()=>{
 for(const input of ['nombre;grupo\n"Ana"error;A','nombre;grupo\n"Ana"  otra;A']){
  assert.throws(()=>namesFromCsv(input),/mal formado/i);
 }
 assert.deepEqual(namesFromCsv('nombre;grupo\n"Ana"  ;A'),['Ana']);
 assert.deepEqual(namesFromCsv('nombre;grupo\n"Ana""extra";A'),['Ana"extra']);
});

test('v1.11: los niveles y máximos de una rúbrica nueva no pueden exigir más de dos decimales',async()=>{
 const {createRubric}=await import('../src/model.js');
 const good={name:'Actitud',maxScore:2,weight:20,levels:[{score:2,label:'Bien',description:'Bien'},{score:0,label:'Mal',description:'Mal'}]};
 const d=initialNotebook(),original=clone(d);
 for(const bad of [
  {...good,maxScore:2.125,levels:[{score:2.125,label:'Bien',description:''},{score:0,label:'Mal',description:''}]},
  {...good,levels:[{score:2,label:'Bien',description:''},{score:0.125,label:'Mal',description:''}]}
 ]){
  assert.throws(()=>createRubric(d,'Nota inválida',[bad]),/dos decimales/i);
  assert.deepEqual(d,original);
 }
 const goodRubric=createRubric(d,'Nota válida',[good]);
 assert.equal(goodRubric.criteria[0].maxScore,2);
 assertModel(d);
});

test('v1.11: JSON y Excel rechazan rúbricas que el editor no puede puntuar con dos decimales',async()=>{
 const badJson={name:'Notas',criteria:[{name:'Criterio',maxScore:2.123,levels:[{score:2.123,label:'Bien',description:'Bien'},{score:0,label:'Mal',description:'Mal'}]}]};
 assert.throws(()=>parseRubricImport(JSON.stringify(badJson),'prueba.json'),/dos decimales/i);
 const xml=sheet([[['A','Criterio'],['B','Máximo'],['C','Peso']],[['A','Presentación'],['B','2.125'],['C','1']]]);
 await assert.rejects(fromXml(xml),/dos decimales/i);
});

test('v1.11: editar una rúbrica inexistente o con criterios inválidos no modifica la copia original',async()=>{
 const {createRubric,updateRubric}=await import('../src/model.js');
 const d=initialNotebook();
 const r=createRubric(d,'Corrección',[{name:'Contenido',maxScore:2,weight:1}]);
 const before=clone(d);
 assert.throws(()=>updateRubric(d,r.id,'Cambio',[{name:'Nuevo',maxScore:1.123,weight:1}]),/dos decimales/i);
 assert.deepEqual(d,before);
});

test('v1.11: los períodos copiados no comparten referencias ocultas de penalización ortográfica',async()=>{
 const {copyPeriodAssessments}=await import('../src/model.js');
 const d=initialNotebook(),g=d.groups[0],p=d.periods[0],destination=d.periods[1],s=d.students[0];
 const orth={enabled:true,refundable:true,penaltyPerFault:.1,repetitions:30};
 const exam=addAssessment(d,{name:'Examen de prueba',groupId:g.id,periodId:p.id,categoryId:d.categories[0].id,orthography:orth});
 const snapshot=clone(d);
 // La modificación posterior del objeto de entrada no puede alterar el cuaderno.
 orth.penaltyPerFault=.5;
 assert.deepEqual(d,snapshot);
 copyPeriodAssessments(d,g.id,p.id,[destination.id]);
 const copied=d.assessments.find(a=>a.groupId===g.id&&a.periodId===destination.id&&a.name===exam.name);
 assert.ok(copied);
 assert.notStrictEqual(copied.orthography,exam.orthography);
 copied.orthography.penaltyPerFault=.2;
 assert.equal(exam.orthography.penaltyPerFault,.1);
 assertModel(d);
});

test('v1.11: editar opciones de actividad no retiene referencias mutables del formulario',()=>{
 const d=initialNotebook(),a=d.assessments[0];
 const config={enabled:true,refundable:true,penaltyPerFault:.1,repetitions:30};
 updateAssessment(d,a.id,{orthography:config});
 const saved=clone(d);
 config.penaltyPerFault=.9;config.refundable=false;
 assert.deepEqual(d,saved);
 assertModel(d);
});

test('v1.11: evaluación final no retiene arrays del llamador que puedan reescribirse al margen del guardado',async()=>{
 const {setFinalConfig}=await import('../src/model.js');
 const d=initialNotebook(),g=d.groups[0],p=d.periods[0];
 const exclusions=[p.id];
 setFinalConfig(d,g.id,{excludedPeriodIds:exclusions});
 const frozen=clone(d);
 exclusions.length=0;exclusions.push('otro-periodo');
 assert.deepEqual(d,frozen);
 assertModel(d);
});

test('v1.11: restaurar agenda inconsistente nunca convierte una guardia en clase ni otro evento en examen',()=>{
 const d=initialNotebook(),g=d.groups[0],a=d.assessments[0];
 const slot=saveSlot(d,{day:0,start:'08:00',end:'08:55',type:'guardia'});
 const invalid=clone(d);
 invalid.planner.years[0].slots[0].groupId=g.id;
 assert.throws(()=>assertModel(invalid),/Horario inv[aá]lido/i);
 const evt=saveEvent(d,{date:'2026-11-23',type:'exam',title:'Examen UD1',groupId:g.id,assessmentId:a.id,time:'08:00'});
 const other=clone(d);
 other.planner.years[0].events.find(e=>e.id===evt.id).type='meeting';
 assert.throws(()=>assertModel(other),/Evento inv[aá]lido/i);
 assertModel(d);
});
