import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';

const dir=resolve('app'), out=resolve('header-screenshots');
await mkdir(out,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.pdf':'application/pdf'};
const server=createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const full=resolve(dir,pathname==='/'?'index.html':pathname.slice(1));
  if(!full.startsWith(dir+sep)){res.writeHead(403);return res.end();}
  const bytes=await readFile(full);
  res.writeHead(200,{'Content-Type':types[extname(full)]||'application/octet-stream','Cache-Control':'no-store'});
  res.end(bytes);
 }catch(e){res.writeHead(e.code==='ENOENT'?404:500);res.end(String(e.message));}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url='http://127.0.0.1:'+server.address().port+'/';
const sizes=[[320,568],[375,812],[390,844],[430,932],[768,1024],[820,1180],[834,1194],[932,430],[1024,768],[1180,820],[1366,768],[1440,900],[1920,1080]];
try{
 for(const [engine,type] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await type.launch({headless:true});
  try{
   for(const mobile of [false,true]){
    const context=await browser.newContext({viewport:{width:mobile?390:1440,height:mobile?844:900},hasTouch:mobile,isMobile:mobile&&engine==='webkit',deviceScaleFactor:1});
    const page=await context.newPage(), errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(url);
    const password='Frase ficticia para pruebas de cabecera 2026';
    await page.locator('#password').fill(password);
    await page.locator('#confirm-password').fill(password);
    await page.locator('[data-create-mode="demo"]').click();
    await page.locator('.tabs [data-tab="cuaderno"]').waitFor({timeout:30000});
    assert.equal(await page.locator('.tabs [data-tab="ajustes"]').count(),0);
    assert.equal(await page.locator('.header-tools [data-tab="ajustes"]').count(),1);
    assert.equal(await page.locator('.header-tools #close-notebook').count(),1);
    assert.equal(await page.locator('#close-notebook').isVisible(),false);
    assert.equal(await page.locator('.nav-primary .nav-glyph svg').count(),4);
    const selector='.topbar,.topbar>.brand,.topbar>.topmeta,.academic-year-tools,.tabs,.class-toolbar,.academic-quick-nav';
    for(const [width,height] of sizes.filter(([w])=>mobile?w<=1180:w>=768)){
     await page.setViewportSize({width,height});
     for(const theme of ['light','dark','oled']){
      await page.locator('.header-tools>summary').click();
      await page.locator('#theme-select').selectOption(theme);
      assert.equal(await page.locator('html').getAttribute('data-theme'),theme);
      const panel=await page.locator('.header-tools-panel').boundingBox();
      assert(panel&&panel.x>=-1&&panel.x+panel.width<=width+1&&panel.y>=-1&&panel.y+panel.height<=height+2,engine+' panel '+width+' '+theme+' '+JSON.stringify(panel));
      if([390,834,1440].includes(width))await page.screenshot({path:out+'/'+engine+'-'+mobile+'-'+width+'-'+theme+'-settings.png'});
      await page.locator('#close-header-tools').click();
      const layout=await page.evaluate(({selector})=>{
       const bounds=[...document.querySelectorAll(selector)].filter(el=>el.getClientRects().length).map(el=>({name:el.className,x:el.getBoundingClientRect().x,right:el.getBoundingClientRect().right}));
       const controls=[...document.querySelectorAll('.header-tools>summary,#close-notebook,#dropbox-sync,#lock,#undo-change,#redo-change,#academic-course-select,#academic-rollover,.nav-primary>.tab,.academic-disclosure>summary,.course-choice,.academic-quick-nav .btn')].filter(el=>el.getClientRects().length).map(el=>({name:el.id||el.textContent.trim(),w:el.getBoundingClientRect().width,h:el.getBoundingClientRect().height}));
       const courses=[...document.querySelectorAll('.course-choice')];
       const captions=courses.map(c=>{const label=c.querySelector('.course-group-caption');return !!label&&getComputedStyle(label).display!=='none'&&label.getBoundingClientRect().height>0;});
       const courseTops=courses.slice(0,5).map(c=>c.getBoundingClientRect().top);
       const nav=document.querySelector('.tabs');
       const bottom=Math.max(...[...nav.querySelectorAll('.nav-primary>.tab,.academic-disclosure>summary')]
        .map(el=>el.getBoundingClientRect().bottom));
       const navGap=nav.getBoundingClientRect().bottom-bottom;
       return {screen:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,bounds,controls,navGap,captions,courseTops};
      },{selector});
      assert(layout.scroll<=layout.screen+3,engine+' overflow '+width+' '+theme+' '+JSON.stringify(layout));
      assert(layout.captions.every(Boolean),engine+' missing group captions '+width);
      if(width>=1024)assert(Math.max(...layout.courseTops)-Math.min(...layout.courseTops)<=2,engine+' five subjects must fit on one row '+width);
      assert(layout.navGap<=10,engine+' espacio bajo la navegación '+width+' '+theme+' '+layout.navGap);
      for(const b of layout.bounds)assert(b.x>=-1&&b.right<=layout.screen+1,engine+' outside '+width+' '+JSON.stringify(b));
      for(const c of layout.controls)assert(c.w>=43.5&&c.h>=43.5,engine+' small '+width+' '+JSON.stringify(c));
      if([390,834,1440].includes(width))await page.screenshot({path:out+'/'+engine+'-'+mobile+'-'+width+'-'+theme+'-header.png'});
     }
    }
    await page.locator('#academic-rollover').click();
    await page.locator('#academic-rollover-form').waitFor();
    assert.equal(await page.locator('#academic-rollover-form input[type=checkbox]').count(),10);
    await page.locator('#cancel-rollover').click();
    assert.equal(await page.locator('#academic-course-select').inputValue(),'2026-2027');
    await page.locator('.header-tools>summary').click();
    await page.locator('.header-tools [data-tab="ajustes"]').click();
    await page.getByRole('heading',{name:'Copias de seguridad cifradas'}).waitFor();
    assert.equal(await page.locator('.header-tools').getAttribute('open'),null);
    assert.equal(await page.locator('#backup-portable').count(),1);
    assert.equal(await page.locator('#backup-restore').count(),1);
    await page.locator('.nav-primary [data-tab="cuaderno"]').click();
    assert.equal(await page.locator('.grade-table').count(),1);
    await page.locator('.academic-disclosure>summary').click();
    await page.locator('.nav-academic-links [data-tab="rubricas"]').click();
    await page.getByRole('heading',{name:'Plantillas de rúbricas'}).waitFor();
    await page.locator('.nav-primary [data-tab="cuaderno"]').click();
    assert.deepEqual(errors,[]);
    console.log(engine+' '+(mobile?'táctil':'escritorio')+': geometría, temas, ajustes y navegación OK');
    await context.close();
   }
  }finally{await browser.close();}
 }
}finally{await new Promise(r=>server.close(r));}
