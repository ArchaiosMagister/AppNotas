/** Agenda académica en el mismo cuaderno cifrado. No contiene nombres de alumnado ni calificaciones. */
const iso=/^\d{4}-\d{2}-\d{2}$/;
const hm=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
const uid=()=>crypto.randomUUID();
const stamp=()=>new Date().toISOString();
const trimmed=(v,max=250)=>{const x=String(v??'').trim();if(!x||x.length>max)throw new Error('Escribe un texto válido.');return x;};
export const SLOT_TYPES=Object.freeze({class:'Clase',guardia:'Guardia',familias:'Atención a familias',complementaria:'Hora complementaria',departamento:'Reunión de departamento',jefatura:'Jefatura de departamento',otro:'Otra actividad'});
/** Plantilla horaria por centro, independiente de clases y calificaciones. */
export const DEFAULT_TIMETABLE_BANDS=Object.freeze([
 {id:'hora-1',label:'1.ª hora',start:'08:00',end:'08:55',kind:'lesson'},
 {id:'hora-2',label:'2.ª hora',start:'08:55',end:'09:50',kind:'lesson'},
 {id:'hora-3',label:'3.ª hora',start:'09:50',end:'10:45',kind:'lesson'},
 {id:'patio-1',label:'Primer patio',start:'10:45',end:'11:15',kind:'break'},
 {id:'hora-4',label:'4.ª hora',start:'11:15',end:'12:10',kind:'lesson'},
 {id:'hora-5',label:'5.ª hora',start:'12:10',end:'13:05',kind:'lesson'},
 {id:'hora-6',label:'6.ª hora',start:'13:05',end:'14:00',kind:'lesson'},
 {id:'patio-2',label:'Segundo patio',start:'14:00',end:'14:20',kind:'break'},
 {id:'hora-7',label:'7.ª hora',start:'14:20',end:'15:15',kind:'lesson'}
].map(row=>Object.freeze(row)));
export const scheduleBands=y=>(Array.isArray(y?.bands)?y.bands:DEFAULT_TIMETABLE_BANDS).slice()
 .sort((a,b)=>a.start.localeCompare(b.start)||a.end.localeCompare(b.end));
const cloneBands=()=>DEFAULT_TIMETABLE_BANDS.map(b=>({...b}));
const checkedBands=bands=>{
 if(!Array.isArray(bands)||!bands.length||bands.length>30)throw new Error('El horario necesita entre 1 y 30 franjas.');
 const ids=new Set();
 const rows=[...bands].sort((a,b)=>a.start.localeCompare(b.start)||a.end.localeCompare(b.end));
 rows.forEach((b,i)=>{
  if(!b||typeof b.id!=='string'||!b.id||ids.has(b.id)||typeof b.label!=='string'||!b.label.trim()||b.label.length>70||
     !['lesson','break'].includes(b.kind)||!timeValid(b.start)||!timeValid(b.end)||b.end<=b.start||
     i>0&&rows[i-1].end>b.start)throw new Error('Franjas inválidas, repetidas o solapadas.');
  ids.add(b.id);
 });
 return rows;
};
export function saveTimetableBand(doc,{id=null,label,start,end,kind='lesson'}){
 const y=activeYear(doc),before=scheduleBands(y),existing=before.find(b=>b.id===id);
 if(id&&!existing)throw new Error('La franja no existe.');
 const band={id:id||uid(),label:trimmed(label,70),start,end,kind};
 const next=checkedBands(existing?before.map(b=>b.id===id?band:b):[...before,band]);
 // Validar todo ANTES de modificar el cuaderno. Las sesiones vinculadas
 // conservan su clase, aula y eventos al cambiar los tiempos de la franja.
 y.bands=next;
 if(existing&&(existing.start!==start||existing.end!==end)){
  for(const slot of y.slots.filter(s=>s.bandId===id)){
   slot.start=start;slot.end=end;
   y.events.filter(e=>e.slotId===slot.id).forEach(e=>{
    e.time=y.exceptions.find(x=>x.slotId===slot.id&&x.date===e.date&&x.type==='move')?.start||start;
   });
  }
 }
 doc.updatedAt=stamp();return band;
}
export function removeTimetableBand(doc,id){
 const y=activeYear(doc),bands=scheduleBands(y);
 if(!bands.some(b=>b.id===id))throw new Error('Franja inexistente.');
 if(y.slots.some(s=>s.bandId===id))throw new Error('Retira primero las clases asignadas a esta franja.');
 y.bands=checkedBands(bands.filter(b=>b.id!==id));doc.updatedAt=stamp();
}
export const EVENT_TYPES=Object.freeze({exam:'Examen',task:'Tarea',meeting:'Reunión',other:'Otro evento'});
export const EXCEPTION_TYPES=Object.freeze({cancel:'Clase cancelada',replace:'Actividad sustituta',move:'Cambio de hora'});
export function isoDate(v){
 if(typeof v!=='string'||!iso.test(v))throw new Error('Fecha inválida.');
 const [y,m,d]=v.split('-').map(Number);
 const check=new Date(Date.UTC(y,m-1,d));
 if(check.getUTCFullYear()!==y||check.getUTCMonth()!==m-1||check.getUTCDate()!==d)throw new Error('Fecha imposible.');
 return v;
}
export const weekday=v=>{isoDate(v);return (new Date(`${v}T12:00:00Z`).getUTCDay()+6)%7;};
export const addDays=(v,n)=>{isoDate(v);const d=new Date(`${v}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
export const localToday=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
export const timeValid=v=>typeof v==='string'&&hm.test(v);
function yearRange(label){const match=/^(\d{4})-(\d{4})$/.exec(label||'');const y=match?Number(match[1]):new Date().getFullYear();return {start:`${y}-09-01`,end:`${y+1}-06-30`};}
export function createPlanner(course='2026-2027'){
 const name=/^\d{4}-\d{4}$/.test(course)?course:'2026-2027';const year={id:uid(),name,...yearRange(name),bands:cloneBands(),slots:[],events:[],lessons:[],holidays:[],exceptions:[],tasks:[]};
 return {activeYearId:year.id,years:[year]};
}
export function ensurePlanner(doc){if(!doc.planner)doc.planner=createPlanner(doc.groups[0]?.course);return doc.planner;}
export function activeYear(doc){const planner=ensurePlanner(doc);return planner.years.find(y=>y.id===planner.activeYearId)||planner.years[0];}
export function setActiveYear(doc,id){if(!ensurePlanner(doc).years.some(y=>y.id===id))throw new Error('Curso académico inexistente.');doc.planner.activeYearId=id;doc.updatedAt=stamp();}
export function addAcademicYear(doc,{name,start,end,copyFrom=null}){
 const p=ensurePlanner(doc),n=trimmed(name,50);isoDate(start);isoDate(end);
 if(start>=end)throw new Error('El fin de curso debe ser posterior al inicio.');
 if(p.years.some(y=>y.name===n))throw new Error('Ese curso académico ya existe.');
 const source=p.years.find(y=>y.id===copyFrom);
 if(copyFrom&&!source)throw new Error('Curso de referencia inexistente.');
 const y={id:uid(),name:n,start,end,bands:source?structuredClone(scheduleBands(source)):cloneBands(),slots:[],events:[],lessons:[],holidays:[],exceptions:[],tasks:[]};
 if(source)y.slots=source.slots.map(s=>{const old=doc.groups.find(g=>g.id===s.groupId);const replacement=old&&doc.groups.find(g=>g.course===n&&g.subject===old.subject&&g.name===old.name);return {...s,id:uid(),groupId:replacement?.id||null,label:replacement?'':(s.label||[old?.subject,old?.name].filter(Boolean).join(' · '))};});
 p.years.push(y);p.activeYearId=y.id;doc.updatedAt=stamp();return y;
}
export function updateAcademicYear(doc,id,patch){
 const y=ensurePlanner(doc).years.find(y=>y.id===id);if(!y)throw new Error('Curso inexistente.');
 const name=trimmed(patch.name??y.name,50),start=isoDate(patch.start??y.start),end=isoDate(patch.end??y.end);
 if(start>=end)throw new Error('Fechas del curso inválidas.');
 if(doc.planner.years.some(a=>a!==y&&a.name===name))throw new Error('Curso duplicado.');
 // Nunca dejar un curso ilegible al recortar su intervalo: validar todos los
 // registros existentes ANTES de tocar el objeto compartido.
 const dates=[...y.events.map(e=>e.date),...y.lessons.map(l=>l.date),
   ...y.exceptions.map(e=>e.date),...y.tasks.map(t=>t.dueDate),
   ...y.holidays.flatMap(h=>[h.start,h.end])];
 if(dates.some(date=>date<start||date>end))throw new Error('Existen actividades o días festivos fuera de las nuevas fechas del curso. Modifícalos antes de acortar el curso.');
 Object.assign(y,{name,start,end});doc.updatedAt=stamp();return y;
}
const inYear=(y,date)=>date>=y.start&&date<=y.end;
const needDate=(y,date)=>{isoDate(date);if(!inYear(y,date))throw new Error('La fecha está fuera del curso académico.');return date;};
const checkGroup=(doc,groupId)=>{if(groupId&&!doc.groups.some(g=>g.id===groupId))throw new Error('Grupo inexistente.');};
const checkTime=(start,end)=>{if(!timeValid(start)||!timeValid(end)||end<=start)throw new Error('Indica horas válidas, con fin posterior al inicio.');};
export function saveSlot(doc,{id=null,day,start,end,type,groupId=null,label='',room='',bandId=null}){
 const y=activeYear(doc),kind=trimmed(type,20);if(!Object.hasOwn(SLOT_TYPES,kind))throw new Error('Tipo de sesión inválido.');
 if(!Number.isInteger(Number(day))||Number(day)<0||Number(day)>4)throw new Error('El horario es de lunes a viernes.');checkTime(start,end);checkGroup(doc,groupId);
 if(kind==='class'&&!groupId&&!String(label).trim())throw new Error('Selecciona un grupo o indica una asignatura manual.');
 if(kind!=='class'&&groupId)throw new Error('Solo las clases pueden asociarse a grupos.');
 if(String(label).length>150||typeof room!=='string'||room.length>60)throw new Error('El nombre o el aula son demasiado largos.');
 if(bandId!==null){
  const band=scheduleBands(y).find(b=>b.id===bandId);
  if(!band||band.start!==start||band.end!==end)throw new Error('La sesión debe corresponder a su franja horaria.');
 }
 const record={id:id||uid(),day:Number(day),start,end,type:kind,groupId:groupId||null,label:String(label).trim(),room:room.trim(),...(bandId?{bandId}:{})};
 const existing=y.slots.find(s=>s.id===id);if(id&&!existing)throw new Error('Sesión inexistente.');
 // Horas iguales pueden coincidir (guardias compartidas, docencia simultánea); se muestran separadas.
 if(existing){
  // Si la sesión cambia de día o de grupo, no se deben mover retrospectivamente planes ni exámenes.
  if(existing.day!==record.day||existing.groupId!==record.groupId){
    y.lessons.filter(x=>x.slotId===id).forEach(x=>{x.slotId=null;x.groupId=x.groupId||existing.groupId;x.label=x.label||existing.label||SLOT_TYPES[existing.type];});
    y.events.filter(x=>x.slotId===id).forEach(x=>{x.slotId=null;});
    y.exceptions=y.exceptions.filter(x=>x.slotId!==id);
  }else{
    y.events.filter(x=>x.slotId===id).forEach(x=>{x.time=y.exceptions.find(e=>e.slotId===id&&e.date===x.date&&e.type==='move')?.start||start;});
  }
  Object.assign(existing,record);
 }else y.slots.push(record);
 doc.updatedAt=stamp();return record;
}
export function removeSlot(doc,id){const y=activeYear(doc),s=y.slots.find(s=>s.id===id);if(!s)throw new Error('Sesión inexistente.');
 y.slots=y.slots.filter(x=>x.id!==id);
 // Planificación y excepciones conservan contexto sin quedar ancladas a un horario inexistente.
 y.lessons.filter(x=>x.slotId===id).forEach(x=>{x.slotId=null;x.groupId=x.groupId||s.groupId;x.label=x.label||s.label||SLOT_TYPES[s.type];});
 y.events.filter(x=>x.slotId===id).forEach(x=>{x.slotId=null;if(!x.time)x.time=s.start;});
 y.exceptions=y.exceptions.filter(x=>x.slotId!==id);
 doc.updatedAt=stamp();}
export const isHoliday=(y,date)=>y.holidays.find(h=>date>=h.start&&date<=h.end)||null;
export const daySlots=(y,date)=>{isoDate(date);const day=weekday(date);if(day>4||!inYear(y,date)||isHoliday(y,date))return [];return y.slots.filter(s=>s.day===day).sort((a,b)=>a.start.localeCompare(b.start)||a.end.localeCompare(b.end));};
export const daySessions=(y,date)=>daySlots(y,date).map(slot=>{const exception=y.exceptions.find(e=>e.date===date&&e.slotId===slot.id);return {...slot,exception,effectiveStart:exception?.type==='move'?exception.start:slot.start,effectiveEnd:exception?.type==='move'?exception.end:slot.end};});
export function saveHoliday(doc,{id=null,name,start,end=start}){const y=activeYear(doc);needDate(y,start);needDate(y,end);if(end<start)throw new Error('El festivo termina antes de comenzar.');const obj={id:id||uid(),name:trimmed(name,120),start,end};const old=y.holidays.find(x=>x.id===id);if(id&&!old)throw new Error('Festivo inexistente.');if(old)Object.assign(old,obj);else y.holidays.push(obj);doc.updatedAt=stamp();return obj;}
export function saveException(doc,{id=null,date,slotId,type,label='',start='',end=''}){const y=activeYear(doc);needDate(y,date);const slot=y.slots.find(s=>s.id===slotId);if(!slot||weekday(date)!==slot.day)throw new Error('Selecciona una sesión que corresponda al día.');if(isHoliday(y,date))throw new Error('Ese día ya está marcado como no lectivo.');if(!Object.hasOwn(EXCEPTION_TYPES,type))throw new Error('Cambio excepcional inválido.');if(type==='move')checkTime(start,end);if(type==='replace')trimmed(label,150);const other=y.exceptions.find(x=>x.date===date&&x.slotId===slotId&&x.id!==id);if(other)throw new Error('Ya existe un cambio para esa sesión.'); const obj={id:id||uid(),date,slotId,type,label:String(label).trim(),start:type==='move'?start:'',end:type==='move'?end:''};const old=y.exceptions.find(x=>x.id===id);if(id&&!old)throw new Error('Cambio inexistente.');
 // Antes de mover o cambiar una excepción, restablecer las horas de los
 // exámenes afectados por su antigua ubicación. De otro modo, al pasar de
 // «cambio de hora» a «cancelada» quedaba la hora antigua en el calendario.
 if(old?.type==='move'){
   const oldSlot=y.slots.find(s=>s.id===old.slotId);
   y.events.filter(e=>e.slotId===old.slotId&&e.date===old.date).forEach(e=>{e.time=oldSlot?.start||e.time;});
 }
 if(old)Object.assign(old,obj);else y.exceptions.push(obj);
 if(type==='move')y.events.filter(e=>e.slotId===slotId&&e.date===date).forEach(e=>{e.time=start;});
 doc.updatedAt=stamp();return obj;}
export function saveLesson(doc,{id=null,date,slotId=null,groupId=null,label='',planned='',done=false,actual=''}){
 const y=activeYear(doc);needDate(y,date);checkGroup(doc,groupId);const slot=slotId?y.slots.find(x=>x.id===slotId):null;
 if(slotId&&(!slot||slot.day!==weekday(date)))throw new Error('Sesión y fecha incompatibles.');
 if(slot&&slot.groupId&&groupId&&slot.groupId!==groupId)throw new Error('El grupo no coincide con la sesión.');
 if(!slotId&&!groupId&&!String(label).trim())throw new Error('Selecciona una clase o asignatura.');
 if(String(planned).length>4000||String(actual).length>4000||String(label).length>150)throw new Error('Texto demasiado largo.');
 const obj={id:id||uid(),date,slotId:slotId||null,groupId:groupId||slot?.groupId||null,label:String(label).trim(),planned:String(planned).trim(),done:!!done,actual:String(actual).trim()};
 const old=y.lessons.find(x=>x.id===id);if(id&&!old)throw new Error('Plan inexistente.');
 if(y.lessons.some(x=>x.id!==id&&x.date===date&&x.slotId===obj.slotId&&obj.slotId))throw new Error('Ya hay una planificación para esa sesión. Edita la existente.');
 if(old)Object.assign(old,obj);else y.lessons.push(obj);doc.updatedAt=stamp();return obj;
}
/** Encuentra la siguiente clase real del mismo grupo/asignatura, incluso si se
 * imparte otro día o hay dos sesiones en la misma jornada. */
function nextClassSession(y,slotId,fromDate){
 const current=y.slots.find(s=>s.id===slotId);if(!current)throw new Error('Sesión inexistente.');
 isoDate(fromDate);
 const currentStart=daySessions(y,fromDate).find(s=>s.id===slotId)?.effectiveStart??current.start;
 const compatible=s=>{
   if(current.type!=='class')return s.id===current.id;
   if(s.type!=='class')return false;
   return current.groupId ? s.groupId===current.groupId
     : !s.groupId&&s.label.trim().toLocaleLowerCase('es')===current.label.trim().toLocaleLowerCase('es');
 };
 for(let i=0;i<=380;i++){
   const date=addDays(fromDate,i);if(date>y.end)break;
   if(isHoliday(y,date))continue;
   const choices=daySessions(y,date)
     .filter(s=>compatible(s)&&!['cancel','replace'].includes(s.exception?.type))
     .filter(s=>i>0||s.effectiveStart>currentStart)
     .sort((a,b)=>a.effectiveStart.localeCompare(b.effectiveStart)||a.effectiveEnd.localeCompare(b.effectiveEnd)||a.id.localeCompare(b.id));
   if(choices.length)return {date,slot:choices[0]};
 }
 return null;
}
export function nextClassDate(y,slotId,fromDate){return nextClassSession(y,slotId,fromDate)?.date??null;}
export function carryLesson(doc,id){
 const y=activeYear(doc),lesson=y.lessons.find(x=>x.id===id);
 if(!lesson?.slotId)throw new Error('Solo se puede trasladar una planificación de una sesión del horario.');
 if(lesson.done)throw new Error('No se puede trasladar una clase marcada como realizada.');
 if(!lesson.planned.trim())throw new Error('No hay trabajo pendiente que trasladar.');
 const next=nextClassSession(y,lesson.slotId,lesson.date);
 if(!next)throw new Error('No hay otra sesión lectiva de esta clase dentro del curso.');
 if(y.lessons.some(x=>x.date===next.date&&x.slotId===next.slot.id))throw new Error('La siguiente sesión ya tiene planificación.');
 // Primero crear el destino: si fallase la validación, no se borra el origen.
 const obj=saveLesson(doc,{date:next.date,slotId:next.slot.id,groupId:next.slot.groupId||lesson.groupId,label:lesson.label,planned:lesson.planned});
 lesson.done=false;lesson.planned='';lesson.updatedAt=stamp();doc.updatedAt=stamp();return obj;
}
export function findExamSlots(y,groupId,date){return daySessions(y,date).filter(s=>s.type==='class'&&s.groupId===groupId&&s.exception?.type!=='cancel'&&s.exception?.type!=='replace');}
export function saveEvent(doc,{id=null,date,type,title,groupId=null,assessmentId=null,slotId=null,time='',notes=''}){
 const y=activeYear(doc);needDate(y,date);if(!Object.hasOwn(EVENT_TYPES,type))throw new Error('Tipo de evento inválido.');checkGroup(doc,groupId);
 if(time&&!timeValid(time))throw new Error('Hora del evento inválida.');
 if(String(notes).length>4000)throw new Error('Notas demasiado largas.');
 let slot=null;if(slotId){slot=y.slots.find(s=>s.id===slotId);if(!slot||slot.day!==weekday(date)||isHoliday(y,date)||y.exceptions.some(e=>e.date===date&&e.slotId===slotId&&['cancel','replace'].includes(e.type)))throw new Error('Esta sesión no está disponible en esa fecha.');if(slot.type==='class'&&slot.groupId!==groupId)throw new Error('El grupo y la sesión no coinciden.');
  if(type==='exam'&&slot.type!=='class')throw new Error('Un examen solo se puede vincular a una sesión de clase. Indica una hora manual para una convocatoria excepcional.');}
 if(assessmentId){const a=doc.assessments.find(a=>a.id===assessmentId);if(!a||type!=='exam'||a.groupId!==groupId)throw new Error('La actividad del cuaderno no corresponde a este examen.');if(y.events.some(e=>e.id!==id&&e.assessmentId===assessmentId))throw new Error('El examen ya está programado en este curso. Edita su fecha en lugar de duplicarlo.');}
 const obj={id:id||uid(),date,type,title:trimmed(title,150),groupId:groupId||null,assessmentId:assessmentId||null,slotId:slotId||null,time:slot?(y.exceptions.find(e=>e.date===date&&e.slotId===slotId&&e.type==='move')?.start||slot.start):time,notes:String(notes).trim()};
 const old=y.events.find(e=>e.id===id);if(id&&!old)throw new Error('Evento inexistente.');if(old)Object.assign(old,obj);else y.events.push(obj);doc.updatedAt=stamp();return obj;
}
export function saveTask(doc,{id=null,title,dueDate,groupId=null,done=false,notes=''}){const y=activeYear(doc);needDate(y,dueDate);checkGroup(doc,groupId);if(String(notes).length>4000)throw new Error('Notas demasiado largas.');const obj={id:id||uid(),title:trimmed(title,150),dueDate,groupId:groupId||null,done:!!done,notes:String(notes).trim()};const old=y.tasks.find(t=>t.id===id);if(id&&!old)throw new Error('Tarea inexistente.');if(old)Object.assign(old,obj);else y.tasks.push(obj);doc.updatedAt=stamp();return obj;}
export function deletePlannerItem(doc,collection,id){if(!['events','tasks','holidays','exceptions','lessons'].includes(collection))throw new Error('Apartado inválido.');const y=activeYear(doc);if(!y[collection].some(x=>x.id===id))throw new Error('Elemento inexistente.');
 const original=y[collection].find(x=>x.id===id);
 y[collection]=y[collection].filter(x=>x.id!==id);
 if(collection==='exceptions'&&original.type==='move')y.events.filter(x=>x.date===original.date&&x.slotId===original.slotId).forEach(x=>{x.time=y.slots.find(s=>s.id===original.slotId)?.start||x.time;});
 doc.updatedAt=stamp();}
const unique=a=>Array.isArray(a)&&a.every(x=>x&&typeof x.id==='string')&&new Set(a.map(x=>x.id)).size===a.length;
export function assertPlanner(doc){if(!doc.planner)return true;const p=doc.planner;if(!Array.isArray(p.years)||!p.years.length||!unique(p.years)||!p.years.some(y=>y.id===p.activeYearId))throw new Error('Planificador inválido.');
 for(const y of p.years){isoDate(y.start);isoDate(y.end);if(y.start>=y.end||typeof y.name!=='string'||!y.name.trim())throw new Error('Curso académico inválido.');
  if(!['slots','events','lessons','holidays','exceptions','tasks'].every(k=>unique(y[k])))throw new Error('Elementos del planificador inválidos.');
  checkedBands(scheduleBands(y));
  // Invariantes que la interfaz impone al editar también deben comprobarse
  // al restaurar una copia: evita eventos o planes ambiguos por duplicación.
  const uniquePairs=(items,key)=>new Set(items.map(key)).size===items.length;
  if(!uniquePairs(y.exceptions,e=>`${e.date}|${e.slotId}`)||
     !uniquePairs(y.lessons.filter(l=>l.slotId),l=>`${l.date}|${l.slotId}`)||
     !uniquePairs(y.events.filter(e=>e.assessmentId),e=>e.assessmentId))
    throw new Error('Agenda duplicada: revisa excepciones, clases y exámenes vinculados.');
  for(const s of y.slots){if(!Number.isInteger(s.day)||s.day<0||s.day>4||!Object.hasOwn(SLOT_TYPES,s.type)||!timeValid(s.start)||!timeValid(s.end)||s.end<=s.start||(s.groupId&&!doc.groups.some(g=>g.id===s.groupId))||(s.type==='class'&&!s.groupId&&!s.label)||(s.type!=='class'&&s.groupId)||
  s.room!==undefined&&(typeof s.room!=='string'||s.room.length>60)||
  s.bandId!==undefined&&(!scheduleBands(y).some(b=>b.id===s.bandId&&b.start===s.start&&b.end===s.end)))throw new Error('Horario inválido.');}
  for(const h of y.holidays){isoDate(h.start);isoDate(h.end);if(h.start>h.end||!inYear(y,h.start)||!inYear(y,h.end)||!h.name)throw new Error('Festivo inválido.');}
  for(const x of y.exceptions){if(!inYear(y,isoDate(x.date))||!y.slots.some(s=>s.id===x.slotId&&s.day===weekday(x.date))||!Object.hasOwn(EXCEPTION_TYPES,x.type)||(x.type==='move'&&(!timeValid(x.start)||!timeValid(x.end)||x.end<=x.start)))throw new Error('Cambio de horario inválido.');}
  for(const item of [...y.events,...y.lessons]){if(!inYear(y,isoDate(item.date))||(item.groupId&&!doc.groups.some(g=>g.id===item.groupId))||(item.slotId&&!y.slots.some(s=>s.id===item.slotId&&s.day===weekday(item.date))))throw new Error('Agenda de clase inválida.');}
  for(const e of y.events){if(!Object.hasOwn(EVENT_TYPES,e.type)||!e.title||(e.time&&!timeValid(e.time))||(e.slotId&&y.slots.find(s=>s.id===e.slotId)?.type==='class'&&y.slots.find(s=>s.id===e.slotId)?.groupId!==e.groupId)||(e.assessmentId&&(e.type!=='exam'||!doc.assessments.some(a=>a.id===e.assessmentId&&a.groupId===e.groupId))))throw new Error('Evento inválido.');}
  for(const l of y.lessons){if(typeof l.planned!=='string'||typeof l.done!=='boolean'||typeof l.actual!=='string')throw new Error('Plan de clase inválido.');}
  for(const t of y.tasks){if(!inYear(y,isoDate(t.dueDate))||!t.title||typeof t.done!=='boolean'||(t.groupId&&!doc.groups.some(g=>g.id===t.groupId)))throw new Error('Tarea inválida.');}
 }
 return true;
}
