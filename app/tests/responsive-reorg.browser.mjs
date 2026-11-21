// Navegación de prueba sin datos reales. Se ejecuta explícitamente en CI,
// no durante npm test; el motor académico y la base de datos no se modifican.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,sep,extname} from 'node:path';
import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';

const dir=resolve(fileURLToPath(new URL('../',import.meta.url)));
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json',
 '.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
const server=createServer(async(req,res)=>{
 try{
   const url=new URL(req.url,'http://localhost');
   const rel=decodeURIComponent(url.pathname)==='/'?'index.html':decodeURIComponent(url.pathname).slice(1);
   const full=resolve(dir,rel);
   if(full!==dir&&!full.startsWith(dir+sep)){res.writeHead(403);res.end();return;}
   const bytes=await readFile(full);
   res.writeHead(200,{'Content-Type':types[extname(full)]||'application/octet-stream','Cache-Control':'no-store'});
   res.end(bytes);
 }catch(err){res.writeHead(err.code==='ENOENT'?404:500);res.end(String(err.message));}
});
await new Promise((resolveReady,reject)=>server.listen(0,'127.0.0.1',e=>e?reject(e):resolveReady()));
const url='http://127.0.0.1:'+server.address().port+'/';

async function checkBrowser(type,engine){
 const browser=await type.launch({headless:true,args:engine==='chromium'?['--no-sandbox']:[]});
 try{
  const errors=[];
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:engine==='webkit',hasTouch:true});
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push('JavaScript: '+e.message));
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.locator('#password').fill('Frase de prueba para AppNotas 2026');
  await page.locator('#confirm-password').fill('Frase de prueba para AppNotas 2026');
  await page.locator('[data-create-mode="demo"]').click();
  await page.locator('.tabs [data-tab="cuaderno"]').waitFor({timeout:25000});
  assert.equal(await page.locator('.tabs [data-tab]').count(),9);
  assert.equal(await page.locator('.tabs .nav-primary [data-tab]').count(),4);
  assert.equal(await page.locator('.tabs .nav-academic-links [data-tab]').count(),4);
  assert.equal(await page.locator('.tabs .nav-secondary>[data-tab="ajustes"]').count(),1);
  assert.equal(await page.locator('#new-student').count(),1);
  assert.equal(await page.locator('#new-assessment').count(),1);
  assert.equal(await page.locator('.grade-table .note-input').count()>0,true);

  // Los controles ocultos al principio siguen disponibles mediante su menú.
  await page.locator('.header-tools>summary').click();
  assert.equal(await page.locator('#theme-select').isVisible(),true);
  assert.equal(await page.locator('#close-notebook').isVisible(),true);
  assert.equal(await page.locator('#open-notebook').isVisible(),true);
  await page.locator('#theme-select').selectOption('dark');
  assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
  await page.locator('#theme-select').selectOption('oled');
  assert.equal(await page.locator('html').getAttribute('data-theme'),'oled');
  await page.locator('#theme-select').selectOption('light');
  await page.locator('.header-tools>summary').click();

  await page.locator('.course-disclosure>summary').click();
  assert.equal(await page.locator('[data-course-level]').count()>=4,true);
  await page.locator('.course-disclosure>summary').click();
  await page.locator('.group-actions-disclosure>summary').click();
  for(const id of ['#edit-group','#csv-import','#new-recovery','#accent-select'])assert.equal(await page.locator(id).count(),1);
  assert.equal(await page.locator('#csv-import').isVisible(),true);
  await page.locator('.group-actions-disclosure>summary').click();
  await page.locator('.notebook-more-actions>summary').click();
  assert.equal(await page.locator('#copy-structure').isVisible(),true);
  assert.equal(await page.locator('#schedule-exam').isVisible(),true);
  await page.locator('.notebook-more-actions>summary').click();

  // La navegación académica y las cuatro pestañas principales están operativas.
  await page.locator('.academic-disclosure>summary').click();
  for(const id of ['calculos','competencias','curriculo','rubricas']){
    await page.locator('[data-tab="'+id+'"]').click();
    assert.equal(await page.locator('[data-tab="'+id+'"]').getAttribute('aria-current'),'page');
  }
  await page.locator('[data-tab="ajustes"]').click();
  assert.equal(await page.getByRole('heading',{name:'Copias de seguridad cifradas'}).isVisible(),true);
  for(const id of ['planificador','final','alumno','cuaderno']){
    await page.locator('.nav-primary [data-tab="'+id+'"]').click();
    assert.equal(await page.locator('[data-tab="'+id+'"]').getAttribute('aria-current'),'page');
  }

  // El estado de la copia, los alumnos y la calificación siguen accesibles.
  assert.equal(await page.locator('#save-status').count(),1);
  assert.equal(await page.locator('.grade-table .grade-observation-button').count()>0,true);
  assert.equal(await page.locator('.grade-table .np-button').count()>0,true);
  assert.equal(await page.locator('.grade-table .aj-button').count()>0,true);

  for(const size of [
    {width:320,height:680},{width:375,height:812},{width:430,height:932},
    {width:768,height:1024},{width:834,height:1112},{width:1180,height:820}
  ]){
    await page.setViewportSize(size);
    // La tabla puede tener scroll interno; toda la página no debe desbordarse.
    const m=await page.evaluate(()=>({
      screen:document.documentElement.clientWidth,
      document:document.documentElement.scrollWidth,
      columns:document.querySelector('.table-scroller')?.scrollWidth||0,
      viewport:innerWidth
    }));
    assert(m.document<=m.screen+3,engine+': desbordamiento horizontal '+JSON.stringify(size)+' '+JSON.stringify(m));
    assert.equal(await page.locator('.nav-primary [data-tab]').count(),4);
    assert.equal(await page.locator('.grade-table').count(),1);
    assert(m.columns>0);
    if(size.width<=900){
      assert.equal(await page.locator('.nav-primary [data-tab="alumno"]').isVisible(),true);
      assert.equal(await page.locator('.nav-secondary [data-tab="ajustes"]').isVisible(),true);
    }
  }
  await page.setViewportSize({width:390,height:844});
  await page.locator('.nav-primary [data-tab="alumno"]').click();
  await page.locator('[data-open-student]').first().click();
  assert.equal(await page.locator('.student-privacy').isVisible(),true);
  assert.equal(await page.locator('.student-focus .tabs').isVisible(),false,'Privacidad: menú docente oculto al mostrar alumno');
  assert.equal(await page.locator('.student-focus .toolbar').isVisible(),false,'Privacidad: controles docentes ocultos');
  await page.locator('#hide-student').click();
  assert.equal(await page.locator('[data-open-student]').count()>0,true);
  assert.deepEqual(errors,[],'Errores de JavaScript en '+engine);
  await page.close();await context.close();
  console.log('NAVEGACION RESPONSIVE VERIFICADA '+engine+': 320,375,430,768,834,1180 y 9 destinos');
 }finally{await browser.close();}
}
try{
 await checkBrowser(chromium,'chromium');
 await checkBrowser(webkit,'webkit');
}finally{await new Promise(resolve=>server.close(resolve));}
