import {
 suggestStudentLinks,linkedStudentFamilies,linkStudentRecords,unlinkStudentRecord,
 tutoringSources,availableTutoringSources,suggestTutorships,saveTutorship,removeTutorship,
 tutorGradeRows,tutorGradeBreakdown,tutorshipLegacyEvents,tutorshipEvent,
 saveTutorshipEvaluation,consolidateTutorshipEvaluation
} from './evaluation-groups.js';
import {activeYear,localToday} from './planner.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const btn=(name,attr,klass='btn small')=>'<button type="button" class="'+klass+'" '+attr+'>'+esc(name)+'</button>';
const groupLabel=(doc,s)=>{
 const g=doc.groups.find(g=>g.id===s.groupId);
 return s.name+' ('+(g?.subject||'?')+' · '+(g?.name||'?')+')';
};
const format=(value,digits=2)=>value===null?'—':value.toLocaleString('es-ES',{maximumFractionDigits:digits,minimumFractionDigits:digits});
const checkSources=(doc,tutorship)=>tutorship.sources.map(s=>{
 const g=doc.groups.find(g=>g.id===s.groupId);
 return g?g.subject+' · '+g.name+(s.originGroup?' · '+s.originGroup:' · grupo completo'):'Grupo anterior';
}).join(' / ');
/** Zona de asociaciones y convocatorias sin notas de otros alumnos en red. */
export function renderSharedEvaluation(doc,year,ui){
 const tutors=(doc.tutorships||[]).filter(t=>t.course===year.name);
 const suggestions=suggestStudentLinks(doc,year.name).slice(0,30);
 const families=linkedStudentFamilies(doc,year.name);
 const tutorSuggestions=suggestTutorships(doc,year.name).slice(0,24);
 const periods=[...doc.periods].sort((a,b)=>a.order-b.order);
 const suggestionsHtml=suggestions.map((pair,i)=>
  '<div class="eval-link-row"><span>'+esc(groupLabel(doc,pair.a))+' ↔ '+esc(groupLabel(doc,pair.b))+
  ' <small>Coincidencia '+esc(pair.quality)+'</small></span>'+
  btn('Confirmar vínculo','data-eval-link-pair="'+i+'"')+'</div>').join('')||'<p class="hint">No se han encontrado nuevas coincidencias de nombres.</p>';
 const familyHtml=families.map(records=>
  '<div class="eval-link-row"><span>'+esc(records.map(s=>groupLabel(doc,s)).join(' / '))+'</span>'+
  records.map(s=>btn('Desvincular de '+s.name,'data-eval-unlink="'+esc(s.id)+'"')).join('')+'</div>').join('');
 const proposed=tutorSuggestions.map((item,i)=>
  '<div class="eval-link-row"><span>'+esc(item.name)+' <small>'+esc(item.sources.map(s=>s.label).join(' / '))+'</small></span>'+
  btn('Crear tutoría común','data-eval-tutor-suggestion="'+i+'"')+'</div>').join('');
 const management='<details id="plan-shared-management" class="panel panel-pad eval-shared-management">'+
  '<summary>Alumnos vinculados y tutorías comunes</summary>'+
  '<p class="hint">La aplicación solo propone coincidencias. Confirma las identidades y tutorías antes de unir sus vistas; ninguna calificación se traslada entre asignaturas.</p>'+
  '<h3>Alumnos que cursan varias asignaturas</h3>'+suggestionsHtml+
  (familyHtml?'<h4>Vínculos confirmados</h4>'+familyHtml:'')+
  '<h3>Tutorías compartidas</h3>'+
  btn('Crear tutoría manualmente','id="plan-manual-tutorship"')+
  (proposed?'<p class="hint">Tutorías detectadas por nombre y grupo de procedencia:</p>'+proposed:'')+
  (tutors.map(t=>'<div class="eval-link-row"><span><strong>'+esc(t.name)+'</strong> · '+esc(checkSources(doc,t))+'</span>'+
    btn('Añadir asignatura','data-eval-add-source="'+esc(t.id)+'"')+
    btn('Gestionar','data-eval-manage-tutor="'+esc(t.id)+'"')+'</div>').join('')||
    '<p class="hint">Todavía no hay tutorías compartidas. Puedes crearlas a partir de las sugerencias o manualmente.</p>')+
  '</details>';
 const sessions=tutors.map(t=>
  '<section class="eval-tutor-card"><header><strong>'+esc(t.name)+'</strong><small>'+
  esc(checkSources(doc,t))+'</small></header>'+
  periods.map(p=>{
   const event=tutorshipEvent(doc,t.id,p.id),prior=tutorshipLegacyEvents(doc,t.id,p.id);
   return '<div class="planner-evaluation-row"><span>'+esc(p.name)+'</span>'+
    '<span class="planner-evaluation-when">'+(event?esc(event.date+' · '+event.time):
     prior.length?esc(prior.length+' convocatoria(s) anterior(es) por revisar'):'Sin programar')+'</span>'+
    (prior.length&&!event?btn('Unificar convocatorias','data-eval-consolidate="'+esc(t.id)+'" data-eval-period="'+esc(p.id)+'"'):
     btn(event?'Editar fecha y hora':'Programar','data-eval-tutor-session="'+esc(t.id)+'" data-eval-period="'+esc(p.id)+'"'))+
    (event?btn('Calendario','data-eval-tutor-export="'+esc(event.id)+'"'):'')+
    btn('Ver notas','data-eval-open-tutor="'+esc(t.id)+'" data-eval-period="'+esc(p.id)+'"')+
    '</div>';
  }).join('')+'</section>'
 ).join('');
 return '<section class="panel panel-pad eval-shared-section"><div class="eval-title-row"><div>'+
  '<h3>Sesiones de evaluación por tutoría</h3><p class="hint">Una convocatoria y una relación de alumnos por tutoría, con las notas independientes de cada asignatura.</p></div></div>'+
  (sessions||'<p class="hint">Crea primero las tutorías compartidas en el apartado superior.</p>')+'</section>'+
  management+(ui.plannerEvaluationView?renderTutorViewer(doc,ui.plannerEvaluationView):'');
}
function renderTutorViewer(doc,view){
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
 ctx.fieldsModal('Sesión de evaluación · '+t.name+' · '+period.name,[
  {id:'date',label:'Fecha',type:'date',value:date},
  {id:'time',label:'Hora',type:'time',value:e?.time||'15:30'},
  {id:'notes',label:'Lugar u observaciones',required:false,value:e?.notes||'',maxlength:1000}
 ],values=>ctx.commit(d=>saveTutorshipEvaluation(d,{tutorshipId:t.id,periodId,...values,id:e?.id||null}),'Programar tutoría compartida'),
 'Una sola convocatoria para todas tus asignaturas de esta tutoría. Las calificaciones permanecen separadas.');
}
/** Escucha únicamente los elementos propios de tutorías, sin alterar el planificador. */
export function bindSharedEvaluation(doc,ui,ctx,exportEvent){
 const all=selector=>[...document.querySelectorAll(selector)];
 const by=selector=>document.querySelector(selector);
 const redraw=()=>ctx.render();
 const suggestions=suggestStudentLinks(doc,activeYear(doc).name).slice(0,30);
 const proposed=suggestTutorships(doc,activeYear(doc).name).slice(0,24);
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
 all('[data-eval-tutor-session]').forEach(button=>button.onclick=>
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
  redraw();
 });
 by('#plan-close-evaluation')?.addEventListener('click',()=>{ui.plannerEvaluationView=null;redraw();});
 all('[data-eval-tutor-export]').forEach(button=>button.onclick=>
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
