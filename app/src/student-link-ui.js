import {linkStudentRecords,unlinkStudentRecord,suggestStudentLinks,linkedStudentFamilies,normalizeStudentName} from './evaluation-groups.js';

const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const opt=(value,label,selected=false)=>'<option value="'+escapeHtml(value)+'"'+(selected?' selected':'')+'>'+escapeHtml(label)+'</option>';
const groupName=g=>g.subject+' · '+g.name;
const studentName=s=>s.name+(s.originGroup?' · '+s.originGroup:' · sin procedencia');
const displayCourse=course=>course||'Curso sin especificar';
const sameCurriculum=(a,b)=>a.course===b.course&&a.level===b.level;
/** La opción manual ofrece solo materias distintas de la misma etapa y año.
 * No descarta candidatos por similitud de nombres: decide siempre el docente. */
export function manualLinkGroups(doc,course,firstGroupId=''){
 const first=doc.groups.find(g=>g.id===firstGroupId&&g.course===course);
 return doc.groups.filter(g=>g.course===course&&(!first||g.id!==first.id&&
  g.subject!==first.subject&&sameCurriculum(first,g)));
}
export function manualLinkStudents(doc,groupId,query=''){
 const needle=normalizeStudentName(query);
 return doc.students.filter(s=>s.groupId===groupId&&
  (!needle||normalizeStudentName(studentName(s)).includes(needle)))
  .sort((a,b)=>a.name.localeCompare(b.name,'es',{numeric:true,sensitivity:'base'})||(a.order??0)-(b.order??0));
}
export function manualLinkSuggestions(doc,course){
 return suggestStudentLinks(doc,course).filter(({a,b})=>{
  const ga=doc.groups.find(g=>g.id===a.groupId),gb=doc.groups.find(g=>g.id===b.groupId);
  return ga&&gb&&ga.subject!==gb.subject;
 });
}
function familyMarkup(doc,course){
 const families=linkedStudentFamilies(doc,course);
 return '<section class="student-link-section"><h3>Vínculos confirmados · '+families.length+'</h3>'+
  (families.length?families.map(records=>
   '<div class="student-link-family">'+records.map(s=>{
    const group=doc.groups.find(g=>g.id===s.groupId);
    return '<div class="student-link-family-row"><span><strong>'+escapeHtml(s.name)+'</strong><small>'+
     escapeHtml(groupName(group))+' · '+escapeHtml(s.originGroup||'Sin procedencia')+'</small></span>'+
     '<button type="button" class="btn small" data-unlink-student="'+escapeHtml(s.id)+'">Desvincular</button></div>';
   }).join('')+'</div>').join(''):
   '<p class="hint">Aún no hay alumnos vinculados en este curso académico.</p>')+'</section>';
}
export function renderStudentLinksManager(doc,state){
 const years=[...new Set(doc.groups.map(g=>g.course))].sort((a,b)=>b.localeCompare(a,'es',{numeric:true}));
 const year=years.includes(state.year)?state.year:years[0]||'';
 const all=manualLinkGroups(doc,year);
 const first=all.find(g=>g.id===state.groupA)||all[0];
 const secondOptions=manualLinkGroups(doc,year,first?.id||'');
 const second=secondOptions.find(g=>g.id===state.groupB)||secondOptions[0];
 const suggestions=manualLinkSuggestions(doc,year),limit=50;
 const studentCountA=first?manualLinkStudents(doc,first.id).length:0;
 const studentCountB=second?manualLinkStudents(doc,second.id).length:0;
 const groupOpt=(g,selected)=>opt(g.id,groupName(g),selected);
 return '<div class="modal-inner student-link-manager"><h2 id="modal-heading">Vincular alumnos entre asignaturas</h2>'+
  '<p class="subtitle">Relaciona dos fichas de una misma persona. <strong>No se fusionan notas ni se modifica ninguna calificación.</strong> Todos los vínculos requieren confirmación.</p>'+
  '<label class="student-link-year-label">Curso académico<select id="student-link-year">'+years.map(y=>opt(y,displayCourse(y),y===year)).join('')+'</select></label>'+
  '<section class="student-link-section"><h3>Vinculación manual</h3>'+
  '<p class="hint">Puedes elegir los alumnos aunque sus nombres estén escritos de manera diferente. Deben pertenecer a asignaturas distintas del mismo curso y etapa, con tutorías compatibles.</p>'+
  '<form id="student-link-manual-form" class="student-link-manual-grid">'+
  '<div class="student-link-side"><h4>Primera asignatura</h4>'+
  '<label>Grupo y materia<select id="student-link-group-a" required>'+all.map(g=>groupOpt(g,g.id===first?.id)).join('')+'</select></label>'+
  '<label>Buscar alumno<input id="student-link-search-a" class="text-field" type="search" autocomplete="off" placeholder="Nombre o apellidos" value="'+escapeHtml(state.queryA||'')+'"/></label>'+
  '<label>Alumno<select id="student-link-student-a" required></select><small id="student-link-count-a" class="student-link-count">'+studentCountA+' fichas</small></label></div>'+
  '<div class="student-link-side"><h4>Segunda asignatura</h4>'+
  '<label>Grupo y materia<select id="student-link-group-b" required>'+secondOptions.map(g=>groupOpt(g,g.id===second?.id)).join('')+'</select></label>'+
  '<label>Buscar alumno<input id="student-link-search-b" class="text-field" type="search" autocomplete="off" placeholder="Nombre o apellidos" value="'+escapeHtml(state.queryB||'')+'"/></label>'+
  '<label>Alumno<select id="student-link-student-b" required></select><small id="student-link-count-b" class="student-link-count">'+studentCountB+' fichas</small></label></div>'+
  '<p class="student-link-manual-warning">Comprueba personalmente que ambas fichas corresponden al mismo alumno, especialmente si los nombres son distintos. Si las tutorías son incompatibles, revisa «Gestionar procedencias» en Cuaderno.</p>'+
  '<div class="modal-error" id="student-link-error" role="alert"></div>'+
  '<button class="btn primary" id="student-link-submit" type="submit"'+(!first||!second?' disabled':'')+'>Vincular fichas seleccionadas</button>'+
  '</form></section>'+
  '<details class="student-link-section student-link-suggestions" id="student-link-suggestions"><summary>Coincidencias sugeridas · '+suggestions.length+'</summary>'+
  '<p class="hint">Solo son propuestas. No se vincula a nadie automáticamente.</p>'+
  (suggestions.length?suggestions.slice(0,limit).map(({a,b,quality})=>
   '<div class="student-link-proposal"><span><strong>'+escapeHtml(studentName(a))+'</strong> · '+
   escapeHtml(doc.groups.find(g=>g.id===a.groupId)?.subject||'')+
   ' ↔ <strong>'+escapeHtml(studentName(b))+'</strong> · '+
   escapeHtml(doc.groups.find(g=>g.id===b.groupId)?.subject||'')+
   '<small>Coincidencia '+escapeHtml(quality)+'</small></span>'+
   '<button type="button" class="btn small" data-suggest-link-a="'+escapeHtml(a.id)+'" data-suggest-link-b="'+escapeHtml(b.id)+'">Confirmar vínculo</button></div>').join('')+
   (suggestions.length>limit?'<p class="hint">Se muestran las primeras '+limit+' coincidencias. Utiliza la vinculación manual para buscar otros alumnos.</p>':''):
   '<p class="hint">No se han encontrado coincidencias de nombres. Utiliza la vinculación manual.</p>')+'</details>'+
  familyMarkup(doc,year)+
  '<div class="modal-actions"><button type="button" class="btn" id="student-link-close">Cerrar</button></div></div>';
}
export function openStudentLinksManager({dialog,getDoc,commit,toast,fail,groupId=null,defaultYear=null}){
 const doc=getDoc(),courses=[...new Set(doc.groups.map(g=>g.course))].sort((a,b)=>b.localeCompare(a,'es',{numeric:true}));
 const initialGroup=doc.groups.find(g=>g.id===groupId);
 const state={year:courses.includes(initialGroup?.course)?initialGroup.course:courses.includes(defaultYear)?defaultYear:courses[0]||'',
  groupA:initialGroup?.id||'',groupB:'',studentA:'',studentB:'',queryA:'',queryB:''};
 const render=()=>{
  const current=getDoc();
  const groups=manualLinkGroups(current,state.year);
  if(!groups.some(g=>g.id===state.groupA))state.groupA=groups[0]?.id||'';
  const alternatives=manualLinkGroups(current,state.year,state.groupA);
  if(!alternatives.some(g=>g.id===state.groupB))state.groupB=alternatives[0]?.id||'';
  dialog.innerHTML=renderStudentLinksManager(current,state);
  const $=selector=>dialog.querySelector(selector);
  const populate=(side)=>{
   const g=state['group'+side],input=$('#student-link-search-'+side.toLowerCase());
   const selected=$('#student-link-student-'+side.toLowerCase());
   const items=manualLinkStudents(getDoc(),g,input.value);
   const preserve=state['student'+side];
   selected.innerHTML=opt('','Seleccionar alumno…')+items.map(s=>
    opt(s.id,studentName(s)+' · n.º '+String((s.order??0)+1),s.id===preserve)).join('');
   if(!items.some(s=>s.id===preserve)){state['student'+side]='';selected.value='';}
   $('#student-link-count-'+side.toLowerCase()).textContent=items.length+' de '+
    getDoc().students.filter(s=>s.groupId===g).length+' fichas';
  };
  $('#student-link-year').onchange=e=>{
   state.year=e.target.value;state.groupA='';state.groupB='';state.studentA='';state.studentB='';
   state.queryA='';state.queryB='';render();
  };
  for(const side of ['A','B']){
   const lower=side.toLowerCase();
   $('#student-link-group-'+lower).onchange=e=>{
    state['group'+side]=e.target.value;
    state['student'+side]='';state['query'+side]='';
    if(side==='A'){state.groupB='';state.studentB='';state.queryB='';}
    render();
   };
   $('#student-link-search-'+lower).addEventListener('input',e=>{
    state['query'+side]=e.target.value;populate(side);
   });
   $('#student-link-student-'+lower).onchange=e=>{state['student'+side]=e.target.value;};
   populate(side);
  }
  const error=$('#student-link-error');
  const doLink=async(aId,bId)=>{
   error.textContent='';
   const d=getDoc(),a=d.students.find(s=>s.id===aId),b=d.students.find(s=>s.id===bId);
   const ga=d.groups.find(g=>g.id===a?.groupId),gb=d.groups.find(g=>g.id===b?.groupId);
   if(!a||!b||!ga||!gb)throw new Error('Selecciona dos alumnos existentes.');
   if(!sameCurriculum(ga,gb)||ga.subject===gb.subject)throw new Error('Selecciona dos materias distintas del mismo curso y etapa.');
   if(a.personId&&a.personId===b.personId)throw new Error('Estas dos fichas ya están vinculadas.');
   if(a.personId&&b.personId&&a.personId!==b.personId)throw new Error('Desvincula primero una de las identidades existentes.');
   const warning='¿Confirmas que estos dos registros pertenecen a la MISMA persona?\n\n'+
    groupName(ga)+' · '+studentName(a)+'\n'+groupName(gb)+' · '+studentName(b)+
    '\n\nNo se fusionará ni modificará ninguna nota.';
   if(!window.confirm(warning))return;
   await commit(d=>linkStudentRecords(d,[a.id,b.id]),'Vincular alumno en varias asignaturas');
   toast('Identidad vinculada. Las calificaciones de cada asignatura se conservan.');
   state.studentA='';state.studentB='';render();
  };
  $('#student-link-manual-form').onsubmit=async event=>{
   event.preventDefault();
   const submit=$('#student-link-submit');submit.disabled=true;
   try{await doLink(state.studentA,state.studentB);}catch(e){error.textContent=e.message;}
   finally{if(submit.isConnected)submit.disabled=false;}
  };
  dialog.querySelectorAll('[data-suggest-link-a][data-suggest-link-b]').forEach(button=>button.onclick=async()=>{
   button.disabled=true;try{await doLink(button.dataset.suggestLinkA,button.dataset.suggestLinkB);}
   catch(e){error.textContent=e.message;}finally{if(button.isConnected)button.disabled=false;}
  });
  dialog.querySelectorAll('[data-unlink-student]').forEach(button=>button.onclick=async()=>{
   const s=getDoc().students.find(s=>s.id===button.dataset.unlinkStudent);
   if(!s)return;
   if(!window.confirm('¿Desvincular la ficha de '+studentName(s)+'? No se borrarán sus notas.'))return;
   button.disabled=true;
   try{await commit(d=>unlinkStudentRecord(d,s.id),'Desvincular identidad compartida');
    toast('Ficha desvinculada; sus notas siguen intactas.');render();
   }catch(e){error.textContent=e.message;if(button.isConnected)button.disabled=false;}
  });
  $('#student-link-close').onclick=()=>dialog.close();
 };
 render();dialog.showModal();
}
