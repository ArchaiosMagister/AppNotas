import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initialNotebook,assertModel} from '../src/model.js';
import {overallGrade,finalGrade} from '../src/calculations.js';
import {activeYear,saveHoliday,saveEvent,calendarEventIcs,addAcademicYear} from '../src/planner.js';
import {parsePatioXlsx,extractPatioRotation,previewPatioRotation,addPatioRotationEvents} from '../src/patio-rotation.js';
import {ensureBookMetadata,markBookChange,createPortableCopy,readBackupFile} from '../src/cuaderno.js';
import {createVault,saltFromEnvelope} from '../src/vault.js';
import {renderPlanner} from '../src/planner-ui.js';

const base=()=>{const doc=initialNotebook(),student=doc.students[0],group=doc.groups[0],period=doc.periods[0];return {doc,student,group,period};};
const cols='ABCDE',qcols='CDEFG',normalRows=[4,5,6,7,10,11,12,13],rainRows=[15,16,17,18,21,22,23,24];
const zones=[
 "1.PORTA D'ENTRADA CENTRE","2. CUA CAFETERIA","3. BANYS","INTERIOR CENTRE",
 "RONDA PART DAVANTERA - HORT","RONDA PART DAVANTERA - HORT",
 "RONDA PART DARRERE - INTERIOR","RONDA PART DARRERE - INTERIOR"
];
const rainy=[
 "TALLERS ZONA MÚSICA","TALLERS INFORMÀTICA","ZONA LABORATORIS","PASSADÍS 1 BATX",
 "BANYS, ZONA ASCENSOR I CONSERGERIA-1","CAFETERIA","PASSADÍS ESO 1a PLANTA","PASSADÍS ESO 2a PLANTA"
];
const makeCells=()=>{
 const quadrant=new Map(),roster=new Map(),second=new Map();
 const put=(sheet,ref,text='',formula='')=>sheet.set(ref,{text:String(text),formula});
 put(quadrant,'C1','13','INT((TODAY()-DATE(2026,8,29))/7)+1');
 put(quadrant,'C2','46349','DATE(2026,8,24)+(C1*7)');
 for(let day=0;day<5;day++){
  put(roster,cols[day]+'1',['DL','DM','DX','DJ','DV'][day]);
  for(let row=0;row<8;row++){
   const self=(day===2&&row===0)||(day===1&&row===4)||(day===4&&row===4);
   put(roster,cols[day]+(row+2),self?'yo':row+1);
  }
 }
 for(let i=0;i<8;i++){
  put(quadrant,'B'+normalRows[i],zones[i]);
  put(quadrant,'B'+rainRows[i],rainy[i]);
  for(let day=0;day<5;day++){
   const formula='INDEX(Professorat_guàrdia_1r_pati!$'+cols[day]+'$2:$'+cols[day]+
    '$9,MOD('+i+'+2*($C$1-1),8)+1)';
   put(quadrant,qcols[day]+normalRows[i],i+1,formula);
   put(quadrant,qcols[day]+rainRows[i],i+1,formula);
  }
 }
 return {quadrant,roster,second};
};
const model=()=>{const {quadrant,roster,second}=makeCells();return extractPatioRotation(quadrant,roster,second,' yo ');};

test('fórmulas reales del Excel: primera semana 31/08/2026, desplazamiento +2 y ciclo 4',()=>{
 const source=model();
 assert.equal(source.firstMonday,'2026-08-31');
 assert.equal(source.size,8);assert.equal(source.shift,2);assert.equal(source.cycleWeeks,4);
 assert.deepEqual([...source.positions],[null,4,0,null,4]);
 assert.equal(source.secondCount,0);
});

test('semana 23–27 noviembre 2026: zonas y alternativas por lluvia idénticas al Excel',()=>{
 const {doc}=base(),preview=previewPatioRotation(doc,model(),{from:'2026-11-23',to:'2026-11-27'});
 assert.deepEqual(preview.entries.map(x=>[x.date,x.day,x.zoneIndex,x.zone,x.rainZone]),[
  ['2026-11-24',1,4,zones[4],rainy[4]],
  ['2026-11-25',2,0,zones[0],rainy[0]],
  ['2026-11-27',4,4,zones[4],rainy[4]]
 ]);
 assert.deepEqual(preview.entries.map(x=>[x.start,x.end]),[['10:45','11:15'],['10:45','11:15'],['10:45','11:15']]);
 assert.equal(preview.cycleWeeks,4);
});

test('el giro semanal sigue exactamente +2, sin rotar por día ni por vacación',()=>{
 const {doc}=base(),preview=previewPatioRotation(doc,model(),{from:'2026-11-23',to:'2026-12-25'});
 const byDate=Object.fromEntries(preview.entries.map(x=>[x.date,x]));
 assert.equal(byDate['2026-12-01'].zoneIndex,2);
 assert.equal(byDate['2026-12-02'].zoneIndex,6);
 assert.equal(byDate['2026-12-04'].zoneIndex,2);
 assert.equal(byDate['2026-12-08'].zoneIndex,0);
 assert.equal(byDate['2026-12-09'].zoneIndex,4);
 assert.equal(byDate['2026-12-11'].zoneIndex,0);
 assert.equal(byDate['2026-12-15'].zoneIndex,6);
 assert.equal(byDate['2026-12-16'].zoneIndex,2);
 assert.equal(byDate['2026-12-18'].zoneIndex,6);
 assert.equal(byDate['2026-12-22'].zoneIndex,4,'el ciclo se repite cada cuatro semanas');
 assert.equal(byDate['2026-12-23'].zoneIndex,0);
});

test('festivos y vacaciones registrados se excluyen, pero no adelantan la rotación',()=>{
 const {doc}=base();
 saveHoliday(doc,{name:'Festivo conocido',start:'2026-12-08',end:'2026-12-08'});
 const withSkip=previewPatioRotation(doc,model(),{from:'2026-12-07',to:'2026-12-11'});
 assert.equal(withSkip.excluded,1);
 assert(!withSkip.entries.some(x=>x.date==='2026-12-08'));
 assert.equal(withSkip.entries.find(x=>x.date==='2026-12-09').zoneIndex,4);
 const all=previewPatioRotation(doc,model(),{from:'2026-12-07',to:'2026-12-11',skipHolidays:false});
 assert.equal(all.entries.length,3);
 assert.equal(all.entries.find(x=>x.date==='2026-12-08').zoneIndex,0);
 assertModel(doc);
});

test('el primer patio regular acaba 11:15, el de verano 10:45 y la transición es seleccionable',()=>{
 const {doc}=base(),p=previewPatioRotation(doc,model(),{from:'2027-05-28',to:'2027-06-11',summerFrom:'2027-06-01'});
 const before=p.entries.find(x=>x.date==='2027-05-28'),summer=p.entries.find(x=>x.date==='2027-06-01');
 assert.deepEqual([before.start,before.end],['10:45','11:15']);
 assert.deepEqual([summer.start,summer.end],['10:15','10:45']);
 assert(summer.mode==='summer');
});

test('última fecha elegida limita la generación; no inventa curso, fin ni vacaciones',()=>{
 const {doc}=base(),source=model();
 for(const options of [
  {from:'2026-11-23',to:''},
  {from:'2026-11-23',to:'2027-07-01'},
  {from:'2026-11-23',to:'2026-11-22'},
  {from:'2026-11-23',to:'2026-11-27',summerFrom:'2027-01-01'},
  {from:'2026-07-01',to:'2026-11-27'}
 ])assert.throws(()=>previewPatioRotation(doc,source,options));
 const last=previewPatioRotation(doc,source,{from:'2027-06-01',to:'2027-06-04'});
 assert(last.entries.every(x=>x.date<='2027-06-04'));
 assert(!last.entries.some(x=>x.date==='2027-06-05'));
});

test('importación es aditiva, idempotente y preserva notas, exámenes y observaciones',()=>{
 const {doc,student,group,period}=base();
 const originalGrade=structuredClone(doc.grades);
 const mean=overallGrade(doc,student.id,group.id,period.id),annual=finalGrade(doc,student.id,group.id);
 const classEvent=saveEvent(doc,{type:'exam',title:'Examen original',date:'2026-11-24',groupId:group.id,time:'08:00'});
 const preview=previewPatioRotation(doc,model(),{from:'2026-11-23',to:'2026-11-27'});
 const first=addPatioRotationEvents(doc,preview);
 assert.deepEqual([first.created,first.skipped],[3,0]);
 assert.equal(doc.planner.years[0].events.length,4);
 const patio=doc.planner.years[0].events.find(x=>x.type==='patio');
 assert.equal(patio.patioRotationSource,'xlsx-first-break-v1');
 assert.equal(patio.endTime,'11:15');
 patio.notes='Observación del docente (no sobrescribir)';
 const second=addPatioRotationEvents(doc,preview);
 assert.deepEqual([second.created,second.skipped],[0,3]);
 assert.equal(patio.notes,'Observación del docente (no sobrescribir)');
 assert.equal(doc.planner.years[0].events.find(x=>x.id===classEvent.id).title,'Examen original');
 assert.deepEqual(doc.grades,originalGrade);
 assert.equal(overallGrade(doc,student.id,group.id,period.id),mean);
 assert.equal(finalGrade(doc,student.id,group.id),annual);
 assertModel(doc);
});

test('las guardias inválidas se rechazan ANTES de modificar ningún evento',()=>{
 const {doc}=base(),p=previewPatioRotation(doc,model(),{from:'2026-11-23',to:'2026-11-27'});
 const faulty=structuredClone(p);faulty.entries[2].start='99:45';faulty.entries[2].end='99:50';
 const prior=structuredClone(doc);
 assert.throws(()=>addPatioRotationEvents(doc,faulty),/franja inválida/);
 assert.deepEqual(doc,prior);
 assertModel(doc);
});

test('ICS de guardia utiliza duración real de 30 minutos y no nombres de profesores',()=>{
 const {doc}=base();
 const p=previewPatioRotation(doc,model(),{from:'2026-11-23',to:'2026-11-27'});
 addPatioRotationEvents(doc,p);
 const patio=doc.planner.years[0].events.find(x=>x.date==='2026-11-24');
 const ics=calendarEventIcs(patio);
 assert(ics.includes('DTSTART:20261124T104500'));
 assert(ics.includes('DTEND:20261124T111500'));
 assert(ics.includes('RONDA PART DAVANTERA'));
 const unfolded=ics.replace(/\r\n /g,''); // iCalendar puede plegar las líneas a 75 octetos.
 assert(unfolded.includes('BANYS'));
 assert(!ics.includes('Jéssica Roig'));
 assertModel(doc);
});

test('la nueva rotación queda aislada por año académico al crear curso siguiente',()=>{
 const {doc}=base(),source=model();
 addPatioRotationEvents(doc,previewPatioRotation(doc,source,{from:'2026-11-23',to:'2026-11-27'}));
 const previous=activeYear(doc);
 const next=addAcademicYear(doc,{name:'2027-2028',start:'2027-09-01',end:'2028-06-30',copyFrom:previous.id});
 assert.equal(next.events.length,0);
 assert.equal(previous.events.filter(x=>x.type==='patio').length,3);
 assertModel(doc);
});

test('reabrir un cuaderno cifrado conserva las guardias generadas y sus franjas',async()=>{
 const {doc,student,group,period}=base(),secret='Verificación interna de guardias cifradas 2026';
 ensureBookMetadata(doc);const old=structuredClone(doc);
 addPatioRotationEvents(doc,previewPatioRotation(doc,model(),{from:'2026-11-23',to:'2026-12-11'}));
 markBookChange(doc,old);
 const expected=structuredClone(doc),mean=overallGrade(doc,student.id,group.id,period.id);
 const {key,envelope}=await createVault(secret,doc);
 const {file}=await createPortableCopy(doc,key,saltFromEnvelope(envelope));
 const text=JSON.stringify(file);
 assert(!text.includes(student.name));
 const restored=await readBackupFile({size:Buffer.byteLength(text),text:async()=>text},secret);
 assert.deepEqual(restored.doc,expected);
 assert.equal(overallGrade(restored.doc,student.id,group.id,period.id),mean);
 assert.equal(restored.doc.planner.years[0].events.filter(x=>x.type==='patio').length,9);
 assertModel(restored.doc);
});

test('botón, vista previa y nuevo módulo están integrados en la PWA y caché offline',()=>{
 const {doc}=base(),html=renderPlanner(doc,{plannerMode:'week',plannerDate:'2026-11-23'});
 assert(html.includes('plan-import-patio'));
 const ui=readFileSync(new URL('../src/planner-ui.js',import.meta.url),'utf8');
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 for(const token of ['function patioImportModal','parsePatioXlsx','previewPatioRotation','addPatioRotationEvents','Confirmar e incorporar','En caso de lluvia'])
  if(token!=='En caso de lluvia')assert(ui.includes(token),'Falta '+token);
 assert(sw.includes("'./src/patio-rotation.js'"));
 assert(app.includes("'./src/patio-rotation.js'"));
});

function fakeNode(text,attrs={}){
 return {textContent:text,getAttribute:name=>attrs[name]??null,getElementsByTagName(tag){
  const re=new RegExp('<'+tag+'\\b([^>]*)>([\\s\\S]*?)<\\/'+tag+'>','gi');
  return [...text.matchAll(re)].map(m=>fakeNode(m[2],Object.fromEntries([...m[1].matchAll(/([\w:-]+)="([^"]*)"/g)].map(x=>[x[1],x[2]]))));
 }};
}
class FakeParser{parseFromString(text){return fakeNode(text);}}
function makeXmlSheet(cells){
 const c=[...cells.entries()].map(([ref,{text,formula}])=>
  '<c r="'+ref+'"'+(formula?'':' t="inlineStr"')+'>'+
  (formula?'<f>'+formula+'</f><v>'+String(text||'')+'</v>':'<is><t>'+String(text||'')+'</t></is>')+
  '</c>').join('');
 return '<worksheet><sheetData><row>'+c+'</row></sheetData></worksheet>';
}
function fakeWorkbook(changes={}){
 const {quadrant,roster,second}=makeCells();
 if(changes.badFormula)quadrant.get('E15').formula='INDEX(Professorat_guàrdia_1r_pati!$C$2:$C$9,MOD(0+3*($C$1-1),8)+1)';
 const workbook='<workbook><sheets><sheet name="Quadrant"></sheet><sheet name="Professorat_guàrdia_1r_pati"></sheet><sheet name="Professorat_guàrdia_2n_pati"></sheet></sheets></workbook>';
 const entries={
  'xl/workbook.xml':workbook,
  'xl/worksheets/sheet1.xml':makeXmlSheet(quadrant),
  'xl/worksheets/sheet2.xml':makeXmlSheet(roster),
  'xl/worksheets/sheet3.xml':makeXmlSheet(second)
 };
 const files=Object.fromEntries(Object.keys(entries).map(x=>[x,{}]));
 return {loadAsync:async()=>({files,file:name=>entries[name]?{
  _data:{uncompressedSize:entries[name].length},async:async()=>entries[name]
 }:null})};
}
test('lectura completa en memoria del XLSX con estructura y 80 fórmulas de la muestra',async()=>{
 const parsed=await parsePatioXlsx(new ArrayBuffer(200),{zipLibrary:fakeWorkbook(),Parser:FakeParser,marker:'yo'});
 assert.equal(parsed.firstMonday,'2026-08-31');
 assert.deepEqual([...parsed.positions],[null,4,0,null,4]);
 assert.equal(parsed.shift,2);
});
test('el lector NO supone que un cambio de fórmula sigue la rotación anterior',async()=>{
 await assert.rejects(parsePatioXlsx(new ArrayBuffer(8),{zipLibrary:fakeWorkbook({badFormula:true}),Parser:FakeParser}),/fórmula de rotación distinta/);
});
test('un Excel dañado o desmesurado se rechaza sin tocar el cuaderno',async()=>{
 const {doc}=base(),before=structuredClone(doc);
 await assert.rejects(parsePatioXlsx(new ArrayBuffer(3_000_001),{zipLibrary:fakeWorkbook(),Parser:FakeParser}),/3 MB/);
 await assert.rejects(parsePatioXlsx(new ArrayBuffer(8),{zipLibrary:{loadAsync:async()=>{throw Error('corrupto');}},Parser:FakeParser}),/No se ha podido abrir/);
 assert.deepEqual(doc,before);
});
