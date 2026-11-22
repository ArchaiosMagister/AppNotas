import {sessionPresentation} from './evaluation-session-presentation.js';
import {normalizeStudentName as normalize, tutorshipEvent, tutorshipLegacyEvents} from './evaluation-groups.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({
 '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[ch]));
const spanishDate=iso=>iso.slice(8,10)+'/'+iso.slice(5,7)+'/'+iso.slice(0,4);
const when=event=>spanishDate(event.date)+' · '+event.time+(event.endTime?'–'+event.endTime:'');
const sameOrigin=(a,b)=>normalize(a||'')===normalize(b||'');
const matchingEvents=(year,groupId,originGroup,periodId)=>year.events.filter(event=>
 event.type==='evaluation'&&!event.tutorshipId&&event.groupId===groupId&&
 event.periodId===periodId&&sameOrigin(event.originGroup,originGroup));
const uniqueEvents=events=>[...new Map(events.map(e=>[e.id,e])).values()]
 .sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time));
const sourceName=(doc,event)=>doc.groups.find(g=>g.id===event.groupId)?.subject||'Materia';

/** Solo lectura. El curso se resuelve desde el grupo seleccionado,
 * nunca desde el curso activo de Agenda (que puede ser diferente).
 * No se inventa una fecha común si hay convocatorias distintas. */
export function notebookEvaluationDates(doc,groupId,periodId){
 const group=doc.groups.find(g=>g.id===groupId);
 const period=doc.periods.find(p=>p.id===periodId);
 if(!group||!period)return null;
 const year=doc.planner?.years.find(y=>y.name===group.course);
 if(!year)return {period,year:null,rows:[]};
 const cards=sessionPresentation(doc,year).filter(card=>
  card.sources.some(s=>s.groupId===groupId));
 const rows=cards.map(card=>{
  const selected=card.sources.filter(s=>s.groupId===groupId);
  if(card.kind==='confirmed'){
   const main=tutorshipEvent(doc,card.tutorship.id,periodId);
   const legacy=tutorshipLegacyEvents(doc,card.tutorship.id,periodId);
   return {name:card.name,kind:card.kind,events:main?[main]:[],
    legacy:uniqueEvents(legacy),review:legacy.length>0,reason:legacy.length?'Citas anteriores por unificar':''};
  }
  const events=uniqueEvents(selected.flatMap(s=>matchingEvents(year,s.groupId,s.originGroup,periodId)));
  return {name:card.name,kind:card.kind,events,legacy:[],
   review:card.kind==='suggested',reason:card.kind==='suggested'?'Tutoría pendiente de confirmar':''};
 });
 return {period,year,rows};
}
const formattedEvent=(event,withSubject=false,doc)=>esc((withSubject?sourceName(doc,event)+' · ':'')+when(event));
const rowText=(row,doc)=>{
 if(row.events.length){
  const multiple=row.events.length>1;
  const dates=row.events.map(e=>formattedEvent(e,multiple,doc)).join(' · ');
  return dates+(row.review?' · <span class="notebook-eval-warning">'+esc(row.reason)+'</span>':'');
 }
 if(row.legacy.length)
  return '<span class="notebook-eval-warning">Por unificar:</span> '+
   row.legacy.map(e=>formattedEvent(e,true,doc)).join(' · ');
 return '<span class="notebook-eval-unset">Sin programar</span>'+
  (row.review?' · <span class="notebook-eval-warning">'+esc(row.reason)+'</span>':'');
};
/** Nota breve bajo las pestañas del cuaderno; todas las fechas abren
 * Sesiones de evaluación, sin permitir alterar notas desde esta vista. */
export function renderNotebookEvaluationNotice(doc,groupId,periodId){
 const data=notebookEvaluationDates(doc,groupId,periodId);
 if(!data)return '';
 const {period,year,rows}=data,summary='Sesión de '+period.name+':';
 const items=!year?
  '<span class="notebook-eval-unset">Curso sin Agenda configurada</span>':
  !rows.length?'<span class="notebook-eval-unset">Sin grupos de evaluación</span>':
  rows.map(row=>'<span class="notebook-eval-entry">'+
    (rows.length>1?'<span class="notebook-eval-group">'+esc(row.name)+':</span> ':'')+
    rowText(row,doc)+'</span>').join('');
 const content=year?'<button type="button" class="notebook-eval-list notebook-eval-open" '+
  'data-notebook-evaluation-open="'+esc(periodId)+'" data-notebook-evaluation-year="'+esc(year.id)+
  '" title="Abrir esta evaluación en Sesiones de evaluación" aria-label="Abrir las convocatorias de '+esc(period.name)+
  ' en Sesiones de evaluación">'+items+
  '<span class="notebook-eval-direction" aria-hidden="true">↗</span></button>':
  '<span class="notebook-eval-list">'+items+'</span>';
 return '<aside class="notebook-eval-notice" aria-label="Fecha de la sesión de evaluación">'+
  '<span class="notebook-eval-icon" aria-hidden="true">◷</span>'+
  '<span class="notebook-eval-label">'+esc(summary)+'</span>'+content+'</aside>';
}
