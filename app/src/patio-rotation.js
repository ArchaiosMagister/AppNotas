/** Importador local de rotaciones del primer patio. Solo admite el formato
 * concreto de tres hojas y fórmulas verificadas; nunca evalúa Excel/JS. */
import {activeYear,isoDate,addDays,weekday,isHoliday,scheduleBands,saveEvent} from './planner.js';

const MAX_FILE=3_000_000,MAX_XML=2_000_000;
const normalise=value=>String(value??'').trim().toLocaleLowerCase('es');
const letters='ABCDE',quadrantDays='CDEFG';
const normalRows=[4,5,6,7,10,11,12,13];
const rainRows=[15,16,17,18,21,22,23,24];
const isoUTC=(year,month,day)=>new Date(Date.UTC(year,month-1,day)).toISOString().slice(0,10);
const ordinal=(date)=>Date.parse(date+'T12:00:00Z')/86400000;
const indexOfRotated=(value,shift,week,size)=>((value-shift*(week-1))%size+size)%size;
function parseXml(xml,Parser){
 if(/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml))throw new Error('El Excel incluye instrucciones XML no permitidas.');
 const document=new Parser().parseFromString(xml,'application/xml');
 if(document.getElementsByTagName('parsererror').length)throw new Error('XML Excel incorrecto.');
 return document;
}
async function safeXml(zip,name,max=MAX_XML){
 const entry=zip.file(name);
 if(!entry)throw new Error('No se ha encontrado '+name+' en el Excel.');
 if(Number.isFinite(entry._data?.uncompressedSize)&&entry._data.uncompressedSize>max)
  throw new Error('Una hoja del Excel supera el tamaño admitido.');
 const source=await entry.async('string');
 if(source.length>max)throw new Error('El contenido Excel supera el tamaño admitido.');
 return source;
}
function sheetCells(xml,Parser,shared){
 const xmlRoot=parseXml(xml,Parser),cells=new Map();
 for(const cell of xmlRoot.getElementsByTagName('c')){
  const key=String(cell.getAttribute('r')||'').toUpperCase();
  if(!/^[A-Z]{1,2}[1-9]\d{0,2}$/.test(key)||cells.has(key))
   throw new Error('El Excel contiene referencias de celdas duplicadas o inválidas.');
  const kind=cell.getAttribute('t');
  const value=kind==='inlineStr'
   ?[...cell.getElementsByTagName('t')].map(n=>n.textContent||'').join('')
   :cell.getElementsByTagName('v')[0]?.textContent||'';
  const text=kind==='s'?shared[Number(value)]:value;
  if(kind==='s'&&typeof text!=='string')throw new Error('El Excel usa referencias de texto incorrectas.');
  const formula=cell.getElementsByTagName('f')[0]?.textContent||'';
  cells.set(key,{text:String(text??''),formula:String(formula).replace(/\s/g,'')});
  if(cells.size>1500)throw new Error('El Excel contiene demasiadas celdas.');
 }
 return cells;
}
const cell=(map,key)=>map.get(key)?.text||'';
const formula=(map,key)=>map.get(key)?.formula||'';
/** Extrae únicamente posiciones del marcador propio, zonas y reglas de giro.
 * Los nombres de otros docentes nunca se guardan en el cuaderno. */
export function extractPatioRotation(quadrant,roster,second,marker='yo'){
 const needle=normalise(marker);
 if(!needle||needle.length>80)throw new Error('Escribe el marcador usado para identificar tus guardias en el Excel.');
 const weekFormula=formula(quadrant,'C1').match(/^INT\(\(TODAY\(\)-DATE\((\d{4}),(\d{1,2}),(\d{1,2})\)\)\/7\)\+1$/i);
 const startFormula=formula(quadrant,'C2').match(/^DATE\((\d{4}),(\d{1,2}),(\d{1,2})\)\+\(C1\*7\)$/i);
 if(!weekFormula||!startFormula)throw new Error('No se reconoce la fórmula semanal del Excel; no se generarán fechas por aproximación.');
 const firstMonday=isoUTC(Number(startFormula[1]),Number(startFormula[2]),Number(startFormula[3])+7);
 isoDate(firstMonday);
 if(weekday(firstMonday)!==0)throw new Error('La primera semana de rotación no comienza en lunes.');
 const reference=isoUTC(Number(weekFormula[1]),Number(weekFormula[2]),Number(weekFormula[3]));
 if(Math.abs(ordinal(reference)-ordinal(firstMonday))>2||ordinal(reference)>ordinal(firstMonday))
  throw new Error('Las dos fórmulas de fecha del Excel no son coherentes.');
 const weekdays=['DL','DM','DX','DJ','DV'];
 if(weekdays.some((day,i)=>normalise(cell(roster,letters[i]+'1'))!==normalise(day)))
  throw new Error('Los días del primer patio no coinciden con el formato del Excel.');
 const positions=weekdays.map((_,day)=>{
  const positionsForDay=[];
  for(let index=0;index<8;index++)if(normalise(cell(roster,letters[day]+(index+2)))===needle)
   positionsForDay.push(index);
  if(positionsForDay.length>1)throw new Error('El marcador aparece varias veces en un mismo día: revisa el Excel.');
  return positionsForDay.length?positionsForDay[0]:null;
 });
 if(positions.every(x=>x===null))throw new Error('El marcador no aparece en la hoja de guardias del primer patio.');
 const secondCount=weekdays.reduce((sum,_,day)=>{
  let count=0;
  for(let r=2;r<=15;r++)if(normalise(cell(second,letters[day]+r))===needle)count++;
  return sum+count;
 },0);
 // Un docente puede tener además segundo patio: no deducir su rotación de
 // una lista estática de nombres que no indica fechas futuras.
 const firstFormula=formula(quadrant,'C4').match(/^INDEX\(Professorat_gu.rdia_1r_pati!\$A\$2:\$A\$(\d+),MOD\((\d+)\+(\d+)\*\(\$C\$1-1\),(\d+)\)\+1\)$/i);
 if(!firstFormula||Number(firstFormula[1])!==9||Number(firstFormula[2])!==0||Number(firstFormula[4])!==8)
  throw new Error('No se reconoce la rotación de ocho puestos del primer patio.');
 const shift=Number(firstFormula[3]),size=8;
 if(!Number.isInteger(shift)||shift<1||shift>=size)throw new Error('Desplazamiento semanal de guardias inválido.');
 const rotationFormula=(day,index)=>new RegExp('^INDEX\\(Professorat_gu.rdia_1r_pati!\\$'+letters[day]+'\\$2:\\$'+letters[day]+'\\$9,MOD\\('+index+'\\+'+shift+'\\*\\(\\$C\\$1-1\\),8\\)\\+1\\)$','i');
 const standard=[],rain=[];
 for(let i=0;i<size;i++){
  const name=cell(quadrant,'B'+normalRows[i]).trim(),wet=cell(quadrant,'B'+rainRows[i]).trim();
  if(!name||name.length>150||!wet||wet.length>150)throw new Error('Falta una zona de patio o su alternativa de lluvia.');
  for(let day=0;day<5;day++){
   if(!rotationFormula(day,i).test(formula(quadrant,quadrantDays[day]+normalRows[i]))||
      !rotationFormula(day,i).test(formula(quadrant,quadrantDays[day]+rainRows[i])))
    throw new Error('Una zona del Excel usa una fórmula de rotación distinta. Revísala antes de importar.');
  }
  standard.push(name);rain.push(wet);
 }
 return Object.freeze({firstMonday,shift,size,cycleWeeks:size/gcd(size,shift),
  positions:Object.freeze(positions),standard:Object.freeze(standard),rain:Object.freeze(rain),
  secondCount,marker:needle});
}
function gcd(a,b){while(b){const r=a%b;a=b;b=r;}return a;}
/** Soporte estricto del libro aportado: Quadrant y las dos tablas de profesores.
 * XLSX ZIP limitado; sin ejecutar macros, vínculos, scripts ni fórmulas. */
export async function parsePatioXlsx(arrayBuffer,{zipLibrary=globalThis.JSZip,Parser=globalThis.DOMParser,marker='yo'}={}){
 if(!zipLibrary||!Parser)throw new Error('El lector local de Excel no está disponible.');
 if(!(arrayBuffer instanceof ArrayBuffer)||arrayBuffer.byteLength===0||arrayBuffer.byteLength>MAX_FILE)
  throw new Error('Selecciona un archivo .xlsx de hasta 3 MB.');
 let zip;try{zip=await zipLibrary.loadAsync(arrayBuffer);}catch{throw new Error('No se ha podido abrir el Excel seleccionado.');}
 if(Object.keys(zip.files).length>100)throw new Error('El Excel contiene demasiadas entradas internas.');
 const workbook=await safeXml(zip,'xl/workbook.xml',120000);
 // Rechazar orden/nombres distintos en vez de reinterpretar las hojas.
 const root=parseXml(workbook,Parser),sheets=[...root.getElementsByTagName('sheet')].map(x=>x.getAttribute('name'));
 if(sheets.length!==3||sheets[0]!=='Quadrant'||sheets[1]!=='Professorat_guàrdia_1r_pati'||sheets[2]!=='Professorat_guàrdia_2n_pati')
  throw new Error('Este archivo no sigue el formato de tres hojas de guardias compatible.');
 const sharedEntry=zip.file('xl/sharedStrings.xml');
 const shared=sharedEntry?[...parseXml(await safeXml(zip,'xl/sharedStrings.xml'),Parser).getElementsByTagName('si')]
  .map(si=>[...si.getElementsByTagName('t')].map(x=>x.textContent||'').join('')):[];
 if(shared.length>3000)throw new Error('Demasiados textos compartidos en el Excel.');
 const data=await Promise.all([1,2,3].map(async i=>
  sheetCells(await safeXml(zip,'xl/worksheets/sheet'+i+'.xml'),Parser,shared)));
 return extractPatioRotation(data[0],data[1],data[2],marker);
}
function firstBreak(y,mode){
 const band=scheduleBands(y,mode).find(b=>b.id==='patio-1'&&b.kind==='break');
 if(!band)throw new Error('El horario '+mode+' carece de un primer patio configurado.');
 return {start:band.start,end:band.end};
}
/** Proyección desde las fórmulas del libro, sin asumir que las vacaciones
 * interrumpen el ciclo: el Excel avanza por semanas naturales. */
export function previewPatioRotation(doc,source,{from,to,summerFrom='',skipHolidays=true}={}){
 const y=activeYear(doc);
 isoDate(from);isoDate(to);
 if(from>to||from<y.start||to>y.end||from<source.firstMonday||ordinal(to)-ordinal(from)>370)
  throw new Error('Selecciona un intervalo válido dentro del curso y posterior al inicio del Excel.');
 if(summerFrom){
  isoDate(summerFrom);
  if(summerFrom<from||summerFrom>to)throw new Error('La fecha de inicio del horario de verano debe estar dentro del intervalo.');
 }
 if(typeof skipHolidays!=='boolean')throw new Error('Configuración de festivos inválida.');
 const regular=firstBreak(y,'regular'),summer=firstBreak(y,'summer');
 const entries=[];let excluded=0,existing=0;
 for(let date=from;date<=to;date=addDays(date,1)){
  const day=weekday(date);
  if(day>4||source.positions[day]===null)continue;
  if(skipHolidays&&isHoliday(y,date)){excluded++;continue;}
  const monday=addDays(date,-day),weeks=(ordinal(monday)-ordinal(source.firstMonday))/7;
  if(!Number.isInteger(weeks)||weeks<0)throw new Error('Semana de rotación no reconocida.');
  const week=weeks+1,zoneIndex=indexOfRotated(source.positions[day],source.shift,week,source.size);
  const zone=source.standard[zoneIndex],rainZone=source.rain[zoneIndex],mode=
   summerFrom?(date>=summerFrom?'summer':'regular'):(y.summerEnabled?'summer':'regular');
  const times=mode==='summer'?summer:regular;
  const conflict=y.events.find(e=>e.date===date&&e.type==='patio');
  if(conflict)existing++;
  entries.push({date,day,week,zone,zoneIndex,rainZone,
   start:times.start,end:times.end,mode,existingId:conflict?.id??null});
 }
 if(!entries.length)throw new Error('No hay guardias para el marcador y fechas seleccionados.');
 if(entries.length>240)throw new Error('Demasiadas guardias; reduce el intervalo.');
 return {entries,excluded,existing,firstMonday:source.firstMonday,cycleWeeks:source.cycleWeeks,
  weekdays:source.positions.map((x,i)=>x===null?null:i).filter(x=>x!==null),
  secondCount:source.secondCount};
}
/** Operación determinista/idempotente y solo aditiva: no sobrescribe guardias
 * previas ni toca horarios, otros eventos, notas o competencias. */
export function addPatioRotationEvents(doc,preview){
 if(!preview||!Array.isArray(preview.entries)||preview.entries.length>240||
    new Set(preview.entries.map(x=>x.date)).size!==preview.entries.length)
  throw new Error('Previsualización de guardias inválida.');
 const y=activeYear(doc),created=[];
 // Validar todos los registros ANTES de escribir para evitar operaciones
 // parciales incluso cuando la función se use fuera de una transacción.
 for(const entry of preview.entries){
  isoDate(entry.date);
  if(entry.date<y.start||entry.date>y.end||!entry.zone||!entry.rainZone||
     entry.zone.length>150||entry.rainZone.length>150||
     !/^\d{2}:\d{2}$/.test(entry.start)||!/^\d{2}:\d{2}$/.test(entry.end)||
     entry.end<=entry.start)
   throw new Error('Una guardia tiene fecha, zona o franja inválida.');
 }
 for(const entry of preview.entries){
  if(y.events.some(e=>e.type==='patio'&&e.date===entry.date))continue;
  const note='Zona habitual: '+entry.zone+'\nLluvia o viento: '+entry.rainZone+
    '\nRotación del Excel, semana '+entry.week+'. Comprobar si el centro comunica cambios.';
  const ev=saveEvent(doc,{date:entry.date,type:'patio',title:'1.er patio · '+entry.zone,
   time:entry.start,endTime:entry.end,notes:note});
  ev.patioRotationSource='xlsx-first-break-v1';
  created.push(ev.id);
 }
 return {created:created.length,skipped:preview.entries.length-created.length,ids:created};
}
