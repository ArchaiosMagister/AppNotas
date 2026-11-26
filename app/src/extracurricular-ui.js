import {localToday} from './planner.js';
import {extracurricularActivities,extracurricularCourseKey,extracurricularAnswer,setExtracurricularAnswer} from './extracurricular.js';
import {compareExtracurricularCourses,extracurricularLevelLabel,extracurricularGroupLabel,sortedExtracurricularRoster,
  extracurricularReport,extracurricularWord,extracurricularPdf} from './extracurricular-export.js';

const courseLabel=([year,level])=>[extracurricularLevelLabel(level),year].filter(Boolean).join(' · ');
const dateLabel=date=>new Intl.DateTimeFormat('es-ES',{dateStyle:'medium',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));

export function renderExtracurricular(doc,esc){
  const activities=extracurricularActivities(doc);
  const courses=activities.flatMap(activity=>activity.courses);
  const rows=sortedExtracurricularRoster(doc,courses);
  const eligible=activities.map(activity=>new Map(sortedExtracurricularRoster(doc,activity.courses).map(row=>[row.key,row.ids])));
  return `<section class="panel panel-pad extracurricular">
    <div class="extracurricular-tools"><h1>Actividades extraescolares</h1>
      <button type="button" class="btn primary" id="extracurricular-add" ${doc.groups.length?'':'disabled'}>+ Actividad extraescolar</button>
    </div>
    ${activities.length?`<div class="extracurricular-tools"><label>Idioma del listado
      <select id="extracurricular-language"><option value="es">Castellano</option><option value="val">Valencià</option></select>
    </label></div>
    <div class="table-scroller extracurricular-table-scroll" tabindex="0" role="region" aria-label="Participación en actividades extraescolares">
      <table class="extracurricular-table"><thead><tr><th scope="col">Alumnado</th>${activities.map(activity=>`
        <th scope="col"><strong>${esc(activity.name)}</strong><time datetime="${esc(activity.date)}">${esc(dateLabel(activity.date))}</time>
          <div class="extracurricular-actions">
            <button type="button" class="btn small" data-extra-edit="${esc(activity.id)}" aria-label="Editar ${esc(activity.name)}">Editar</button>
            <button type="button" class="btn small" data-extra-word="${esc(activity.id)}" aria-label="Exportar Word para ${esc(activity.name)}">Word</button>
            <button type="button" class="btn small" data-extra-pdf="${esc(activity.id)}" aria-label="Exportar PDF para ${esc(activity.name)}">PDF</button>
          </div>
        </th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>
          <th scope="row">${esc(row.student.name)}<small>${esc(courseLabel([row.group.course,row.group.level])+' · '+extracurricularGroupLabel(row))}</small></th>
          ${activities.map((activity,index)=>{
            const ids=eligible[index].get(row.key);
            if(!ids)return '<td>—</td>';
            const answer=extracurricularAnswer(activity,ids);
            return `<td><select data-extra-answer="${esc(activity.id)}" data-extra-student="${esc(row.key)}"
              aria-label="Participación de ${esc(row.student.name)} en ${esc(activity.name)}">
              <option value="" ${answer===undefined?'selected':''}>Pendiente</option>
              <option value="yes" ${answer===true?'selected':''}>Sí</option>
              <option value="no" ${answer===false?'selected':''}>No</option>
            </select></td>`;
          }).join('')}</tr>`).join('')||`<tr><td colspan="${activities.length+1}">No hay alumnado en los cursos seleccionados.</td></tr>`}</tbody></table>
    </div>`:`<p>${doc.groups.length?'Crea una actividad y selecciona sus cursos para añadir el alumnado.':'Crea un grupo en el cuaderno para poder seleccionar su curso.'}</p>`}
  </section>`;
}

export function bindExtracurricular({root,dialog,doc,getDoc,commit,fail,esc,state}){
  const language=root.querySelector('#extracurricular-language');
  if(language){
    language.value=state.extracurricularLanguage||'es';
    language.onchange=()=>{state.extracurricularLanguage=language.value;};
  }
  const find=(book,id)=>extracurricularActivities(book).find(activity=>activity.id===id);
  function edit(activity){
    const keys=[...new Set([...doc.groups.map(extracurricularCourseKey),...(activity?.courses||[])])];
    keys.sort((a,b)=>compareExtracurricularCourses(JSON.parse(a),JSON.parse(b)));
    dialog.innerHTML=`<form class="modal-inner" method="dialog">
      <h2 id="modal-heading">${activity?'Editar actividad extraescolar':'Nueva actividad extraescolar'}</h2>
      <div class="modal-fields">
        <label>Nombre <input class="text-field" name="name" required maxlength="150" value="${esc(activity?.name)}"></label>
        <label>Fecha <input class="text-field" name="date" type="date" required value="${esc(activity?.date||localToday())}"></label>
        <fieldset class="extracurricular-courses"><legend>Cursos participantes</legend>
          ${keys.map(key=>`<label><input type="checkbox" name="course" value="${esc(key)}" ${activity?.courses.includes(key)?'checked':''}> ${esc(courseLabel(JSON.parse(key)))}</label>`).join('')}
        </fieldset>
      </div>
      <div class="modal-error" role="alert"></div>
      <div class="modal-actions"><button class="btn" type="button" data-extra-cancel>Cancelar</button>
        <button class="btn primary" type="submit">Guardar</button></div>
    </form>`;
    const form=dialog.querySelector('form');
    form.querySelector('[data-extra-cancel]').onclick=()=>dialog.close();
    form.onsubmit=async event=>{
      event.preventDefault();
      const data=new FormData(form),name=data.get('name').trim(),date=data.get('date'),courses=data.getAll('course');
      const error=form.querySelector('.modal-error'),submit=form.querySelector('[type="submit"]');
      if(!name||!courses.length){error.textContent='Indica un nombre y selecciona al menos un curso.';return;}
      submit.disabled=true;
      try{
        await commit(next=>{
          if(activity){
            const current=find(next,activity.id);
            if(!current)throw new Error('La actividad ya no existe.');
            Object.assign(current,{name,date,courses});
          }else{
            (next.extracurricularActivities??=[]).push({id:crypto.randomUUID(),name,date,courses,answers:{}});
          }
        },activity?'Editar actividad extraescolar':'Crear actividad extraescolar');
        if(form.isConnected)dialog.close();
      }catch(err){error.textContent=err.message;}
      finally{submit.disabled=false;}
    };
    dialog.showModal();
  }
  root.querySelector('#extracurricular-add').onclick=()=>edit();
  root.querySelectorAll('[data-extra-edit]').forEach(button=>{
    button.onclick=()=>edit(find(getDoc(),button.dataset.extraEdit));
  });
  root.querySelectorAll('[data-extra-answer]').forEach(select=>{
    select.onchange=async ()=>{
      const {extraAnswer,extraStudent}=select.dataset;
      const answer=select.value===''?undefined:select.value==='yes';
      const scroller=root.querySelector('.extracurricular-table-scroll'),left=scroller.scrollLeft,top=scroller.scrollTop;
      const wasFocused=document.activeElement===select;
      select.disabled=true;
      try{
        await commit(next=>setExtracurricularAnswer(next,extraAnswer,extraStudent,answer),'Registrar participación extraescolar');
      }catch(error){
        select.value=select.querySelector('[selected]')?.value||'';
        fail(error);
      }finally{
        select.disabled=false;
        const nextScroller=root.querySelector('.extracurricular-table-scroll');
        if(nextScroller&&nextScroller!==scroller){
          nextScroller.scrollLeft=left;
          nextScroller.scrollTop=top;
          if(wasFocused&&document.activeElement===document.body){
            [...nextScroller.querySelectorAll('[data-extra-answer]')].find(item=>
              item.dataset.extraAnswer===extraAnswer&&item.dataset.extraStudent===extraStudent)?.focus({preventScroll:true});
          }
        }
      }
    };
  });
  async function download(id,format){
    const book=getDoc(),activity=find(book,id);
    const report=extracurricularReport(book,activity,language.value);
    const blob=format==='docx'?await extracurricularWord(report,window.JSZip):extracurricularPdf(report);
    const url=URL.createObjectURL(blob),anchor=document.createElement('a');
    const safeName=activity.name.replace(/[^\p{L}\p{N}_-]+/gu,'-').slice(0,90);
    anchor.href=url;
    anchor.download=`AppNotas-${activity.date}-${safeName}-${language.value}.${format}`;
    document.body.append(anchor);anchor.click();anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  root.querySelectorAll('[data-extra-word],[data-extra-pdf]').forEach(button=>{
    button.onclick=async ()=>{
      button.disabled=true;
      try{
        await state.mutationQueue;
        if(button.isConnected)await download(button.dataset.extraWord||button.dataset.extraPdf,button.dataset.extraWord?'docx':'pdf');
      }catch(error){fail(error);}
      finally{button.disabled=false;}
    };
  });
}
