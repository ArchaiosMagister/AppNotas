import {sessionPresentation} from './evaluation-session-presentation.js';
import {tutorshipEvent,tutorshipLegacyEvents} from './evaluation-groups.js';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const button=(title,attrs,cls='btn small')=>
 '<button type="button" class="'+cls+'" '+attrs+'>'+esc(title)+'</button>';
const when=e=>e.date+' · '+e.time+(e.endTime?'–'+e.endTime:'');
const subjects=card=>[...new Set(card.sources.map(s=>s.group?.subject||'Materia anterior'))].join(' · ');
const sourceEvents=(year,source,periodId)=>year.events.filter(e=>
 e.type==='evaluation'&&!e.tutorshipId&&e.periodId===periodId&&
 e.groupId===source.groupId&&(e.originGroup||'')===(source.originGroup||''));
const eventDetails=(event)=>event
 ?'<div class="eval-period-appointment"><span class="eval-period-date">'+esc(event.date)+'</span>'+
   '<span class="eval-period-hour">'+esc(event.time+(event.endTime?'–'+event.endTime:''))+'</span></div>'
 :'<div class="eval-period-unscheduled">Sin programar</div>';
const legacyDetails=(doc,events)=>events.length?
 '<div class="eval-period-legacy" aria-label="Convocatorias anteriores por revisar">'+
 events.map(e=>{const g=doc.groups.find(g=>g.id===e.groupId);return '<div><strong>'+
  esc(g?.subject||'Materia')+'</strong> · '+esc(when(e))+'</div>';}).join('')+
 '</div>':'';

/** Una tarjeta por grupo/tutoría EN CADA evaluación. Solo presentación:
 * no se vinculan alumnos ni se decide qué convocatoria histórica prevalece. */
function periodCard(doc,year,period,card){
 const title=card.name,subtitle=subjects(card),t=card.tutorship;
 const intro='<div class="eval-period-card-head"><div class="eval-period-card-label"><strong>'+
  esc(title)+'</strong><small>'+esc(subtitle)+'</small></div></div>';
 let status='',details='',actions='',extra='';
 if(t){
  const event=tutorshipEvent(doc,t.id,period.id);
  const previous=tutorshipLegacyEvents(doc,t.id,period.id);
  status=previous.length&&!event?'Pendiente de unificar':event?'Programada':'Sin programar';
  details=previous.length&&!event?'<div class="eval-period-unscheduled">Sin convocatoria común</div>':eventDetails(event);
  if(previous.length){
   extra='<p class="eval-period-caution">'+
    (event?'Hay convocatorias anteriores pendientes de revisar.':
     'Hay '+previous.length+' convocatorias de asignaturas por unificar.')+'</p>'+
    legacyDetails(doc,previous);
  }
  actions=(previous.length&&!event?
   button('Unificar convocatorias','data-eval-consolidate="'+esc(t.id)+
    '" data-eval-period="'+esc(period.id)+'"','btn small primary'):
   button(event?'Editar sesión':'Programar sesión','data-eval-tutor-session="'+esc(t.id)+
    '" data-eval-period="'+esc(period.id)+'"','btn small primary'))+
   (event?button('Calendario','data-eval-tutor-export="'+esc(event.id)+'"'):'')+
   button('Ver notas','data-eval-open-tutor="'+esc(t.id)+'" data-eval-period="'+esc(period.id)+'"');
 }else{
  const pairs=card.sources.map(source=>({source,events:sourceEvents(year,source,period.id)}));
  if(card.kind==='suggested'){
   status='Coincidencia pendiente de confirmar';
   details='<div class="eval-period-source-list">'+pairs.map(({source,events})=>{
    const event=events[0],canEdit=source.students>0||events.length>0;
    const attrs='data-eval-group="'+esc(source.groupId)+'" data-eval-period="'+esc(period.id)+
     '" data-eval-origin="'+esc(source.originGroup)+'"';
    return '<div class="eval-period-source"><span class="eval-period-source-heading"><strong>'+
     esc(source.group.subject)+'</strong><small>'+esc(event?when(event):'Sin programar')+'</small></span>'+
     (canEdit?button(event?'Editar':'Programar',attrs):'<small>Sin alumnado</small>')+
     events.map(e=>button('Calendario','data-export-event="'+esc(e.id)+'"')).join('')+'</div>';
   }).join('')+'</div>';
   actions=button('Revisar tutoría','data-eval-switch-tab="tutorias"');
  }else{
   const source=pairs[0]?.source,event=pairs[0]?.events[0];
   status=event?'Programada':'Sin programar';details=eventDetails(event);
   const attrs='data-eval-group="'+esc(source.groupId)+'" data-eval-period="'+esc(period.id)+
    '" data-eval-origin="'+esc(source.originGroup)+'"';
   const canEdit=source.students>0||pairs[0].events.length>0;
   actions=canEdit?button(event?'Editar sesión':'Programar sesión',attrs,'btn small primary'):
    '<span class="hint">Sin alumnado en esta procedencia</span>';
   actions+=(event?button('Calendario','data-export-event="'+esc(event.id)+'"'):'');
  }
 }
 return '<article class="eval-period-small-card" data-eval-group-card="'+esc(card.id)+'" '+
  'data-eval-card-status="'+esc(status)+'">'+intro+
  '<span class="eval-period-status">'+esc(status)+'</span>'+details+extra+
  '<div class="eval-period-actions">'+actions+'</div></article>';
}
/** El orden académico determina las secciones: 1.ª, 2.ª, 3.ª evaluación.
 * Cada una muestra todas las tutorías elegibles sin duplicar materias confirmadas. */
export function renderEvaluationPeriodBoard(doc,year){
 const cards=sessionPresentation(doc,year),periods=[...doc.periods].sort((a,b)=>a.order-b.order);
 const content=periods.map(period=>{
  const events=year.events.filter(e=>e.type==='evaluation'&&e.periodId===period.id);
  return '<section class="eval-period-section" data-evaluation-section="'+esc(period.id)+'">'+
   '<div class="eval-period-section-head"><h3>'+esc(period.name)+'</h3><span>'+
   esc(cards.length+' '+(cards.length===1?'grupo':'grupos')+' · '+events.length+
    ' '+(events.length===1?'cita':'citas'))+'</span></div>'+
   '<div class="eval-period-cards">'+cards.map(card=>periodCard(doc,year,period,card)).join('')+
   (cards.length?'':'<p class="hint">Todavía no hay grupos de este curso académico.</p>')+
   '</div></section>';
 }).join('');
 return '<div id="plan-evaluations" class="eval-period-board">'+
  '<p class="hint eval-period-intro">Las reuniones están organizadas por evaluación. '+
  'Programa o edita cada sesión desde su tarjeta. Los grupos con coincidencias pendientes '+
  'conservan sus convocatorias individuales hasta que confirmes la tutoría.</p>'+content+
  '</div>';
}
