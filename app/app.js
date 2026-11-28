import {renderExtracurricular,bindExtracurricular} from './src/extracurricular-ui.js';
import {initialNotebook,emptyNotebook,assertModel,migrateNotebook,effectiveCategories,setPeriodCategory,setPeriodCategoryEnabled,addPeriodCategory,resetPeriodCategories,copyPeriodCategories,updateAssessment,moveAssessment,removeAssessment,addGroup,addPeriod,addStudent,addAssessment,addCategory,removeCategoryFromGroup,availableCategories,copyPeriodAssessments,setGrade,setNotSubmitted,setPendingJustified,individualCategoryRule,setIndividualCategoryRule,addCompetency,setCompetencyLink,COURSE_SUBJECTS,SUBJECT_COLORS,subjectKey,validSubject,catalogForNotebook,addNotebookSubject,removeNotebookSubject,defaultSubjectAccent,setSubjectAccent,classifyGroup,createRubric,updateRubric,duplicateRubric,setRubricGrade,setFinalConfig,setFinalOverride,renameStudent,updateStudentIdentity,sortStudents,STUDENT_SORT_MODES,STUDENT_ACTIVITY_SORT_MODES,sortStudentPeriodActivities,moveStudent,removeStudent,updateGroupInfo,setGroupWeeklyHours,setStudentOriginGroups,originGroupOptions,assignStudentOriginGroup,levelForSubject,renamePeriod,movePeriod,removePeriod,recordedScore,parseScore,setOrthographyGrade,setOrthographyDefaults,groupOrthographyRefundable,setGroupOrthographyRefundable,ORTHOGRAPHY_DEFAULTS,ITACA_ROUNDING,itacaGroupRule,itacaStudentRule,setItacaGroupRule,setItacaStudentRule,setItacaAttitudeCondition,itacaAttitudeCondition,setCategoryColumnColor,categoryColumnColor,getGradeObservation,setGradeObservation} from './src/model.js';
import {categoryGrade,categoryEvidence,overallGrade,competencyGrade,competencyArithmeticMean,gradeToFour,competencyAcquisitionLevel,competencyAcquisitionLabel,COMPETENCY_ACQUISITION_LABELS,formatGrade,gradeTone,calculationBreakdown,finalEvidence,finalGrade,normalizedScore,periodCalculationWarnings,effectiveAssessmentScore,orthographyPenalty,greekEtymologyBonusApplied,itacaGrade,itacaAttitudeBlock} from './src/calculations.js';
import {studentsFromCsv} from './src/csv.js';
import {parseRubricText} from './src/rubric-import.js';
import {parseRubricFile} from './src/rubric-xlsx.js';
import {createVault,seal,unlockVault,saltFromEnvelope,validateEnvelope,prepareVaultUpgrade,KDF_ITERATIONS,generateStrongPassphrase} from './src/vault.js';
import {openDb,readEnvelope,writeEnvelope,sameEnvelope,readRecoveryEnvelope,replaceEnvelopeWithRecovery,swapRecoveryEnvelope,readExportReceipt,recordExportReceipt} from './src/storage.js';
import {ensureBookMetadata,markBookChange,compareBookVersions,compareBackupAgainstLocal,importRiskLevel,canConfirmImport,IMPORT_CONFIRMATION_TEXT,backupProtection,createPortableCopy,readBackupFile,backupSummary,portableFilename} from './src/cuaderno.js';
import {emptyHistory,recordChange,stepHistory} from './src/history.js';
import {previewRubric,validateRubricDraft} from './src/rubric-ui.js';
import {RELOAD_PROBE_KEY,makeReloadProbe,evaluateReloadProbe} from './src/diagnostics.js';
import {CURRICULA} from './src/curriculum-data.js';
import {officialCompetenciesForGroup,groupCompetencies,linkedOfficialCompetency,curriculumCompetenciesWithCriteria} from './src/official-competencies.js';
import {ensurePlanner,localToday,activeYear,setActiveYear,addAcademicYear} from './src/planner.js';
import {renderPlanner,bindPlanner} from './src/planner-ui.js';
import {renderEvaluationWorkspace,bindEvaluationWorkspace} from './src/evaluation-workspace.js';
import {renderNotebookEvaluationNotice} from './src/notebook-evaluation-notice.js';
import {openStudentLinksManager} from './src/student-link-ui.js';
import {assessmentClassStatistics,periodClassStatistics,finalClassStatistics,categoryClassStatistics,competencyClassStatistics} from './src/statistics.js';

import {installInstructions,mayReloadForUpdate,storagePersistence} from './src/pwa-controls.js';

import {createDropboxSession,dropboxConfigured,DROPBOX_CLIENT_ID} from './src/dropbox-session.js';
import {isDropboxTest} from './src/dropbox-config.js';
import {createPeriodPreferenceStore,preferredPeriod} from './src/period-preferences.js';
import {prepareDropboxNavigation,captureDropboxCallback,createDropboxOnboarding} from './src/dropbox-onboarding.js';
import {writeDropboxCredential,readDropboxCredential} from './src/storage.js';

const root=document.getElementById('app');
const dialog=document.getElementById('modal');
// Closed dialogs must not retain passwords (including a generated password
// temporarily displayed as text) in their DOM controls.
function clearSecretInputs(scope){
  for(const input of scope.querySelectorAll('input[type="password"],input[data-secret-input]'))input.value='';
}
dialog.addEventListener('close',()=>{if(!dialog.open)clearSecretInputs(dialog);});
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
const savedNotebookZoom=()=>{try{
  const value=Number(localStorage.getItem('appnotas-notebook-zoom'));
  return value>=80&&value<=140&&value%10===0?value:100;
}catch{return 100;}};
const NOTEBOOK_ZOOM_MIN=80,NOTEBOOK_ZOOM_MAX=140;
const savedNavigation=()=>{try{return localStorage.getItem('cuaderno-docente-nav-collapsed')==='yes';}catch{return false;}};
const savedStudentSort=()=>{try{const mode=localStorage.getItem('cuaderno-docente-student-sort');return STUDENT_SORT_MODES.includes(mode)?mode:'surname';}catch{return 'surname';}};
const savedStudentPlainSort=()=>{try{const mode=localStorage.getItem('cuaderno-docente-student-sort-before-group');return STUDENT_SORT_MODES.includes(mode)&&mode!=='originGroup'?mode:'surname';}catch{return 'surname';}};
const savedStudentActivityOrders=()=>{try{
  const raw=JSON.parse(localStorage.getItem('cuaderno-docente-student-activity-orders')||'{}');
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return {};
  return Object.fromEntries(Object.entries(raw).filter(([id,mode])=>id.length<150&&STUDENT_ACTIVITY_SORT_MODES.includes(mode)).slice(0,200));
}catch{return {};}};
const STUDENT_ACTIVITY_SORT_OPTIONS=[['category','Por categoría'],['column','Orden del cuaderno'],['alphabetical','Nombre de actividad (A–Z)'],['reverse','Últimas actividades primero']];

const STATE={evaluationWorkspaceTab:'sesiones',plannerMode:'week',plannerDate:localToday(),plannerEventRequest:null,theme:savedTheme(),notebookZoom:savedNotebookZoom(),navCollapsed:savedNavigation(),studentSort:savedStudentSort(),studentPlainSort:savedStudentPlainSort(),studentActivityOrders:savedStudentActivityOrders(),studentPeriodId:null,studentFull:false,studentPresentation:false,db:null,doc:null,key:null,salt:null,envelope:null,groupId:null,periodId:null,level:null,subject:null,tab:'cuaderno',studentId:null,curriculumVersion:'2022',competencyVersion:'auto',curriculumSection:'competencias',curriculumCompetence:'all',curriculumQuery:'',saveQueue:Promise.resolve(),mutationQueue:Promise.resolve(),pending:0,failedEnvelope:null,history:emptyHistory(),saving:0,saveError:null,reloadProbe:null,recovery:null,exportReceipt:null};
const periodPreferences=createPeriodPreferenceStore({state:STATE});
let periodGroup=null,periodBook=null,preferenceError=false,preferenceSyncState='';
let deferredPeriod=false,deferredRender=false,refreshTimer=null;
const activePointers=new Set(),pendingPeriodChoices=new Map();
function localPreferredPeriod(){
 const choice=pendingPeriodChoices.get(STATE.groupId);
 return choice&&STATE.doc.periods.some(p=>p.id===choice.id)?choice.id:preferredPeriod(periodPreferences.get(),STATE.doc,STATE.groupId);
}
function currentView(){return {key:STATE.key,bookId:STATE.doc?.id,groupId:STATE.groupId,periodId:STATE.periodId,tab:STATE.tab};}
function sameView(v){return STATE.key===v.key&&STATE.doc?.id===v.bookId&&STATE.groupId===v.groupId&&STATE.periodId===v.periodId&&STATE.tab===v.tab;}
function activeEditor(){return root.contains(document.activeElement)&&document.activeElement.matches('input:not([type=button]):not([type=checkbox]):not([type=radio]):not([type=file]):not([type=color]),textarea,[contenteditable=true]');}
function canRefreshView(){return !activePointers.size&&!activeEditor()&&!dialog.open&&!STATE.studentPresentation;}
function applyDeferredPeriod(){
 if(!deferredPeriod||preferenceError||!STATE.doc||STATE.pending||!canRefreshView()||!['cuaderno','calculos','competencias'].includes(STATE.tab))return false;
 deferredPeriod=false;
 const selected=localPreferredPeriod();
 if(selected===STATE.periodId)return false;
 restoreOrdinaryPeriod();return true;
}
function scheduleDeferredRefresh(){
 if(!deferredRender&&!deferredPeriod)return;
 clearTimeout(refreshTimer);
 refreshTimer=setTimeout(()=>{
  refreshTimer=null;
  if(!STATE.doc||STATE.pending||!canRefreshView())return;
  const view=currentView(),table=$('.table-scroller');
  const scroll=table&&{left:table.scrollLeft,top:table.scrollTop,x:window.scrollX,y:window.scrollY};
  const changed=applyDeferredPeriod();
  if(changed||deferredRender){
   render();
   if(!changed&&scroll&&sameView(view)){
    const next=$('.table-scroller');
    if(next){next.scrollLeft=scroll.left;next.scrollTop=scroll.top;}
    window.scrollTo(scroll.x,scroll.y);
   }
  }
 },100);
}
function renderAfterMutation(){
 if(activePointers.size||activeEditor()||STATE.pending>1){deferredRender=true;scheduleDeferredRefresh();return false;}
 render();return true;
}
document.addEventListener('pointerdown',e=>activePointers.add(e.pointerId),true);
for(const event of ['pointerup','pointercancel'])document.addEventListener(event,e=>{activePointers.delete(e.pointerId);scheduleDeferredRefresh();},true);
window.addEventListener('blur',()=>{activePointers.clear();scheduleDeferredRefresh();});
document.addEventListener('focusout',scheduleDeferredRefresh,true);
dialog.addEventListener('close',scheduleDeferredRefresh);
function restoreOrdinaryPeriod(){STATE.periodId=localPreferredPeriod();periodGroup=STATE.groupId;periodBook=STATE.doc.id;}
async function loadOrdinaryPeriods(incoming=null){try{await periodPreferences.load();if(incoming)await periodPreferences.merge(incoming);preferenceError=false;}catch{preferenceError=true;}restoreOrdinaryPeriod();}
function selectOrdinaryPeriod(id){
 const groupId=STATE.groupId,key=STATE.key,bookId=STATE.doc?.id,tab=STATE.tab;
 if(!key||!STATE.doc?.periods.some(p=>p.id===id)||!STATE.doc.groups.some(g=>g.id===groupId))return Promise.resolve();
 // Cambiar el período en el gesto, no después de cifrarlo: la tabla visible
 // siempre corresponde a STATE.periodId. La preferencia viaja en la cola.
 const choice={id,at:Date.now()};pendingPeriodChoices.set(groupId,choice);
 STATE.periodId=id;periodGroup=groupId;periodBook=bookId;
 if(!['calculos','competencias'].includes(tab))STATE.tab='cuaderno';
 render();
 return enqueueMutation(async()=>{
  if(STATE.key!==key||STATE.doc?.id!==bookId)return;
  try{
   if(!STATE.doc.periods.some(p=>p.id===id)||!STATE.doc.groups.some(g=>g.id===groupId))return;
   await periodPreferences.remember(groupId,id,choice.at);
   if(pendingPeriodChoices.get(groupId)===choice)pendingPeriodChoices.delete(groupId);
   preferenceError=false;
  }catch{
   preferenceError=true;toast('No se ha podido guardar la evaluación como preferencia cifrada. Las notas permanecen intactas.');
  }
  if(dropboxSession.active()){preferenceSyncState='Preferencias de evaluación pendientes de sincronizar.';paintDropboxStatus();}
  dropboxSession.preferencesChanged();
 });
}
let dropboxStatus='not-configured';
let dropboxCallback=null,dropboxOnboarding=null;
function clearDropboxOnboarding(){dropboxCallback=null;dropboxOnboarding?.stop();dropboxOnboarding=null;}
const dropboxIcon='<svg aria-hidden="true" viewBox="0 0 48 48" width="19" height="19" fill="currentColor"><path d="M12 5 24 13 12 21 0 13zM36 5 48 13 36 21 24 13zM12 21 24 29 12 37 0 29zM36 21 48 29 36 37 24 29zM12 39 24 31 36 39 24 47z"/></svg>';
const dropboxMessages={'not-configured':'Pendiente de configurar Dropbox','not-linked':'Dropbox no vinculado',idle:'Listo',syncing:'Sincronizando…',synced:'Sincronizado',offline:'Sin conexión',pending:'Cambios pendientes',unavailable:'Esperando guardado local',conflict:'Conflicto: se conservan ambas versiones','remote-missing':'No se encuentra la copia remota',error:'Error de sincronización',locked:'Bloqueado'};
function paintDropboxStatus(){
  for(const el of root.querySelectorAll('[data-period-preference-status]'))el.textContent=preferenceError?'No se han podido guardar o leer las preferencias de evaluación. Las notas están separadas.':preferenceSyncState||'Las evaluaciones se recuerdan por grupo en este dispositivo.';
  const message=dropboxMessages[dropboxStatus]||dropboxMessages.error;
  for(const el of root.querySelectorAll('[data-dropbox-status]'))el.textContent=message;
  const button=root.querySelector('#dropbox-sync');
  if(button){button.title=message;button.setAttribute('aria-label','Dropbox: '+message);}
  const label=root.querySelector('#dropbox-sync .dropbox-label');
  if(label)label.textContent=dropboxStatus==='conflict'?'Conflicto':dropboxStatus==='syncing'?'Sincronizando…':dropboxStatus==='pending'?'Pendiente':dropboxStatus==='offline'?'Sin conexión':'Dropbox';
}
const dropboxSession=createDropboxSession({state:STATE,preferences:periodPreferences,enqueue:enqueueMutation,windowTarget:window,documentTarget:document,origin:location.origin,
  canApply:()=>canRefreshView()&&!document.activeElement?.matches?.('input,select,textarea,[contenteditable=true]'),
  adopt:()=>{
    STATE.history=emptyHistory();
    if(STATE.studentId&&!STATE.doc.students.some(s=>s.id===STATE.studentId))STATE.studentId=null;
    // Puede comenzar una edición durante la última escritura en IndexedDB.
    // La revisión remota ya está guardada: posponer solo la pintura.
    if(!canRefreshView()||document.activeElement?.matches?.('input,select,textarea,[contenteditable=true]')){
      deferredRender=true;scheduleDeferredRefresh();
    }else renderAfterMutation();
  },
  onStatus:({status})=>{dropboxStatus=status;if(status!=='synced')preferenceSyncState='';paintDropboxStatus();},
  onPreferences:ok=>{
    preferenceSyncState=ok?'Preferencias de evaluación sincronizadas.':'Preferencias de evaluación pendientes de sincronizar.';
    paintDropboxStatus();
    if(ok&&!preferenceError&&STATE.doc){deferredPeriod=true;scheduleDeferredRefresh();}
  }});
function startDropboxSession(){void dropboxSession.start().catch(()=>{dropboxStatus='error';paintDropboxStatus();});}
function openDropboxSettings(){STATE.tab='ajustes';STATE.studentPresentation=false;render();$('#dropbox-settings')?.scrollIntoView({block:'nearest'});}
async function navigateDropbox(mode){
  if(!dropboxConfigured(location.origin))throw new Error('Dropbox todavía no está configurado.');
  if(isDropboxTest(location.origin)&&!window.confirm('ENTORNO DE PRUEBAS: utiliza exclusivamente datos ficticios. No vincules ni importes tu cuaderno real. ¿Continuar?'))return;
  if(mode==='link'){
    await STATE.mutationQueue;await STATE.saveQueue;
    if(!STATE.doc||!STATE.key||STATE.envelope?.iterations!==KDF_ITERATIONS||STATE.saveError||STATE.failedEnvelope)
      throw new Error('Desbloquea el cuaderno reforzado y comprueba su guardado antes de vincularlo.');
    if(!window.confirm('Se abrirá Dropbox para autorizar la carpeta de AppNotas. No se enviarán notas durante esta autorización. Tendrás que desbloquear de nuevo el cuaderno al regresar. ¿Continuar?'))return;
  }else if(STATE.envelope||STATE.doc||await readEnvelope(STATE.db)!==null){
    throw new Error('Ya existe un cuaderno local. No se puede recuperar otro automáticamente.');
  }
  const url=await prepareDropboxNavigation({clientId:DROPBOX_CLIENT_ID,mode,storage:sessionStorage,origin:location.origin});
  clearDropboxOnboarding();dropboxSession.stop();location.assign(url);
}
async function finishDropboxLink(){
  const callback=dropboxCallback;
  dropboxCallback=null;
  if(!callback||callback.mode!=='link'||!dropboxConfigured(location.origin)){startDropboxSession();return;}
  if(!STATE.doc||STATE.envelope?.iterations!==KDF_ITERATIONS){toast('Refuerza la contraseña y vuelve a vincular Dropbox.');return;}
  if(!window.confirm('¿Vincular este cuaderno con la cuenta de Dropbox que acabas de autorizar?')){startDropboxSession();return;}
  const password=await requestBackupPassword('Vincular Dropbox · contraseña del cuaderno (mínimo 16 caracteres)');
  if(password===null){startDropboxSession();return;}
  if(password.length<16){toast('Dropbox requiere una frase de contraseña de al menos 16 caracteres. Refuérzala antes de vincular.');startDropboxSession();return;}
  const flow=createDropboxOnboarding({clientId:DROPBOX_CLIENT_ID,origin:location.origin});dropboxOnboarding=flow;
  dropboxSession.stop();
  try{
    await enqueueMutation(async()=>{
      await STATE.saveQueue;
      await flow.begin(callback);
      const linked=await flow.link({state:STATE,password,confirmInitialize:async()=>window.confirm('No hay una copia en Dropbox. ¿Crear ahora la primera copia cifrada de este cuaderno?')});
      toast(linked?'Dropbox vinculado.':'Vinculación cancelada. El cuaderno local permanece intacto.');
    });
  }catch{toast('No se pudo vincular Dropbox. Comprueba la cuenta, la contraseña y si existe otro cuaderno remoto. No se ha sobrescrito el cuaderno local.');}
  finally{flow.stop();if(dropboxOnboarding===flow)dropboxOnboarding=null;if(STATE.doc)startDropboxSession();}
}
async function finishDropboxRestore(){
  const callback=dropboxCallback;
  dropboxCallback=null;
  if(!callback||callback.mode!=='restore'||!dropboxConfigured(location.origin)||STATE.envelope||STATE.doc)return;
  const password=await requestBackupPassword('Recuperar desde Dropbox · contraseña del cuaderno');
  if(password===null){showUnlock(true);return;}
  const flow=createDropboxOnboarding({clientId:DROPBOX_CLIENT_ID,origin:location.origin});dropboxOnboarding=flow;
  try{
    await enqueueMutation(async()=>{
      if(STATE.doc||STATE.envelope||await readEnvelope(STATE.db)!==null)throw new Error('Ya existe un cuaderno local.');
      await flow.begin(callback);
      const restored=await flow.restore({db:STATE.db,password,confirmRestore:async()=>window.confirm('Se ha autenticado el cuaderno de Dropbox con tu contraseña. ¿Instalarlo cifrado en este dispositivo vacío?')});
      if(!restored){showUnlock(true);return;}
      STATE.exportReceipt=null;
      await adoptRestoredNotebook(restored.envelope,STATE.recovery,restored,restored.doc);
      toast('Cuaderno recuperado de Dropbox y guardado cifrado en este dispositivo.');
    });
  }catch{
    STATE.envelope=await readEnvelope(STATE.db);
    if(!STATE.doc)showUnlock(!STATE.envelope);
    toast('No se pudo recuperar el cuaderno. Comprueba la contraseña, la cuenta de Dropbox y la conexión. No se ha sustituido ningún cuaderno.');
  }finally{flow.stop();if(dropboxOnboarding===flow)dropboxOnboarding=null;if(STATE.doc)startDropboxSession();}
}
async function unlinkDropbox(){
  if(!dropboxConfigured(location.origin)||!STATE.doc||!STATE.key)return;
  if(!window.confirm('¿Desvincular Dropbox de este dispositivo? Se conservarán el cuaderno local y la copia remota. Puedes revocar el acceso también en los ajustes de tu cuenta de Dropbox.'))return;
  clearDropboxOnboarding();dropboxSession.stop();
  try{
    await enqueueMutation(async()=>{
      await STATE.saveQueue;
      if(STATE.saveError||STATE.failedEnvelope||!STATE.doc||!STATE.key)throw new Error('Comprueba el guardado local.');
      await writeDropboxCredential(STATE.db,null,STATE.envelope);
    });
    dropboxStatus='not-linked';paintDropboxStatus();toast('Dropbox desvinculado de este dispositivo.');
  }catch{toast('No se pudo desvincular Dropbox. Comprueba el almacenamiento local.');}
}
async function openDropboxConflictCopies(){
  if(!dropboxSession.active()||!STATE.doc||dialog.open){toast('Desbloquea el cuaderno vinculado.');return;}
  const key=STATE.key;
  let copies;
  try{copies=await dropboxSession.conflictCopies();}catch{toast('No se han podido preparar dos versiones incompatibles autenticadas. Comprueba el estado de Dropbox y el guardado local.');return;}
  if(STATE.key!==key||dialog.open)return;
  const stamp=new Date().toISOString().slice(0,10);
  dialog.innerHTML='<div class="modal-inner"><h2 id="modal-heading">Conflicto de sincronización</h2><p>Las dos versiones se conservan sin fusionar ni sobrescribir. Descarga ambas copias cifradas y verifica que puedes abrirlas antes de decidir cuál conservar. Guarda los archivos en una ubicación local autorizada.</p><p class="hint">No se han cambiado las notas ni en Dropbox ni en el dispositivo. Cada copia se abre con la contraseña del cuaderno. Para continuar, conserva ambas, restaura la versión Dropbox mediante Restaurar copia, vuelve a vincular y añade manualmente los cambios de la versión local que quieras conservar.</p><div class="modal-actions"><button class="btn" type="button" id="dropbox-copy-local">Descargar versión local</button><button class="btn" type="button" id="dropbox-copy-remote">Descargar versión Dropbox</button><button class="btn" type="button" id="dropbox-copy-close">Cerrar</button></div></div>';
  $('#dropbox-copy-local',dialog).onclick=()=>downloadEncryptedEnvelope(copies.local,'AppNotas-conflicto-local-'+stamp+'.cdoc');
  $('#dropbox-copy-remote',dialog).onclick=()=>downloadEncryptedEnvelope(copies.remote,'AppNotas-conflicto-dropbox-'+stamp+'.cdoc');
  $('#dropbox-copy-close',dialog).onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{copies=null;},{once:true});
  dialog.showModal();
}
function renderDropboxSettings(){
  return `<section id="dropbox-settings" class="panel panel-pad"><h2>Sincronización cifrada con Dropbox</h2>${isDropboxTest(location.origin)?'<p class="section-note"><strong>ENTORNO DE PRUEBAS.</strong> Solo datos ficticios. No importes ni escribas notas reales.</p>':''}<p data-dropbox-status role="status" aria-live="polite"></p><p class="hint" data-period-preference-status role="status" aria-live="polite"></p><p class="hint">Los datos se cifran en este dispositivo antes de enviarse. No se guardan contraseñas en Dropbox. La sincronización se realizará mientras el cuaderno esté desbloqueado y la aplicación activa.</p>${STATE.envelope?.iterations!==KDF_ITERATIONS?'<p class="section-note">Para sincronizar, debes reforzar la contraseña del cuaderno. Conserva primero una copia cifrada comprobada.</p><button class="btn" type="button" id="dropbox-upgrade">Reforzar contraseña</button>':'<p class="hint">Formato de cifrado reforzado disponible. Dropbox requiere una frase de contraseña de al menos 16 caracteres.</p>'+(!dropboxSession.active()?'<button class="btn" type="button" id="dropbox-upgrade">Reforzar contraseña</button>':'')}${dropboxConfigured(location.origin)?(STATE.envelope?.iterations===KDF_ITERATIONS?'<div class="actions"><button class="btn dropbox-sync-btn" type="button" id="dropbox-link">Vincular Dropbox</button><button class="btn" type="button" id="dropbox-unlink">Desvincular este dispositivo</button><button class="btn" type="button" id="dropbox-conflict-copies">Conservar ambas versiones (conflicto)</button></div><p class="hint">Si existe un cuaderno diferente en Dropbox, no se sustituirá. Conserva copias locales verificadas además de la sincronización.</p>':'<p class="hint">Refuerza la contraseña antes de vincular Dropbox.</p>'):'<p class="hint">La conexión con Dropbox todavía no está habilitada. Ningún dato se envía.</p>'}</section>`;
}
function openDropboxUpgrade(){
  if(dialog.open||!STATE.doc||!STATE.key)return;
  if(dropboxSession.active()){toast('No cambies la clave de un cuaderno vinculado. Primero debes desvincularlo y conservar copias verificadas.');return;}
  const expected=STATE.envelope,before=STATE.doc,key=STATE.key;
  dialog.innerHTML='<form class="modal-inner" id="dropbox-upgrade-form"><h2 id="modal-heading">Reforzar contraseña del cuaderno</h2><p>Las notas no cambian. Las copias anteriores conservarán su contraseña antigua. Guarda y verifica una copia .cuaderno de esta revisión desde Ajustes antes de continuar. Si ya existe una copia en Dropbox, no cambies la contraseña hasta haber conservado ambas copias y retirado la anterior de Dropbox: no se cambiará su clave automáticamente.</p><label for="dropbox-old-password">Contraseña actual</label><input class="text-field" id="dropbox-old-password" type="password" required autocomplete="off"/><label for="dropbox-new-password">Nueva contraseña (mínimo 16 caracteres)</label><input class="text-field" id="dropbox-new-password" type="password" required minlength="16" autocomplete="off"/><button type="button" class="btn" id="dropbox-generate-password">Generar contraseña aleatoria segura</button><p class="hint">Si generas una contraseña, se mostrará temporalmente para que la guardes en un gestor de contraseñas autorizado. No la compartas.</p><label for="dropbox-repeat-password">Repite la nueva contraseña</label><input class="text-field" id="dropbox-repeat-password" type="password" required minlength="16" autocomplete="off"/><label><input id="dropbox-backup-confirm" type="checkbox" required/> He guardado y verificado una copia externa cifrada.</label><p id="dropbox-upgrade-error" role="alert" class="modal-error"></p><div class="modal-actions"><button type="button" class="btn" id="dropbox-upgrade-cancel">Cancelar</button><button type="submit" class="btn primary">Reforzar contraseña</button></div></form>';
  const form=$('#dropbox-upgrade-form',dialog),err=$('#dropbox-upgrade-error',dialog),submit=form.querySelector('[type=submit]'),cancel=$('#dropbox-upgrade-cancel',dialog);
  cancel.onclick=()=>{clearSecretInputs(form);dialog.close();};
  form.addEventListener('reset',()=>clearSecretInputs(form));
  $('#dropbox-generate-password',dialog).onclick=()=>{const generated=generateStrongPassphrase();const fresh=$('#dropbox-new-password',dialog);fresh.dataset.secretInput='';fresh.type='text';fresh.value=generated;$('#dropbox-repeat-password',dialog).value=generated;};
  form.onsubmit=e=>{
    e.preventDefault();const old=$('#dropbox-old-password',dialog),fresh=$('#dropbox-new-password',dialog),repeat=$('#dropbox-repeat-password',dialog);
    if(fresh.value!==repeat.value){err.textContent='Las contraseñas nuevas no coinciden.';return;}
    const oldPassword=old.value,newPassword=fresh.value;old.value=fresh.value=repeat.value='';
    submit.disabled=true;cancel.disabled=true;err.textContent='';
    const preventClose=e=>e.preventDefault();dialog.addEventListener('cancel',preventClose);
    enqueueMutation(async()=>{
      await STATE.saveQueue;
      if(STATE.doc!==before||STATE.key!==key||!sameEnvelope(STATE.envelope,expected)||STATE.saveError||STATE.failedEnvelope)throw new Error('El cuaderno ha cambiado.');
      if(await readDropboxCredential(STATE.db))throw new Error('Desvincula Dropbox antes de cambiar la clave.');
      const receipt=await readExportReceipt(STATE.db);
      if(backupProtection(before,receipt)!=='current')throw new Error('Verifica primero una copia .cuaderno de la revisión actual.');
      const upgraded=await prepareVaultUpgrade(oldPassword,newPassword,expected);
      assertModel(upgraded.doc);
      if(compareBookVersions(before,upgraded.doc)!=='same')throw new Error('La copia no coincide con el cuaderno.');
      const savedPreferences=periodPreferences.get();
      dropboxSession.stop();
      await writeEnvelope(STATE.db,upgraded.envelope,expected);
      STATE.key=upgraded.key;STATE.salt=upgraded.salt;STATE.envelope=upgraded.envelope;
      periodPreferences.reset();await loadOrdinaryPeriods(savedPreferences);
      STATE.history=emptyHistory();STATE.exportReceipt=null;
      dialog.close();render();startDropboxSession();toast('Contraseña reforzada. Guarda y verifica una nueva copia cifrada.');
    }).catch(()=>{if(form.isConnected)err.textContent='No se ha completado el cambio. Comprueba las contraseñas, verifica una copia .cuaderno de la revisión actual y desvincula Dropbox si estaba vinculado.';}).finally(()=>{
      dialog.removeEventListener('cancel',preventClose);submit.disabled=false;cancel.disabled=false;
    });
  };
  dialog.showModal();
}

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
/** El zoom solo afecta a la tabla, nunca a menús, diálogos ni al cálculo. */
function paintNotebookZoom(context=document){
  if(STATE.tab!=='cuaderno')return;
  const table=context.querySelector('.table-scroller .grade-table');
  if(!table)return;
  table.style.setProperty('--notebook-zoom',String(STATE.notebookZoom/100));
  table.style.setProperty('--notebook-table-min-width',String(440+165*allAssessments().length)+'px');
}
let unbindGradeTableHeaders=()=>{};
function bindGradeTableHeaders(){
  unbindGradeTableHeaders();
  const table=$('.table-scroller > .grade-table');
  if(!table)return;
  const scroller=table.parentElement;
  const groups=[...table.querySelectorAll('.student-origin-group')];
  if(!groups.length)return;
  const update=()=>{
    const zoom=Number(getComputedStyle(table).zoom)||1;
    // Medir dentro de la tabla: WebKit y Chromium devuelven rectángulos distintos con zoom CSS.
    const scrollTop=scroller.scrollTop/zoom;
    const headerHeight=table.tHead.offsetHeight;
    // Los navegadores limitan sticky a la tabla completa. Acotar cada fila a su tbody.
    const offsets=groups.map(group=>Math.min(headerHeight,
      group.offsetTop+group.offsetHeight-scrollTop-group.rows[0].offsetHeight));
    groups.forEach((group,index)=>group.rows[0].style.setProperty('--origin-divider-top',offsets[index]+'px'));
  };
  update();
  const observer=new ResizeObserver(update);
  observer.observe(table);
  scroller.addEventListener('scroll',update,{passive:true});
  unbindGradeTableHeaders=()=>{
    observer.disconnect();
    scroller.removeEventListener('scroll',update);
    unbindGradeTableHeaders=()=>{};
  };
}
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
const competencySourceGrade=score=>formatGrade(score,{decimals:2,rounding:'half-up'});
function competencyLevelChip(score,sourceLabel='Media original'){
  const level=competencyAcquisitionLevel(score);
  if(level===null)return '<span class="grade-empty" aria-label="Sin evidencias">—</span>';
  const label=competencyAcquisitionLabel(score);
  return `<span class="competency-level-cell" title="Nivel ${level}: ${esc(label)} · ${esc(sourceLabel)}: ${esc(competencySourceGrade(score))} / 10">
    <span class="competency-level-badge competency-level-${level}" aria-label="Nivel ${level}: ${esc(label)}"><strong>${level}</strong><span>${esc(label)}</span></span>
    <small class="competency-source-grade${sourceLabel==='Media aritmética'?' competency-mean-source':''}">${esc(sourceLabel)}: <span class="competency-source-value">${esc(competencySourceGrade(score))} / 10</span></small>
  </span>`;
}
function competencyScaleLegend(){
  const bounds={1:'8–10',2:'6,5–menos de 8',3:'5–menos de 6,5',4:'0–menos de 5'};
  return `<div class="competency-scale-legend" role="note" aria-label="Leyenda de niveles de adquisición competencial"><strong>Escala de adquisición · 1 = máximo, 4 = mínimo</strong>
    <div class="competency-scale-items">${[1,2,3,4].map(level=>`<span class="competency-scale-item"><b class="competency-legend-number competency-level-${level}">${level}</b><span><strong>${esc(COMPETENCY_ACQUISITION_LABELS[level])}</strong><small>${esc(bounds[level])} / 10</small></span></span>`).join('')}</div>
    <p class="hint">Cada nivel se obtiene de la media original, sin redondeos previos. Sin evidencias se muestra «—». La media 0–10 sigue intacta para los cálculos.</p>
  </div>`;
}
/** Ítaca muestra siempre una nota entera; la media original conserva sus decimales. */
function itacaChip(doc,studentId,groupId,periodId){
  const score=itacaGrade(doc,studentId,groupId,periodId);
  if(score===null)return '<span class="grade-empty">—</span>';
  const specific=itacaStudentRule(doc,studentId,periodId);
  const rule=specific==='general'?itacaGroupRule(doc,groupId):specific;
  const blocked=rule==='none'?null:itacaAttitudeBlock(doc,studentId,groupId,periodId);
  return `<span class="grade-chip"${gradeStyle(score)}${blocked?' title="'+esc('Subida bloqueada: '+blocked)+'"':''}>${esc(String(score))}</span>${blocked?'<span class="itaca-guard-indicator" title="'+esc(blocked)+'" aria-label="Redondeo ascendente de Ítaca bloqueado por actitud">!</span>':''}`;
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

const visibleCategories=()=>availableCategories(STATE.doc,STATE.groupId,STATE.periodId);
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
// Paleta fija por letra de tutoría, independiente del acento de la asignatura.
const ORIGIN_PALETTE=['blue','red','green','violet','amber','orange','pink','slate','teal','indigo','lime','cyan'];
function originColorClass(value){
  const label=String(value||'').normalize('NFKC').trim().toLocaleUpperCase('es');
  // A, 1A, 1.º A, 2º Bach A y Grupo A comparten color. No interpretar
  // la última letra de nombres libres (p. ej. "Optativa") como tutoría.
  const letter=label.match(/(?:^|[\s\d.°º_-])([A-Z])$/u)?.[1];
  return 'origin-color-'+(letter?ORIGIN_PALETTE[(letter.charCodeAt(0)-65)%ORIGIN_PALETTE.length]:'neutral');
}
const originLabel=value=>value?'<span class="student-origin-badge '+originColorClass(value)+'" title="Grupo de procedencia">'+esc(value)+'</span>':'';
const studentOriginBadge=student=>originLabel(student.originGroup);
function studentOriginSelector(student,labels){
 const value=student.originGroup||'';
 const options=[...new Set([...(labels||[]),...(value?[value]:[])])];
 return `<select class="student-origin-badge student-origin-select ${originColorClass(value)}" data-student-origin="${esc(student.id)}" aria-label="Grupo de procedencia de ${esc(student.name)}" title="Cambiar grupo de procedencia">${opt('clear','Sin grupo',value?'':'clear')}${options.map(label=>opt('origin:'+label,label,value?'origin:'+value:'clear')).join('')}${opt('add','+ Añadir grupo…','')}</select>`;
}
function bindOriginSelectors(){
 const sourceKey=STATE.key,bookId=STATE.doc?.id;
 root.querySelectorAll('[data-student-origin]').forEach(select=>select.addEventListener('change',async()=>{
  const studentId=select.dataset.studentOrigin;
  const student=STATE.doc?.students.find(s=>s.id===studentId);
  if(!student||STATE.key!==sourceKey||STATE.doc.id!==bookId)return;
  const chosen=select.value,old=student.originGroup?'origin:'+student.originGroup:'clear';
  const apply=async label=>{
   if(STATE.key!==sourceKey||STATE.doc?.id!==bookId)throw Error('El cuaderno ha cambiado.');
   const live=STATE.doc.students.find(s=>s.id===studentId);
   if(!live)throw Error('Alumno inexistente.');
   const related=live.personId?STATE.doc.students.filter(s=>s.personId===live.personId&&s.id!==studentId):[];
   const needsConfirmation=related.length&&[live,...related].some(s=>(s.originGroup||'')!==label.trim());
   if(needsConfirmation&&!window.confirm('Este alumno tiene fichas vinculadas en otras asignaturas. ¿Actualizar también su procedencia, sin modificar las notas?'))return false;
   const personId=live.personId,confirmedIds=related.map(s=>s.id).sort().join('|');
   await commit(d=>{
    const target=d.students.find(s=>s.id===studentId);
    if(!target||target.personId!==personId||(personId?d.students.filter(s=>s.personId===personId&&s.id!==studentId).map(s=>s.id).sort().join('|'):'')!==confirmedIds)throw Error('Las fichas vinculadas han cambiado. Vuelve a seleccionar la procedencia.');
    assignStudentOriginGroup(d,studentId,label,{linked:!!needsConfirmation});
   },'Cambiar grupo de procedencia');
   return true;
  };
  if(chosen==='add'){
   select.value=old;
   const group=STATE.doc.groups.find(g=>g.id===student.groupId);
   fieldsModal('Añadir grupo de procedencia',[{id:'origin',label:'Etiqueta del grupo (p. ej., A o B)',value:'',maxlength:60}],async v=>{if(!v.origin.trim())throw Error('Introduce el nombre del grupo.');return await apply(v.origin);},(COURSE_SUBJECTS[group?.level]?.label||'Curso sin clasificar')+' · '+(group?.course||'')+'. El grupo estará disponible para las demás asignaturas del mismo curso escolar y nivel.');
   return;
  }
  if(chosen!=='clear'&&!chosen.startsWith('origin:')){select.value=old;return;}
  const label=chosen==='clear'?'':chosen.slice(7);
  select.disabled=true;
  try{if(!await apply(label))select.value=old;}
  catch(error){select.value=old;fail(error);}
  finally{if(select.isConnected)select.disabled=false;}
 }));
}
const originEqual=(a,b)=>String(a||'').localeCompare(String(b||''),'es',{sensitivity:'base',numeric:true})===0;
function renderGradeTableBodies(students,renderRow,columnCount,emptyMessage){
  if(!students.length)return `<tbody><tr><td class="empty-table-message" colspan="${columnCount}">${emptyMessage}</td></tr></tbody>`;
  if(STATE.studentSort!=='originGroup')return `<tbody>${students.map(renderRow).join('')}</tbody>`;
  const groups=[];
  for(const student of students){
    const group=groups.at(-1);
    if(group&&originEqual(group.name,student.originGroup))group.students.push(student);
    else groups.push({name:student.originGroup||'',students:[student]});
  }
  return groups.map(({name,students:members})=>`<tbody class="student-origin-group">
    <tr class="student-origin-divider"><th class="name-col" scope="rowgroup">
      <span>Grupo de procedencia: ${originLabel(name)||'Sin etiqueta'}</span>
      <small>${members.length} ${members.length===1?'alumno':'alumnos'}</small>
    </th><td colspan="${columnCount-1}" aria-hidden="true"></td></tr>
    ${members.map(renderRow).join('')}</tbody>`).join('');
}
function originDirectoryHeader(students,index){
  if(STATE.studentSort!=='originGroup')return '';
  const group=students[index].originGroup||'';
  if(index>0&&originEqual(group,students[index-1].originGroup||''))return '';
  return `<div class="student-directory-divider" role="heading" aria-level="3">Grupo de procedencia: ${originLabel(group)||'Sin etiqueta'}</div>`;
}

let toastTimeout;
function toast(message){if(STATE.studentPresentation)return;let el=$('#toast');if(!el){el=document.createElement('div');el.id='toast';el.className='status-message';document.body.appendChild(el);}el.textContent=message;el.classList.remove('hidden');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>el.classList.add('hidden'),4300);}
function fail(error){console.error(error);toast(error?.message||'Ha ocurrido un error.');}
function fieldsModal(title,fields,onSubmit,caption=''){
  dialog.innerHTML=`<form method="dialog" class="modal-inner" id="modal-form"><h2 id="modal-heading">${esc(title)}</h2>${caption?`<p class="subtitle">${esc(caption)}</p>`:''}<div class="modal-fields">${fields.map(f=>`<label>${esc(f.label)}${f.type==='textarea'?`<textarea class="text-field rubric-textarea" name="${esc(f.id)}" rows="7" required>${esc(f.value??'')}</textarea>`:f.type==='select'?`<select name="${esc(f.id)}" ${f.required===false?'':'required'}>${f.options.map(o=>opt(o.value,o.label,f.value)).join('')}</select>`:`<input class="text-field" name="${esc(f.id)}" type="${esc(f.type||'text')}" value="${esc(f.value??'')}" ${f.required===false?'':'required'} ${f.min!==undefined?`min="${f.min}"`:''} ${f.max!==undefined?`max="${f.max}"`:''} ${f.step?`step="${f.step}"`:''} maxlength="${f.maxlength||150}" autocomplete="off"/>`}</label>`).join('')}</div><div class="modal-error" role="alert"></div><div class="modal-actions"><button type="button" class="btn" id="close-dialog">Cancelar</button><button class="btn primary" type="submit">Guardar</button></div></form>`;
  $('#close-dialog',dialog).addEventListener('click',()=>dialog.close());
  $('#modal-form',dialog).addEventListener('submit',async e=>{
    e.preventDefault();
    const form=e.currentTarget,submit=$('[type=submit]',form);
    const data=Object.fromEntries(new FormData(form));
    submit.disabled=true;
    try{const accepted=await onSubmit(data);if(accepted!==false&&form.isConnected)dialog.close();}
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
    STATE.pending--;updateUnloadWarning();scheduleDeferredRefresh();
  });
  STATE.mutationQueue=job.catch(()=>{});
  return job;
}

function commit(action,label='Modificar cuaderno'){
  const view=currentView();
  return enqueueMutation(async()=>{
    if(!STATE.doc||!STATE.key||STATE.key!==view.key||STATE.doc.id!==view.bookId)throw new Error('El cuaderno cambió antes de guardar la acción.');
    if(STATE.saveError)throw new Error('El guardado está bloqueado por un error. No introduzcas más notas: recarga el cuaderno y revisa la situación.');
    const before=STATE.doc,next=structuredClone(before);
    action(next);assertModel(next);
    if(JSON.stringify(before)===JSON.stringify(next))return;
    // Guardar también el scroll al comenzar la escritura para que la reconstrucción
    // completa del DOM tras persistir no vuelva al principio de la página/tabla.
    const notebookScroll=label==='Editar nota'&&sameView(view)&&STATE.tab==='cuaderno'?
      {x:window.scrollX,y:window.scrollY,left:$('.table-scroller')?.scrollLeft??0,top:$('.table-scroller')?.scrollTop??0}:null;
    markBookChange(next,before);
    await persist(next);
    STATE.history=recordChange(STATE.history,before,next,label);
    STATE.doc=next;const rendered=renderAfterMutation();dropboxSession.changed();
    if(notebookScroll&&rendered&&sameView(view)){
      const restore=()=>{
        if(!sameView(view)||activePointers.size||activeEditor())return;
        const table=$('.table-scroller');
        if(table){table.scrollLeft=notebookScroll.left;table.scrollTop=notebookScroll.top;}
        window.scrollTo(notebookScroll.x,notebookScroll.y);
      };
      restore();
      requestAnimationFrame(restore);
    }
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
    render();dropboxSession.changed();toast(`${direction==='undo'?'Deshecho':'Rehecho'}: ${step.label}.`);
  });
}

function chooseInitial(){
  const group=STATE.doc.groups[0];STATE.groupId=group?.id||null;
  STATE.level=group?.level||'legacy';STATE.subject=group?group.subject:'Latín I';
  if(!group){const available=catalogForNotebook(STATE.doc).flatMap(entry=>entry.subjects.map(subject=>({level:entry.level,subject})));const selected=available.find(x=>x.level==='1bach'&&x.subject==='Latín I')||available[0];STATE.level=selected?.level||'1bach';STATE.subject=selected?.subject||'Latín I';}
  restoreOrdinaryPeriod();
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
  document.documentElement.dataset.redesign='yes';
  document.documentElement.dataset.redesignSubject=STATE.subject||'';
  if(!document.documentElement.dataset.redesignDensity){
    let saved='compact';
    try{const value=localStorage.getItem('appnotas-notebook-density');if(['compact','normal','wide'].includes(value))saved=value;}catch{}
    document.documentElement.dataset.redesignDensity=saved;
  }
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
    // El callback OAuth se consume y se elimina de la URL antes de abrir el almacén.
    let callback=null;
    if(dropboxConfigured(location.origin)){try{callback=captureDropboxCallback({location,history:window.history,storage:sessionStorage});}catch{callback=null;}}
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
    showUnlock(!STATE.envelope,callback);
    if('serviceWorker' in navigator&&location.protocol!=='file:'){
      navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(watchPwaRegistration).catch(err=>console.warn('No se ha activado el modo instalable:',err));
    }
  }catch(e){root.innerHTML=`<div class="unlock-screen"><div class="unlock-box"><h1>Error de almacenamiento</h1><p>${esc(e.message)}</p><p>No introduzcas datos hasta solucionar el problema. Usa HTTPS o localhost y permite almacenamiento local.</p></div></div>`;}
}
function showUnlock(isNew,callback=null){
  closeGradeInfo();
  clearDropboxOnboarding();
  clearSecretInputs(dialog);
  if(dialog.open)dialog.close();
  dialog.replaceChildren();
  dropboxCallback=callback?.mode===(isNew?'restore':'link')?callback:null;
  dropboxSession.stop();
  unbindGradeTableHeaders();
  periodPreferences.reset();periodGroup=null;periodBook=null;preferenceError=false;preferenceSyncState='';deferredPeriod=false;deferredRender=false;clearTimeout(refreshTimer);pendingPeriodChoices.clear();
  STATE.doc=null;STATE.key=null;STATE.salt=null;STATE.history=emptyHistory();STATE.studentPresentation=false;
  root.innerHTML=`<main class="unlock-screen"><div class="unlock-box"><div class="brand-mini">▦</div><div class="eyebrow">AppNotas · versión 1.0</div><h1>CuadernoDocente</h1>${isDropboxTest(location.origin)?'<p class="section-note"><strong>PRUEBAS: solo datos ficticios.</strong> No importes tu cuaderno real.</p>':''}<p>${isNew?'Elige un cuaderno vacío o uno de demostración con ocho alumnos ficticios. Ambos se guardan cifrados en este dispositivo.':'Desbloquea tu cuaderno local cifrado para continuar.'}</p>${STATE.reloadProbe?`<p class="${STATE.reloadProbe.ok?'section-note':'unlock-error'}" role="status">${STATE.reloadProbe.ok?'Recarga verificada: la misma copia cifrada continúa en IndexedDB. Desbloquéala para validar las notas.':'No se ha podido verificar el guardado tras recargar. Revisa el almacenamiento y no introduzcas más datos hasta comprobar la copia.'}</p>`:''}${pwaButtons()}<button type="button" class="btn unlock-help-primary" id="how-it-works" aria-label="Cómo funciona AppNotas y cómo guardar copias de seguridad">¿Cómo funciona? <span aria-hidden="true">ⓘ</span></button>${dropboxConfigured(location.origin)?`<div class="unlock-dropbox"><button class="btn dropbox-sync-btn" type="button" id="dropbox-restore-locked" aria-describedby="unlock-dropbox-hint">${dropboxIcon}${isNew?(dropboxCallback?.mode==='restore'?'Continuar recuperación de Dropbox':'Sincronizar con Dropbox'):'Desbloquear y sincronizar con Dropbox'}</button><p class="hint" id="unlock-dropbox-hint" role="status">${isNew?'¿Ya tienes un cuaderno en Dropbox? Recupéralo sin crear otro. Necesitarás su contraseña.':'Desbloquea tu cuaderno para sincronizarlo. Si aún no está vinculado, podrás hacerlo en Ajustes.'}</p></div>`:''}<form id="unlock-form"><label for="password">${isNew?'Crea una contraseña de 12 caracteres como mínimo':'Contraseña del cuaderno'}</label><input id="password" class="text-field" type="password" required minlength="12" autocomplete="off" spellcheck="false"/>${isNew?'<label for="confirm-password">Repite la contraseña</label><input id="confirm-password" class="text-field" type="password" required minlength="12" autocomplete="off" spellcheck="false"/>':''}<div id="unlock-error" class="unlock-error" role="alert"></div>${isNew?'<div class="modal-actions"><button class="btn primary" type="submit" data-create-mode="empty">Crear cuaderno vacío</button><button class="btn" type="submit" data-create-mode="demo">Crear cuaderno de demostración</button></div>':'<button class="btn primary" type="submit">Desbloquear</button>'}</form><p class="hint">La contraseña no se envía ni se almacena. Si la pierdes, no podrás recuperar los datos cifrados.</p><p class="hint">Almacena los cuadernos cifrados únicamente en dispositivos autorizados. Guarda y verifica copias de seguridad independientes en ubicaciones locales no sincronizadas. ${dropboxConfigured(location.origin)?'Dropbox es opcional y solo recibe el cuaderno cifrado cuando lo vinculas.':'No uses servicios en la nube.'}</p>${dropboxCallback?.mode==='link'?'<p class="hint">Dropbox autorizado. Desbloquea tu cuaderno para confirmar la vinculación.</p>':''}<button class="btn" id="restore-locked">Restaurar una copia cifrada</button><input class="hidden" type="file" id="restore-locked-file" accept=".cuaderno,.cdoc,.json,application/json,application/octet-stream"/>${STATE.recovery?'<div class="recovery-choice"><p class="hint">Hay una copia cifrada de rescate anterior a la última restauración.</p><button class="btn" id="recover-locked">Recuperar versión anterior</button><button class="btn" id="download-recovery-locked">Descargar copia de rescate</button></div>':''}</div></main>`;
  $('#unlock-form').addEventListener('submit',e=>{
    e.preventDefault();
    const password=$('#password').value, confirmation=$('#confirm-password')?.value, button=e.submitter||$('#unlock-form button');
    clearSecretInputs(e.currentTarget);
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
      STATE.saveError=null;STATE.history=emptyHistory();chooseInitial();await loadOrdinaryPeriods();STATE.tab='cuaderno';STATE.studentId=null;render();
      if(STATE.reloadProbe?.ok)toast('Persistencia confirmada: el cuaderno cifrado se ha recuperado y validado tras recargar.');
      STATE.reloadProbe=null;
    }catch(err){STATE.doc=null;STATE.key=null;STATE.salt=null;$('#unlock-error').textContent=err.message;button.disabled=false;}
    }).then(()=>{if(STATE.doc){if(dropboxCallback?.mode==='link')void finishDropboxLink();else{clearDropboxOnboarding();startDropboxSession();}}}).catch(fail);
  });
  wirePwaButtons();
  $('#how-it-works').onclick=()=>showInfo('¿Cómo funciona AppNotas?',`
    <div class="onboarding-guide">
      <section><h3>1. Crear y desbloquear un cuaderno</h3>
        <p>AppNotas guarda grupos, materias, actividades, notas, rúbricas y agenda en un <strong>cuaderno cifrado en este navegador</strong>. La primera vez crea una contraseña de 12 caracteres como mínimo. Apúntala en un lugar seguro: no se envía a servidores y no es recuperable.</p></section>
      <section><h3>2. Introducir notas</h3>
        <p>En <strong>Cuaderno</strong>, selecciona la materia y el grupo y utiliza <strong>+ Alumno</strong> o <strong>+ Actividad</strong>. Dentro de <strong>Acciones de la tabla</strong> puedes importar alumnado, crear recuperaciones, copiar actividades o programar exámenes. Puedes configurar categorías, porcentajes, escalas de 0–10 u otras, rúbricas y las reglas de evaluación. Una casilla vacía no es un cero; <strong>NP</strong> indica no presentado y computa como cero; <strong>AJ</strong> es ausencia justificada pendiente y no computa.</p></section>
      <section><h3>3. Consultar el resultado</h3>
        <p>En <strong>Modo sesión de evaluación</strong> puedes consultar individualmente las calificaciones del alumno seleccionado, por trimestre y categoría, sin mostrar simultáneamente las fichas de los demás. En el cuaderno tienes accesos directos a <strong>Cálculos</strong>, <strong>Competencias</strong> y <strong>Evaluación final</strong>. La evaluación final calcula las medias según la configuración del grupo. Las competencias se muestran con niveles: 1 (adquisición alta, 8–10), 2 (media, de 6,5 a menos de 8), 3 (baja, de 5 a menos de 6,5) y 4 (no adquirida, nota inferior a 5). La media original se conserva.</p></section>
      <section><h3>4. Utilizar la agenda</h3>
        <p>El horario base trae siete horas de clase y dos patios. Toca una franja para asignar una materia del cuaderno o escribir otra, indica el aula y personaliza los intervalos. La agenda permite añadir exámenes, clases, tareas y festivos.</p></section>
      <section class="onboarding-critical"><h3>5. Guardar y comprobar una copia de seguridad</h3>
        <p>El guardado automático protege los cambios <strong>en este dispositivo y navegador</strong>. ${dropboxConfigured(location.origin)?'Si vinculas Dropbox, la sincronización de copias cifradas funciona con el cuaderno desbloqueado y la aplicación activa. No sustituye las copias independientes.':'No hay sincronización entre móviles y ordenadores.'} El navegador podría borrar los datos, por lo que debes hacer copias externas:</p>
        <ol><li>Abre <strong>Ajustes y copias → Configuración y copias cifradas → Copias de seguridad cifradas</strong> o utiliza <strong>Cerrar cuaderno</strong> para exportar un archivo <code>.cuaderno</code>.</li>
        <li>Guárdalo <strong>solo en un destino local</strong> —por ejemplo, «En mi iPad», «En mi iPhone», la carpeta local del ordenador o una memoria USB— y conserva <strong>dos copias locales en lugares distintos</strong>. Evita iCloud Drive, OneDrive y carpetas sincronizadas.</li>
        <li>Vuelve a seleccionarlo en <strong>Verificar copia</strong> e introduce la contraseña: descargar no basta para asegurar que es recuperable.</li>
        <li>Si cambias de dispositivo o de navegador, utiliza <strong>Restaurar copia</strong> desde el archivo verificado. La restauración sustituye el cuaderno local después de las advertencias pertinentes.</li></ol>
        <p><strong>Frecuencia recomendada:</strong> al menos semanalmente, después de introducir muchas notas y al cerrar una evaluación. La aplicación no puede detectar si la carpeta elegida se sincroniza con la nube: compruébalo en los ajustes del sistema.</p></section>
      <section><h3>6. Instalación y uso sin conexión</h3>
        <p>Instala la PWA desde la web oficial de Cloudflare. El modo sin conexión requiere que los recursos se hayan almacenado antes; compruébalo en Ajustes. Instalar la aplicación no es una copia de seguridad ni sincroniza los datos.</p></section>
      <section><h3>7. Privacidad y precauciones</h3>
        <p>Las notas no se envían al servidor de Cloudflare: quedan cifradas localmente. ${dropboxConfigured(location.origin)?'Dropbox recibe exclusivamente una copia cifrada al vincularlo. Una contraseña fuerte y un dispositivo íntegro son imprescindibles.':''} <strong>No uses información real de alumnado</strong> hasta que la aplicación tenga la autorización institucional y la evaluación de protección de datos que corresponda. Nunca compartas tu contraseña ni exportes archivos sin cifrar que incluyan datos personales.</p></section>
    </div>`);
  $('#dropbox-restore-locked')?.addEventListener('click',()=>{
    if(!isNew){
      $('#unlock-dropbox-hint').textContent='Introduce la contraseña de tu cuaderno local y pulsa Desbloquear. Si Dropbox está vinculado, se sincronizará automáticamente.';
      $('#password').focus();return;
    }
    if(dropboxCallback?.mode==='restore')void finishDropboxRestore().catch(()=>toast('No se pudo recuperar Dropbox.'));
    else void navigateDropbox('restore').catch(()=>toast('No se pudo iniciar la autorización de Dropbox.'));
  });
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
    const input=$('#backup-password',dialog);
    const cancelled=()=>{if(dialog.open)return;input.value='';dialog.removeEventListener('close',cancelled);resolve(null);};
    dialog.addEventListener('close',cancelled);
    $('#cancel-backup-password',dialog).onclick=()=>{input.value='';dialog.close();};
    $('#backup-password-form',dialog).onsubmit=e=>{
      e.preventDefault();const secret=input.value;input.value='';
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
    await adoptRestoredNotebook(replacement,recovery,opened,doc);
    toast(recovery?'Importación completada. Versión local anterior conservada como rescate cifrado.':'Importación completada. Copia íntegra y validada.');
  });
}
async function adoptRestoredNotebook(envelope,recovery,opened,doc){
  periodPreferences.reset();periodGroup=null;periodBook=null;deferredPeriod=false;deferredRender=false;clearTimeout(refreshTimer);pendingPeriodChoices.clear();
  clearDropboxOnboarding();dropboxSession.stop();dropboxStatus='not-linked';
  STATE.envelope=envelope;STATE.recovery=recovery;
  STATE.doc=doc;STATE.key=opened.key;STATE.salt=opened.salt;STATE.saveError=null;
  STATE.history=emptyHistory();chooseInitial();await loadOrdinaryPeriods(opened.preferences);STATE.tab='cuaderno';STATE.studentId=null;render();
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
    await adoptRestoredNotebook(replacement,recovery,{key:STATE.key,salt:STATE.salt},blank);
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
    await adoptRestoredNotebook(replacement,previous,opened,upgraded.doc);
    toast('Cuaderno anterior recuperado y validado. La otra versión sigue cifrada como rescate.');
  });
}

/** Preparar después del guardado; el gesto posterior sobre «Guardar archivo» abre
 * el selector de sistema antes de cualquier await, necesario en Safari/iOS.
 */
async function closeNotebook(){
  await STATE.mutationQueue;await STATE.saveQueue;
  if(!STATE.doc||!STATE.key||STATE.saveError||STATE.failedEnvelope)throw new Error('No se puede cerrar: hay cambios sin guardar. Conserva el cuaderno local y resuelve el error.');
  const doc=STATE.doc,key=STATE.key,salt=STATE.salt.slice(),expected=STATE.envelope,db=STATE.db;
  const stillCurrent=()=>STATE.doc===doc&&STATE.key===key&&sameEnvelope(STATE.envelope,expected)&&!STATE.pending&&!STATE.saveError&&!STATE.failedEnvelope;
  if(!sameEnvelope(await readEnvelope(db),expected)||!stillCurrent())throw new Error('El cuaderno cambió. Repite la preparación de la copia.');
  const snapshot=structuredClone(doc);
  const exportedDate=new Date();
  const preferences=await periodPreferences.load().catch(()=>null);
  const prepared=await createPortableCopy(snapshot,key,salt,exportedDate,preferences);
  if(!sameEnvelope(await readEnvelope(db),expected)||!stillCurrent())throw new Error('El cuaderno cambió durante la preparación. Repite la copia.');
  if(prepared.preferencesOmitted||!preferences)toast('La copia de las notas es válida; no ha sido posible incluir las preferencias de evaluación.');
  const filename=portableFilename(exportedDate);
  if(dialog.open)throw new Error('Cierra el diálogo actual para exportar.');
  dialog.innerHTML=`<div class="modal-inner portable-dialog"><h2 id="modal-heading">Cerrar cuaderno · copia cifrada</h2><p>Los cambios se han guardado en este dispositivo. La copia completa está cifrada con la contraseña de este cuaderno.</p><p><strong>${esc(filename)}</strong></p><p class="hint"><strong>Solo almacenamiento local autorizado por el centro:</strong> elige «En mi iPad» / «En mi iPhone», una carpeta local del ordenador o un USB sin sincronización. No elijas iCloud Drive, OneDrive ni carpetas sincronizadas. ${dropboxConfigured(location.origin)?'Esta exportación es independiente de Dropbox; no confirma que se haya completado la sincronización.':'Esta aplicación no accede a ninguna nube ni confirma la sincronización posterior.'}</p><p id="close-result" class="hint" role="status">El cuaderno local permanece intacto aunque canceles.</p><div class="modal-actions portable-choices"><button class="btn" id="close-cancel">Cancelar</button><button class="btn primary" id="close-save">Guardar archivo cifrado</button><button class="btn hidden" id="close-lock">Bloquear cuaderno</button></div></div>`;
  $('#close-cancel',dialog).onclick=()=>{dialog.close();toast('Exportación cancelada. El cuaderno local permanece guardado.');};
  $('#close-save',dialog).onclick=()=>savePreparedCopy(prepared,filename,{expected,key,db,doc});
  dialog.showModal();
}
function preparedSaveCompleted(){
  const back=$('#close-cancel',dialog),lock=$('#close-lock',dialog);
  if(back){back.textContent='Volver al cuaderno';back.onclick=()=>dialog.close();}
  if(lock){lock.classList.remove('hidden');lock.onclick=()=>{dialog.close();showUnlock(false);toast('Cuaderno bloqueado. La copia local cifrada permanece en el dispositivo.');};}
}
async function savePreparedCopy(prepared,filename,source){
  const button=$('#close-save',dialog),message=$('#close-result',dialog);
  if(button.disabled)return;
  button.disabled=true;
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
        if(STATE.key!==source.key||STATE.doc!==source.doc||!sameEnvelope(STATE.envelope,source.expected))throw Error('La revisión actual ya no coincide con el archivo.');
        await recordExportReceipt(source.db,receipt,source.expected);
        if(STATE.key===source.key&&STATE.doc===source.doc)STATE.exportReceipt=receipt;
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


/** Navegación minimalista: destinos diarios y un menú de herramientas.
 * Las cinco vistas del cuaderno siguen existiendo como navegación secundaria. */
const workspaceDisclosures={tools:false,course:false,group:false,academic:false};
const WORKSPACE_ICONS={
  cuaderno:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11M15 9v11M3 14h18"/>',
  planificador:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 14h2m4 0h2m-8 3h2"/>',
  evaluaciones:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M8 10l2 2 4-4M8 16h8"/>',
  extraescolares:'<path d="M3 8h18v12H3zM8 8V5h8v3M3 13h18M10 13v2h4v-2"/>',
  curriculo:'<path d="M3 5c4-1 7 0 9 2v14c-2-2-5-3-9-2zM21 5c-4-1-7 0-9 2v14c2-2 5-3 9-2z"/>',
  rubricas:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="m7 8 1 1 2-2m-3 7 1 1 2-2m3-4h4m-4 6h4"/>',
  recursos:'<path d="M4 6h16v14H4zM8 6V3h8v3M4 11h16"/>',
  plegar:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  deshacer:'<path d="m8 5-5 5 5 5M3 10h11a5 5 0 0 1 0 10"/>',
  rehacer:'<path d="m16 5 5 5-5 5m5-5H10a5 5 0 0 0 0 10"/>'
};
function workspaceIcon(key){
  return '<svg class="workspace-icon" aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+WORKSPACE_ICONS[key]+'</svg>';
}
const PRIMARY_WORKSPACE_TABS=[
  ['cuaderno','Cuaderno'],
  ['planificador','Agenda'],
  ['evaluaciones','Evaluaciones'],
  ['extraescolares','Extraescolares']
];
const ACADEMIC_WORKSPACE_TABS=[
  ['curriculo','Currículo'],
  ['rubricas','Rúbricas']
];
const NOTEBOOK_WORKSPACE_TABS=[
  ['cuaderno','Notas'],
  ['calculos','Cálculos'],
  ['competencias','Competencias'],
  ['alumno','Vista alumno']
];
function workspaceTab([key,label]){
  const active=STATE.tab===key||
    (key==='cuaderno'&&['calculos','competencias','final','alumno'].includes(STATE.tab));
  return `<button type="button" data-tab="${key}" class="tab ${active?'active':''}" ${active?'aria-current="page"':''} title="${label}"><span class="nav-glyph" aria-hidden="true">${workspaceIcon(key)}</span><span class="nav-text">${label}</span></button>`;
}
function renderNavigation(){
  const toolsSelected=ACADEMIC_WORKSPACE_TABS.some(([key])=>STATE.tab===key);
  return `<nav class="tabs" aria-label="Navegación principal">
    <button type="button" class="nav-collapse" id="toggle-navigation" aria-label="Plegar o desplegar navegación" aria-expanded="${!STATE.navCollapsed}" title="Plegar o desplegar menú"><span class="nav-collapse-glyph" aria-hidden="true">${workspaceIcon('plegar')}</span><span class="nav-text">Menú</span></button>
    <div class="nav-primary" role="group" aria-label="Trabajo diario">${PRIMARY_WORKSPACE_TABS.map(workspaceTab).join('')}</div>
    <div class="nav-secondary">
      <details class="academic-disclosure" data-shell-disclosure="academic" ${toolsSelected||workspaceDisclosures.academic?'open':''}>
        <summary title="Abrir recursos académicos"><span class="nav-glyph" aria-hidden="true">${workspaceIcon('recursos')}</span><span class="nav-text">Recursos</span><span class="disclosure-chevron" aria-hidden="true">⌄</span></summary>
        <div class="nav-academic-links" role="group" aria-label="Recursos académicos">${ACADEMIC_WORKSPACE_TABS.map(workspaceTab).join('')}</div>
      </details>
    </div>
  </nav>`;
}
/** Cuaderno, Cálculos, Competencias, Final y Vista alumno comparten contexto
 * de grupo; cada destino conserva su motor y acciones originales. */
function renderAcademicQuickNav(){
  return `<nav class="academic-quick-nav" aria-label="Vistas del cuaderno">
    ${NOTEBOOK_WORKSPACE_TABS.map(([key,label])=>
      `<button type="button" class="btn small ${STATE.tab===key?'academic-quick-active':''}"
        data-academic-quick="${key}" aria-pressed="${STATE.tab===key}"
        ${STATE.tab===key?'aria-current="page"':''}>${label}</button>`).join('')}
  </nav>`;
}
function renderPeriodButtons(){
  const periods=[...STATE.doc.periods].sort((a,b)=>a.order-b.order);
  const periodButton=p=>`<span class="term-item ${['cuaderno','calculos','competencias'].includes(STATE.tab)&&STATE.periodId===p.id?'active':''}"><button type="button" class="term-button ${['cuaderno','calculos','competencias'].includes(STATE.tab)&&STATE.periodId===p.id?'active':''}" data-period-choice="${esc(p.id)}" aria-pressed="${['cuaderno','calculos','competencias'].includes(STATE.tab)&&STATE.periodId===p.id}" title="Seleccionar ${esc(p.name)} (doble clic para gestionar)">${esc(p.name)}</button><button type="button" class="term-edit" data-rename-period="${esc(p.id)}" aria-label="Gestionar ${esc(p.name)}" title="Renombrar, reordenar o eliminar ${esc(p.name)}">✎</button></span>`;
  const lastPeriod=periods.at(-1);
  // El último período y la evaluación final forman un mismo bloque visual,
  // también en el diseño móvil de dos columnas.
  const finalButton=`<button type="button" class="term-button term-final ${STATE.tab==='final'?'active':''}" data-academic-quick="final" aria-pressed="${STATE.tab==='final'}" ${STATE.tab==='final'?'aria-current="page"':''}>Evaluación final</button>`;
  return `<nav class="term-bar" aria-label="Períodos de calificación"><div class="term-buttons" role="group" aria-label="Períodos">${periods.slice(0,-1).map(periodButton).join('')}<span class="term-last-and-final">${lastPeriod?periodButton(lastPeriod):''}${finalButton}</span><button type="button" class="term-add" id="new-period" aria-label="Añadir período" title="Crear período">+ <span>Período</span></button></div></nav>${STATE.tab==='cuaderno'?renderNotebookEvaluationNotice(STATE.doc,STATE.groupId,STATE.periodId):''}`;
}
function render(){
  closeGradeInfo();
  if(!STATE.doc)return;
  ensurePlanner(STATE.doc);
  if(!STATE.level){chooseInitial();}
  const matching=groupsForSubject();
  if(!matching.some(g=>g.id===STATE.groupId))STATE.groupId=matching[0]?.id||null;
  if(periodBook!==STATE.doc.id||periodGroup!==STATE.groupId||!currentPeriod())restoreOrdinaryPeriod();
  deferredRender=false;applyDeferredPeriod();
  const period=currentPeriod();
  const group=currentGroup();
  applyTheme();
  unbindClassStats();
  unbindGradeTableHeaders();
  if(STATE.studentPresentation){
    root.innerHTML=`<main class="student-presentation">${renderStudentView()}</main>`;
    bindStudentView();
    paintGrades(root);
    paintStudentCategoryCards(root);
    return;
  }
  // Cada boton corresponde a una materia concreta, no solo a una etapa:
  // elegir entre Latin y Griego nunca depende de un segundo desplegable.
  const courseChoices=[...catalogForNotebook(STATE.doc).flatMap(({level,label,subjects})=>subjects.map(subject=>({
    level,subject,subjectName:subject,stage:label,
    groupNames:STATE.doc.groups.filter(g=>g.level===level&&g.subject===subject).map(g=>g.name)
  }))), ...[...new Set(STATE.doc.groups.filter(g=>g.level===null).map(g=>g.subject))].map(subject=>({
    level:'legacy',subject,subjectName:subject||'Sin asignatura',stage:'Sin clasificar',
    groupNames:STATE.doc.groups.filter(g=>g.level===null&&g.subject===subject).map(g=>g.name)
  }))];
  const subjectLabel=STATE.subject||'Sin asignatura';
  const levelLabel=COURSE_SUBJECTS[STATE.level]?.label||'Sin clasificar';
  const hasGroup=!!STATE.groupId;
  const color=STATE.level==='legacy'?'#F59E0B':colorFor(STATE.level,STATE.subject);
  root.innerHTML=`<div class="shell ${STATE.tab==='alumno'&&STATE.studentId?'student-focus':''} ${STATE.navCollapsed?'nav-collapsed':''}"><header class="topbar"><div class="brand"><div class="brand-mark" aria-hidden="true"><svg viewBox="0 0 48 48" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12h30M12 16h24M15 19v17m9-17v17m9-17v17M9 39h30M12 36h24M12 12c1-5 6-8 12-8s11 3 12 8"/><path d="M19 12h10"/></svg></div><div class="brand-copy"><strong>AppNotas</strong><small>CuadernoDocente · Agenda y evaluación</small></div></div><div class="topmeta"><span class="pill security-pill" title="Cuaderno guardado cifrado en el dispositivo">🔒 Cifrado local</span><span id="save-status" role="status" class="pill status ok">Guardado cifrado</span>
  <div class="history-actions" role="group" aria-label="Historial de cambios"><button type="button" class="btn small" id="undo-change" aria-label="Deshacer" title="Deshacer último cambio (Ctrl/Cmd+Z)" ${STATE.history.past.length?'':'disabled'}>${workspaceIcon('deshacer')}<span class="history-label">Deshacer</span></button><button type="button" class="btn small" id="redo-change" aria-label="Rehacer" title="Rehacer (Ctrl/Cmd+Mayús+Z)" ${STATE.history.future.length?'':'disabled'}>${workspaceIcon('rehacer')}<span class="history-label">Rehacer</span></button></div>
    <button type="button" class="btn dropbox-sync-btn" id="dropbox-sync" aria-label="Dropbox">${dropboxIcon}<span class="dropbox-label">Dropbox</span></button><button class="lock-btn" id="lock">Bloquear</button>
</div><details class="header-tools" data-shell-disclosure="tools" ${workspaceDisclosures.tools?'open':''}><summary aria-label="Ajustes y copias" title="Ajustes y copias" class="${STATE.tab==='ajustes'?'settings-active':''}"><svg class="settings-gear" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3h2l.6 2.4 1.6.9 2.4-.7 2 3.5-1.8 1.8v2.2l1.8 1.8-2 3.5-2.4-.7-1.6.9L14 21h-4l-.6-2.4-1.6-.9-2.4.7-2-3.5 1.8-1.8v-2.2L3.4 9.1l2-3.5 2.4.7 1.6-.9L10 3z"/><circle cx="12" cy="12" r="3"/></svg><span class="settings-label">Ajustes y copias</span></summary>
    <div class="header-tools-panel"><div class="settings-panel-title"><strong>Ajustes y copias</strong><button type="button" class="btn" id="close-header-tools" aria-label="Cerrar ajustes">×</button></div>
      <div class="header-tools-heading">Apariencia</div><label class="theme-picker">Tema <select id="theme-select" aria-label="Modo de apariencia">${[['light','Claro'],['dark','Oscuro'],['oled','OLED']].map(([k,v])=>opt(k,v,STATE.theme)).join('')}</select></label>
      <div class="header-tools-heading">Cuaderno y copias</div><div class="portable-controls" role="group" aria-label="Copias de cuaderno"><button type="button" class="btn small" id="open-notebook">Abrir cuaderno</button><button type="button" class="btn small ${STATE.tab==='ajustes'?'settings-current':''}" data-tab="ajustes" ${STATE.tab==='ajustes'?'aria-current="page"':''}>Configuración y copias cifradas</button><button type="button" class="btn topbar-close-btn" id="close-notebook" title="Guardar una copia cifrada y cerrar el cuaderno">Cerrar cuaderno</button></div>
      <div class="header-tools-heading">Aplicación</div>${pwaButtons()}
    </div>
  </details></header><main class="content"><div class="workspace">${renderNavigation()}<div class="work-area">${!['planificador','evaluaciones','extraescolares'].includes(STATE.tab)?`<div class="headrow"><div><div class="eyebrow">${esc(CLASSICAL_SKIN_TITLES[classicalSkinFor(STATE.level,STATE.subject)])} · CUADERNO ACADÉMICO · v1.0</div><h1>${STATE.tab==='ajustes'?'Ajustes y copias':STATE.tab==='evaluaciones'?'Sesiones de evaluación':esc(subjectLabel)+' <span class="muted-slash">/</span> '+esc(group?.name||'Sin grupo')}</h1><p class="subtitle">${STATE.tab==='ajustes'?'Preferencias generales y almacenamiento cifrado local':STATE.tab==='evaluaciones'?'Organización por tutorías y evaluaciones · Almacenamiento cifrado local':esc(levelLabel)+' · '+esc(group?.course||'Curso escolar por configurar')+' · '+esc(period?.name||'')+' · Almacenamiento cifrado local'}</p></div><span class="demo-tag">⚠ Copias solo en almacenamiento local</span></div>`:'' }<p id="portable-status" class="portable-status" role="status" aria-live="polite"></p><input type="file" id="open-notebook-file" class="hidden" accept=".cuaderno,.cdoc,application/octet-stream,application/json"/><div class="toolbar class-toolbar" aria-label="Asignatura y grupo" ${['planificador','extraescolares','ajustes'].includes(STATE.tab)?'hidden':''}>
  <div class="selectors">
    <div class="course-switch" role="group" aria-label="Seleccionar asignatura" title="Selecciona una asignatura">
      <div class="course-buttons">${courseChoices.map(x=>`<button type="button" class="btn course-choice" data-course-level="${esc(x.level)}" data-course-subject="${esc(x.subject)}" aria-pressed="${STATE.level===x.level&&STATE.subject===x.subject}" title="${esc(x.subjectName+' · '+x.stage)}"><strong class="course-name">${esc(x.subjectName)}</strong><small class="course-group-caption" title="${esc(x.groupNames.join(' · ')||'Sin grupo creado')}">${esc(x.groupNames.length?x.groupNames.join(' · '):'Sin grupo · crear grupo')}</small></button>`).join('')}</div>
    </div>
    ${matching.length>2?`<div class="group-switch group-switch-compact"><label class="group-switch-label" for="group-quick-select">Grupo</label><select id="group-quick-select" class="group-quick-select" aria-label="Seleccionar grupo de ${esc(subjectLabel)}">${matching.map(x=>`<option value="${esc(x.id)}" ${x.id===STATE.groupId?'selected':''}>${esc(x.name)} · ${esc(x.course)}</option>`).join('')}</select></div>`:matching.length>1?`<div class="group-switch" role="group" aria-label="Seleccionar grupo de ${esc(subjectLabel)}"><span class="group-switch-label">Grupos</span><div class="group-buttons">${matching.map(x=>`<button type="button" class="btn group-choice" data-group-choice="${esc(x.id)}" aria-pressed="${x.id===STATE.groupId}">${esc(x.name)}</button>`).join('')}</div></div>`:''}
  </div>
  <div class="actions class-more-actions">
    <details class="group-actions-disclosure" data-shell-disclosure="group" ${workspaceDisclosures.group?'open':''}>
      <summary>Materias y grupos <span class="disclosure-chevron" aria-hidden="true">⌄</span></summary>
      <div class="group-actions-panel">
        <div class="action-group" role="group" aria-labelledby="subject-actions-label">
          <span class="action-group-label" id="subject-actions-label">Materias</span>
          <button class="btn small" id="manage-subjects">Gestionar materias</button>
          ${STATE.level==='legacy'?'':`<label class="color-select-label">Color de acento<input id="accent-select" type="color" value="${esc(color)}" aria-label="Color de acento para ${esc(subjectLabel)}"/></label>`}
        </div>
        <div class="action-group" role="group" aria-labelledby="group-actions-label">
          <span class="action-group-label" id="group-actions-label">Grupos</span>
          <button class="btn small" id="new-group" ${STATE.level==='legacy'?'disabled':''}>+ Crear grupo</button>
          <button class="btn small" id="edit-group" ${hasGroup?'':'disabled'} title="Editar nombre y curso escolar del grupo">Gestionar grupo</button>
          ${group?.level===null?'<button class="btn" id="classify-group">Clasificar grupo</button>':''}
        </div>
        <div class="action-group" role="group" aria-labelledby="shared-students-label">
          <span class="action-group-label" id="shared-students-label">Entre asignaturas</span>
          <button type="button" class="btn student-link-toolbar-action" id="manage-shared-students" title="Relacionar fichas de una misma persona que cursa dos asignaturas">Vincular alumnos</button>
        </div>
      </div>
    </details>
    <input type="file" id="csv-file" class="hidden" accept=".csv,text/csv"/>
  </div>
</div>${hasGroup&&['cuaderno','calculos','competencias','final','alumno'].includes(STATE.tab)?renderAcademicQuickNav():''}${hasGroup&&['cuaderno','calculos','competencias','final','alumno'].includes(STATE.tab)?renderPeriodButtons():''}<div id="tab-content">${!hasGroup&&STATE.tab!=='ajustes'&&STATE.tab!=='rubricas'&&STATE.tab!=='curriculo'&&STATE.tab!=='planificador'&&STATE.tab!=='evaluaciones'&&STATE.tab!=='extraescolares'?`<section class="panel panel-pad no-group-state"><h2>No hay grupos de ${esc(subjectLabel)}</h2><p>Selecciona otro grupo o crea uno nuevo para esta asignatura. No se mezclarán las calificaciones de materias distintas.</p>${STATE.level==='legacy'?'<p>Clasifica primero el grupo anterior para utilizarlo en uno de los cursos disponibles.</p>':'<button class="btn primary" id="new-group-empty">+ Crear primer grupo</button>'}</section>`:STATE.tab==='cuaderno'?renderNotebook():STATE.tab==='planificador'?renderPlanner(STATE.doc,STATE):STATE.tab==='evaluaciones'?renderEvaluationWorkspace(STATE.doc,STATE):STATE.tab==='extraescolares'?renderExtracurricular(STATE.doc,esc):STATE.tab==='alumno'?renderStudentView():STATE.tab==='final'?renderFinalEvaluation():STATE.tab==='calculos'?renderRules():STATE.tab==='rubricas'?renderRubrics():STATE.tab==='competencias'?renderCompetencies():STATE.tab==='curriculo'?renderCurriculum():renderSettings()}</div></div></div></main></div>`;
  bindCommon();
  paintDropboxStatus();
  wirePwaButtons();
  updatePortableStatus();
  // Mantener visible la pestaña y la materia activa tras recrear el DOM.
  // Desplazamiento solo horizontal, sin saltos verticales en iPhone/iPad.
  const revealSelectedButton=(strip,button)=>{
    if(!strip||!button)return;
    const outer=strip.getBoundingClientRect(),inner=button.getBoundingClientRect();
    if(inner.left<outer.left)strip.scrollLeft+=inner.left-outer.left-8;
    else if(inner.right>outer.right)strip.scrollLeft+=inner.right-outer.right+8;
  };
  revealSelectedButton($('.tabs'),$('.tabs .tab.active'));
  revealSelectedButton($('.course-buttons'),$('.course-buttons .course-choice[aria-pressed="true"]'));
  revealSelectedButton($('.academic-quick-nav'),$('.academic-quick-nav .academic-quick-active'));
  if(!hasGroup&&STATE.tab!=='ajustes'&&STATE.tab!=='rubricas'&&STATE.tab!=='curriculo'&&STATE.tab!=='planificador'&&STATE.tab!=='evaluaciones'&&STATE.tab!=='extraescolares'){$('#new-group-empty')?.addEventListener('click',()=>$('#new-group').click());}
  else if(STATE.tab==='cuaderno')bindNotebook();
  else if(STATE.tab==='planificador'){const api=bindPlanner(STATE.doc,STATE,{
    render,commit,fieldsModal,dialog,toast,fail,showInfo,getDoc:()=>STATE.doc,
    openEvaluations:()=>{STATE.evaluationWorkspaceTab='sesiones';STATE.tab='evaluaciones';render();}
   });if(STATE.plannerEventRequest){const request=STATE.plannerEventRequest;STATE.plannerEventRequest=null;api.eventModal(request);}}
  else if(STATE.tab==='evaluaciones')bindEvaluationWorkspace(STATE.doc,STATE,{
    render,commit,fieldsModal,dialog,toast,fail,getDoc:()=>STATE.doc,
    openStudentLinks:()=>openStudentLinksManager({
      dialog,getDoc:()=>STATE.doc,commit,toast,fail,groupId:STATE.groupId,
      defaultYear:activeYear(STATE.doc).name
    })
  });
  else if(STATE.tab==='extraescolares')bindExtracurricular({root,dialog,doc:STATE.doc,getDoc:()=>STATE.doc,commit,fail,esc,state:STATE});
  else if(STATE.tab==='alumno')bindStudentView();
  else if(STATE.tab==='final')bindFinalEvaluation();
  else if(STATE.tab==='rubricas')bindRubrics();
  else if(STATE.tab==='calculos')bindRules();
  else if(STATE.tab==='competencias')bindCompetencies();
  else if(STATE.tab==='curriculo')bindCurriculum();
  else if(STATE.tab==='ajustes')bindSettings();
  paintGrades(root);
  paintCategoryColumns(root);
  paintNotebookZoom(root);
  bindGradeTableHeaders();
  paintStudentCategoryCards(root);
  bindClassStatistics();
  setStatus();
}

// Una sola capa fuera de la tabla: no aumenta las filas ni se recorta por overflow.
let gradeInfo=null,gradeInfoLeave=null;
function closeGradeInfo(){
 clearTimeout(gradeInfoLeave);gradeInfoLeave=null;
 if(!gradeInfo)return;
 const {button,layer}=gradeInfo;gradeInfo=null;
 button.setAttribute('aria-expanded','false');button.removeAttribute('aria-describedby');
 layer.remove();
}
function delayCloseGradeInfo(){
 clearTimeout(gradeInfoLeave);
 if(gradeInfo&&!gradeInfo.pinned)gradeInfoLeave=setTimeout(()=>{if(!gradeInfo?.pinned)closeGradeInfo();},160);
}
function showGradeInfo(button,pinned=false){
 if(!button.isConnected||!button.dataset.gradeInfo||!STATE.doc||STATE.studentPresentation)return;
 clearTimeout(gradeInfoLeave);
 if(gradeInfo?.button===button){if(pinned)gradeInfo.pinned=true;return;}
 closeGradeInfo();
 const layer=document.createElement('div');
 layer.id='grade-info-popover';layer.className='grade-info-popover';layer.setAttribute('role','tooltip');
 layer.textContent=button.dataset.gradeInfo;
 document.body.append(layer);
 gradeInfo={button,layer,pinned};
 button.setAttribute('aria-expanded','true');button.setAttribute('aria-describedby',layer.id);
 positionGradeInfo();
 layer.addEventListener('pointerenter',()=>clearTimeout(gradeInfoLeave));
 layer.addEventListener('pointerleave',delayCloseGradeInfo);
}
function positionGradeInfo(){
 if(!gradeInfo)return;
 const {button,layer}=gradeInfo;
 if(!button.isConnected){closeGradeInfo();return;}
 const r=button.getBoundingClientRect(),v=window.visualViewport;
 const left=v?.offsetLeft||0,top=v?.offsetTop||0,width=v?.width||window.innerWidth,height=v?.height||window.innerHeight;
 const scroller=button.closest('.table-scroller')?.getBoundingClientRect();
 const visible={left:Math.max(left,scroller?.left??left),right:Math.min(left+width,scroller?.right??left+width),top:Math.max(top,scroller?.top??top),bottom:Math.min(top+height,scroller?.bottom??top+height)};
 if(r.right<=visible.left||r.left>=visible.right||r.bottom<=visible.top||r.top>=visible.bottom){closeGradeInfo();return;}
 layer.style.maxWidth=Math.max(80,Math.min(320,width-24))+'px';
 const size=layer.getBoundingClientRect();
 const x=Math.max(left+8,Math.min(r.left+r.width/2-size.width/2,left+width-size.width-8));
 const y=r.bottom+6+size.height<=top+height-8?r.bottom+6:Math.max(top+8,r.top-size.height-6);
 layer.style.left=x+'px';layer.style.top=y+'px';
}
function bindGradeInfo(){
 root.querySelectorAll('[data-grade-info]').forEach(button=>{
  button.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse')showGradeInfo(button);});
  button.addEventListener('pointerleave',delayCloseGradeInfo);
  button.addEventListener('focus',()=>{if(button.matches(':focus-visible'))showGradeInfo(button);});
  button.addEventListener('blur',()=>{if(gradeInfo?.button===button)closeGradeInfo();});
  button.addEventListener('click',()=>{
   if(gradeInfo?.button===button&&gradeInfo.pinned)closeGradeInfo();
   else showGradeInfo(button,true);
  });
 });
}
document.addEventListener('pointerdown',event=>{if(gradeInfo&&!gradeInfo.button.contains(event.target)&&!gradeInfo.layer.contains(event.target))closeGradeInfo();},true);
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&gradeInfo){closeGradeInfo();event.preventDefault();event.stopPropagation();}},true);
// Un scroll previo al hover puede notificarse después del pointerenter.
// Reubicar, no cerrar, mientras el anclaje sigue visible.
window.addEventListener('scroll',positionGradeInfo,true);
window.addEventListener('resize',positionGradeInfo);
window.visualViewport?.addEventListener('scroll',positionGradeInfo);
window.visualViewport?.addEventListener('resize',positionGradeInfo);
document.addEventListener('visibilitychange',()=>{if(document.hidden)closeGradeInfo();});

function renderNotebook(){
  const assessments=allAssessments(),students=allStudents(),originOptions=originGroupOptions(STATE.doc,STATE.groupId);
  const visibleIds=new Set(assessments.map(a=>a.id));
  const gradeObservationsByPair=new Map((STATE.doc.gradeObservations??[]).map(note=>[note.studentId+'|'+note.assessmentId,note]));
  // Índices locales al render: evitar búsquedas lineales por cada celda.
  const studentsById=new Map(students.map(student=>[student.id,student]));
  const assessmentsById=new Map(assessments.map(assessment=>[assessment.id,assessment]));
  const observationButton=(studentId,assessmentId)=>{
    const note=gradeObservationsByPair.get(studentId+'|'+assessmentId);
    const student=studentsById.get(studentId);
    const activity=assessmentsById.get(assessmentId);
    const label=note?'Editar observación':'Añadir observación';
    return `<button type="button" class="grade-observation-button ${note?'has-observation':''}" data-observation-student="${esc(studentId)}" data-observation-assessment="${esc(assessmentId)}" aria-label="${label} de ${esc(student?.name||'alumno')} en ${esc(activity?.name||'actividad')}" title="${label}">${note?'● ':''}Obs.</button>`;
  };
  /** Todas las acciones antiguas permanecen enlazadas a los mismos controles.
   * Solo se ocultan hasta abrir el diálogo de la celda; los cálculos no cambian. */
  const gradeCellActions=(student,assessment,grade,npButton,ajButton)=>{
    const note=gradeObservationsByPair.has(student.id+'|'+assessment.id);
    const state=grade?.pendingJustified?'AJ':grade?.notSubmitted?'NP':'';
    return `<span class="grade-cell-action-anchor">
      <button type="button" class="grade-cell-actions-trigger ${note?'has-observation':''}"
        data-grade-cell-actions-student="${esc(student.id)}"
        data-grade-cell-actions-assessment="${esc(assessment.id)}"
        aria-haspopup="dialog"
        aria-label="Opciones de calificación de ${esc(student.name)} en ${esc(assessment.name)}"
        title="NP, AJ y observaciones">⋯${note?'<span class="grade-cell-observation-mark" aria-label="Con observación">●</span>':''}</button>
      <span class="grade-cell-original-actions" hidden>${npButton}${ajButton}${observationButton(student.id,assessment.id)}</span>
      ${state?'<span class="visually-hidden">Estado: '+state+'</span>':''}
    </span>`;
  };
  // La nota se centra en la celda, con el menú debajo y el detalle en una capa externa.
  const gradeCellStack=(main,actions='',secondary='',info='')=>`<div class="grade-cell-stack">
    <div class="grade-cell-face">${main}</div>
    <div class="grade-cell-below"><div class="grade-cell-menu">${actions}${info?`<button type="button" class="grade-info-trigger" data-grade-info="${esc(info)}" aria-expanded="false" aria-label="Detalle de calificación: ${esc(info)}"><span aria-hidden="true">!</span></button>`:''}</div>
    <div class="grade-cell-support">${secondary}</div></div></div>`;
  const gradesByStudent=new Map();
  for(const grade of STATE.doc.grades){
    if(!visibleIds.has(grade.assessmentId))continue;
    if(!gradesByStudent.has(grade.studentId))gradesByStudent.set(grade.studentId,new Map());
    gradesByStudent.get(grade.studentId).set(grade.assessmentId,grade);
  }
  const headers=assessments.map(a=>{
    const c=STATE.doc.categories.find(c=>c.id===a.categoryId);
    return `<th class="category-tinted" data-column-category="${esc(a.categoryId)}"><span class="column-heading"><span class="assessment-column-title" title="${esc(a.name)}">${esc(a.name)}</span>${classStatButton('assessment',a.id,a.name)}<button type="button" class="assessment-menu" data-edit="${esc(a.id)}" aria-label="Configurar ${esc(a.name)}" title="Editar, ordenar o eliminar actividad">⋯</button></span><small>${a.recoveryOf?'Recuperación · ':''}${esc(c?.name||'')} · ${a.rubricId?'Rúbrica /10':'/'+esc(a.maxScore)+(a.convertToTen?' → /10':' · sin conversión')}${a.weight!==1?' · ×'+esc(a.weight):''}${a.orthography?.enabled?' · faltas recuperables':''}${a.greekEtymologyBonusEnabled?' · +1 etimología griega':''}</small></th>`;
  }).join('');
  const categoryCell=a=>` class="category-tinted" data-column-category="${esc(a.categoryId)}"`;
  const bodies=renderGradeTableBodies(students,s=>`<tr><td class="name-col"><div class="student-name-cell"><span class="student-name-label">${esc(s.name)}</span>${studentOriginSelector(s,originOptions)}<button class="view-student" type="button" title="Mostrar solo las notas de este alumno" data-view-student="${esc(s.id)}">Ver</button><button class="view-student" type="button" title="Editar, ordenar o quitar alumno" data-edit-student="${esc(s.id)}">⋯</button></div></td>${assessments.map(a=>{
    const g=gradesByStudent.get(s.id)?.get(a.id);
    const npLabel=g?.notSubmitted?'Quitar «No presentado»':'Marcar «No presentado»';
    const ajButton=`<button type="button" class="aj-button ${g?.pendingJustified?'active':''}" data-aj-student="${esc(s.id)}" data-aj-assessment="${esc(a.id)}" aria-pressed="${!!g?.pendingJustified}" aria-label="${g?.pendingJustified?'Quitar':'Marcar'} ausencia justificada pendiente: ${esc(s.name)} · ${esc(a.name)}" title="${g?.pendingJustified?'Reactivar calificación anterior':'Pendiente por ausencia justificada (no computa)'}">AJ</button>`;
    const npButton=`<button type="button" class="np-button" data-np-student="${esc(s.id)}" data-np-assessment="${esc(a.id)}" aria-pressed="${!!g?.notSubmitted}" aria-label="${npLabel}: ${esc(s.name)} · ${esc(a.name)}" title="${npLabel}">NP</button>`;
    // Indicador independiente del control NP; el botón original de la
    // calificación sigue abriendo su editor, sin cambiar el valor registrado.
    const npGradeMarker='<span class="np-grade-marker" aria-label="No presentado">NP</span>';
    if(a.rubricId){
      const score=g?recordedScore(STATE.doc,a,g):null;
      const main=`<button class="rubric-grade-button" type="button" data-rubric-grade="${esc(a.id)}" data-rubric-student="${esc(s.id)}"
        aria-label="Evaluar ${esc(s.name)} en ${esc(a.name)} con rúbrica">${g?.pendingJustified?'<span class="aj-badge">AJ · Pendiente</span>':g?.notSubmitted?npGradeMarker:g?gradeChip(score):'Evaluar'}</button>`;
      return `<td${categoryCell(a)}>${gradeCellStack(main,gradeCellActions(s,a,g,npButton,ajButton))}</td>`;
    }
    if(a.orthography?.enabled){
      const value=g?effectiveAssessmentScore(STATE.doc,a,g):null;
      const faults=g?.orthographyFaults??0;
      const amount=g?orthographyPenalty(a,g):0;
      const assigned=g?.greekEtymologyBonus??0;
      const applied=g?greekEtymologyBonusApplied(STATE.doc,a,g):0;
      const greekNote=a.greekEtymologyBonusEnabled&&assigned>0?
        ` · Etimología +${rawFmt(assigned)}${applied===0?' (no computa)':''}`:'';
      const note=g&&(a.maxScore!==10||faults>0||assigned>0)?`Original: ${rawFmt(g.score)}/${rawFmt(a.maxScore)}${faults?` · ${g.orthographyDelivered?'✓ Entregadas':`−${penaltyFmt(amount)} (${faults} faltas)`}`:''}${greekNote}`:'';
      const main=`<button class="orthography-grade-button" type="button" data-orthography-grade="${esc(a.id)}" data-orthography-student="${esc(s.id)}"
        aria-label="Corregir ${esc(s.name)} en ${esc(a.name)}: nota, faltas y entrega">${g?.pendingJustified?'<span class="aj-badge">AJ · Pendiente</span>':g?.notSubmitted?npGradeMarker:g?gradeChip(value):'<strong>+ Nota</strong>'}</button>`;
      const info=g?.notSubmitted||g?.pendingJustified?'':note;
      return `<td${categoryCell(a)}>${gradeCellStack(main,gradeCellActions(s,a,g,npButton,ajButton),'',info)}</td>`;
    }
    const isTenScale=a.maxScore===10||a.convertToTen;
    const converted=g&&!g.notSubmitted&&!g.pendingJustified&&isTenScale?normalizedScore(g.score,a.maxScore,a.convertToTen):null;
    const showConverted=g&&!g.notSubmitted&&!g.pendingJustified&&a.convertToTen&&a.maxScore!==10;
    const main=showConverted
      ?`<button type="button" class="converted-primary" data-focus-original="${esc(a.id)}:${esc(s.id)}" aria-label="Nota sobre diez: ${esc(gradeFmt(converted))}; editar nota original">${gradeChip(converted)}</button>`
      :`<input class="note-input ${g?.notSubmitted?'np-grade-input':converted!==null?'grade-colored':''}" ${converted!==null?gradeStyle(converted):''} type="text" inputmode="decimal" spellcheck="false" maxlength="12" aria-label="Nota de ${esc(s.name)} en ${esc(a.name)}" placeholder="${g?.pendingJustified?'AJ':g?.notSubmitted?'NP':'—'}" title="${g?.notSubmitted?'NP · No presentado. Escribe una nota para sustituirlo.':''}" data-student="${esc(s.id)}" data-assessment="${esc(a.id)}" value="${g&&!g.notSubmitted&&!g.pendingJustified?esc(rawFmt(g.score)):''}"/>`;
    const secondary=showConverted
      ?`<small class="original-score">(<input class="note-input original-note-input" type="text" inputmode="decimal" spellcheck="false" maxlength="12" aria-label="Nota original de ${esc(s.name)} en ${esc(a.name)}, sobre ${esc(rawFmt(a.maxScore))}" data-student="${esc(s.id)}" data-assessment="${esc(a.id)}" value="${esc(rawFmt(g.score))}"/> /${esc(rawFmt(a.maxScore))})</small>`
      :'';
    return `<td${categoryCell(a)}>${gradeCellStack(main,gradeCellActions(s,a,g,npButton,ajButton),secondary)}</td>`;
  }).join('')}<td class="final-col">${gradeCellStack(`<button type="button" class="score-button" title="Ver desglose" data-explain="${esc(s.id)}">${gradeChip(overallGrade(STATE.doc,s.id,STATE.groupId,STATE.periodId))}</button>`)}</td><td class="itaca-col">${gradeCellStack(`<button type="button" class="itaca-edit" data-itaca-student="${esc(s.id)}" title="Nota Ítaca: ${esc(s.name)}. Configurar redondeo individual de esta evaluación" aria-label="Configurar Nota Ítaca de ${esc(s.name)}">${itacaChip(STATE.doc,s.id,STATE.groupId,STATE.periodId)}${itacaStudentRule(STATE.doc,s.id,STATE.periodId)!=='general'?'<span class="itaca-exception" title="Excepción individual">*</span>':''}</button>`)}</td></tr>`,assessments.length+3,'Aún no hay alumnos en este grupo.');
  const sum=effectiveCategories(STATE.doc,STATE.groupId,STATE.periodId).reduce((s,c)=>s+c.weight,0);
  const problems=students.flatMap(st=>periodCalculationWarnings(STATE.doc,st.id,STATE.groupId,STATE.periodId)).filter(v=>v.includes('sin conversión'));
  return `<section class="panel notebook-panel"><div class="panel-header"><div class="notebook-heading"><strong>Calificaciones</strong></div><div class="notebook-primary-actions"><button class="btn primary" id="new-student">+ Alumno</button><button class="btn primary" id="new-assessment">+ Actividad</button><details class="notebook-more-actions">
    <summary>Acciones de la tabla <span aria-hidden="true">⌄</span></summary>
    <div class="notebook-more-panel">
      <div class="action-group" role="group" aria-labelledby="notebook-students-label">
        <span class="action-group-label" id="notebook-students-label">Alumnado</span>
        <button type="button" class="btn" id="csv-import" title="CSV: apellidos;nombre;grupo (o nombre, formato anterior)">Importar alumnado (CSV)</button>
      </div>
      <div class="action-group" role="group" aria-labelledby="notebook-assessments-label">
        <span class="action-group-label" id="notebook-assessments-label">Actividades</span>
        <button type="button" class="btn" id="new-recovery">Crear recuperación</button>
        <button type="button" class="btn" id="copy-structure">Copiar actividades</button>
        <button type="button" class="btn" id="schedule-exam">Programar examen</button>
      </div>
    </div>
  </details></div></div><div class="notebook-organize-tools" role="group" aria-label="Organización y visualización"><details class="notebook-student-options"><summary>Alumnado <span aria-hidden="true">⌄</span></summary><div class="notebook-grade-options-body"><div class="student-order-bar">${studentSortControls()}</div><div class="origin-manage-tools"><button type="button" class="btn small" id="manage-origin-groups" title="Asignar tutoría de procedencia a los alumnos de esta optativa">Gestionar procedencias</button></div></div></details><details class="notebook-grade-options"><summary>Ítaca <span aria-hidden="true">⌄</span></summary><div class="notebook-grade-options-body"><div class="itaca-global"><label for="itaca-general-rule">Redondeo general de Nota Ítaca</label><select id="itaca-general-rule" aria-label="Redondeo general de Nota Ítaca para el grupo">${ITACA_OPTIONS.map(([key,label])=>opt(key,label,itacaGroupRule(STATE.doc,STATE.groupId))).join('')}</select><small>La media original no cambia. Puedes ajustar cada alumno pulsando su Nota Ítaca.</small></div><button type="button" class="btn small" id="configure-itaca-attitude-toolbar">Condición de actitud para subir la nota</button></div></details><div class="notebook-zoom-tools" role="group" aria-label="Zoom del cuaderno"><label class="redesign-density">Densidad <select id="notebook-density"><option value="compact">Compacta</option><option value="normal">Normal</option><option value="wide">Amplia</option></select></label><span>Zoom</span><button class="btn small" type="button" id="notebook-zoom-out" aria-label="Reducir zoom de la tabla" ${STATE.notebookZoom<=NOTEBOOK_ZOOM_MIN?'disabled':''}>−</button><output id="notebook-zoom-value" aria-live="polite">${STATE.notebookZoom} %</output><button class="btn small" type="button" id="notebook-zoom-in" aria-label="Aumentar zoom de la tabla" ${STATE.notebookZoom>=NOTEBOOK_ZOOM_MAX?'disabled':''}>+</button></div></div><div class="table-scroller"><table class="grade-table"><thead><tr><th class="name-col">Alumno</th>${headers}<th class="final-col"><span class="class-stat-heading">Nota final ${classStatButton('period',STATE.periodId,'nota final de la evaluación')}</span></th><th class="itaca-col"><button type="button" id="configure-itaca-attitude" class="itaca-column-config" title="Configurar el requisito de Actitud para subir la Nota Ítaca" aria-label="Configurar condición de Actitud para subir la Nota Ítaca">Nota Ítaca <span aria-hidden="true">⚙</span></button><small>/10 · ${itacaAttitudeCondition(STATE.doc,STATE.groupId,STATE.periodId)?'Condición activa':'Configurar actitud'}</small></th></tr></thead>${bodies}</table></div><div class="table-foot"><span>${students.length} alumnos · ${assessments.length} actividades · ${esc(currentPeriod()?.name)}</span><span>${Math.abs(sum-100)>1e-8?'⚠ Porcentajes de este periodo: '+sum+' %. Corrige la suma para calcular la nota.':'Porcentajes: 100 %. Las categorías sin evaluar redistribuyen el peso.'}${problems.length?`<span class="warning-calculation">⚠ Hay calificaciones sin conversión que superan 10: su cálculo queda bloqueado.</span>`:''}</span></div></section><details class="legend notebook-legend"><summary>ⓘ Ayuda: notas, acciones y colores</summary><span class="note">Introduce notas directamente. Pulsa «⋯» en una celda para NP, AJ y observaciones; «⋯» en una columna para configurarla.</span><span class="note">● NP significa «No presentado» y computa como 0; AJ indica ausencia justificada pendiente y no computa. Una casilla vacía tampoco computa.</span><span class="note">● Las recuperaciones sustituyen o mejoran su examen de origen; nunca cuentan dos veces.</span><span class="note">● Los resultados se redondean solo para mostrarlos.</span><span class="note">● Colores: 0–3,49 granate; 3,50–4,99 rojo; 5–5,99 amarillo; 6–6,99 verde; 7–9,99 azul gradual; 10 morado.</span></details>`;
}
const ITACA_OPTIONS=[['half','Redondear desde ,5'],['seven','Redondear desde ,7'],['none','Conservar parte entera (sin subir)']];
const RULE_LABELS={mean:'Media aritmética',weighted_mean:'Media ponderada por actividad',highest:'Mejor nota',best_n:'Media de las N mejores',last:'Última evaluada',latest_if_highest:'Última si iguala o supera la mejor; si no, media'};
function renderRules(){
  const categories=effectiveCategories(STATE.doc,STATE.groupId,STATE.periodId);
  const activeIds=new Set(categories.map(c=>c.id));
  const unusedCategories=availableCategories(STATE.doc,STATE.groupId).filter(c=>!activeIds.has(c.id));
  const sum=categories.reduce((s,x)=>s+x.weight,0);
  const profile=STATE.doc.gradingProfiles.find(x=>x.groupId===STATE.groupId&&x.periodId===STATE.periodId);
  const individualCount=STATE.doc.individualCategoryRules.filter(r=>r.periodId===STATE.periodId&&STATE.doc.students.some(s=>s.id===r.studentId&&s.groupId===STATE.groupId)).length;
  return `<div class="grid-two"><section class="panel panel-pad"><div class="section-title-row"><h2>Porcentajes y reglas</h2><div class="tool-actions"><button class="btn small primary" id="individual-rules">Reglas por alumno${individualCount?` (${individualCount})`:``}</button><button class="btn small" id="new-category">+ Categoría</button></div></div><p class="subtitle"><strong>${esc(currentGroup().name)} · ${esc(currentPeriod().name)}</strong>. Elige aquí qué categorías evalúas en esta materia y evaluación. Cada período puede usar un conjunto distinto, con porcentajes y reglas propios. ${profile?'Configuración personalizada':'Se aplican las categorías predeterminadas'}.</p><p class="hint">Cada categoría conserva su color en todas las evaluaciones donde se utilice. Retirar una categoría solo la oculta en esta evaluación; no borra nada de otros períodos.</p><div class="period-category-picker" role="group" aria-label="Categorías disponibles para esta evaluación"><label>Añadir categoría existente <select id="category-to-enable" ${unusedCategories.length?'':'disabled'}><option value="">Seleccionar categoría</option>${unusedCategories.map(c=>opt(c.id,c.name,'')).join('')}</select></label><button type="button" class="btn small" id="enable-category" ${unusedCategories.length?'':'disabled'}>Activar en esta evaluación</button></div>${categories.map(c=>`<div class="rule-row"><div><div class="category-header"><div class="rule-title class-stat-heading">${esc(c.name)} ${classStatButton('category',c.id,c.name)}</div><button class="btn small category-delete" type="button" data-delete-category="${esc(c.id)}" title="Retirar solo de esta evaluación si no tiene actividades o reglas asociadas">Retirar</button></div><div class="hint">${c.rule==='weighted_mean'?'Usa pesos de actividades':'Porcentaje en esta evaluación'}</div><label class="category-color-control">Color de columnas <input type="color" data-category-color="${esc(c.id)}" value="${esc(categoryColumnColor(STATE.doc,c.id))}" aria-label="Color de las actividades de ${esc(c.name)}" title="Aplicar color a las columnas de esta categoría"/></label><button type="button" class="category-color-reset" data-category-color-reset="${esc(c.id)}" ${c.columnColor?'':'disabled'} >Color predeterminado</button></div><label><span class="visually-hidden">Porcentaje de ${esc(c.name)}</span><input class="number-field" type="number" data-periodweight="${esc(c.id)}" min="0" max="100" step="any" value="${esc(c.weight)}"/> %</label><label><span class="visually-hidden">Regla de ${esc(c.name)}</span><select data-periodrule="${esc(c.id)}">${Object.entries(RULE_LABELS).map(([key,label])=>opt(key,label,c.rule)).join('')}</select></label><label class="best-n-box ${c.rule==='best_n'?'':'hidden'}">Mejores <input type="number" class="number-field" data-bestcount="${esc(c.id)}" min="1" max="100" step="1" value="${esc(c.bestCount??2)}"/></label></div>`).join('')}<div class="sum-line ${Math.abs(sum-100)>1e-8?'bad':''}">Total del periodo: ${sum} % ${Math.abs(sum-100)>1e-8?'— ajusta hasta llegar al 100 %':'✓'}</div><div class="settings-actions"><button class="btn small" id="reset-rules">Restablecer porcentajes y reglas</button><label>Copiar de <select id="source-period"><option value="">Selecciona periodo</option>${[...STATE.doc.periods].sort((a,b)=>a.order-b.order).filter(x=>x.id!==STATE.periodId).map(x=>opt(x.id,x.name,'')).join('')}</select></label><button class="btn small" id="copy-rules">Copiar categorías y reglas</button></div></section><section class="panel panel-pad"><h2>Cómo se calcula</h2><p>Cada actividad se convierte a 0–10 cuando está activada la conversión. Una nota bruta superior a 10 bloquea los cálculos dependientes hasta corregir la escala. Solo se utilizan las actividades evaluadas; una casilla vacía no es un cero.</p><p>Las excepciones individuales permiten usar siempre la media, obligarla cuando un NP computa como cero o sustituir por el último examen. AJ (ausencia justificada pendiente) queda fuera del cálculo; la nota previa se conserva al activar y desactivar AJ.</p><p>La media ponderada usa los pesos individuales de las actividades. La regla «N mejores» elige las N mayores notas normalizadas; si hay menos, utiliza las disponibles.</p><div class="section-note"><strong>Recuperaciones.</strong> Una recuperación enlazada sustituye la evidencia original si eliges «sustituir siempre», o cuenta solo si mejora su nota con «conservar la mayor». Nunca se suma como segundo examen. Una actividad posterior sin nota no puede considerarse la «última» para activar la regla condicional; en ese caso se usa la media de las evaluadas.</div><p class="note">Los porcentajes deben sumar 100. Una categoría sin evidencias se excluye y el peso de las evaluadas se redistribuye. Las competencias se calculan con sus propios vínculos.</p></section></div>`;
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
      ${competencyScaleLegend()}<div class="overflow-auto competency-results-scroll"><table class="comp-table competency-results-table"><thead><tr><th scope="col">Alumno</th>${personal.map(c=>`<th>${esc(c.name)}</th>`).join('')}</tr></thead>
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
    const level=gradeToFour(score);
    return `<span class="competency-mean-values" aria-label="Nivel de la media: ${esc(level)} · ${esc(competencyAcquisitionLabel(score))}">${competencyLevelChip(score,'Media aritmética')}</span>`;
  };
  const currentGrade=(student,comp)=>comp?.id?competencyLevelChip(competencyGrade(STATE.doc,student.id,comp.id,group.id,STATE.periodId)):competencyLevelChip(null);
  return `<div class="competency-view"><section class="panel panel-pad"><div class="section-title-row"><div><h2>Competencias específicas · ${esc(group.subject)}</h2><p class="subtitle">${esc(catalog.data.norma)} · ${catalog.competencias.length} competencias oficiales · selección de pesos opcional</p></div><button class="btn small" id="new-competency">+ Competencia propia</button></div>
  ${group.subject==='Latín II'?`<label class="competency-version">Normativa para Latín II <select id="comp-curr-version">${[['auto','Según curso escolar'],['2022','2022 · 2026–2027'],['2026','2026 · desde 2027–2028']].map(([v,t])=>opt(v,t,STATE.competencyVersion)).join('')}</select></label>`:''}
  ${catalog.warning?`<p class="comp-curr-warning">⚠ ${esc(catalog.warning)}</p>`:''}
  <p class="section-note">Los enunciados son los del decreto. Cada competencia empieza sin cálculo: solo tendrá nota si asignas explícitamente pesos a categorías. Ninguna ponderación se presume oficial.</p>
  <div class="official-competency-grid">${official.map(ce=>`<article class="competency-item official-competency"><div class="comp-head"><strong class="ce-number">${esc(ce.code)}</strong><h3>${esc(ce.enunciado)}</h3></div><details class="comp-weights"><summary>Vincular categorías para calificar ${esc(ce.code)}</summary><p class="hint">0 = categoría sin vínculo. Los pesos son relativos y no se requiere sumarlos a 100. Consulta los criterios oficiales de esta competencia justo debajo antes de elegir su porcentaje.</p>${linkRows(ce.stored?.id,ce.key)}${criteriaFor(ce)}</details></article>`).join('')}</div>
  ${custom.length?`<details class="custom-competencies"><summary>Competencias personalizadas o de versiones anteriores (${custom.length})</summary>${custom.map(c=>`<div class="competency-item"><h3>${esc(c.name)}</h3>${linkRows(c.id,c.id)}</div>`).join('')}</details>`:''}</section>
  <section class="panel panel-pad"><h2>Resultados por competencia</h2><p class="subtitle">${esc(group.name)} · ${esc(currentPeriod()?.name)} · las casillas sin vínculo permanecen vacías</p>${competencyScaleLegend()}<div class="overflow-auto competency-results-scroll"><table class="comp-table competency-results-table"><thead><tr><th scope="col">Alumno</th>${official.map(c=>`<th title="${esc(c.enunciado)}"><span class="class-stat-heading">${esc(c.code)} ${c.stored?.id?classStatButton('competency',c.stored.id,c.code):''}</span></th>`).join('')}<th class="competency-mean-heading" scope="col">Media de competencias <small>sin ponderar · /10 y /4</small></th></tr></thead><tbody>${students.map(st=>`<tr><td class="comp-name">${esc(st.name)}</td>${official.map(c=>`<td>${currentGrade(st,c.stored)}</td>`).join('')}<td class="competency-mean-cell">${currentMean(st)}</td></tr>`).join('')}</tbody></table></div><p class="section-note">La media de competencias es aritmética y sin ponderación entre las CE oficiales con nota; las no evaluadas se excluyen. Se calcula con precisión completa y se muestra sobre 10 y como nivel de adquisición discreto: 1 = alta (8–10); 2 = media (6,5–<8); 3 = baja (5–<6,5); 4 = no adquirida (<5). No afecta a la nota final. Puedes consultar los criterios completos en «Currículo».</p></section></div>`;
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
  return `<div class="grid-two">${renderDropboxSettings()}<section class="panel panel-pad"><h2>Precisión y presentación</h2><div class="settings-grid"><div class="setting-box"><label for="decimals"><strong>Decimales mostrados</strong></label><select id="decimals">${[0,1,2].map(n=>opt(String(n),String(n),String(Math.min(2,s.decimals)))).join('')}</select><p class="hint">El cálculo interno mantiene toda la precisión.</p></div><div class="setting-box"><label for="rounding"><strong>Tipo de redondeo</strong></label><select id="rounding">${[['half-up','Matemático'],['floor','Hacia abajo'],['ceil','Hacia arriba']].map(([k,v])=>opt(k,v,s.rounding)).join('')}</select><p class="hint">Se aplica al mostrar el resultado.</p></div></div><div class="section-note">Periodo, grupo, categorías y actividades se almacenan en un modelo versionado. OneDrive no está conectado. ${dropboxConfigured(location.origin)?'Solo se envían datos cifrados a Dropbox si lo vinculas expresamente.':'La webapp no envía datos del cuaderno a servidores.'}</div></section><section class="panel panel-pad"><h2>Colores por curso y asignatura</h2><p class="subtitle">Cada materia conserva su color independientemente del grupo y del periodo. Los cambios se guardan en el cuaderno local cifrado.</p><div class="accent-list">${pairOptions().map(x=>{const [level,subject]=x.value.split(':');return `<label class="accent-row"><span>${esc(x.label)}</span><input type="color" data-accent="${esc(x.value)}" value="${esc(colorFor(level,subject))}" aria-label="Color de ${esc(x.label)}"/></label>`;}).join('')}</div><button class="btn small" id="reset-accents">Restablecer colores predeterminados</button></section><section class="panel panel-pad"><h2>Valores predeterminados para faltas</h2><p class="subtitle">Se aplican a <strong>nuevos exámenes</strong> de la categoría Exámenes. Los exámenes existentes mantienen sus propias reglas.</p><div class="settings-grid"><div class="setting-box"><label><input id="orth-default-on" type="checkbox" ${s.orthographyDefaults?.enabledForExams?'checked':''}/> Activar en exámenes nuevos</label></div><div class="setting-box"><label for="orth-default-rate">Puntos a restar por falta</label><input id="orth-default-rate" class="text-field" type="number" min="0" max="10" step="0.01" value="${esc(s.orthographyDefaults?.penaltyPerFault??0.1)}"/></div><div class="setting-box"><label for="orth-default-copies">Veces que debe copiar cada falta</label><input id="orth-default-copies" class="text-field" type="number" min="1" max="1000" step="1" value="${esc(s.orthographyDefaults?.repetitions??30)}"/></div><div class="setting-box"><label><input id="orth-default-refundable" type="checkbox" ${s.orthographyDefaults?.refundable?'checked':''}/> Restaurar la nota cuando se entreguen</label></div></div><button type="button" class="btn primary" id="save-orth-defaults">Guardar valores para nuevos exámenes</button><p class="hint">Los cambios no alteran las notas ya guardadas ni las actividades existentes. La devolución por faltas específica de cada curso se configura desde «Gestión de grupo».</p></section><section class="panel panel-pad"><h2>Copias de seguridad cifradas</h2><p>Descarga una copia del cuaderno. Para recuperarla necesitarás la contraseña con la que se cifró. Guárdala fuera del almacenamiento del navegador.</p><p class="hint">Política de uso local: conserva dos copias cifradas en ubicaciones físicas distintas del dispositivo (carpeta local/USB), <strong>sin iCloud Drive, OneDrive ni servicios sincronizados</strong>. Realiza una copia cada semana y después de introducir muchas notas o cerrar una evaluación. Reabre el archivo con «Verificar copia»: iniciar una descarga no garantiza que se haya guardado correctamente.</p><div class="actions"><button class="btn primary" id="backup-portable">↓ Guardar copia portátil (.cuaderno)</button><button class="btn" id="backup-download">Descargar copia histórica (.cdoc)</button>${STATE.failedEnvelope?'<button class="btn warn" id="backup-draft">Descargar intento cifrado</button>':''}<button class="btn" id="backup-verify">✓ Verificar copia</button><button class="btn" id="backup-restore">↑ Restaurar copia</button>${STATE.recovery?'<button class="btn" id="backup-recover">↶ Recuperar versión anterior</button><button class="btn" id="backup-download-recovery">↓ Descargar rescate</button>':''}</div><input type="file" id="backup-file" class="hidden" accept=".cuaderno,.cdoc,.json,application/json,application/octet-stream"/><input type="file" id="backup-verify-file" class="hidden" accept=".cuaderno,.cdoc,.json,application/json,application/octet-stream"/><p class="recovery-help">Al restaurar una copia se guarda automáticamente la versión anterior, todavía cifrada. Solo se conserva <strong>un punto de rescate</strong> dentro del navegador; la siguiente restauración lo sustituye. Descarga siempre una copia externa antes de restaurar.</p><div class="section-note">No se ha realizado una auditoría independiente de seguridad. Utiliza esta aplicación solo en los dispositivos autorizados por tu centro y conforme a su política de protección de datos. Conserva copias cifradas locales no sincronizadas y verifica periódicamente que puedes restaurarlas.</div></section><section class="panel panel-pad"><h2>Empezar de cero</h2><p>Reinicia el cuaderno para dejar las tres evaluaciones y las categorías básicas, sin grupos, alumnos, actividades, notas ni agenda anterior.</p><p class="hint">Antes debes guardar fuera del navegador un archivo .cuaderno de esta misma revisión y volver a seleccionarlo para verificarlo. Después tendrás que escribir REINICIAR. Se conserva un único rescate cifrado en el dispositivo; se sustituirá si vuelves a importar o reiniciar.</p><div class="actions"><button class="btn warn" id="reset-notebook">Reiniciar cuaderno (requiere copia comprobada)</button></div><input type="file" id="reset-notebook-file" class="hidden" accept=".cuaderno,application/octet-stream"/></section><section class="panel panel-pad"><h2>Conservación del almacenamiento local</h2><p>El navegador puede eliminar los datos de IndexedDB. La protección persistente reduce el riesgo de eliminación automática, pero no sustituye copias cifradas externas.</p><div class="actions"><button type="button" class="btn" id="storage-check">Comprobar protección</button><button type="button" class="btn" id="storage-protect">Solicitar almacenamiento persistente</button></div><p id="storage-status" class="hint" role="status" aria-live="polite">Sin comprobar.</p>${originWarning}</section><section class="panel panel-pad"><h2>Preparación para trabajar offline</h2><p>Comprueba que el navegador tiene almacenados los recursos estáticos de esta versión. La comprobación no sustituye la prueba real desconectando internet.</p><div class="actions"><button class="btn" id="check-offline">Comprobar recursos offline</button><button class="btn" id="check-reload">Probar guardado y recarga</button></div><p class="hint">La prueba de recarga compara la misma copia cifrada antes y después de recargar, sin alterar calificaciones. No verifica un cierre completo del navegador ni la apertura sin red.</p><p id="offline-result" class="hint" role="status" aria-live="polite"></p></section></div>`;
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
      const name=$('#rubric-editor-name',dialog).value;
      await commit(d=>rubric?updateRubric(d,rubric.id,name,criteria):createRubric(d,name,criteria),rubric?'Editar rúbrica':'Crear rúbrica');
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
      const value=text.value,visible=checkbox.checked;
      await commit(d=>setGradeObservation(d,studentId,assessmentId,value,visible),'Editar observación de calificación');
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

function studentGradeButton(key,label,score){
  return `<button type="button" class="student-grade-button" data-student-explanation="${esc(key)}" aria-description="Abre el desglose del cálculo" title="Ver cálculo"><span>${esc(label)}</span><strong class="student-score">${score}</strong><span aria-hidden="true">ⓘ</span></button>`;
}

function studentCompetencies(){
  const {doc,groupId,competencyVersion}=STATE;
  const catalog=officialCompetenciesForGroup(currentGroup(),competencyVersion);
  const official=(catalog?.competencias??[]).map(ce=>({
    id:linkedOfficialCompetency(doc,groupId,ce.key)?.id,
    title:ce.code+' · '+ce.enunciado
  }));
  const custom=groupCompetencies(doc,groupId).filter(c=>!c.curriculumKey).map(c=>({id:c.id,title:c.name}));
  const all=[...official,...custom];
  const officialMean=official.some(c=>c.id);
  const forMean=officialMean?official:custom;
  return {all,forMean,officialMean};
}

function studentRoundingNote(){
  const {settings}=STATE.doc;
  const decimals=Math.min(2,Math.max(0,settings.decimals));
  const shown=decimals===0?'sin decimales':decimals===1?'con 1 decimal':'con 2 decimales';
  const method={floor:'hacia abajo',ceil:'hacia arriba','half-up':'al valor más cercano, con los empates hacia arriba'}[settings.rounding];
  return `<p>La nota académica se muestra ${shown}. El redondeo visual se aplica ${method}. Los cálculos conservan toda la precisión.</p>`;
}

const studentEvidenceNumber=value=>String(value).replace('.',',');

function studentCategoryEvidence(entry,{useLabel=''}={},periodId=STATE.studentPeriodId){
  const category=effectiveCategories(STATE.doc,STATE.groupId,periodId).find(c=>c.id===entry.categoryId);
  const rule=entry.rule==='best_n'?`Media de las ${category?.bestCount??2} mejores notas`:RULE_LABELS[entry.rule];
  const fallback=entry.used.length>1&&(entry.rule==='latest_if_highest'||entry.rule==='last');
  const individual=entry.individualRule==='mean'||entry.individualRule==='last'||entry.npTriggered;
  return `<section class="student-evidence">
    <div class="cardline"><strong>${esc(entry.category)} ${useLabel?'<small>'+esc(useLabel)+'</small>':''}</strong>${gradeChip(entry.grade)}</div>
    <p>${esc(rule)}${individual?' · Excepción individual':''}.</p>
    ${fallback?'<p>En esta evaluación se aplica la media de las actividades evaluadas.</p>':''}
    ${entry.issue?'<p class="warning-calculation">Hay una nota sin conversión que supera 10/10.</p>':''}
    ${entry.evidence.length?`<ul class="student-evidence-list">${entry.evidence.map(e=>{
      const used=entry.used.includes(e);
      const weighting=entry.rule==='weighted_mean'?` · Peso relativo ${studentEvidenceNumber(e.weight)}`:' · Mismo peso que las demás actividades incluidas';
      const original=e.originalNotSubmitted?'NP':gradeFmt(e.original);
      const recovery=e.recoveryNotSubmitted?'NP':gradeFmt(e.recovery);
      return `<li><span><strong>${esc(e.name)}</strong>${e.recovery!==null?`<small>Original ${esc(original)} · ${esc(e.recoveryName)} ${esc(recovery)}</small>`:e.originalNotSubmitted?'<small>NP · No presentado</small>':''}
        <small>${used?'Incluida'+esc(weighting):'Fuera de esta media'}</small></span>${gradeChip(e.value)}</li>`;
    }).join('')}</ul>`:'<p class="hint">Sin actividades evaluadas para este cálculo.</p>'}
  </section>`;
}

function studentAcademicEvidence(studentId,periodId){
  const {doc,groupId}=STATE;
  const note=overallGrade(doc,studentId,groupId,periodId);
  return `<p>Media ponderada de las categorías con nota y porcentaje positivo. Se divide la suma de las notas de categoría multiplicadas por su porcentaje entre la suma de los porcentajes que intervienen.</p>
    ${note===null?'<p>La media académica está sin calificar.</p>':`<p>Media académica antes del redondeo visual: <strong>${esc(Number(note).toLocaleString('es-ES',{maximumFractionDigits:8}))} / 10</strong>.</p>`}
    ${calculationBreakdown(doc,studentId,groupId,periodId).map(entry=>studentCategoryEvidence(entry,{
      useLabel:`${studentEvidenceNumber(entry.weight)} % configurado · ${entry.weight>0&&entry.grade!==null?'con nota y peso':'fuera de la media'}`
    },periodId)).join('')}
    <p class="hint">Las actividades sin nota y las ausencias justificadas pendientes quedan fuera. Un NP computa como cero cuando se usa como evidencia.</p>`;
}

function explainStudentGrade(student,key){
  const {doc,groupId,studentPeriodId:periodId}=STATE;
  const displayRule=()=>{
    const specific=itacaStudentRule(doc,student.id,periodId);
    const rule=specific==='general'?itacaGroupRule(doc,groupId):specific;
    const block=rule==='none'?null:itacaAttitudeBlock(doc,student.id,groupId,periodId);
    const threshold=rule==='seven'?'0,70':'0,50';
    const text=rule==='none'?'Ítaca toma la parte entera de la media académica.':
      block?`${block} Ítaca toma la parte entera de la media académica.`:
        `Ítaca aplica el umbral de ${threshold} a la parte decimal de la media académica íntegra. Si alcanza el umbral, se sube al entero siguiente. En caso contrario, se toma el entero inferior.`;
    return `<p>Ítaca parte de la media académica de esta evaluación. ${esc(text)} ${specific==='general'?'Se aplica la regla general del grupo.':'Se aplica una regla individual.'}</p>`;
  };
  if(key==='academic'||key==='itaca'){
    const itaca=key==='itaca';
    showInfo(itaca?'Cómo se calcula la nota Ítaca':'Cómo se calcula la media académica',
      `${itaca?displayRule():studentRoundingNote()}${studentAcademicEvidence(student.id,periodId)}`);
    return;
  }
  if(key==='final'){
    const annual=finalEvidence(doc,student.id,groupId);
    showInfo('Cómo se calcula la evaluación final',`<p>${esc(FINAL_RULE_LABELS[annual.rule])}.</p>
      ${annual.issue?'<p class="warning-calculation">Revisa las notas de los periodos que intervienen en la final.</p>':''}
      ${annual.evidence.map(e=>{
        const used=annual.used.includes(e)&&(annual.rule!=='weighted_mean'||e.weight>0);
        const weight=annual.rule==='weighted_mean'?` · Peso relativo ${studentEvidenceNumber(e.weight)}`:'';
        const source=e.manual!==null?'Nota manual':e.automatic===null?'Sin calificar':'Media académica';
        return `<div class="student-evidence"><div class="cardline"><strong>${esc(e.name)}</strong>${gradeChip(e.value)}</div>
          <p>${esc(source+weight+(used?' · Incluida':' · Fuera de la media'))}</p>
          ${used&&e.manual===null?`<details><summary>Actividades de ${esc(e.name)}</summary>${studentAcademicEvidence(student.id,e.periodId)}</details>`:''}</div>`;
      }).join('')}${studentRoundingNote()}`);
    return;
  }
  const entries=calculationBreakdown(doc,student.id,groupId,periodId);
  if(key.startsWith('category:')){
    const entry=entries.find(e=>e.categoryId===key.slice('category:'.length));
    if(entry)showInfo('Cómo se calcula '+entry.category,studentCategoryEvidence(entry)+studentRoundingNote());
    return;
  }
  const {all,forMean,officialMean}=studentCompetencies();
  const competencyDetail=comp=>{
    const stored=doc.competencies.find(c=>c.id===comp.id);
    return `<p>Media ponderada de las categorías vinculadas que tienen nota. Cada vínculo aporta su peso relativo.</p>
      ${(stored?.links??[]).map(link=>{
        const entry=entries.find(e=>e.categoryId===link.categoryId);
        return entry?studentCategoryEvidence(entry,{useLabel:`Peso relativo ${studentEvidenceNumber(link.weight)}`}):'';
      }).join('')||'<p class="hint">Esta competencia no tiene categorías vinculadas en esta evaluación.</p>'}`;
  };
  if(key==='competency-mean'){
    const evaluated=forMean.filter(c=>c.id&&competencyGrade(doc,student.id,c.id,groupId,periodId)!==null);
    showInfo('Cómo se calcula la media de competencias',
      `<p>Se suman las notas íntegras de las competencias ${officialMean?'oficiales ':''}evaluadas y se divide entre su número. Todas cuentan por igual.</p>
      ${evaluated.map(c=>`<details class="student-evidence"><summary>${esc(c.title)} · ${esc(competencySourceGrade(competencyGrade(doc,student.id,c.id,groupId,periodId)))} / 10</summary>${competencyDetail(c)}</details>`).join('')||'<p class="hint">Sin competencias evaluadas.</p>'}`);
  }else{
    const comp=all.find(c=>c.id&&c.id===key.slice('competency:'.length));
    if(comp)showInfo('Cómo se calcula '+comp.title,competencyDetail(comp));
  }
}

function renderStudentView(){
  const student=STATE.doc.students.find(s=>s.id===STATE.studentId&&s.groupId===STATE.groupId);
  const presenting=STATE.studentPresentation;
  const exitButton='<button class="btn" type="button" id="exit-student-presentation">Volver a la vista del profesor</button>';
  if(presenting&&!student)return `<section class="panel panel-pad student-privacy"><p>La ficha ya no está disponible.</p>${exitButton}</section>`;
  const students=presenting?[]:allStudents();
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
      ?`${gradeChip(effective)}<small class="student-original">(${esc(rawFmt(grade.score))} /${esc(rawFmt(a.maxScore))})${grade.orthographyFaults?` · ${grade.orthographyDelivered?'✓ Entregadas':`−${esc(penaltyFmt(orthographyPenalty(a,grade)))} por ${grade.orthographyFaults} faltas`}`:''}${a.greekEtymologyBonusEnabled&&grade.greekEtymologyBonus?` · etimología +${esc(rawFmt(grade.greekEtymologyBonus))}${greekEtymologyBonusApplied(STATE.doc,a,grade)===0?' (no computa)':''}`:''}</small>`
      :a.rubricId?`${gradeChip(recordedScore(STATE.doc,a,grade))} /10 (rúbrica)`
      :a.convertToTen&&a.maxScore!==10?`${gradeChip(normalizedScore(grade.score,a.maxScore,true))}<small class="student-original">(${esc(rawFmt(grade.score))} /${esc(rawFmt(a.maxScore))})</small>`
      :a.maxScore===10?gradeChip(grade.score):`<span class="student-raw">${esc(rawFmt(grade.score))} /${esc(rawFmt(a.maxScore))}</span>`;
    return `<div class="student-assessment-block student-category-tinted" data-column-category="${esc(a.categoryId)}"><div class="student-assessment"><span>${esc(a.name)}${categoryName?`<small class="student-activity-category">${esc(categoryName)}</small>`:''}</span><strong>${shown}</strong></div>${renderRubricBreakdown(a,grade)}${visibleObservation}</div>`;
  };
  const doc=STATE.doc,groupId=STATE.groupId;
  const p=doc.periods.find(period=>period.id===STATE.studentPeriodId)??currentPeriod();
  STATE.studentPeriodId=p.id;
  const categories=effectiveCategories(doc,groupId,p.id);
  const activities=doc.assessments.filter(a=>a.groupId===groupId&&a.periodId===p.id);
  const activityIds=new Set(activities.map(a=>a.id));
  const grades=doc.grades.filter(g=>g.studentId===student.id&&activityIds.has(g.assessmentId));
  const pending=grades.filter(g=>g.pendingJustified).length;
  const notSubmitted=grades.filter(g=>g.notSubmitted).length;
  const warnings=periodCalculationWarnings(doc,student.id,groupId,p.id)
    .map(warning=>warning.replace(' Activa la conversión de esa actividad.',''));
  if(pending)warnings.push(pending===1?'Hay 1 ausencia justificada pendiente.':`Hay ${pending} ausencias justificadas pendientes.`);
  if(notSubmitted)warnings.push(notSubmitted===1?'Hay 1 actividad marcada como «No presentado».':`Hay ${notSubmitted} actividades marcadas como «No presentado».`);
  const itacaRule=itacaStudentRule(doc,student.id,p.id);
  const itacaBlock=(itacaRule==='general'?itacaGroupRule(doc,groupId):itacaRule)==='none'
    ?null:itacaAttitudeBlock(doc,student.id,groupId,p.id);
  if(itacaBlock&&overallGrade(doc,student.id,groupId,p.id)!==null)warnings.push('Ítaca toma la parte entera de la media académica. '+itacaBlock);
  const mode=STATE.studentActivityOrders[p.id]||'category';
  const renderActivities=()=>{
    const ordered=sortStudentPeriodActivities(doc,groupId,p.id,mode);
    const content=mode==='category'?categories.map(c=>`<div class="student-category student-category-tinted" data-column-category="${esc(c.id)}"><div class="cardline">${studentGradeButton('category:'+c.id,c.name,gradeChip(categoryGrade(doc,student.id,c.id,groupId,p.id)))}</div>${ordered.filter(a=>a.categoryId===c.id).map(a=>renderActivity(a)).join('')||'<p class="hint">Sin actividades en esta categoría.</p>'}</div>`).join('')
      :`<div class="student-activity-list">${ordered.map(a=>renderActivity(a,categories.find(c=>c.id===a.categoryId)?.name||'')).join('')||'<p class="hint">Sin actividades en esta evaluación.</p>'}</div>`;
    return `<div class="student-period-body">${presenting?'':`<label class="student-period-order-label">Orden de las actividades<select data-student-period-order="${esc(p.id)}" aria-label="Orden de actividades de ${esc(p.name)}">${STUDENT_ACTIVITY_SORT_OPTIONS.map(([key,label])=>opt(key,label,mode)).join('')}</select></label>`}${content}</div>`;
  };
  const {all,forMean,officialMean}=studentCompetencies();
  const average=competencyArithmeticMean(doc,student.id,forMean.map(c=>c.id).filter(Boolean),groupId,p.id);
  const competencies=`<details class="panel panel-pad student-competencies"><summary>Competencias</summary>
    ${all.length?`<ul class="student-competency-list">${all.map(c=>{
      const score=c.id?competencyGrade(doc,student.id,c.id,groupId,p.id):null;
      return `<li>${c.id?studentGradeButton('competency:'+c.id,c.title,competencyLevelChip(score)):
        `<span>${esc(c.title)}</span> ${competencyLevelChip(null)}`}</li>`;
    }).join('')}</ul><div>${studentGradeButton('competency-mean','Media aritmética de competencias',competencyLevelChip(average))}</div>
    <p class="hint">Cada competencia ${officialMean?'oficial ':''}evaluada cuenta por igual en la media. El nivel 1 indica la mayor adquisición.</p>`:'<p class="hint">Este grupo todavía no tiene competencias.</p>'}
  </details>`;
  const teachingControls=`<div class="student-navigation" role="group" aria-label="Cambiar de alumno"><button class="btn" type="button" id="previous-student" ${previous?'':'disabled'} aria-label="Alumno anterior">← Anterior</button><span class="student-position">${position+1} de ${students.length}</span><button class="btn" type="button" id="next-student" ${next?'':'disabled'} aria-label="Alumno siguiente">Siguiente →</button></div><div class="student-view-actions"><button class="btn" type="button" id="hide-student">Volver al listado</button><button class="btn primary" type="button" id="present-student">Mostrar al alumno</button></div>`;
  return `<section class="panel panel-pad student-privacy">
    <div class="student-detail-head">
      <div><h2 id="student-view-title" tabindex="-1">${esc(student.name)}</h2><p class="subtitle">${esc(currentGroup().name)}${!presenting&&student.originGroup?' · Grupo de procedencia: '+studentOriginBadge(student):''}</p></div>
      ${presenting?exitButton:teachingControls}
    </div>
    <div class="student-view-options">
      <label>Evaluación <select id="student-period-select">${periods.map(period=>opt(period.id,period.name,p.id)).join('')}</select></label>
      <div class="student-view-actions" role="group" aria-label="Detalle de las calificaciones">
        <button class="btn" type="button" data-student-detail="simple" aria-pressed="${!STATE.studentFull}">Vista simplificada</button>
        <button class="btn" type="button" data-student-detail="full" aria-pressed="${STATE.studentFull}">Vista completa</button>
      </div>
    </div>
  </section>
  <section class="panel panel-pad student-period" data-student-period="${esc(p.id)}">
    <div class="redesign-evolution"><h3>Evolución por evaluaciones</h3><div class="redesign-evolution-grid">${periods.map(term=>`<div class="redesign-evolution-item"><small>${esc(term.name)}</small>${gradeChip(overallGrade(STATE.doc,student.id,groupId,term.id))}</div>`).join('')}</div></div>
    <div class="student-period-grades">
      ${studentGradeButton('academic','Media académica',gradeChip(overallGrade(STATE.doc,student.id,STATE.groupId,p.id))+' / 10')}
      ${studentGradeButton('itaca','Nota Ítaca',itacaChip(STATE.doc,student.id,STATE.groupId,p.id))}
    </div>
    ${warnings.length?`<ul class="student-period-warnings">${warnings.map(w=>`<li>${esc(w)}</li>`).join('')}</ul>`:''}
    ${STATE.studentFull?renderActivities():''}
  </section>
  ${competencies}
  <section class="panel panel-pad student-final-summary">
    ${studentGradeButton('final','Evaluación final del curso',gradeChip(finalGrade(doc,student.id,groupId))+' / 10')}
  </section>`;
}
function bindStudentView(){
  $('#student-period-select')?.addEventListener('change',event=>{
    STATE.studentPeriodId=event.target.value;
    render();
    $('#student-period-select')?.focus({preventScroll:true});
  });
  root.querySelectorAll('[data-student-detail]').forEach(button=>button.addEventListener('click',()=>{
    STATE.studentFull=button.dataset.studentDetail==='full';
    render();
    $(`[data-student-detail="${button.dataset.studentDetail}"]`)?.focus({preventScroll:true});
  }));
  root.querySelectorAll('[data-student-explanation]').forEach(button=>button.addEventListener('click',()=>{
    const student=STATE.doc.students.find(s=>s.id===STATE.studentId&&s.groupId===STATE.groupId);
    if(student)explainStudentGrade(student,button.dataset.studentExplanation);
  }));
  $('#present-student')?.addEventListener('click',()=>{
    if(dialog.open)dialog.close();
    dialog.replaceChildren();
    $('#toast')?.classList.add('hidden');
    STATE.studentPresentation=true;
    render();
    window.scrollTo(0,0);
    $('#student-view-title')?.focus({preventScroll:true});
  });
  $('#exit-student-presentation')?.addEventListener('click',()=>{
    dialog.replaceChildren();
    STATE.studentPresentation=false;
    STATE.tab='alumno';
    render();
    ($('#present-student')??$('#student-list-heading'))?.focus({preventScroll:true});
  });
  if(STATE.studentPresentation)return;
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
    if(!STATE.studentId){STATE.studentPeriodId=STATE.periodId;STATE.studentFull=false;}
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
  const bodies=renderGradeTableBodies(students,student=>{
    const evidence=finalEvidence(STATE.doc,student.id,STATE.groupId);
    return `<tr><td class="name-col"><span>${esc(student.name)}</span>${studentOriginBadge(student)}</td>${evidence.evidence.map(e=>`<td><div class="final-period-cell"><span class="hint">Auto: ${gradeChip(e.automatic)}</span><input class="note-input ${e.manual!==null?'grade-colored':''}" ${e.manual!==null?gradeStyle(e.manual):''} inputmode="decimal" type="text" maxlength="10" data-finalstudent="${esc(student.id)}" data-finalperiod="${esc(e.periodId)}" aria-label="Nota manual de ${esc(student.name)} en ${esc(e.name)}" placeholder="Automática" value="${e.manual===null?'':esc(String(e.manual).replace('.',','))}"/><span class="hint">${e.manual===null?'Usando automática':'Usando manual'}</span></div></td>`).join('')}<td class="final-col"><strong>${gradeChip(evidence.grade)}</strong>${evidence.issue?`<small class="warning-calculation">⚠ Revisa las notas de los periodos.</small>`:''}</td></tr>`;
  },periods.length+2,'No hay alumnos.');
  return `<section class="panel panel-pad"><h2>Evaluación final del curso</h2><p class="subtitle">Pestaña independiente de los periodos. Recupera automáticamente la nota final de cada evaluación. Para sustituirla, escribe una nota manual de 0 a 10; deja la casilla vacía para volver a la automática.</p><div class="final-config"><label>Regla final<select id="final-rule">${Object.entries(FINAL_RULE_LABELS).map(([k,v])=>opt(k,v,rule)).join('')}</select></label><div class="final-weights">${periods.map(p=>`<label class="final-weight-block"><span>${esc(p.name)}</span><span class="final-include"><input type="checkbox" data-finalinclude="${esc(p.id)}" ${(cfg?.excludedPeriodIds||[]).includes(p.id)?'':'checked'}/>Incluir en final</span><span class="hint">Peso relativo</span><input type="number" min="0" max="1000" step="any" value="${esc(cfg?.weights?.[p.id]??1)}" data-finalweight="${esc(p.id)}" ${rule==='weighted_mean'?'':'disabled'} /></label>`).join('')}</div></div><p class="hint">Los pesos son relativos, no necesitan sumar 100. Los periodos sin nota o desmarcados se excluyen del cálculo; los pesos solo se usan con media ponderada. Se conserva la precisión completa hasta mostrar el resultado.</p></section><section class="panel"><div class="panel-header"><strong>Resumen anual</strong><span class="hint">${esc(currentGroup().name)}</span></div><div class="student-order-bar">${studentSortControls()}</div><div class="table-scroller"><table class="grade-table final-table"><thead><tr><th class="name-col">Alumno</th>${periods.map(p=>`<th><span class="class-stat-heading">${esc(p.name)} ${classStatButton('annual-period',p.id,p.name)}</span><small>Media final /10</small></th>`).join('')}<th class="final-col"><span class="class-stat-heading">Nota final curso ${classStatButton('course',STATE.groupId,'nota final del curso')}</span></th></tr></thead>${bodies}</table></div></section>`;
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
    const val=e.target.value.trim(),studentId=e.target.dataset.finalstudent,periodId=e.target.dataset.finalperiod;try{await commit(d=>setFinalOverride(d,studentId,periodId,val===''?null:val.replace(',','.')),'Nota manual de periodo');}catch(err){fail(err);render();}
  });
}

function openCopyActivities(){
  const {groupId,periodId}=currentView();
  const destinations=[...STATE.doc.periods].sort((a,b)=>a.order-b.order).filter(p=>p.id!==STATE.periodId);
  if(!destinations.length)return toast('Primero crea una segunda evaluación.');
  const source=allAssessments();
  if(!source.length)return toast('No hay actividades en la evaluación actual.');
  dialog.innerHTML=`<form class="modal-inner" id="copy-activities-form"><h2 id="modal-heading">Copiar actividades a otras evaluaciones</h2><p class="subtitle">Se copian ${source.length} actividades de ${esc(currentPeriod().name)}, con sus rúbricas, escalas, pesos y reglas de categorías. <strong>No se copian alumnos, notas ni recuperaciones evaluadas.</strong> Las evaluaciones con actividades no se sobrescriben.</p><div class="copy-targets">${destinations.map(p=>{const count=STATE.doc.assessments.filter(a=>a.groupId===STATE.groupId&&a.periodId===p.id).length;return `<label><input type="checkbox" value="${esc(p.id)}" data-copy-destination ${count?'disabled':'checked'}/><span>${esc(p.name)} ${count?`· ${count} actividades existentes (no se modifican)`:'· Vacía'}</span></label>`;}).join('')}</div><p class="modal-error" role="alert"></p><div class="modal-actions"><button type="button" class="btn" id="cancel-copy">Cancelar</button><button type="submit" class="btn primary">Copiar estructura</button></div></form>`;
  $('#cancel-copy',dialog).onclick=()=>dialog.close();
  $('#copy-activities-form',dialog).onsubmit=async e=>{
    e.preventDefault();const targets=[...dialog.querySelectorAll('[data-copy-destination]:checked')].map(x=>x.value);
    if(!targets.length){$('.modal-error',dialog).textContent='Selecciona al menos una evaluación vacía.';return;}
    try{await commit(d=>copyPeriodAssessments(d,groupId,periodId,targets),'Copiar actividades sin notas');dialog.close();toast('Estructura copiada; no se han duplicado calificaciones.');}
    catch(err){$('.modal-error',dialog).textContent=err.message;}
  };
  dialog.showModal();
}
function openAssessmentCreator(){
  const {groupId,periodId}=currentView();
  if(!STATE.doc.categories.length){toast('Crea primero una categoría desde Cálculos.');return;}
  const kinds=[{id:'',name:'Nota numérica'},...STATE.doc.rubrics.map(r=>({id:r.id,name:'Rúbrica existente: '+r.name})),{id:'__new',name:'Crear rúbrica aquí'}, {id:'__import',name:'Importar rúbrica Excel, CSV o JSON'}];
  dialog.classList.add('activity-modal');dialog.addEventListener('close',()=>dialog.classList.remove('activity-modal'),{once:true});
  dialog.innerHTML=`<form class="modal-inner" id="activity-form"><h2 id="modal-heading">Nueva actividad</h2><p class="subtitle">La nota siempre se normaliza a /10 si lo eliges; una rúbrica se transforma a /10 automáticamente.</p><div class="modal-fields"><label>Nombre de la actividad<input name="name" class="text-field" maxlength="150" required value="Examen"/></label><label>Categoría<select name="categoryId">${effectiveCategories(STATE.doc,STATE.groupId,STATE.periodId).map(c=>opt(c.id,c.name)).join('')}</select></label><details class="activity-disclosure" open><summary><span class="disclosure-symbol" aria-hidden="true">Ⅰ</span> Escala y forma de calificación <span class="disclosure-chevron" aria-hidden="true">⌄</span></summary><div class="activity-disclosure-body"><label>Forma de evaluar<select name="kind" id="activity-kind">${kinds.map(x=>opt(x.id,x.name)).join('')}</select></label><div id="activity-new-rubric" class="activity-rubric-box hidden"><label>Nombre de la nueva rúbrica<input name="rubricName" class="text-field" value="Actitud" maxlength="150"/></label><label>Criterios, uno por línea (criterio; máximo; peso)<textarea name="rubricRows" class="text-field" rows="5" placeholder="Asistencia;2;20
Participación;2;20"></textarea></label></div><div id="activity-import-rubric" class="activity-rubric-box hidden"><label>Archivo de rúbrica (.xlsx, .csv o .json)<input type="file" name="rubricFile" id="activity-rubric-file" accept=".xlsx,.csv,.json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"/></label><p class="hint" id="activity-rubric-preview">Las rúbricas Excel con descriptores Bien/Regular/Mal se pueden importar directamente.</p></div><div id="activity-numeric-options" class="activity-numeric-options"><label>Nota máxima<input name="maxScore" class="text-field" type="number" min="0.01" max="1000" step="any" value="10"/></label><label>Conversión para cálculos<select name="convertToTen"><option value="true">Convertir a 0–10</option><option value="false">Usar la nota bruta</option></select></label></div></div></details><details class="activity-disclosure"><summary><span class="disclosure-symbol" aria-hidden="true">Ⅱ</span> Penalización ortográfica <span class="disclosure-chevron" aria-hidden="true">⌄</span></summary><div class="activity-disclosure-body"><div class="orthography-activity-options" id="activity-orthography"><h3>Faltas de ortografía (opcional)</h3><label>Penalización recuperable<select name="orthEnabled" id="activity-orth-enabled"><option value="false">Desactivada</option><option value="true">Activada</option></select></label><div class="orthography-config-fields"><label>Descuento por falta (sobre 10)<input class="text-field" name="orthRate" type="number" step="0.01" min="0" max="10" value="${esc(STATE.doc.settings.orthographyDefaults?.penaltyPerFault??0.10)}"/></label><label>Copias exigidas por falta<input class="text-field" name="orthCopies" type="number" step="1" min="1" max="1000" value="${esc(STATE.doc.settings.orthographyDefaults?.repetitions??30)}"/></label><label>Devolución al entregar<select name="orthRecoverable"><option value="true">Sí</option><option value="false">No</option></select></label></div><p class="hint">La nota original no se pierde. La penalización se aplica después de convertir a /10; al marcar Entregadas se restaura la nota íntegra.</p></div></div></details><details id="activity-greek-etymology" class="activity-disclosure hidden"><summary><span class="disclosure-symbol" aria-hidden="true">Ⅲ</span> Etimología griega (Latín 4.º) <span class="disclosure-chevron" aria-hidden="true">⌄</span></summary><div class="activity-disclosure-body"><label>Permitir hasta 1 punto adicional en este examen<select name="greekEtymologyBonusEnabled"><option value="false">No</option><option value="true">Sí, bonificación individual 0–1</option></select></label><p class="hint">Solo cuenta con una nota de examen de al menos 5 antes del extra y sin faltas pendientes (o después de entregarlas). Máximo 10 puntos. Se conserva siempre la nota original.</p></div></details><label class="activity-weight">Peso relativo de la actividad<input name="weight" class="text-field" type="number" min="0.01" max="1000" step="any" value="1"/></label></div><p class="modal-error" role="alert"></p><div class="modal-actions"><button type="button" class="btn" id="cancel-activity">Cancelar</button><button type="submit" class="btn primary">Crear actividad</button></div></form>`;
  const form=$('#activity-form',dialog),selector=$('#activity-kind',form);
  const categoryInput=form.elements.categoryId,orthSelector=form.elements.orthEnabled;
  const isLatin4Exam=()=>{
    const g=STATE.doc.groups.find(g=>g.id===STATE.groupId);
    const category=STATE.doc.categories.find(c=>c.id===categoryInput.value);
    return g?.level==='4eso'&&g.subject==='Latín 4.º'&&category?.name?.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase()==='examenes';
  };
  const toggle=()=>{
    const k=selector.value;
    $('#activity-new-rubric',form).classList.toggle('hidden',k!=='__new');
    $('#activity-import-rubric',form).classList.toggle('hidden',k!=='__import');
    $('#activity-numeric-options',form).classList.toggle('hidden',!!k);
    $('#activity-orthography',form).classList.toggle('hidden',!!k);
    const available=!k&&isLatin4Exam();
    $('#activity-greek-etymology',form).classList.toggle('hidden',!available);
    if(!available)form.elements.greekEtymologyBonusEnabled.value='false';
  };
  selector.addEventListener('change',toggle);toggle();
  const syncCategory=()=>{
    const category=STATE.doc.categories.find(c=>c.id===categoryInput.value);
    const isExam=category?.name?.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()==='examenes';
    orthSelector.value=isExam&&STATE.doc.settings.orthographyDefaults?.enabledForExams?'true':'false';
    form.elements.orthRecoverable.value=String(groupOrthographyRefundable(STATE.doc,STATE.groupId));
  };
  categoryInput.addEventListener('change',()=>{syncCategory();toggle();});syncCategory();toggle();
  form.elements.greekEtymologyBonusEnabled.addEventListener('change',()=>{
    if(form.elements.greekEtymologyBonusEnabled.value==='true')orthSelector.value='true';
  });
  orthSelector.addEventListener('change',()=>{
    if(orthSelector.value!=='true')form.elements.greekEtymologyBonusEnabled.value='false';
  });
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
          addAssessment(d,{name:actionName,groupId,periodId,categoryId:v.categoryId,maxScore:rubricId?10:Number(v.maxScore),weight:Number(v.weight),convertToTen:rubricId?true:v.convertToTen==='true',rubricId,orthography,greekEtymologyBonusEnabled:v.greekEtymologyBonusEnabled==='true'});
        },'Crear actividad');
        dialog.close();toast('Actividad añadida al cuaderno.');
      }finally{btn.disabled=false;}
    }catch(err){$('.modal-error',form).textContent=err.message;}
  };
  dialog.showModal();form.querySelector('[name=name]')?.focus();
}
function bindCommon(){
  bindOriginSelectors();
  const {groupId:boundGroup,periodId:boundPeriod}=currentView(),boundLevel=STATE.level,boundSubject=STATE.subject;
  $('#dropbox-sync')?.addEventListener('click',()=>{if(dropboxStatus==='conflict')openDropboxSettings();else if(dropboxSession.active())void dropboxSession.manual();else openDropboxSettings();});
  document.querySelectorAll('[data-shell-disclosure]').forEach(details=>details.addEventListener('toggle',()=>{
    const key=details.dataset.shellDisclosure;
    if(Object.prototype.hasOwnProperty.call(workspaceDisclosures,key))workspaceDisclosures[key]=details.open;
  }));

  const settingsMenu=$('.header-tools');
  const dismissSettings=(restoreFocus=false)=>{
    if(!settingsMenu?.open)return;
    settingsMenu.open=false;workspaceDisclosures.tools=false;
    if(restoreFocus)settingsMenu.querySelector('summary')?.focus({preventScroll:true});
  };
  $('#close-header-tools')?.addEventListener('click',()=>dismissSettings(true));
  $('.shell')?.addEventListener('click',event=>{if(settingsMenu?.open&&!settingsMenu.contains(event.target))dismissSettings();});
  $('.shell')?.addEventListener('keydown',event=>{if(event.key==='Escape'&&settingsMenu?.open){event.preventDefault();dismissSettings(true);}});
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
  // Lista compacta cuando hay tres o más grupos; selección local, sin guardar notas.
  $('#group-quick-select')?.addEventListener('change',event=>{
    const groupId=event.target.value;
    if(groupId===STATE.groupId||!groupsForSubject().some(g=>g.id===groupId))return;
    STATE.groupId=groupId;STATE.competencyVersion='auto';
    render();
    $('#group-quick-select')?.focus({preventScroll:true});
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
    b.onclick=()=>selectOrdinaryPeriod(b.dataset.periodChoice).catch(fail);
    b.ondblclick=event=>{event.preventDefault();managePeriodFromTab(b.dataset.periodChoice);};
  });
  document.querySelectorAll('[data-notebook-evaluation-open]').forEach(button=>button.onclick=async()=>{
    const yearId=button.dataset.notebookEvaluationYear;
    const periodId=button.dataset.notebookEvaluationOpen;
    const group=currentGroup();
    const year=STATE.doc.planner?.years.find(y=>y.id===yearId&&y.name===group?.course);
    if(!year||!STATE.doc.periods.some(p=>p.id===periodId)){
      toast('No se encuentra esta evaluación en la Agenda del curso.');return;
    }
    button.disabled=true;
    try{
      // La selección del curso en Agenda es un ajuste persistente; nunca cambia notas.
      if(activeYear(STATE.doc).id!==year.id)
        await commit(d=>setActiveYear(d,year.id),'Seleccionar curso de sesiones de evaluación');
      STATE.evaluationWorkspaceTab='sesiones';
      STATE.tab='evaluaciones';
      render();
      const section=[...document.querySelectorAll('[data-evaluation-section]')]
        .find(node=>node.dataset.evaluationSection===periodId);
      if(section){
        section.setAttribute('tabindex','-1');
        section.focus({preventScroll:true});
        section.scrollIntoView({block:'start',behavior:'smooth'});
      }
    }catch(error){fail(error);if(button.isConnected)button.disabled=false;}
  });
  document.querySelectorAll('[data-rename-period]').forEach(b=>b.onclick=()=>managePeriodFromTab(b.dataset.renamePeriod));
  $('#accent-select')?.addEventListener('change',e=>{const value=e.target.value;return commit(d=>setSubjectAccent(d,boundLevel,boundSubject,value)).catch(fail);});
  document.querySelectorAll('[data-academic-quick]').forEach(button=>button.addEventListener('click',()=>{
    const destination=button.dataset.academicQuick;
    if(!['cuaderno','calculos','competencias','final','alumno'].includes(destination)||!STATE.groupId)return;
    if(STATE.tab==='alumno'&&destination!=='alumno')STATE.studentId=null;
    STATE.tab=destination;render();
  }));
  document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{if(STATE.tab==='alumno'&&b.dataset.tab!=='alumno')STATE.studentId=null;if(b.dataset.tab==='curriculo'&&currentGroup()?.subject==='Latín II')STATE.curriculumVersion=officialCompetenciesForGroup(currentGroup(),STATE.competencyVersion)?.version||'2022';workspaceDisclosures.tools=false;STATE.tab=b.dataset.tab;render();});
  $('#edit-group')?.addEventListener('click',openGroupTools);
  $('#manage-subjects')?.addEventListener('click',openSubjectsManager);
   $('#manage-shared-students')?.addEventListener('click',()=>openStudentLinksManager({
     dialog,getDoc:()=>STATE.doc,commit,toast,fail,groupId:STATE.groupId,
     defaultYear:activeYear(STATE.doc).name
   }));

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
    fieldsModal(`Nuevo grupo · ${STATE.subject} · ${COURSE_SUBJECTS[boundLevel].label}`,[
      {id:'name',label:'Nombre del grupo de la asignatura',value:'Grupo A'},
      {id:'course',label:'Curso escolar',value:activeYear(STATE.doc)?.name||'2026-2027'},
      {id:'weeklyHours',label:'Horas semanales (opcional; límite para el horario)',type:'number',value:'',min:1,max:30,required:false}
    ],async v=>{
      let group;await commit(d=>{group=addGroup(d,v.name,boundSubject,v.course,boundLevel,v.weeklyHours);});if(STATE.level===boundLevel&&STATE.subject===boundSubject){STATE.groupId=group.id;render();}
    },`Asignatura: ${COURSE_SUBJECTS[STATE.level].label} · ${STATE.subject}. El grupo se verá bajo su materia y podrá reunir alumnos de varias tutorías.`);
  };
  $('#classify-group')?.addEventListener('click',()=>fieldsModal('Clasificar grupo anterior',[{id:'pair',label:'Curso y asignatura',type:'select',options:pairOptions()}],async v=>{
    const [level,...parts]=v.pair.split(':');const subject=parts.join(':');const groupId=boundGroup;
    await commit(d=>classifyGroup(d,groupId,level,subject));STATE.level=level;STATE.subject=subject;STATE.groupId=groupId;render();
  },'No se modificará ningún alumno, actividad o calificación.'));
  $('#new-period')?.addEventListener('click',()=>fieldsModal('Nuevo periodo',[{id:'name',label:'Nombre del periodo',value:`${STATE.doc.periods.length+1}.ª evaluación`}],async v=>{let p;await commit(d=>{p=addPeriod(d,v.name);});STATE.tab='cuaderno';await selectOrdinaryPeriod(p.id);}));
  $('#new-assessment')?.addEventListener('click',openAssessmentCreator);
  $('#new-recovery')?.addEventListener('click',()=>{
    const candidates=allAssessments().filter(a=>!a.recoveryOf&&!STATE.doc.assessments.some(x=>x.recoveryOf===a.id));
    if(!candidates.length)return toast('Primero crea una actividad sin recuperación vinculada.');
    fieldsModal('Nueva recuperación',[{id:'name',label:'Nombre',value:'Recuperación'},{id:'recoveryOf',label:'Actividad de origen',type:'select',options:candidates.map(a=>({value:a.id,label:a.name}))},{id:'recoveryMode',label:'Cómo sustituye la nota',type:'select',options:[{value:'higher',label:'Solo si mejora la original'},{value:'replace',label:'Sustituir siempre'}]},{id:'maxScore',label:'Puntuación máxima',type:'number',value:10,min:0.01,max:1000,step:'any'}],async v=>commit(d=>{
      const source=d.assessments.find(a=>a.id===v.recoveryOf);
      addAssessment(d,{name:v.name,groupId:boundGroup,periodId:boundPeriod,categoryId:source.categoryId,maxScore:Number(v.maxScore),weight:source.weight,convertToTen:source.convertToTen,recoveryOf:v.recoveryOf,recoveryMode:v.recoveryMode,orthography:source.orthography??null});
    }));
  });
  $('#csv-import')?.addEventListener('click',()=>$('#csv-file').click());
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
  dialog.innerHTML=`<div class="modal-inner"><h2>Gestión de grupo</h2><p class="subtitle">${esc(g.name)} · ${esc(g.course)}. Los cambios conservan los IDs, las notas y los cálculos.</p><div class="tool-actions"><button type="button" class="btn primary" id="rename-group-btn">Editar nombre y curso escolar</button><button type="button" class="btn" id="group-weekly-hours">Horas semanales: ${g.weeklyHours??'Sin límite'}</button><button type="button" class="btn" id="group-orth-refund-btn">Devolución de faltas: ${groupOrthographyRefundable(STATE.doc,g.id)?'Sí':'No'}</button></div><p class="hint">Se aplica a las actividades con penalización de este grupo y a los exámenes nuevos. No altera otros grupos ni las notas originales.</p><div class="modal-actions"><button type="button" class="btn" id="close-group-tools">Cerrar</button></div></div>`;
  $('#close-group-tools',dialog).onclick=()=>dialog.close();
  $('#rename-group-btn',dialog).onclick=()=>{dialog.close();fieldsModal('Editar grupo · '+(COURSE_SUBJECTS[g.level]?.label||'Sin clasificar'),[{id:'name',label:'Nombre',value:g.name},{id:'course',label:'Curso escolar (año académico)',value:g.course}],async v=>commit(d=>updateGroupInfo(d,g.id,v.name,v.course)));};
  $('#group-weekly-hours',dialog).onclick=()=>{
    dialog.close();
    fieldsModal('Horas semanales · '+g.subject+' · '+g.name,[
      {id:'weeklyHours',label:'Máximo de clases por semana (1–30)',type:'number',
        value:g.weeklyHours??'',min:1,max:30,required:false}
    ],async values=>commit(d=>setGroupWeeklyHours(d,g.id,values.weeklyHours),'Límite semanal del grupo'),
    'Deja vacío para no limitar. Se cuentan las clases por separado en el horario ordinario y el de verano. No se permite un máximo inferior a las sesiones ya guardadas.');
  };
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
function managePeriodFromTab(id){
  const p=STATE.doc.periods.find(p=>p.id===id);if(!p)return;
  fieldsModal(`Gestionar ${p.name}`,[{id:'name',label:'Nombre del período',value:p.name}],async v=>{
    await commit(d=>renamePeriod(d,id,v.name));
  },'Los periodos son comunes a todos los grupos del cuaderno.');
  const actions=$('.modal-actions',dialog),periods=[...STATE.doc.periods].sort((a,b)=>a.order-b.order),i=periods.findIndex(x=>x.id===id);
  for(const [step,label] of [[-1,'↑ Anterior'],[1,'↓ Siguiente']]){
    const b=document.createElement('button');b.type='button';b.className='btn small';b.textContent=label;b.disabled=i+step<0||i+step>=periods.length;
    b.onclick=async()=>{
      if(!window.confirm('Reordenar los períodos afecta a las reglas que dependen de la última evaluación. ¿Continuar?'))return;
      dialog.close();try{await commit(d=>movePeriod(d,id,step),'Reordenar períodos');}catch(err){fail(err);}
    };actions.prepend(b);
  }
  const remove=document.createElement('button');
  remove.type='button';remove.className='btn small warn';remove.textContent='Eliminar período';
  remove.disabled=periods.length===1;
  if(remove.disabled)remove.title='El cuaderno debe conservar al menos un periodo';
  remove.onclick=async()=>{
    const assessments=STATE.doc.assessments.filter(a=>a.periodId===id).length;
    const sessions=(STATE.doc.planner?.years??[]).flatMap(y=>y.events).filter(e=>e.periodId===id).length;
    const summary=`¿Eliminar «${p.name}» de todos los grupos? Se quitarán sus ajustes de cálculo, ${assessments} actividades con sus notas y observaciones, y ${sessions} sesiones de evaluación de la agenda. Puedes deshacerlo durante esta sesión.`;
    if(!window.confirm(summary))return;
    remove.disabled=true;
    try{
      await commit(d=>removePeriod(d,id),'Eliminar período');
      dialog.close();
      $('.term-button.active')?.focus();
      toast('Período eliminado. Usa Deshacer para recuperarlo.');
    }catch(err){$('.modal-error',dialog).textContent=err.message;remove.disabled=false;}
  };
  actions.prepend(remove);
}

/** Editar las tutorías de procedencia conjuntamente, conservando grupos,
 * notas, observaciones y pertenencia a la materia optativa. */
function openOriginGroupsManager(){
 const group=currentGroup();if(!group)return;
 const students=sortStudents(STATE.doc.students.filter(s=>s.groupId===group.id),'surname');
 if(!students.length){toast('Añade primero alumnos a la asignatura.');return;}
 fieldsModal('Procedencias · '+group.subject+' · '+group.name,
  students.map(student=>({
   id:'origin-'+student.id,label:student.name+' · tutoría de procedencia',
   value:student.originGroup||'',maxlength:60,required:false
  })),
  async values=>{
   await commit(doc=>setStudentOriginGroups(doc,group.id,students.map(student=>({
     studentId:student.id,originGroup:values['origin-'+student.id]||''
   }))),'Gestionar grupos de procedencia');
   if(STATE.studentSort!=='originGroup')setStudentSort('originGroup');
  },
  'Ejemplos: 1.º BACH A, 1.º BACH B. En Agenda podrás programar sesiones de evaluación diferentes por tutoría. No se crean nuevos cuadernos ni se alteran calificaciones.');
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
  dialog.innerHTML=`<form class="modal-inner orthography-dialog" id="orthography-form"><h2 id="modal-heading">${esc(assessment.name)}</h2><p class="subtitle">${esc(student.name)}${current?.notSubmitted?' · No presentado':''} · La nota sin faltas se conserva por separado.</p><div class="modal-fields"><label>Nota original sin faltas (sobre ${esc(rawFmt(assessment.maxScore))})<input class="text-field" id="orth-base" type="text" inputmode="decimal" maxlength="12" autocomplete="off" placeholder="8,50" value="${current&&!current.notSubmitted?esc(rawFmt(current.score)):''}"/></label><label>Número de faltas<input class="text-field" id="orth-count" type="number" min="0" max="1000" step="1" value="${current?.orthographyFaults?esc(current.orthographyFaults):''}" placeholder="Sin faltas"/></label>${assessment.greekEtymologyBonusEnabled?`<label>Etimología griega · extra asignado de 0 a 1 punto<input class="text-field" id="orth-greek-bonus" type="text" inputmode="decimal" maxlength="4" value="${esc(rawFmt(current?.greekEtymologyBonus??0))}" placeholder="0,00"/></label>`:''}<div class="orthography-preview" role="status" aria-live="polite"><div class="cardline"><span>Penalización</span><strong id="orth-discount">—</strong></div>${assessment.greekEtymologyBonusEnabled?'<div class="cardline"><span>Etimología aplicada</span><strong id="orth-greek-applied">—</strong></div>':''}<div class="cardline"><strong>Nota que computa /10</strong><span id="orth-effective" class="grade-chip">—</span></div></div><label class="orthography-delivered"><input id="orth-delivered" type="checkbox" ${current?.orthographyDelivered?'checked':''}/> <strong>Entregadas</strong> — faltas copiadas ${esc(config.repetitions)} veces cada una</label><p class="hint">${config.refundable?'Al marcar «Entregadas», se restaura automáticamente la nota sin penalización.':'En este examen, la devolución de la nota está desactivada.'} Se descuentan ${esc(rawFmt(config.penaltyPerFault))} puntos por falta sobre diez (mínimo 0).</p></div><div class="modal-error" role="alert"></div><div class="modal-actions"><button class="btn" type="button" id="cancel-orthography">Cancelar</button><button class="btn primary" type="submit">Guardar nota</button></div></form>`;
  const form=$('#orthography-form',dialog),base=$('#orth-base',form),count=$('#orth-count',form),delivered=$('#orth-delivered',form),discount=$('#orth-discount',form),effective=$('#orth-effective',form);
  const greekInput=$('#orth-greek-bonus',form),greekApplied=$('#orth-greek-applied',form);
  const refresh=()=>{
    const faults=Number(count.value);
    const validFaults=(count.value.trim()===''||/^\d{1,4}$/.test(count.value))&&faults<=1000;
    delivered.disabled=!config.refundable||!validFaults||faults===0||!base.value.trim();
    if(delivered.disabled)delivered.checked=false;
    let val;
    try{val=base.value.trim()===''?null:parseScore(base.value);if(val!==null&&(val<0||val>assessment.maxScore))throw new Error('Nota fuera de escala.');}catch{val=null;}
    let bonus=0;
    try{
      if(greekInput){bonus=greekInput.value.trim()===''?0:parseScore(greekInput.value);if(bonus<0||bonus>1)throw new Error('Bonificación fuera de escala.');}
    }catch{bonus=null;}
    if(val===null||!validFaults||bonus===null){
      effective.textContent='—';discount.textContent='—';if(greekApplied)greekApplied.textContent='—';
      effective.removeAttribute('data-grade-value');effective.style.removeProperty('--grade-bg');effective.style.removeProperty('--grade-fg');return;
    }
    const candidate={score:val,orthographyFaults:faults,orthographyDelivered:delivered.checked,greekEtymologyBonus:bonus};
    const result=effectiveAssessmentScore(STATE.doc,assessment,candidate),deduct=orthographyPenalty(assessment,candidate);
    discount.textContent=deduct?`−${penaltyFmt(deduct)}`:'0,00';
    if(greekApplied){
      const applied=greekEtymologyBonusApplied(STATE.doc,assessment,candidate);
      greekApplied.textContent=`+${gradeFmt(applied)}${bonus>0&&!applied?' (no computa)':''}`;
    }
    effective.textContent=gradeFmt(result);effective.dataset.gradeValue=String(result);paintGrades(form);
  };
  base.addEventListener('input',refresh);
  count.addEventListener('input',()=>{delivered.checked=false;refresh();});
  delivered.addEventListener('change',refresh);
  greekInput?.addEventListener('input',refresh);
  $('#cancel-orthography',form).onclick=()=>dialog.close();
  form.onsubmit=async e=>{
    e.preventDefault();const submit=$('[type=submit]',form);submit.disabled=true;
    try{const values={score:base.value.trim(),faults:count.value.trim()===''?'0':count.value,delivered:delivered.checked,...(greekInput?{greekEtymologyBonus:greekInput.value.trim()||'0'}:{})};await commit(d=>setOrthographyGrade(d,studentId,assessmentId,values),'Calificar examen con faltas');dialog.close();}
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
    dialog.close();fieldsModal('Editar actividad',[{id:'name',label:'Nombre',value:a.name},{id:'categoryId',label:'Categoría',type:'select',value:a.categoryId,options:effectiveCategories(STATE.doc,STATE.groupId,STATE.periodId).map(c=>({value:c.id,label:c.name}))},{id:'maxScore',label:'Nota máxima',type:'number',value:a.maxScore,min:0.01,max:1000,step:'any'},{id:'convertToTen',label:'Conversión para cálculos',type:'select',value:String(a.convertToTen),options:[{value:'true',label:'Convertir a 0–10'},{value:'false',label:'Usar nota bruta'}]},{id:'rubricId',required:false,label:'Tipo de evaluación',type:'select',value:a.rubricId||'',options:[{value:'',label:'Nota numérica'},...STATE.doc.rubrics.map(r=>({value:r.id,label:'Rúbrica: '+r.name}))]},{id:'weight',label:'Peso relativo de la actividad',type:'number',value:a.weight,min:0.01,max:1000,step:'any'},
      {id:'orthEnabled',label:'Penalización por faltas',type:'select',value:String(a.orthography?.enabled??false),options:[{value:'false',label:'Desactivada'},{value:'true',label:'Activada'}]},
      {id:'orthRate',label:'Puntos por falta (sobre 10)',type:'number',value:a.orthography?.penaltyPerFault??STATE.doc.settings.orthographyDefaults?.penaltyPerFault??0.1,min:0,max:10,step:'0.01'},
      {id:'orthCopies',label:'Copias exigidas por falta',type:'number',value:a.orthography?.repetitions??STATE.doc.settings.orthographyDefaults?.repetitions??30,min:1,max:1000,step:'1'},
      {id:'orthRecoverable',label:'Recuperar nota al entregar',type:'select',value:String(a.orthography?.refundable??true),options:[{value:'true',label:'Sí'},{value:'false',label:'No'}]},
      ...(STATE.doc.groups.find(g=>g.id===a.groupId)?.level==='4eso'&&STATE.doc.groups.find(g=>g.id===a.groupId)?.subject==='Latín 4.º'?[{id:'greekEtymologyBonusEnabled',label:'Etimología griega (+0 a +1; solo Exámenes con faltas)',type:'select',value:String(!!a.greekEtymologyBonusEnabled),options:[{value:'false',label:'Desactivada'},{value:'true',label:'Activada'}]}]:[])],async v=>{
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
      await commit(d=>updateAssessment(d,a.id,{name:v.name,categoryId:v.categoryId,maxScore:newMax,weight:Number(v.weight),convertToTen:newConvert,rubricId:v.rubricId||null,orthography,greekEtymologyBonusEnabled:v.greekEtymologyBonusEnabled===undefined?!!a.greekEtymologyBonusEnabled:v.greekEtymologyBonusEnabled==='true'}));
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
/** Las condiciones de actitud se aplican por grupo y evaluación, nunca a la media. */
function openItacaAttitudeCondition(){
 const groupId=STATE.groupId,periodId=STATE.periodId,doc=STATE.doc;
 const eligible=effectiveCategories(doc,groupId,periodId).filter(c=>
  c.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().startsWith('actitud'));
 const current=itacaAttitudeCondition(doc,groupId,periodId);
 // Permitir limpiar condiciones históricas incluso si su categoría desapareció.
 if(!eligible.length&&!current){
  toast('Primero debes disponer de una categoría Actitud para este grupo.');return;
 }
 const candidateIds=new Set(eligible.map(c=>c.id));
 const activities=doc.assessments.filter(a=>a.groupId===groupId&&a.periodId===periodId&&
  candidateIds.has(a.categoryId)&&a.rubricId&&doc.rubrics.some(r=>r.id===a.rubricId));
 dialog.innerHTML=`<form class="modal-inner itaca-attitude-dialog" id="itaca-attitude-form">
 <h2 id="modal-heading">Condición de actitud · Nota Ítaca</h2>
 <p class="subtitle">${esc(currentPeriod().name)} · ${esc(currentGroup().name)}. Si la nota de Actitud no cumple el requisito, Ítaca conserva la parte entera (por ejemplo, 5,9 → 5), sin subir. Si lo cumple, se aplica el umbral de redondeo elegido. Ítaca siempre muestra enteros y las medias originales no cambian.</p>
 <div class="modal-fields">
 <label>Aplicar redondeo solo cuando<select name="guardMode">
 <option value="none"${!current?' selected':''}>Sin condición de Actitud</option>
 <option value="category"${current?.mode==='category'?' selected':''}>La nota de Actitud esté aprobada (5/10)</option>
 <option value="criterion"${current?.mode==='criterion'?' selected':''}${activities.length?'':' disabled'}>Un criterio de la rúbrica alcance el mínimo</option>
 </select></label>
 <div class="itaca-guard-details" id="itaca-guard-details"></div>
 <p class="hint">La condición se evalúa para cada alumno. Si falta la nota necesaria o está marcada como AJ, no se permite subir al entero siguiente hasta completarla. Las excepciones individuales siguen disponibles, pero no eluden esta condición.</p>
 </div>
 <div class="modal-error" role="alert"></div>
 <div class="modal-actions"><button type="button" class="btn" id="itaca-guard-cancel">Cancelar</button><button type="submit" class="btn primary">Guardar condición</button></div>
 </form>`;
 const form=$('#itaca-attitude-form',dialog),details=$('#itaca-guard-details',form);
 const categoryOptions=selected=>eligible.map(c=>opt(c.id,c.name,selected)).join('');
 const rubricOf=activity=>doc.rubrics.find(r=>r.id===activity.rubricId);
 const renderCriteria=(activityId,wantedCriterion=null,wantedMin=null)=>{
  const activity=activities.find(a=>a.id===activityId)||activities[0];
  const criteria=activity?rubricOf(activity).criteria:[];
  const criterion=criteria.find(c=>c.id===wantedCriterion)||criteria[0];
  const score=wantedMin!==null&&wantedMin!==undefined&&
   Number.isFinite(Number(wantedMin))&&Number(wantedMin)<=criterion.maxScore
    ?wantedMin:Math.round(criterion.maxScore*50)/100;
  $('#itaca-guard-criterion-fields',form).innerHTML=
   `<label>Criterio de la rúbrica<select name="guardCriterion">${criteria.map(c=>opt(c.id,c.name,criterion.id)).join('')}</select></label>
   <label>Puntuación mínima (sobre ${esc(criterion.maxScore)})<input name="guardMin" type="number" inputmode="decimal" min="0" max="${esc(criterion.maxScore)}" step="0.01" value="${esc(score)}" required></label>`;
  form.elements.guardCriterion.onchange=()=>{
   const next=criteria.find(c=>c.id===form.elements.guardCriterion.value);
   if(next)renderCriteria(activity.id,next.id,Math.round(next.maxScore*50)/100);
  };
 };
 const renderMode=()=>{
  const mode=form.elements.guardMode.value;
  if(mode==='none'){details.innerHTML='';return;}
  if(mode==='category'){
   if(!eligible.length){details.innerHTML='<p class="hint">La categoría de Actitud ya no existe. Selecciona «Sin condición de Actitud» para limpiar la configuración anterior.</p>';return;}
   details.innerHTML=`<label>Categoría de actitud<select name="guardCategory">${categoryOptions(current?.categoryId||eligible[0].id)}</select></label>`;
   return;
  }
  if(!activities.length){details.innerHTML='<p class="hint">La actividad de rúbrica ya no existe. Selecciona «Sin condición de Actitud» para limpiar la configuración anterior.</p>';return;}
  const selected=activities.find(a=>a.id===current?.assessmentId)||activities[0];
  details.innerHTML=`<label>Actividad con rúbrica de Actitud<select name="guardAssessment">
   ${activities.map(a=>opt(a.id,a.name,selected.id)).join('')}</select></label>
   <div id="itaca-guard-criterion-fields"></div>`;
  renderCriteria(selected.id,current?.criterionId,current?.minScore);
  form.elements.guardAssessment.onchange=()=>renderCriteria(form.elements.guardAssessment.value);
 };
 form.elements.guardMode.onchange=renderMode;
 renderMode();
 $('#itaca-guard-cancel',form).onclick=()=>dialog.close();
 form.onsubmit=async event=>{
  event.preventDefault();
  const mode=form.elements.guardMode.value;
  let condition=null;
  try{
   if(mode==='category'){
    condition={mode,categoryId:form.elements.guardCategory.value,minScore:5};
   }else if(mode==='criterion'){
    const assessment=activities.find(a=>a.id===form.elements.guardAssessment.value);
    const rubric=rubricOf(assessment);
    const criterion=rubric?.criteria.find(c=>c.id===form.elements.guardCriterion.value);
    const minScore=parseScore(form.elements.guardMin.value);
    if(!criterion||minScore>criterion.maxScore)throw new Error('La nota mínima supera el máximo del criterio.');
    condition={mode,categoryId:assessment.categoryId,assessmentId:assessment.id,
     criterionId:criterion.id,minScore};
   }
   await commit(d=>setItacaAttitudeCondition(d,groupId,periodId,condition),'Condición de actitud en Nota Ítaca');
   if(dialog.open)dialog.close();
  }catch(error){fail(error);}
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
/** Una única ventana de acciones por nota evita cientos de menús desplegados
 * dentro del área desplazable. Reutiliza los controladores NP, AJ y observación
 * ya validados, de modo que el modelo y la lógica de guardado permanecen intactos. */
function openGradeCellActions(studentId,assessmentId){
  const student=STATE.doc.students.find(x=>x.id===studentId&&x.groupId===STATE.groupId);
  const activity=STATE.doc.assessments.find(x=>x.id===assessmentId&&x.groupId===STATE.groupId&&x.periodId===STATE.periodId);
  if(!student||!activity)return;
  const grade=STATE.doc.grades.find(x=>x.studentId===studentId&&x.assessmentId===assessmentId);
  const observation=(STATE.doc.gradeObservations||[]).some(x=>x.studentId===studentId&&x.assessmentId===assessmentId);
  dialog.innerHTML=`<div class="modal-inner grade-cell-actions-dialog">
    <h2 id="modal-heading">Opciones de calificación</h2>
    <p class="subtitle">${esc(student.name)} · ${esc(activity.name)}</p>
    <p class="hint">La nota se edita directamente en la tabla. Estas acciones mantienen las reglas actuales de NP, AJ y observaciones.</p>
    <div class="grade-cell-action-list">
      <button type="button" class="btn" id="grade-action-np">${grade?.notSubmitted?'Quitar NP · No presentado':'Marcar NP · No presentado'}</button>
      <button type="button" class="btn" id="grade-action-aj">${grade?.pendingJustified?'Quitar AJ · Ausencia justificada':'Marcar AJ · Ausencia justificada'}</button>
      <button type="button" class="btn" id="grade-action-observation">${observation?'Editar observación':'Añadir observación'}</button>
    </div>
    <div class="modal-actions"><button type="button" class="btn" id="grade-action-close">Cerrar</button></div>
  </div>`;
  $('#grade-action-close',dialog).onclick=()=>dialog.close();
  for(const [id,studentKey,assessmentKey] of [
    ['grade-action-np','npStudent','npAssessment'],
    ['grade-action-aj','ajStudent','ajAssessment'],
    ['grade-action-observation','observationStudent','observationAssessment']]){
    $('#'+id,dialog).onclick=()=>{
      const original=[...document.querySelectorAll('['+
        (studentKey==='npStudent'?'data-np-student':studentKey==='ajStudent'?'data-aj-student':'data-observation-student')+
        ']')].find(b=>b.dataset[studentKey]===studentId&&b.dataset[assessmentKey]===assessmentId);
      dialog.close();
      original?.click();
    };
  }
  dialog.showModal();
}
function bindNotebook(){
  bindGradeInfo();
  const view=currentView();
  const panel=$('.notebook-panel');
  const menus=[...panel.querySelectorAll('.notebook-more-actions,.notebook-student-options,.notebook-grade-options')];
  const closeMenu=(menu,focus=false)=>{menu.open=false;if(focus)menu.querySelector('summary')?.focus({preventScroll:true});};
  for(const menu of menus){
    menu.querySelector('summary').addEventListener('click',()=>{for(const other of menus)if(other!==menu)closeMenu(other);});
    menu.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu.open){event.preventDefault();event.stopPropagation();closeMenu(menu,true);}});
  }
  $('.shell').addEventListener('click',event=>{for(const menu of menus)if(menu.open&&!menu.contains(event.target))closeMenu(menu);});
  const density=root.querySelector('#notebook-density');
  if(density){density.value=document.documentElement.dataset.redesignDensity||'compact';density.addEventListener('change',()=>{document.documentElement.dataset.redesignDensity=density.value;try{localStorage.setItem('appnotas-notebook-density',density.value);}catch{}bindGradeTableHeaders();});}
  const table=root.querySelector('.grade-table');
  if(table){
    let last=null;for(const th of table.querySelectorAll('thead th[data-column-category]')){const cat=th.dataset.columnCategory;if(cat!==last)th.classList.add('redesign-category-start');last=cat;}
    const clear=()=>table.querySelectorAll('.redesign-active-column').forEach(el=>el.classList.remove('redesign-active-column'));
    table.addEventListener('focusin',e=>{const cell=e.target.closest('td,th');if(!cell)return;clear();for(const row of table.rows){if(row.classList.contains('student-origin-divider'))continue;if(row.cells[cell.cellIndex]&&row.cells[cell.cellIndex].colSpan===1)row.cells[cell.cellIndex].classList.add('redesign-active-column');}});
    table.addEventListener('focusout',e=>{if(!table.contains(e.relatedTarget))clear();});
  }
  const adjustNotebookZoom=delta=>{
    const next=Math.min(NOTEBOOK_ZOOM_MAX,Math.max(NOTEBOOK_ZOOM_MIN,STATE.notebookZoom+delta));
    if(next===STATE.notebookZoom)return;
    STATE.notebookZoom=next;
    try{localStorage.setItem('appnotas-notebook-zoom',String(next));}catch{}
    paintNotebookZoom(root);
    bindGradeTableHeaders();
    $('#notebook-zoom-value').textContent=next+' %';
    $('#notebook-zoom-out').disabled=next<=NOTEBOOK_ZOOM_MIN;
    $('#notebook-zoom-in').disabled=next>=NOTEBOOK_ZOOM_MAX;
  };
  $('#notebook-zoom-out')?.addEventListener('click',()=>adjustNotebookZoom(-10));
  $('#notebook-zoom-in')?.addEventListener('click',()=>adjustNotebookZoom(10));
  $('#manage-origin-groups')?.addEventListener('click',openOriginGroupsManager);
  $('#configure-itaca-attitude')?.addEventListener('click',openItacaAttitudeCondition);
  $('#configure-itaca-attitude-toolbar')?.addEventListener('click',()=>{closeMenu($('.notebook-grade-options'),true);openItacaAttitudeCondition();});
  $('#itaca-general-rule')?.addEventListener('change',e=>{
    const groupId=view.groupId,rule=e.target.value;
    commit(doc=>setItacaGroupRule(doc,groupId,rule),'Redondeo general Nota Ítaca').catch(fail);
  });
  document.querySelectorAll('[data-itaca-student]').forEach(button=>button.onclick=()=>openItacaStudentRule(button.dataset.itacaStudent));
  $('#copy-structure')?.addEventListener('click',openCopyActivities);
  $('#schedule-exam')?.addEventListener('click',()=>openPlannerExam());
  document.querySelectorAll('[data-view-student]').forEach(b=>b.onclick=()=>{STATE.studentId=b.dataset.viewStudent;STATE.studentPeriodId=STATE.periodId;STATE.studentFull=false;STATE.tab='alumno';render();});
  document.querySelectorAll('[data-edit-student]').forEach(b=>b.onclick=()=>openStudentTools(b.dataset.editStudent));
  document.querySelectorAll('[data-observation-student]').forEach(b=>b.onclick=()=>openGradeObservation(b.dataset.observationStudent,b.dataset.observationAssessment));
  document.querySelectorAll('[data-grade-cell-actions-student]').forEach(b=>b.onclick=()=>openGradeCellActions(b.dataset.gradeCellActionsStudent,b.dataset.gradeCellActionsAssessment));
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
      const replacement=[...document.querySelectorAll('[data-grade-cell-actions-student]')].find(b=>b.dataset.gradeCellActionsStudent===studentId&&b.dataset.gradeCellActionsAssessment===assessmentId);
      if(replacement){const table=$('.table-scroller');table.scrollLeft=left;table.scrollTop=top;replacement.focus({preventScroll:true});}
    }
  });
  $('#new-student').onclick=()=>fieldsModal('Añadir alumno',[
    {id:'lastName',label:'Apellidos',value:'',maxlength:100},
    {id:'firstName',label:'Nombre',value:'',maxlength:80},
    {id:'originGroup',label:'Grupo de procedencia (p. ej., 1.º A)',value:'',maxlength:60,required:false}
  ],async v=>commit(d=>addStudent(d,view.groupId,{firstName:v.firstName,lastName:v.lastName,originGroup:v.originGroup})),'El grupo de procedencia es una etiqueta para las sesiones de evaluación; no separa las calificaciones de la optativa.');
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
  const restoreFocus=(studentId,assessmentId,move=0,position=snapshotGradeScroll(),origin=null)=>{
    if(!sameView(view)||activePointers.size||deferredRender)return;
    const active=document.activeElement;
    if(origin&&active&&active!==document.body&&active!==root&&active!==origin)return;
    const students=allStudents(),at=students.findIndex(s=>s.id===studentId);
    const targetId=students[Math.max(0,Math.min(students.length-1,at+move))]?.id;
    const next=[...document.querySelectorAll('input[data-student][data-assessment]')]
      .find(input=>input.dataset.student===targetId&&input.dataset.assessment===assessmentId);
    // Evitar el scroll implícito de focus() en Safari iPadOS.
    if(next){next.focus({preventScroll:true});next.select();}
    restoreGradeScroll(position);
    // Tras cerrar o mover el teclado, WebKit puede ajustar el viewport en el
    // fotograma siguiente. No desplazar la tabla ni saltar al principio.
    requestAnimationFrame(()=>{if(sameView(view)&&!activePointers.size){restoreGradeScroll(position);requestAnimationFrame(()=>{if(sameView(view)&&!activePointers.size)restoreGradeScroll(position);});}});
  };
  document.querySelectorAll('[data-student][data-assessment]').forEach(field=>{
    let move=0,positionAtEnter=null,lastInputScroll=null;
    // Registrar el desplazamiento ANTES de que el blur/teclado iPadOS lo altere.
    field.addEventListener('input',()=>{lastInputScroll=snapshotGradeScroll();});
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
      const position=positionAtEnter||lastInputScroll||snapshotGradeScroll();
      const {student:studentId,assessment:assessmentId}=field.dataset,value=field.value.trim(),direction=move;
      positionAtEnter=null;lastInputScroll=null;move=0;
      try{
        await commit(d=>setGrade(d,studentId,assessmentId,value===''?null:value.replace(',','.')),'Editar nota');
        restoreFocus(studentId,assessmentId,direction,position,field);
      }catch(err){
        fail(err);renderAfterMutation();
        restoreFocus(studentId,assessmentId,0,position,field);
      }
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
  const {groupId,periodId}=currentView();
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
    try{const selectedRule=$('#individual-rule-select',dialog).value;await commit(doc=>setIndividualCategoryRule(doc,studentId,categoryId,periodId,selectedRule),'Regla individual de categoría');if(dialog.open)dialog.close();}
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
  const {groupId,periodId}=currentView();
  document.querySelectorAll('[data-category-color]').forEach(field=>field.onchange=()=>{const id=field.dataset.categoryColor,value=field.value;return commit(d=>setCategoryColumnColor(d,id,value),'Color de categoría').catch(fail);});
  document.querySelectorAll('[data-category-color-reset]').forEach(button=>button.onclick=()=>commit(d=>setCategoryColumnColor(d,button.dataset.categoryColorReset,null),'Eliminar color de categoría').catch(fail));
  $('#individual-rules')?.addEventListener('click',openIndividualRuleDirectory);
  document.querySelectorAll('[data-delete-category]').forEach(b=>b.onclick=async()=>{
    const category=STATE.doc.categories.find(c=>c.id===b.dataset.deleteCategory);
    if(!category)return;
    if(!window.confirm(`¿Retirar «${category.name}» únicamente de ${currentPeriod().name}? No se modifican las demás evaluaciones.`))return;
    try{await commit(d=>setPeriodCategoryEnabled(d,groupId,periodId,category.id,false),'Retirar categoría de evaluación');}catch(err){fail(err);}
  });
  $('#new-category').onclick=()=>fieldsModal('Nueva categoría en esta evaluación',[{id:'name',label:'Nombre'},{id:'weight',label:'Porcentaje en esta evaluación (revisa que la suma sea 100)',type:'number',value:0,min:0,max:100,step:'any'}],async v=>commit(d=>addPeriodCategory(d,groupId,periodId,v.name,Number(v.weight))),'Se añadirá únicamente a la materia y evaluación seleccionadas. Podrás activarla también en otros períodos.');
  $('#enable-category')?.addEventListener('click',()=>{
    const categoryId=$('#category-to-enable')?.value;
    if(!categoryId)return toast('Selecciona una categoría existente.');
    commit(d=>setPeriodCategoryEnabled(d,groupId,periodId,categoryId,true),'Activar categoría en evaluación').catch(fail);
  });
  document.querySelectorAll('[data-periodweight]').forEach(field=>field.onchange=async()=>{const categoryId=field.dataset.periodweight,patch={weight:Number(field.value)};try{await commit(d=>setPeriodCategory(d,groupId,periodId,categoryId,patch));}catch(err){fail(err);render();}});
  document.querySelectorAll('[data-periodrule]').forEach(field=>field.onchange=async()=>{const categoryId=field.dataset.periodrule,patch={rule:field.value};try{await commit(d=>setPeriodCategory(d,groupId,periodId,categoryId,patch));}catch(err){fail(err);render();}});
  document.querySelectorAll('[data-bestcount]').forEach(field=>field.onchange=async()=>{const categoryId=field.dataset.bestcount,patch={bestCount:Number(field.value)};try{await commit(d=>setPeriodCategory(d,groupId,periodId,categoryId,patch));}catch(err){fail(err);render();}});
  $('#reset-rules').onclick=async()=>{if(window.confirm('¿Restablecer los porcentajes y reglas de esta evaluación? La selección de categorías se conservará.'))try{await commit(d=>resetPeriodCategories(d,groupId,periodId));}catch(err){fail(err);}};
  $('#copy-rules').onclick=async()=>{const source=$('#source-period').value;if(!source)return toast('Selecciona un periodo de origen.');if(!window.confirm('¿Copiar las categorías evaluables, sus porcentajes y reglas desde el otro período? No se pueden retirar categorías que ya tengan actividades o condiciones de Ítaca aquí.'))return;
    try{await commit(d=>copyPeriodCategories(d,groupId,source,periodId));}catch(err){fail(err);}
  };
}
function bindCompetencies(){
  const {groupId,periodId}=currentView(),version=STATE.competencyVersion;
  $('#new-competency')?.addEventListener('click',()=>fieldsModal('Nueva competencia personalizada',[{id:'name',label:'Nombre de la competencia'}],async v=>commit(d=>addCompetency(d,v.name,groupId))));
  $('#comp-curr-version')?.addEventListener('change',e=>{STATE.competencyVersion=e.target.value;render();});
  document.querySelectorAll('[data-comp][data-linkcat], [data-official][data-linkcat]').forEach(input=>input.onchange=async e=>{
    const weight=Number(e.target.value),categoryId=e.target.dataset.linkcat,code=e.target.dataset.official,competencyId=e.target.dataset.comp;
    if(!Number.isFinite(weight)||weight<0||weight>1000){fail(new Error('Peso competencial fuera de rango.'));render();return;}
    try{await commit(d=>{
      // Los enlaces son del grupo, pero solo se editan desde una evaluación activa.
      if(!availableCategories(d,groupId,periodId).some(c=>c.id===categoryId))throw Error('La categoría no está activa en esta evaluación.');
      let id=competencyId;
      if(code){
        const catalogue=officialCompetenciesForGroup(d.groups.find(g=>g.id===groupId),version);
        const found=catalogue?.competencias.find(c=>c.key===code);
        if(!found)throw new Error('Competencia oficial no disponible.');
        let stored=linkedOfficialCompetency(d,groupId,code);
        if(!stored&&weight!==0)stored=addCompetency(d,`${found.code} · ${found.enunciado}`,groupId,code);
        if(!stored)return;
        id=stored.id;
      }
      setCompetencyLink(d,id,categoryId,weight===0?null:weight);
    },'Vincular competencia y categoría');}
    catch(err){fail(err);render();}
  });
}

function bindSettings(){
  $('#dropbox-upgrade')?.addEventListener('click',openDropboxUpgrade);
  $('#dropbox-link')?.addEventListener('click',()=>navigateDropbox('link').catch(()=>toast('No se pudo iniciar la autorización de Dropbox. Comprueba el guardado y la conexión.')));
  $('#dropbox-unlink')?.addEventListener('click',()=>void unlinkDropbox());
  $('#dropbox-conflict-copies')?.addEventListener('click',()=>void openDropboxConflictCopies());
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
    const color=e.target.value;commit(d=>setSubjectAccent(d,level,subject,color)).catch(fail);
  });
  $('#reset-accents').onclick=async()=>{
    if(!window.confirm('¿Restablecer los cinco colores de acento?'))return;
    try{await commit(d=>{d.settings.subjectAccents={...SUBJECT_COLORS,...Object.fromEntries((d.settings.customSubjects||[]).map(x=>[subjectKey(x.level,x.subject),defaultSubjectAccent(x.level,x.subject)]))};d.updatedAt=new Date().toISOString();});}catch(e){fail(e);}
  };
  $('#decimals').onchange=e=>{const value=Number(e.target.value);return commit(d=>{d.settings.decimals=value;d.updatedAt=new Date().toISOString();}).catch(fail);};
  $('#rounding').onchange=e=>{const value=e.target.value;return commit(d=>{d.settings.rounding=value;d.updatedAt=new Date().toISOString();}).catch(fail);};
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
      const expected=['./','./index.html','./styles.css','./app.js','./manifest.webmanifest','./icons/icon.svg','./icons/icon-192.png','./icons/icon-512.png','./icons/icon-maskable-512.png','./icons/apple-touch-icon.png','./src/pwa-controls.js','./src/model.js','./src/cuaderno.js','./src/planner.js','./src/planner-ui.js','./src/evaluation-groups.js','./src/evaluation-ui.js','./src/evaluation-workspace.js','./src/notebook-evaluation-notice.js','./src/evaluation-period-board.js','./src/evaluation-session-presentation.js','./src/student-link-ui.js','./src/extracurricular.js','./src/extracurricular-export.js','./src/extracurricular-ui.js','./src/timetable-export.js','./src/patio-rotation.js','./src/attitude-template.js','./src/rubric-xlsx.js','./vendor/jszip.min.js','./src/calculations.js','./src/statistics.js','./src/csv.js','./src/rubric-import.js','./src/rubric-ui.js','./src/history.js','./src/dropbox-conflict.js','./src/dropbox-config.js','./src/dropbox-onboarding.js','./src/dropbox-session.js','./src/period-preferences.js','./src/dropbox-controller.js','./src/dropbox-local.js','./src/dropbox-sync.js','./src/dropbox-oauth.js','./src/vault.js','./src/storage.js','./src/diagnostics.js','./src/curriculum-data.js','./src/official-competencies.js','./data/curriculos/gr1y2-nuevo.pdf','./data/curriculos/lat1y2-nuevo.pdf','./data/curriculos/lat4.pdf','./data/curriculos/lat2-2022.pdf'];
      const cache=await caches.open('cuaderno-docente-static-v213-dev');
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
  if(!STATE.doc||STATE.studentPresentation||dialog.open||STATE.tab==='alumno'&&STATE.studentId||!(event.ctrlKey||event.metaKey)||event.altKey)return;
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
