import {activeYear,setActiveYear,calendarEventIcs,deletePlannerItem} from './planner.js';
import {sessionPresentation} from './evaluation-session-presentation.js';
import {
 renderSharedEvaluation,bindSharedEvaluation,openGroupEvaluationSessionModal
} from './evaluation-ui.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const tabs=[['sesiones','Sesiones','▣'],['tutorias','Tutorías','♧'],['notas','Vista de notas','▤']];
const periodOptions=doc=>[...doc.periods].sort((a,b)=>a.order-b.order);
const tutoring=doc=> (doc.tutorships||[]).filter(t=>t.course===activeYear(doc).name);
const viewerSelection=(doc,ui)=>{
 const tutors=tutoring(doc),periods=periodOptions(doc),v=ui.plannerEvaluationView;
 const tutorshipId=tutors.some(t=>t.id===v?.tutorshipId)?v.tutorshipId:tutors[0]?.id;
 const periodId=periods.some(p=>p.id===v?.periodId)?v.periodId:periods[0]?.id;
 return tutorshipId&&periodId?{tutorshipId,periodId}:null;
};
/** Sin escritura: no altera el curso ni las calificaciones. */
export function renderEvaluationWorkspace(doc,ui){
 const year=activeYear(doc),section=tabs.some(t=>t[0]===ui.evaluationWorkspaceTab)?ui.evaluationWorkspaceTab:'sesiones';
 const cards=sessionPresentation(doc,year),confirmed=tutoring(doc);
 const events=year.events.filter(e=>e.type==='evaluation');
 const review=cards.filter(c=>c.kind==='suggested').length;
 const viewer=section==='notas'?viewerSelection(doc,ui):null;
 const selection=viewer?
  '<div class="eval-workspace-selectors"><label>Tutoría<select id="eval-view-tutor">'+confirmed.map(t=>
   '<option value="'+esc(t.id)+'"'+(t.id===viewer.tutorshipId?' selected':'')+'>'+esc(t.name)+'</option>').join('')+
   '</select></label><label>Evaluación<select id="eval-view-period">'+periodOptions(doc).map(p=>
   '<option value="'+esc(p.id)+'"'+(p.id===viewer.periodId?' selected':'')+'>'+esc(p.name)+'</option>').join('')+
   '</select></label></div>':'';
 const body=section==='sesiones'
  ?renderSharedEvaluation(doc,year,ui,'sesiones',cards)
  :section==='tutorias'
  ?'<div class="eval-workspace-management-top"><h3>Identificación y gestión de tutorías</h3>'+
   '<p class="hint">Confirma las coincidencias entre materias antes de organizar sus reuniones. '+
   'Los expedientes y las calificaciones permanecen separados.</p>'+
   '<button type="button" class="btn" id="eval-link-students">Vincular alumnos entre asignaturas</button></div>'+
   renderSharedEvaluation(doc,year,ui,'tutorias')
  :viewer?selection+renderSharedEvaluation(doc,year,{...ui,plannerEvaluationView:viewer},'notas'):
   '<section class="panel panel-pad eval-workspace-empty"><h3>Aún no hay tutorías confirmadas</h3>'+
   '<p>Configura primero las tutorías compartidas. Después podrás consultar una relación de alumnos '+
   'y las notas diferenciadas de Latín y Griego.</p>'+
   '<button type="button" class="btn primary" data-eval-workspace-tab="tutorias">Gestionar tutorías</button></section>';
 return '<div class="evaluation-workspace" aria-label="Gestión de sesiones de evaluación">'+
  '<header class="panel panel-pad eval-workspace-header"><div><div class="planner-eyebrow">Organización académica · reuniones</div>'+
  '<h2>Sesiones de evaluación</h2><p class="subtitle">Gestiona tutorías, convocatorias y la consulta conjunta de notas. '+
  'Las reuniones también aparecen en Agenda.</p></div>'+
  '<label class="eval-workspace-year">Curso académico<select id="eval-workspace-year">'+
   doc.planner.years.map(y=>'<option value="'+esc(y.id)+'"'+(y.id===year.id?' selected':'')+'>'+
   esc(y.name)+'</option>').join('')+'</select></label></header>'+
  '<div class="eval-workspace-stats" aria-label="Resumen de evaluaciones">'+
   '<div class="panel"><strong>'+cards.length+'</strong><span>Tutorías y grupos</span></div>'+
   '<div class="panel"><strong>'+events.length+'</strong><span>Convocatorias</span></div>'+
   '<div class="panel"><strong>'+review+'</strong><span>Coincidencias por revisar</span></div></div>'+
  '<nav class="eval-workspace-tabs" aria-label="Secciones de evaluación">'+tabs.map(([key,label,glyph])=>
   '<button type="button" data-eval-workspace-tab="'+key+'" aria-pressed="'+(section===key)+'"'+
   (section===key?' aria-current="page"':'')+' class="eval-workspace-tab'+(section===key?' active':'')+'">'+
   '<span aria-hidden="true">'+glyph+'</span> '+label+'</button>').join('')+'</nav>'+
  '<div class="eval-workspace-body">'+body+'</div>'+
  '<p class="hint eval-workspace-footer">Las modificaciones se guardan en el cuaderno cifrado local. '+
  'Antes de unificar convocatorias antiguas, comprueba una copia de seguridad.</p></div>';
}
/** Mantener las acciones de exportación protegidas: los .ics NO se cifran. */
function exportEvaluationEvent(event,ctx){
 if(!event)return;
 if(!window.confirm('La cita se exportará en un archivo .ics SIN CIFRAR con fecha, hora y observaciones. No incluyas datos personales ni la compartas sin autorización. ¿Continuar?'))return;
 try{
  const data=calendarEventIcs(event);
  const url=URL.createObjectURL(new Blob([data],{type:'text/calendar;charset=utf-8'}));
  const anchor=document.createElement('a');
  anchor.href=url;anchor.download='AppNotas-evaluacion-'+event.date+'-'+event.id.slice(0,8)+'.ics';
  document.body.append(anchor);anchor.click();anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
  ctx.toast('Archivo de calendario exportado. No está cifrado.');
 }catch(error){ctx.fail(error);}
}
export function bindEvaluationWorkspace(doc,ui,ctx){
 const $=selector=>document.querySelector(selector),all=selector=>[...document.querySelectorAll(selector)];
 const redraw=()=>ctx.render(),year=activeYear(doc);
 all('[data-eval-workspace-tab]').forEach(button=>button.onclick=()=>{
  ui.evaluationWorkspaceTab=button.dataset.evalWorkspaceTab;redraw();
 });
 $('#eval-workspace-year')?.addEventListener('change',event=>{
  const selected=event.currentTarget.value;
  ctx.commit(d=>setActiveYear(d,selected),'Cambiar curso de evaluaciones').then(()=>{
   ui.plannerEvaluationView=null;ui.plannerEvalOpenCards={};ui.plannerEvalOpenPeriods={};
   ui.plannerDate=activeYear(ctx.getDoc()).start;redraw();
  }).catch(ctx.fail);
 });
 $('#eval-view-tutor')?.addEventListener('change',event=>{
  ui.plannerEvaluationView={tutorshipId:event.currentTarget.value,
   periodId:viewerSelection(ctx.getDoc(),ui)?.periodId||periodOptions(ctx.getDoc())[0]?.id};
  redraw();
 });
 $('#eval-view-period')?.addEventListener('change',event=>{
  ui.plannerEvaluationView={tutorshipId:viewerSelection(ctx.getDoc(),ui)?.tutorshipId,
   periodId:event.currentTarget.value};
  redraw();
 });
 $('#eval-link-students')?.addEventListener('click',()=>ctx.openStudentLinks?.());
 const sessionsFieldsModal=(title,fields,onSubmit,caption)=>{
  ctx.fieldsModal(title,fields,onSubmit,caption);
  ctx.dialog.classList.add('evaluation-session-dialog');
  ctx.dialog.addEventListener('close',()=>ctx.dialog.classList.remove('evaluation-session-dialog'),{once:true});
  for(const name of ['time','endTime']){
   ctx.dialog.querySelector('[name="'+name+'"]')?.closest('label')?.classList.add('eval-form-time');
  }
  ctx.dialog.querySelector('[name="date"]')?.closest('label')?.classList.add('eval-form-date');
  ctx.dialog.querySelector('[name="notes"]')?.closest('label')?.classList.add('eval-form-notes');
 };
 const decorateSessionModal=event=>{
  const buttons=ctx.dialog.querySelector('.modal-actions');
  if(!buttons||!event)return;
  const calendar=document.createElement('button');
  calendar.type='button';calendar.className='btn';calendar.textContent='Ver en Agenda';
  calendar.onclick=()=>{
   ctx.dialog.close();ui.tab='planificador';ui.plannerMode='day';ui.plannerDate=event.date;redraw();
  };
  buttons.prepend(calendar);
  const erase=document.createElement('button');
  erase.type='button';erase.className='btn warn';erase.textContent='Eliminar convocatoria';
  erase.onclick=async()=>{
   if(!window.confirm('¿Eliminar esta convocatoria? No se borrarán calificaciones ni matrículas.'))return;
   try{await ctx.commit(d=>deletePlannerItem(d,'events',event.id),'Eliminar convocatoria de evaluación');
    ctx.dialog.close();ctx.toast('Convocatoria eliminada; las notas se conservan.');
   }catch(error){ctx.fail(error);}
  };
  buttons.prepend(erase);
 };
 const sharedCtx={...ctx,sessionFieldsModal:sessionsFieldsModal,decorateSessionModal};
 bindSharedEvaluation(doc,ui,sharedCtx,event=>exportEvaluationEvent(event,ctx));
 all('[data-eval-group]').forEach(button=>button.onclick=()=>{
  openGroupEvaluationSessionModal(ctx.getDoc(),{
   ...sharedCtx,fieldsModal:sessionsFieldsModal
  },button.dataset.evalGroup,button.dataset.evalPeriod,button.dataset.evalOrigin||'');
 });
 all('[data-export-event]').forEach(button=>button.onclick=()=>{
  exportEvaluationEvent(year.events.find(e=>e.id===button.dataset.exportEvent),ctx);
 });
 all('[data-eval-switch-tab]').forEach(button=>button.onclick=()=>{
  ui.evaluationWorkspaceTab=button.dataset.evalSwitchTab;redraw();
 });
}
