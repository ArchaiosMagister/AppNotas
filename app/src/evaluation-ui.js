import {
 suggestStudentLinks,linkedStudentFamilies,linkStudentRecords,unlinkStudentRecord,
 tutoringSources,availableTutoringSources,suggestTutorships,saveTutorship,removeTutorship,
 tutorGradeRows,tutorGradeBreakdown,tutorshipLegacyEvents,tutorshipEvent,
 saveTutorshipEvaluation,consolidateTutorshipEvaluation
} from './evaluation-groups.js';
import {activeYear,localToday,saveEvaluationSession} from './planner.js';
import {sessionPresentation} from './evaluation-session-presentation.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const btn=(name,attr,klass='btn small')=>'<button type="button" class="'+klass+'" '+attr+'>'+esc(name)+'</button>';
const groupLabel=(doc,s)=>{
 const g=doc.groups.find(g=>g.id===s.groupId);
 return s.name+' ('+(g?.subject||'?')+' · '+(g?.name||'?')+')';
};
const format=(value,digits=2)=>value===null?'—':value.toLocaleString('es-ES',{maximumFractionDigits:digits,minimumFractionDigits:digits});
const evaluationHours=event=>event.time+(event.endTime?'–'+event.endTime:'');
const checkSources=(doc,tutorship)=>tutorship.sources.map(s=>{
 const g=doc.groups.find(g=>g.id===s.groupId);
 return g?g.subject+' · '+g.name+(s.originGroup?' · '+s.originGroup:' · grupo completo'):'Grupo anterior';
}).join(' / ');
/** Una sola relación desplegable: nunca se muestran dos inventarios de
 * sesiones (uno por materia y otro por tutoría) como ocurría antes. */
export function renderSharedEvaluation(doc,year,ui,section='all'){
 const tutors=(doc.tutorships||[]).filter(t=>t.course===year.name);
 const suggestions=suggestStudentLinks(doc,year.name).slice(0,30);
 const families=linkedStudentFamilies(doc,year.name);
 const cards=sessionPresentation(doc,year),periods=[...doc.periods].sort((a,b)=>a.order-b.order);
 const suggestionsHtml=suggestions.map((pair,i)=>
  '<div class="eval-link-row"><span>'+esc(groupLabel(doc,pair.a))+' ↔ '+esc(groupLabel(doc,pair.b))+
  ' <small>Coincidencia '+esc(pair.quality)+'</small></span>'+
  btn('Confirmar vínculo','data-eval-link-pair="'+i+'"')+'</div>').join('')||
  '<p class="hint">No se han encontrado nuevas coincidencias de nombres.</p>';
 const familyHtml=families.map(records=>
  '<div class="eval-link-row"><span>'+esc(records.map(s=>groupLabel(doc,s)).join(' / '))+'</span>'+
  records.map(s=>btn('Desvincular de '+s.name,'data-eval-unlink="'+esc(s.id)+'"')).join('')+'</div>').join('');
 const management='<details id="plan-shared-management" class="panel panel-pad eval-shared-management" '+
  (ui.plannerSharedManagementOpen??(section==='tutorias')?'open':'')+'>'+
  '<summary>Gestionar tutorías y vínculos de alumnos</summary>'+
  '<p class="hint">La identificación de tutorías y alumnos es semiautomática: solo guardamos las asociaciones que confirmes.</p>'+
  '<h3>Alumnos que cursan varias asignaturas</h3>'+suggestionsHtml+
  (familyHtml?'<h4>Vínculos confirmados</h4>'+familyHtml:'')+
  '<h3>Tutorías compartidas</h3>'+
  '<p class="hint">Confirma las coincidencias sugeridas antes de crear una convocatoria común. No se modifican las fechas ni las calificaciones hasta que tú lo decidas.</p>'+
  sessionPresentation(doc,year).filter(c=>c.kind==='suggested').map(card=>
   '<div class="eval-link-row eval-tutor-proposal"><span><strong>'+esc(card.name)+'</strong><small>'+
   esc([...new Set(card.sources.map(s=>s.group?.subject||''))].join(' · '))+' · Posible coincidencia</small></span>'+
   btn('Confirmar tutoría común','data-eval-confirm-session="'+esc(card.id)+'"','btn small primary')+'</div>'
  ).join('')+
  btn('Crear tutoría manualmente','id="plan-manual-tutorship"')+
  (tutors.map(t=>'<div class="eval-link-row"><span><strong>'+esc(t.name)+'</strong> · '+esc(checkSources(doc,t))+'</span>'+
   btn('Añadir asignatura','data-eval-add-source="'+esc(t.id)+'"')+
   btn('Gestionar','data-eval-manage-tutor="'+esc(t.id)+'"')+'</div>').join('')||
   '<p class="hint">Puedes confirmar las tutorías propuestas arriba o crearlas manualmente.</p>')+'</details>';
 const summarize=(events,hasSingle=false)=>{
  if(!events.length)return 'Sin programar';
  const when=[...new Set(events.map(e=>e.date+' · '+evaluationHours(e)))];
  if(when.length===1)return when[0]+(events.length>1?' · '+events.length+' citas':'');
  return events.length+' convocatorias con fechas distintas';
 };
 const labels=card=>[...new Set(card.sources.map(s=>s.group?.subject||'Materia anterior'))].join(' · ');
 const renderPeriod=(card,period)=>{
  const t=card.tutorship,canonical=t?tutorshipEvent(doc,t.id,period.id):null;
  const prior=t?tutorshipLegacyEvents(doc,t.id,period.id):[];
  const bySource=card.kind==='confirmed'?[]:card.sources.map(source=>({
   source,events:year.events.filter(e=>e.type==='evaluation'&&!e.tutorshipId&&e.groupId===source.groupId&&
    e.periodId===period.id&&(e.originGroup||'')===(source.originGroup||''))
  }));
  const list=canonical?[canonical,...prior]:t?prior:bySource.flatMap(s=>s.events);
  const hasPrevious=prior.length>0,hasCanonical=!!canonical;
  const head='<summary><strong>'+esc(period.name)+'</strong><span>'+esc(summarize(list))+'</span></summary>';
  let body='';
  if(t){
   body='<div class="planner-evaluation-row">'+
    '<span class="planner-evaluation-when">'+(canonical?esc(canonical.date+' · '+evaluationHours(canonical)):
     prior.length?'Convocatorias anteriores pendientes de unificar':'Sin programar')+'</span>'+
    (hasPrevious&&!hasCanonical?btn('Unificar convocatorias','data-eval-consolidate="'+esc(t.id)+'" data-eval-period="'+esc(period.id)+'"'):
     btn(canonical?'Editar fecha y hora':'Programar','data-eval-tutor-session="'+esc(t.id)+'" data-eval-period="'+esc(period.id)+'"'))+
    (canonical?btn('Calendario','data-eval-tutor-export="'+esc(canonical.id)+'"'):'')+
    btn('Ver notas','data-eval-open-tutor="'+esc(t.id)+'" data-eval-period="'+esc(period.id)+'"')+
    '</div>'+
    (hasPrevious?'<p class="hint">Hay '+prior.length+' cita(s) anteriores de asignaturas por revisar. '+
      (hasCanonical?'La convocatoria común ya existe; las citas anteriores siguen guardadas.':
       'Elige la fecha oficial: las demás quedarán archivadas dentro del cuaderno cifrado.')+'</p>':'');
   if(hasPrevious)body+='<div class="eval-legacy-preview">'+prior.map(e=>{
    const group=doc.groups.find(g=>g.id===e.groupId);
    return '<p>'+esc(group?.subject||'Materia')+' · '+esc(e.originGroup||'Grupo completo')+
     ' · '+esc(e.date+' '+evaluationHours(e))+(e.notes?' · '+esc(e.notes):'')+'</p>';
   }).join('')+'</div>';
  }else{
   body=bySource.map(({source,events})=>{
    const canSchedule=source.students>0||events.length>0;
    const attrs='data-eval-group="'+esc(source.groupId)+'" data-eval-period="'+esc(period.id)+
     '" data-eval-origin="'+esc(source.originGroup)+'"';
    return '<div class="planner-evaluation-row eval-source-row"><span><strong>'+esc(source.group.subject)+
     '</strong><small>'+esc(source.group.name+(source.originGroup?' · '+source.originGroup:''))+'</small></span>'+
     '<span class="planner-evaluation-when">'+esc(summarize(events))+'</span>'+
     (canSchedule?btn(events.length?'Editar fecha y hora':'Programar',attrs):
      '<small>Sin alumnado en esta procedencia</small>')+
     events.map(e=>btn('Calendario','data-export-event="'+esc(e.id)+'"')).join('')+'</div>';
   }).join('');
  }
  return '<details class="eval-session-period" data-eval-period-panel="'+esc(card.id+'|'+period.id)+'" '+
   (ui.plannerEvalOpenPeriods?.[card.id+'|'+period.id]?'open':'')+'>'+head+
   '<div class="eval-session-period-content">'+body+'</div></details>';
 };
 const sections=cards.map(card=>{
  const suggested=card.kind==='suggested',confirmed=card.kind==='confirmed';
  const status=confirmed?'Tutoría confirmada':suggested?'Posible tutoría compartida · pendiente de confirmar':'Grupo sin asociar';
  const events=periods.flatMap(p=>confirmed?
   [tutorshipEvent(doc,card.tutorship.id,p.id),...tutorshipLegacyEvents(doc,card.tutorship.id,p.id)].filter(Boolean):
   year.events.filter(e=>e.type==='evaluation'&&!e.tutorshipId&&e.periodId===p.id&&
    card.sources.some(src=>src.groupId===e.groupId&&(src.originGroup||'')===(e.originGroup||''))));
  const total=events.length,subtitle=labels(card);
  return '<details class="eval-tutor-card eval-session-card" data-eval-card="'+esc(card.id)+'" '+
   (ui.plannerEvalOpenCards?.[card.id]?'open':'')+'><summary class="eval-session-card-heading">'+
   '<span class="eval-session-card-title"><strong>'+esc(card.name)+'</strong><small>'+esc(subtitle)+
   '</small></span><span class="eval-session-card-meta">'+esc(status)+
   ' · '+total+' '+(total===1?'cita':'citas')+'</span></summary><div class="eval-session-card-body">'+
   (suggested?'<div class="eval-session-recognition"><p>La aplicación ha encontrado las mismas tutorías en '+
    esc(subtitle)+'. Identifícalas desde la pestaña Tutorías antes de unificar sus convocatorias.</p>'+
    (section==='all'?btn('Confirmar tutoría común','data-eval-confirm-session="'+esc(card.id)+'"','btn small primary'):
      btn('Revisar en Tutorías','data-eval-switch-tab="tutorias"'))+
    '</div>':'')+
   periods.map(p=>renderPeriod(card,p)).join('')+'</div></details>';
 }).join('');
 const scheduled=year.events.filter(e=>e.type==='evaluation').length;
 const open=ui.plannerEvaluationsOpen!==false;
 const sessions='<details id="plan-evaluations" class="panel panel-pad eval-shared-section eval-session-overview" '+
  (open?'open':'')+'><summary>Sesiones de evaluación · '+cards.length+
  ' '+(cards.length===1?'grupo':'grupos')+' · '+scheduled+' '+(scheduled===1?'cita registrada':'citas registradas')+'</summary>'+
  '<p class="hint">Agrupadas por tutoría; despliega cada grupo y después la evaluación. '+
  'Las coincidencias se proponen, pero necesitan confirmación para tener una convocatoria común.</p>'+
  (cards.some(c=>c.kind==='suggested')?'<p class="eval-suggestion-notice">Hay tutorías de Latín y Griego posiblemente repetidas. '+
   'Abre cada propuesta para confirmarla.</p>':'')+
  (sections||'<p class="hint">Todavía no hay grupos de este curso académico.</p>')+'</details>';
 if(section==='sesiones')return sessions;
 if(section==='tutorias')return management;
 if(section==='notas')return ui.plannerEvaluationView?renderTutorViewer(doc,ui.plannerEvaluationView):'';
 return sessions+management+(ui.plannerEvaluationView?renderTutorViewer(doc,ui.plannerEvaluationView):'');
}
export function renderTutorViewer(doc,view){
 let data;
 try{data=tutorGradeRows(doc,view.tutorshipId,view.periodId);}catch{return '';}
 const period=doc.periods.find(p=>p.id===view.periodId);
 const digits=Math.min(3,Math.max(0,doc.settings?.decimals??2));
 const groupHeaders=data.groups.map(g=>'<th><strong>'+esc(g.subject)+'</strong><small>'+esc(g.name)+'</small></th>').join('');
 const rows=data.rows.map(row=>
  '<tr><th scope="row">'+esc(row.name)+'</th>'+row.grades.map(grade=>{
   if(!grade.studentId)return '<td class="eval-no-enrollment">—<small>No matriculado</small></td>';
   return '<td><button type="button" class="eval-grade-detail" data-eval-detail-student="'+esc(grade.studentId)+
    '" data-eval-detail-group="'+esc(grade.groupId)+'" data-eval-detail-period="'+esc(view.periodId)+'"'+
    ' aria-label="Ver desglose de '+esc(row.name)+'">'+
    '<strong>'+format(grade.mean,digits)+'</strong><small>Ítaca: '+(grade.itaca===null?'—':format(grade.itaca,Number.isInteger(grade.itaca)?0:digits))+
    '</small></button></td>';
  }).join('')+'</tr>').join('');
 return '<section class="panel panel-pad eval-combined-view"><div class="eval-title-row"><div>'+
  '<h3>Notas de '+esc(data.tutorship.name)+' · '+esc(period?.name||'')+'</h3>'+
  '<p class="hint">La nota decimal y la Nota Ítaca proceden de cada asignatura; no se calculan medias entre asignaturas. Pulsa una nota para ver su desglose.</p></div>'+
  btn('Cerrar visor','id="plan-close-evaluation"')+'</div>'+
  '<div class="eval-table-scroll" role="region" aria-label="Notas conjuntas de evaluación" tabindex="0"><table class="eval-combined-table"><thead><tr><th>Alumno</th>'+
  groupHeaders+'</tr></thead><tbody>'+(rows||'<tr><td colspan="'+(data.groups.length+1)+'">No hay alumnos asignados a esta tutoría.</td></tr>')+
  '</tbody></table></div><p class="hint">— indica ausencia de matrícula o nota; no equivale a cero. Si ves dos filas de una misma persona, confirma su vinculación de identidad.</p></section>';
}
/** El diálogo de edición de la convocatoria se comparte entre la lista y el calendario. */
export function openTutorshipSessionModal(doc,ctx,tutorshipId,periodId){
 const t=(doc.tutorships||[]).find(t=>t.id===tutorshipId),period=doc.periods.find(p=>p.id===periodId);
 if(!t||!period){ctx.fail(new Error('Tutoría o evaluación inexistente.'));return;}
 const e=tutorshipEvent(doc,t.id,periodId),prior=tutorshipLegacyEvents(doc,t.id,periodId);
 if(prior.length&&!e){ctx.fail(new Error('Unifica primero las convocatorias anteriores.'));return;}
 const y=doc.planner.years.find(y=>y.name===t.course),today=localToday();
 const date=e?.date||(today>=y.start&&today<=y.end?today:y.start);
 (ctx.sessionFieldsModal||ctx.fieldsModal)('Sesión de evaluación · '+t.name+' · '+period.name,[
  {id:'date',label:'Fecha',type:'date',value:date},
  {id:'time',label:'Hora de inicio',type:'time',value:e?.time||'15:30'},
  {id:'endTime',label:'Hora de finalización (opcional)',type:'time',value:e?.endTime||'',required:false},
  {id:'notes',label:'Lugar u observaciones',required:false,value:e?.notes||'',maxlength:1000}
 ],values=>ctx.commit(d=>saveTutorshipEvaluation(d,{tutorshipId:t.id,periodId,...values,id:e?.id||null}),'Programar tutoría compartida'),
 'Una sola convocatoria para todas tus asignaturas de esta tutoría. Las calificaciones permanecen separadas.');
 ctx.decorateSessionModal?.(e);
}
/** Formulario común para la cita de una asignatura, incluso si se abre desde Agenda. */
export function openGroupEvaluationSessionModal(doc,ctx,groupId,periodId,origin='',dateHint=null){
 const year=activeYear(doc),group=doc.groups.find(g=>g.id===groupId&&g.course===year.name);
 const period=doc.periods.find(p=>p.id===periodId);
 if(!group||!period){ctx.fail(new Error('Grupo o evaluación inexistentes.'));return null;}
 const existing=year.events.find(e=>e.type==='evaluation'&&e.groupId===groupId&&
  e.periodId===periodId&&(e.originGroup||'')===origin);
 const today=dateHint||localToday(),date=existing?.date||(today>=year.start&&today<=year.end?today:year.start);
 ctx.fieldsModal('Sesión de evaluación · '+group.name+(origin?' · '+origin:'')+' · '+period.name,[
  {id:'date',label:'Día de la sesión',type:'date',value:date},
  {id:'time',label:'Hora de inicio',type:'time',value:existing?.time||'15:30'},
  {id:'endTime',label:'Hora de finalización (opcional)',type:'time',value:existing?.endTime||'',required:false},
  {id:'notes',label:'Lugar u observaciones',required:false,value:existing?.notes||'',maxlength:1000}
 ],values=>ctx.commit(d=>saveEvaluationSession(d,{
  id:existing?.id||null,groupId,periodId,originGroup:origin||null,...values
 }),'Programar sesión de evaluación'),
 'La convocatoria aparecerá también en Agenda. Su hora es independiente del horario de clases.');
 ctx.decorateSessionModal?.(existing);
 return existing;
}
/** Escucha únicamente los elementos propios de tutorías, sin alterar el planificador. */
export function bindSharedEvaluation(doc,ui,ctx,exportEvent){
 const all=selector=>[...document.querySelectorAll(selector)];
 const by=selector=>document.querySelector(selector);
 const redraw=()=>ctx.render();
 const suggestions=suggestStudentLinks(doc,activeYear(doc).name).slice(0,30);
 const proposed=suggestTutorships(doc,activeYear(doc).name).slice(0,24);
 const cards=sessionPresentation(doc,activeYear(doc));
 const suggestionsToConfirm=cards.filter(c=>c.kind==='suggested');
 by('#plan-evaluations')?.addEventListener('toggle',event=>{
  ui.plannerEvaluationsOpen=event.currentTarget.open;
 });
 by('#plan-shared-management')?.addEventListener('toggle',event=>{
  ui.plannerSharedManagementOpen=event.currentTarget.open;
 });
 all('[data-eval-card]').forEach(node=>node.addEventListener('toggle',event=>{
  (ui.plannerEvalOpenCards??={})[event.currentTarget.dataset.evalCard]=event.currentTarget.open;
 }));
 all('[data-eval-period-panel]').forEach(node=>node.addEventListener('toggle',event=>{
  (ui.plannerEvalOpenPeriods??={})[event.currentTarget.dataset.evalPeriodPanel]=event.currentTarget.open;
 }));
 all('[data-eval-confirm-session]').forEach(button=>button.onclick=async()=>{
  const candidate=suggestionsToConfirm.find(c=>c.id===button.dataset.evalConfirmSession);
  if(!candidate)return;
  const subjects=[...new Set(candidate.sources.map(s=>s.group.subject))];
  if(!window.confirm('¿Confirmas que '+candidate.name+' de '+subjects.join(' y ')+
   ' corresponde a UNA MISMA tutoría?\\n\\nSe guardará la relación, pero no se cambiarán ni fusionarán notas, fechas ni citas existentes.'))return;
  button.disabled=true;
  ui.plannerEvaluationsOpen=true;
  try{
   await ctx.commit(d=>saveTutorship(d,{name:candidate.name,sources:candidate.sources.map(s=>({
    groupId:s.groupId,originGroup:s.originGroup
   }))}),'Confirmar tutoría compartida');
   ctx.toast('Tutoría confirmada. Revisa cada evaluación y unifica las convocatorias anteriores cuando corresponda.');
  }catch(error){ctx.fail(error);if(button.isConnected)button.disabled=false;}
 });
 all('[data-eval-link-pair]').forEach(button=>button.onclick=()=>{
  const pair=suggestions[Number(button.dataset.evalLinkPair)];if(!pair)return;
  if(!window.confirm('¿Confirmas que ambos registros pertenecen a la misma persona? Las notas no se fusionarán.'))return;
  ctx.commit(d=>linkStudentRecords(d,[pair.a.id,pair.b.id]),'Vincular identidad de alumno').catch(ctx.fail);
 });
 all('[data-eval-unlink]').forEach(button=>button.onclick=()=>{
  if(!window.confirm('¿Desvincular esta ficha? Sus notas se conservarán.'))return;
  ctx.commit(d=>unlinkStudentRecord(d,button.dataset.evalUnlink),'Desvincular identidad').catch(ctx.fail);
 });
 all('[data-eval-tutor-suggestion]').forEach(button=>button.onclick=()=>{
  const item=proposed[Number(button.dataset.evalTutorSuggestion)];if(!item)return;
  if(!window.confirm('¿Crear la tutoría '+item.name+' con las asignaturas propuestas?'))return;
  ctx.commit(d=>saveTutorship(d,item),'Crear tutoría compartida').catch(ctx.fail);
 });
 function manualTutorship(){
  const sources=availableTutoringSources(doc,activeYear(doc).name);
  if(!sources.length){ctx.toast('No hay procedencias sin asignar.');return;}
  const options=sources.map((s,i)=>({value:String(i),label:s.label}));
  ctx.fieldsModal('Nueva tutoría compartida',[
   {id:'name',label:'Nombre de la tutoría (p. ej. 1.º BACH A)',value:'1.º BACH A',maxlength:100},
   {id:'sourceA',label:'Primera asignatura / procedencia',type:'select',options},
   {id:'sourceB',label:'Segunda asignatura / procedencia (opcional)',type:'select',required:false,
    options:[{value:'',label:'Ninguna'},...options],value:''}
  ],v=>ctx.commit(d=>saveTutorship(d,{name:v.name,
    sources:[sources[Number(v.sourceA)],...(v.sourceB!==''?[sources[Number(v.sourceB)]]:[])]}),'Crear tutoría común'),
   'Selecciona los grupos que realmente comparten tutoría. Después podrás añadir más asignaturas.');
 }
 by('#plan-manual-tutorship')?.addEventListener('click',manualTutorship);
 all('[data-eval-add-source]').forEach(button=>button.onclick=()=>{
  const tutor=(doc.tutorships||[]).find(t=>t.id===button.dataset.evalAddSource);
  if(!tutor)return;
  const available=availableTutoringSources(doc,tutor.course,tutor.id)
   .filter(s=>s.level===tutor.level&&!tutor.sources.some(x=>x.groupId===s.groupId&&x.originGroup===s.originGroup));
  if(!available.length){ctx.toast('No hay más procedencias disponibles.');return;}
  ctx.fieldsModal('Añadir asignatura a '+tutor.name,[
   {id:'source',label:'Grupo y procedencia',type:'select',
     options:available.map((s,i)=>({value:String(i),label:s.label}))}
  ],v=>ctx.commit(d=>saveTutorship(d,{...tutor,sources:[...tutor.sources,available[Number(v.source)]]}),
     'Añadir asignatura a tutoría'),'No se fusionarán notas ni se cambiarán identificadores de alumnos.');
 });
 all('[data-eval-manage-tutor]').forEach(button=>button.onclick=()=>{
  const tutor=(doc.tutorships||[]).find(t=>t.id===button.dataset.evalManageTutor);
  if(!tutor)return;
  ctx.fieldsModal('Gestionar '+tutor.name,[
   {id:'name',label:'Nombre de la tutoría',value:tutor.name,maxlength:100},
   {id:'removeSource',label:'Retirar una procedencia (opcional)',type:'select',required:false,
    options:[{value:'',label:'No retirar'},...tutor.sources.map((s,i)=>({value:String(i),label:tutoringSources(doc,tutor.course).find(item=>item.groupId===s.groupId&&item.originGroup===s.originGroup)?.label||s.groupId}))],value:''}
  ],v=>ctx.commit(d=>{
   const sources=v.removeSource===''?tutor.sources:tutor.sources.filter((s,i)=>i!==Number(v.removeSource));
   return saveTutorship(d,{id:tutor.id,name:v.name,sources});
  },'Gestionar tutoría compartida'),
  'La retirada de una asignatura no borra sus notas. No es posible retirar la última procedencia.');
 });
 all('[data-eval-tutor-session]').forEach(button=>button.onclick=()=>
  openTutorshipSessionModal(ctx.getDoc(),ctx,button.dataset.evalTutorSession,button.dataset.evalPeriod));
 all('[data-eval-consolidate]').forEach(button=>button.onclick=()=>{
  const tid=button.dataset.evalConsolidate,pid=button.dataset.evalPeriod;
  const t=(doc.tutorships||[]).find(t=>t.id===tid),legacy=tutorshipLegacyEvents(doc,tid,pid);
  if(!t||!legacy.length)return;
  ctx.fieldsModal('Unificar convocatorias · '+t.name,[
   {id:'selected',label:'Convocatoria oficial que deseas conservar',type:'select',
    options:legacy.map(e=>{
     const g=doc.groups.find(g=>g.id===e.groupId);
     return {value:e.id,label:e.date+' · '+e.time+' · '+(g?.subject||'')+' · '+(e.originGroup||g?.name||'')};
    })}
  ],v=>{
   if(!window.confirm('Se creará una sola cita de tutoría. TODAS las convocatorias anteriores quedarán archivadas, con sus fechas y observaciones, en el cuaderno cifrado. ¿Confirmas?'))return;
   return ctx.commit(d=>consolidateTutorshipEvaluation(d,{tutorshipId:tid,periodId:pid,chosenEventId:v.selected}),'Unificar convocatorias y conservar historial');
  },'Revisa fechas y horas: si no coinciden, elige cuál es la convocatoria correcta. Los originales permanecerán en el historial cifrado.');
 });
 all('[data-eval-open-tutor]').forEach(button=>button.onclick=()=>{
  ui.plannerEvaluationView={tutorshipId:button.dataset.evalOpenTutor,periodId:button.dataset.evalPeriod};
  if(ui.tab==='evaluaciones')ui.evaluationWorkspaceTab='notas';
  redraw();
 });
 by('#plan-close-evaluation')?.addEventListener('click',()=>{
  ui.plannerEvaluationView=null;
  if(ui.tab==='evaluaciones')ui.evaluationWorkspaceTab='sesiones';
  redraw();
 });
 all('[data-eval-tutor-export]').forEach(button=>button.onclick=()=>
  exportEvent(activeYear(ctx.getDoc()).events.find(e=>e.id===button.dataset.evalTutorExport)));
 all('[data-eval-detail-student]').forEach(button=>button.onclick=()=>{
  const sid=button.dataset.evalDetailStudent,gid=button.dataset.evalDetailGroup,pid=button.dataset.evalDetailPeriod;
  const student=doc.students.find(s=>s.id===sid),group=doc.groups.find(g=>g.id===gid);
  if(!student||!group)return;
  const parts=tutorGradeBreakdown(doc,sid,gid,pid);
  ctx.dialog.innerHTML='<div class="modal-inner"><h2>'+esc(student.name)+'</h2>'+
    '<p class="subtitle">'+esc(group.subject)+' · '+esc(group.name)+'</p>'+
    '<div class="eval-breakdown">'+parts.map(p=>'<div><strong>'+esc(p.name)+'</strong><span>'+
       (p.grade===null?'Sin nota':format(p.grade,2))+' · '+esc(p.weight)+' %</span>'+
       '<small>'+esc(p.evidence?.map(e=>e.name+': '+format(e.value,2)).join(' / ')||'Sin actividades evaluadas')+
       '</small></div>').join('')+'</div>'+
    '<div class="modal-actions">'+btn('Cerrar','id="eval-breakdown-close"')+'</div></div>';
  ctx.dialog.querySelector('#eval-breakdown-close').onclick=()=>ctx.dialog.close();
  ctx.dialog.showModal();
 });
}
