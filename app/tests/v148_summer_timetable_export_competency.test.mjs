import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initialNotebook,assertModel,addGroup} from '../src/model.js';
import {overallGrade,competencyAcquisitionLevel} from '../src/calculations.js';
import {
 DEFAULT_TIMETABLE_BANDS,SUMMER_TIMETABLE_BANDS,activeYear,activeScheduleMode,
 setSummerSchedule,slotsForMode,scheduleBands,saveSlot,saveTimetableBand,removeTimetableBand,
 assertPlanner,addAcademicYear
} from '../src/planner.js';
import {renderPlanner,renderTimetableGrid} from '../src/planner-ui.js';
import {timetableRows,timetableDocxXml,timetablePdfBytes,timetableWordBlob,timetableFileBase} from '../src/timetable-export.js';
import {createVault,saltFromEnvelope} from '../src/vault.js';
import {ensureBookMetadata,markBookChange,createPortableCopy,readBackupFile} from '../src/cuaderno.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const fixture=()=>{const doc=initialNotebook();return {doc,year:activeYear(doc),group:doc.groups[0],st:doc.students[0],period:doc.periods[0]};};
const PASS='Clave de prueba de horario verano suficientemente larga';

test('horario de verano: 7 clases de 45 min y 1 patio de 30 min, salida 13:45',()=>{
 const {doc,year}=fixture();
 assert.equal(scheduleBands(year).length,9);
 assert.equal(DEFAULT_TIMETABLE_BANDS.at(-1).end,'15:15');
 assert.deepEqual(SUMMER_TIMETABLE_BANDS.map(b=>[b.id,b.start,b.end,b.kind]),[
 ['hora-1','08:00','08:45','lesson'],
 ['hora-2','08:45','09:30','lesson'],
 ['hora-3','09:30','10:15','lesson'],
 ['patio-1','10:15','10:45','break'],
 ['hora-4','10:45','11:30','lesson'],
 ['hora-5','11:30','12:15','lesson'],
 ['hora-6','12:15','13:00','lesson'],
 ['hora-7','13:00','13:45','lesson']]);
 assert.equal(setSummerSchedule(doc,true),'summer');
 assert.equal(scheduleBands(year).length,8);
 assert.equal(scheduleBands(year).at(-1).end,'13:45');
 assert(!scheduleBands(year).some(b=>b.id==='patio-2'));
 assert.equal(setSummerSchedule(doc,false),'regular');
 assert.equal(scheduleBands(year).length,9);
 assertModel(doc);
});

test('el toggle copia las siete clases sin borrar el horario ordinario ni tocar notas',()=>{
 const {doc,year,group,st,period}=fixture();
 const originalNote=overallGrade(doc,st.id,group.id,period.id),grades=structuredClone(doc.grades);
 for(const band of scheduleBands(year).filter(b=>b.kind==='lesson')){
  saveSlot(doc,{day:0,start:band.start,end:band.end,type:'class',groupId:group.id,
   bandId:band.id,room:'Aula '+band.id});
 }
 const normal=structuredClone(slotsForMode(year));
 assert.equal(normal.length,7);
 setSummerSchedule(doc,true);
 const summer=slotsForMode(year);
 assert.equal(summer.length,7);
 assert(summer.some(s=>s.bandId==='hora-7'&&s.start==='13:00'&&s.end==='13:45'));
 assert(summer.every(s=>s.scheduleMode==='summer'));
 assert(summer.some(s=>s.bandId==='hora-6'&&s.start==='12:15'&&s.end==='13:00'));
 assert(summer.every(s=>!normal.some(n=>n.id===s.id)));
 assert.equal(overallGrade(doc,st.id,group.id,period.id),originalNote);
 assert.deepEqual(doc.grades,grades);
 setSummerSchedule(doc,false);assert.deepEqual(slotsForMode(year),normal);
 setSummerSchedule(doc,true);assert.equal(slotsForMode(year).length,7,'No duplica sesiones al volver');
 assertModel(doc);
});

test('un día y franja admiten una sola clase o guardia; distintos horarios son independientes',()=>{
 const {doc,year,group}=fixture(),band=scheduleBands(year)[0];
 const saved=saveSlot(doc,{day:0,start:band.start,end:band.end,type:'class',groupId:group.id,bandId:band.id});
 assert.throws(()=>saveSlot(doc,{day:0,start:band.start,end:band.end,type:'guardia',label:'Guardia'}),/ya tiene una clase/);
 assert.throws(()=>saveSlot(doc,{day:0,start:'08:10',end:'08:40',type:'class',label:'Otra'}),/ya tiene una clase/);
 saveSlot(doc,{day:1,start:band.start,end:band.end,type:'guardia',label:'Guardia',bandId:band.id,color:'#9F6DA1'});
 assert.equal(slotsForMode(year).length,2);
 const grid=renderTimetableGrid(doc,year);
 assert(!grid.includes('+ Otra clase'));
 assert.equal((grid.match(/data-band-slot="hora-1" data-band-day="0"/g)||[]).length,0);
 assert(grid.includes('data-edit-slot="'+saved.id+'"'));
 setSummerSchedule(doc,true);
 assert.equal(slotsForMode(year).length,2);
 const firstSummer=scheduleBands(year)[0];
 assert.throws(()=>saveSlot(doc,{day:0,start:firstSummer.start,end:firstSummer.end,type:'class',label:'Duplicado',bandId:firstSummer.id}),/ya tiene una clase/);
 saveSlot(doc,{day:2,start:firstSummer.start,end:firstSummer.end,type:'guardia',label:'Extra',bandId:firstSummer.id});
 assertModel(doc);
});

test('las guardias y materias manuales validan color y mantienen el mismo al editarse',()=>{
 const {doc,year}=fixture(),band=scheduleBands(year)[2];
 assert.throws(()=>saveSlot(doc,{day:1,start:band.start,end:band.end,type:'guardia',color:'red'}),/Color/);
 assert.throws(()=>saveSlot(doc,{day:1,start:band.start,end:band.end,type:'guardia',color:'red;--x:0'}),/Color/);
 const s=saveSlot(doc,{day:1,start:band.start,end:band.end,type:'guardia',room:'Biblioteca',bandId:band.id,color:'#aB34f0'});
 assert.equal(s.color,'#AB34F0');
 assert(renderTimetableGrid(doc,year).includes('data-planner-color="#AB34F0"'));
 const current=saveSlot(doc,{...s,label:'Guardia de patio',color:'#CC6633'});
 assert.equal(current.color,'#CC6633');
 assertModel(doc);
});

test('editar una franja de verano no altera horas ni aulas del horario ordinario',()=>{
 const {doc,year,group}=fixture(),band=scheduleBands(year)[0];
 const original=saveSlot(doc,{day:0,start:band.start,end:band.end,type:'class',groupId:group.id,bandId:band.id,room:'2.15'});
 setSummerSchedule(doc,true);const summerBand=scheduleBands(year)[0],summerSlot=slotsForMode(year)[0];
 saveTimetableBand(doc,{...summerBand,start:'08:05'});
 assert.equal(summerSlot.start,'08:05');
 assert.equal(original.start,'08:00');
 assert.equal(original.room,'2.15');assert.equal(summerSlot.room,'2.15');
 setSummerSchedule(doc,false);assert.equal(scheduleBands(year)[0].start,'08:00');
 assertModel(doc);
});

test('copiar curso conserva tanto horario normal como verano sin modificar el origen',()=>{
 const {doc,year,group}=fixture(),normal=scheduleBands(year)[0];
 saveSlot(doc,{day:2,start:normal.start,end:normal.end,bandId:normal.id,type:'class',groupId:group.id});
 setSummerSchedule(doc,true);
 const old=structuredClone(year),n=group.course;
 const replacement=addGroup(doc,'Segunda clase',group.subject,'2027-2028',group.level);
 const other=addAcademicYear(doc,{name:'2027-2028',start:'2027-09-01',end:'2028-06-30',copyFrom:year.id});
 assert.equal(other.slots.length,2);
 assert.equal(other.slots.filter(s=>s.scheduleMode==='summer').length,1);
 assert.equal(other.slots.filter(s=>s.scheduleMode==='regular').length,1);
 assert(other.slots.every(s=>s.groupId===null||s.groupId===replacement.id));
 assert.equal(other.summerEnabled,true);
 assert.equal(scheduleBands(other).at(-1).end,'13:45');
 assert.deepEqual(year,old);
 assertModel(doc);
});

test('Word y PDF contienen horas, días y colores del horario activo sin notas de alumnos',async()=>{
 const {doc,year,st}=fixture();
 const band=scheduleBands(year)[0];
 saveSlot(doc,{day:0,start:band.start,end:band.end,bandId:band.id,type:'guardia',label:'Guardia de biblioteca',color:'#7124AB'});
 const ordinary=timetableRows(doc,year);
 assert.equal(ordinary.length,9);
 assert.equal(ordinary[0].cells[0].slots[0].color,'#7124AB');
 assert.equal(ordinary[0].cells[0].slots[0].label,'Guardia de biblioteca');
 const xml=timetableDocxXml(doc,year);
 assert(xml.includes('wordprocessingml/2006/main'));
 assert(xml.includes('Guardia de biblioteca'));
 assert(xml.includes('08:00–08:55'));
 assert(!xml.includes(st.name));
 const pdf=timetablePdfBytes(doc,year),head=Buffer.from(pdf).toString('latin1');
 assert(head.startsWith('%PDF-1.4'));
 assert(head.includes('xref\n0 6'));
 assert(head.endsWith('%%EOF'));
 assert(head.includes('08:00'));
 assert(!head.includes(st.name));
 assert.equal(timetableFileBase(year).endsWith('-ordinario'),true);
 class FakeZip {constructor(){this.files=new Map();}file(name,content){this.files.set(name,content);}async generateAsync(opts){assert.equal(opts.compression,'DEFLATE');return new Blob([...this.files.values()]);}}
 const zip=await timetableWordBlob(doc,year,FakeZip);
 assert(zip.size>200);
 setSummerSchedule(doc,true);
 assert.equal(timetableRows(doc,year).length,8);
 assert.equal(timetableFileBase(year).endsWith('-verano'),true);
 assert(timetableDocxXml(doc,year).includes('13:00–13:45'));
 assert(Buffer.from(timetablePdfBytes(doc,year)).toString('latin1').includes('13:45'));
 assertModel(doc);
});

test('la copia cifrada conserva colores, horarios alternativos y todas las notas',async()=>{
 const {doc,year,group,st,period}=fixture(),band=scheduleBands(year)[0];
 ensureBookMetadata(doc);
 const beforeChanges=structuredClone(doc);
 saveSlot(doc,{day:0,start:band.start,end:band.end,bandId:band.id,type:'guardia',color:'#AA3366'});
 setSummerSchedule(doc,true);
 const summer=scheduleBands(year)[0];saveSlot(doc,{day:1,start:summer.start,end:summer.end,bandId:summer.id,type:'class',groupId:group.id});
 markBookChange(doc,beforeChanges);
 const copy=structuredClone(doc),before=overallGrade(doc,st.id,group.id,period.id);
 const {key,envelope}=await createVault(PASS,doc);
 const zipped=await createPortableCopy(doc,key,saltFromEnvelope(envelope));
 const file={size:Buffer.byteLength(JSON.stringify(zipped.file)),text:async()=>JSON.stringify(zipped.file)};
 const restored=await readBackupFile(file,PASS);
 assert.deepEqual(restored.doc,copy);
 assert.equal(overallGrade(restored.doc,st.id,group.id,period.id),before);
 assertModel(restored.doc);
});

test('UI accesible, formularios, exportación offline y criterios de CE al ponderar',()=>{
 const app=read('app.js'),ui=read('src/planner-ui.js'),css=read('styles.css'),sw=read('sw.js');
 assert(ui.includes('id="plan-summer-toggle"'));
 assert(ui.includes('role="switch"'));
 assert(ui.includes('setSummerSchedule(d,enabled)'));
 assert(ui.includes("id:'color',label:'Color de esta sesión"));
 assert(ui.includes('id="plan-export-word"')&&ui.includes('id="plan-export-pdf"'));
 assert(ui.includes("timetableWordBlob(d,yr,window.JSZip)"));
 assert(ui.includes("timetablePdfBytes(d,yr)"));
 assert(!ui.includes("'+ Otra clase'"));
 assert(css.includes('.planner-summer-switch')&&css.includes('.planner-word-action')&&css.includes('.planner-pdf-action'));
 assert(app.includes("competencyLevelChip(score,'Media aritmética')"));
 assert(app.includes("' competency-mean-source'"));
 assert(app.includes('criteriaFor(ce)'));
 assert(app.includes('comp-linked-criteria'));
 assert(app.includes('criterios de evaluación oficiales incorporados'));
 assert(sw.includes("'./src/timetable-export.js'"));
 assert(app.includes("'./src/timetable-export.js'"));
 assert(!ui.includes('fetch('));
 assertModel(initialNotebook());
});

test('compatibilidad: cuaderno de vista previa con 6 clases de verano recibe séptima franja sin perder horarios ni notas',()=>{
 const {doc,year,group,st,period}=fixture();
 const regular=scheduleBands(year,'regular').find(b=>b.id==='hora-7');
 const original=saveSlot(doc,{day:3,start:regular.start,end:regular.end,type:'class',groupId:group.id,room:'Aula 7',bandId:regular.id});
 setSummerSchedule(doc,true);
 const summerSeventh=slotsForMode(year).find(s=>s.day===3&&s.bandId==='hora-7');
 assert.equal(summerSeventh.start,'13:00');
 assert.equal(summerSeventh.end,'13:45');
 // Simula el formato de la primera vista previa: aún no existía la 7.ª hora.
 year.summerBands=structuredClone(SUMMER_TIMETABLE_BANDS.slice(0,-1));
 delete year.summerBandVersion;
 year.slots=year.slots.filter(s=>s.id!==summerSeventh.id);
 year.summerInitialized=true;
 const previous=overallGrade(doc,st.id,group.id,period.id);
 const grades=structuredClone(doc.grades);
 const beforeRegular=structuredClone(slotsForMode(year,'regular'));
 assert.equal(scheduleBands(year,'summer').length,8,'La vista previa antigua se amplía en lectura');
 setSummerSchedule(doc,false);
 setSummerSchedule(doc,true);
 const upgraded=slotsForMode(year).find(s=>s.day===3&&s.bandId==='hora-7');
 assert(upgraded);
 assert.equal(upgraded.room,'Aula 7');
 assert.equal(upgraded.start,'13:00');
 assert.equal(upgraded.end,'13:45');
 assert.notEqual(upgraded.id,original.id);
 assert.equal(year.summerBandVersion,2);
 assert.deepEqual(slotsForMode(year,'regular'),beforeRegular);
 assert.equal(overallGrade(doc,st.id,group.id,period.id),previous);
 assert.deepEqual(doc.grades,grades);
 assertModel(doc);
});
test('eliminar deliberadamente la 7.ª hora de verano no la recrea ni afecta al horario normal',()=>{
 const {doc,year}=fixture();
 setSummerSchedule(doc,true);
 const seven=scheduleBands(year,'summer').find(b=>b.id==='hora-7');
 assert(seven);
 removeTimetableBand(doc,seven.id);
 assert.equal(scheduleBands(year,'summer').length,7);
 assert.equal(scheduleBands(year,'summer').at(-1).end,'13:00');
 assert.equal(year.summerBandVersion,2);
 setSummerSchedule(doc,false);
 assert.equal(scheduleBands(year).length,9);
 setSummerSchedule(doc,true);
 assert.equal(scheduleBands(year).length,7);
 assertModel(doc);
});
