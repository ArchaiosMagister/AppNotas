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
  const rel=decodeURIComponent(url.pathname)==='/'?'index.html':decodeURIComponent(url.pathname).replace(/^\\//,'');
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
    {width:320,height:700},{width:390,height:844},{width:430,height:932},
    {width:768,height:1024},{width:834,height:1112},{width:1024,height:768}
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
   // Elegir la última materia, cambiar de módulo y comprobar scroll horizontal conservado.
   await page.locator('.course-choice').last().click();
   await page.locator('.nav-primary [data-tab="planificador"]').click();
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
console.log('Pruebas táctiles terminadas: 6 tamaños, Chromium y WebKit; solo alumnado ficticio.');
