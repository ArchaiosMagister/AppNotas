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

async function audit(engine,name){
 const browser=await engine.launch({headless:true,args:name==='chromium'?['--no-sandbox']:[]});
 try{
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

  for(const size of [
    {width:320,height:700},{width:375,height:812},{width:390,height:844},
    {width:430,height:932},{width:768,height:1024},{width:834,height:1112},
    {width:1024,height:768},{width:1180,height:820}
  ]){
   await page.setViewportSize(size);
   await page.locator('.nav-primary [data-tab="evaluaciones"]').click();
   assert(await page.locator('.class-toolbar').isVisible(),name+' materias ocultas en Evaluaciones');
   assert(await page.getByRole('heading',{name:'Sesiones de evaluación'}).isVisible());
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
    assert.equal(nav.cards.length,4,'Deben ocupar la barra 3 módulos + Herramientas');
    assert(nav.visible.every(Boolean),name+' hay botones de navegación ocultos');
    const min=Math.min(...nav.cards.map(c=>c.width)),max=Math.max(...nav.cards.map(c=>c.width));
    assert(max-min<=3,name+' botones de navegación con anchuras desiguales: '+JSON.stringify(nav));
    assert(Math.abs(nav.cards[0].left-nav.bar.left)<=11,name+' hueco inicial de navegación');
    assert(Math.abs(nav.bar.right-nav.cards[3].right)<=11,name+' cuarta columna vacía');
    assert(nav.cards.every(c=>c.height>=43.5),name+' navegación táctil insuficiente');
    // Herramientas debe ser un control real y el menú no debe salir del viewport.
    await page.locator('.tabs .academic-disclosure>summary').click();
    const tools=await page.evaluate(()=>{
     const menu=document.querySelector('.tabs .nav-academic-links');
     const r=menu.getBoundingClientRect();
     return {left:r.left,right:r.right,visible:!!r.width};
    });
    assert(tools.visible&&tools.left>=-2&&tools.right<=size.width+2,
      name+' panel Herramientas fuera de pantalla '+JSON.stringify(tools));
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
   if(size.width<=900){
    const agenda=await page.evaluate(()=>{
     const box=q=>{const e=document.querySelector(q);if(!e)return null;const r=e.getBoundingClientRect();
      return {left:r.left,right:r.right,width:r.width,height:r.height};};
     const buttonBoxes=q=>[...document.querySelectorAll(q)].map(e=>{const r=e.getBoundingClientRect();
      return {left:r.left,right:r.right,width:r.width,height:r.height}});
     return {tabs:buttonBoxes('.planner-view-tabs .planner-view-btn'),
      tabContainer:box('.planner-view-tabs'),
      tools:buttonBoxes('.planner-tools-minimal>.planner-create-menu, .planner-tools-minimal>.planner-sessions-shortcut'),
      toolContainer:box('.planner-tools-minimal'),
      header:buttonBoxes('.planner-year-chooser>.btn'),
      dates:buttonBoxes('.planner-date-controls>.btn')};
    });
    assert.equal(agenda.tabs.length,5,'Agenda: cinco vistas');
    assert(agenda.tabs.every(x=>x.height>=43.5),name+' pestañas Agenda demasiado bajas');
    assert.equal(agenda.tools.length,2,'Agenda: dos acciones principales');
    assert(agenda.tools.every(x=>x.width>0),'Agenda: botón principal oculto');
    if(size.width<=650){
     assert(Math.abs(agenda.tabs[0].width-agenda.tabs[1].width)<3,
      name+' pestañas Agenda mal distribuidas');
     assert(Math.abs(agenda.tabs[4].width-agenda.tabContainer.width)<=4,
      name+' quinta pestaña Agenda deja hueco en fila');
     assert(Math.abs(agenda.tools[0].width-agenda.tools[1].width)<=3,
      name+' botones Crear/Sesiones no rellenan sus dos columnas');
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
