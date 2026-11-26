// Prueba real de renderizado y gestos con datos ficticios: Chromium móvil + WebKit.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,join,sep,extname} from 'node:path';
import {chromium,webkit} from 'playwright';

const app=resolve(fileURLToPath(new URL('../app/',import.meta.url)));
const images=resolve(fileURLToPath(new URL('../_ui_mobile/',import.meta.url)));
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json',
 '.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.pdf':'application/pdf'};
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  const decoded=decodeURIComponent(url.pathname);
  const rel=decoded==='/'?'index.html':decoded.slice(1);
  const file=resolve(app,rel);
  if(!file.startsWith(app+sep)){res.writeHead(403);res.end();return;}
  const data=await readFile(file);
  res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
  res.end(data);
 }catch(error){res.writeHead(error.code==='ENOENT'?404:500);res.end(error.message);}
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const url='http://127.0.0.1:'+server.address().port+'/';
await mkdir(images,{recursive:true});

async function auditExamsAndGroupedScroll(browser,name){
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 try{
  const page=await context.newPage();
  await page.clock.setFixedTime(new Date(2026,10,24,11,30));
  await page.goto(url);
  await page.evaluate(async()=>{
   const {initialNotebook,addStudent,updateStudentIdentity}=await import('./src/model.js');
   const {saveEvent,addAcademicYear,setActiveYear,activeYear}=await import('./src/planner.js');
   const {createVault}=await import('./src/vault.js');
   const {openDb,writeEnvelope}=await import('./src/storage.js');
   const doc=initialNotebook(),group=doc.groups[0],year=activeYear(doc);
   for(const student of doc.students)updateStudentIdentity(doc,student.id,{name:student.name,originGroup:'1.º A'});
   for(let i=0;i<8;i++)addStudent(doc,group.id,{name:'Alumno B '+i,originGroup:'1.º B'});
   saveEvent(doc,{type:'exam',title:'Examen pasado',date:'2026-11-24',time:'09:00'});
   saveEvent(doc,{type:'exam',title:'Examen de hoy',date:'2026-11-24',time:'12:00',groupId:group.id});
   saveEvent(doc,{type:'meeting',title:'Reunión futura',date:'2026-11-25',time:'09:00'});
   const next=addAcademicYear(doc,{name:'2027-2028',start:'2027-09-01',end:'2028-06-30'});
   setActiveYear(doc,next.id);
   saveEvent(doc,{type:'exam',title:'Examen del curso siguiente',date:'2027-10-01'});
   setActiveYear(doc,year.id);
   const {envelope}=await createVault('Cuaderno ficticio 2026 para pruebas',doc);
   const db=await openDb();
   await writeEnvelope(db,envelope,null);
   db.close();
  });
  await page.reload();
  await page.locator('#password').fill('Cuaderno ficticio 2026 para pruebas');
  await page.getByRole('button',{name:'Desbloquear'}).click();
  await page.locator('[data-tab="planificador"]').click();
  await page.locator('#plan-show-exams').click();
  const modal=page.getByRole('dialog',{name:'Próximos exámenes'});
  const examTitles=modal.locator('li strong');
  assert.deepEqual(await examTitles.allTextContents(),['Examen de hoy','Examen del curso siguiente']);
  assert.match(await modal.locator('li').first().innerText(),/12:00.*Latín I/s);
  await modal.getByRole('button',{name:'Cerrar'}).click();
  await page.clock.setFixedTime(new Date(2028,0,1));
  await page.locator('#plan-show-exams').click();
  assert.match(await modal.innerText(),/No hay exámenes próximos programados/);
  await modal.getByRole('button',{name:'Cerrar'}).click();
  await page.locator('[data-tab="cuaderno"]').click();
  await page.locator('label[for="student-group-mode"]').click();

  const scroller=page.locator('.table-scroller');
  for(const view of ['cuaderno','final']){
   if(view==='final')await page.locator('[data-academic-quick="final"]').click();
   for(const zoom of (view==='final'?[100]:[100,110])){
    if(zoom===110)await page.locator('#notebook-zoom-in').click();
    const geometry=await scroller.evaluate(async el=>{
     const box=node=>node.getBoundingClientRect();
     const scrollTo=(left,top)=>new Promise(resolve=>{
      const previousLeft=el.scrollLeft,previousTop=el.scrollTop;
      el.addEventListener('scroll',resolve,{once:true});
      el.scrollTo(left,top);
      if(el.scrollLeft===previousLeft&&el.scrollTop===previousTop){
       el.removeEventListener('scroll',resolve);
       resolve();
      }
     });
     const table=el.querySelector('table');
     const [first,second]=table.tBodies;
     const firstTitle=first.rows[0].cells[0],secondTitle=second.rows[0].cells[0];
     const student=first.rows[1].cells[0];
     const corner=table.tHead.rows[0].cells[0];
     const zoom=Number(getComputedStyle(table).zoom)||1;
     window.scrollBy(0,box(el).top-120);
     await scrollTo(el.scrollWidth,0);
     const firstStudentGap=box(student).top-box(firstTitle).bottom;
     await scrollTo(el.scrollLeft,35);
     const rect=box(firstTitle);
     const fixedLeft=rect.left-box(corner).left;
     const headerGap=rect.top-box(corner).bottom;
     // Pasar de los rectángulos de la tabla al espacio del viewport para elementFromPoint.
     const tableBox=box(table),scrollerBox=box(el);
     const scale=table.offsetWidth*zoom/tableBox.width;
     const hit=document.elementFromPoint(
      scrollerBox.left-el.scrollLeft+(rect.left-tableBox.left)*scale+13,
      scrollerBox.top-el.scrollTop+(rect.top+rect.height/2-tableBox.top)*scale);
     await scrollTo(el.scrollLeft,(second.offsetTop-corner.offsetHeight)*zoom+15);
     return {horizontal:el.scrollLeft,firstStudentGap,fixedLeft,headerGap,
      labelOnTop:hit?.closest('th')===firstTitle,
      nextHeaderGap:box(secondTitle).top-box(corner).bottom,
      transitionGap:box(secondTitle).top-box(firstTitle).bottom};
    });
    const detail=name+' '+view+' '+zoom+'% '+JSON.stringify(geometry);
    assert(geometry.horizontal>0,detail);
    assert(Math.abs(geometry.firstStudentGap)<2 && Math.abs(geometry.fixedLeft)<2,detail);
    assert(Math.abs(geometry.headerGap)<2 && geometry.labelOnTop,detail);
    assert(Math.abs(geometry.nextHeaderGap)<2 && geometry.transitionGap>=-1,detail);
   }
  }
 }finally{await context.close();}
}

async function auditStudentPresentation(page,name){
 const periods=page.locator('[data-period-choice]');
 const initialCount=await periods.count();
 await page.locator('#new-period').click();
 await page.locator('#modal-form input[name="name"]').fill('Cuarta de prueba');
 await page.locator('#modal-form button[type="submit"]').click();
 await page.getByRole('button',{name:'Cuarta de prueba',exact:true}).waitFor();
 await page.getByRole('button',{name:'Gestionar Cuarta de prueba',exact:true}).click();
 const actionLayout=await page.locator('#modal-form .modal-actions').evaluate(actions=>{
  const dialog=actions.closest('dialog').getBoundingClientRect();
  return [...actions.querySelectorAll('button')].map(button=>{
   const r=button.getBoundingClientRect();
   return {label:button.textContent,left:r.left,right:r.right,
    fits:r.width>0&&r.left>=Math.max(0,dialog.left)-1&&r.right<=Math.min(innerWidth,dialog.right)+1};
  });
 });
 assert.equal(actionLayout.length,5,name+' gestión de períodos: cinco acciones');
 assert(actionLayout.every(button=>button.fits),name+' gestión de períodos: '+JSON.stringify(actionLayout));
 let confirmationMessage;
 page.once('dialog',async confirmation=>{
  confirmationMessage=confirmation.message();
  await confirmation.accept();
 });
 await page.getByRole('button',{name:'Eliminar período',exact:true}).click();
 assert.match(confirmationMessage,/Cuarta de prueba.*todos los grupos/);
 await page.getByRole('button',{name:'Cuarta de prueba',exact:true}).waitFor({state:'detached'});
 await page.locator('#modal').waitFor({state:'hidden'});
 assert.equal(await periods.count(),initialCount,name+' no se ha eliminado la cuarta evaluación');
 await page.locator('.header-tools>summary').click();
 await page.locator('#undo-change').click();
 await page.getByRole('button',{name:'Cuarta de prueba',exact:true}).waitFor();
 await page.locator('#redo-change').click();
 await page.getByRole('button',{name:'Cuarta de prueba',exact:true}).waitFor({state:'detached'});
 if(await page.locator('.header-tools').getAttribute('open')!==null)await page.locator('.header-tools>summary').click();

 const activeId=await periods.nth(1).getAttribute('data-period-choice');
 const firstId=await periods.first().getAttribute('data-period-choice');
 await periods.nth(1).click();
 await page.locator('[data-academic-quick="alumno"]').click();
 const directory=page.locator('[data-open-student]');
 const otherName=(await directory.nth(1).locator('span').nth(1).textContent()).trim();
 await directory.first().click();
 const evaluation=page.locator('#student-period-select');
 assert.equal(await evaluation.inputValue(),activeId,name+' el visor ignora la evaluación activa');
 assert.equal(await page.locator('.student-assessment-block').count(),0);
 await page.locator('#present-student').click();

 const privateView=page.locator('.student-presentation');
 assert(await privateView.isVisible());
 assert.equal(await page.locator('.shell,.tabs,.class-toolbar,#previous-student,#next-student,#hide-student,[data-open-student],[data-class-stat]').count(),0);
 assert(!(await page.locator('#app').textContent()).includes(otherName),name+' hay otro alumno en el DOM');
 await evaluation.selectOption(firstId);
 await privateView.locator('[data-student-explanation="academic"]').click();
 const modal=page.locator('#modal');
 assert.match(await modal.innerText(),/Media ponderada.*categorías/);
 assert.match(await modal.innerText(),/Examen UD2/);
 assert.match(await modal.innerText(),/60 % configurado/);
 await modal.locator('#close-info').click();
 await privateView.locator('[data-student-explanation="itaca"]').click();
 assert.match(await modal.innerText(),/umbral de 0,50/);
 await modal.locator('#close-info').click();

 const competencies=privateView.locator('.student-competencies');
 assert.equal(await competencies.getAttribute('open'),null);
 await competencies.locator('summary').click();
 assert.match(await competencies.innerText(),/Media aritmética de competencias/);
 assert.match(await competencies.locator('[data-student-explanation="competency-mean"]').innerText(),/7,85\s*\/\s*10/);
 await privateView.getByRole('button',{name:'Vista completa'}).click();
 assert(await privateView.locator('.student-assessment-block').count()>0);
 assert.equal(await privateView.locator('[data-student-period-order]').count(),0);
 await privateView.getByRole('button',{name:'Vista simplificada'}).click();
 assert.equal(await privateView.locator('.student-assessment-block').count(),0);
 const contentFits=await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+2);
 assert(contentFits,name+' la presentación desborda la pantalla');
 await privateView.locator('#exit-student-presentation').click();
 assert(await page.locator('#next-student').isVisible());
 assert.equal(await evaluation.inputValue(),firstId);
 await page.locator('#hide-student').click();
 await page.locator('[data-academic-quick="cuaderno"]').click();
 await periods.first().click();
}

async function audit(engine,name){
 const browser=await engine.launch({headless:true,args:name==='chromium'?['--no-sandbox']:[]});
 try{
  await auditExamsAndGroupedScroll(browser,name);
  const context=await browser.newContext({viewport:{width:390,height:844},
   deviceScaleFactor:2,isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  const page=await context.newPage(),pageErrors=[];
  page.on('pageerror',error=>pageErrors.push(error.message));
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.locator('#password').fill('Cuaderno ficticio 2026 para pruebas');
  await page.locator('#confirm-password').fill('Cuaderno ficticio 2026 para pruebas');
  await page.locator('[data-create-mode="demo"]').click();
  await page.locator('.nav-primary [data-tab="cuaderno"]').waitFor({timeout:30000});
  assert((await page.locator('.course-choice').count())>=4,'Debe haber materias visibles');
  // El último botón puede pertenecer a una materia aún sin grupo: recordar el
  // grupo inicial de demostración para probar las acciones del cuaderno.
  const defaultCourse=await page.locator('.course-choice[aria-pressed="true"]').evaluate(node=>({
   level:node.dataset.courseLevel,subject:node.dataset.courseSubject
  }));

  await auditStudentPresentation(page,name);

  for(const size of [
    {width:320,height:700},{width:375,height:812},{width:390,height:844},
    {width:430,height:932},{width:768,height:1024},{width:834,height:1112},
    {width:1024,height:768},{width:1180,height:820}
  ]){
   await page.setViewportSize(size);
   await page.locator('.nav-primary [data-tab="evaluaciones"]').click();
   assert(await page.locator('.class-toolbar').isVisible(),name+' materias ocultas en Evaluaciones');
   assert(await page.getByRole('heading',{name:'Sesiones de evaluación'}).isVisible());
   assert(await page.locator('.tabs').evaluate(nav=>{
    const toolbar=document.querySelector('.class-toolbar');
    return nav.compareDocumentPosition(toolbar)&Node.DOCUMENT_POSITION_FOLLOWING;
   }),name+' navegación posterior a los controles de materia');
   const geometry=await page.evaluate(()=>{
    const strip=document.querySelector('.course-buttons');
    const subject=strip?.querySelector('.course-choice[aria-pressed="true"]');
    const evalTab=document.querySelector('.eval-workspace-tab');
    const extra=document.querySelector('.group-actions-disclosure>summary');
    const doc=document.documentElement;
    return {client:doc.clientWidth,scroll:doc.scrollWidth,
      subjectHeight:subject?.getBoundingClientRect().height,
      evalTabHeight:evalTab?.getBoundingClientRect().height,
      actionHeight:extra?.getBoundingClientRect().height};
   });
   assert(geometry.scroll<=geometry.client+3,
    name+' desborda página '+JSON.stringify(size)+' '+JSON.stringify(geometry));
   assert(geometry.subjectHeight>=43.5,name+' materia táctil pequeña');
   assert(geometry.evalTabHeight>=43.5,name+' pestaña Evaluaciones demasiado pequeña');
   assert(geometry.actionHeight>=43.5,name+' menú grupos demasiado pequeño');
   // Regresión detectada en v163: una cuadrícula de 4 columnas con 3 botones
   // dejaba aproximadamente el 25 % de la barra de navegación sin utilizar.
   if(size.width<=900){
    const nav=await page.evaluate(()=>{
     const bar=document.querySelector('.tabs');
     const cards=[...bar.querySelectorAll('.nav-primary>.tab'),
      bar.querySelector('.academic-disclosure>summary')];
     const rect=n=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,height:r.height}};
     return {bar:rect(bar),cards:cards.map(rect),
      visible:cards.map(c=>getComputedStyle(c).display!=='none')};
    });
    assert.equal(nav.cards.length,5,'Deben ocupar la barra cuatro módulos y Recursos');
    assert(nav.visible.every(Boolean),name+' hay botones de navegación ocultos');
    const min=Math.min(...nav.cards.map(c=>c.width)),max=Math.max(...nav.cards.map(c=>c.width));
    assert(max-min<=3,name+' botones de navegación con anchuras desiguales: '+JSON.stringify(nav));
    assert(Math.abs(nav.cards[0].left-nav.bar.left)<=11,name+' hueco inicial de navegación');
    assert(Math.abs(nav.bar.right-nav.cards.at(-1).right)<=11,name+' última columna vacía');
    assert(nav.cards.every(c=>c.height>=43.5),name+' navegación táctil insuficiente');
    // Medir icono, título y altura real, no solamente la presencia de botones.
    const alignment=await page.evaluate(()=>{
     const elements=[...document.querySelectorAll('.tabs .nav-primary>.tab'),
      document.querySelector('.tabs .academic-disclosure>summary')];
     return elements.map(el=>{
      const root=el.getBoundingClientRect(),icon=el.querySelector('.nav-glyph').getBoundingClientRect();
      const label=el.querySelector('.nav-text').getBoundingClientRect();
      return {height:root.height,top:root.top,iconTop:icon.top,labelTop:label.top,
       buttonCenter:(root.left+root.right)/2,
       iconCenter:(icon.left+icon.right)/2,labelCenter:(label.left+label.right)/2,
       labelGrow:getComputedStyle(el.querySelector('.nav-text')).flexGrow};
     });
    });
    const first=alignment[0],toolsNav=alignment.at(-1);
    assert(alignment.every(el=>Math.abs(el.height-first.height)<=2&&
      Math.abs(el.top-first.top)<=2),
     name+' Recursos no comparte altura/fila: '+JSON.stringify(alignment));
    assert(alignment.every(el=>Math.abs(el.iconTop-first.iconTop)<=2&&
      Math.abs(el.labelTop-first.labelTop)<=2),
     name+' iconos o títulos descentrados: '+JSON.stringify(alignment));
    assert(Math.abs(toolsNav.iconCenter-toolsNav.buttonCenter)<=1.5&&
      Math.abs(toolsNav.labelCenter-toolsNav.buttonCenter)<=1.5,
     name+' eje de Recursos desalineado: '+JSON.stringify(toolsNav));
    assert.equal(toolsNav.labelGrow,'0','Recursos no debe estirar su título');
    // Recursos debe ser un control real y el menú no debe salir del viewport.
    await page.locator('.tabs .academic-disclosure>summary').click();
    const tools=await page.evaluate(()=>{
     const menu=document.querySelector('.tabs .nav-academic-links');
     const r=menu.getBoundingClientRect();
     return {left:r.left,right:r.right,visible:!!r.width};
    });
    assert(tools.visible&&tools.left>=-2&&tools.right<=size.width+2,
      name+' panel Recursos fuera de pantalla '+JSON.stringify(tools));
    await page.locator('.tabs .academic-disclosure>summary').click();
   }
   if(size.width<=650){
    const slots=await page.evaluate(()=>{
     const rect=q=>{const node=document.querySelector(q);if(!node)return null;
      const r=node.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,height:r.height};};
     return {toolbar:rect('.class-more-actions'),summary:rect('.group-actions-disclosure>summary')};
    });
    assert(Math.abs(slots.toolbar.width-slots.summary.width)<=3,
      name+' el botón Materias y grupos no rellena su espacio: '+JSON.stringify(slots));
    assert(slots.summary.height>=43.5,name+' menú Materias/grupos demasiado pequeño');
   }
   if(size.width>=651&&size.width<=900){
    const courses=await page.evaluate(()=>{
     const strip=document.querySelector('.course-buttons');
     const last=strip.querySelector('.course-choice:last-child');
     const a=strip.getBoundingClientRect(),b=last.getBoundingClientRect();
     return {left:a.left,right:a.right,final:b.right,overflow:strip.scrollWidth>strip.clientWidth+3};
    });
    if(!courses.overflow)assert(Math.abs(courses.right-courses.final)<=10,
     name+' tira de materias no aprovecha el ancho iPad: '+JSON.stringify(courses));
   }
   // Elegir la última materia, cambiar de módulo y comprobar scroll horizontal conservado.
   await page.locator('.course-choice').last().click();
   await page.locator('.nav-primary [data-tab="planificador"]').click();
   assert(!(await page.locator('.class-toolbar').isVisible()),name+' selector de grupo visible en Agenda');
   if(size.width<=1200){
    const agenda=await page.evaluate(()=>{
     const box=q=>{const e=document.querySelector(q);if(!e)return null;const r=e.getBoundingClientRect();
      return {left:r.left,right:r.right,width:r.width,height:r.height};};
     const buttonBoxes=q=>[...document.querySelectorAll(q)].map(e=>{const r=e.getBoundingClientRect();
      return {left:r.left,right:r.right,width:r.width,height:r.height}});
     return {tabs:buttonBoxes('.planner-view-tabs .planner-view-btn'),
      tabContainer:box('.planner-view-tabs'),
      tools:buttonBoxes('.planner-tools-minimal>.planner-create-menu, .planner-tools-minimal>.btn'),
      header:buttonBoxes('.planner-year-chooser>.btn'),
      dates:buttonBoxes('.planner-date-controls>.btn')};
    });
    assert.equal(agenda.tabs.length,5,'Agenda: cinco vistas');
    assert(agenda.tabs.every(x=>x.height>=43.5),name+' pestañas Agenda demasiado bajas');
    assert.equal(agenda.tools.length,3,'Agenda: tres acciones principales');
    assert(agenda.tools.every(x=>x.width>0),'Agenda: botón principal oculto');
    if(size.width<=650){
     assert(Math.abs(agenda.tabs[0].width-agenda.tabs[1].width)<3,
      name+' pestañas Agenda mal distribuidas');
     assert(Math.abs(agenda.tabs[4].width-agenda.tabContainer.width)<=4,
      name+' quinta pestaña Agenda deja hueco en fila');
     assert(Math.max(...agenda.tools.map(x=>x.width))-Math.min(...agenda.tools.map(x=>x.width))<=3,
      name+' acciones de Agenda con anchura desigual');
     assert(agenda.header.length===2&&Math.abs(agenda.header[0].width-agenda.header[1].width)<3,
      name+' botones Curso de Agenda con anchura desigual');
     assert(agenda.dates.every(x=>x.height>=43.5),'Agenda: flechas de fecha demasiado pequeñas');
    }else{
     assert(Math.max(...agenda.tabs.map(x=>x.width))-Math.min(...agenda.tabs.map(x=>x.width))<=3,
      name+' pestañas Agenda con tamaños diferentes en iPad');
    }
   }
   await page.locator('.nav-primary [data-tab="evaluaciones"]').click();
   const selected=await page.evaluate(()=>{
    const list=document.querySelector('.course-buttons'),btn=list.querySelector('.course-choice[aria-pressed="true"]');
    const a=list.getBoundingClientRect(),b=btn.getBoundingClientRect();
    return {inside:b.left>=a.left-3&&b.right<=a.right+3,left:b.left,right:b.right,outerLeft:a.left,outerRight:a.right};
   });
   assert(selected.inside,name+' asignatura activa fuera de vista '+JSON.stringify(size)+' '+JSON.stringify(selected));
   assert(await page.locator('.class-toolbar').isVisible());
   if(size.width===390||size.width===834){
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:join(images,name+'-'+size.width+'-evaluaciones.png'),fullPage:false});
   }
   await page.locator('.nav-primary [data-tab="cuaderno"]').click();
   assert(await page.locator('.class-toolbar').isVisible());
   await page.locator('.course-choice[data-course-level="'+defaultCourse.level+
    '"][data-course-subject="'+defaultCourse.subject+'"]').click();
   if(size.width===390){
    const groupMenu=page.locator('.group-actions-disclosure');
    await groupMenu.locator('summary').click();
    for(const id of ['#manage-subjects','#edit-group','#manage-shared-students'])
     assert(await groupMenu.locator(id).isVisible(),name+' falta una acción de materias y grupos: '+id);
    await groupMenu.locator('summary').click();

    const tableMenu=page.locator('.notebook-more-actions');
    await tableMenu.locator('summary').click();
    for(const id of ['#csv-import','#new-recovery','#copy-structure','#schedule-exam'])
     assert(await tableMenu.locator(id).isVisible(),name+' falta una acción en la tabla: '+id);
    const chooserPromise=page.waitForEvent('filechooser');
    await tableMenu.locator('#csv-import').click();
    const chooser=await chooserPromise;
    assert.equal(await chooser.element().getAttribute('id'),'csv-file');
    await tableMenu.locator('#new-recovery').click();
    assert(await page.getByRole('heading',{name:'Nueva recuperación'}).isVisible());
    await page.keyboard.press('Escape');
    await tableMenu.locator('summary').click();

    const finalView=page.getByRole('button',{name:'Evaluación final',exact:true});
    assert.equal(await finalView.count(),1);
    await finalView.click();
    assert(await page.locator('.final-table').isVisible());
    await page.locator('[data-academic-quick="cuaderno"]').click();
   }
   // Regresión visual: en tablet/escritorio el menú flotante debe captar el toque,
   // incluso cuando coincide en pantalla con cabeceras sticky de actividades.
   if(size.width>=834){
    const tableMenu=page.locator('.notebook-more-actions');
    await tableMenu.locator('summary').click();
    const recovery=tableMenu.locator('#new-recovery');
    await recovery.scrollIntoViewIfNeeded();
    const hit=await recovery.evaluate(button=>{
     const rect=button.getBoundingClientRect();
     const x=(rect.left+rect.right)/2,y=(rect.top+rect.bottom)/2;
     const front=document.elementFromPoint(x,y);
     return {uncovered:button===front||button.contains(front),front:front?.tagName,
      x:Math.round(x),y:Math.round(y)};
    });
    assert(hit.uncovered,name+' Acciones de la tabla ocultas por cabecera sticky: '+JSON.stringify(hit));
    await tableMenu.locator('summary').click();
   }
   // Probar reglas reales sobre una fila de estilos temporal y ficticia:
   // el cálculo de notas y el documento cifrado no se modifican.
   const gradeSizing=await page.evaluate(()=>{
    const table=document.querySelector('.grade-table:not(.final-table)');
    if(!table||!table.tBodies[0])return {missing:true};
    const row=document.createElement('tr');
    row.innerHTML=
     '<td><input class="note-input grade-colored" value="8,5"></td>'+
     '<td><button class="converted-primary"><span class="grade-chip">8,5</span></button></td>'+
     '<td><button class="rubric-grade-button"><span class="grade-chip">8,5</span></button></td>'+
     '<td><button class="orthography-grade-button"><span class="grade-chip">8,5</span></button></td>'+
     '<td class="final-col"><button class="score-button"><span class="grade-chip">8,5</span></button></td>'+
     '<td class="itaca-col"><button class="itaca-edit"><span class="grade-chip">9</span></button></td>'+
     '<td><span class="converted-score"><span class="grade-chip">8,5</span></span></td>'+
     '<td><input class="note-input original-note-input" value="4,25"></td>';
    table.tBodies[0].append(row);
    const font=q=>getComputedStyle(row.querySelector(q)).fontSize;
    const values={input:font('.grade-colored'),converted:font('.converted-primary .grade-chip'),
     rubric:font('.rubric-grade-button .grade-chip'),orthography:font('.orthography-grade-button .grade-chip'),
     final:font('.final-col .grade-chip'),itaca:font('.itaca-col .grade-chip'),
     secondary:font('.converted-score .grade-chip'),original:font('.original-note-input')};
    row.remove();
    return values;
   });
   assert(!gradeSizing.missing,name+' no se encuentra la tabla de notas');
   for(const key of ['input','converted','rubric','orthography','final','itaca'])
    assert.equal(gradeSizing[key],'16px',name+' tipografía desigual en '+key+': '+JSON.stringify(gradeSizing));
   assert(parseFloat(gradeSizing.secondary)<16&&parseFloat(gradeSizing.original)<16,
    name+' los valores secundarios deben seguir siendo menores');
   // Las celdas de actividades comparten el mismo inicio para la cifra.
   // Los puntos suspensivos deben permanecer activos sin mover esa cifra.
   const gradeRows=await page.evaluate(()=>{
    const row=document.querySelector('.grade-table tbody tr:not(.student-origin-divider)');
    const cells=row?[...row.querySelectorAll('td.category-tinted .grade-cell-stack')]:[];
    return cells.map(cell=>{
     const face=cell.querySelector('.grade-cell-face')?.getBoundingClientRect();
     const actions=cell.querySelector('.grade-cell-actions-trigger')?.getBoundingClientRect();
     const body=cell.getBoundingClientRect();
     return {top:face?.top,height:face?.height,actions:!!actions,
      actionBottom:actions?.bottom,bottom:body.bottom};
    });
   });
   assert(gradeRows.length>=3,name+' las notas no usan la misma estructura: '+JSON.stringify(gradeRows));
   assert(gradeRows.every(x=>x.actions&&Math.abs(x.top-gradeRows[0].top)<=2),
    name+' cifras principales de distintas columnas desalineadas: '+JSON.stringify(gradeRows));
   assert(gradeRows.every(x=>Math.abs(x.actionBottom-x.bottom)<=3),
    name+' menú ⋯ desplaza el contenido: '+JSON.stringify(gradeRows));
   if(size.width===390){
    await page.locator('td.category-tinted .grade-cell-actions-trigger').first().click();
    assert(await page.locator('.grade-cell-actions-dialog').isVisible(),
     name+' menú ⋯ dejó de funcionar');
    await page.locator('#grade-action-close').click();
    // La configuración se encuentra dentro de «Ítaca y procedencias».
    await page.locator('.notebook-grade-options>summary').click();
    await page.locator('#configure-itaca-attitude').click();
    assert(await page.locator('#itaca-attitude-form').isVisible(),
     name+' no abre la configuración de actitud');
    await page.locator('[name="guardMode"]').selectOption('category');
    assert(await page.locator('[name="guardCategory"]').count()===1);
    await page.locator('#itaca-guard-cancel').click();
   }
   if(size.width<=650){
    const actions=await page.evaluate(()=>{
     const primary=[...document.querySelectorAll('.notebook-primary-actions>.btn')].map(n=>n.getBoundingClientRect());
     const more=document.querySelector('.notebook-primary-actions .notebook-more-actions>summary')?.getBoundingClientRect();
     const box=document.querySelector('.notebook-primary-actions')?.getBoundingClientRect();
     return {primary:primary.map(x=>({left:x.left,width:x.width,height:x.height})),
      more:more&&{width:more.width,height:more.height},container:box&&{width:box.width}};
    });
    assert(actions.primary.length>=2,'Los botones + Alumno y + Actividad deben existir');
    assert(Math.abs(actions.primary[0].width-actions.primary[1].width)<=3,
     name+' botones del Cuaderno de anchura desigual '+JSON.stringify(actions));
    assert(actions.primary[0].height>=43.5&&actions.primary[1].height>=43.5,
     name+' botones Cuaderno demasiado bajos');
    assert(actions.more&&Math.abs(actions.more.width-actions.container.width)<=4,
     name+' Acciones del Cuaderno no ocupan todo el ancho '+JSON.stringify(actions));
   }
   if(size.width<=1200){
    await page.locator('[data-academic-quick="alumno"]').click();
    const quick=await page.evaluate(()=>{
     const strip=document.querySelector('.academic-quick-nav');
     const active=strip?.querySelector('.academic-quick-active');
     if(!strip||!active)return {visible:false};
     const a=strip.getBoundingClientRect(),b=active.getBoundingClientRect();
     return {visible:b.left>=a.left-3&&b.right<=a.right+3,
      buttonWidth:b.width,containerWidth:a.width};
    });
    assert(quick.visible,name+' pestaña académica activa fuera de vista '+JSON.stringify(quick));
    if(size.width===390){
     await page.locator('[data-open-student]').first().click();
     assert(await page.locator('.shell.student-focus').count()===1,
      name+' vista privada sin su estado visual');
     const privateHeader=await page.evaluate(()=>{
      const parent=document.querySelector('.student-focus .topmeta');
      const status=parent?.querySelector('#save-status');
      const a=parent?.getBoundingClientRect(),b=status?.getBoundingClientRect();
      return {parentWidth:a?.width,statusWidth:b?.width};
     });
     assert(Math.abs(privateHeader.parentWidth-privateHeader.statusWidth)<=3,
      name+' cabecera privada deja media fila libre: '+JSON.stringify(privateHeader));
     await page.locator('#hide-student').click();
    }
    await page.locator('[data-academic-quick="cuaderno"]').click();
   }
   await page.locator('.nav-primary [data-tab="evaluaciones"]').click();
   console.log(name+' '+size.width+'x'+size.height+': materias, táctil y overflow correctos');
  }
  await page.locator('.header-tools>summary').click();
  for(const theme of ['dark','oled','light']){
   await page.locator('#theme-select').selectOption(theme);
   assert.equal(await page.locator('html').getAttribute('data-theme'),theme);
   assert(await page.locator('.class-toolbar').isVisible());
  }
  assert.deepEqual(pageErrors,[],name+' errores de JavaScript');
  await context.close();
 }finally{await browser.close();}
}
try{
 await audit(chromium,'chromium');
 await audit(webkit,'webkit');
}finally{
 await new Promise(ok=>server.close(ok));
}
console.log('Pruebas de distribución y tactilidad: 8 tamaños, Chromium y WebKit; solo alumnado ficticio.');
