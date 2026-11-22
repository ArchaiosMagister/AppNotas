import {initialNotebook,emptyNotebook,assertModel,migrateNotebook,effectiveCategories,setPeriodCategory,resetPeriodCategories,copyPeriodCategories,updateAssessment,moveAssessment,removeAssessment,addGroup,addPeriod,addStudent,addAssessment,addCategory,removeCategoryFromGroup,availableCategories,copyPeriodAssessments,setGrade,setNotSubmitted,setPendingJustified,individualCategoryRule,setIndividualCategoryRule,addCompetency,setCompetencyLink,COURSE_SUBJECTS,SUBJECT_COLORS,subjectKey,validSubject,catalogForNotebook,addNotebookSubject,removeNotebookSubject,defaultSubjectAccent,setSubjectAccent,classifyGroup,createRubric,updateRubric,duplicateRubric,setRubricGrade,setFinalConfig,setFinalOverride,renameStudent,updateStudentIdentity,sortStudents,STUDENT_SORT_MODES,STUDENT_ACTIVITY_SORT_MODES,sortStudentPeriodActivities,moveStudent,removeStudent,updateGroupInfo,renamePeriod,movePeriod,recordedScore,parseScore,setOrthographyGrade,setOrthographyDefaults,groupOrthographyRefundable,setGroupOrthographyRefundable,ORTHOGRAPHY_DEFAULTS,ITACA_ROUNDING,itacaGroupRule,itacaStudentRule,setItacaGroupRule,setItacaStudentRule,setCategoryColumnColor,categoryColumnColor,getGradeObservation,setGradeObservation} from './src/model.js';
import {categoryGrade,categoryEvidence,overallGrade,competencyGrade,competencyArithmeticMean,gradeToFour,competencyAcquisitionLevel,competencyAcquisitionLabel,COMPETENCY_ACQUISITION_LABELS,formatGrade,gradeTone,calculationBreakdown,finalEvidence,finalGrade,normalizedScore,periodCalculationWarnings,effectiveAssessmentScore,orthographyPenalty,itacaGrade} from './src/calculations.js';
import {studentsFromCsv} from './src/csv.js';
import {parseRubricText} from './src/rubric-import.js';
import {parseRubricFile} from './src/rubric-xlsx.js';
import {createVault,seal,unlockVault,saltFromEnvelope,validateEnvelope} from './src/vault.js';
import {openDb,readEnvelope,writeEnvelope,sameEnvelope,readRecoveryEnvelope,replaceEnvelopeWithRecovery,swapRecoveryEnvelope,readExportReceipt,recordExportReceipt} from './src/storage.js';
import {ensureBookMetadata,markBookChange,compareBookVersions,compareBackupAgainstLocal,importRiskLevel,canConfirmImport,IMPORT_CONFIRMATION_TEXT,backupProtection,createPortableCopy,readBackupFile,backupSummary,portableFilename} from './src/cuaderno.js';
import {emptyHistory,recordChange,stepHistory} from './src/history.js';
import {previewRubric,validateRubricDraft} from './src/rubric-ui.js';
import {RELOAD_PROBE_KEY,makeReloadProbe,evaluateReloadProbe} from './src/diagnostics.js';
import {CURRICULA} from './src/curriculum-data.js';
import {officialCompetenciesForGroup,groupCompetencies,linkedOfficialCompetency,curriculumCompetenciesWithCriteria} from './src/official-competencies.js';
import {ensurePlanner,localToday,activeYear,setActiveYear,addAcademicYear} from './src/planner.js';
import {renderPlanner,bindPlanner} from './src/planner-ui.js';
import {assessmentClassStatistics,periodClassStatistics,finalClassStatistics,categoryClassStatistics,competencyClassStatistics} from './src/statistics.js';

import {installInstructions,mayReloadForUpdate,storagePersistence} from './src/pwa-controls.js';

const root=document.getElementById('app');
const dialog=document.getElementById('modal');
// Control de instalación y actualizaciones: ninguna recarga automática durante una edición.
let pendingInstallPrompt=null;
let pwaRegistration=null;
let checkingPwaUpdate=false;
let applyingPwaUpdate=false;
const installedAsPwa=()=>window.matchMedia?.('(display-mode: standalone)').matches===true||navigator.standalone===true;
const installIcon='<svg aria-hidden="true" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4"/></svg>';
const updateIcon='<svg aria-hidden="true" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.3 9A8 8 0 0 1 19 7l1 5M4 12l1 5a8 8 0 0 0 13.7-2"/></svg>';
function pwaButtons(){
  return `<div class="pwa-controls" role="group" aria-label="Instalación y actualizaciones"><button type="button" class="btn small pwa-action" data-pwa-install>${installIcon}<span class="pwa-install-label">Instalar aplicación</span></button><button type="button" class="btn small pwa-action" data-pwa-update>${updateIcon}<span class="pwa-update-label">Buscar actualizaciones</span></button></div>`;
}
function paintPwaButtons(){
  for(const button of root.querySelectorAll('[data-pwa-install]')){
    button.disabled=installedAsPwa();
    button.querySelector('.pwa-install-label').textContent=installedAsPwa()?'Ya instalada':'Instalar aplicación';
    button.title=installedAsPwa()?'Esta aplicación ya está instalada':'Instalar o ver instrucciones para este dispositivo';
  }
  for(const button of root.querySelectorAll('[data-pwa-update]')){
    const waiting=Boolean(pwaRegistration?.waiting&&navigator.serviceWorker?.controller);
    button.disabled=checkingPwaUpdate||applyingPwaUpdate;
    button.querySelector('.pwa-update-label').textContent=checkingPwaUpdate?'Buscando…':waiting?'Actualización disponible':'Buscar actualizaciones';
    button.classList.toggle('has-update',waiting);
    button.title=waiting?'Hay una versión preparada: revisa y confirma la actualización':'Comprobar si GitHub ha publicado una nueva versión';
  }
}
function wirePwaButtons(){
  for(const button of root.querySelectorAll('[data-pwa-install]'))button.addEventListener('click',()=>installPwa().catch(fail));
  for(const button of root.querySelectorAll('[data-pwa-update]'))button.addEventListener('click',()=>checkPwaUpdate().catch(fail));
  paintPwaButtons();
}
function watchPwaRegistration(reg){
  pwaRegistration=reg;
  const observe=worker=>{
    if(!worker)return;
    worker.addEventListener('statechange',()=>{
      if(worker.state==='installed'&&navigator.serviceWorker.controller){paintPwaButtons();toast('Nueva versión disponible. Pulsa «Buscar actualizaciones» para aplicarla cuando hayas terminado de trabajar.');}
      else paintPwaButtons();
    });
  };
  reg.addEventListener('updatefound',()=>observe(reg.installing));
  observe(reg.installing);
  paintPwaButtons();
}
async function installPwa(){
  if(installedAsPwa()){toast('La aplicación ya está instalada en este dispositivo.');return;}
  if(location.protocol==='file:'){
    showInfo('Instalación no disponible en este archivo','<p>La versión HTML autónoma sirve para pruebas, pero no se puede instalar como PWA desde un archivo local. Abre la dirección HTTPS de AppNotas.</p>');return;
  }
  if(pendingInstallPrompt){
    const prompt=pendingInstallPrompt;pendingInstallPrompt=null;
    await prompt.prompt();
    const choice=await prompt.userChoice;
    toast(choice?.outcome==='accepted'?'El navegador ha aceptado la solicitud de instalación. Comprueba tu pantalla de inicio o aplicaciones.':'Instalación cancelada. Puedes volver a intentarlo desde el menú del navegador.');
    paintPwaButtons();return;
  }
  const guide=installInstructions(navigator.userAgent||'',navigator.platform||'');
  showInfo('Instalar CuadernoDocente',`<p>${esc(guide)}</p><p class="hint">El cuaderno permanece en el almacenamiento local de este dispositivo. Instalar la PWA no sincroniza notas entre equipos.</p>`);
}
async function waitForPwaInstall(reg){
  if(!reg.installing)return;
  const installing=reg.installing;
  if(['installed','activated','redundant'].includes(installing.state))return;
  await new Promise(resolve=>{
    const done=()=>{clearTimeout(timer);installing.removeEventListener('statechange',watch);resolve();};
    const watch=()=>{if(['installed','activated','redundant'].includes(installing.state))done();};
    const timer=setTimeout(done,20000);
    installing.addEventListener('statechange',watch);watch();
  });
}
async function checkPwaUpdate(){
  if(checkingPwaUpdate||applyingPwaUpdate)return;
  if(location.protocol==='file:'||!('serviceWorker' in navigator)){
    toast('Las actualizaciones se comprueban desde la PWA HTTPS, no desde el HTML autónomo.');return;
  }
  if(!navigator.onLine){toast('No hay conexión. Conservamos la versión instalada; comprueba las actualizaciones cuando vuelvas a tener internet.');return;}
  checkingPwaUpdate=true;paintPwaButtons();
  try{
    const reg=pwaRegistration||await navigator.serviceWorker.getRegistration('./');
    if(!reg){toast('Preparando el servicio offline. Recarga con conexión y vuelve a comprobar.');return;}
    if(!pwaRegistration)watchPwaRegistration(reg);
    if(!reg.waiting){await reg.update();await waitForPwaInstall(reg);}
    if(reg.waiting&&navigator.serviceWorker.controller){
      await applyPwaUpdate(reg);return;
    }
    if(reg.installing){toast('El navegador sigue preparando la nueva versión. Repite la comprobación cuando termine.');return;}
    toast('No hay una nueva versión pendiente de aplicar.');
  }catch(error){toast('No ha sido posible comprobar la actualización: '+error.message);}
  finally{checkingPwaUpdate=false;paintPwaButtons();}
}
async function applyPwaUpdate(reg){
  if(!reg.waiting)return;
  if(!window.confirm('Hay una nueva versión de CuadernoDocente. Se esperará al guardado local antes de actualizar y recargar. ¿Aplicarla ahora?'))return;
  await STATE.mutationQueue;
  try{await STATE.saveQueue;}catch{
    toast('La actualización está bloqueada por un error de guardado. Conserva los datos y resuelve el problema.');return;
  }
  if(!mayReloadForUpdate(STATE)){
    toast('Hay cambios pendientes o un error de guardado. No se actualizará hasta que el cuaderno esté guardado.');return;
  }
  applyingPwaUpdate=true;root.inert=true;paintPwaButtons();
  let finished=false;
  const changed=()=>{finished=true;clearTimeout(timer);location.reload();};
  const timer=setTimeout(()=>{
    if(finished)return;
    navigator.serviceWorker.removeEventListener('controllerchange',changed);
    applyingPwaUpdate=false;root.inert=false;paintPwaButtons();
    toast('No se ha podido activar la actualización. Tus datos se conservan. Vuelve a comprobarla.');
  },12000);
  navigator.serviceWorker.addEventListener('controllerchange',changed,{once:true});
  try{reg.waiting.postMessage({type:'SKIP_WAITING'});}
  catch(error){clearTimeout(timer);navigator.serviceWorker.removeEventListener('controllerchange',changed);applyingPwaUpdate=false;root.inert=false;toast('No se ha podido activar: '+error.message);}
}
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();pendingInstallPrompt=event;paintPwaButtons();});
window.addEventListener('appinstalled',()=>{pendingInstallPrompt=null;paintPwaButtons();toast('El navegador ha confirmado la instalación de CuadernoDocente.');});

const savedTheme=()=>{try{const value=localStorage.getItem('cuaderno-docente-theme');return ['light','dark','oled'].includes(value)?value:'light';}catch{return 'light';}};
const savedNavigation=()=>{try{return localStorage.getItem('cuaderno-docente-nav-collapsed')==='yes';}catch{return false;}};
const savedStudentSort=()=>{try{const mode=localStorage.getItem('cuaderno-docente-student-sort');return STUDENT_SORT_MODES.includes(mode)?mode:'surname';}catch{return 'surname';}};
const savedStudentPlainSort=()=>{try{const mode=localStorage.getItem('cuaderno-docente-student-sort-before-group');return STUDENT_SORT_MODES.includes(mode)&&mode!=='originGroup'?mode:'surname';}catch{return 'surname';}};
const savedStudentActivityOrders=()=>{try{
  const raw=JSON.parse(localStorage.getItem('cuaderno-docente-student-activity-orders')||'{}');
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return {};
  return Object.fromEntries(Object.entries(raw).filter(([id,mode])=>id.length<150&&STUDENT_ACTIVITY_SORT_MODES.includes(mode)).slice(0,200));
}catch{return {};}};
const STUDENT_ACTIVITY_SORT_OPTIONS=[['category','Por categoría'],['column','Orden del cuaderno'],['alphabetical','Nombre de actividad (A–Z)'],['reverse','Últimas actividades primero']];

const STATE={plannerMode:'week',plannerDate:localToday(),plannerEventRequest:null,theme:savedTheme(),navCollapsed:savedNavigation(),studentSort:savedStudentSort(),studentPlainSort:savedStudentPlainSort(),studentActivityOrders:savedStudentActivityOrders(),studentPeriodOpen:{},db:null,doc:null,key:null,salt:null,envelope:null,groupId:null,periodId:null,level:null,subject:null,tab:'cuaderno',studentId:null,curriculumVersion:'2022',competencyVersion:'auto',curriculumSection:'competencias',curriculumCompetence:'all',curriculumQuery:'',saveQueue:Promise.resolve(),mutationQueue:Promise.resolve(),pending:0,failedEnvelope:null,history:emptyHistory(),saving:0,saveError:null,reloadProbe:null,recovery:null,exportReceipt:null};
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const $=(sel,context=document)=>context.querySelector(sel);
const opt=(id,label,chosen)=>`<option value="${esc(id)}" ${chosen===id?'selected':''}>${esc(label)}</option>`;
const gradeFmt=x=>formatGrade(x,STATE.doc.settings);
const rawFmt=x=>x===null||x===undefined?'—':Number(x).toLocaleString('es-ES',{minimumFractionDigits:0,maximumFractionDigits:2});
const penaltyFmt=x=>Number(x).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2});
const gradeStyle=x=>Number.isFinite(x)?` data-grade-value="${x}"`:'';
/** Usar CSSOM permite respetar la CSP sin autorizar estilos inline en HTML. */
function paintGrades(context=document){
  context.querySelectorAll('[data-grade-value]').forEach(el=>{
    const tone=gradeTone(Number(el.dataset.gradeValue));
    if(!tone)return;
    el.style.setProperty('--grade-bg',tone.background);
    el.style.setProperty('--grade-fg',tone.color);
  });
}
/** La CSP exige CSSOM: no usar style="" para colores configurables.
 * El color se aplica a la CABECERA y a TODAS las celdas de cada categoría,
 * incluso cuando las columnas están intercaladas en la misma evaluación. */
function paintCategoryColumns(context=document){
  if(!STATE.doc)return;
  context.querySelectorAll('.grade-table .category-tinted[data-column-category]').forEach(cell=>{
    const color=categoryColumnColor(STATE.doc,cell.dataset.columnCategory);
    if(color)cell.style.setProperty('--category-color',color);
  });
}
/** En el visor individual se respeta el mismo color de categoría.
 * Aplicarlo después del render con CSSOM evita estilos inline bloqueados por CSP. */
function paintStudentCategoryCards(context=document){
  if(!STATE.doc)return;
  context.querySelectorAll('.student-period .student-category-tinted[data-column-category]').forEach(card=>{
    const color=categoryColumnColor(STATE.doc,card.dataset.columnCategory);
    if(color)card.style.setProperty('--category-color',color);
  });
}
const gradeChip=(score,suffix='')=>score===null||score===undefined||!Number.isFinite(score)?'<span class="grade-empty">—</span>':`<span class="grade-chip"${gradeStyle(score)}>${esc(gradeFmt(score))}${suffix?`<span class="grade-suffix">${esc(suffix)}</span>`:''}</span>`;
/** La media 0–10 se conserva intacta. Solo su presentación competencial
 * emplea niveles 1–4, con 1 como la mayor adquisición. */
const competencySourceGrade=score=>Number(score).toLocaleString('es-ES',{maximumFractionDigits:8});
function competencyLevelChip(score){
  const level=competencyAcquisitionLevel(score);
  if(level===null)return '<span class="grade-empty" aria-label="Sin evidencias">—</span>';
  const label=competencyAcquisitionLabel(score);
  return `<span class="competency-level-cell" title="Nivel ${level}: ${esc(label)} · Media original ${esc(competencySourceGrade(score))} / 10">
    <span class="competency-level-badge competency-level-${level}" aria-label="Nivel ${level}: ${esc(label)}"><strong>${level}</strong><span>${esc(label)}</span></span>
    <small class="competency-source-grade">Media original: ${esc(competencySourceGrade(score))} / 10</small>
  </span>`;
}
function competencyScaleLegend(){
  const bounds={1:'8–10',2:'6,5–menos de 8',3:'5–menos de 6,5',4:'0–menos de 5'};
  return `<div class="competency-scale-legend" role="note" aria-label="Leyenda de niveles de adquisición competencial"><strong>Escala de adquisición · 1 = máximo, 4 = mínimo</strong>
    <div class="competency-scale-items">${[1,2,3,4].map(level=>`<span class="competency-scale-item"><b class="competency-legend-number competency-level-${level}">${level}</b><span><strong>${esc(COMPETENCY_ACQUISITION_LABELS[level])}</strong><small>${esc(bounds[level])} / 10</small></span></span>`).join('')}</div>
    <p class="hint">Cada nivel se obtiene de la media original, sin redondeos previos. Sin evidencias se muestra «—». La media 0–10 sigue intacta para los cálculos.</p>
  </div>`;
}
/** Ítaca usa enteros para umbrales y media con dos decimales en modo «sin redondear»,
 * incluso cuando el usuario configura otra precisión visual en el cuaderno. */
function itacaChip(doc,studentId,groupId,periodId){
  const score=itacaGrade(doc,studentId,groupId,periodId);
  if(score===null)return '<span class="grade-empty">—</span>';
  const specific=itacaStudentRule(doc,studentId,periodId);
  const rule=specific==='general'?itacaGroupRule(doc,groupId):specific;
  const shown=rule==='none'?score.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2}):String(score);
  return `<span class="grade-chip"${gradeStyle(score)}>${esc(shown)}</span>`;
}

// Indicadores visibles únicamente en las vistas docentes, nunca en el modo alumno.
const classStatButton=(kind,id,label)=>`<button type="button" class="class-stat-trigger" data-class-stat="${esc(kind+':'+id)}" aria-label="Estadísticas de ${esc(label)}: ${kind==='competency'?'nivel medio y aprobados':'media y aprobados'}" aria-expanded="false"><span class="class-stat-info" aria-hidden="true">ⓘ</span></button>`;
let unbindClassStats=()=>{};
function bindClassStatistics(){
  unbindClassStats();unbindClassStats=()=>{};
  const triggers=[...document.querySelectorAll('[data-class-stat]')];
  if(!STATE.doc||!triggers.length||!['cuaderno','final','calculos','competencias'].includes(STATE.tab))return;
  let popup=null,active=null;
  const settings=STATE.doc.settings;
  const formatNumber=x=>Number(x).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2});
  function hide(){
    if(active){active.setAttribute('aria-expanded','false');active.removeAttribute('aria-controls');}
    active=null;popup?.remove();popup=null;
  }
  function metrics(key){
    const index=key.indexOf(':');if(index<0)return null;
    const type=key.slice(0,index),id=key.slice(index+1),g=STATE.groupId,p=STATE.periodId;
    if(type==='assessment')return assessmentClassStatistics(STATE.doc,g,id);
    if(type==='period')return periodClassStatistics(STATE.doc,g,id);
    if(type==='annual-period')return periodClassStatistics(STATE.doc,g,id,{finalView:true});
    if(type==='course')return finalClassStatistics(STATE.doc,g);
    if(type==='category')return categoryClassStatistics(STATE.doc,g,p,id);
    if(type==='competency')return competencyClassStatistics(STATE.doc,g,p,id);
    return null;
  }
  function place(trigger){
    if(!popup)return;
    const rect=trigger.getBoundingClientRect();
    const width=popup.offsetWidth;
    const x=Math.max(8,Math.min(window.innerWidth-width-8,rect.left+rect.width/2-width/2));
    const above=rect.bottom+popup.offsetHeight+14>window.innerHeight&&rect.top>popup.offsetHeight+14;
    popup.style.left=x+'px';
    popup.style.top=(above?Math.max(8,rect.top-popup.offsetHeight-8):Math.max(8,Math.min(window.innerHeight-popup.offsetHeight-8,rect.bottom+8)))+'px';
  }
  function show(trigger){
    const stats=metrics(trigger.dataset.classStat);if(!stats)return;
    hide();active=trigger;trigger.setAttribute('aria-expanded','true');trigger.setAttribute('aria-controls','class-stat-popover');
    popup=document.createElement('div');
    popup.id='class-stat-popover';popup.className='class-stat-popover';popup.setAttribute('role','region');
    popup.setAttribute('aria-label','Estadísticas de la clase');
    const isCompetency=trigger.dataset.classStat.startsWith('competency:');
    const meanDisplay=isCompetency
      ?competencyLevelChip(stats.mean)
      :stats.mean===null?'Sin notas':esc(formatGrade(stats.mean,settings))+' /'+esc(stats.maximum);
    popup.innerHTML=`<strong>Estadísticas de la clase</strong><div class="class-stat-line"><span>${isCompetency?'Nivel de adquisición de la media':'Media'}</span><b>${meanDisplay}</b></div><div class="class-stat-line"><span>Aprobados</span><b>${stats.passed} / ${stats.total} (${stats.percentTotal===null?'—':formatNumber(stats.percentTotal)+' %'})</b></div><div class="class-stat-line"><span>Con nota</span><b>${stats.graded} / ${stats.total}</b></div><small>${stats.graded?`De los evaluados, aprueba el ${formatNumber(stats.percentGraded)} %.`:'Todavía no hay calificaciones.'} Las notas vacías no se cuentan en la media ni como suspensos.</small>`;
    document.body.appendChild(popup);
    place(trigger);
  }
  const onOutside=e=>{if(active&&!active.contains(e.target)&&!popup?.contains(e.target))hide();};
  const onKey=e=>{if(e.key==='Escape'&&popup){const button=active;hide();button?.focus();}};
  const onScroll=()=>{if(popup)hide();};
  const off=[];
  function listen(node,type,fn,opts){node.addEventListener(type,fn,opts);off.push(()=>node.removeEventListener(type,fn,opts));}
  for(const trigger of triggers){
    // Única vía de apertura: activación explícita (clic, toque, Intro o Espacio).
    // No registrar pointerenter, mouseenter ni focus: el hover no debe abrir nada.
    listen(trigger,'click',e=>{
      e.stopPropagation();
      if(active===trigger)hide();else show(trigger);
    });
  }
  listen(document,'pointerdown',onOutside);
  listen(document,'keydown',onKey);
  listen(window,'scroll',onScroll,true);
  listen(window,'resize',onScroll);
  unbindClassStats=()=>{hide();for(const f of off)f();};
}

const visibleCategories=()=>availableCategories(STATE.doc,STATE.groupId);
document.documentElement.dataset.theme=STATE.theme;
const currentGroup=()=>STATE.doc.groups.find(x=>x.id===STATE.groupId);
const currentPeriod=()=>STATE.doc.periods.find(x=>x.id===STATE.periodId);
const allAssessments=()=>STATE.doc.assessments.filter(x=>x.groupId===STATE.groupId&&x.periodId===STATE.periodId).sort((a,b)=>a.order-b.order);
const allStudents=()=>sortStudents(STATE.doc.students.filter(x=>x.groupId===STATE.groupId),STATE.studentSort);
const STUDENT_SORT_LABELS=[['surname','Apellidos (A–Z)'],['firstName','Nombre (A–Z)'],['originGroup','Grupo de procedencia · apellidos'],['manual','Orden manual']];
const studentSortControls=()=>`<div class="student-mode-toolbar" role="group" aria-label="Presentación de alumnos"><strong class="student-mode-title">Alumnos</strong><label class="student-group-switch" for="student-group-mode"><input type="checkbox" id="student-group-mode" role="switch" aria-label="Modo grupo: agrupar por procedencia y ordenar por apellidos" aria-checked="${STATE.studentSort==='originGroup'}" ${STATE.studentSort==='originGroup'?'checked':''}/><span class="student-group-switch-track" aria-hidden="true"></span><span>Modo grupo</span></label></div><label class="student-sort-control" for="student-sort-mode"><span>Ordenar</span><select id="student-sort-mode" aria-label="Ordenar alumnos">${STUDENT_SORT_LABELS.map(([key,label])=>opt(key,label,STATE.studentSort)).join('')}</select></label><small class="student-sort-hint">El orden solo cambia en pantalla; las notas permanecen intactas.</small>`;
/** Presentación local: alternar el grupo no altera el orden ni los registros cifrados.
 * Al desactivarlo se recupera la ordenación individual que estaba seleccionada. */
function setStudentSort(mode){
  if(!STUDENT_SORT_MODES.includes(mode))return;
  if(mode==='originGroup'){
    if(STATE.studentSort!=='originGroup')STATE.studentPlainSort=STATE.studentSort;
  }else{
    STATE.studentPlainSort=mode;
  }
  STATE.studentSort=mode;
  try{
    localStorage.setItem('cuaderno-docente-student-sort',mode);
    localStorage.setItem('cuaderno-docente-student-sort-before-group',STATE.studentPlainSort);
  }catch{}
  render();
}
const studentOriginBadge=student=>student.originGroup?`<span class="student-origin-badge" title="Grupo de procedencia">${esc(student.originGroup)}</span>`:'';
const originEqual=(a,b)=>String(a||'').localeCompare(String(b||''),'es',{sensitivity:'base',numeric:true})===0;
/** Cabeceras de grupo solo en el modo específico: las filas no modifican las notas. */
function originGroupHeader(students,index,colspan){
  if(STATE.studentSort!=='originGroup')return '';
  const group=students[index].originGroup||'';
  if(index>0&&originEqual(group,students[index-1].originGroup||''))return '';
  const number=students.filter(s=>originEqual(group,s.originGroup||'')).length;
  return `<tr class="student-origin-divider"><th colspan="${colspan}" scope="rowgroup"><span>Grupo de procedencia: ${esc(group||'Sin etiqueta')}</span><span>${number} ${number===1?'alumno':'alumnos'}</span></th></tr>`;
}
function originDirectoryHeader(students,index){
  if(STATE.studentSort!=='originGroup')return '';
  const group=students[index].originGroup||'';
  if(index>0&&originEqual(group,students[index-1].originGroup||''))return '';
  return `<div class="student-directory-divider" role="heading" aria-level="3">Grupo de procedencia: ${esc(group||'Sin etiqueta')}</div>`;
}

let toastTimeout;
function toast(message){let el=$('#toast');if(!el){el=document.createElement('div');el.id='toast';el.className='status-message';document.body.appendChild(el);}el.textContent=message;el.classList.remove('hidden');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>el.classList.add('hidden'),4300);}
function fail(error){console.error(error);toast(error?.message||'Ha ocurrido un error.');}
function fieldsModal(title,fields,onSubmit,caption=''){
  dialog.innerHTML=`<form method="dialog" class="modal-inner" id="modal-form"><h2 id="modal-heading">${esc(title)}</h2>${caption?`<p class="subtitle">${esc(caption)}</p>`:''}<div class="modal-fields">${fields.map(f=>`<label>${esc(f.label)}${f.type==='textarea'?`<textarea class="text-field rubric-textarea" name="${esc(f.id)}" rows="7" required>${esc(f.value??'')}</textarea>`:f.type==='select'?`<select name="${esc(f.id)}" ${f.required===false?'':'required'}>${f.options.map(o=>opt(o.value,o.label,f.value)).join('')}</select>`:`<input class="text-field" name="${esc(f.id)}" type="${esc(f.type||'text')}" value="${esc(f.value??'')}" ${f.required===false?'':'required'} ${f.min!==undefined?`min="${f.min}"`:''} ${f.max!==undefined?`max="${f.max}"`:''} ${f.step?`step="${f.step}"`:''} maxlength="${f.maxlength||150}" autocomplete="off"/>`}</label>`).join('')}</div><div class="modal-error" role="alert"></div><div class="modal-actions"><button type="button" class="btn" id="close-dialog">Cancelar</button><button class="btn primary" type="submit">Guardar</button></div></form>`;
  $('#close-dialog',dialog).addEventListener('click',()=>dialog.close());
  $('#modal-form',dialog).addEventListener('submit',async e=>{
    e.preventDefault();
    const form=e.currentTarget,submit=$('[type=submit]',form);
    const data=Object.fromEntries(new FormData(form));
    submit.disabled=true;
    try{await onSubmit(data);if(form.isConnected)dialog.close();}
    catch(err){$('.modal-error',form).textContent=err.message;}
    finally{submit.disabled=false;}
  });
  dialog.showModal();$('input,select,textarea',dialog)?.focus();
}
function showInfo(title,markup){
  dialog.innerHTML=`<div class="modal-inner"><h2 id="modal-heading">${esc(title)}</h2>${markup}<div class="modal-actions"><button class="btn primary" id="close-info">Cerrar</button></div></div>`;
  paintGrades(dialog);$('#close-info',dialog).onclick=()=>dialog.close();dialog.showModal();
}
function setStatus(){const el=$('#save-status');if(!el)return;const error=!!STATE.saveError;el.className='pill status '+(error?'error':STATE.saving?'pending':'ok');el.textContent=error?'¡Sin guardar!':STATE.saving?'Guardando…':'Guardado cifrado';updatePortableStatus();}
function updatePortableStatus(){
  const el=$('#portable-status');if(!el||!STATE.doc)return;
  const status=backupProtection(STATE.doc,STATE.exportReceipt);
  const messages={
    current:'✓ Archivo .cuaderno reabierto y comprobado recientemente; la revisión actual coincide.',
    aged:'⚠ La última verificación de copia externa tiene más de 7 días. Guarda y comprueba otra.',
    modified:'⚠ Hay notas o cambios posteriores al último archivo comprobado. Crea y verifica una nueva copia.',
    'modified-unchecked':'⚠ Hay cambios posteriores a la exportación, y ese archivo aún no se ha comprobado.',
    unchecked:'● Se registró una exportación, pero falta reabrir el archivo para comprobar que se conserva y descifra.',
    missing:'⚠ No consta ninguna copia externa comprobada de esta revisión. Guarda un .cuaderno y verifícalo.'
  };
  el.textContent=STATE.saveError?'⚠ Hay cambios sin guardar. No cierres ni importes todavía.':
    STATE.saving?'Guardando en este dispositivo…':messages[status];
  el.className='portable-status '+(STATE.saveError||['aged','modified','modified-unchecked','missing'].includes(status)?'portable-error':status==='current'?'portable-ok':'');
}
async function persist(snapshot){
  STATE.saving++;setStatus();
  const task=async()=>{
    const envelope=await seal(snapshot,STATE.key,STATE.salt);
    STATE.failedEnvelope=envelope;
    await writeEnvelope(STATE.db,envelope,STATE.envelope);
    STATE.failedEnvelope=null;
    STATE.envelope=envelope;
    STATE.saveError=null;
  };
  STATE.saveQueue=STATE.saveQueue.catch(()=>{}).then(task);
  try{await STATE.saveQueue;}catch(e){STATE.saveError=e;fail(new Error('No se han podido guardar los cambios. En Ajustes puedes descargar el intento cifrado si está disponible. '+e.message));throw e;}
  finally{STATE.saving--;setStatus();}
}
/** Guardar antes de confirmar un cambio evita perder la única versión válida si falla IndexedDB. */
function warnPending(event){
  event.preventDefault();event.returnValue=true;
}
function updateUnloadWarning(){
  if(STATE.pending||STATE.saveError)window.addEventListener('beforeunload',warnPending);
  else window.removeEventListener('beforeunload',warnPending);
}
function enqueueMutation(fn){
  STATE.pending++;updateUnloadWarning();
  const job=STATE.mutationQueue.then(fn).finally(()=>{
    STATE.pending--;updateUnloadWarning();
  });
  STATE.mutationQueue=job.catch(()=>{});
  return job;
}

function commit(action,label='Modificar cuaderno'){
  return enqueueMutation(async()=>{
    if(!STATE.doc||!STATE.key)throw new Error('El cuaderno está bloqueado.');
    if(STATE.saveError)throw new Error('El guardado está bloqueado por un error. No introduzcas más notas: recarga el cuaderno y revisa la situación.');
    const before=STATE.doc,next=structuredClone(before);
    action(next);assertModel(next);
    if(JSON.stringify(before)===JSON.stringify(next))return;
    markBookChange(next,before);
    await persist(next);
    STATE.history=recordChange(STATE.history,before,next,label);
    STATE.doc=next;render();
  });
}
function navigateHistory(direction){
  return enqueueMutation(async()=>{
    if(!STATE.doc||!STATE.key)throw new Error('El cuaderno está bloqueado.');
    if(STATE.saveError)throw new Error('No se puede deshacer o rehacer hasta resolver el error de almacenamiento.');
    const step=stepHistory(STATE.history,STATE.doc,direction);
    if(!step)return;
    assertModel(step.doc);
    markBookChange(step.doc,STATE.doc);
    await persist(step.doc);
    STATE.doc=step.doc;STATE.history=step.history;
    // Mantener la vista individual solo si su registro sigue siendo válido.
    if(STATE.studentId&&!STATE.doc.students.some(s=>s.id===STATE.studentId&&s.groupId===STATE.groupId))STATE.studentId=null;
    render();toast(`${direction==='undo'?'Deshecho':'Rehecho'}: ${step.label}.`);
  });
}

function chooseInitial(){
  const group=STATE.doc.groups[0];STATE.groupId=group?.id||null;
  STATE.level=group?.level||'legacy';STATE.subject=group?group.subject:'Latín I';
  if(!group){const available=catalogForNotebook(STATE.doc).flatMap(entry=>entry.subjects.map(subject=>({level:entry.level,subject})));const selected=available.find(x=>x.level==='1bach'&&x.subject==='Latín I')||available[0];STATE.level=selected?.level||'1bach';STATE.subject=selected?.subject||'Latín I';}
  STATE.periodId=[...STATE.doc.periods].sort((a,b)=>a.order-b.order)[0]?.id||null;
}
const groupsForSubject=()=>STATE.doc.groups.filter(g=>(g.level??'legacy')===STATE.level&&g.subject===STATE.subject);
function setSubjectChoice(level,subject){
  STATE.level=level;STATE.subject=subject;STATE.competencyVersion='auto';
  STATE.groupId=groupsForSubject()[0]?.id||null;
  render();
}
/** Restaurar los acentos originales de cada materia, incluidos los personalizados.
 * El rediseño clásico no sustituye los colores almacenados del docente. */
function colorFor(level,subject){
  const key=subjectKey(level,subject);
  return STATE.doc.settings.subjectAccents[key]||defaultSubjectAccent(level,subject);
}
function contrastFor(hex){
  const vals=[1,3,5].map(pos=>parseInt(hex.slice(pos,pos+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
  return vals[0]*.2126+vals[1]*.7152+vals[2]*.0722>.179?'#000000':'#FFFFFF';
}
/** Tres identidades visuales por materia, independientes de notas y preferencias. */
function classicalSkinFor(level,subject){
  if(subject==='Griego I'||subject==='Griego II')return 'attica';
  if(subject==='Latín II')return 'tabularium';
  return 'marmorea'; // Latín I, Latín 4.º y cursos heredados.
}
const CLASSICAL_SKIN_TITLES={marmorea:'SCHOLA MARMOREA',tabularium:'TABULARIUM',attica:'ACADEMIA ATTICA'};
function applyTheme(){
  document.documentElement.dataset.theme=STATE.theme;
  document.documentElement.dataset.courseSkin=classicalSkinFor(STATE.level,STATE.subject);
  // El carácter visual griego se distingue también en cabecera, bordes y tablas.
  // No se guarda en el cuaderno: es únicamente un estado de presentación.
  document.documentElement.dataset.courseVariant=STATE.subject==='Griego II'?'griego-ii':STATE.subject==='Griego I'?'griego-i':'latin';
  const color=colorFor(STATE.level,STATE.subject);
  document.documentElement.style.setProperty('--accent',color);
  document.documentElement.style.setProperty('--classic-accent',color);
  document.documentElement.style.setProperty('--accent-ink',contrastFor(color));
}
const pairOptions=()=>catalogForNotebook(STATE.doc).flatMap(({level,label,subjects})=>subjects.map(subject=>({value:subjectKey(level,subject),label:`${label} · ${subject}`})));

async function init(){
  try{
    STATE.db=await openDb();
    STATE.envelope=await readEnvelope(STATE.db);
    STATE.recovery=await readRecoveryEnvelope(STATE.db);
    STATE.exportReceipt=await readExportReceipt(STATE.db);
    // Solo se coteja la huella del sobre cifrado. La validación del modelo ocurre al desbloquear.
    let probe=null;
    try{
      const raw=sessionStorage.getItem(RELOAD_PROBE_KEY);
      if(raw){sessionStorage.removeItem(RELOAD_PROBE_KEY);probe=await evaluateReloadProbe(JSON.parse(raw),STATE.envelope);}
    }catch{probe={ok:false,reason:'unavailable'};}
    STATE.reloadProbe=probe;
    showUnlock(!STATE.envelope);
    if('serviceWorker' in navigator&&location.protocol!=='file:'){
      navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(watchPwaRegistration).catch(err=>console.warn('No se ha activado el modo instalable:',err));
    }
  }catch(e){root.innerHTML=`<div class="unlock-screen"><div class="unlock-box"><h1>Error de almacenamiento</h1><p>${esc(e.message)}</p><p>No introduzcas datos hasta solucionar el problema. Usa HTTPS o localhost y permite almacenamiento local.</p></div></div>`;}
}
function showUnlock(isNew){
  STATE.doc=null;STATE.key=null;STATE.salt=null;STATE.history=emptyHistory();
  root.innerHTML=`<main class="unlock-screen"><div class="unlock-box"><div class="brand-mini">▦</div><div class="eyebrow">AppNotas · versión 1.0</div><h1>CuadernoDocente</h1><p>${isNew?'Elige un cuaderno vacío o uno de demostración con ocho alumnos ficticios. Ambos se guardan cifrados en este dispositivo.':'Desbloquea tu cuaderno local cifrado para continuar.'}</p>${STATE.reloadProbe?`<p class="${STATE.reloadProbe.ok?'section-note':'unlock-error'}" role="status">${STATE.reloadProbe.ok?'Recarga verificada: la misma copia cifrada continúa en IndexedDB. Desbloquéala para validar las notas.':'No se ha podido verificar el guardado tras recargar. Revisa el almacenamiento y no introduzcas más datos hasta comprobar la copia.'}</p>`:''}${pwaButtons()}<button type="button" class="btn unlock-help-primary" id="how-it-works" aria-label="Cómo funciona AppNotas y cómo guardar copias de seguridad">¿Cómo funciona? <span aria-hidden="true">ⓘ</span></button><form id="unlock-form"><label for="password">${isNew?'Crea una contraseña de 12 caracteres como mínimo':'Contraseña del cuaderno'}</label><input id="password" class="text-field" type="password" required minlength="12" autocomplete="off" spellcheck="false"/>${isNew?'<label for="confirm-password">Repite la contraseña</label><input id="confirm-password" class="text-field" type="password" required minlength="12" autocomplete="off" spellcheck="false"/>':''}<div id="unlock-error" class="unlock-error" role="alert"></div>${isNew?'<div class="modal-actions"><button class="btn primary" type="submit" data-create-mode="empty">Crear cuaderno vacío</button><button class="btn" type="submit" data-create-mode="demo">Crear cuaderno de demostración</button></div>':'<button class="btn primary" type="submit">Desbloquear</button>'}</form><p class="hint">La contraseña no se envía ni se almacena. Si la pierdes, no podrás recuperar los datos cifrados.</p><p class="hint">Almacena los cuadernos cifrados únicamente en dispositivos autorizados. Guarda y verifica copias en ubicaciones locales no sincronizadas; nunca en servicios en la nube.</p><button class="btn" id="restore-locked">Restaurar una copia cifrada</button><input class="hidden" type="file" id="restore-locked-file" accept=".cuaderno,.cdoc,.json,application/json,application/octet-stream"/>${STATE.recovery?'<div class="recovery-choice"><p class="hint">Hay una copia cifrada de rescate anterior a la última restauración.</p><button class="btn" id="recover-locked">Recuperar versión anterior</button><button class="btn" id="download-recovery-locked">Descargar copia de rescate</button></div>':''}</div></main>`;
  $('#unlock-form').addEventListener('submit',e=>{
    e.preventDefault();
    const password=$('#password').value, confirmation=$('#confirm-password')?.value, button=e.submitter||$('#unlock-form button');
    const creationMode=e.submitter?.dataset.createMode==='demo'?'demo':'empty';
    button.disabled=true;$('#unlock-error').textContent='';
    enqueueMutation(async()=>{
    if(!button.isConnected)return;
    try{
      if(isNew){
        if(password!==confirmation)throw new Error('Las contraseñas no coinciden.');
        const doc=creationMode==='demo'?initialNotebook():emptyNotebook();ensureBookMetadata(doc);const {key,envelope}=await createVault(password,doc);
        await writeEnvelope(STATE.db,envelope,null);
        STATE.key=key;STATE.salt=saltFromEnvelope(envelope);STATE.envelope=envelope;STATE.doc=doc;
      }else{
        STATE.envelope=await readEnvelope(STATE.db);
        if(!STATE.envelope)throw new Error('No se encuentra el cuaderno local. Comprueba el perfil del navegador.');
        const unlocked=await unlockVault(password,STATE.envelope);
        const migrated=migrateNotebook(unlocked.doc);
        STATE.key=unlocked.key;STATE.salt=unlocked.salt;STATE.doc=migrated.doc;
        const tracked=ensureBookMetadata(migrated.doc);
        if(migrated.migrated||tracked){await persist(migrated.doc);toast('Cuaderno anterior validado y preparado para copias portátiles.');}
      }
      STATE.saveError=null;STATE.history=emptyHistory();chooseInitial();STATE.tab='cuaderno';STATE.studentId=null;render();
      if(STATE.reloadProbe?.ok)toast('Persistencia confirmada: el cuaderno cifrado se ha recuperado y validado tras recargar.');
      STATE.reloadProbe=null;
    }catch(err){STATE.doc=null;STATE.key=null;STATE.salt=null;$('#unlock-error').textContent=err.message;button.disabled=false;}
    }).catch(fail);
  });
  wirePwaButtons();
  $('#how-it-works').onclick=()=>showInfo('¿Cómo funciona AppNotas?',`
    <div class="onboarding-guide">
      <section><h3>1. Crear y desbloquear un cuaderno</h3>
        <p>AppNotas guarda grupos, materias, actividades, notas, rúbricas y agenda en un <strong>cuaderno cifrado en este navegador</strong>. La primera vez crea una contraseña de 12 caracteres como mínimo. Apúntala en un lugar seguro: no se envía a servidores y no es recuperable.</p></section>
      <section><h3>2. Introducir notas</h3>
        <p>Selecciona la materia mediante sus botones, crea grupos y añade alumnos y actividades. Puedes configurar categorías, porcentajes, escalas de 0–10 u otras, rúbricas y las reglas de evaluación. Una casilla vacía no es un cero; <strong>NP</strong> indica no presentado y computa como cero; <strong>AJ</strong> es ausencia justificada pendiente y no computa.</p></section>
      <section><h3>3. Consultar el resultado</h3>
        <p>En <strong>Modo sesión de evaluación</strong> puedes consultar individualmente las calificaciones del alumno seleccionado, por trimestre y categoría, sin mostrar simultáneamente las fichas de los demás. La evaluación final calcula las medias según la configuración del grupo. Desde el cuaderno, los botones <strong>∑ Cálculos</strong> y <strong>◎ Competencias</strong> abren sus respectivos apartados. Las competencias se muestran con niveles: 1 (adquisición alta, 8–10), 2 (media, de 6,5 a menos de 8), 3 (baja, de 5 a menos de 6,5) y 4 (no adquirida, nota inferior a 5). La media original se conserva.</p></section>
      <section><h3>4. Utilizar la agenda</h3>
        <p>El horario base trae siete horas de clase y dos patios. Toca una franja para asignar una materia del cuaderno o escribir otra, indica el aula y personaliza los intervalos. La agenda permite añadir exámenes, clases, tareas y festivos.</p></section>
      <section class="onboarding-critical"><h3>5. Guardar y comprobar una copia de seguridad</h3>
        <p>El guardado automático protege los cambios <strong>solo en este dispositivo y navegador</strong>. No hay sincronización entre móviles y ordenadores. El navegador podría borrar los datos, por lo que debes hacer copias externas:</p>
        <ol><li>Abre <strong>Ajustes → Copias de seguridad cifradas</strong> o utiliza <strong>Cerrar cuaderno</strong> para exportar un archivo <code>.cuaderno</code>.</li>
        <li>Guárdalo <strong>solo en un destino local</strong> —por ejemplo, «En mi iPad», «En mi iPhone», la carpeta local del ordenador o una memoria USB— y conserva <strong>dos copias locales en lugares distintos</strong>. Evita iCloud Drive, OneDrive y carpetas sincronizadas.</li>
        <li>Vuelve a seleccionarlo en <strong>Verificar copia</strong> e introduce la contraseña: descargar no basta para asegurar que es recuperable.</li>
        <li>Si cambias de dispositivo o de navegador, utiliza <strong>Restaurar copia</strong> desde el archivo verificado. La restauración sustituye el cuaderno local después de las advertencias pertinentes.</li></ol>
        <p><strong>Frecuencia recomendada:</strong> al menos semanalmente, después de introducir muchas notas y al cerrar una evaluación. La aplicación no puede detectar si la carpeta elegida se sincroniza con la nube: compruébalo en los ajustes del sistema.</p></section>
      <section><h3>6. Instalación y uso sin conexión</h3>
        <p>Instala la PWA desde la web oficial de Cloudflare. El modo sin conexión requiere que los recursos se hayan almacenado antes; compruébalo en Ajustes. Instalar la aplicación no es una copia de seguridad ni sincroniza los datos.</p></section>
      <section><h3>7. Privacidad y precauciones</h3>
        <p>Las notas no se envían al servidor de Cloudflare: quedan cifradas localmente. <strong>No uses información real de alumnado</strong> hasta que la aplicación tenga la autorización institucional y la evaluación de protección de datos que corresponda. Nunca compartas tu contraseña ni exportes archivos sin cifrar que incluyan datos personales.</p></section>
    </div>`);
  $('#restore-locked').onclick=()=>$('#restore-locked-file').click();
  $('#restore-locked-file').onchange=async e=>{try{const f=e.target.files[0];e.target.value='';if(f)await restoreBackup(f);}catch(err){fail(err);}e.target.value='';};
  $('#recover-locked')?.addEventListener('click',()=>recoverPreviousVersion().catch(fail));
  $('#download-recovery-locked')?.addEventListener('click',()=>downloadRecovery().catch(fail));
}
/** Introducción enmascarada: nunca solicitar contraseñas mediante window.prompt. */
function requestBackupPassword(title){
  return new Promise(resolve=>{
    if(dialog.open){resolve(null);return;}
    dialog.innerHTML=`<form class="modal-inner" id="backup-password-form"><h2 id="modal-heading">${esc(title)}</h2><label for="backup-password">Contraseña de la copia cifrada</label><input id="backup-password" class="text-field" type="password" minlength="12" autocomplete="off" spellcheck="false" required/><div class="modal-actions"><button type="button" class="btn" id="cancel-backup-password">Cancelar</button><button class="btn primary" type="submit">Continuar</button></div></form>`;
    const cancelled=()=>{if(dialog.open)return;dialog.removeEventListener('close',cancelled);resolve(null);};
    dialog.addEventListener('close',cancelled);
    $('#cancel-backup-password',dialog).onclick=()=>dialog.close();
    $('#backup-password-form',dialog).onsubmit=e=>{
      e.preventDefault();const secret=$('#backup-password',dialog).value;
      dialog.removeEventListener('close',cancelled);dialog.close();resolve(secret);
    };
    dialog.showModal();$('#backup-password',dialog).focus();
  });
}
async function openBackupFile(file,password){
  return readBackupFile(file,password);
}
async function verifyBackup(file){
  const password=await requestBackupPassword('Verificar copia sin restaurarla');
  if(password===null){toast('Verificación cancelada. Los datos no han cambiado.');return;}
  const opened=await openBackupFile(file,password);
  const info=backupSummary(opened.doc,opened.exportedAt);
  // Solo se registra un acuse si el archivo portátil corresponde a la
  // revisión actual y la escritura transaccional no detecta otra pestaña.
  let result='Archivo válido y autenticado. No se han modificado las calificaciones.';
  await STATE.mutationQueue;await STATE.saveQueue;
  if(opened.legacy){
    result+=' Es una copia histórica .cdoc: no acredita que exista un archivo portátil actual. Guarda y verifica un .cuaderno.';
  }else if(!STATE.doc){
    result+=' No se puede comparar con el cuaderno bloqueado; desbloquéalo para comprobar la revisión.';
  }else if(compareBookVersions(STATE.doc,opened.doc)!=='same'){
    result+=' El archivo no contiene la revisión actual del cuaderno. No se marcará como copia vigente.';
  }else if(STATE.saveError||STATE.failedEnvelope){
    result+=' Hay un error de guardado local. No se ha registrado como copia vigente.';
  }else{
    try{
      const receipt={version:1,bookId:opened.doc.id,head:opened.doc._portability.head,
        exportedAt:opened.exportedAt,verifiedAt:new Date().toISOString()};
      await recordExportReceipt(STATE.db,receipt,STATE.envelope);
      STATE.exportReceipt=receipt;
      updatePortableStatus();
      result+=' Esta misma revisión se ha recuperado del archivo seleccionado; verificación registrada en el dispositivo. Conservar el archivo en una ubicación externa sigue siendo responsabilidad del usuario.';
    }catch(error){
      result+=' No se pudo registrar su verificación (posible cambio desde otra pestaña): '+error.message+'.';
    }
  }
  showInfo('Copia íntegra y autenticada',`<p>Archivo válido · ${esc(info.modelVersion)} (versión de datos) · ${info.courses.length} grupos · ${info.students} alumnos · ${info.grades} notas.</p><p class="hint">${esc(result)}</p>`);
}
const conflictMessage={
  empty:'No hay cuaderno local que sustituir. Esta importación creará una copia local cifrada.',
  same:'Copia idéntica: el archivo y el cuaderno local contienen los mismos datos y la misma revisión. No es necesario importarla otra vez.',
  newer:'Copia válida y posterior: esta revisión continúa el historial del mismo cuaderno. Puedes importarla sin confirmaciones adicionales.',
  older:'⚠ Copia anterior: si la importas, perderás los cambios posteriores que se hayan realizado en este dispositivo.',
  divergent:'⚠ Cambios divergentes: ambos dispositivos tienen modificaciones distintas desde un antepasado común. Importar sustituirá la versión local; no se fusionarán las notas.',
  different:'⚠ Cuaderno diferente: el archivo pertenece a otro cuaderno. Importarlo sustituirá todos los datos locales.',
  unknown:'⚠ Historial desconocido: no es posible comprobar con seguridad la relación entre esta copia y la versión local. La importación podría sustituir datos más recientes.'
};
function decideImport(info,conflict,hasLocal){
  return new Promise(resolve=>{
    if(dialog.open){resolve('cancel');return;}
    const courses=info.courses.map(c=>`<li>${esc(c.subject)} · ${esc(c.name)} (${esc(c.course)})</li>`).join('');
    const riskLevel=importRiskLevel(conflict,hasLocal);
    const conflictClass=riskLevel>0?'import-warning':'section-note';
    const riskPrompt=riskLevel===1?
      `<label class="import-risk-check"><input type="checkbox" id="import-risk-accept"/> <span>Entiendo que voy a sustituir la versión local y que podría perder cambios posteriores</span></label>`:
      riskLevel===2?
      `<label class="import-risk-phrase" for="import-risk-phrase">Para sustituir un cuaderno distinto o de historial desconocido, escribe exactamente <strong>${IMPORT_CONFIRMATION_TEXT}</strong>.<input class="text-field" id="import-risk-phrase" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="${IMPORT_CONFIRMATION_TEXT}" aria-label="Confirmación de sustitución de cuaderno"/></label>`:'';
    const identical=conflict==='same';
    dialog.innerHTML=`<div class="modal-inner portable-dialog"><h2 id="modal-heading">Abrir cuaderno · comprobar antes de importar</h2><p>Archivo descifrado, autenticado y validado. <strong>Aún no se ha modificado ningún dato local.</strong></p><div class="portable-facts"><div>Creado: <strong>${esc(new Date(info.createdAt).toLocaleString('es-ES'))}</strong></div><div>Exportado: <strong>${info.exportedAt?esc(new Date(info.exportedAt).toLocaleString('es-ES')):'No consta (copia histórica)'}</strong></div><div>Esquema de datos: <strong>v${esc(info.modelVersion)}</strong></div><div>Cursos/grupos: <strong>${info.courses.length}</strong> · Alumnos: <strong>${info.students}</strong> · Notas: <strong>${info.grades}</strong> · Rúbricas: <strong>${info.rubrics}</strong></div></div><details><summary>Mostrar los cursos incluidos</summary><ul>${courses}</ul></details><p class="${conflictClass}" role="status">${conflictMessage[conflict]||conflictMessage.unknown}</p><p class="hint">${identical?'Se conservará el cuaderno local; no se creará un rescate innecesario.':hasLocal?'Antes de sustituir se conservará un rescate cifrado de la versión local en IndexedDB. Solo existe un punto de rescate: otra importación lo sustituye.':'Se creará una copia local cifrada de este archivo.'} No se combinarán notas.</p>${riskPrompt}<div class="modal-actions portable-choices"><button class="btn ${identical?'primary':''}" id="import-keep">${identical?'Conservar cuaderno (ya actualizado)':'Conservar datos actuales'}</button><button class="btn" id="import-cancel">Cancelar</button>${identical?'':`<button class="btn ${riskLevel?'warn':'primary'}" id="import-confirm" ${riskLevel?'disabled':''}>Importar copia</button>`}</div></div>`;
    let chosen=false;
    const settle=choice=>{if(chosen)return;chosen=true;dialog.removeEventListener('close',onClose);dialog.close();resolve(choice);};
    const onClose=()=>{if(dialog.open||chosen)return;chosen=true;dialog.removeEventListener('close',onClose);resolve('cancel');};
    dialog.addEventListener('close',onClose);
    $('#import-keep',dialog).onclick=()=>settle('keep');
    $('#import-cancel',dialog).onclick=()=>settle('cancel');
    const importButton=$('#import-confirm',dialog);
    if(importButton){
      const approval=()=>({accepted:$('#import-risk-accept',dialog)?.checked===true,phrase:$('#import-risk-phrase',dialog)?.value||''});
      const refresh=()=>{importButton.disabled=!canConfirmImport(conflict,hasLocal,approval());};
      $('#import-risk-accept',dialog)?.addEventListener('change',refresh);
      $('#import-risk-phrase',dialog)?.addEventListener('input',refresh);
      importButton.onclick=()=>{
        const currentApproval=approval();
        // El atributo disabled es solo presentación; la autorización se vuelve
        // a comprobar en el manejador y justo antes de la transacción IndexedDB.
        if(!canConfirmImport(conflict,hasLocal,currentApproval))return;
        settle(currentApproval);
      };
      refresh();
    }
    dialog.showModal();
  });
}
async function restoreBackup(file){
  await STATE.mutationQueue;await STATE.saveQueue;
  if(STATE.saveError||STATE.failedEnvelope)throw new Error('Hay datos sin guardar. Debes resolver el error antes de importar.');
  const password=await requestBackupPassword('Abrir cuaderno · contraseña del archivo');
  if(password===null){toast('Apertura cancelada. Conservas todos los datos locales.');return;}
  const opened=await openBackupFile(file,password);
  const info=backupSummary(opened.doc,opened.exportedAt);
  const existing=await readEnvelope(STATE.db);
  if(!sameEnvelope(existing,STATE.envelope))throw new Error('Otra pestaña ha cambiado las notas. Importación cancelada sin cambios.');
  const originalLocalDoc=STATE.doc;
  const conflict=await compareBackupAgainstLocal(originalLocalDoc,existing,opened.doc,password);
  const choice=await decideImport(info,conflict,!!existing);
  if(!choice||typeof choice!=='object'){
    toast(choice==='keep'?'Se ha conservado el cuaderno local sin cambios.':'Importación cancelada: ningún dato ha cambiado.');
    return;
  }
  if(!canConfirmImport(conflict,!!existing,choice))throw new Error('No se ha autorizado la sustitución del cuaderno.');
  return enqueueMutation(async()=>{
    await STATE.saveQueue;
    if(STATE.saveError||STATE.failedEnvelope)throw new Error('Hay datos sin guardar. No se ha importado nada.');
    if(STATE.doc!==originalLocalDoc||!sameEnvelope(STATE.envelope,existing))
      throw new Error('El cuaderno cambió durante la confirmación. Importación cancelada sin sustituir datos.');
    // Última comprobación independiente del estado visual del botón.
    if(!canConfirmImport(conflict,!!existing,choice))
      throw new Error('La confirmación ya no es válida. No se ha importado nada.');
    const doc=structuredClone(opened.doc);
    ensureBookMetadata(doc);
    assertModel(doc);
    const replacement=await seal(doc,opened.key,opened.salt);
    // La transacción CAS conserva el rescate y sustituye el principal atómicamente.
    const recovery=await replaceEnvelopeWithRecovery(STATE.db,replacement,existing);
    adoptRestoredNotebook(replacement,recovery,{key:opened.key,salt:opened.salt},doc);
    toast(recovery?'Importación completada. Versión local anterior conservada como rescate cifrado.':'Importación completada. Copia íntegra y validada.');
  });
}
function adoptRestoredNotebook(envelope,recovery,opened,doc){
  STATE.envelope=envelope;STATE.recovery=recovery;
  STATE.doc=doc;STATE.key=opened.key;STATE.salt=opened.salt;STATE.saveError=null;
  STATE.history=emptyHistory();chooseInitial();STATE.tab='cuaderno';STATE.studentId=null;render();
}

/** Reiniciar exige leer un archivo portable EXACTO del cuaderno vigente. */
async function confirmResetNotebook(summary){
  if(dialog.open)throw new Error('Cierra el diálogo actual antes de reiniciar.');
  return new Promise(resolve=>{
    let settled=false;
    const closeResult=value=>{
      if(settled)return;
      settled=true;dialog.removeEventListener('close',onClose);
      dialog.close();resolve(value);
    };
    const onClose=()=>{if(settled)return;settled=true;dialog.removeEventListener('close',onClose);resolve(false);};
    dialog.innerHTML=`<form class="modal-inner portable-dialog" id="reset-notebook-form">
      <h2 id="modal-heading">Reiniciar cuaderno · última confirmación</h2>
      <p><strong>Se ha descifrado y comprobado un archivo .cuaderno que coincide exactamente con este cuaderno.</strong></p>
      <p>${summary.courses.length} grupos · ${summary.students} alumnos · ${summary.grades} notas · ${summary.rubrics} rúbricas.</p>
      <p class="section-note">Se reemplazarán todos los grupos, alumnos, actividades, notas, rúbricas y la agenda por un cuaderno vacío. Permanecerán tres evaluaciones y tres categorías básicas. El cuaderno anterior se conservará como un único punto de rescate <strong>cifrado en este dispositivo</strong>, que no sustituye al archivo externo.</p>
      <label for="reset-notebook-phrase">Escribe <strong>REINICIAR</strong> para confirmar</label>
      <input class="text-field" id="reset-notebook-phrase" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="9" required pattern="REINICIAR" placeholder="REINICIAR"/>
      <div class="modal-actions"><button type="button" class="btn" id="reset-notebook-cancel">Cancelar</button><button type="submit" class="btn warn" id="reset-notebook-confirm">Reiniciar y conservar rescate cifrado</button></div>
    </form>`;
    dialog.addEventListener('close',onClose);
    $('#reset-notebook-cancel',dialog).onclick=()=>closeResult(false);
    $('#reset-notebook-form',dialog).onsubmit=e=>{
      e.preventDefault();
      if($('#reset-notebook-phrase',dialog).value!=='REINICIAR')return;
      closeResult(true);
    };
    dialog.showModal();$('#reset-notebook-phrase',dialog).focus();
  });
}
async function resetNotebookFromVerifiedCopy(file){
  await STATE.mutationQueue;await STATE.saveQueue;
  if(!STATE.doc||!STATE.key||!STATE.salt||!STATE.envelope||STATE.saveError||STATE.failedEnvelope)
    throw new Error('No se puede reiniciar mientras haya cambios sin guardar o el cuaderno esté bloqueado.');
  const previousDoc=STATE.doc,previousEnvelope=STATE.envelope;
  if(!sameEnvelope(await readEnvelope(STATE.db),previousEnvelope))
    throw new Error('Otra pestaña cambió el cuaderno. Reinicio cancelado, sin modificar notas.');
  const password=await requestBackupPassword('Comprobar copia externa antes de reiniciar');
  if(password===null){toast('Reinicio cancelado. No se ha modificado el cuaderno.');return;}
  const opened=await readBackupFile(file,password);
  if(opened.legacy||compareBookVersions(previousDoc,opened.doc)!=='same'||
    JSON.stringify(previousDoc)!==JSON.stringify(opened.doc))
    throw new Error('La copia no coincide exactamente con el cuaderno actual. Guarda y selecciona un archivo .cuaderno reciente; no se ha borrado nada.');
  const agreed=await confirmResetNotebook(backupSummary(opened.doc,opened.exportedAt));
  if(!agreed){toast('Reinicio cancelado. No se ha modificado el cuaderno.');return;}
  return enqueueMutation(async()=>{
    await STATE.saveQueue;
    if(STATE.saveError||STATE.failedEnvelope||!STATE.key||STATE.doc!==previousDoc||
      !sameEnvelope(STATE.envelope,previousEnvelope)||
      !sameEnvelope(await readEnvelope(STATE.db),previousEnvelope))
      throw new Error('El cuaderno cambió durante la confirmación. Reinicio cancelado sin sobrescribir datos.');
    const blank=emptyNotebook();ensureBookMetadata(blank);assertModel(blank);
    const replacement=await seal(blank,STATE.key,STATE.salt);
    // La versión anterior permanece cifrada. CAS y rescate se escriben en
    // la misma transacción: un fallo deja el cuaderno anterior intacto.
    const recovery=await replaceEnvelopeWithRecovery(STATE.db,replacement,previousEnvelope);
    STATE.exportReceipt=null;
    adoptRestoredNotebook(replacement,recovery,{key:STATE.key,salt:STATE.salt},blank);
    toast('Cuaderno vacío creado. Rescate cifrado disponible en Ajustes y copias.');
  });
}

function downloadEncryptedEnvelope(envelope,filename){
  if(!envelope)throw new Error('No hay ninguna copia cifrada que descargar.');
  const blob=new Blob([JSON.stringify(envelope,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
async function downloadRecovery(){
  const recovery=await readRecoveryEnvelope(STATE.db);
  if(!recovery?.envelope)throw new Error('No hay una copia de rescate disponible.');
  validateEnvelope(recovery.envelope);
  downloadEncryptedEnvelope(recovery.envelope,'CuadernoDocente-rescate-'+new Date().toISOString().slice(0,10)+'.cdoc');
  toast('Copia de rescate cifrada preparada para descargar.');
}
async function recoverPreviousVersion(){
  const recovery=await readRecoveryEnvelope(STATE.db);
  if(!recovery?.envelope)throw new Error('No existe una versión anterior recuperable.');
  const password=await requestBackupPassword('Recuperar el cuaderno previo a la restauración');
  if(password===null)return;
  const opened=await unlockVault(password,recovery.envelope);
  const upgraded=migrateNotebook(opened.doc);assertModel(upgraded.doc);
  const tracked=ensureBookMetadata(upgraded.doc);
  if(!window.confirm('¿Volver a la copia anterior a la última restauración? Se perderán los cambios posteriores en la versión actual. Esta última se conservará como copia de rescate cifrada.'))return;
  return enqueueMutation(async()=>{
    if(STATE.failedEnvelope)throw new Error('Descarga el intento de guardado cifrado y recarga antes de recuperar.');
    const replacement=upgraded.migrated||tracked?await seal(upgraded.doc,opened.key,opened.salt):recovery.envelope;
    const previous=await swapRecoveryEnvelope(STATE.db,STATE.envelope,recovery,replacement);
    adoptRestoredNotebook(replacement,previous,opened,upgraded.doc);
    toast('Cuaderno anterior recuperado y validado. La otra versión sigue cifrada como rescate.');
  });
}

/** Preparar después del guardado; el gesto posterior sobre «Guardar archivo» abre
 * el selector de sistema antes de cualquier await, necesario en Safari/iOS.
 */
async function closeNotebook(){
  await STATE.mutationQueue;await STATE.saveQueue;
  if(!STATE.doc||!STATE.key||STATE.saveError||STATE.failedEnvelope)throw new Error('No se puede cerrar: hay cambios sin guardar. Conserva el cuaderno local y resuelve el error.');
  if(!sameEnvelope(await readEnvelope(STATE.db),STATE.envelope))throw new Error('El cuaderno cambió desde otra pestaña. No exportes una versión desactualizada.');
  const snapshot=structuredClone(STATE.doc);
  const exportedDate=new Date();
  const prepared=await createPortableCopy(snapshot,STATE.key,STATE.salt,exportedDate);
  const filename=portableFilename(exportedDate);
  if(dialog.open)throw new Error('Cierra el diálogo actual para exportar.');
  dialog.innerHTML=`<div class="modal-inner portable-dialog"><h2 id="modal-heading">Cerrar cuaderno · copia cifrada</h2><p>Los cambios se han guardado en este dispositivo. La copia completa está cifrada con la contraseña de este cuaderno.</p><p><strong>${esc(filename)}</strong></p><p class="hint"><strong>Solo almacenamiento local autorizado por el centro:</strong> elige «En mi iPad» / «En mi iPhone», una carpeta local del ordenador o un USB sin sincronización. No elijas iCloud Drive, OneDrive ni carpetas sincronizadas. Esta aplicación no accede a ninguna nube ni confirma la sincronización posterior.</p><p id="close-result" class="hint" role="status">El cuaderno local permanece intacto aunque canceles.</p><div class="modal-actions portable-choices"><button class="btn" id="close-cancel">Cancelar</button><button class="btn primary" id="close-save">Guardar archivo cifrado</button><button class="btn hidden" id="close-lock">Bloquear cuaderno</button></div></div>`;
  $('#close-cancel',dialog).onclick=()=>{dialog.close();toast('Exportación cancelada. El cuaderno local permanece guardado.');};
  $('#close-save',dialog).onclick=()=>savePreparedCopy(prepared,filename);
  dialog.showModal();
}
function preparedSaveCompleted(){
  const back=$('#close-cancel',dialog),lock=$('#close-lock',dialog);
  if(back){back.textContent='Volver al cuaderno';back.onclick=()=>dialog.close();}
  if(lock){lock.classList.remove('hidden');lock.onclick=()=>{dialog.close();showUnlock(false);toast('Cuaderno bloqueado. La copia local cifrada permanece en el dispositivo.');};}
}
async function savePreparedCopy(prepared,filename){
  const button=$('#close-save',dialog),message=$('#close-result',dialog);
  if(button.disabled)return;
  const blob=new Blob([JSON.stringify(prepared.file)],{type:'application/octet-stream'});
  const downloadable=new File([blob],filename,{type:'application/octet-stream'});
  // showSaveFilePicker debe ejecutarse directamente en el evento click del usuario.
  let picker=null,mode='download';
  try{
    if(typeof window.showSaveFilePicker==='function'){
      mode='picker';picker=await window.showSaveFilePicker({suggestedName:filename,
        types:[{description:'Cuaderno cifrado de Tabularium',accept:{'application/octet-stream':['.cuaderno']}}]});
    }else if(typeof navigator.share==='function'&&typeof navigator.canShare==='function'&&navigator.canShare({files:[downloadable]})){
      mode='share';
      await navigator.share({files:[downloadable],title:'Copia cifrada Tabularium'});
      message.textContent='Archivo enviado al destino seleccionado. Comprueba que sea una ubicación exclusivamente local, no sincronizada con una nube, y verifica el archivo guardado. El cuaderno local sigue intacto.';
      preparedSaveCompleted();toast('Copia compartida. Comprueba manualmente que se ha guardado.');return;
    }
    button.disabled=true;
    if(mode==='picker'){
      const writer=await picker.createWritable();
      await writer.write(blob);await writer.close();
      // Si el guardado falló, el control anterior nunca llega aquí.
      const receipt={version:1,bookId:prepared.bookId,head:prepared.head,exportedAt:prepared.exportedAt};
      try{
        await recordExportReceipt(STATE.db,receipt,STATE.envelope);
        STATE.exportReceipt=receipt;
        message.textContent='Archivo escrito en la ubicación elegida. Comprueba que sea exclusivamente local y que el archivo se puede abrir desde «Verificar copia».';
      }catch(e){message.textContent='Archivo escrito, pero no se pudo registrar la exportación local: '+e.message;}
      updatePortableStatus();preparedSaveCompleted();toast('Copia cifrada escrita. Verifica su presencia en la carpeta elegida.');
    }else{
      downloadEncryptedEnvelope(prepared.file,filename);
      message.textContent='Descarga iniciada. Este navegador no confirma dónde se guarda: comprueba el archivo en Descargas o Archivos antes de darlo por cerrado.';
      preparedSaveCompleted();toast('Descarga iniciada; guardado externo sin verificar.');
    }
  }catch(error){
    if(error?.name==='AbortError'){
      message.textContent='Operación cancelada. No se ha modificado ni borrado el cuaderno local.';
      toast('Exportación cancelada. Todos los datos siguen en este dispositivo.');
    }else{
      message.textContent='No se ha podido exportar: '+String(error?.message||error)+'. Los datos locales siguen intactos.';
      fail(error);
    }
  }finally{button.disabled=false;}
}


/** Presentación únicamente: no altera el modelo, las notas ni la navegación interna. */
const workspaceDisclosures={tools:false,course:false,group:false,academic:false};
const PRIMARY_WORKSPACE_TABS=[
  ['cuaderno','Cuaderno','▦'],
  ['alumno','Modo sesión de evaluación','◉'],
  ['planificador','Agenda','▣'],
  ['final','Evaluación final','★']
];
const ACADEMIC_WORKSPACE_TABS=[
  ['curriculo','Currículo','◇'],
  ['rubricas','Rúbricas','▤']
];
function workspaceTab([key,label,glyph]){
  const active=STATE.tab===key;
  return `<button type="button" data-tab="${key}" class="tab ${active?'active':''}" ${active?'aria-current="page"':''} title="${label}"><span class="nav-glyph" aria-hidden="true">${glyph}</span><span class="nav-text">${label}</span></button>`;
}
function renderNavigation(){
  const academicSelected=ACADEMIC_WORKSPACE_TABS.some(([id])=>id===STATE.tab);
  return `<nav class="tabs" aria-label="Secciones del cuaderno">
    <button type="button" class="nav-collapse" id="toggle-navigation" aria-label="Plegar o desplegar navegación" aria-expanded="${!STATE.navCollapsed}" title="Plegar o desplegar menú"><span class="nav-collapse-glyph" aria-hidden="true">☷</span><span class="nav-text">Menú</span></button>
    <div class="nav-primary" role="group" aria-label="Trabajo diario">${PRIMARY_WORKSPACE_TABS.map(workspaceTab).join('')}</div>
    <div class="nav-secondary">
      <details class="academic-disclosure" data-shell-disclosure="academic" ${academicSelected||workspaceDisclosures.academic?'open':''}>
        <summary title="Abrir gestión académica"><span class="nav-glyph" aria-hidden="true">⊞</span><span class="nav-text">Gestión académica</span><span class="disclosure-chevron" aria-hidden="true">⌄</span></summary>
        <div class="nav-academic-links" role="group" aria-label="Herramientas académicas">${ACADEMIC_WORKSPACE_TABS.map(workspaceTab).join('')}</div>
      </details>
      ${workspaceTab(['ajustes','Ajustes y copias','⚙'])}
    </div>
    <div class="nav-footer" aria-hidden="true">✦ Μνήμη · Studium</div>
  </nav>`;
}

/** Accesos a la evaluación desde las vistas analíticas.
 * Impiden tener que regresar al cuaderno para cambiar entre Cálculos
 * y Competencias cuando ambos salen del menú lateral. */
function renderAcademicQuickNav(){
  return `<nav class="academic-quick-nav" aria-label="Navegación entre cálculos y competencias">
    <button type="button" class="btn small" data-academic-quick="cuaderno">‹ Cuaderno</button>
    <button type="button" class="btn small ${STATE.tab==='calculos'?'academic-quick-active':''}" data-academic-quick="calculos" ${STATE.tab==='calculos'?'aria-current="page"':''}>∑ Cálculos</button>
    <button type="button" class="btn small ${STATE.tab==='competencias'?'academic-quick-active':''}" data-academic-quick="competencias" ${STATE.tab==='competencias'?'aria-current="page"':''}>◎ Competencias</button>
  </nav>`;
}
function renderPeriodButtons(){
  const periods=[...STATE.doc.periods].sort((a,b)=>a.order-b.order);
  return `<nav class="term-bar" aria-label="Evaluación actual"><div class="term-buttons" role="group" aria-label="Períodos">${periods.map(p=>`<span class="term-item ${STATE.tab==='cuaderno'&&STATE.periodId===p.id?'active':''}"><button type="button" class="term-button ${STATE.tab==='cuaderno'&&STATE.periodId===p.id?'active':''}" data-period-choice="${esc(p.id)}" aria-pressed="${STATE.tab==='cuaderno'&&STATE.periodId===p.id}" title="Seleccionar ${esc(p.name)} (doble clic para renombrar)">${esc(p.name)}</button><button type="button" class="term-edit" data-rename-period="${esc(p.id)}" aria-label="Renombrar ${esc(p.name)}" title="Renombrar ${esc(p.name)}">✎</button></span>`).join('')}<button type="button" class="term-add" id="new-period" aria-label="Añadir período" title="Crear período">+ <span>Período</span></button></div><button type="button" class="term-button term-final ${STATE.tab==='final'?'active':''}" data-final-choice="1" aria-pressed="${STATE.tab==='final'}">★ Evaluación final</button></nav>`;
}
function render(){
  if(!STATE.doc)return;
  ensurePlanner(STATE.doc);
  if(!STATE.level){chooseInitial();}
  if(!currentPeriod())STATE.periodId=[...STATE.doc.periods].sort((a,b)=>a.order-b.order)[0]?.id||null;
  const period=currentPeriod();
  const matching=groupsForSubject();
  if(!matching.some(g=>g.id===STATE.groupId))STATE.groupId=matching[0]?.id||null;
  const group=currentGroup();
  applyTheme();
  // Cada boton corresponde a una materia concreta, no solo a una etapa:
  // elegir entre Latin y Griego nunca depende de un segundo desplegable.
  const courseChoices=[...catalogForNotebook(STATE.doc).flatMap(({level,label,subjects})=>subjects.map(subject=>({
    level,subject,subjectName:subject,stage:label
  }))), ...[...new Set(STATE.doc.groups.filter(g=>g.level===null).map(g=>g.subject))].map(subject=>({
    level:'legacy',subject,subjectName:subject||'Sin asignatura',stage:'Sin clasificar'
  }))];
  const subjectLabel=STATE.subject||'Sin asignatura';
  const levelLabel=COURSE_SUBJECTS[STATE.level]?.label||'Sin clasificar';
  const hasGroup=!!STATE.groupId;
  const color=STATE.level==='legacy'?'#F59E0B':colorFor(STATE.level,STATE.subject);
  unbindClassStats();
  root.innerHTML=`<div class="shell ${STATE.tab==='alumno'&&STATE.studentId?'student-focus':''} ${STATE.navCollapsed?'nav-collapsed':''}"><header class="topbar"><div class="brand"><div class="brand-mark" aria-hidden="true"><svg viewBox="0 0 48 48" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12h30M12 16h24M15 19v17m9-17v17m9-17v17M9 39h30M12 36h24M12 12c1-5 6-8 12-8s11 3 12 8"/><path d="M19 12h10"/></svg></div><div class="brand-copy"><strong>AppNotas</strong><small>CuadernoDocente · Agenda y evaluación</small></div></div><div class="topmeta"><span class="pill security-pill" title="Cuaderno guardado cifrado en el dispositivo">🔒 Cifrado local</span><span id="save-status" role="status" class="pill status ok">Guardado cifrado</span>
  <button type="button" class="btn topbar-close-btn" id="close-notebook" title="Guardar una copia cifrada y cerrar el cuaderno">Cerrar cuaderno</button><details class="header-tools" data-shell-disclosure="tools" ${workspaceDisclosures.tools?'open':''}><summary aria-label="Abrir herramientas de la aplicación">Herramientas <span class="disclosure-chevron" aria-hidden="true">⌄</span></summary>
    <div class="header-tools-panel">
      <div class="header-tools-heading">Apariencia</div><label class="theme-picker">Tema <select id="theme-select" aria-label="Modo de apariencia">${[['light','Claro'],['dark','Oscuro'],['oled','OLED']].map(([k,v])=>opt(k,v,STATE.theme)).join('')}</select></label>
      <div class="header-tools-heading">Cuaderno y copias</div><div class="portable-controls" role="group" aria-label="Copias de cuaderno"><button type="button" class="btn small" id="open-notebook">Abrir cuaderno</button></div>
      <div class="header-tools-heading">Aplicación</div>${pwaButtons()}
      <div class="header-tools-heading">Historial de cambios</div><div class="history-actions" role="group" aria-label="Historial de cambios"><button type="button" class="btn small" id="undo-change" title="Deshacer último cambio (Ctrl/Cmd+Z)" ${STATE.history.past.length?'':'disabled'}>↶ Deshacer</button><button type="button" class="btn small" id="redo-change" title="Rehacer (Ctrl/Cmd+Mayús+Z)" ${STATE.history.future.length?'':'disabled'}>↷ Rehacer</button></div>
    </div>
  </details>
  <button class="lock-btn" id="lock">Bloquear</button>
</div></header><main class="content"><div class="headrow"><div><div class="eyebrow">${esc(CLASSICAL_SKIN_TITLES[classicalSkinFor(STATE.level,STATE.subject)])} · CUADERNO ACADÉMICO · v1.0</div><h1>${esc(subjectLabel)} <span class="muted-slash">/</span> ${esc(group?.name||'Sin grupo')}</h1><p class="subtitle">${esc(levelLabel)} · ${esc(group?.course||'Curso escolar por configurar')} · ${esc(period?.name||'')} · Almacenamiento cifrado local</p></div><span class="demo-tag">⚠ Copias solo en almacenamiento local</span></div><p id="portable-status" class="portable-status" role="status" aria-live="polite"></p><input type="file" id="open-notebook-file" class="hidden" accept=".cuaderno,.cdoc,application/octet-stream,application/json"/><div class="toolbar class-toolbar" aria-label="Asignatura y grupo">
  <div class="selectors">
    <div class="course-switch" role="group" aria-label="Seleccionar asignatura">
      <div class="course-buttons">${courseChoices.map(x=>`<button type="button" class="btn course-choice" data-course-level="${esc(x.level)}" data-course-subject="${esc(x.subject)}" aria-pressed="${STATE.level===x.level&&STATE.subject===x.subject}" title="${esc(x.stage)}"><strong class="course-name">${esc(x.subjectName)}</strong></button>`).join('')}</div>
    </div>
    ${matching.length>1?`<div class="group-switch" role="group" aria-label="Seleccionar grupo de ${esc(subjectLabel)}"><span class="group-switch-label">Grupos</span><div class="group-buttons">${matching.map(x=>`<button type="button" class="btn group-choice" data-group-choice="${esc(x.id)}" aria-pressed="${x.id===STATE.groupId}">${esc(x.name)}</button>`).join('')}</div></div>`:''}
  </div>
  <div class="actions class-more-actions">
    <details class="group-actions-disclosure" data-shell-disclosure="group" ${workspaceDisclosures.group?'open':''}>
      <summary>Materias y grupos <span class="disclosure-chevron" aria-hidden="true">⌄</span></summary>
      <div class="group-actions-panel">
        <button class="btn small" id="new-group" ${STATE.level==='legacy'?'disabled':''}>+ Crear grupo</button>
        <button class="btn small" id="manage-subjects">Gestionar materias</button>
        <button class="btn small" id="edit-group" ${hasGroup?'':'disabled'} title="Editar nombre y curso escolar del grupo">⋯ Gestionar grupo</button>
        ${STATE.level==='legacy'?'':`<label class="color-select-label">Color de acento<input id="accent-select" type="color" value="${esc(color)}" aria-label="Color de acento para ${esc(subjectLabel)}"/></label>`}
        ${group?.level===null?'<button class="btn" id="classify-group">Clasificar grupo</button>':''}
        <button class="btn" id="csv-import" title="CSV: apellidos;nombre;grupo (o nombre, formato anterior)" ${hasGroup?'':'disabled'}>↑ Importar CSV</button>
        <button class="btn" id="new-recovery" ${hasGroup?'':'disabled'}>↺ Recuperación</button>
      </div>
    </details>
    <input type="file" id="csv-file" class="hidden" accept=".csv,text/csv"/>
  </div>
</div><div class="workspace">${renderNavigation()}<div class="work-area">${hasGroup&&['cuaderno','final'].includes(STATE.tab)?renderPeriodButtons():''}${hasGroup&&['calculos','competencias'].includes(STATE.tab)?renderAcademicQuickNav():''}<div id="tab-content">${!hasGroup&&STATE.tab!=='ajustes'&&STATE.tab!=='rubricas'&&STATE.tab!=='curriculo'&&STATE.tab!=='planificador'?`<section class="panel panel-pad no-group-state"><h2>No hay grupos de ${esc(subjectLabel)}</h2><p>Selecciona otro grupo o crea uno nuevo para esta asignatura. No se mezclarán las calificaciones de materias distintas.</p>${STATE.level==='legacy'?'<p>Clasifica primero el grupo anterior para utilizarlo en uno de los cursos disponibles.</p>':'<button class="btn primary" id="new-group-empty">+ Crear primer grupo</button>'}</section>`:STATE.tab==='cuaderno'?renderNotebook():STATE.tab==='planificador'?renderPlanner(STATE.doc,STATE):STATE.tab==='alumno'?renderStudentView():STATE.tab==='final'?renderFinalEvaluation():STATE.tab==='calculos'?renderRules():STATE.tab==='rubricas'?renderRubrics():STATE.tab==='competencias'?renderCompetencies():STATE.tab==='curriculo'?renderCurriculum():renderSettings()}</div></div></div></main></div>`;
  bindCommon();
  wirePwaButtons();
  updatePortableStatus();
  // Mantener la pestaña activa a la vista en pantallas pequeñas, sin desplazar verticalmente la página.
  const tabStrip=$('.tabs'),activeTab=$('.tabs .tab.active');
  if(tabStrip&&activeTab){
    const outer=tabStrip.getBoundingClientRect(),inner=activeTab.getBoundingClientRect();
    if(inner.left<outer.left)tabStrip.scrollLeft+=inner.left-outer.left-8;
    else if(inner.right>outer.right)tabStrip.scrollLeft+=inner.right-outer.right+8;
  }
  if(!hasGroup&&STATE.tab!=='ajustes'&&STATE.tab!=='rubricas'&&STATE.tab!=='curriculo'&&STATE.tab!=='planificador'){$('#new-group-empty')?.addEventListener('click',()=>$('#new-group').click());}
  else if(STATE.tab==='cuaderno')bindNotebook();
  else if(STATE.tab==='planificador'){const api=bindPlanner(STATE.doc,STATE,{render,commit,fieldsModal,dialog,toast,fail,getDoc:()=>STATE.doc});if(STATE.plannerEventRequest){const request=STATE.plannerEventRequest;STATE.plannerEventRequest=null;api.eventModal(request);}}
  else if(STATE.tab==='alumno')bindStudentView();
  else if(STATE.tab==='final')bindFinalEvaluation();
  else if(STATE.tab==='rubricas')bindRubrics();
  else if(STATE.tab==='calculos')bindRules();
  else if(STATE.tab==='competencias')bindCompetencies();
  else if(STATE.tab==='curriculo')bindCurriculum();
  else if(STATE.tab==='ajustes')bindSettings();
  paintGrades(root);
  paintCategoryColumns(root);
  paintStudentCategoryCards(root);
  bindClassStatistics();
  setStatus();
}

function renderNotebook(){
  const assessments=allAssessments(),students=allStudents();
  const visibleIds=new Set(assessments.map(a=>a.id));
  const gradeObservationsByPair=new Map((STATE.doc.gradeObservations??[]).map(note=>[note.studentId+'|'+note.assessmentId,note]));
  const observationButton=(studentId,assessmentId)=>{
    const note=gradeObservationsByPair.get(studentId+'|'+assessmentId);
    const student=STATE.doc.students.find(s=>s.id===studentId);
    const activity=STATE.doc.assessments.find(a=>a.id===assessmentId);
    const label=note?'Editar observación':'Añadir observación';
    return `<button type="button" class="grade-observation-button ${note?'has-observation':''}" data-observation-student="${esc(studentId)}" data-observation-assessment="${esc(assessmentId)}" aria-label="${label} de ${esc(student?.name||'alumno')} en ${esc(activity?.name||'actividad')}" title="${label}">${note?'● ':''}Obs.</button>`;
  };
  const gradesByStudent=new Map();
  for(const grade of STATE.doc.grades){
    if(!visibleIds.has(grade.assessmentId))continue;
    if(!gradesByStudent.has(grade.studentId))gradesByStudent.set(grade.studentId,new Map());
    gradesByStudent.get(grade.studentId).set(grade.assessmentId,grade);
  }
  const headers=assessments.map(a=>{
    const c=STATE.doc.categories.find(c=>c.id===a.categoryId);
    return `<th class="category-tinted" data-column-category="${esc(a.categoryId)}"><span class="column-heading">${esc(a.name)}${classStatButton('assessment',a.id,a.name)}<button type="button" class="assessment-menu" data-edit="${esc(a.id)}" aria-label="Configurar ${esc(a.name)}" title="Editar, ordenar o eliminar actividad">⋯</button></span><small>${a.recoveryOf?'Recuperación · ':''}${esc(c?.name||'')} · ${a.rubricId?'Rúbrica /10':'/'+esc(a.maxScore)+(a.convertToTen?' → /10':' · sin conversión')}${a.weight!==1?' · ×'+esc(a.weight):''}${a.orthography?.enabled?' · faltas recuperables':''}</small></th>`;
  }).join('');
  const categoryCell=a=>` class="category-tinted" data-column-category="${esc(a.categoryId)}"`;
  const rows=students.map((s,i)=>`${originGroupHeader(students,i,assessments.length+3)}<tr><td class="name-col"><div class="student-name-cell"><span class="student-name-label">${esc(s.name)}</span>${studentOriginBadge(s)}<button class="view-student" type="button" title="Mostrar solo las notas de este alumno" data-view-student="${esc(s.id)}">Ver</button><button class="view-student" type="button" title="Editar, ordenar o quitar alumno" data-edit-student="${esc(s.id)}">⋯</button></div></td>${assessments.map(a=>{
    const g=gradesByStudent.get(s.id)?.get(a.id);
    const npLabel=g?.notSubmitted?'Quitar «No presentado»':'Marcar «No presentado»';
    const ajButton=`<button type="button" class="aj-button ${g?.pendingJustified?'active':''}" data-aj-student="${esc(s.id)}" data-aj-assessment="${esc(a.id)}" aria-pressed="${!!g?.pendingJustified}" aria-label="${g?.pendingJustified?'Quitar':'Marcar'} ausencia justificada pendiente: ${esc(s.name)} · ${esc(a.name)}" title="${g?.pendingJustified?'Reactivar calificación anterior':'Pendiente por ausencia justificada (no computa)'}">AJ</button>`;
    const npButton=`<button type="button" class="np-button" data-np-student="${esc(s.id)}" data-np-assessment="${esc(a.id)}" aria-pressed="${!!g?.notSubmitted}" aria-label="${npLabel}: ${esc(s.name)} · ${esc(a.name)}" title="${npLabel}">NP</button>`;
    // Indicador independiente del control NP; el botón original de la
    // calificación sigue abriendo su editor, sin cambiar el valor registrado.
    const npGradeMarker='<span class="np-grade-marker" aria-label="No presentado">NP</span>';
    if(a.rubricId){const score=g?recordedScore(STATE.doc,a,g):null;
      return `<td${categoryCell(a)}><div class="grade-entry rubric-grade-entry"><button class="rubric-grade-button" type="button" data-rubric-grade="${esc(a.id)}" data-rubric-student="${esc(s.id)}" aria-label="Evaluar ${esc(s.name)} en ${esc(a.name)} con rúbrica">${g?.pendingJustified?'<span class="aj-badge">AJ · Pendiente</span>':g?.notSubmitted?npGradeMarker:g?gradeChip(score):'Evaluar'}<small>${g?.notSubmitted?'Pulsar para editar':'/10'}</small></button></div>${npButton}${ajButton}${observationButton(s.id,a.id)}</td>`;
    }
    if(a.orthography?.enabled){
      const value=g?effectiveAssessmentScore(STATE.doc,a,g):null;
      const faults=g?.orthographyFaults??0;
      const amount=g?orthographyPenalty(a,g):0;
      const note=g?`<small class="orthography-meta">Original: ${esc(rawFmt(g.score))}/${esc(rawFmt(a.maxScore))}${faults?` · ${g.orthographyDelivered?'✓ Entregadas':`−${esc(penaltyFmt(amount))} (${faults} faltas)`}`:''}</small>`:'<small class="orthography-meta">Nota, faltas y entrega</small>';
      return `<td${categoryCell(a)}><button class="orthography-grade-button" type="button" data-orthography-grade="${esc(a.id)}" data-orthography-student="${esc(s.id)}" aria-label="Corregir ${esc(s.name)} en ${esc(a.name)}: nota, faltas y entrega">${g?.pendingJustified?'<span class="aj-badge">AJ · Pendiente</span>':g?.notSubmitted?`${npGradeMarker}<small class="np-edit-hint">Pulsar para editar</small>`:g?gradeChip(value):'<strong>+ Nota</strong>'}${g?.notSubmitted||g?.pendingJustified?'':note}</button>${npButton}${ajButton}${observationButton(s.id,a.id)}</td>`;
    }
    const isTenScale=a.maxScore===10||a.convertToTen;
    const converted=g&&!g.notSubmitted&&!g.pendingJustified&&isTenScale?normalizedScore(g.score,a.maxScore,a.convertToTen):null;
    const showConverted=g&&!g.notSubmitted&&!g.pendingJustified&&a.convertToTen&&a.maxScore!==10;
    return `<td${categoryCell(a)}><div class="grade-entry ${showConverted?'converted-entry':''}">${showConverted?`<button type="button" class="converted-primary" data-focus-original="${esc(a.id)}:${esc(s.id)}" aria-label="Nota sobre diez: ${esc(gradeFmt(converted))}; editar nota original">${gradeChip(converted)}</button><small class="original-score">(<input class="note-input original-note-input" type="text" inputmode="decimal" spellcheck="false" maxlength="12" aria-label="Nota original de ${esc(s.name)} en ${esc(a.name)}, sobre ${esc(rawFmt(a.maxScore))}" data-student="${esc(s.id)}" data-assessment="${esc(a.id)}" value="${esc(rawFmt(g.score))}"/> /${esc(rawFmt(a.maxScore))})</small>`:`<input class="note-input ${g?.notSubmitted?'np-grade-input':converted!==null?'grade-colored':''}" ${converted!==null?gradeStyle(converted):''} type="text" inputmode="decimal" spellcheck="false" maxlength="12" aria-label="Nota de ${esc(s.name)} en ${esc(a.name)}" placeholder="${g?.pendingJustified?'AJ':g?.notSubmitted?'NP':'—'}" title="${g?.notSubmitted?'NP · No presentado. Escribe una nota para sustituirlo.':''}" data-student="${esc(s.id)}" data-assessment="${esc(a.id)}" value="${g&&!g.notSubmitted&&!g.pendingJustified?esc(rawFmt(g.score)):''}"/>`}</div>${npButton}${ajButton}${observationButton(s.id,a.id)}</td>`;
  }).join('')}<td class="final-col"><button type="button" class="score-button" title="Ver desglose" data-explain="${esc(s.id)}">${gradeChip(overallGrade(STATE.doc,s.id,STATE.groupId,STATE.periodId))}</button></td><td class="itaca-col"><button type="button" class="itaca-edit" data-itaca-student="${esc(s.id)}" title="Nota Ítaca: ${esc(s.name)}. Configurar redondeo individual de esta evaluación" aria-label="Configurar Nota Ítaca de ${esc(s.name)}">${itacaChip(STATE.doc,s.id,STATE.groupId,STATE.periodId)}${itacaStudentRule(STATE.doc,s.id,STATE.periodId)!=='general'?'<span class="itaca-exception" title="Excepción individual">*</span>':''}</button></td></tr>`).join('');
  const sum=effectiveCategories(STATE.doc,STATE.groupId,STATE.periodId).reduce((s,c)=>s+c.weight,0);
  const problems=students.flatMap(st=>periodCalculationWarnings(STATE.doc,st.id,STATE.groupId,STATE.periodId)).filter(v=>v.includes('sin conversión'));
  return `<section class="panel"><div class="panel-header"><div class="notebook-heading"><div class="notebook-heading-kicker">TABULAE · EVALUACIÓN</div><strong>Calificaciones</strong><p>Pulsa o toca ⓘ en la cabecera de cada columna para ver la media y los aprobados de la clase. Introduce notas con hasta dos decimales. NP cuenta como cero; AJ marca una ausencia justificada pendiente que no computa. En los exámenes con faltas recuperables, pulsa la calificación para editar nota original, faltas y entrega. «⋯» configura una columna.</p></div><div class="notebook-primary-actions"><button class="btn primary" id="new-student">+ Alumno</button><button class="btn primary" id="new-assessment">+ Actividad</button><button class="btn" id="notebook-calculations" type="button" data-academic-quick="calculos" title="Configurar porcentajes y reglas de evaluación">∑ Cálculos</button><button class="btn" id="notebook-competencies" type="button" data-academic-quick="competencias" title="Consultar niveles de adquisición competencial">◎ Competencias</button><details class="notebook-more-actions"><summary>Más acciones <span aria-hidden="true">⌄</span></summary><div class="notebook-more-panel"><button class="btn" id="copy-structure">⇉ Copiar actividades</button><button class="btn" id="schedule-exam">▣ Programar examen</button></div></details></div></div><div class="student-order-bar">${studentSortControls()}</div><div class="itaca-global"><label for="itaca-general-rule">Redondeo general de Nota Ítaca</label><select id="itaca-general-rule" aria-label="Redondeo general de Nota Ítaca para el grupo">${ITACA_OPTIONS.map(([key,label])=>opt(key,label,itacaGroupRule(STATE.doc,STATE.groupId))).join('')}</select><small>La media original no cambia. Puedes ajustar cada alumno pulsando su Nota Ítaca.</small></div><div class="table-scroller"><table class="grade-table"><thead><tr><th class="name-col">Alumno</th>${headers}<th class="final-col"><span class="class-stat-heading">Nota final ${classStatButton('period',STATE.periodId,'nota final de la evaluación')}</span></th><th class="itaca-col">Nota Ítaca <small>/10 · clic para excepción</small></th></tr></thead><tbody>${rows||`<tr><td colspan="${assessments.length+3}" class="empty-table-message">Aún no hay alumnos en este grupo.</td></tr>`}</tbody></table></div><div class="table-foot"><span>${students.length} alumnos · ${assessments.length} actividades · ${esc(currentPeriod()?.name)}</span><span>${Math.abs(sum-100)>1e-8?'⚠ Porcentajes de este periodo: '+sum+' %. Corrige la suma para calcular la nota.':'Porcentajes: 100 %. Las categorías sin evaluar redistribuyen el peso.'}${problems.length?`<span class="warning-calculation">⚠ Hay calificaciones sin conversión que superan 10: su cálculo queda bloqueado.</span>`:''}</span></div></section><div class="legend"><span class="note">● NP significa «No presentado» y computa como 0; AJ indica ausencia justificada pendiente y no computa. Una casilla vacía tampoco computa.</span><span class="note">● Las recuperaciones sustituyen o mejoran su examen de origen; nunca cuentan dos veces.</span><span class="note">● Los resultados se redondean solo para mostrarlos.</span><span class="note">● Colores: 0–3,49 granate; 3,50–4,99 rojo; 5–5,99 amarillo; 6–6,99 verde; 7–9,99 azul gradual; 10 morado.</span></div>`;
}
const ITACA_OPTIONS=[['half','Redondear desde ,5'],['seven','Redondear desde ,7'],['none','No redondear']];
const RULE_LABELS={mean:'Media aritmética',weighted_mean:'Media ponderada por actividad',highest:'Mejor nota',best_n:'Media de las N mejores',last:'Última evaluada',latest_if_highest:'Última si iguala o supera la mejor; si no, media'};
function renderRules(){
  const categories=effectiveCategories(STATE.doc,STATE.groupId,STATE.periodId);
  const sum=categories.reduce((s,x)=>s+x.weight,0);
  const profile=STATE.doc.gradingProfiles.find(x=>x.groupId===STATE.groupId&&x.periodId===STATE.periodId);
  const individualCount=STATE.doc.individualCategoryRules.filter(r=>r.periodId===STATE.periodId&&STATE.doc.students.some(s=>s.id===r.studentId&&s.groupId===STATE.groupId)).length;
  return `<div class="grid-two"><section class="panel panel-pad"><div class="section-title-row"><h2>Porcentajes y reglas</h2><div class="tool-actions"><button class="btn small primary" id="individual-rules">Reglas por alumno${individualCount?` (${individualCount})`:``}</button><button class="btn small" id="new-category">+ Categoría</button></div></div><p class="subtitle"><strong>${esc(currentGroup().name)} · ${esc(currentPeriod().name)}</strong>. Configura este periodo sin afectar a los demás. Puedes retirar categorías vacías de este grupo sin modificar los otros. ${profile?'Personalizado':'Se aplican valores predeterminados'}.</p><p class="hint">Cada categoría tiene un color distinto, aplicado a todas sus columnas en las evaluaciones. Puedes personalizarlo aquí y volver al color predeterminado.</p>${categories.map(c=>`<div class="rule-row"><div><div class="category-header"><div class="rule-title class-stat-heading">${esc(c.name)} ${classStatButton('category',c.id,c.name)}</div><button class="btn small category-delete" type="button" data-delete-category="${esc(c.id)}" title="Quitar categoría del grupo si no tiene actividades en ninguna evaluación">Eliminar</button></div><div class="hint">${c.rule==='weighted_mean'?'Usa pesos de actividades':'Porcentaje en esta evaluación'}</div><label class="category-color-control">Color de columnas <input type="color" data-category-color="${esc(c.id)}" value="${esc(categoryColumnColor(STATE.doc,c.id))}" aria-label="Color de las actividades de ${esc(c.name)}" title="Aplicar color a las columnas de esta categoría"/></label><button type="button" class="category-color-reset" data-category-color-reset="${esc(c.id)}" ${c.columnColor?'':'disabled'} >Color predeterminado</button></div><label><span class="visually-hidden">Porcentaje de ${esc(c.name)}</span><input class="number-field" type="number" data-periodweight="${esc(c.id)}" min="0" max="100" step="any" value="${esc(c.weight)}"/> %</label><label><span class="visually-hidden">Regla de ${esc(c.name)}</span><select data-periodrule="${esc(c.id)}">${Object.entries(RULE_LABELS).map(([key,label])=>opt(key,label,c.rule)).join('')}</select></label><label class="best-n-box ${c.rule==='best_n'?'':'hidden'}">Mejores <input type="number" class="number-field" data-bestcount="${esc(c.id)}" min="1" max="100" step="1" value="${esc(c.bestCount??2)}"/></label></div>`).join('')}<div class="sum-line ${Math.abs(sum-100)>1e-8?'bad':''}">Total del periodo: ${sum} % ${Math.abs(sum-100)>1e-8?'— ajusta hasta llegar al 100 %':'✓'}</div><div class="settings-actions"><button class="btn small" id="reset-rules">Restablecer reglas de este periodo</button><label>Copiar de <select id="source-period"><option value="">Selecciona periodo</option>${[...STATE.doc.periods].sort((a,b)=>a.order-b.order).filter(x=>x.id!==STATE.periodId).map(x=>opt(x.id,x.name,'')).join('')}</select></label><button class="btn small" id="copy-rules">Aplicar copia</button></div></section><section class="panel panel-pad"><h2>Cómo se calcula</h2><p>Cada actividad se convierte a 0–10 cuando está activada la conversión. Una nota bruta superior a 10 bloquea los cálculos dependientes hasta corregir la escala. Solo se utilizan las actividades evaluadas; una casilla vacía no es un cero.</p><p>Las excepciones individuales permiten usar siempre la media, obligarla cuando un NP computa como cero o sustituir por el último examen. AJ (ausencia justificada pendiente) queda fuera del cálculo; la nota previa se conserva al activar y desactivar AJ.</p><p>La media ponderada usa los pesos individuales de las actividades. La regla «N mejores» elige las N mayores notas normalizadas; si hay menos, utiliza las disponibles.</p><div class="section-note"><strong>Recuperaciones.</strong> Una recuperación enlazada sustituye la evidencia original si eliges «sustituir siempre», o cuenta solo si mejora su nota con «conservar la mayor». Nunca se suma como segundo examen. Una actividad posterior sin nota no puede considerarse la «última» para activar la regla condicional; en ese caso se usa la media de las evaluadas.</div><p class="note">Los porcentajes deben sumar 100. Una categoría sin evidencias se excluye y el peso de las evaluadas se redistribuye. Las competencias se calculan con sus propios vínculos.</p></section></div>`;
}
function renderCompetencies(){
  const group=currentGroup(),catalog=officialCompetenciesForGroup(group,STATE.competencyVersion);
  if(!catalog){
    if(!group)return '<section class="panel panel-pad"><h2>Competencias</h2><p>Selecciona primero un grupo.</p></section>';
    // Las materias nuevas no tienen repertorio oficial: se pueden definir
    // competencias propias, sin atribuirles normativa inventada.
    const personal=groupCompetencies(STATE.doc,group.id).filter(c=>!c.curriculumKey);
    const visible=visibleCategories(),students=allStudents();
    return `<div class="competency-view">
      <section class="panel panel-pad">
        <div class="section-title-row"><div><h2>Competencias personalizadas · ${esc(group.subject)}</h2>
          <p class="subtitle">Esta materia no tiene currículo oficial precargado. Puedes crear competencias propias y asociarlas a categorías, sin modificar las notas por defecto.</p></div>
          <button class="btn small" id="new-competency">+ Competencia propia</button></div>
        ${personal.map(c=>`<article class="competency-item">
          <h3>${esc(c.name)}</h3>
          <div class="comp-table"><table class="full-width"><tbody>
          ${visible.map(cat=>`<tr><td>${esc(cat.name)}</td><td class="align-right">
            <label class="visually-hidden" for="custom-link-${esc(c.id)}-${esc(cat.id)}">Peso de ${esc(cat.name)} en ${esc(c.name)}</label>
            <input class="number-field" id="custom-link-${esc(c.id)}-${esc(cat.id)}" type="number" min="0" max="1000" step="1"
              data-comp="${esc(c.id)}" data-linkcat="${esc(cat.id)}" value="${esc(c.links.find(x=>x.categoryId===cat.id)?.weight??0)}"/></td></tr>`).join('')}
          </tbody></table></div></article>`).join('')||'<p class="hint">No hay competencias propias. Pulsa «+ Competencia propia» para comenzar.</p>'}</section>
      <section class="panel panel-pad"><h2>Resultados competenciales</h2>
      ${competencyScaleLegend()}<div class="overflow-auto"><table class="comp-table"><thead><tr><th>Alumno</th>${personal.map(c=>`<th>${esc(c.name)}</th>`).join('')}</tr></thead>
      <tbody>${students.map(student=>`<tr><td>${esc(student.name)}</td>${personal.map(c=>`<td>${competencyLevelChip(competencyGrade(STATE.doc,student.id,c.id,group.id,STATE.periodId))}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section></div>`;
  }
  const students=allStudents();
  const official=catalog.competencias.map(ce=>({...ce,stored:linkedOfficialCompetency(STATE.doc,group.id,ce.key)}));
  const custom=groupCompetencies(STATE.doc,group.id).filter(c=>!c.curriculumKey);
  const visible=visibleCategories();
  const linkRows=(id,key)=>`<div class="comp-table"><table class="full-width"><tbody>${visible.map(cat=>{
    const stored=id?STATE.doc.competencies.find(c=>c.id===id):null;
    const l=stored?.links.find(x=>x.categoryId===cat.id);
    return `<tr><td>${esc(cat.name)}</td><td class="align-right"><label class="visually-hidden" for="link-${esc(key)}-${esc(cat.id)}">Peso de ${esc(cat.name)} en ${esc(key)}</label><input class="number-field" id="link-${esc(key)}-${esc(cat.id)}" type="number" min="0" max="1000" step="1" value="${esc(l?.weight??0)}" ${id?`data-comp="${esc(id)}"`:`data-official="${esc(key)}"`} data-linkcat="${esc(cat.id)}"/></td></tr>`;}).join('')}</tbody></table></div>`;
  const criteriaFor=(ce)=>{
    const number=String(ce.code).replace(/^CE/,'');
    const items=(catalog.data.criterios||[]).filter(cr=>String(cr.competencia)===number);
    return `<section class="comp-linked-criteria" aria-label="Criterios de evaluación de ${esc(ce.code)}"><h4>Criterios de evaluación de ${esc(ce.code)}</h4>${items.length
      ?`<ol>${items.map(cr=>`<li><strong>${esc(cr.codigo||'Criterio')}</strong> ${esc(cr.texto)}${cr.page&&catalog.data.fuente_pdf?` <a href="${esc(catalog.data.fuente_pdf)}#page=${esc(cr.page)}" target="_blank" rel="noopener noreferrer">Página ${esc(cr.page)}</a>`:''}</li>`).join('')}</ol>`
      :'<p class="hint">No hay criterios de evaluación oficiales incorporados para esta versión. Consulta «Currículo» antes de asignar porcentajes.</p>'}</section>`;
  };
  const meanIds=official.map(ce=>ce.stored?.id).filter(Boolean);
  const currentMean=student=>{
    const score=competencyArithmeticMean(STATE.doc,student.id,meanIds,group.id,STATE.periodId);
    if(score===null)return '<span class="grade-empty">—</span>';
    const display={decimals:2,rounding:'half-up'};
    const level=gradeToFour(score);
    return `<span class="competency-mean-values" aria-label="Nivel de la media: ${esc(level)} · ${esc(competencyAcquisitionLabel(score))}">${competencyLevelChip(score)}<small class="competency-mean-source">Media aritmética: ${esc(formatGrade(score,display))} /10</small></span>`;
  };
  const currentGrade=(student,comp)=>comp?.id?competencyLevelChip(competencyGrade(STATE.doc,student.id,comp.id,group.id,STATE.periodId)):competencyLevelChip(null);
  return `<div class="competency-view"><section class="panel panel-pad"><div class="section-title-row"><div><h2>Competencias específicas · ${esc(group.subject)}</h2><p class="subtitle">${esc(catalog.data.norma)} · ${catalog.competencias.length} competencias oficiales · selección de pesos opcional</p></div><button class="btn small" id="new-competency">+ Competencia propia</button></div>
  ${group.subject==='Latín II'?`<label class="competency-version">Normativa para Latín II <select id="comp-curr-version">${[['auto','Según curso escolar'],['2022','2022 · 2026–2027'],['2026','2026 · desde 2027–2028']].map(([v,t])=>opt(v,t,STATE.competencyVersion)).join('')}</select></label>`:''}
  ${catalog.warning?`<p class="comp-curr-warning">⚠ ${esc(catalog.warning)}</p>`:''}
  <p class="section-note">Los enunciados son los del decreto. Cada competencia empieza sin cálculo: solo tendrá nota si asignas explícitamente pesos a categorías. Ninguna ponderación se presume oficial.</p>
  <div class="official-competency-grid">${official.map(ce=>`<article class="competency-item official-competency"><div class="comp-head"><strong class="ce-number">${esc(ce.code)}</strong><h3>${esc(ce.enunciado)}</h3></div><details class="comp-weights"><summary>Vincular categorías para calificar ${esc(ce.code)}</summary><p class="hint">0 = categoría sin vínculo. Los pesos son relativos y no se requiere sumarlos a 100. Consulta los criterios oficiales de esta competencia justo debajo antes de elegir su porcentaje.</p>${linkRows(ce.stored?.id,ce.key)}${criteriaFor(ce)}</details></article>`).join('')}</div>
  ${custom.length?`<details class="custom-competencies"><summary>Competencias personalizadas o de versiones anteriores (${custom.length})</summary>${custom.map(c=>`<div class="competency-item"><h3>${esc(c.name)}</h3>${linkRows(c.id,c.id)}</div>`).join('')}</details>`:''}</section>
  <section class="panel panel-pad"><h2>Resultados por competencia</h2><p class="subtitle">${esc(group.name)} · ${esc(currentPeriod()?.name)} · las casillas sin vínculo permanecen vacías</p>${competencyScaleLegend()}<div class="overflow-auto"><table class="comp-table"><thead><tr><th>Alumno</th>${official.map(c=>`<th title="${esc(c.enunciado)}"><span class="class-stat-heading">${esc(c.code)} ${c.stored?.id?classStatButton('competency',c.stored.id,c.code):''}</span></th>`).join('')}<th class="competency-mean-heading" scope="col">Media de competencias <small>sin ponderar · /10 y /4</small></th></tr></thead><tbody>${students.map(st=>`<tr><td class="comp-name">${esc(st.name)}</td>${official.map(c=>`<td>${currentGrade(st,c.stored)}</td>`).join('')}<td class="competency-mean-cell">${currentMean(st)}</td></tr>`).join('')}</tbody></table></div><p class="section-note">La media de competencias es aritmética y sin ponderación entre las CE oficiales con nota; las no evaluadas se excluyen. Se calcula con precisión completa y se muestra sobre 10 y como nivel de adquisición discreto: 1 = alta (8–10); 2 = media (6,5–<8); 3 = baja (5–<6,5); 4 = no adquirida (<5). No afecta a la nota final. Puedes consultar los criterios completos en «Currículo».</p></section></div>`;
}

/** La consulta curricular es de solo lectura, completamente separada de las calificaciones. */
function currentCurriculum(){
  if(STATE.level==='4eso'&&STATE.subject==='Latín 4.º')return CURRICULA.lat4;
  if(STATE.level==='1bach'&&STATE.subject==='Latín I')return CURRICULA.lat1;
  if(STATE.level==='1bach'&&STATE.subject==='Griego I')return CURRICULA.gr1;
  if(STATE.level==='2bach'&&STATE.subject==='Latín II')return STATE.curriculumVersion==='2026'?CURRICULA.lat2:CURRICULA['lat2-2022'];
  if(STATE.level==='2bach'&&STATE.subject==='Griego II')return CURRICULA.gr2;
  return null;
}
function curriculumText(text){
  return String(text||'').split(/\n\s*\n/).filter(Boolean).map(p=>`<p>${esc(p)}</p>`).join('');
}
function curriculumContains(value,term){return !term||String(value).toLocaleLowerCase('es').includes(term);}
function renderCurriculumCriteria(data,criterios,id){
  return `<section class="curr-criteria-group" aria-label="Criterios de evaluación de la competencia específica ${esc(id)}"><h4>Criterios de evaluación (${criterios.length})</h4><ol class="curr-criteria-list">${criterios.map(cr=>`<li><div class="curr-criterion-entry">${cr.codigo?`<strong class="curr-criterion-code">${esc(cr.codigo)}</strong>`:''}<p>${esc(cr.texto)}</p></div><div class="curr-source">Decreto · página ${esc(cr.page)} del PDF · <a href="${esc(data.fuente_pdf)}#page=${esc(cr.page)}" target="_blank" rel="noopener noreferrer">Ver página</a></div></li>`).join('')}</ol></section>`;
}
function curriculumCards(data){
  if(!data)return '';
  const q=STATE.curriculumQuery.trim().toLocaleLowerCase('es');
  if(['competencias','criterios'].includes(STATE.curriculumSection)){
    const found=curriculumCompetenciesWithCriteria(data,{competence:STATE.curriculumCompetence,query:q});
    return found.map(({competencia:c,criterios})=>`<article class="curr-card curr-competency"><div class="curr-card-heading"><span class="curr-number" aria-hidden="true">${esc(c.id)}</span><div><span class="curr-eyebrow">Competencia específica ${esc(c.id)}</span><h3>${esc(c.enunciado)}</h3></div></div>${c.claves?.length?`<div class="curr-keywords">${c.claves.map(k=>`<span class="curr-keyword">${esc(k)}</span>`).join('')}</div>`:''}${c.descripcion?`<details class="curr-details"><summary>Leer descripción completa</summary><p>${esc(c.descripcion)}</p></details>`:''}<div class="curr-source">Decreto · página ${esc(c.page)} del PDF · <a href="${esc(data.fuente_pdf)}#page=${esc(c.page)}" target="_blank" rel="noopener noreferrer">Ver página</a></div>${renderCurriculumCriteria(data,criterios,c.id)}</article>`).join('')||'<p class="curr-empty">No hay competencias ni criterios que coincidan con la búsqueda.</p>';
  }
  if(STATE.curriculumSection==='saberes'){
    const filtered=data.saberes.map(b=>({...b,items:b.items?.filter(item=>curriculumContains(item.texto,q))||[],subbloques:b.subbloques?.map(sb=>({...sb,items:sb.items.filter(it=>curriculumContains(it.texto,q))})).filter(sb=>sb.items.length||curriculumContains(sb.titulo,q))||[]}))
      .filter(b=>!q||curriculumContains(b.titulo,q)||b.items.length||b.subbloques.length);
    return filtered.map(b=>`<article class="curr-card curr-block"><div class="curr-card-heading"><span class="curr-number curr-roman">${esc(b.codigo)}</span><div><span class="curr-eyebrow">Bloque de saberes básicos</span><h3>${esc(b.titulo)}</h3></div></div>${b.subbloques?.map(sb=>`<div class="curr-subblock"><h4>${esc(sb.codigo)}. ${esc(sb.titulo)}</h4><ul>${sb.items.map(i=>`<li>${esc(i.texto)}</li>`).join('')}</ul></div>`).join('')||''}${b.items?.length?`<ul>${b.items.map(i=>`<li>${esc(i.texto)}</li>`).join('')}</ul>`:''}<div class="curr-source">Decreto · página ${esc(b.page)} del PDF · <a href="${esc(data.fuente_pdf)}#page=${esc(b.page)}" target="_blank" rel="noopener noreferrer">Ver página</a></div></article>`).join('')||'<p class="curr-empty">No hay saberes que coincidan con la búsqueda.</p>';
  }
  const sections=[{titulo:'Presentación de la materia',texto:data.presentacion},...(data.complementos||[])];
  return sections.filter(c=>curriculumContains(c.titulo+' '+c.texto,q)).map(c=>`<article class="curr-card curr-prose"><h3>${esc(c.titulo)}</h3><details class="curr-details"><summary>Leer apartado íntegro</summary>${curriculumText(c.texto)}</details></article>`).join('')||'<p class="curr-empty">No hay apartados que coincidan con la búsqueda.</p>';
}
function renderCurriculum(){
  const data=currentCurriculum();
  if(!data)return `<section class="panel panel-pad"><h2>Currículo de ${esc(STATE.subject)}</h2><p>No hay un currículo oficial incorporado para esta materia. Puedes utilizar el cuaderno, las categorías y las competencias personalizadas; la normativa deberá consultarse por separado.</p></section>`;
  const isLatin2=STATE.level==='2bach'&&STATE.subject==='Latín II';
  const available=data.estado!=='fuente_pendiente';
  const nSab=data.saberes.reduce((total,b)=>total+(b.items?.length||0)+(b.subbloques||[]).reduce((sum,x)=>sum+x.items.length,0),0);
  const sections=[['competencias','Competencias y criterios'],['saberes','Saberes básicos'],['otros','Otros apartados']];
  const source=data.fuente_pdf||data.fuente_web;
  return `<div class="curriculum-view"><section class="curr-hero"><div class="curr-intro"><span class="curr-eyebrow">Biblioteca curricular · consulta</span><h2>${esc(data.titulo)}</h2><p>${esc(data.norma)}</p><p class="curr-readonly">Consulta de solo lectura. No altera competencias evaluables, rúbricas, pesos ni calificaciones del cuaderno.</p></div><div class="curr-metrics"><div><strong>${available?data.competencias.length:'—'}</strong><span>Competencias</span></div><div><strong>${available?data.criterios.length:'—'}</strong><span>Criterios</span></div><div><strong>${available?nSab:'—'}</strong><span>Saberes</span></div></div></section>
  ${isLatin2?`<div class="curr-version-picker" role="group" aria-label="Versión del currículo de Latín II"><button type="button" data-curr-version="2022" class="${STATE.curriculumVersion==='2022'?'selected':''}" aria-pressed="${STATE.curriculumVersion==='2022'}">2022 · 2026–2027</button><button type="button" data-curr-version="2026" class="${STATE.curriculumVersion==='2026'?'selected':''}" aria-pressed="${STATE.curriculumVersion==='2026'}">2026 · Desde 2027–2028</button></div>`:''}
  ${available?`<div class="curr-controls"><nav class="curr-section-nav" aria-label="Apartados del currículo">${sections.map(([k,t])=>`<button type="button" data-curr-section="${k}" class="${STATE.curriculumSection===k?'selected':''}" aria-pressed="${STATE.curriculumSection===k}">${t}</button>`).join('')}</nav><div class="curr-filters"><label for="curr-search">Buscar en ${esc((sections.find(([k])=>k===STATE.curriculumSection)?.[1]??sections[0][1]).toLocaleLowerCase('es'))}</label><input id="curr-search" class="text-field" type="search" placeholder="Busca un término, código o tema…" autocomplete="off" value="${esc(STATE.curriculumQuery)}"/>${['competencias','criterios'].includes(STATE.curriculumSection)?`<label for="curr-competence">Competencia</label><select id="curr-competence">${[['all','Todas'],...data.competencias.map(c=>[String(c.id),'CE '+c.id])].map(([k,t])=>opt(k,t,STATE.curriculumCompetence)).join('')}</select>`:''}</div></div><div class="curr-card-grid ${['competencias','criterios'].includes(STATE.curriculumSection)?'curr-competency-grid':''}" id="curriculum-cards">${curriculumCards(data)}</div>`:`<section class="curr-warning"><h3>Versión 2022: transcripción pendiente de fuente oficial</h3><p>${esc(data.incidencia)}</p><p>La consulta queda identificada y separada de la versión 2026, pero no se muestran como oficiales textos procedentes de una programación de aula.</p></section>`}
  <div class="curr-footer"><span>Fuente: ${esc(data.norma)}</span><a href="${esc(source)}" target="_blank" rel="noopener noreferrer">${data.fuente_pdf?'Abrir extracto del DOGV (sin conexión)':'Consultar decreto original de 2022 (requiere conexión)'}</a>${data.fuente_pdf&&data.fuente_web?`<a href="${esc(data.fuente_web)}" target="_blank" rel="noopener noreferrer">Consultar DOGV</a>`:''}</div></div>`;
}
function bindCurriculum(){
  document.querySelectorAll('[data-curr-version]').forEach(b=>b.onclick=()=>{
    STATE.curriculumVersion=b.dataset.currVersion;STATE.curriculumQuery='';STATE.curriculumSection='competencias';STATE.curriculumCompetence='all';render();
  });
  document.querySelectorAll('[data-curr-section]').forEach(b=>b.onclick=()=>{
    STATE.curriculumSection=b.dataset.currSection;STATE.curriculumQuery='';STATE.curriculumCompetence='all';render();
  });
  $('#curr-search')?.addEventListener('input',event=>{
    STATE.curriculumQuery=event.target.value;
    const panel=$('#curriculum-cards');if(panel)panel.innerHTML=curriculumCards(currentCurriculum());
  });
  $('#curr-competence')?.addEventListener('change',event=>{
    STATE.curriculumCompetence=event.target.value;
    const panel=$('#curriculum-cards');if(panel)panel.innerHTML=curriculumCards(currentCurriculum());
  });
}
function renderSettings(){
  const s=STATE.doc.settings;
  const originWarning=location.hostname==='archaiosmagister.github.io'
    ? '<p class="section-note">Aviso de aislamiento: las aplicaciones de este dominio GitHub Pages comparten origen y acceso al almacenamiento del navegador, aunque estén en rutas distintas. El cuaderno está cifrado, pero otro código del mismo origen podría copiar su sobre cifrado o borrar el almacén. No introduzcas datos reales hasta alojar AppNotas en un origen independiente y autorizar su uso.</p>' : '';
  return `<div class="grid-two"><section class="panel panel-pad"><h2>Precisión y presentación</h2><div class="settings-grid"><div class="setting-box"><label for="decimals"><strong>Decimales mostrados</strong></label><select id="decimals">${[0,1,2].map(n=>opt(String(n),String(n),String(Math.min(2,s.decimals)))).join('')}</select><p class="hint">El cálculo interno mantiene toda la precisión.</p></div><div class="setting-box"><label for="rounding"><strong>Tipo de redondeo</strong></label><select id="rounding">${[['half-up','Matemático'],['floor','Hacia abajo'],['ceil','Hacia arriba']].map(([k,v])=>opt(k,v,s.rounding)).join('')}</select><p class="hint">Se aplica al mostrar el resultado.</p></div></div><div class="section-note">Periodo, grupo, categorías y actividades se almacenan en un modelo versionado. OneDrive no está conectado y la webapp no envía datos del cuaderno a servidores.</div></section><section class="panel panel-pad"><h2>Colores por curso y asignatura</h2><p class="subtitle">Cada materia conserva su color independientemente del grupo y del periodo. Los cambios se guardan en el cuaderno local cifrado.</p><div class="accent-list">${pairOptions().map(x=>{const [level,subject]=x.value.split(':');return `<label class="accent-row"><span>${esc(x.label)}</span><input type="color" data-accent="${esc(x.value)}" value="${esc(colorFor(level,subject))}" aria-label="Color de ${esc(x.label)}"/></label>`;}).join('')}</div><button class="btn small" id="reset-accents">Restablecer colores predeterminados</button></section><section class="panel panel-pad"><h2>Valores predeterminados para faltas</h2><p class="subtitle">Se aplican a <strong>nuevos exámenes</strong> de la categoría Exámenes. Los exámenes existentes mantienen sus propias reglas.</p><div class="settings-grid"><div class="setting-box"><label><input id="orth-default-on" type="checkbox" ${s.orthographyDefaults?.enabledForExams?'checked':''}/> Activar en exámenes nuevos</label></div><div class="setting-box"><label for="orth-default-rate">Puntos a restar por falta</label><input id="orth-default-rate" class="text-field" type="number" min="0" max="10" step="0.01" value="${esc(s.orthographyDefaults?.penaltyPerFault??0.1)}"/></div><div class="setting-box"><label for="orth-default-copies">Veces que debe copiar cada falta</label><input id="orth-default-copies" class="text-field" type="number" min="1" max="1000" step="1" value="${esc(s.orthographyDefaults?.repetitions??30)}"/></div><div class="setting-box"><label><input id="orth-default-refundable" type="checkbox" ${s.orthographyDefaults?.refundable?'checked':''}/> Restaurar la nota cuando se entreguen</label></div></div><button type="button" class="btn primary" id="save-orth-defaults">Guardar valores para nuevos exámenes</button><p class="hint">Los cambios no alteran las notas ya guardadas ni las actividades existentes. La devolución por faltas específica de cada curso se configura desde «Gestión de grupo».</p></section><section class="panel panel-pad"><h2>Copias de seguridad cifradas</h2><p>Descarga una copia del cuaderno. Para recuperarla necesitarás la contraseña con la que se cifró. Guárdala fuera del almacenamiento del navegador.</p><p class="hint">Política de uso local: conserva dos copias cifradas en ubicaciones físicas distintas del dispositivo (carpeta local/USB), <strong>sin iCloud Drive, OneDrive ni servicios sincronizados</strong>. Realiza una copia cada semana y después de introducir muchas notas o cerrar una evaluación. Reabre el archivo con «Verificar copia»: iniciar una descarga no garantiza que se haya guardado correctamente.</p><div class="actions"><button class="btn primary" id="backup-portable">↓ Guardar copia portátil (.cuaderno)</button><button class="btn" id="backup-download">Descargar copia histórica (.cdoc)</button>${STATE.failedEnvelope?'<button class="btn warn" id="backup-draft">Descargar intento cifrado</button>':''}<button class="btn" id="backup-verify">✓ Verificar copia</button><button class="btn" id="backup-restore">↑ Restaurar copia</button>${STATE.recovery?'<button class="btn" id="backup-recover">↶ Recuperar versión anterior</button><button class="btn" id="backup-download-recovery">↓ Descargar rescate</button>':''}</div><input type="file" id="backup-file" class="hidden" accept=".cuaderno,.cdoc,.json,application/json,application/octet-stream"/><input type="file" id="backup-verify-file" class="hidden" accept=".cuaderno,.cdoc,.json,application/json,application/octet-stream"/><p class="recovery-help">Al restaurar una copia se guarda automáticamente la versión anterior, todavía cifrada. Solo se conserva <strong>un punto de rescate</strong> dentro del navegador; la siguiente restauración lo sustituye. Descarga siempre una copia externa antes de restaurar.</p><div class="section-note">No se ha realizado una auditoría independiente de seguridad. Utiliza esta aplicación solo en los dispositivos autorizados por tu centro y conforme a su política de protección de datos. Conserva copias cifradas locales no sincronizadas y verifica periódicamente que puedes restaurarlas.</div></section><section class="panel panel-pad"><h2>Empezar de cero</h2><p>Reinicia el cuaderno para dejar las tres evaluaciones y las categorías básicas, sin grupos, alumnos, actividades, notas ni agenda anterior.</p><p class="hint">Antes debes guardar fuera del navegador un archivo .cuaderno de esta misma revisión y volver a seleccionarlo para verificarlo. Después tendrás que escribir REINICIAR. Se conserva un único rescate cifrado en el dispositivo; se sustituirá si vuelves a importar o reiniciar.</p><div class="actions"><button class="btn warn" id="reset-notebook">Reiniciar cuaderno (requiere copia comprobada)</button></div><input type="file" id="reset-notebook-file" class="hidden" accept=".cuaderno,application/octet-stream"/></section><section class="panel panel-pad"><h2>Conservación del almacenamiento local</h2><p>El navegador puede eliminar los datos de IndexedDB. La protección persistente reduce el riesgo de eliminación automática, pero no sustituye copias cifradas externas.</p><div class="actions"><button type="button" class="btn" id="storage-check">Comprobar protección</button><button type="button" class="btn" id="storage-protect">Solicitar almacenamiento persistente</button></div><p id="storage-status" class="hint" role="status" aria-live="polite">Sin comprobar.</p>${originWarning}</section><section class="panel panel-pad"><h2>Preparación para trabajar offline</h2><p>Comprueba que el navegador tiene almacenados los recursos estáticos de esta versión. La comprobación no sustituye la prueba real desconectando internet.</p><div class="actions"><button class="btn" id="check-offline">Comprobar recursos offline</button><button class="btn" id="check-reload">Probar guardado y recarga</button></div><p class="hint">La prueba de recarga compara la misma copia cifrada antes y después de recargar, sin alterar calificaciones. No verifica un cierre completo del navegador ni la apertura sin red.</p><p id="offline-result" class="hint" role="status" aria-live="polite"></p></section></div>`;
}
function renderRubrics(){
  const rubrics=STATE.doc.rubrics;
  return `<div class="grid-two"><section class="panel panel-pad"><h2>Plantillas de rúbricas</h2><p class="subtitle">Define criterios, puntuaciones máximas y pesos. Se pueden reutilizar para Trabajos y Actitud y se convierten a /10.</p><div class="actions"><button class="btn primary" id="create-rubric">+ Crear rúbrica</button><button class="btn" id="import-rubric">↑ Importar Excel/CSV/JSON</button><input id="rubric-import-file" class="hidden" type="file" accept=".xlsx,.json,.csv,application/json,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"/></div>${rubrics.map(r=>{
    const used=STATE.doc.assessments.some(a=>a.rubricId===r.id&&STATE.doc.grades.some(g=>g.assessmentId===a.id));
    const descriptive=r.criteria.some(c=>c.levels?.length);
    return `<div class="competency-item"><div class="section-title-row"><h3>${esc(r.name)}</h3><div class="actions"><button class="btn small" data-copy-rubric="${esc(r.id)}">Duplicar</button><button class="btn small" data-edit-rubric="${esc(r.id)}" ${used||descriptive?'disabled':''} title="${descriptive?'Para cambiar descriptores, edita el Excel y vuelve a importarlo':'Editar criterios'}">Editar</button></div></div><p class="hint">${r.criteria.length} criterios · ${used?'Con notas: bloqueada para evitar recalcular notas antiguas; puedes duplicarla.':descriptive?'Con niveles descriptivos: edítala en Excel y vuelve a importarla.':'Editable'}</p><table class="comp-table full-width"><thead><tr><th>Criterio</th><th>Máximo</th><th>Peso</th></tr></thead><tbody>${r.criteria.map(c=>`<tr><td>${esc(c.name)}</td><td>${esc(c.maxScore)}</td><td>${esc(c.weight)}</td></tr>`).join('')}</tbody></table></div>`;
  }).join('')||'<p class="hint">No hay rúbricas. Crea una para poder seleccionarla al añadir una actividad.</p>'}</section><section class="panel panel-pad"><h2>Calificación con rúbrica</h2><p>Desde el cuaderno, pulsa <strong>Evaluar</strong> en la columna que tenga una rúbrica. Verás la nota calculada mientras introduces cada criterio, con botones de puntuación rápida y la opción «Guardar y siguiente alumno».</p><p>Para importar, admite <strong>Excel XLSX</strong> con niveles descriptivos, <strong>CSV</strong> con <code>criterio;maximo;peso</code> o <strong>JSON</strong> con <code>name</code> y <code>criteria</code>.</p><div class="section-note">Una rúbrica con notas queda bloqueada frente a ediciones que reinterpretarían sus resultados. «Duplicar» genera una plantilla nueva y no altera las calificaciones existentes.</div></section></div>`;
}
function editRubricModal(rubric=null){
  const items=rubric?.criteria||[{name:'Contenido',maxScore:5,weight:2},{name:'Presentación',maxScore:3,weight:1},{name:'Corrección',maxScore:2,weight:1}];
  dialog.classList.add('rubric-modal');
  dialog.addEventListener('close',()=>dialog.classList.remove('rubric-modal'),{once:true});
  const row=(c={name:'',maxScore:5,weight:1})=>`<div class="rubric-edit-row" data-editor-row><label>Criterio<input type="text" data-criterion-name maxlength="150" required value="${esc(c.name)}" placeholder="Descripción"/></label><label>Máximo<input type="number" data-criterion-max min="0.01" max="1000" step="any" required value="${esc(c.maxScore)}"/></label><label>Peso<input type="number" data-criterion-weight min="0.01" max="1000" step="any" required value="${esc(c.weight)}"/></label><button type="button" class="btn small" data-remove-criterion title="Quitar criterio" aria-label="Quitar criterio">×</button></div>`;
  dialog.innerHTML=`<form class="modal-inner rubric-dialog" id="rubric-editor"><h2 id="modal-heading">${rubric?'Editar':'Crear'} rúbrica</h2><p class="subtitle">Cada criterio tiene un máximo y un peso relativo. Puedes añadirlos y quitarlos sin escribir fórmulas.</p><label class="rubric-editor-name">Nombre de la rúbrica<input class="text-field" id="rubric-editor-name" maxlength="150" required value="${esc(rubric?.name||'Trabajo escrito')}"/></label><div class="rubric-edit-head"><strong>Criterios</strong><span id="rubric-editor-count"></span></div><div id="rubric-criterion-list">${items.map(row).join('')}</div><button class="btn small" type="button" id="add-criterion">+ Añadir criterio</button><p class="hint" id="rubric-editor-weight"></p><p class="modal-error" role="alert"></p><div class="modal-actions"><button type="button" class="btn" id="cancel-rubric-editor">Cancelar</button><button type="submit" class="btn primary">Guardar rúbrica</button></div></form>`;
  const list=$('#rubric-criterion-list',dialog);
  function updateIndicators(){
    const rows=[...list.querySelectorAll('[data-editor-row]')];
    $('#rubric-editor-count',dialog).textContent=`${rows.length} de 40`;
    const weights=rows.map(r=>Number($('[data-criterion-weight]',r).value));
    $('#rubric-editor-weight',dialog).textContent=weights.every(w=>Number.isFinite(w)&&w>0)?`Peso total: ${weights.reduce((a,b)=>a+b,0)} (los pesos son relativos)`:'Introduce pesos mayores que cero.';
    list.querySelectorAll('[data-remove-criterion]').forEach(b=>b.disabled=rows.length===1);
    $('#add-criterion',dialog).disabled=rows.length>=40;
  }
  list.addEventListener('input',updateIndicators);
  list.addEventListener('click',e=>{if(!e.target.closest('[data-remove-criterion]'))return;e.target.closest('[data-editor-row]').remove();updateIndicators();});
  $('#add-criterion',dialog).onclick=()=>{if(list.children.length>=40)return;list.insertAdjacentHTML('beforeend',row());updateIndicators();list.lastElementChild.querySelector('input').focus();};
  $('#cancel-rubric-editor',dialog).onclick=()=>dialog.close();
  $('#rubric-editor',dialog).onsubmit=async e=>{
    e.preventDefault();const form=e.currentTarget;
    try{
      const criteria=validateRubricDraft([...list.querySelectorAll('[data-editor-row]')].map(r=>({name:$('[data-criterion-name]',r).value,maxScore:$('[data-criterion-max]',r).value,weight:$('[data-criterion-weight]',r).value})));
      form.querySelector('[type="submit"]').disabled=true;
      await commit(d=>rubric?updateRubric(d,rubric.id,$('#rubric-editor-name',dialog).value,criteria):createRubric(d,$('#rubric-editor-name',dialog).value,criteria),rubric?'Editar rúbrica':'Crear rúbrica');
      dialog.close();
    }catch(err){$('.modal-error',dialog).textContent=err.message;form.querySelector('[type="submit"]').disabled=false;}
  };
  updateIndicators();dialog.showModal();$('#rubric-editor-name',dialog).focus();
}
function bindRubrics(){
  $('#create-rubric').onclick=()=>editRubricModal();
  document.querySelectorAll('[data-edit-rubric]').forEach(b=>b.onclick=()=>editRubricModal(STATE.doc.rubrics.find(r=>r.id===b.dataset.editRubric)));
  document.querySelectorAll('[data-copy-rubric]').forEach(b=>b.onclick=async()=>{try{await commit(d=>duplicateRubric(d,b.dataset.copyRubric),'Duplicar rúbrica');toast('Copia creada; puedes editarla sin modificar las notas anteriores.');}catch(err){fail(err);}});
  $('#import-rubric').onclick=()=>$('#rubric-import-file').click();
  $('#rubric-import-file').onchange=async e=>{
    const file=e.target.files[0];if(!file)return;
    try{const spec=await parseRubricFile(file);
      await commit(d=>createRubric(d,spec.name,spec.criteria),'Importar rúbrica');toast('Rúbrica importada localmente.');}
    catch(err){fail(err);}finally{e.target.value='';}
  };
}
/** Una observación es un dato independiente de la puntuación. Puede existir
 * incluso si se borró la nota o si el alumno figura como NP/AJ. */
function openGradeObservation(studentId,assessmentId){
  const student=STATE.doc.students.find(s=>s.id===studentId);
  const activity=STATE.doc.assessments.find(a=>a.id===assessmentId);
  if(!student||!activity||student.groupId!==activity.groupId)return;
  const saved=getGradeObservation(STATE.doc,studentId,assessmentId);
  const scroller=$('.table-scroller');
  const scroll={x:window.scrollX,y:window.scrollY,left:scroller?.scrollLeft??0,top:scroller?.scrollTop??0};
  dialog.innerHTML=`<form class="modal-inner grade-observation-dialog" id="grade-observation-form">
    <h2 id="modal-heading">Observación de calificación</h2>
    <p class="subtitle"><strong>${esc(student.name)}</strong> · ${esc(activity.name)}</p>
    <label for="grade-observation-text">Observación (máximo 1500 caracteres)</label>
    <textarea id="grade-observation-text" class="text-field" rows="6" maxlength="1500" placeholder="Ej.: Realizó el examen otro día.">${esc(saved?.text||'')}</textarea>
    <label class="grade-observation-visibility"><input type="checkbox" id="grade-observation-visible" ${saved?.visibleToStudent?'checked':''}/> Mostrar también en el Modo sesión de evaluación</label>
    <p class="hint">Privada por defecto. Puedes escribir antes de calificar o modificar la nota sin perder este comentario. Dejar el texto vacío y guardar elimina la observación.</p>
    <p class="modal-error" role="alert"></p>
    <div class="modal-actions"><button type="button" class="btn" id="cancel-grade-observation">Cancelar</button><button type="submit" class="btn primary" id="save-grade-observation">Guardar observación</button></div>
  </form>`;
  const form=$('#grade-observation-form',dialog),text=$('#grade-observation-text',form),checkbox=$('#grade-observation-visible',form);
  $('#cancel-grade-observation',form).onclick=()=>dialog.close();
  form.onsubmit=async e=>{
    e.preventDefault();
    const button=$('#save-grade-observation',form);
    button.disabled=true;
    try{
      await commit(d=>setGradeObservation(d,studentId,assessmentId,text.value,checkbox.checked),'Editar observación de calificación');
      if(dialog.open)dialog.close();
      const restore=()=>{
        const table=$('.table-scroller');
        if(table){table.scrollLeft=scroll.left;table.scrollTop=scroll.top;}
        window.scrollTo(scroll.x,scroll.y);
      };
      restore();requestAnimationFrame(restore);
    }catch(error){
      $('.modal-error',form).textContent=error.message;
      button.disabled=false;
    }
  };
  dialog.showModal();
  text.focus({preventScroll:true});
}
function openRubricGrade(studentId,assessmentId){
  const student=STATE.doc.students.find(s=>s.id===studentId),assessment=STATE.doc.assessments.find(a=>a.id===assessmentId);
  if(!student||!assessment?.rubricId)return;
  const rubric=STATE.doc.rubrics.find(r=>r.id===assessment.rubricId);
  if(!rubric)return;
  const old=STATE.doc.grades.find(g=>g.studentId===studentId&&g.assessmentId===assessmentId);
  const students=allStudents(),position=students.findIndex(s=>s.id===studentId),nextStudent=students[position+1];
  dialog.classList.add('rubric-modal');
  dialog.addEventListener('close',()=>dialog.classList.remove('rubric-modal'),{once:true});
  const criteria=rubric.criteria.map(c=>{
    const value=old?.rubricRatings?.find(x=>x.criterionId===c.id)?.score;
    const control=c.levels?.length
      ? `<select class="text-field rubric-rating-input level-select" id="rating-${esc(c.id)}" data-rating-id="${esc(c.id)}"><option value="">Selecciona un nivel</option>${c.levels.map(l=>`<option value="${esc(l.score)}" ${value===l.score?'selected':''}>${esc(l.label)} (${esc(l.score)})</option>`).join('')}</select><p class="level-description" data-level-description="${esc(c.id)}"></p>`
      : `<input class="text-field rubric-rating-input" id="rating-${esc(c.id)}" data-rating-id="${esc(c.id)}" inputmode="decimal" type="text" maxlength="15" spellcheck="false" value="${value===undefined?'':esc(value)}" placeholder="—"/><div class="rubric-quick"><button type="button" class="btn small" data-rating-quick="0" data-criterion="${esc(c.id)}">0</button><button type="button" class="btn small" data-rating-quick="0.5" data-criterion="${esc(c.id)}">½</button><button type="button" class="btn small" data-rating-quick="1" data-criterion="${esc(c.id)}">Máx.</button></div>`;
    return `<div class="rubric-rating-row"><div class="rubric-rating-heading"><strong>${esc(c.name)}</strong><span class="hint">Peso ${esc(c.weight)} · máximo ${esc(c.maxScore)}</span></div><div class="rubric-rating-controls"><label class="visually-hidden" for="rating-${esc(c.id)}">Nota de ${esc(c.name)}</label>${control}<span class="rubric-contribution hint" data-contribution="${esc(c.id)}"></span></div></div>`;
  }).join('');
  dialog.innerHTML=`<form class="modal-inner rubric-dialog" id="rubric-rating-form"><div class="rubric-modal-heading"><div><span class="eyebrow">Evaluación por criterios</span><h2 id="modal-heading">${esc(rubric.name)}</h2><p class="subtitle"><strong>${esc(student.name)}</strong> · ${esc(assessment.name)}${old?.notSubmitted?' · No presentado':''}</p></div><span class="rubric-evaluation-pill">/10</span></div><div class="rubric-rating-list">${criteria}</div><div class="rubric-preview" aria-live="polite"><div><strong id="rubric-live-score">Sin completar</strong><p class="hint" id="rubric-live-description"></p></div><div class="rubric-progress"><div id="rubric-progress-fill"></div></div></div><p class="modal-error" role="alert"></p><div class="modal-actions rubric-modal-actions"><button type="button" class="btn" id="cancel-rubric-grade">Cancelar</button>${old?'<button type="button" class="btn warn" id="clear-rubric-grade">Borrar nota</button>':''}<button type="submit" class="btn primary" id="save-rubric-grade" disabled>Guardar nota</button>${nextStudent?'<button type="submit" class="btn" id="save-rubric-next" data-next="1" disabled>Guardar y siguiente</button>':''}</div></form>`;
  const form=$('#rubric-rating-form',dialog);
  function values(){return Object.fromEntries([...form.querySelectorAll('[data-rating-id]')].map(input=>[input.dataset.ratingId,input.value]));}
  function refresh(){
    const save=$('#save-rubric-grade',form),saveNext=$('#save-rubric-next',form),error=$('.modal-error',form);
    try{
      const p=previewRubric(rubric,values());error.textContent='';
      $('#rubric-live-score',form).innerHTML=p.grade===null?`${p.completed}/${p.total} criterios`:gradeChip(p.grade)+' / 10';
      paintGrades(form);
      $('#rubric-live-description',form).textContent=p.grade===null?`Nota posible: ${gradeFmt(p.minimum)}–${gradeFmt(p.maximum)} / 10. Completa todos los criterios.`:'Nota calculada sin redondeos intermedios.';
      $('#rubric-progress-fill',form).style.width=(p.completed/p.total*100)+'%';
      rubric.criteria.forEach(c=>{
        if(!c.levels)return;
        const level=c.levels.find(l=>String(l.score)===String(values()[c.id]));
        const dest=form.querySelector(`[data-level-description="${c.id}"]`);
        if(dest)dest.textContent=level?.description||'Selecciona un nivel para ver su descripción.';
      });
      p.criteria.forEach(x=>{const span=[...form.querySelectorAll("[data-contribution]")].find(el=>el.dataset.contribution===x.id);if(span)span.textContent=x.filled?`+${gradeFmt(x.contribution)}`:'Pendiente';});
      save.disabled=p.grade===null;if(saveNext)saveNext.disabled=p.grade===null;
    }catch(err){error.textContent=err.message;save.disabled=true;if(saveNext)saveNext.disabled=true;$('#rubric-live-score',form).textContent='Revisar puntuaciones';}
  }
  form.querySelectorAll('[data-rating-id]').forEach(input=>{input.addEventListener('input',refresh);input.addEventListener('change',refresh);});
  form.querySelectorAll('[data-rating-quick]').forEach(btn=>btn.addEventListener('click',()=>{
    const input=[...form.querySelectorAll("[data-rating-id]")].find(el=>el.dataset.ratingId===btn.dataset.criterion),c=rubric.criteria.find(c=>c.id===btn.dataset.criterion);
    input.value=String(c.maxScore*Number(btn.dataset.ratingQuick));input.dispatchEvent(new Event('input',{bubbles:true}));input.focus();
  }));
  $('#cancel-rubric-grade',form).onclick=()=>dialog.close();
  $('#clear-rubric-grade',form)?.addEventListener('click',async()=>{
    if(!window.confirm('¿Borrar la valoración de este alumno? Podrás deshacerlo en esta sesión.'))return;
    try{await commit(d=>setRubricGrade(d,studentId,assessmentId,null),'Borrar nota de rúbrica');dialog.close();}
    catch(err){$('.modal-error',form).textContent=err.message;}
  });
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    const next=e.submitter?.dataset.next==='1';
    try{
      const v=values(),p=previewRubric(rubric,v);
      if(p.grade===null)throw new Error('Completa todos los criterios antes de guardar.');
      form.querySelectorAll('[type="submit"]').forEach(b=>b.disabled=true);
      await commit(d=>setRubricGrade(d,studentId,assessmentId,v),'Evaluar con rúbrica');
      dialog.close();if(next&&nextStudent)openRubricGrade(nextStudent.id,assessmentId);
    }catch(err){$('.modal-error',form).textContent=err.message;refresh();}
  });
  refresh();dialog.showModal();form.querySelector('[data-rating-id]')?.focus();
}

function renderStudentView(){
  const student=STATE.doc.students.find(s=>s.id===STATE.studentId&&s.groupId===STATE.groupId);
  const students=allStudents();
  if(!student)return `<section class="panel panel-pad student-directory"><div class="section-title-row"><div><span class="eyebrow">CONSULTA INDIVIDUAL</span><h2 id="student-list-heading" tabindex="-1">Modo sesión de evaluación · ${esc(currentGroup()?.name||'Grupo')}</h2><p class="subtitle">Selecciona un alumno para consultar sus calificaciones y medias.</p></div><span class="student-count">${students.length} ${students.length===1?'alumno':'alumnos'}</span></div><div class="student-order-bar">${studentSortControls()}</div><div class="student-directory-grid">${students.map((s,i)=>`${originDirectoryHeader(students,i)}<button type="button" class="student-directory-choice" data-open-student="${esc(s.id)}"><span class="student-directory-avatar" aria-hidden="true">◉</span><span>${esc(s.name)}</span>${studentOriginBadge(s)}<span class="student-directory-arrow" aria-hidden="true">›</span></button>`).join('')||'<p class="hint">Todavía no hay alumnos en este grupo.</p>'}</div><p class="section-note">La lista contiene nombres del grupo. Antes de compartir la pantalla, selecciona el alumno correspondiente: la consulta individual oculta los demás nombres.</p><button class="btn" id="return-notebook">Volver al cuaderno</button></section>`;
  const position=students.findIndex(s=>s.id===student.id);
  const previous=students[position-1],next=students[position+1];
  const periods=[...STATE.doc.periods].sort((a,b)=>a.order-b.order);
  const renderRubricBreakdown=(assessment,grade)=>{
    if(!assessment.rubricId||!grade?.rubricRatings||grade.notSubmitted||grade.pendingJustified)return '';
    const rubric=STATE.doc.rubrics.find(r=>r.id===assessment.rubricId);
    if(!rubric)return '';
    return `<details class="student-rubric-breakdown"><summary>Desglose de rúbrica · ${esc(rubric.name)} (${rubric.criteria.length} criterios)</summary><div class="student-rubric-items">${rubric.criteria.map(criterion=>{
      const rating=grade.rubricRatings.find(r=>r.criterionId===criterion.id);
      const level=criterion.levels?.find(l=>l.score===rating?.score);
      return `<details class="student-rubric-item"><summary><span>${esc(criterion.name)}</span><strong>${esc(rawFmt(rating?.score))} / ${esc(rawFmt(criterion.maxScore))}</strong></summary><div class="student-rubric-item-body"><span class="hint">Peso relativo: ${esc(criterion.weight)}</span>${level?`<p><strong>${esc(level.label)}</strong></p>${level.description?`<p>${esc(level.description)}</p>`:''}`:''}</div></details>`;
    }).join('')}</div></details>`;
  };
  const renderActivity=(a,categoryName='')=>{
    const observation=getGradeObservation(STATE.doc,student.id,a.id);
    const visibleObservation=observation?.visibleToStudent?`<details class="student-assessment-observation"><summary>Observación del profesor</summary><p>${esc(observation.text)}</p></details>`:'';
    const grade=STATE.doc.grades.find(g=>g.studentId===student.id&&g.assessmentId===a.id);
    const effective=grade?effectiveAssessmentScore(STATE.doc,a,grade):null;
    const orthography=a.orthography?.enabled&&grade;
    const shown=!grade?'Sin calificar':grade.pendingJustified?'<span class="aj-badge">AJ · Ausencia justificada pendiente</span>':grade.notSubmitted?'<span class="np-badge">NP · No presentado</span>':orthography
      ?`${gradeChip(effective)}<small class="student-original">(${esc(rawFmt(grade.score))} /${esc(rawFmt(a.maxScore))})${grade.orthographyFaults?` · ${grade.orthographyDelivered?'✓ Entregadas':`−${esc(penaltyFmt(orthographyPenalty(a,grade)))} por ${grade.orthographyFaults} faltas`}`:''}</small>`
      :a.rubricId?`${gradeChip(recordedScore(STATE.doc,a,grade))} /10 (rúbrica)`
      :a.convertToTen&&a.maxScore!==10?`${gradeChip(normalizedScore(grade.score,a.maxScore,true))}<small class="student-original">(${esc(rawFmt(grade.score))} /${esc(rawFmt(a.maxScore))})</small>`
      :a.maxScore===10?gradeChip(grade.score):`<span class="student-raw">${esc(rawFmt(grade.score))} /${esc(rawFmt(a.maxScore))}</span>`;
    return `<div class="student-assessment-block student-category-tinted" data-column-category="${esc(a.categoryId)}"><div class="student-assessment"><span>${esc(a.name)}${categoryName?`<small class="student-activity-category">${esc(categoryName)}</small>`:''}</span><strong>${shown}</strong></div>${renderRubricBreakdown(a,grade)}${visibleObservation}</div>`;
  };
  return `<section class="panel panel-pad student-privacy"><div class="student-detail-head"><div><span class="eyebrow">VISOR INDIVIDUAL</span><h2 id="student-view-title" tabindex="-1">${esc(student.name)}</h2><p class="subtitle">${esc(currentGroup().name)}${student.originGroup?' · Grupo de procedencia: '+esc(student.originGroup):''} · Solo aparecen las calificaciones de este alumno.</p></div><div class="student-navigation" role="group" aria-label="Cambiar de alumno"><button class="btn" type="button" id="previous-student" ${previous?'':'disabled'} aria-label="Alumno anterior">← Anterior</button><span class="student-position" aria-label="Alumno ${position+1} de ${students.length}">${position+1} de ${students.length}</span><button class="btn" type="button" id="next-student" ${next?'':'disabled'} aria-label="Alumno siguiente">Siguiente →</button></div><button class="btn primary" id="hide-student">Volver al listado</button></div></section>${periods.map((p,index)=>{
    const cats=effectiveCategories(STATE.doc,STATE.groupId,p.id);
    const mode=STATE.studentActivityOrders[p.id]||'category';
    const ordered=sortStudentPeriodActivities(STATE.doc,STATE.groupId,p.id,mode);
    const content=mode==='category'?cats.map(c=>`<div class="student-category student-category-tinted" data-column-category="${esc(c.id)}"><div class="cardline"><strong>${esc(c.name)}</strong><span class="value">${gradeChip(categoryGrade(STATE.doc,student.id,c.id,STATE.groupId,p.id))} / 10</span></div>${ordered.filter(a=>a.categoryId===c.id).map(a=>renderActivity(a)).join('')||'<p class="hint">Sin actividades en esta categoría.</p>'}</div>`).join('')
      :`<div class="student-activity-list">${ordered.map(a=>renderActivity(a,cats.find(c=>c.id===a.categoryId)?.name||'')).join('')||'<p class="hint">Sin actividades en esta evaluación.</p>'}</div>`;
    const opened=STATE.studentPeriodOpen[p.id]??index===0;
    return `<details class="panel panel-pad student-period" data-student-period="${esc(p.id)}" ${opened?'open':''}><summary class="student-period-summary"><span class="student-period-name">${esc(p.name)}</span><div class="student-period-grades"><span class="student-period-grade"><span class="student-period-grade-label">Media</span><strong class="student-score">${gradeChip(overallGrade(STATE.doc,student.id,STATE.groupId,p.id))} / 10</strong></span><span class="student-period-grade student-period-itaca"><span class="student-period-grade-label">Ítaca</span><strong class="student-score">${itacaChip(STATE.doc,student.id,STATE.groupId,p.id)}</strong></span></div></summary><div class="student-period-body"><label class="student-period-order-label">Orden de las actividades<select data-student-period-order="${esc(p.id)}" aria-label="Orden de actividades de ${esc(p.name)}">${STUDENT_ACTIVITY_SORT_OPTIONS.map(([key,label])=>opt(key,label,mode)).join('')}</select></label>${content}</div></details>`;
  }).join('')}<section class="panel panel-pad student-final-summary"><div class="section-title-row"><strong>Evaluación final del curso</strong><strong class="student-score">${gradeChip(finalGrade(STATE.doc,student.id,STATE.groupId))} / 10</strong></div></section>`;
}
function bindStudentView(){
  document.querySelectorAll('[data-student-period]').forEach(details=>details.addEventListener('toggle',()=>{
    STATE.studentPeriodOpen[details.dataset.studentPeriod]=details.open;
  }));
  document.querySelectorAll('[data-student-period-order]').forEach(select=>select.addEventListener('change',()=>{
    if(!STUDENT_ACTIVITY_SORT_MODES.includes(select.value))return;
    STATE.studentActivityOrders[select.dataset.studentPeriodOrder]=select.value;
    try{localStorage.setItem('cuaderno-docente-student-activity-orders',JSON.stringify(STATE.studentActivityOrders));}catch{}
    const x=window.scrollX,y=window.scrollY;
    render();
    window.scrollTo(x,y);
  }));
  const selectStudent=id=>{
    if(!allStudents().some(student=>student.id===id))return;
    STATE.studentId=id;render();
    $('#student-view-title')?.focus({preventScroll:true});
  };
  document.querySelectorAll('[data-open-student]').forEach(button=>button.addEventListener('click',()=>selectStudent(button.dataset.openStudent)));
  const moveStudent=offset=>{
    const students=allStudents(),index=students.findIndex(student=>student.id===STATE.studentId);
    if(index<0||!students[index+offset])return;
    selectStudent(students[index+offset].id);
  };
  $('#previous-student')?.addEventListener('click',()=>moveStudent(-1));
  $('#next-student')?.addEventListener('click',()=>moveStudent(1));
  $('#hide-student')?.addEventListener('click',()=>{STATE.studentId=null;render();$('#student-list-heading')?.focus({preventScroll:true});});
  $('#return-notebook')?.addEventListener('click',()=>{STATE.tab='cuaderno';STATE.studentId=null;render();});
}
const FINAL_RULE_LABELS={mean:'Media aritmética',weighted_mean:'Media ponderada',latest_if_highest:'Último periodo si es la nota más alta; si no, media'};
function renderFinalEvaluation(){
  const cfg=STATE.doc.finalConfigs.find(c=>c.groupId===STATE.groupId);
  const periods=[...STATE.doc.periods].sort((a,b)=>a.order-b.order);
  const rule=cfg?.rule||'mean';
  const students=allStudents();
  const rows=students.map((student,i)=>{
    const evidence=finalEvidence(STATE.doc,student.id,STATE.groupId);
    return `${originGroupHeader(students,i,periods.length+2)}<tr><td class="name-col"><span>${esc(student.name)}</span>${studentOriginBadge(student)}</td>${evidence.evidence.map(e=>`<td><div class="final-period-cell"><span class="hint">Auto: ${gradeChip(e.automatic)}</span><input class="note-input ${e.manual!==null?'grade-colored':''}" ${e.manual!==null?gradeStyle(e.manual):''} inputmode="decimal" type="text" maxlength="10" data-finalstudent="${esc(student.id)}" data-finalperiod="${esc(e.periodId)}" aria-label="Nota manual de ${esc(student.name)} en ${esc(e.name)}" placeholder="Automática" value="${e.manual===null?'':esc(String(e.manual).replace('.',','))}"/><span class="hint">${e.manual===null?'Usando automática':'Usando manual'}</span></div></td>`).join('')}<td class="final-col"><strong>${gradeChip(evidence.grade)}</strong>${evidence.issue?`<small class="warning-calculation">⚠ Revisa las notas de los periodos.</small>`:''}</td></tr>`;
  }).join('');
  return `<section class="panel panel-pad"><h2>Evaluación final del curso</h2><p class="subtitle">Pestaña independiente de los periodos. Recupera automáticamente la nota final de cada evaluación. Para sustituirla, escribe una nota manual de 0 a 10; deja la casilla vacía para volver a la automática.</p><div class="final-config"><label>Regla final<select id="final-rule">${Object.entries(FINAL_RULE_LABELS).map(([k,v])=>opt(k,v,rule)).join('')}</select></label><div class="final-weights">${periods.map(p=>`<label class="final-weight-block"><span>${esc(p.name)}</span><span class="final-include"><input type="checkbox" data-finalinclude="${esc(p.id)}" ${(cfg?.excludedPeriodIds||[]).includes(p.id)?'':'checked'}/>Incluir en final</span><span class="hint">Peso relativo</span><input type="number" min="0" max="1000" step="any" value="${esc(cfg?.weights?.[p.id]??1)}" data-finalweight="${esc(p.id)}" ${rule==='weighted_mean'?'':'disabled'} /></label>`).join('')}</div></div><p class="hint">Los pesos son relativos, no necesitan sumar 100. Los periodos sin nota o desmarcados se excluyen del cálculo; los pesos solo se usan con media ponderada. Se conserva la precisión completa hasta mostrar el resultado.</p></section><section class="panel"><div class="panel-header"><strong>Resumen anual</strong><span class="hint">${esc(currentGroup().name)}</span></div><div class="student-order-bar">${studentSortControls()}</div><div class="table-scroller"><table class="grade-table final-table"><thead><tr><th class="name-col">Alumno</th>${periods.map(p=>`<th><span class="class-stat-heading">${esc(p.name)} ${classStatButton('annual-period',p.id,p.name)}</span><small>Media final /10</small></th>`).join('')}<th class="final-col"><span class="class-stat-heading">Nota final curso ${classStatButton('course',STATE.groupId,'nota final del curso')}</span></th></tr></thead><tbody>${rows||`<tr><td class="empty-table-message" colspan="${periods.length+2}">No hay alumnos.</td></tr>`}</tbody></table></div></section>`;
}
function bindFinalEvaluation(){
  const groupId=STATE.groupId;
  $('#final-rule').onchange=e=>{
    const rule=e.target.value;
    commit(d=>setFinalConfig(d,groupId,{rule})).catch(fail);
  };
  document.querySelectorAll('[data-finalinclude]').forEach(input=>input.onchange=()=>{
    const id=input.dataset.finalinclude,checked=input.checked;
    commit(d=>{
      const excluded=d.finalConfigs.find(c=>c.groupId===groupId)?.excludedPeriodIds||[];
      const next=excluded.filter(x=>x!==id);
      if(!checked)next.push(id);
      setFinalConfig(d,groupId,{excludedPeriodIds:next});
    }).catch(fail);
  });
  document.querySelectorAll('[data-finalweight]').forEach(input=>input.onchange=()=>{
    const {value}=input,id=input.dataset.finalweight;
    commit(d=>setFinalConfig(d,groupId,{weights:{[id]:parseScore(value)}}))
      .catch(err=>{fail(err);render();});
  });
  document.querySelectorAll('[data-finalstudent][data-finalperiod]').forEach(input=>input.onchange=async e=>{
    const val=e.target.value.trim();try{await commit(d=>setFinalOverride(d,e.target.dataset.finalstudent,e.target.dataset.finalperiod,val===''?null:val.replace(',','.')),'Nota manual de periodo');}catch(err){fail(err);render();}
  });
}

function openCopyActivities(){
  const destinations=[...STATE.doc.periods].sort((a,b)=>a.order-b.order).filter(p=>p.id!==STATE.periodId);
  if(!destinations.length)return toast('Primero crea una segunda evaluación.');
  const source=allAssessments();
  if(!source.length)return toast('No hay actividades en la evaluación actual.');
  dialog.innerHTML=`<form class="modal-inner" id="copy-activities-form"><h2 id="modal-heading">Copiar actividades a otras evaluaciones</h2><p class="subtitle">Se copian ${source.length} actividades de ${esc(currentPeriod().name)}, con sus rúbricas, escalas, pesos y reglas de categorías. <strong>No se copian alumnos, notas ni recuperaciones evaluadas.</strong> Las evaluaciones con actividades no se sobrescriben.</p><div class="copy-targets">${destinations.map(p=>{const count=STATE.doc.assessments.filter(a=>a.groupId===STATE.groupId&&a.periodId===p.id).length;return `<label><input type="checkbox" value="${esc(p.id)}" data-copy-destination ${count?'disabled':'checked'}/><span>${esc(p.name)} ${count?`· ${count} actividades existentes (no se modifican)`:'· Vacía'}</span></label>`;}).join('')}</div><p class="modal-error" role="alert"></p><div class="modal-actions"><button type="button" class="btn" id="cancel-copy">Cancelar</button><button type="submit" class="btn primary">Copiar estructura</button></div></form>`;
  $('#cancel-copy',dialog).onclick=()=>dialog.close();
  $('#copy-activities-form',dialog).onsubmit=async e=>{
    e.preventDefault();const targets=[...dialog.querySelectorAll('[data-copy-destination]:checked')].map(x=>x.value);
    if(!targets.length){$('.modal-error',dialog).textContent='Selecciona al menos una evaluación vacía.';return;}
    try{await commit(d=>copyPeriodAssessments(d,STATE.groupId,STATE.periodId,targets),'Copiar actividades sin notas');dialog.close();toast('Estructura copiada; no se han duplicado calificaciones.');}
    catch(err){$('.modal-error',dialog).textContent=err.message;}
  };
  dialog.showModal();
}
function openAssessmentCreator(){
  if(!STATE.doc.categories.length){toast('Crea primero una categoría desde Cálculos.');return;}
  const kinds=[{id:'',name:'Nota numérica'},...STATE.doc.rubrics.map(r=>({id:r.id,name:'Rúbrica existente: '+r.name})),{id:'__new',name:'Crear rúbrica aquí'}, {id:'__import',name:'Importar rúbrica Excel, CSV o JSON'}];
  dialog.classList.add('activity-modal');dialog.addEventListener('close',()=>dialog.classList.remove('activity-modal'),{once:true});
  dialog.innerHTML=`<form class="modal-inner" id="activity-form"><h2 id="modal-heading">Nueva actividad</h2><p class="subtitle">La nota siempre se normaliza a /10 si lo eliges; una rúbrica se transforma a /10 automáticamente.</p><div class="modal-fields"><label>Nombre de la actividad<input name="name" class="text-field" maxlength="150" required value="Examen"/></label><label>Categoría<select name="categoryId">${visibleCategories().map(c=>opt(c.id,c.name)).join('')}</select></label><details class="activity-disclosure" open><summary><span class="disclosure-symbol" aria-hidden="true">Ⅰ</span> Escala y forma de calificación <span class="disclosure-chevron" aria-hidden="true">⌄</span></summary><div class="activity-disclosure-body"><label>Forma de evaluar<select name="kind" id="activity-kind">${kinds.map(x=>opt(x.id,x.name)).join('')}</select></label><div id="activity-new-rubric" class="activity-rubric-box hidden"><label>Nombre de la nueva rúbrica<input name="rubricName" class="text-field" value="Actitud" maxlength="150"/></label><label>Criterios, uno por línea (criterio; máximo; peso)<textarea name="rubricRows" class="text-field" rows="5" placeholder="Asistencia;2;20
Participación;2;20"></textarea></label></div><div id="activity-import-rubric" class="activity-rubric-box hidden"><label>Archivo de rúbrica (.xlsx, .csv o .json)<input type="file" name="rubricFile" id="activity-rubric-file" accept=".xlsx,.csv,.json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"/></label><p class="hint" id="activity-rubric-preview">Las rúbricas Excel con descriptores Bien/Regular/Mal se pueden importar directamente.</p></div><div id="activity-numeric-options" class="activity-numeric-options"><label>Nota máxima<input name="maxScore" class="text-field" type="number" min="0.01" max="1000" step="any" value="10"/></label><label>Conversión para cálculos<select name="convertToTen"><option value="true">Convertir a 0–10</option><option value="false">Usar la nota bruta</option></select></label></div></div></details><details class="activity-disclosure"><summary><span class="disclosure-symbol" aria-hidden="true">Ⅱ</span> Penalización ortográfica <span class="disclosure-chevron" aria-hidden="true">⌄</span></summary><div class="activity-disclosure-body"><div class="orthography-activity-options" id="activity-orthography"><h3>Faltas de ortografía (opcional)</h3><label>Penalización recuperable<select name="orthEnabled" id="activity-orth-enabled"><option value="false">Desactivada</option><option value="true">Activada</option></select></label><div class="orthography-config-fields"><label>Descuento por falta (sobre 10)<input class="text-field" name="orthRate" type="number" step="0.01" min="0" max="10" value="${esc(STATE.doc.settings.orthographyDefaults?.penaltyPerFault??0.10)}"/></label><label>Copias exigidas por falta<input class="text-field" name="orthCopies" type="number" step="1" min="1" max="1000" value="${esc(STATE.doc.settings.orthographyDefaults?.repetitions??30)}"/></label><label>Devolución al entregar<select name="orthRecoverable"><option value="true">Sí</option><option value="false">No</option></select></label></div><p class="hint">La nota original no se pierde. La penalización se aplica después de convertir a /10; al marcar Entregadas se restaura la nota íntegra.</p></div></div></details><label class="activity-weight">Peso relativo de la actividad<input name="weight" class="text-field" type="number" min="0.01" max="1000" step="any" value="1"/></label></div><p class="modal-error" role="alert"></p><div class="modal-actions"><button type="button" class="btn" id="cancel-activity">Cancelar</button><button type="submit" class="btn primary">Crear actividad</button></div></form>`;
  const form=$('#activity-form',dialog),selector=$('#activity-kind',form);
  const toggle=()=>{
    const k=selector.value;
    $('#activity-new-rubric',form).classList.toggle('hidden',k!=='__new');
    $('#activity-import-rubric',form).classList.toggle('hidden',k!=='__import');
    $('#activity-numeric-options',form).classList.toggle('hidden',!!k);
    $('#activity-orthography',form).classList.toggle('hidden',!!k);
  };
  selector.addEventListener('change',toggle);toggle();
  const categoryInput=form.elements.categoryId,orthSelector=form.elements.orthEnabled;
  const syncCategory=()=>{
    const category=STATE.doc.categories.find(c=>c.id===categoryInput.value);
    const isExam=category?.name?.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()==='examenes';
    orthSelector.value=isExam&&STATE.doc.settings.orthographyDefaults?.enabledForExams?'true':'false';
    form.elements.orthRecoverable.value=String(groupOrthographyRefundable(STATE.doc,STATE.groupId));
  };
  categoryInput.addEventListener('change',syncCategory);syncCategory();
  let preview=null,previewFile=null;
  $('#activity-rubric-file',form).onchange=async e=>{
    preview=null;previewFile=e.target.files[0];
    if(!previewFile)return;
    try{preview=await parseRubricFile(previewFile);$('#activity-rubric-preview',form).textContent=`${preview.name}: ${preview.criteria.length} criterios. Se importarán junto con la actividad.`;$('.modal-error',form).textContent='';}
    catch(err){preview=null;$('.modal-error',form).textContent=err.message;}
  };
  $('#cancel-activity',form).onclick=()=>dialog.close();
  form.onsubmit=async e=>{
    e.preventDefault();const v=Object.fromEntries(new FormData(form));
    const kind=v.kind;
    try{
      let draft=null;
      if(kind==='__new')draft={name:String(v.rubricName??'').trim(),criteria:parseRubricText(v.rubricRows)};
      if(kind==='__import'){
        const file=$('#activity-rubric-file',form).files[0];
        if(!file)throw new Error('Selecciona un Excel, CSV o JSON de rúbrica.');
        draft=file===previewFile&&preview?preview:await parseRubricFile(file);
      }
      const actionName=String(v.name).trim();if(!actionName)throw new Error('Introduce un nombre.');
      const btn=form.querySelector('[type=submit]');btn.disabled=true;
      try{
        await commit(d=>{
          let rubricId=!kind||kind==='__new'||kind==='__import'?null:kind;
          if(draft)rubricId=createRubric(d,draft.name,draft.criteria).id;
          const orthography=rubricId?null:{enabled:v.orthEnabled==='true',penaltyPerFault:parseScore(v.orthRate),repetitions:Number(v.orthCopies),refundable:v.orthRecoverable==='true'};
          addAssessment(d,{name:actionName,groupId:STATE.groupId,periodId:STATE.periodId,categoryId:v.categoryId,maxScore:rubricId?10:Number(v.maxScore),weight:Number(v.weight),convertToTen:rubricId?true:v.convertToTen==='true',rubricId,orthography});
        },'Crear actividad');
        dialog.close();toast('Actividad añadida al cuaderno.');
      }finally{btn.disabled=false;}
    }catch(err){$('.modal-error',form).textContent=err.message;}
  };
  dialog.showModal();form.querySelector('[name=name]')?.focus();
}
function bindCommon(){
  document.querySelectorAll('[data-shell-disclosure]').forEach(details=>details.addEventListener('toggle',()=>{
    const key=details.dataset.shellDisclosure;
    if(Object.prototype.hasOwnProperty.call(workspaceDisclosures,key))workspaceDisclosures[key]=details.open;
  }));

  $('#student-sort-mode')?.addEventListener('change',event=>setStudentSort(event.target.value));
  $('#student-group-mode')?.addEventListener('change',event=>{
    setStudentSort(event.target.checked?'originGroup':STATE.studentPlainSort);
  });
  $('#toggle-navigation')?.addEventListener('click',()=>{
    STATE.navCollapsed=!STATE.navCollapsed;
    $('.shell')?.classList.toggle('nav-collapsed',STATE.navCollapsed);
    $('#toggle-navigation')?.setAttribute('aria-expanded',String(!STATE.navCollapsed));
    try{localStorage.setItem('cuaderno-docente-nav-collapsed',STATE.navCollapsed?'yes':'no');}catch{}
  });
  $('#theme-select')?.addEventListener('change',e=>{
    const theme=e.target.value;
    if(!['light','dark','oled'].includes(theme))return;
    STATE.theme=theme;
    try{localStorage.setItem('cuaderno-docente-theme',theme);}catch{}
    applyTheme();
  });
  $('#open-notebook')?.addEventListener('click',()=>$('#open-notebook-file').click());
  $('#open-notebook-file')?.addEventListener('change',async e=>{try{const f=e.target.files[0];e.target.value='';if(f)await restoreBackup(f);}catch(err){fail(err);}});
  $('#close-notebook')?.addEventListener('click',()=>closeNotebook().catch(fail));
  $('#lock').onclick=()=>enqueueMutation(()=>{if(STATE.saveError)throw new Error('Exporta el intento cifrado si está disponible antes de cerrar.');showUnlock(false);}).catch(fail);
  $('#undo-change')?.addEventListener('click',()=>navigateHistory('undo').catch(fail));
  $('#redo-change')?.addEventListener('click',()=>navigateHistory('redo').catch(fail));
  document.querySelectorAll('[data-course-level][data-course-subject]').forEach(button=>{
    // Las propiedades asignadas mediante CSSOM respetan la CSP del HTML autonomo.
    const level=button.dataset.courseLevel,subject=button.dataset.courseSubject;
    button.style.setProperty('--course-accent',level==='legacy'?'#927B59':colorFor(level,subject));
    button.onclick=()=>{
    const {courseLevel:level,courseSubject:subject}=button.dataset;
    if(level===STATE.level&&subject===STATE.subject)return;
    if(level==='legacy'?!STATE.doc.groups.some(g=>g.level===null&&g.subject===subject):!validSubject(level,subject,STATE.doc))return;
    setSubjectChoice(level,subject);
    [...document.querySelectorAll('[data-course-level][data-course-subject]')]
      .find(b=>b.dataset.courseLevel===level&&b.dataset.courseSubject===subject)?.focus({preventScroll:true});
    };
  });
  document.querySelectorAll('[data-group-choice]').forEach(button=>{
    button.onclick=()=>{
      const groupId=button.dataset.groupChoice;
      if(groupId===STATE.groupId||!groupsForSubject().some(g=>g.id===groupId))return;
      STATE.groupId=groupId;STATE.competencyVersion='auto';
      render();
      [...document.querySelectorAll('[data-group-choice]')].find(x=>x.dataset.groupChoice===groupId)?.focus({preventScroll:true});
    };
  });
  document.querySelectorAll('[data-focus-original]').forEach(button=>button.onclick=()=>{
    const pair=button.dataset.focusOriginal;
    const fields=[...document.querySelectorAll('input[data-assessment][data-student]')];
    const input=fields.find(f=>f.dataset.assessment+':'+f.dataset.student===pair);
    input?.focus();input?.select();
  });
  document.querySelectorAll('[data-period-choice]').forEach(b=>{
    b.onclick=()=>{STATE.periodId=b.dataset.periodChoice;STATE.tab='cuaderno';render();};
    b.ondblclick=event=>{event.preventDefault();renamePeriodFromTab(b.dataset.periodChoice);};
  });
  document.querySelectorAll('[data-rename-period]').forEach(b=>b.onclick=()=>renamePeriodFromTab(b.dataset.renamePeriod));
  $('[data-final-choice]')?.addEventListener('click',()=>{STATE.tab='final';render();});
  $('#accent-select')?.addEventListener('change',e=>commit(d=>setSubjectAccent(d,STATE.level,STATE.subject,e.target.value)).catch(fail));
  document.querySelectorAll('[data-academic-quick]').forEach(button=>button.addEventListener('click',()=>{
    const destination=button.dataset.academicQuick;
    if(!['cuaderno','calculos','competencias'].includes(destination)||!STATE.groupId)return;
    STATE.tab=destination;render();
  }));
  document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{if(STATE.tab==='alumno'&&b.dataset.tab!=='alumno')STATE.studentId=null;if(b.dataset.tab==='curriculo'&&currentGroup()?.subject==='Latín II')STATE.curriculumVersion=officialCompetenciesForGroup(currentGroup(),STATE.competencyVersion)?.version||'2022';STATE.tab=b.dataset.tab;render();});
  $('#edit-group')?.addEventListener('click',openGroupTools);
  $('#manage-subjects')?.addEventListener('click',openSubjectsManager);

  function openSubjectsManager(){
    const list=catalogForNotebook(STATE.doc).flatMap(({level,label,subjects})=>subjects.map(subject=>({level,label,subject})));
    const hidden=Object.entries(COURSE_SUBJECTS).flatMap(([level,entry])=>entry.subjects
      .filter(subject=>!validSubject(level,subject,STATE.doc)).map(subject=>({level,subject,label:entry.label})));
    dialog.innerHTML=`<div class="modal-inner subject-manager"><h2 id="modal-heading">Gestionar materias</h2>
      <p class="subtitle">Las cinco materias originales vienen incluidas. Añade otras o retira las que no utilices; nunca se borran alumnos, notas ni grupos.</p>
      <div class="subject-manager-list">${list.map(x=>`<div class="subject-manager-row"><span><strong>${esc(x.subject)}</strong><small>${esc(x.label)}</small></span>
        <button class="btn small warn" type="button" data-remove-subject="${esc(subjectKey(x.level,x.subject))}">Retirar</button></div>`).join('')}</div>
      <h3>Añadir materia</h3><form id="subject-manager-create">
       <div class="subject-manager-fields"><label>Etapa<select name="level">${Object.entries(COURSE_SUBJECTS).map(([level,x])=>opt(level,x.label)).join('')}</select></label>
       <label>Materia<input class="text-field" name="subject" maxlength="65" required placeholder="Ej. Historia o Atención Educativa"/></label>
       <label>Color<input type="color" name="color" value="#64748B"/></label></div>
       <div class="modal-error" role="alert"></div><div class="modal-actions"><button type="button" class="btn" id="subject-manager-close">Cerrar</button>
       <button type="submit" class="btn primary">+ Añadir materia</button></div>
      </form>
      ${hidden.length?`<p class="hint">Materias predeterminadas retiradas: ${hidden.map(x=>esc(x.subject)).join(', ')}. Para recuperarlas, escribe exactamente su nombre en la etapa correspondiente.</p>`:''}
      <p class="hint">Por seguridad, no puedes retirar una materia mientras tenga grupos asociados. Gestiona o elimina esos grupos explícitamente antes.</p></div>`;
    dialog.querySelector('#subject-manager-close').onclick=()=>dialog.close();
    dialog.querySelectorAll('[data-remove-subject]').forEach(button=>button.onclick=async()=>{
      const key=button.dataset.removeSubject,pivot=key.indexOf(':'),level=key.slice(0,pivot),subject=key.slice(pivot+1);
      if(!window.confirm('¿Retirar «'+subject+'» de los botones? No se eliminará ningún grupo ni calificación.'))return;
      try{
        await commit(doc=>removeNotebookSubject(doc,level,subject),'Retirar materia');
        if(STATE.level===level&&STATE.subject===subject){
          const first=catalogForNotebook(STATE.doc).flatMap(x=>x.subjects.map(subject=>({level:x.level,subject})))[0];
          STATE.level=first.level;STATE.subject=first.subject;STATE.groupId=null;
        }
        dialog.close();render();
      }catch(error){dialog.querySelector('.modal-error').textContent=error.message;}
    });
    dialog.querySelector('#subject-manager-create').onsubmit=async event=>{
      event.preventDefault();const form=event.currentTarget,values=Object.fromEntries(new FormData(form));
      try{
        await commit(doc=>addNotebookSubject(doc,values.level,values.subject,values.color),'Añadir materia');
        STATE.level=values.level;STATE.subject=values.subject;STATE.groupId=null;
        dialog.close();render();
      }catch(error){form.querySelector('.modal-error').textContent=error.message;}
    };
    dialog.showModal();
  }
  $('#new-group').onclick=()=>{
    if(!validSubject(STATE.level,STATE.subject,STATE.doc))return toast('Selecciona primero un curso y asignatura.');
    fieldsModal(`Nuevo grupo · ${STATE.subject}`,[{id:'name',label:'Nombre del grupo',value:'Grupo A'},{id:'course',label:'Curso escolar',value:'2026-2027'}],async v=>{
      let group;await commit(d=>{group=addGroup(d,v.name,STATE.subject,v.course,STATE.level);});STATE.groupId=group.id;render();
    },`Asignatura: ${COURSE_SUBJECTS[STATE.level].label} · ${STATE.subject}.`);
  };
  $('#classify-group')?.addEventListener('click',()=>fieldsModal('Clasificar grupo anterior',[{id:'pair',label:'Curso y asignatura',type:'select',options:pairOptions()}],async v=>{
    const [level,...parts]=v.pair.split(':');const subject=parts.join(':');const groupId=STATE.groupId;
    await commit(d=>classifyGroup(d,groupId,level,subject));STATE.level=level;STATE.subject=subject;STATE.groupId=groupId;render();
  },'No se modificará ningún alumno, actividad o calificación.'));
  $('#new-period')?.addEventListener('click',()=>fieldsModal('Nuevo periodo',[{id:'name',label:'Nombre del periodo',value:`${STATE.doc.periods.length+1}.ª evaluación`}],async v=>{let p;await commit(d=>{p=addPeriod(d,v.name);});STATE.periodId=p.id;STATE.tab='cuaderno';render();}));
  $('#new-assessment')?.addEventListener('click',openAssessmentCreator);
  $('#new-recovery').onclick=()=>{
    const candidates=allAssessments().filter(a=>!a.recoveryOf&&!STATE.doc.assessments.some(x=>x.recoveryOf===a.id));
    if(!candidates.length)return toast('Primero crea una actividad sin recuperación vinculada.');
    fieldsModal('Nueva recuperación',[{id:'name',label:'Nombre',value:'Recuperación'},{id:'recoveryOf',label:'Actividad de origen',type:'select',options:candidates.map(a=>({value:a.id,label:a.name}))},{id:'recoveryMode',label:'Cómo sustituye la nota',type:'select',options:[{value:'higher',label:'Solo si mejora la original'},{value:'replace',label:'Sustituir siempre'}]},{id:'maxScore',label:'Puntuación máxima',type:'number',value:10,min:0.01,max:1000,step:'any'}],async v=>commit(d=>{
      const source=d.assessments.find(a=>a.id===v.recoveryOf);
      addAssessment(d,{name:v.name,groupId:STATE.groupId,periodId:STATE.periodId,categoryId:source.categoryId,maxScore:Number(v.maxScore),weight:source.weight,convertToTen:source.convertToTen,recoveryOf:v.recoveryOf,recoveryMode:v.recoveryMode,orthography:source.orthography??null});
    }));
  };
  $('#csv-import').onclick=()=>$('#csv-file').click();
  $('#csv-file').onchange=async e=>{
    const file=e.target.files[0],group=currentGroup();if(!file||!group)return;
    try{
      const students=studentsFromCsv(await file.text());
      if(!window.confirm(`Importar ${students.length} alumnos a ${group.name}? Se admiten columnas «apellidos;nombre;grupo». El CSV antiguo de solo «nombre» se conserva sin deducir los apellidos. No se fusionan automáticamente duplicados.`))return;
      await commit(d=>students.forEach(student=>addStudent(d,group.id,student)));
      toast(`${students.length} alumnos importados localmente.`);
    }catch(err){fail(err);}finally{e.target.value='';}
  };
}
function openGroupTools(){
  const g=currentGroup();if(!g)return;
  dialog.innerHTML=`<div class="modal-inner"><h2>Gestión de grupo</h2><p class="subtitle">${esc(g.name)} · ${esc(g.course)}. Los cambios conservan los IDs, las notas y los cálculos.</p><div class="tool-actions"><button type="button" class="btn primary" id="rename-group-btn">Editar nombre y curso escolar</button><button type="button" class="btn" id="group-orth-refund-btn">Devolución de faltas: ${groupOrthographyRefundable(STATE.doc,g.id)?'Sí':'No'}</button></div><p class="hint">Se aplica a las actividades con penalización de este grupo y a los exámenes nuevos. No altera otros grupos ni las notas originales.</p><div class="modal-actions"><button type="button" class="btn" id="close-group-tools">Cerrar</button></div></div>`;
  $('#close-group-tools',dialog).onclick=()=>dialog.close();
  $('#rename-group-btn',dialog).onclick=()=>{dialog.close();fieldsModal('Editar grupo',[{id:'name',label:'Nombre',value:g.name},{id:'course',label:'Curso escolar (año académico)',value:g.course}],async v=>commit(d=>updateGroupInfo(d,g.id,v.name,v.course)));};
  $('#group-orth-refund-btn',dialog).onclick=()=>{
    dialog.close();
    fieldsModal('Devolución de nota por faltas · '+g.name,[
      {id:'refundable',label:'¿Se devuelve la nota al entregar las faltas?',type:'select',
        value:String(groupOrthographyRefundable(STATE.doc,g.id)),
        options:[{value:'true',label:'Sí, recuperar la nota'}, {value:'false',label:'No, la penalización es definitiva'}]}
    ],async values=>commit(d=>setGroupOrthographyRefundable(d,g.id,values.refundable==='true'),'Devolución de faltas del grupo'),
    'Afectará a todos los exámenes con penalización del grupo, también a los nuevos. Si alguna nota ya se ha recuperado por entrega, no se permitirá quitar la devolución sin revisar antes ese caso.');
  };
  dialog.showModal();
}
function renamePeriodFromTab(id){
  const p=STATE.doc.periods.find(p=>p.id===id);if(!p)return;
  fieldsModal(`Renombrar ${p.name}`,[{id:'name',label:'Nombre del período',value:p.name}],async v=>{
    await commit(d=>renamePeriod(d,id,v.name));
  },'Las actividades, calificaciones y ponderaciones conservarán sus identificadores.');
  // La organización anterior se mantiene sin un botón adicional fuera de la barra.
  const actions=$('.modal-actions',dialog),periods=[...STATE.doc.periods].sort((a,b)=>a.order-b.order),i=periods.findIndex(x=>x.id===id);
  for(const [step,label] of [[-1,'↑ Anterior'],[1,'↓ Siguiente']]){
    const b=document.createElement('button');b.type='button';b.className='btn small';b.textContent=label;b.disabled=i+step<0||i+step>=periods.length;
    b.onclick=async()=>{
      if(!window.confirm('Reordenar los períodos afecta a las reglas que dependen de la última evaluación. ¿Continuar?'))return;
      dialog.close();try{await commit(d=>movePeriod(d,id,step),'Reordenar períodos');}catch(err){fail(err);}
    };actions.prepend(b);
  }
}
function openPeriodTools(){
  const p=currentPeriod();if(!p)return;
  dialog.innerHTML=`<div class="modal-inner"><h2>Gestión de periodos</h2><p class="subtitle">${esc(p.name)}. Cambiar el orden también puede afectar a la regla «última evaluación» de la nota anual.</p><div class="tool-actions"><button type="button" class="btn primary" id="rename-period-btn">Renombrar periodo</button><button type="button" class="btn" data-move-period="-1">↑ Anterior</button><button type="button" class="btn" data-move-period="1">↓ Siguiente</button></div><div class="modal-actions"><button type="button" class="btn" id="close-period-tools">Cerrar</button></div></div>`;
  $('#close-period-tools',dialog).onclick=()=>dialog.close();
  $('#rename-period-btn',dialog).onclick=()=>{dialog.close();fieldsModal('Renombrar periodo',[{id:'name',label:'Nombre del periodo',value:p.name}],async v=>commit(d=>renamePeriod(d,p.id,v.name)));};
  dialog.querySelectorAll('[data-move-period]').forEach(b=>b.onclick=async()=>{if(!window.confirm('El orden de los periodos interviene en las reglas de última evaluación. ¿Continuar?'))return;dialog.close();try{await commit(d=>movePeriod(d,p.id,Number(b.dataset.movePeriod)),'Reordenar periodos');}catch(err){fail(err);}});
  dialog.showModal();
}
function openStudentTools(studentId){
  const student=STATE.doc.students.find(s=>s.id===studentId&&s.groupId===STATE.groupId);if(!student)return;
  const n=STATE.doc.grades.filter(g=>g.studentId===studentId).length;
  dialog.innerHTML=`<div class="modal-inner"><h2>${esc(student.name)}</h2><p class="subtitle">${n} calificaciones registradas en todos los periodos.</p><div class="tool-actions"><button class="btn primary" id="rename-student-btn">Editar nombre, apellidos y procedencia</button><button class="btn" data-move-student="-1" ${STATE.studentSort==='manual'?'':'disabled title="Activa orden manual para mover alumnos"'}>↑ Subir</button><button class="btn" data-move-student="1" ${STATE.studentSort==='manual'?'':'disabled title="Activa orden manual para mover alumnos"'}>↓ Bajar</button><button class="btn warn" id="remove-student-btn">Eliminar alumno y sus notas</button></div><div class="modal-actions"><button class="btn" id="close-student-tools">Cerrar</button></div></div>`;
  $('#close-student-tools',dialog).onclick=()=>dialog.close();
  $('#rename-student-btn',dialog).onclick=()=>{dialog.close();fieldsModal('Editar alumno',[
    {id:'lastName',label:'Apellidos',value:student.lastName||'',maxlength:100},
    {id:'firstName',label:'Nombre',value:student.firstName||student.name,maxlength:80},
    {id:'originGroup',label:'Grupo de procedencia (p. ej., 1.º A)',value:student.originGroup||'',maxlength:60,required:false}
  ],async v=>commit(d=>updateStudentIdentity(d,studentId,{firstName:v.firstName,lastName:v.lastName,originGroup:v.originGroup})),
  student.lastName?'No se modificarán las notas ni el grupo de la asignatura.':'Registro anterior sin apellidos separados: complétalos manualmente; no se infieren del nombre histórico.');};
  dialog.querySelectorAll('[data-move-student]').forEach(b=>b.onclick=async()=>{dialog.close();try{await commit(d=>moveStudent(d,studentId,Number(b.dataset.moveStudent)),'Reordenar alumno');}catch(err){fail(err);}});
  $('#remove-student-btn',dialog).onclick=async()=>{
    if(!window.confirm(`Eliminar a «${student.name}», sus ${n} notas y las sustituciones manuales de evaluación final. Podrás deshacerlo en esta sesión. ¿Continuar?`))return;
    dialog.close();try{await commit(d=>removeStudent(d,studentId),'Eliminar alumno y notas');if(STATE.studentId===studentId)STATE.studentId=null;toast('Alumno eliminado. Usa Deshacer para recuperarlo.');}catch(err){fail(err);}
  };
  dialog.showModal();
}
/** Desde una columna se usa automáticamente el año académico del grupo, sin mezclar calendarios. */
async function openPlannerExam(assessmentId=null){
 const group=currentGroup();if(!group)return toast('Selecciona primero un grupo.');
 try{
  const name=group.course.trim();let year=STATE.doc.planner.years.find(y=>y.name===name);
  if(!year){
   const parsed=/^(\d{4})-(\d{4})$/.exec(name);
   if(!parsed||Number(parsed[2])!==Number(parsed[1])+1)throw new Error('Configura primero el año académico correspondiente desde Planificador.');
   const start=`${parsed[1]}-09-01`,end=`${parsed[2]}-06-30`;
   await commit(d=>addAcademicYear(d,{name,start,end}),'Crear calendario para el curso del grupo');
   year=activeYear(STATE.doc);
  }else if(activeYear(STATE.doc).id!==year.id){
   await commit(d=>setActiveYear(d,year.id),'Seleccionar calendario del grupo');
  }
  if(STATE.plannerDate<year.start||STATE.plannerDate>year.end)STATE.plannerDate=localToday()>=year.start&&localToday()<=year.end?localToday():year.start;
  STATE.plannerEventRequest={assessmentId,groupId:group.id,date:STATE.plannerDate};
  STATE.tab='planificador';render();
 }catch(error){fail(error);}
}
/** Editor de examen: conserva la nota bruta y presenta la calificación efectiva /10. */
function openOrthographyGrade(studentId,assessmentId){
  const assessment=STATE.doc.assessments.find(a=>a.id===assessmentId);
  const student=STATE.doc.students.find(s=>s.id===studentId&&s.groupId===assessment?.groupId);
  if(!student||!assessment?.orthography?.enabled)return toast('La penalización no está disponible en esta actividad.');
  const current=STATE.doc.grades.find(g=>g.studentId===studentId&&g.assessmentId===assessmentId);
  const config=assessment.orthography;
  dialog.innerHTML=`<form class="modal-inner orthography-dialog" id="orthography-form"><h2 id="modal-heading">${esc(assessment.name)}</h2><p class="subtitle">${esc(student.name)}${current?.notSubmitted?' · No presentado':''} · La nota sin faltas se conserva por separado.</p><div class="modal-fields"><label>Nota original sin faltas (sobre ${esc(rawFmt(assessment.maxScore))})<input class="text-field" id="orth-base" type="text" inputmode="decimal" maxlength="12" autocomplete="off" placeholder="8,50" value="${current&&!current.notSubmitted?esc(rawFmt(current.score)):''}"/></label><label>Número de faltas<input class="text-field" id="orth-count" type="number" min="0" max="1000" step="1" value="${current?.orthographyFaults??0}"/></label><div class="orthography-preview" role="status" aria-live="polite"><div class="cardline"><span>Penalización</span><strong id="orth-discount">—</strong></div><div class="cardline"><strong>Nota que computa /10</strong><span id="orth-effective" class="grade-chip">—</span></div></div><label class="orthography-delivered"><input id="orth-delivered" type="checkbox" ${current?.orthographyDelivered?'checked':''}/> <strong>Entregadas</strong> — faltas copiadas ${esc(config.repetitions)} veces cada una</label><p class="hint">${config.refundable?'Al marcar «Entregadas», se restaura automáticamente la nota sin penalización.':'En este examen, la devolución de la nota está desactivada.'} Se descuentan ${esc(rawFmt(config.penaltyPerFault))} puntos por falta sobre diez (mínimo 0).</p></div><div class="modal-error" role="alert"></div><div class="modal-actions"><button class="btn" type="button" id="cancel-orthography">Cancelar</button><button class="btn primary" type="submit">Guardar nota</button></div></form>`;
  const form=$('#orthography-form',dialog),base=$('#orth-base',form),count=$('#orth-count',form),delivered=$('#orth-delivered',form),discount=$('#orth-discount',form),effective=$('#orth-effective',form);
  const refresh=()=>{
    const faults=Number(count.value);
    const validFaults=/^\d{1,4}$/.test(count.value)&&faults<=1000;
    delivered.disabled=!config.refundable||!validFaults||faults===0||!base.value.trim();
    if(delivered.disabled)delivered.checked=false;
    let val;
    try{val=base.value.trim()===''?null:parseScore(base.value);if(val!==null&&(val<0||val>assessment.maxScore))throw new Error('Nota fuera de escala.');}catch{val=null;}
    if(val===null||!validFaults){effective.textContent='—';discount.textContent='—';effective.removeAttribute('data-grade-value');effective.style.removeProperty('--grade-bg');effective.style.removeProperty('--grade-fg');return;}
    const candidate={score:val,orthographyFaults:faults,orthographyDelivered:delivered.checked};
    const result=effectiveAssessmentScore(STATE.doc,assessment,candidate),deduct=orthographyPenalty(assessment,candidate);
    discount.textContent=deduct?`−${penaltyFmt(deduct)}`:'0,00';
    effective.textContent=gradeFmt(result);effective.dataset.gradeValue=String(result);paintGrades(form);
  };
  base.addEventListener('input',refresh);
  count.addEventListener('input',()=>{delivered.checked=false;refresh();});
  delivered.addEventListener('change',refresh);
  $('#cancel-orthography',form).onclick=()=>dialog.close();
  form.onsubmit=async e=>{
    e.preventDefault();const submit=$('[type=submit]',form);submit.disabled=true;
    try{await commit(d=>setOrthographyGrade(d,studentId,assessmentId,{score:base.value.trim(),faults:count.value,delivered:delivered.checked}),'Calificar examen con faltas');dialog.close();}
    catch(err){$('.modal-error',form).textContent=err.message;submit.disabled=false;}
  };
  refresh();dialog.showModal();base.focus();
}
function openAssessmentTools(id){
  const a=STATE.doc.assessments.find(x=>x.id===id);if(!a)return;
  const grades=STATE.doc.grades.filter(g=>g.assessmentId===id).length;
  dialog.innerHTML=`<div class="modal-inner"><h2 id="modal-heading">${esc(a.name)}</h2><p class="subtitle">${grades} notas registradas · ${a.recoveryOf?'Recuperación':'Actividad normal'}</p><div class="tool-actions"><button class="btn" id="edit-assessment">Editar datos</button><button class="btn" id="move-left">← Mover a la izquierda</button><button class="btn" id="move-right">Mover a la derecha →</button><button class="btn" id="plan-assessment">▣ Programar examen</button><button class="btn warn" id="delete-assessment">Eliminar actividad</button></div><div class="modal-actions"><button class="btn primary" id="dismiss-tools">Cerrar</button></div></div>`;
  $('#dismiss-tools',dialog).onclick=()=>dialog.close();
  $('#edit-assessment',dialog).onclick=()=>{
    dialog.close();fieldsModal('Editar actividad',[{id:'name',label:'Nombre',value:a.name},{id:'categoryId',label:'Categoría',type:'select',value:a.categoryId,options:visibleCategories().map(c=>({value:c.id,label:c.name}))},{id:'maxScore',label:'Nota máxima',type:'number',value:a.maxScore,min:0.01,max:1000,step:'any'},{id:'convertToTen',label:'Conversión para cálculos',type:'select',value:String(a.convertToTen),options:[{value:'true',label:'Convertir a 0–10'},{value:'false',label:'Usar nota bruta'}]},{id:'rubricId',required:false,label:'Tipo de evaluación',type:'select',value:a.rubricId||'',options:[{value:'',label:'Nota numérica'},...STATE.doc.rubrics.map(r=>({value:r.id,label:'Rúbrica: '+r.name}))]},{id:'weight',label:'Peso relativo de la actividad',type:'number',value:a.weight,min:0.01,max:1000,step:'any'},
      {id:'orthEnabled',label:'Penalización por faltas',type:'select',value:String(a.orthography?.enabled??false),options:[{value:'false',label:'Desactivada'},{value:'true',label:'Activada'}]},
      {id:'orthRate',label:'Puntos por falta (sobre 10)',type:'number',value:a.orthography?.penaltyPerFault??STATE.doc.settings.orthographyDefaults?.penaltyPerFault??0.1,min:0,max:10,step:'0.01'},
      {id:'orthCopies',label:'Copias exigidas por falta',type:'number',value:a.orthography?.repetitions??STATE.doc.settings.orthographyDefaults?.repetitions??30,min:1,max:1000,step:'1'},
      {id:'orthRecoverable',label:'Recuperar nota al entregar',type:'select',value:String(a.orthography?.refundable??true),options:[{value:'true',label:'Sí'},{value:'false',label:'No'}]}],async v=>{
      const newMax=v.rubricId?10:Number(v.maxScore),newConvert=v.rubricId?true:v.convertToTen==='true';
      if(grades&&(newMax!==a.maxScore||newConvert!==a.convertToTen)&&!window.confirm(`Esta columna tiene ${grades} notas. Cambiar la escala o conversión modificará las medias calculadas, aunque se conserven las puntuaciones originales. ¿Continuar?`))return;
      const orthography={enabled:v.orthEnabled==='true',penaltyPerFault:parseScore(v.orthRate),repetitions:Number(v.orthCopies),refundable:v.orthRecoverable==='true'};
      if(a.orthography?.enabled&&!orthography.enabled&&STATE.doc.grades.some(g=>g.assessmentId===a.id&&g.orthographyFaults>0)&&!window.confirm('Esta columna tiene faltas registradas. Se conservarán, pero dejarán de descontar mientras la penalización esté desactivada. ¿Continuar?'))return;
      if(a.orthography?.enabled&&orthography.enabled&&a.orthography.penaltyPerFault!==orthography.penaltyPerFault&&
        STATE.doc.grades.some(g=>g.assessmentId===a.id&&g.orthographyFaults>0&&!g.orthographyDelivered)&&
        !window.confirm('Cambiar el descuento por falta recalculará todas las notas de este examen que tengan faltas pendientes, sin modificar las notas originales. ¿Confirmas el cambio?'))return;
      // Nunca desmarcar automáticamente entregas de alumnos al cambiar una
      // preferencia del examen. Revisarlas es una decisión individual del docente.
      if(!orthography.refundable&&STATE.doc.grades.some(g=>g.assessmentId===a.id&&g.orthographyDelivered))
        throw new Error('Hay faltas marcadas como entregadas. Desmárcalas individualmente, si procede, antes de desactivar la devolución. No se ha modificado ninguna entrega ni nota.');
      await commit(d=>updateAssessment(d,a.id,{name:v.name,categoryId:v.categoryId,maxScore:newMax,weight:Number(v.weight),convertToTen:newConvert,rubricId:v.rubricId||null,orthography}));
    });
  };
  $('#move-left',dialog).onclick=async()=>{dialog.close();try{await commit(d=>moveAssessment(d,id,-1));}catch(err){fail(err);}};
  $('#move-right',dialog).onclick=async()=>{dialog.close();try{await commit(d=>moveAssessment(d,id,1));}catch(err){fail(err);}};
  $('#plan-assessment',dialog).onclick=()=>{dialog.close();openPlannerExam(id);};
  $('#delete-assessment',dialog).onclick=async()=>{
    if(!window.confirm(`Eliminar «${a.name}» y sus ${grades} calificaciones. Podrás deshacerlo durante esta sesión. ¿Continuar?`))return;
    dialog.close();try{await commit(d=>removeAssessment(d,id),'Eliminar actividad');toast('Actividad eliminada.');}catch(err){fail(err);}
  };
  dialog.showModal();
}
function openItacaStudentRule(studentId){
  const student=STATE.doc.students.find(s=>s.id===studentId&&s.groupId===STATE.groupId);
  if(!student)return;
  const periodId=STATE.periodId,groupId=STATE.groupId;
  const before=overallGrade(STATE.doc,studentId,groupId,periodId);
  const selected=itacaStudentRule(STATE.doc,studentId,periodId);
  const options=[['general',`Aplicar norma general (${ITACA_OPTIONS.find(([key])=>key===itacaGroupRule(STATE.doc,groupId))?.[1]})`],...ITACA_OPTIONS];
  dialog.innerHTML=`<form class="modal-inner" id="itaca-student-form"><h2 id="modal-heading">Nota Ítaca · ${esc(student.name)}</h2><p class="subtitle">${esc(currentPeriod().name)}. La media permanece inalterada; solo cambia la nota de presentación para Ítaca.</p><label>Regla individual<select name="itacaRule">${options.map(([key,label])=>opt(key,label,selected)).join('')}</select></label><div class="cardline"><span>Media original</span><strong>${gradeChip(before)}</strong></div><div class="cardline"><span>Nota Ítaca</span><strong id="itaca-preview">${itacaChip(STATE.doc,studentId,groupId,periodId)}</strong></div><div class="modal-actions"><button type="button" class="btn" id="itaca-cancel">Cancelar</button><button class="btn primary" type="submit">Guardar</button></div></form>`;
  const form=$('#itaca-student-form',dialog);
  form.elements.itacaRule.onchange=()=>{
    const sample=structuredClone(STATE.doc);
    setItacaStudentRule(sample,studentId,periodId,form.elements.itacaRule.value);
    $('#itaca-preview',dialog).innerHTML=itacaChip(sample,studentId,groupId,periodId);
  };
  $('#itaca-cancel',dialog).onclick=()=>dialog.close();
  form.onsubmit=async e=>{e.preventDefault();try{
    const rule=form.elements.itacaRule.value;
    await commit(d=>setItacaStudentRule(d,studentId,periodId,rule),'Redondeo individual Nota Ítaca');
    if(dialog.open)dialog.close();
  }catch(err){fail(err);}};
  dialog.showModal();
}
function bindNotebook(){
  $('#itaca-general-rule')?.addEventListener('change',e=>{
    const groupId=STATE.groupId;
    commit(doc=>setItacaGroupRule(doc,groupId,e.target.value),'Redondeo general Nota Ítaca').catch(fail);
  });
  document.querySelectorAll('[data-itaca-student]').forEach(button=>button.onclick=()=>openItacaStudentRule(button.dataset.itacaStudent));
  $('#copy-structure')?.addEventListener('click',openCopyActivities);
  $('#schedule-exam')?.addEventListener('click',()=>openPlannerExam());
  document.querySelectorAll('[data-view-student]').forEach(b=>b.onclick=()=>{STATE.studentId=b.dataset.viewStudent;STATE.tab='alumno';render();});
  document.querySelectorAll('[data-edit-student]').forEach(b=>b.onclick=()=>openStudentTools(b.dataset.editStudent));
  document.querySelectorAll('[data-observation-student]').forEach(b=>b.onclick=()=>openGradeObservation(b.dataset.observationStudent,b.dataset.observationAssessment));
  document.querySelectorAll('[data-rubric-grade]').forEach(b=>b.onclick=()=>openRubricGrade(b.dataset.rubricStudent,b.dataset.rubricGrade));
  document.querySelectorAll('[data-orthography-grade]').forEach(b=>b.onclick=()=>openOrthographyGrade(b.dataset.orthographyStudent,b.dataset.orthographyGrade));
  document.querySelectorAll('[data-aj-student]').forEach(button=>button.onclick=async()=>{
    const {ajStudent:studentId,ajAssessment:assessmentId}=button.dataset;
    const enabled=button.getAttribute('aria-pressed')!=='true';
    const scroller=$('.table-scroller'),left=scroller?.scrollLeft||0,top=scroller?.scrollTop||0;
    button.disabled=true;
    try{await commit(doc=>setPendingJustified(doc,studentId,assessmentId,enabled),enabled?'Marcar ausencia justificada pendiente':'Reactivar nota anterior');}
    catch(error){fail(error);}
    finally{const table=$('.table-scroller');if(table){table.scrollLeft=left;table.scrollTop=top;}}
  });
  document.querySelectorAll('[data-np-student]').forEach(button=>button.onclick=async()=>{
    const {npStudent:studentId,npAssessment:assessmentId}=button.dataset;
    const enabled=button.getAttribute('aria-pressed')!=='true';
    const scroller=$('.table-scroller');
    const left=scroller.scrollLeft,top=scroller.scrollTop;
    button.disabled=true;
    try{
      await commit(d=>{
        const grade=d.grades.find(g=>g.studentId===studentId&&g.assessmentId===assessmentId);
        if(enabled&&grade&&!grade.notSubmitted&&!window.confirm('¿Sustituir la calificación registrada por «No presentado»? Podrás deshacer el cambio en esta sesión.'))return;
        setNotSubmitted(d,studentId,assessmentId,enabled);
      },enabled?'Marcar no presentado':'Quitar no presentado');
    }catch(err){fail(err);}
    finally{
      button.disabled=false;
      const replacement=[...document.querySelectorAll('[data-np-student]')].find(b=>b.dataset.npStudent===studentId&&b.dataset.npAssessment===assessmentId);
      if(replacement){const table=$('.table-scroller');table.scrollLeft=left;table.scrollTop=top;replacement.focus({preventScroll:true});}
    }
  });
  $('#new-student').onclick=()=>fieldsModal('Añadir alumno',[
    {id:'lastName',label:'Apellidos',value:'',maxlength:100},
    {id:'firstName',label:'Nombre',value:'',maxlength:80},
    {id:'originGroup',label:'Grupo de procedencia (p. ej., 1.º A)',value:'',maxlength:60,required:false}
  ],async v=>commit(d=>addStudent(d,STATE.groupId,{firstName:v.firstName,lastName:v.lastName,originGroup:v.originGroup})),'El grupo de procedencia es una etiqueta para las sesiones de evaluación; no separa las calificaciones de la optativa.');
  document.querySelectorAll('[data-edit]').forEach(button=>button.onclick=()=>openAssessmentTools(button.dataset.edit));
  // Conservar ambos desplazamientos en el iPad. commit() reconstruye toda
  // la tabla y focus() sin preventScroll desplaza la página hacia arriba.
  const snapshotGradeScroll=()=>{
    const table=$('.table-scroller');
    return {x:window.scrollX,y:window.scrollY,left:table?.scrollLeft||0,top:table?.scrollTop||0};
  };
  const restoreGradeScroll=position=>{
    const table=$('.table-scroller');
    if(table){table.scrollLeft=position.left;table.scrollTop=position.top;}
    window.scrollTo(position.x,position.y);
  };
  const restoreFocus=(studentId,assessmentId,move=0,position=snapshotGradeScroll())=>{
    const students=allStudents(),at=students.findIndex(s=>s.id===studentId);
    const targetId=students[Math.max(0,Math.min(students.length-1,at+move))]?.id;
    const next=[...document.querySelectorAll('input[data-student][data-assessment]')]
      .find(input=>input.dataset.student===targetId&&input.dataset.assessment===assessmentId);
    // Evitar el scroll implícito de focus() en Safari iPadOS.
    if(next){next.focus({preventScroll:true});next.select();}
    restoreGradeScroll(position);
    // Tras cerrar o mover el teclado, WebKit puede ajustar el viewport en el
    // fotograma siguiente. No desplazar la tabla ni saltar al principio.
    requestAnimationFrame(()=>{restoreGradeScroll(position);requestAnimationFrame(()=>restoreGradeScroll(position));});
  };
  document.querySelectorAll('[data-student][data-assessment]').forEach(field=>{
    let move=0,positionAtEnter=null;
    field.addEventListener('keydown',e=>{
      if(e.key==='Enter'){
        e.preventDefault();move=e.shiftKey?-1:1;
        positionAtEnter=snapshotGradeScroll();
        if(field.value===field.defaultValue){
          restoreFocus(field.dataset.student,field.dataset.assessment,move,positionAtEnter);
          positionAtEnter=null;
        }else field.blur();
      }
    });
    field.addEventListener('change',async()=>{
      const position=positionAtEnter||snapshotGradeScroll();
      positionAtEnter=null;
      try{
        await commit(d=>setGrade(d,field.dataset.student,field.dataset.assessment,field.value.trim()===''?null:field.value.trim().replace(',','.')),'Editar nota');
        restoreFocus(field.dataset.student,field.dataset.assessment,move,position);
      }catch(err){
        fail(err);render();
        restoreFocus(field.dataset.student,field.dataset.assessment,0,position);
      }finally{move=0;}
    });
  });
  document.querySelectorAll('[data-explain]').forEach(b=>b.onclick=()=>{
    const s=STATE.doc.students.find(s=>s.id===b.dataset.explain);
    const breakdown=calculationBreakdown(STATE.doc,s.id,STATE.groupId,STATE.periodId);
    const sum=breakdown.reduce((total,x)=>total+x.weight,0);
    const details=breakdown.map(x=>`<div class="explain-section"><div class="cardline"><div><strong>${esc(x.category)}</strong><div class="hint">${x.weight} % · ${esc(RULE_LABELS[x.rule]||x.rule)}${x.individualRule!=='general'?' · Excepción individual':''}</div><button class="btn small" type="button" data-set-individual-rule="${esc(x.categoryId||'')}">⚙ Regla individual</button></div><div class="value">${gradeChip(x.grade)}</div></div>${x.evidence.map(e=>`<div class="evidence-row"><span>${esc(e.name)}${e.originalNotSubmitted?' <span class="np-badge">NP</span>':''}${e.recoveryName?` <span class="hint">(${e.recoveryNotSubmitted?'recuperación: NP':'recuperada a '+gradeFmt(e.recovery)})</span>`:''}</span><span>${gradeChip(e.value)} ${x.used.includes(e)?'✓':'·'}</span></div>`).join('')||'<p class="hint">Sin calificaciones</p>'}</div>`).join('');
    showInfo('Cálculo de '+s.name,`<p class="subtitle">${esc(currentPeriod().name)} · Sin redondeos intermedios · ✓ evidencia utilizada</p>${Math.abs(sum-100)>1e-8?'<p class="note">Los porcentajes no suman 100: nota final no disponible.</p>':''}${periodCalculationWarnings(STATE.doc,s.id,STATE.groupId,STATE.periodId).map(w=>`<p class="warning-calculation">⚠ ${esc(w)}</p>`).join('')}${details}<div class="cardline"><strong>Nota final</strong><strong class="value">${gradeChip(overallGrade(STATE.doc,s.id,STATE.groupId,STATE.periodId))}</strong></div>`);
    dialog.querySelectorAll('[data-set-individual-rule]').forEach(btn=>btn.addEventListener('click',()=>openIndividualRule(s.id,btn.dataset.setIndividualRule)));
  });
}
const INDIVIDUAL_LABELS={general:'Aplicar regla general del grupo',np_mean:'Media obligatoria si un NP computa como cero',mean:'Media aritmética siempre',last:'Última actividad sustitutiva (aunque baje la nota)'};
/** Previsualizar con copia independiente; la configuración solo se guarda al confirmar. */
function openIndividualRule(studentId,categoryId){
  const student=STATE.doc.students.find(s=>s.id===studentId&&s.groupId===STATE.groupId);
  const category=effectiveCategories(STATE.doc,STATE.groupId,STATE.periodId).find(c=>c.id===categoryId);
  if(!student||!category)return;
  const oldRule=individualCategoryRule(STATE.doc,studentId,categoryId,STATE.periodId);
  const before=categoryGrade(STATE.doc,studentId,categoryId,STATE.groupId,STATE.periodId);
  dialog.innerHTML=`<form class="modal-inner" id="individual-rule-form"><span class="eyebrow">EXCEPCIÓN DE CÁLCULO INDIVIDUAL</span><h2 id="modal-heading">${esc(category.name)} · ${esc(student.name)}</h2><p class="subtitle">${esc(currentPeriod().name)}. No cambia las calificaciones originales ni la regla de otros alumnos.</p><label>Regla para este alumno<select id="individual-rule-select">${Object.entries(INDIVIDUAL_LABELS).map(([k,label])=>opt(k,label,oldRule)).join('')}</select></label><div class="section-note" id="individual-rule-note"></div><div class="cardline"><span>Nota actual</span><strong>${gradeChip(before)}</strong></div><div class="cardline"><span>Nota con la regla seleccionada</span><strong id="individual-rule-preview">—</strong></div><p class="hint">El cálculo se hace sobre las notas que computan. NP cuenta como 0; AJ no computa. La última actividad pendiente no sustituye las notas anteriores. Las recuperaciones vinculadas mantienen su funcionamiento independiente.</p><p class="modal-error" role="alert"></p><div class="modal-actions"><button type="button" class="btn" id="cancel-individual-rule">Cancelar</button><button type="submit" class="btn primary" id="save-individual-rule">Guardar regla</button></div></form>`;
  paintGrades(dialog);
  const preview=()=>{
    const selected=$('#individual-rule-select',dialog).value;
    try{
      const sample=structuredClone(STATE.doc);
      setIndividualCategoryRule(sample,studentId,categoryId,STATE.periodId,selected);
      const result=categoryEvidence(sample,studentId,categoryId,STATE.groupId,STATE.periodId);
      $('#individual-rule-preview',dialog).innerHTML=gradeChip(result.grade);
      $('#individual-rule-note',dialog).textContent=selected==='np_mean'
        ?(result.npTriggered?'NP computable detectado: se aplica la media incluyendo cero.':'No hay un NP computable: se conserva la regla del grupo.')
        :selected==='last'&&result.evidence.length&&result.used.length>1
          ?'La última actividad está sin calificar o pendiente: se conserva la media de las evaluadas.'
          :selected==='general'?'Se aplicará la configuración habitual de la categoría.':'Esta excepción solo modifica el cálculo de este alumno en esta categoría y evaluación.';
      paintGrades(dialog);$('#save-individual-rule',dialog).disabled=selected===oldRule;
    }catch(error){$('.modal-error',dialog).textContent=error.message;$('#save-individual-rule',dialog).disabled=true;}
  };
  $('#individual-rule-select',dialog).addEventListener('change',preview);
  $('#cancel-individual-rule',dialog).onclick=()=>dialog.close();
  $('#individual-rule-form',dialog).onsubmit=async event=>{
    event.preventDefault();const button=$('#save-individual-rule',dialog);button.disabled=true;
    try{const selectedRule=$('#individual-rule-select',dialog).value;await commit(doc=>setIndividualCategoryRule(doc,studentId,categoryId,STATE.periodId,selectedRule),'Regla individual de categoría');if(dialog.open)dialog.close();}
    catch(error){$('.modal-error',dialog).textContent=error.message;button.disabled=false;}
  };
  preview();if(!dialog.open)dialog.showModal();
}
function openIndividualRuleDirectory(){
  const students=allStudents(),categories=effectiveCategories(STATE.doc,STATE.groupId,STATE.periodId);
  if(!students.length||!categories.length)return toast('Necesitas al menos un alumno y una categoría.');
  dialog.innerHTML=`<form class="modal-inner" id="individual-rule-directory"><h2 id="modal-heading">Reglas individuales · ${esc(currentPeriod().name)}</h2><p class="subtitle">Selecciona un alumno y una categoría. Se conserva siempre la regla general para los demás alumnos.</p><label>Alumno<select name="student">${students.map(s=>opt(s.id,s.name,students[0].id)).join('')}</select></label><label>Categoría<select name="category">${categories.map(c=>opt(c.id,c.name,categories[0].id)).join('')}</select></label><div class="modal-actions"><button class="btn" type="button" id="cancel-individual-directory">Cancelar</button><button class="btn primary" type="submit">Configurar regla…</button></div></form>`;
  $('#cancel-individual-directory',dialog).onclick=()=>dialog.close();
  $('#individual-rule-directory',dialog).onsubmit=e=>{e.preventDefault();const fields=new FormData(e.currentTarget);openIndividualRule(fields.get('student'),fields.get('category'));};
  dialog.showModal();
}
function bindRules(){
  document.querySelectorAll('[data-category-color]').forEach(field=>field.onchange=()=>commit(d=>setCategoryColumnColor(d,field.dataset.categoryColor,field.value),'Color de categoría').catch(fail));
  document.querySelectorAll('[data-category-color-reset]').forEach(button=>button.onclick=()=>commit(d=>setCategoryColumnColor(d,button.dataset.categoryColorReset,null),'Eliminar color de categoría').catch(fail));
  $('#individual-rules')?.addEventListener('click',openIndividualRuleDirectory);
  document.querySelectorAll('[data-delete-category]').forEach(b=>b.onclick=async()=>{
    const category=STATE.doc.categories.find(c=>c.id===b.dataset.deleteCategory);
    if(!category)return;
    if(!window.confirm(`Retirar «${category.name}» de este grupo? No se eliminarán actividades ni notas de otras asignaturas. Debe estar vacía en todas las evaluaciones del grupo.`))return;
    try{await commit(d=>removeCategoryFromGroup(d,STATE.groupId,category.id),'Retirar categoría del grupo');}catch(err){fail(err);}
  });
  $('#new-category').onclick=()=>fieldsModal('Nueva categoría',[{id:'name',label:'Nombre'},{id:'weight',label:'Porcentaje predeterminado (revisa que la suma sea 100)',type:'number',value:0,min:0,max:100,step:'any'}],async v=>commit(d=>addCategory(d,v.name,Number(v.weight),'mean',STATE.groupId)));
  document.querySelectorAll('[data-periodweight]').forEach(field=>field.onchange=async()=>{try{await commit(d=>setPeriodCategory(d,STATE.groupId,STATE.periodId,field.dataset.periodweight,{weight:Number(field.value)}));}catch(err){fail(err);render();}});
  document.querySelectorAll('[data-periodrule]').forEach(field=>field.onchange=async()=>{try{await commit(d=>setPeriodCategory(d,STATE.groupId,STATE.periodId,field.dataset.periodrule,{rule:field.value}));}catch(err){fail(err);render();}});
  document.querySelectorAll('[data-bestcount]').forEach(field=>field.onchange=async()=>{try{await commit(d=>setPeriodCategory(d,STATE.groupId,STATE.periodId,field.dataset.bestcount,{bestCount:Number(field.value)}));}catch(err){fail(err);render();}});
  $('#reset-rules').onclick=async()=>{if(window.confirm('Restablecer los porcentajes y reglas de este grupo y periodo a los valores predeterminados?'))try{await commit(d=>resetPeriodCategories(d,STATE.groupId,STATE.periodId));}catch(err){fail(err);}};
  $('#copy-rules').onclick=async()=>{const source=$('#source-period').value;if(!source)return toast('Selecciona un periodo de origen.');if(!window.confirm('Sobrescribir las reglas de este periodo con las del periodo seleccionado?'))return;
    try{await commit(d=>copyPeriodCategories(d,STATE.groupId,source,STATE.periodId));}catch(err){fail(err);}
  };
}
function bindCompetencies(){
  $('#new-competency')?.addEventListener('click',()=>fieldsModal('Nueva competencia personalizada',[{id:'name',label:'Nombre de la competencia'}],async v=>commit(d=>addCompetency(d,v.name,STATE.groupId))));
  $('#comp-curr-version')?.addEventListener('change',e=>{STATE.competencyVersion=e.target.value;render();});
  document.querySelectorAll('[data-comp][data-linkcat], [data-official][data-linkcat]').forEach(input=>input.onchange=async e=>{
    const weight=Number(e.target.value),categoryId=e.target.dataset.linkcat,code=e.target.dataset.official;
    if(!Number.isFinite(weight)||weight<0||weight>1000){fail(new Error('Peso competencial fuera de rango.'));render();return;}
    try{await commit(d=>{
      let id=e.target.dataset.comp;
      if(code){
        const catalogue=officialCompetenciesForGroup(d.groups.find(g=>g.id===STATE.groupId),STATE.competencyVersion);
        const found=catalogue?.competencias.find(c=>c.key===code);
        if(!found)throw new Error('Competencia oficial no disponible.');
        let stored=linkedOfficialCompetency(d,STATE.groupId,code);
        if(!stored&&weight!==0)stored=addCompetency(d,`${found.code} · ${found.enunciado}`,STATE.groupId,code);
        if(!stored)return;
        id=stored.id;
      }
      setCompetencyLink(d,id,categoryId,weight===0?null:weight);
    },'Vincular competencia y categoría');}
    catch(err){fail(err);render();}
  });
}

function bindSettings(){
  $('#reset-notebook')?.addEventListener('click',()=>$('#reset-notebook-file')?.click());
  $('#reset-notebook-file')?.addEventListener('change',async e=>{
    const file=e.target.files?.[0];e.target.value='';
    if(file)try{await resetNotebookFromVerifiedCopy(file);}catch(error){fail(error);}
  });
  $('#backup-portable')?.addEventListener('click',()=>closeNotebook().catch(fail));
  async function reportStorageProtection(request=false){
    const el=$('#storage-status');if(!el)return;
    el.textContent=request?'Solicitando protección al navegador…':'Comprobando protección del almacenamiento…';
    const status=await storagePersistence(navigator.storage,request);
    if(!el.isConnected)return;
    el.textContent=status==='persistent'
      ? 'Almacenamiento persistente concedido. Aun así, descarga y verifica copias cifradas externas.'
      :status==='best-effort'
      ? 'Protección persistente no concedida. El navegador puede liberar estos datos; conserva copias cifradas externas.'
      :status==='unsupported'
      ? 'Este navegador no ofrece esta comprobación. No confíes únicamente en IndexedDB.'
      : 'No ha sido posible comprobar la protección del almacenamiento. Conserva una copia cifrada externa.';
  }
  $('#storage-check')?.addEventListener('click',()=>reportStorageProtection(false));
  $('#storage-protect')?.addEventListener('click',()=>reportStorageProtection(true));
  void reportStorageProtection(false);
  $('#save-orth-defaults')?.addEventListener('click',async()=>{
    try{
      const enabledForExams=$('#orth-default-on').checked;
      const penaltyPerFault=parseScore($('#orth-default-rate').value);
      const repetitions=Number($('#orth-default-copies').value);
      const refundable=$('#orth-default-refundable').checked;
      await commit(d=>setOrthographyDefaults(d,{enabledForExams,penaltyPerFault,repetitions,refundable}),'Preferencias de faltas');
      toast('Valores predeterminados guardados para nuevos exámenes.');
    }catch(err){fail(err);}
  });
  document.querySelectorAll('[data-accent]').forEach(input=>input.onchange=e=>{
    const [level,subject]=e.target.dataset.accent.split(':');
    commit(d=>setSubjectAccent(d,level,subject,e.target.value)).catch(fail);
  });
  $('#reset-accents').onclick=async()=>{
    if(!window.confirm('¿Restablecer los cinco colores de acento?'))return;
    try{await commit(d=>{d.settings.subjectAccents={...SUBJECT_COLORS,...Object.fromEntries((d.settings.customSubjects||[]).map(x=>[subjectKey(x.level,x.subject),defaultSubjectAccent(x.level,x.subject)]))};d.updatedAt=new Date().toISOString();});}catch(e){fail(e);}
  };
  $('#decimals').onchange=e=>commit(d=>{d.settings.decimals=Number(e.target.value);d.updatedAt=new Date().toISOString();}).catch(fail);
  $('#rounding').onchange=e=>commit(d=>{d.settings.rounding=e.target.value;d.updatedAt=new Date().toISOString();}).catch(fail);
  $('#check-reload').onclick=async()=>{
    try{
      await STATE.mutationQueue;await STATE.saveQueue;
      if(STATE.saveError)throw STATE.saveError;
      const current=await readEnvelope(STATE.db);
      if(!current||!sameEnvelope(current,STATE.envelope))throw new Error('La copia guardada no coincide con la versión abierta. Cierra y vuelve a abrir esta pestaña.');
      const probe=await makeReloadProbe(current);
      // No almacenar ni el sobre ni el contenido; únicamente su huella temporal.
      sessionStorage.setItem(RELOAD_PROBE_KEY,JSON.stringify(probe));
      window.location.reload();
    }catch(err){fail(new Error('La prueba de recarga no se ha iniciado: '+err.message));}
  };
  $('#check-offline').onclick=async()=>{
    const el=$('#offline-result');el.textContent='Comprobando recursos…';
    try{
      if(!('serviceWorker' in navigator)||!('caches' in window))throw new Error('Este navegador no dispone de las API necesarias.');
      const registration=await navigator.serviceWorker.getRegistration('./');
      if(!registration?.active)throw new Error('El servicio offline aún no está activo. Abre de nuevo la aplicación con conexión.');
      const expected=['./','./index.html','./styles.css','./app.js','./manifest.webmanifest','./icons/icon.svg','./icons/icon-192.png','./icons/icon-512.png','./icons/icon-maskable-512.png','./icons/apple-touch-icon.png','./src/pwa-controls.js','./src/model.js','./src/cuaderno.js','./src/planner.js','./src/planner-ui.js','./src/timetable-export.js','./src/attitude-template.js','./src/rubric-xlsx.js','./vendor/jszip.min.js','./src/calculations.js','./src/statistics.js','./src/csv.js','./src/rubric-import.js','./src/rubric-ui.js','./src/history.js','./src/vault.js','./src/storage.js','./src/diagnostics.js','./src/curriculum-data.js','./src/official-competencies.js','./data/curriculos/gr1y2-nuevo.pdf','./data/curriculos/lat1y2-nuevo.pdf','./data/curriculos/lat4.pdf','./data/curriculos/lat2-2022.pdf'];
      const cache=await caches.open('cuaderno-docente-static-v148-dev');
      const missing=[];
      for(const path of expected)if(!await cache.match(path))missing.push(path);
      el.textContent=missing.length?`Faltan ${missing.length} recursos en caché. Conéctate, recarga y repite la prueba.`:`Los ${expected.length} recursos estáticos están en caché. Falta comprobar el funcionamiento real sin conexión.`;
    }catch(err){el.textContent='No verificado: '+err.message;}
  };
  $('#backup-download').onclick=async()=>{

    try{
      await STATE.mutationQueue;await STATE.saveQueue;
      if(!STATE.envelope)throw new Error('No hay datos guardados para exportar.');
      if(!sameEnvelope(await readEnvelope(STATE.db),STATE.envelope))throw new Error('Otra pestaña modificó el cuaderno. No se descargará una copia potencialmente desactualizada. Vuelve a abrir la aplicación.');
      downloadEncryptedEnvelope(STATE.envelope,'CuadernoDocente-'+new Date().toISOString().slice(0,10)+'.cdoc');
      toast('Copia cifrada preparada para descargar.');
    }catch(err){fail(err);}
  };
  $('#backup-draft')?.addEventListener('click',()=>downloadEncryptedEnvelope(STATE.failedEnvelope,'CuadernoDocente-intento-sin-guardar.cdoc'));
  $('#backup-verify').onclick=()=>$('#backup-verify-file').click();
  $('#backup-verify-file').onchange=async e=>{try{if(e.target.files[0])await verifyBackup(e.target.files[0]);}catch(err){fail(err);}e.target.value='';};
  $('#backup-restore').onclick=()=>$('#backup-file').click();
  $('#backup-recover')?.addEventListener('click',()=>recoverPreviousVersion().catch(fail));
  $('#backup-download-recovery')?.addEventListener('click',()=>downloadRecovery().catch(fail));
  $('#backup-file').onchange=async e=>{try{const f=e.target.files[0];e.target.value='';if(f)await restoreBackup(f);}catch(err){fail(err);}};
}
window.addEventListener('keydown',event=>{
  if(!STATE.doc||dialog.open||STATE.tab==='alumno'&&STATE.studentId||!(event.ctrlKey||event.metaKey)||event.altKey)return;
  if(event.target.closest('input,textarea,select,[contenteditable="true"]'))return;
  const key=event.key.toLowerCase();
  if(key==='z'||key==='y'){
    const direction=key==='y'||event.shiftKey?'redo':'undo';
    if(!STATE.history[direction==='undo'?'past':'future'].length)return;
    event.preventDefault();navigateHistory(direction).catch(fail);
  }
});
window.addEventListener('online',()=>toast('Conexión disponible. El cuaderno sigue guardándose localmente.'));
init();
