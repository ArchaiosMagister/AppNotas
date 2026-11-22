import {sessionPresentation} from './evaluation-session-presentation.js';
import {localToday} from './planner.js';
import {tutorshipEvent,tutorshipLegacyEvents} from './evaluation-groups.js';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const button=(title,attrs,cls='btn small')=>
 '<button type="button" class="'+cls+'" '+attrs+'>'+esc(title)+'</button>';
const when=e=>e.date+' · '+e.time+(e.endTime?'–'+e.endTime:'');
/** Menú nativo <details>: acciones disponibles con teclado y sin dependencia de JavaScript. */
const moreMenu=(label,actions)=>!actions?'':(
 '<details class="eval-period-more" data-eval-more name="eval-card-actions">'+
 '<summary aria-label="Más acciones de '+esc(label)+'" title="Más acciones de '+esc(label)+'">'+
 '<span aria-hidden="true">···</span></summary>'+
 '<div class="eval-period-more-items">'+actions+'</div></details>'
);
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
function periodCard(doc,year,period,card,today){
 const title=card.name,subtitle=subjects(card),t=card.tutorship;
 const intro='<div class="eval-period-card-head"><div class="eval-period-card-label"><strong>'+
  esc(title)+'</strong><small>'+esc(subtitle)+'</small></div></div>';
 let status='',details='',actions='',extra='',archived=false;
 if(t){
  const event=tutorshipEvent(doc,t.id,period.id);
  const previous=tutorshipLegacyEvents(doc,t.id,period.id);
  archived=!!event&&event.date<today&&previous.length===0;
  status=previous.length?'Pendiente de revisar':event?'Programada':'Sin programar';
  details=previous.length&&!event?'<div class="eval-period-unscheduled">Sin convocatoria común</div>':eventDetails(event);
  if(previous.length){
   extra='<p class="eval-period-caution">'+
    (event?'Hay convocatorias anteriores pendientes de revisar.':
     'Hay '+previous.length+' convocatorias de asignaturas por unificar.')+'</p>'+
    legacyDetails(doc,previous);
  }
  const auxiliary=(event?button('Calendario','data-eval-tutor-export="'+esc(event.id)+'"'):'')+
   button('Ver notas','data-eval-open-tutor="'+esc(t.id)+'" data-eval-period="'+esc(period.id)+'"');
  actions=(previous.length&&!event?
   button('Unificar convocatorias','data-eval-consolidate="'+esc(t.id)+
    '" data-eval-period="'+esc(period.id)+'"','btn small primary'):
   button(event?'Editar sesión':'Programar sesión','data-eval-tutor-session="'+esc(t.id)+
    '" data-eval-period="'+esc(period.id)+'"','btn small primary'))+
   moreMenu(title,auxiliary);
 }else{
  const pairs=card.sources.map(source=>({source,events:sourceEvents(year,source,period.id)}));
  if(card.kind==='suggested'){
   status='Pendiente de revisar';
   extra='<p class="eval-period-caution">Coincidencia pendiente de confirmar entre asignaturas.</p>';
   details='<div class="eval-period-source-list">'+pairs.map(({source,events})=>{
    const event=events[0],canEdit=source.students>0||events.length>0;
    const attrs='data-eval-group="'+esc(source.groupId)+'" data-eval-period="'+esc(period.id)+
     '" data-eval-origin="'+esc(source.originGroup)+'"';
    return '<div class="eval-period-source"><span class="eval-period-source-heading"><strong>'+
     esc(source.group.subject)+'</strong><small>'+esc(event?when(event):'Sin programar')+'</small></span>'+
     (canEdit?button(event?'Editar':'Programar',attrs):'<small>Sin alumnado</small>')+
     moreMenu(source.group.subject,events.map(e=>button('Calendario','data-export-event="'+esc(e.id)+'"')).join(''))+'</div>';
   }).join('')+'</div>';
   actions=button('Revisar tutoría','data-eval-switch-tab="tutorias"');
  }else{
   const source=pairs[0]?.source,event=pairs[0]?.events[0];
   archived=!!event&&pairs[0].events.length===1&&event.date<today;
   status=event?'Programada':'Sin programar';details=eventDetails(event);
   const attrs='data-eval-group="'+esc(source.groupId)+'" data-eval-period="'+esc(period.id)+
    '" data-eval-origin="'+esc(source.originGroup)+'"';
   const canEdit=source.students>0||pairs[0].events.length>0;
   actions=canEdit?button(event?'Editar sesión':'Programar sesión',attrs,'btn small primary'):
    '<span class="hint">Sin alumnado en esta procedencia</span>';
   actions+=event?moreMenu(title,button('Calendario','data-export-event="'+esc(event.id)+'"')):'';
  }
 }
 if(archived)status='Pasada';
 const state=archived?'past':status==='Programada'?'scheduled':status==='Sin programar'?'unscheduled':'review';
 const html='<article class="eval-period-small-card" data-eval-group-card="'+esc(card.id)+'" '+
  'data-eval-card-status="'+esc(status)+'" data-eval-card-state="'+state+'">'+intro+
  '<span class="eval-period-status">'+esc(status)+'</span>'+details+extra+
  '<div class="eval-period-actions">'+actions+'</div></article>';
 return {html,archived};
}
/** El orden académico determina las secciones: 1.ª, 2.ª, 3.ª evaluación.
 * Cada una muestra todas las tutorías elegibles sin duplicar materias confirmadas. */
export function renderEvaluationPeriodBoard(doc,year,cards=sessionPresentation(doc,year),{
 today=localToday(),showPast=doc.settings?.evaluationPastMode==='all',expandedPast={}
}={}){
 const periods=[...doc.periods].sort((a,b)=>a.order-b.order);
 const content=periods.map(period=>{
  const entries=cards.map(card=>periodCard(doc,year,period,card,today));
  const visible=showPast?entries:entries.filter(c=>!c.archived);
  const past=showPast?[]:entries.filter(c=>c.archived);
  const events=year.events.filter(e=>e.type==='evaluation'&&e.periodId===period.id);
  return '<section class="eval-period-section" data-evaluation-section="'+esc(period.id)+'">'+
   '<div class="eval-period-section-head"><h3>'+esc(period.name)+'</h3><span>'+
   esc(cards.length+' '+(cards.length===1?'grupo':'grupos')+' · '+events.length+
    ' '+(events.length===1?'cita':'citas'))+'</span></div>'+
   '<div class="eval-period-cards">'+visible.map(entry=>entry.html).join('')+
   (cards.length?'':'<p class="hint">Todavía no hay grupos de este curso académico.</p>')+
   '</div>'+
   (past.length?'<details class="eval-past-archive" data-eval-past-period="'+esc(period.id)+'"'+
    (expandedPast[period.id]?' open':'')+'><summary>Sesiones pasadas ('+past.length+')</summary>'+
    '<div class="eval-period-cards">'+past.map(entry=>entry.html).join('')+'</div></details>':'')+
   '</section>';
 }).join('');
 return '<div id="plan-evaluations" class="eval-period-board">'+
  '<p class="hint eval-period-intro">Las reuniones están organizadas por evaluación. '+
  'Programa o edita cada sesión desde su tarjeta. Los grupos con coincidencias pendientes '+
  'conservan sus convocatorias individuales hasta que confirmes la tutoría.</p>'+
  '<label class="eval-past-mode"><input type="checkbox" data-eval-past-mode'+
  (showPast?' checked':'')+'> Mostrar siempre todas las sesiones, incluidas las pasadas</label>'+content+
  '</div>';
}

/** Menús de acciones: cerrar otros al abrir, cerrar al elegir una opción,
 * y admitir Escape o pulsar fuera. Eventos ligados al panel, no a document:
 * no acumulan escuchadores tras cambios de evaluación o de curso. */
export function bindEvaluationCardMenus(root){
 if(!root)return;
 const menus=[...root.querySelectorAll('[data-eval-more]')];
 if(!menus.length)return;
 for(const menu of menus){
  menu.querySelector('summary')?.addEventListener('click',()=>{
   for(const other of menus)if(other!==menu)other.open=false;
  });
  for(const button of menu.querySelectorAll('button'))
   button.addEventListener('click',()=>{menu.open=false;});
 }
 root.addEventListener('pointerdown',event=>{
  if(event.target.closest('[data-eval-more]'))return;
  for(const menu of menus)menu.open=false;
 });
 root.addEventListener('keydown',event=>{
  if(event.key!=='Escape')return;
  const opened=menus.filter(menu=>menu.open);
  if(!opened.length)return;
  event.preventDefault();
  event.stopPropagation();
  for(const menu of opened)menu.open=false;
  opened[opened.length-1].querySelector('summary')?.focus();
 });
}
