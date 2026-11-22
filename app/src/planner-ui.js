import {SLOT_TYPES,EVENT_TYPES,EXCEPTION_TYPES,activeYear,localToday,weekday,addDays,daySlots,daySessions,isHoliday,findExamSlots,saveSlot,removeSlot,saveEvent,saveLesson,carryLesson,saveHoliday,saveTask,saveException,deletePlannerItem,setActiveYear,addAcademicYear,updateAcademicYear,scheduleBands,saveTimetableBand,removeTimetableBand,setSummerSchedule,activeScheduleMode,slotsForMode,saveEvaluationSession,calendarEventIcs} from './planner.js';
import {timetableRows,timetableFileBase,timetableWordBlob,timetablePdfBytes} from './timetable-export.js';
import {parsePatioXlsx,previewPatioRotation,addPatioRotationEvents} from './patio-rotation.js';

const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
const shortDays=['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
const longDays=['Lunes','Martes','Miércoles','Jueves','Viernes'];
const dayText=d=>new Date(`${d}T12:00:00Z`).toLocaleDateString('es-ES',{day:'numeric',month:'short',timeZone:'UTC'});
const longDate=d=>new Date(`${d}T12:00:00Z`).toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
const labels=(doc,slot)=>{const g=doc.groups.find(x=>x.id===slot.groupId);return slot.type==='class'?(g?[g.subject,g.name].filter(Boolean).join(' · '):slot.label):(slot.label||SLOT_TYPES[slot.type]);};
const eventGroup=(doc,e)=>doc.groups.find(g=>g.id===e.groupId);
const pickGroup=(doc,y)=>[...doc.groups].sort((a,b)=>Number(b.course===y.name)-Number(a.course===y.name))
  .map(g=>({value:g.id,label:`${g.subject} · ${g.name}${g.course===y.name?'':' · '+g.course}`}));
const action=(txt,attrs,cls='btn small')=>`<button type="button" class="${cls}" ${attrs}>${txt}</button>`;
const isColor=value=>typeof value==='string'&&/^#[0-9A-Fa-f]{6}$/.test(value);
const slotColor=(doc,s)=>{
 const group=doc.groups.find(g=>g.id===s.groupId);
 const accent=group&&doc.settings?.subjectAccents?.[group.level+':'+group.subject];
 return isColor(accent)?accent:isColor(s.color)?s.color:'#64748B';
};
const slotStyle=(doc,s)=>'style="--planner-color:'+esc(slotColor(doc,s))+'"';
/** Horario con filas fijas editables y celdas táctiles por día. Si existen
 * sesiones anteriores sin franja, se siguen mostrando por separado. */
export function renderTimetableGrid(doc,y){
 const bands=scheduleBands(y),active=slotsForMode(y),paired=new Set();
 const rows=bands.map(b=>{
  const cells=longDays.map((day,i)=>{
   const matches=active.filter(slot=>slot.day===i&&(slot.bandId===b.id||(!slot.bandId&&slot.start===b.start&&slot.end===b.end)));
   matches.forEach(slot=>paired.add(slot.id));
   const entries=matches.map(slot=>`<button type="button" class="planner-timetable-assignment" ${slotStyle(doc,slot)} data-edit-slot="${esc(slot.id)}" data-plan-group="${esc(slot.groupId||'')}" data-plan-type="${esc(slot.type)}" aria-label="Editar ${esc(labels(doc,slot))} del ${esc(day)} a las ${esc(b.start)}"><strong>${esc(labels(doc,slot))}</strong>${slot.room?`<small>Aula: ${esc(slot.room)}</small>`:''}</button>`).join('');
   const free=matches.length?'':action(b.kind==='break'?'+ Actividad':'+ Asignar clase',`data-band-slot="${esc(b.id)}" data-band-day="${i}" aria-label="Asignar clase o actividad el ${esc(day)} en ${esc(b.label)}"`,'planner-timetable-empty');
   const conflict=matches.length>1?'<small class="planner-overlap-warning">⚠ Asignaciones anteriores superpuestas: revisa y elimina las sobrantes.</small>':'';
   return `<td class="${b.kind==='break'?'planner-timetable-break':''}">${entries}${conflict}${free}</td>`;
  }).join('');
  return `<tr><th scope="row" class="planner-timetable-band ${b.kind==='break'?'planner-timetable-break':''}"><strong>${esc(b.label)}</strong><span>${esc(b.start)}–${esc(b.end)}</span>${action('Editar franja',`data-edit-band="${esc(b.id)}" aria-label="Editar horas de ${esc(b.label)}"`,'planner-timetable-band-edit')}</th>${cells}</tr>`;
 }).join('');
 const extras=active.filter(slot=>!paired.has(slot.id));
 return `<div class="planner-timetable-tools"><label class="planner-summer-switch"><input type="checkbox" id="plan-summer-toggle" role="switch" ${activeScheduleMode(y)==='summer'?'checked':''}/><span>Horario de verano</span></label><p class="hint">En verano: siete clases de 45 minutos, primer patio de 30 minutos y salida a las 13:45, sin segundo patio. Ambos horarios se conservan por separado. Toca una casilla para asignar una sola clase o actividad; pulsa la existente para editarla.</p><div class="planner-export-actions">${action('Word · horario','id="plan-export-word"','btn small planner-word-action')}${action('PDF · horario','id="plan-export-pdf"','btn small planner-pdf-action')}${action('+ Añadir franja','id="plan-add-band"')}</div></div>
 <div class="planner-timetable-scroll" role="region" aria-label="Horario semanal personalizable" tabindex="0"><table class="planner-timetable"><thead><tr><th scope="col">Franja</th>${longDays.map(day=>`<th scope="col">${esc(day)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>
 ${extras.length?`<section class="planner-extra-sessions"><h3>Otras sesiones guardadas</h3><p class="hint">Estas sesiones anteriores o de horario especial se conservan fuera de las franjas predeterminadas.</p><div class="planner-extra-list">${extras.map(slot=>`<div class="planner-schedule-item"><div><small>${esc(longDays[slot.day])} · ${esc(slot.start)}–${esc(slot.end)}</small><strong>${esc(labels(doc,slot))}</strong>${slot.room?`<small>Aula: ${esc(slot.room)}</small>`:''}</div>${action('Editar',`data-edit-slot="${esc(slot.id)}"`)}</div>`).join('')}</div></section>`:''}`;
}
const slotCard=(doc,y,date,s,compact=false)=>{
 const lesson=y.lessons.find(x=>x.date===date&&x.slotId===s.id),label=labels(doc,s);
 const canceled=s.exception?.type==='cancel',replacement=s.exception?.type==='replace';
 const tit=replacement?(s.exception.label||label):label;
 return `<div class="planner-slot ${canceled?'planner-cancelled':''}" ${slotStyle(doc,s)} data-plan-group="${esc(s.groupId||'')}" data-plan-type="${esc(s.type)}"><div class="planner-slot-time">${esc(s.effectiveStart)}–${esc(s.effectiveEnd)}</div><strong>${esc(tit)}</strong>${s.room?`<span class="planner-slot-room">Aula: ${esc(s.room)}</span>`:''}${canceled?'<em>Cancelada</em>':''}${replacement?'<em>Actividad sustituta</em>':''}${s.exception?`<button type="button" class="planner-exception-edit" data-edit-exception="${esc(s.exception.id)}">✎ Cambio excepcional</button>`:''}${lesson?.planned?`<span>${esc(lesson.planned.slice(0,compact?85:240))}</span>`:''}${lesson?.done?'<span class="planner-done">✓ Realizada</span>':''}<button type="button" class="planner-slot-edit" data-lesson-date="${esc(date)}" data-lesson-slot="${esc(s.id)}" aria-label="Planificar ${esc(label)} el ${esc(date)}" ${canceled?'disabled':''}>${lesson?'Editar':'+ Plan'}</button></div>`;
};
function dayItems(doc,y,date){
 const sessions=daySessions(y,date),holiday=isHoliday(y,date),events=y.events.filter(x=>x.date===date).sort((a,b)=>(a.time||'99').localeCompare(b.time||'99'));
 const tasks=y.tasks.filter(x=>x.dueDate===date),loose=y.lessons.filter(x=>x.date===date&&(!x.slotId||!!holiday));
 return `<div class="planner-day-list"><div class="planner-day-heading"><h3>${esc(longDate(date))}</h3>${action('+ Planificar','data-add-lesson="'+esc(date)+'"')}${action('+ Examen / evento','data-add-event="'+esc(date)+'"')}</div>${holiday?`<div class="planner-holiday">✦ ${esc(holiday.name)} · Sin clases programadas</div>`:''}${date<y.start||date>y.end?'<p class="hint">Fecha fuera del curso académico seleccionado.</p>':''}
 <div class="planner-slot-list">${sessions.map(s=>slotCard(doc,y,date,s)).join('')||(!holiday?'<p class="hint">No hay clases de horario para este día.</p>':'')}
 ${loose.map(l=>`<div class="planner-slot planner-manual"><strong>${esc(l.label||eventGroup(doc,l)?.subject||'Plan personal')}</strong>${holiday?'<em>Plan previo en día no lectivo</em>':''}<span>${esc(l.planned)}</span>${l.done?'<span class="planner-done">✓ Realizada</span>':''}${action('Editar',`data-edit-lesson="${esc(l.id)}"`)}</div>`).join('')}</div>
 ${events.length?`<h3>Exámenes y eventos</h3><div class="planner-event-list">${events.map(e=>eventCard(doc,e,y)).join('')}</div>`:''}
 ${tasks.length?`<h3>Recordatorios</h3><div class="planner-event-list">${tasks.map(t=>taskCard(doc,t)).join('')}</div>`:''}</div>`;
}
const eventCard=(doc,e,y)=>{
 const conflict=isHoliday(y,e.date)||y.exceptions.some(x=>x.date===e.date&&x.slotId===e.slotId&&['cancel','replace'].includes(x.type));
 return `<div class="planner-event planner-event-${esc(e.type)}"><div><strong>${esc(EVENT_TYPES[e.type])}: ${esc(e.title)}</strong><small>${esc(e.time?(e.time+(e.endTime?'–'+e.endTime:'')):'Sin hora')} ${eventGroup(doc,e)?'· '+esc(eventGroup(doc,e).subject+' · '+eventGroup(doc,e).name):''}</small>${conflict?'<small class="planner-conflict">⚠ Día no lectivo o clase sustituida. Revisa la fecha del evento.</small>':''}${e.notes?`<p>${esc(e.notes)}</p>`:''}</div>${action('Añadir a calendario',`data-export-event="${esc(e.id)}"`)}${action('Editar',`data-edit-event="${esc(e.id)}"`)}</div>`;
};
const taskCard=(doc,t)=>`<div class="planner-event"><div><strong>${t.done?'✓ ':''}${esc(t.title)}</strong>${t.notes?`<small>${esc(t.notes)}</small>`:''}</div>${action(t.done?'Reabrir':'Completar',`data-toggle-task="${esc(t.id)}"`)}${action('Editar',`data-edit-task="${esc(t.id)}"`)}</div>`;

/** Un calendario de convocatorias por grupo y trimestre, independiente de las notas.
 * Solo se ofrecen los grupos adscritos al curso académico activo. */
function evaluationOverview(doc,y){
 const groups=doc.groups.filter(g=>g.course===y.name),periods=[...doc.periods].sort((a,b)=>a.order-b.order);
 const total=groups.length*periods.length;
 const scheduled=y.events.filter(e=>e.type==='evaluation'&&groups.some(g=>g.id===e.groupId)).length;
 let html='';
 for(const group of groups)for(const period of periods){
  const event=y.events.find(e=>e.type==='evaluation'&&e.groupId===group.id&&e.periodId===period.id);
  const attrs='data-eval-group="'+esc(group.id)+'" data-eval-period="'+esc(period.id)+'"';
  html+='<div class="planner-evaluation-row"><strong>'+esc(group.subject+' · '+group.name)+'</strong>'+
   '<span>'+esc(period.name)+'</span><span class="planner-evaluation-when">'+
   (event?esc(event.date+' · '+event.time):'Sin programar')+'</span>'+
   action(event?'Editar fecha y hora':'Programar',attrs)+
   (event?action('Añadir a calendario','data-export-event="'+esc(event.id)+'"'):'')+'</div>';
 }
 return '<details id="plan-evaluations" class="panel panel-pad planner-evaluations"><summary>'+
  'Sesiones de evaluación por grupo y trimestre · '+scheduled+'/'+total+' programadas</summary>'+
  '<p class="hint">Elige fecha y hora de cada convocatoria. Son citas docentes, no se modifican las calificaciones.'+
  ' Puedes exportar cada cita a tu calendario sin compartir el cuaderno.</p>'+
  (html||'<p class="hint">Todavía no hay grupos de este curso académico.</p>')+'</details>';
}

export function renderPlanner(doc,ui){
 const y=activeYear(doc),mode=ui.plannerMode||'week',focus=ui.plannerDate||localToday();
 const start=addDays(focus,-weekday(focus));const monthStart=focus.slice(0,7)+'-01';const gridStart=addDays(monthStart,-weekday(monthStart));
 const count=y.events.length,numberClasses=slotsForMode(y).filter(s=>s.type==='class').length;
 const tools=`<div class="planner-tools">${action('+ Clase / horario','id="plan-add-slot"','btn primary')}${action('+ Examen o evento','id="plan-add-event"')}${action('Sesiones de evaluación','id="plan-show-evaluations"')}${action('Importar guardias de patio (.xlsx)','id="plan-import-patio"')}${action('+ Trabajo diario','id="plan-add-lesson"')}${action('+ Tarea','id="plan-add-task"')}${action('+ Festivo / vacaciones','id="plan-add-holiday"')}${action('+ Cambio excepcional','id="plan-add-exception"')}</div>`;
 let body='';
 if(mode==='schedule'){
  body=renderTimetableGrid(doc,y);
 } else if(mode==='day')body=dayItems(doc,y,focus);
 else if(mode==='week')body=`<div class="planner-week">${Array.from({length:5},(_,i)=>{const d=addDays(start,i),holiday=isHoliday(y,d),events=y.events.filter(e=>e.date===d);return `<section class="planner-weekday"><button type="button" class="planner-date-heading" data-go-date="${d}">${shortDays[i]} <strong>${dayText(d)}</strong></button>${holiday?`<div class="planner-holiday">${esc(holiday.name)}</div>`:''}${daySessions(y,d).map(s=>slotCard(doc,y,d,s,true)).join('')}${events.map(e=>`<div class="planner-week-event-row"><button type="button" class="planner-week-event" data-edit-event="${esc(e.id)}">${isHoliday(y,d)||y.exceptions.some(x=>x.date===d&&x.slotId===e.slotId&&['cancel','replace'].includes(x.type))?'⚠ ':''}${esc(e.time||'')} · ${esc(e.title)}</button>${action('Calendario',`data-export-event="${esc(e.id)}"`,'btn small')}</div>`).join('')}${y.tasks.filter(t=>t.dueDate===d).map(t=>`<button type="button" class="planner-week-task" data-edit-task="${esc(t.id)}">${t.done?'✓ ':'☐ '}${esc(t.title)}</button>`).join('')}${action('+ Nota',`data-add-lesson="${d}"`,'planner-add-note')}</section>`;}).join('')}</div>`;
 else{
  body=`<div class="planner-month">${shortDays.map(day=>`<div class="planner-month-head">${day}</div>`).join('')}${Array.from({length:42},(_,i)=>{const d=addDays(gridStart,i),holiday=isHoliday(y,d),events=y.events.filter(e=>e.date===d),tasks=y.tasks.filter(t=>t.dueDate===d),all=events.length+tasks.length;return `<button type="button" class="planner-month-cell ${d.slice(0,7)===focus.slice(0,7)?'':'outside'} ${d===localToday()?'today':''} ${holiday?'holiday':''}" data-go-date="${d}"><strong>${Number(d.slice(8))}</strong>${holiday?`<small>✦ ${esc(holiday.name)}</small>`:''}${events.slice(0,2).map(e=>`<span class="planner-month-dot">${esc(e.title)}</span>`).join('')}${tasks.length?`<span class="planner-month-task">${tasks.length} tarea(s)</span>`:''}${all>2?`<span class="planner-more">+${all-2}</span>`:''}</button>`;}).join('')}</div>`;
 }
 return `<div class="planner-view"><section class="panel panel-pad planner-intro"><div><div class="planner-eyebrow">Agenda docente · planificación personal</div><h2>Mi planificador</h2><p class="subtitle">Tu horario, exámenes, clases previstas y días no lectivos. El diario de clase es opcional y no altera las notas.</p></div><div class="planner-year-chooser"><label>Curso académico<select id="plan-year">${doc.planner.years.map(x=>`<option value="${esc(x.id)}" ${x.id===y.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></label>${action('Fechas',`id="plan-edit-year"`)}${action('+ Curso',`id="plan-new-year"`)}</div></section>
 <section class="panel panel-pad planner-controls"><div class="planner-view-tabs">${[['day','Hoy / día'],['week','Semana'],['month','Mes'],['schedule','Horario base']].map(([k,t])=>`<button type="button" class="planner-view-btn ${mode===k?'active':''}" data-plan-mode="${k}" aria-pressed="${mode===k}">${t}</button>`).join('')}</div><div class="planner-date-controls">${action('‹',`id="plan-prev"`)}<input type="date" id="plan-date" value="${esc(focus)}" aria-label="Fecha mostrada"/>${action('Hoy',`id="plan-today"`)}${action('›',`id="plan-next"`)}</div><p class="hint">${esc(y.start)} a ${esc(y.end)} · ${numberClasses} sesiones de clase en el horario · ${count} eventos</p>${tools}</section>
 ${evaluationOverview(doc,y)}
 <section class="panel panel-pad planner-content"><div class="planner-content-head"><h2>${mode==='schedule'?'Horario semanal'+(activeScheduleMode(y)==='summer'?' · verano':' · ordinario'):mode==='week'?'Semana del '+dayText(start):mode==='month'?new Date(monthStart+'T12:00:00Z').toLocaleDateString('es-ES',{month:'long',year:'numeric',timeZone:'UTC'}):'Agenda del día'}</h2>${mode==='schedule'?'<p class="hint">El horario se repite de lunes a viernes, excepto festivos y cambios puntuales.</p>':''}</div>${body}</section>
 <section class="panel panel-pad planner-bottom"><div><h3>Festivos y vacaciones</h3>${y.holidays.length?y.holidays.slice().sort((a,b)=>a.start.localeCompare(b.start)).map(h=>`<div class="planner-simple-row"><span>✦ ${esc(h.name)} · ${esc(h.start)}${h.end===h.start?'':' — '+esc(h.end)}</span>${action('Editar',`data-edit-holiday="${esc(h.id)}"`)}</div>`).join(''):'<p class="hint">Todavía no has señalado días no lectivos.</p>'}</div><div><h3>Tareas docentes pendientes</h3>${y.tasks.filter(t=>!t.done).sort((a,b)=>a.dueDate.localeCompare(b.dueDate)).slice(0,12).map(t=>taskCard(doc,t)).join('')||'<p class="hint">Sin tareas pendientes.</p>'}</div></section>
 ${action('Exportar agenda a calendario (.ics)',`id="plan-export-ics"`)} ${action('Imprimir calendario',`id="plan-print"`)}<p class="hint">El registro de trabajo realizado solo se guarda cuando lo marcas o escribes expresamente. Todo forma parte de la misma copia cifrada .cdoc.</p></div>`;
}
export function bindPlanner(doc,ui,ctx){
 const y=activeYear(doc),$=(selector)=>document.querySelector(selector),all=(selector)=>[...document.querySelectorAll(selector)];
 const redraw=()=>ctx.render(),move=offset=>{ui.plannerDate=addDays(ui.plannerDate||localToday(),offset);redraw();};
 const moveMonth=(step)=>{
   const value=ui.plannerDate||localToday(),[year,month,day]=value.split('-').map(Number);
   const first=new Date(Date.UTC(year,month-1+step,1));
   const end=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
   ui.plannerDate=`${first.getUTCFullYear()}-${String(first.getUTCMonth()+1).padStart(2,'0')}-${String(Math.min(day,end)).padStart(2,'0')}`;
   redraw();
 };
 const dateNow=()=>ui.plannerDate||localToday();
 all('[data-plan-group]').forEach(el=>{const g=doc.groups.find(x=>x.id===el.dataset.planGroup);if(g){const c=doc.settings.subjectAccents[`${g.level}:${g.subject}`];if(c)el.style.setProperty('--planner-color',c);}});
 all('[data-plan-mode]').forEach(b=>b.onclick=()=>{ui.plannerMode=b.dataset.planMode;if(ui.plannerMode==='day')ui.plannerDate=localToday();redraw();});
 $('#plan-year').onchange=e=>ctx.commit(d=>setActiveYear(d,e.target.value),'Cambiar curso del planificador').then(()=>{const current=activeYear(ctx.getDoc());ui.plannerDate=current.start;redraw();}).catch(ctx.fail);
 $('#plan-date').onchange=e=>{if(!e.target.value)return;ui.plannerDate=e.target.value;redraw();};
 $('#plan-today').onclick=()=>{ui.plannerMode='day';ui.plannerDate=localToday();redraw();};
 $('#plan-prev').onclick=()=>ui.plannerMode==='month'?moveMonth(-1):move(ui.plannerMode==='day'?-1:-7);
 $('#plan-next').onclick=()=>ui.plannerMode==='month'?moveMonth(1):move(ui.plannerMode==='day'?1:7);
 all('[data-go-date]').forEach(b=>b.onclick=()=>{ui.plannerDate=b.dataset.goDate;ui.plannerMode='day';redraw();});
 $('#plan-add-slot').onclick=()=>slotModal();all('[data-slot-day]').forEach(b=>b.onclick=()=>slotModal(null,Number(b.dataset.slotDay)));
 all('[data-edit-slot]').forEach(b=>b.onclick=()=>slotModal(y.slots.find(s=>s.id===b.dataset.editSlot)));
 all('[data-band-slot]').forEach(b=>b.onclick=()=>{
  const band=scheduleBands(activeYear(ctx.getDoc())).find(x=>x.id===b.dataset.bandSlot);
  if(band)slotModal(null,Number(b.dataset.bandDay),band);
 });
 all('[data-edit-band]').forEach(b=>b.onclick=()=>bandModal(scheduleBands(activeYear(ctx.getDoc())).find(x=>x.id===b.dataset.editBand)));
 $('#plan-add-band')?.addEventListener('click',()=>bandModal());
 $('#plan-summer-toggle')?.addEventListener('change',e=>{
  const enabled=e.target.checked;
  e.target.disabled=true;
  ctx.commit(d=>setSummerSchedule(d,enabled),'Alternar horario de verano').then(redraw).catch(ctx.fail);
 });
 const download=(blob,filename)=>{
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
 };
 const confirmTimetableExport=()=>window.confirm('El horario se exportará SIN CIFRAR. Guarda el archivo solo en ubicaciones locales autorizadas, no en carpetas sincronizadas. ¿Continuar?');
 $('#plan-export-word')?.addEventListener('click',async()=>{
  if(!confirmTimetableExport())return;
  try{const d=ctx.getDoc(),yr=activeYear(d),blob=await timetableWordBlob(d,yr,window.JSZip);
   download(blob,timetableFileBase(yr)+'.docx');ctx.toast('Horario Word (.docx) generado en este dispositivo.');
  }catch(error){ctx.fail(error);}
 });
 $('#plan-export-pdf')?.addEventListener('click',()=>{
  if(!confirmTimetableExport())return;
  try{const d=ctx.getDoc(),yr=activeYear(d),bytes=timetablePdfBytes(d,yr);
   download(new Blob([bytes],{type:'application/pdf'}),timetableFileBase(yr)+'.pdf');
   ctx.toast('Horario PDF generado en este dispositivo.');
  }catch(error){ctx.fail(error);}
 });
 $('#plan-add-event').onclick=()=>eventModal({date:dateNow()});
 $('#plan-show-evaluations').onclick=()=>{const overview=$('#plan-evaluations');overview.open=true;overview.scrollIntoView({block:'nearest'});};
 $('#plan-import-patio').onclick=()=>patioImportModal();
 all('[data-eval-group]').forEach(b=>b.onclick=()=>evaluationModal(b.dataset.evalGroup,b.dataset.evalPeriod));
 all('[data-add-event]').forEach(b=>b.onclick=()=>eventModal({date:b.dataset.addEvent}));
 all('[data-edit-event]').forEach(b=>b.onclick=()=>{
  const event=y.events.find(e=>e.id===b.dataset.editEvent);
  if(!event)return;
  if(event.type==='evaluation')evaluationModal(event.groupId,event.periodId);
  else eventModal({event});
 });
 all('[data-export-event]').forEach(b=>b.onclick=()=>exportSingleEvent(y.events.find(e=>e.id===b.dataset.exportEvent)));
 $('#plan-add-lesson').onclick=()=>lessonModal({date:dateNow()});
 all('[data-add-lesson]').forEach(b=>b.onclick=()=>lessonModal({date:b.dataset.addLesson}));
 all('[data-lesson-slot]').forEach(b=>b.onclick=()=>lessonModal({date:b.dataset.lessonDate,slotId:b.dataset.lessonSlot}));
 all('[data-edit-lesson]').forEach(b=>b.onclick=()=>lessonModal({lesson:y.lessons.find(l=>l.id===b.dataset.editLesson)}));
 $('#plan-add-holiday').onclick=()=>holidayModal();
 all('[data-edit-holiday]').forEach(b=>b.onclick=()=>holidayModal(y.holidays.find(h=>h.id===b.dataset.editHoliday)));
 $('#plan-add-task').onclick=()=>taskModal();all('[data-edit-task]').forEach(b=>b.onclick=()=>taskModal(y.tasks.find(t=>t.id===b.dataset.editTask)));
 all('[data-toggle-task]').forEach(b=>b.onclick=()=>{const t=y.tasks.find(t=>t.id===b.dataset.toggleTask);ctx.commit(d=>saveTask(d,{...t,done:!t.done}),'Marcar tarea').catch(ctx.fail);});
 $('#plan-add-exception').onclick=()=>exceptionModal();
 all('[data-edit-exception]').forEach(b=>b.onclick=()=>exceptionModal(y.exceptions.find(e=>e.id===b.dataset.editException)));
 $('#plan-edit-year').onclick=()=>ctx.fieldsModal('Fechas del curso académico',[{id:'name',label:'Nombre del curso',value:y.name},{id:'start',label:'Inicio de curso',type:'date',value:y.start},{id:'end',label:'Final de curso',type:'date',value:y.end}],v=>ctx.commit(d=>updateAcademicYear(d,y.id,v),'Fechas del curso'));
 $('#plan-new-year').onclick=()=>ctx.fieldsModal('Nuevo curso académico',[{id:'name',label:'Nombre (ej. 2027-2028)',value:`${Number(y.start.slice(0,4))+1}-${Number(y.start.slice(0,4))+2}`},{id:'start',label:'Fecha de inicio',type:'date',value:`${Number(y.start.slice(0,4))+1}-09-01`},{id:'end',label:'Fecha de fin',type:'date',value:`${Number(y.start.slice(0,4))+2}-06-30`},{id:'copyFrom',label:'Horario de referencia',type:'select',options:[{value:'',label:'Empezar sin horario'},...doc.planner.years.map(t=>({value:t.id,label:'Copiar horario de '+t.name}))]}],async v=>{await ctx.commit(d=>addAcademicYear(d,{...v,copyFrom:v.copyFrom||null}),'Crear curso académico');ui.plannerDate=v.start;redraw();});
 $('#plan-export-ics').onclick=()=>exportIcs();$('#plan-print').onclick=()=>window.print();
 const groupOptions=()=>[{value:'',label:'Sin grupo (personal)'},...pickGroup(ctx.getDoc(),activeYear(ctx.getDoc()))];
 const delButton=(collection,id)=>{const b=document.createElement('button');b.className='btn warn';b.type='button';b.textContent='Eliminar';b.onclick=async()=>{if(!window.confirm('¿Eliminar este elemento de la agenda? Las notas del cuaderno no cambian.'))return;ctx.dialog.close();try{await ctx.commit(d=>deletePlannerItem(d,collection,id),'Eliminar del planificador');}catch(e){ctx.fail(e);}};ctx.dialog.querySelector('.modal-actions').prepend(b);};
 function bandModal(b=null){
  ctx.fieldsModal(b?'Editar franja horaria':'Añadir franja horaria',[
   {id:'label',label:'Nombre de la franja',value:b?.label||'Nueva franja',maxlength:70},
   {id:'start',label:'Desde',type:'time',value:b?.start||'15:15'},
   {id:'end',label:'Hasta',type:'time',value:b?.end||'16:10'},
   {id:'kind',label:'Tipo',type:'select',value:b?.kind||'lesson',options:[{value:'lesson',label:'Hora lectiva'},{value:'break',label:'Patio / descanso'}]}
  ],v=>ctx.commit(d=>saveTimetableBand(d,{...v,id:b?.id||null}),'Editar franjas del horario'),
  'Las horas de las clases asignadas a esta franja se actualizarán junto a ella.');
  if(b){
   const button=document.createElement('button');
   button.type='button';button.className='btn warn';button.textContent='Eliminar franja';
   button.onclick=async()=>{
    if(!window.confirm('¿Eliminar esta franja? Las clases asignadas impedirán borrarla hasta que las retires.'))return;
    try{await ctx.commit(d=>removeTimetableBand(d,b.id),'Eliminar franja del horario');ctx.dialog.close();}
    catch(error){ctx.dialog.querySelector('.modal-error').textContent=error.message;}
   };
   ctx.dialog.querySelector('.modal-actions').prepend(button);
  }
 }
 function slotModal(s=null,selectedDay=(weekday(dateNow())<5?weekday(dateNow()):0),band=null){
  const linked=band||scheduleBands(y).find(x=>x.id===s?.bandId);
  ctx.fieldsModal(s?'Editar sesión semanal':'Asignar clase o actividad',[
   {id:'day',label:'Día',type:'select',value:String(s?.day??selectedDay),options:longDays.map((l,i)=>({value:String(i),label:l}))},
   {id:'start',label:'Desde',type:'time',value:s?.start||linked?.start||'08:00'},
   {id:'end',label:'Hasta',type:'time',value:s?.end||linked?.end||'08:55'},
   {id:'type',label:'Tipo',type:'select',value:s?.type||(linked?.kind==='break'?'otro':'class'),options:Object.entries(SLOT_TYPES).map(([value,label])=>({value,label}))},
   {id:'groupId',label:'Clase del cuaderno (opcional)',type:'select',required:false,value:s?.groupId||'',options:groupOptions()},
   {id:'label',label:'Otra asignatura / actividad (si no eliges clase)',required:false,value:s?.label||(linked?.kind==='break'?'Patio':'')},
   {id:'room',label:'Aula (opcional)',required:false,value:s?.room||'',maxlength:60},
   {id:'color',label:'Color de actividad sin grupo (guardias, otras materias...)',type:'color',required:false,value:isColor(s?.color)?s.color:'#64748B'}
  ],v=>ctx.commit(d=>{
   const validBand=linked&&v.start===linked.start&&v.end===linked.end?linked.id:null;
   saveSlot(d,{...v,id:s?.id||null,groupId:v.groupId||null,bandId:validBand});
  },'Configurar horario'),
  'Solo se permite una clase o actividad por franja. Puedes elegir colores para guardias y actividades sin grupo. Los cambios en este horario no alteran el otro.');
  if(s){
   const button=document.createElement('button');button.className='btn warn';button.type='button';button.textContent='Eliminar sesión';
   button.onclick=async()=>{
    if(!window.confirm('¿Eliminar esta sesión semanal? Los planes ya escritos conservarán su fecha y texto.'))return;
    try{await ctx.commit(d=>removeSlot(d,s.id),'Eliminar sesión del horario');ctx.dialog.close();}
    catch(error){ctx.dialog.querySelector('.modal-error').textContent=error.message;}
   };
   ctx.dialog.querySelector('.modal-actions').prepend(button);
  }
 }
 function holidayModal(h=null){ctx.fieldsModal(h?'Editar día no lectivo':'Añadir festivo o vacaciones',[{id:'name',label:'Motivo',value:h?.name||'Festivo'},{id:'start',label:'Desde',type:'date',value:h?.start||dateNow()},{id:'end',label:'Hasta (mismo día si es festivo suelto)',type:'date',value:h?.end||dateNow()}],v=>ctx.commit(d=>saveHoliday(d,{...v,id:h?.id||null}),'Festivo o vacaciones'));if(h)delButton('holidays',h.id);}
 function taskModal(t=null){ctx.fieldsModal(t?'Editar recordatorio':'Nueva tarea personal',[{id:'title',label:'Tarea',value:t?.title||''},{id:'dueDate',label:'Fecha prevista',type:'date',value:t?.dueDate||dateNow()},{id:'groupId',label:'Grupo (opcional)',type:'select',required:false,value:t?.groupId||'',options:groupOptions()},{id:'notes',label:'Observaciones',required:false,value:t?.notes||''},{id:'done',label:'Estado',type:'select',value:String(t?.done||false),options:[{value:'false',label:'Pendiente'},{value:'true',label:'Realizada'}]}],v=>ctx.commit(d=>saveTask(d,{...v,id:t?.id||null,groupId:v.groupId||null,done:v.done==='true'}),'Tarea personal'));if(t)delButton('tasks',t.id);}
 function exceptionModal(existing=null){
  const date=existing?.date||dateNow(),sessions=daySlots(y,date);
  if(!sessions.length)return ctx.toast('Elige un día lectivo con sesiones para introducir el cambio.');
  ctx.fieldsModal(existing?'Editar cambio excepcional':'Cambio excepcional de clase',[
   {id:'date',label:'Fecha',type:'date',value:date},
   {id:'slotId',label:'Sesión afectada',type:'select',value:existing?.slotId||sessions[0].id,options:sessions.map(s=>({value:s.id,label:s.start+' · '+labels(doc,s)}))},
   {id:'type',label:'Tipo',type:'select',value:existing?.type||'cancel',options:Object.entries(EXCEPTION_TYPES).map(([value,label])=>({value,label}))},
   {id:'label',label:'Actividad sustituta (solo en sustitución)',required:false,value:existing?.label||'Actividad del centro'},
   {id:'start',label:'Nueva hora de inicio (solo en cambio de hora)',type:'time',required:false,value:existing?.start||''},
   {id:'end',label:'Nueva hora de fin (solo en cambio de hora)',type:'time',required:false,value:existing?.end||''}
  ],v=>ctx.commit(d=>saveException(d,{...v,id:existing?.id||null}),'Cambio excepcional de horario'));
  if(existing)delButton('exceptions',existing.id);
 }

 function lessonModal({date=dateNow(),slotId=null,lesson=null}={}){
  const existing=lesson||y.lessons.find(l=>l.date===date&&l.slotId===slotId&&slotId);const boundSlot=y.slots.find(s=>s.id===(existing?.slotId||slotId));const groupId=existing?.groupId||boundSlot?.groupId||null;
  const assignedDate=existing?.date||date;
  ctx.dialog.innerHTML=`<form class="modal-inner" id="planner-lesson-form"><h2 id="modal-heading">${existing?'Editar':'Planificar'} trabajo diario</h2><p class="subtitle">Agenda personal. El registro de clase impartida es totalmente opcional.</p><div class="modal-fields"><label>Fecha<input class="text-field" name="date" type="date" required value="${esc(assignedDate)}" ${boundSlot?'readonly':''}/></label>${boundSlot?`<p class="planner-modal-slot">${esc(boundSlot.start)} · ${esc(labels(doc,boundSlot))}</p>`:`<label>Asignatura o grupo<select name="groupId" id="planner-lesson-group">${groupOptions().map(o=>`<option value="${esc(o.value)}" ${o.value===groupId?'selected':''}>${esc(o.label)}</option>`).join('')}</select></label><label>Nombre manual (si no hay grupo)<input class="text-field" name="label" value="${esc(existing?.label||'')}"/></label>`}<label>¿Qué voy a hacer?<textarea class="text-field" name="planned" rows="4" maxlength="4000" placeholder="Ejemplo: adjetivos latinos; ejercicios de la UD5">${esc(existing?.planned||'')}</textarea></label><label>¿Se ha realizado?<select name="done"><option value="false" ${existing?.done?'':'selected'}>Pendiente / no registrar</option><option value="true" ${existing?.done?'selected':''}>Realizada</option></select></label><label>Trabajo realmente impartido (opcional)<textarea class="text-field" name="actual" rows="3" maxlength="4000" placeholder="Se rellena solo si quieres llevar diario de aula">${esc(existing?.actual||'')}</textarea></label></div><div class="modal-error" role="alert"></div><div class="modal-actions"><button type="button" class="btn" id="planner-cancel-lesson">Cancelar</button><button type="submit" class="btn primary">Guardar plan</button></div></form>`;
  ctx.dialog.querySelector('#planner-cancel-lesson').onclick=()=>ctx.dialog.close();
  ctx.dialog.querySelector('form').onsubmit=async ev=>{ev.preventDefault();const fd=Object.fromEntries(new FormData(ev.currentTarget));try{await ctx.commit(d=>saveLesson(d,{...fd,id:existing?.id||null,slotId:boundSlot?.id||null,groupId:boundSlot?.groupId||fd.groupId||null,done:fd.done==='true'}),'Planificar clase');ctx.dialog.close();}catch(e){ctx.dialog.querySelector('.modal-error').textContent=e.message;}};
  if(existing){const bar=ctx.dialog.querySelector('.modal-actions');const deletion=document.createElement('button');deletion.type='button';deletion.className='btn warn';deletion.textContent='Eliminar';deletion.onclick=async()=>{if(!window.confirm('Eliminar esta anotación de clase?'))return;ctx.dialog.close();try{await ctx.commit(d=>deletePlannerItem(d,'lessons',existing.id),'Eliminar planificación');}catch(e){ctx.fail(e);}};bar.prepend(deletion);
   if(existing.slotId&&!existing.done){const carry=document.createElement('button');carry.type='button';carry.className='btn';carry.textContent='→ Siguiente clase';carry.onclick=async()=>{try{await ctx.commit(d=>carryLesson(d,existing.id),'Trasladar planificación a próxima clase');ctx.dialog.close();ctx.toast('Plan trasladado a la siguiente sesión lectiva.');}catch(e){ctx.dialog.querySelector('.modal-error').textContent=e.message;}};bar.prepend(carry);}
  }
  ctx.dialog.showModal();
 }


 /** El Excel se procesa en memoria, solo se guardan las fechas y las zonas
  * confirmadas; ni el archivo ni los nombres del resto del profesorado salen del iPad. */
 function patioImportModal(){
  const book=ctx.getDoc(),year=activeYear(book),today=localToday();
  const initial=today<year.start?year.start:today>year.end?year.start:today;
  ctx.dialog.innerHTML='<div class="modal-inner patio-import-modal">'+
   '<h2 id="modal-heading">Importar guardias rotatorias de patio</h2>'+
   '<p class="subtitle">Se analiza el Excel en este dispositivo. El marcador identifica exclusivamente tus días de guardia; no se guardarán los nombres de otros docentes.</p>'+
   '<form id="patio-import-form"><div class="modal-fields">'+
    '<label>Excel de guardias (.xlsx)<input class="text-field" id="patio-file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required></label>'+
    '<label>Marcador de tus guardias en el Excel<input class="text-field" id="patio-marker" maxlength="80" required value="yo"></label>'+
    '<label>Generar desde<input class="text-field" id="patio-from" type="date" min="'+esc(year.start)+'" max="'+esc(year.end)+'" value="'+esc(initial)+'" required></label>'+
    '<label>Hasta (elige la fecha final del curso)<input class="text-field" id="patio-to" type="date" min="'+esc(year.start)+'" max="'+esc(year.end)+'" required></label>'+
    '<label>Inicio del horario de verano (opcional)<input class="text-field" id="patio-summer" type="date" min="'+esc(year.start)+'" max="'+esc(year.end)+'"></label>'+
    '<label class="patio-holiday-control"><input id="patio-skip" type="checkbox" checked> Omitir festivos y vacaciones marcados en esta agenda</label>'+
   '</div>'+
   '<p class="hint">La rotación avanza por semanas naturales incluso durante las vacaciones. El horario ordinario usa el primer patio habitual y la fecha opcional de verano cambia a su franja correspondiente. Las guardias existentes no se sobrescriben.</p>'+
   '<p class="hint">El archivo no determina automáticamente todas las vacaciones ni la fecha de fin de curso: revisa ambos datos.</p>'+
   '<div class="modal-error" id="patio-import-error" role="alert"></div>'+
   '<div class="modal-actions"><button type="button" class="btn" id="patio-cancel">Cancelar</button>'+
   '<button type="submit" class="btn" id="patio-preview">Revisar asignaciones</button>'+
   '<button type="button" class="btn primary" id="patio-apply" disabled>Confirmar e incorporar</button></div></form>'+
   '<div id="patio-preview-results" aria-live="polite" hidden></div></div>';
  const $p=id=>ctx.dialog.querySelector('#'+id),form=$p('patio-import-form');
  const error=$p('patio-import-error'),out=$p('patio-preview-results'),apply=$p('patio-apply');
  let prepared=null;
  const reset=()=>{prepared=null;apply.disabled=true;out.hidden=true;out.innerHTML='';error.textContent='';};
  for(const input of form.querySelectorAll('input'))input.addEventListener('change',reset);
  $p('patio-cancel').onclick=()=>ctx.dialog.close();
  const options=()=>({from:$p('patio-from').value,to:$p('patio-to').value,
   summerFrom:$p('patio-summer').value,skipHolidays:$p('patio-skip').checked});
  form.onsubmit=async event=>{
   event.preventDefault();reset();const button=$p('patio-preview');button.disabled=true;
   try{
    const file=$p('patio-file').files[0];
    if(!file||!/\.xlsx$/i.test(file.name)||file.size>3_000_000)throw new Error('Selecciona un Excel .xlsx de hasta 3 MB.');
    const template=await parsePatioXlsx(await file.arrayBuffer(),{marker:$p('patio-marker').value});
    const config=options(),preview=previewPatioRotation(ctx.getDoc(),template,config);
    prepared={template,config,preview};
    const days=['Lunes','Martes','Miércoles','Jueves','Viernes'];
    const details=preview.entries.map(item=>
     '<tr><td>'+esc(item.date)+' · '+esc(days[item.day])+'</td>'+
     '<td>'+esc(item.start+'–'+item.end)+'</td><td>'+esc(item.zone)+'</td>'+
     '<td>'+esc(item.rainZone)+'</td>'+
     '<td>'+esc(item.existingId?'Ya programada':'Nueva')+'</td></tr>').join('');
    out.hidden=false;
    out.innerHTML='<h3>Vista previa de la rotación</h3>'+
     '<p class="hint">Primer lunes del Excel: '+esc(template.firstMonday)+
     '. Desplazamiento: '+esc(template.shift)+' puestos por semana; ciclo de '+
     esc(template.cycleWeeks)+' semanas. Días asignados: '+
     esc(preview.weekdays.map(d=>days[d]).join(', '))+'.</p>'+
     '<p><strong>'+esc(preview.entries.length-preview.existing)+' guardias nuevas</strong>'+
     ' · '+esc(preview.existing)+' ya programadas (no se sobrescribirán)'+
     ' · '+esc(preview.excluded)+' fechas omitidas por festivos.</p>'+
     (preview.secondCount?'<p class="hint">Atención: tu marcador aparece también en el segundo patio; esas guardias NO se importan con este formato.</p>':'')+
     '<div class="patio-preview-scroll"><table class="patio-preview-table"><thead><tr>'+
     '<th>Fecha</th><th>Hora</th><th>Zona habitual</th><th>Con lluvia o viento</th><th>Resultado</th>'+
     '</tr></thead><tbody>'+details+'</tbody></table></div>'+
     '<p class="hint">Comprueba las zonas, las vacaciones y el último día del curso antes de incorporar. Los datos se guardarán cifrados con tu cuaderno.</p>';
    apply.disabled=preview.entries.length===preview.existing;
   }catch(err){error.textContent=err.message||'No se ha podido interpretar la rotación.';}
   finally{button.disabled=false;}
  };
  apply.onclick=async()=>{
   if(!prepared)return;
   if(!window.confirm('¿Incorporar las guardias revisadas a la agenda del cuaderno cifrado? No se sustituirá ninguna guardia existente.'))return;
   apply.disabled=true;
   try{
    const {template,config}=prepared;
    await ctx.commit(d=>addPatioRotationEvents(d,previewPatioRotation(d,template,config)),'Importar guardias rotatorias de patio');
    ctx.dialog.close();
    ctx.toast('Guardias incorporadas. Revisa la agenda y verifica una copia cifrada del cuaderno.');
   }catch(err){error.textContent=err.message;apply.disabled=false;}
  };
  ctx.dialog.showModal();
 }

 function evaluationModal(groupId,periodId){
  const current=activeYear(ctx.getDoc()),group=ctx.getDoc().groups.find(g=>g.id===groupId&&g.course===current.name);
  const period=ctx.getDoc().periods.find(p=>p.id===periodId);
  if(!group||!period){ctx.fail(new Error('Grupo o evaluación ya no disponibles en este curso.'));return;}
  const existing=current.events.find(e=>e.type==='evaluation'&&e.groupId===groupId&&e.periodId===periodId);
  const today=dateNow(),date=existing?.date||(today>=current.start&&today<=current.end?today:current.start);
  ctx.fieldsModal('Sesión de evaluación · '+group.name+' · '+period.name,[
   {id:'date',label:'Día de la sesión',type:'date',value:date},
   {id:'time',label:'Hora de inicio',type:'time',value:existing?.time||'15:30'},
   {id:'notes',label:'Lugar o indicaciones (opcional)',required:false,value:existing?.notes||'',maxlength:1000}
  ],values=>ctx.commit(d=>saveEvaluationSession(d,{
   id:existing?.id||null,groupId,periodId,...values
  }),'Programar sesión de evaluación'),
  'La convocatoria aparecerá en las vistas de día, semana y mes. Su hora no depende de las clases del horario.');
  if(existing)delButton('events',existing.id);
 }
 function exportSingleEvent(event){
  if(!event)return;
  if(!window.confirm('Se generará un archivo .ics SIN CIFRAR con el título, fecha, hora y observaciones de esta cita. No incluyas datos personales de alumnos ni lo guardes en servicios no autorizados. ¿Continuar?'))return;
  try{
   const ics=calendarEventIcs(event);
   const filename='AppNotas-evento-'+event.date+'-'+event.id.slice(0,8)+'.ics';
   download(new Blob([ics],{type:'text/calendar;charset=utf-8'}),filename);
   ctx.toast('Cita exportada. Abre el archivo .ics e impórtalo en el calendario que elijas. No existe sincronización automática.');
  }catch(error){ctx.fail(error);}
 }

 function eventModal({date=dateNow(),event=null,assessmentId=null,groupId=null}={}){
  const fixedGroup=groupId||event?.groupId||null,kind=event?.type||'exam',title=event?.title||ctx.getDoc().assessments.find(a=>a.id===assessmentId)?.name||'';
  ctx.dialog.innerHTML=`<form class="modal-inner" id="planner-event-form"><h2 id="modal-heading">${event?'Editar':'Programar'} examen o evento</h2><p class="subtitle">Elige un grupo y una fecha. Si hay una sola clase en el horario, se toma su hora automáticamente.</p><div class="modal-fields"><label>Tipo<select name="type">${Object.entries(EVENT_TYPES).filter(([value])=>value!=='evaluation').map(([v,t])=>`<option value="${v}" ${v===kind?'selected':''}>${esc(t)}</option>`).join('')}</select></label><label>Nombre<input name="title" class="text-field" required maxlength="150" value="${esc(title)}" placeholder="Examen parcial"/></label><label>Fecha<input name="date" class="text-field" type="date" required value="${esc(event?.date||date)}"/></label><label>Grupo (opcional para reuniones)<select name="groupId"><option value="">Sin grupo</option>${pickGroup(ctx.getDoc(),activeYear(ctx.getDoc())).map(g=>`<option value="${esc(g.value)}" ${g.value===fixedGroup?'selected':''}>${esc(g.label)}</option>`).join('')}</select></label><label>Actividad del cuaderno (opcional)<select name="assessmentId"><option value="">Sin vincular</option></select></label><label>Clase del horario<select name="slotId"><option value="">Hora manual / sin horario</option></select></label><div id="planner-slot-message" class="hint"></div><label>Hora manual (solo si no hay clase vinculada)<input name="time" type="time" class="text-field" value="${esc(event?.time||'')}"/></label><label>Hora de finalización (opcional; se propone una hora si se deja vacía)<input name="endTime" type="time" class="text-field" value="${esc(event?.endTime||'')}"/></label><label>Observaciones<textarea name="notes" class="text-field" maxlength="4000" rows="3">${esc(event?.notes||'')}</textarea></label></div><div class="modal-error" role="alert"></div><div class="modal-actions"><button type="button" class="btn" id="planner-cancel-event">Cancelar</button><button type="submit" class="btn primary">Guardar evento</button></div></form>`;
  const form=ctx.dialog.querySelector('form'),fields=form.elements;
  const refresh=()=>{
   const selected=fields.assessmentId.value||assessmentId||event?.assessmentId||'';
   const entries=ctx.getDoc().assessments.filter(a=>a.groupId===fields.groupId.value);
   fields.assessmentId.innerHTML='<option value="">Sin vincular</option>'+entries.map(a=>`<option value="${esc(a.id)}" ${selected===a.id?'selected':''}>${esc(a.name)}</option>`).join('');
   const previous=fields.slotId.value||event?.slotId||'';const matches=fields.groupId.value?findExamSlots(activeYear(ctx.getDoc()),fields.groupId.value,fields.date.value):[];
   let chosen='';
   if(matches.length===1)chosen=matches[0].id;
   else if(matches.some(s=>s.id===previous))chosen=previous;
   fields.slotId.innerHTML='<option value="">'+(matches.length>1?'Seleccionar clase / hora manual':'Hora manual / sin horario')+'</option>'+matches.map(s=>`<option value="${esc(s.id)}" ${s.id===chosen?'selected':''}>${esc(s.effectiveStart)}–${esc(s.effectiveEnd)} · ${esc(labels(doc,s))}</option>`).join('');
   form.querySelector('#planner-slot-message').textContent=matches.length===1?'Hora del horario: '+matches[0].effectiveStart:matches.length>1?'Hay varias sesiones de ese grupo: elige una.':'No hay clase del grupo en esa fecha: puedes introducir la hora manualmente.';
   fields.time.disabled=!!chosen;
   if(chosen)fields.time.value=matches.find(s=>s.id===chosen)?.effectiveStart||'';
   else if(!event&&previous&&!matches.some(s=>s.id===previous))fields.time.value='';
  };
  fields.groupId.onchange=refresh;fields.date.onchange=refresh;fields.slotId.onchange=()=>{const match=activeYear(ctx.getDoc()).slots.find(s=>s.id===fields.slotId.value);fields.time.disabled=!!match;if(match)fields.time.value=activeYear(ctx.getDoc()).exceptions.find(e=>e.date===fields.date.value&&e.slotId===match.id&&e.type==='move')?.start||match.start;};
  form.querySelector('#planner-cancel-event').onclick=()=>ctx.dialog.close();
  form.onsubmit=async ev=>{ev.preventDefault();const v=Object.fromEntries(new FormData(form));try{if(v.type==='exam'&&v.groupId&&!v.slotId&&!v.time)throw new Error('El examen necesita una hora. Selecciona la sesión del horario o escribe una hora manual.');await ctx.commit(d=>saveEvent(d,{...v,id:event?.id||null,slotId:v.slotId||null,groupId:v.groupId||null,assessmentId:v.type==='exam'?v.assessmentId||null:null,time:v.slotId?'':v.time,endTime:v.endTime||''}),'Programar examen o evento');ctx.dialog.close();}catch(e){form.querySelector('.modal-error').textContent=e.message;}};
  if(event)delButton('events',event.id);
  ctx.dialog.showModal();refresh();
 }
 function exportIcs(){
   if(!window.confirm('El calendario .ics se descargará SIN CIFRAR y podrá contener títulos o notas personales. ¿Continuar?'))return;
   const events=[...y.events.map(e=>({id:e.id,date:e.date,time:e.time,endTime:e.endTime,title:`${EVENT_TYPES[e.type]}: ${e.title}`,detail:e.notes})),...y.tasks.map(t=>({id:t.id,date:t.dueDate,title:'Tarea docente: '+t.title,detail:t.notes}))];
   const clean=t=>String(t||'').replace(/\r\n?/g,'\n').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
   const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//CuadernoDocente//Planificador//ES','CALSCALE:GREGORIAN'];
   for(const e of events){
     const ymd=e.date.replaceAll('-',''),next=addDays(e.date,1).replaceAll('-','');
     const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
     const start=e.time?`${ymd}T${e.time.replace(':','')}00`:ymd;
     const hourEnd=e.time?Math.floor((Number(e.time.slice(0,2))*60+Number(e.time.slice(3))+60)/1440):0;
     const endMinutes=e.time?(e.endTime?Number(e.endTime.slice(0,2))*60+Number(e.endTime.slice(3)):(Number(e.time.slice(0,2))*60+Number(e.time.slice(3))+60)%1440):0;
     const endDate=e.time&&!e.endTime&&hourEnd?next:ymd;
     const endTime=e.time?`${endDate}T${String(Math.floor(endMinutes/60)).padStart(2,'0')}${String(endMinutes%60).padStart(2,'0')}00`:next;
     lines.push('BEGIN:VEVENT',`UID:${e.id}@cuadernodocente.local`,`DTSTAMP:${stamp}`,e.time?`DTSTART:${start}`:`DTSTART;VALUE=DATE:${start}`,e.time?`DTEND:${endTime}`:`DTEND;VALUE=DATE:${endTime}`,`SUMMARY:${clean(e.title)}`,`DESCRIPTION:${clean(e.detail)}`,'END:VEVENT');
   }
   lines.push('END:VCALENDAR');const foldIcsLine=line=>{let out='',bytes=0;const encoder=new TextEncoder();for(const ch of line){const size=encoder.encode(ch).length;if(bytes+size>75){out+='\r\n ';bytes=1;}out+=ch;bytes+=size;}return out;};const blob=new Blob([lines.map(foldIcsLine).join('\r\n')+'\r\n'],{type:'text/calendar;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`CuadernoDocente-agenda-${y.name}.ics`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
   ctx.toast('Archivo .ics generado. Importa manualmente en Apple Calendar o en tu calendario habitual.');
 }

 return {eventModal};
}
