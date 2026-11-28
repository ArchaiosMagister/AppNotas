import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {chromium,webkit,devices} from 'playwright';
const root=resolve('app'), out=resolve('_redesign_ui');
await mkdir(out,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.pdf':'application/pdf'};
const server=createServer(async(req,res)=>{try{const rel=new URL(req.url,'http://localhost').pathname;const file=resolve(root,rel==='/'?'index.html':'.'+decodeURIComponent(rel));if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(await readFile(file));}catch(e){if(!res.headersSent)res.writeHead(404);res.end();}});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const url='http://127.0.0.1:'+server.address().port+'/';
const pw='Cuaderno ficticio 2026 para pruebas';
try{
for(const [name,engine,opts] of [['desktop-chromium',chromium,{viewport:{width:1440,height:900}}],['desktop-webkit',webkit,{viewport:{width:1440,height:900}}],['iphone-webkit',webkit,devices['iPhone 13']],['ipad-webkit',webkit,devices['iPad Pro 11']]]){
 const browser=await engine.launch();
 try{
 const context=await browser.newContext(opts),page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);await page.locator('#password').fill(pw);await page.locator('#confirm-password').fill(pw);await page.locator('[data-create-mode="demo"]').click();
 await page.locator('.grade-table #configure-itaca-attitude').waitFor();await page.locator('#notebook-density').waitFor();
 const gradeSelector='.grade-table tbody td.final-col .grade-chip,.grade-table tbody td.itaca-col .grade-chip';
 const values=await page.locator(gradeSelector).allTextContents();assert.equal(values.length,16);
 for(const theme of ['light','dark','oled']){
  await page.locator('.header-tools>summary').click();await page.locator('#theme-select').selectOption(theme);
  if(await page.locator('.header-tools').getAttribute('open')!==null)await page.locator('#close-header-tools').click();
  assert.equal(await page.locator('html').getAttribute('data-theme'),theme);
  let prior=0;
  for(const density of ['compact','normal','wide']){
   await page.locator('#notebook-density').selectOption(density);
   const metrics=await page.evaluate(()=>{const table=document.querySelector('.grade-table');const row=table.querySelector('tbody tr:not(.student-origin-divider)');const cols=[...table.querySelectorAll('thead th.category-tinted,thead th.final-col,thead th.itaca-col')];return {widths:cols.map(c=>c.getBoundingClientRect().width),height:row.getBoundingClientRect().height,scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth,colors:[...row.querySelectorAll('.grade-chip')].map(c=>[getComputedStyle(c).color,getComputedStyle(c).backgroundColor])};});
   assert(metrics.widths.length===6,JSON.stringify(metrics));assert(metrics.widths.every(w=>Math.abs(w-165)<2),name+' '+theme+' '+JSON.stringify(metrics.widths));assert(metrics.height>=prior-1);prior=metrics.height;assert(metrics.scroll<=metrics.client+3,name+' overflow');assert.deepEqual(await page.locator(gradeSelector).allTextContents(),values);
  }
  // Comprueba la geometría del cuaderno real y simula los dos indicadores
  // en una celda de Ítaca sin alterar ninguna calificación persistida.
  const alignment=await page.evaluate(()=>{
    const row=document.querySelector('.grade-table tbody tr:not(.student-origin-divider)');
    const faces=[...row.querySelectorAll('.grade-cell-face')];
    const center=r=>({x:r.x+r.width/2,y:r.y+r.height/2});
    const grades=faces.map(face=>face.querySelector('.grade-chip,.np-grade-marker,.grade-empty,.aj-badge,.note-input')||face.firstElementChild);
    const before=grades.map(e=>{const r=e.getBoundingClientRect();return {...center(r),w:r.width,h:r.height};});
    const cellCenters=faces.map(f=>center(f.closest('td').getBoundingClientRect()).x);
    const itaca=row.querySelector('.itaca-edit');
    const badge=itaca.querySelector('.grade-chip,.grade-empty');
    const added=[];
    for(const [cls,txt] of [['itaca-guard-indicator','!'],['itaca-exception','*']]){
      if(!itaca.querySelector('.'+cls)){const e=document.createElement('span');e.className=cls;e.textContent=txt;itaca.append(e);added.push(e);}
    }
    const after=center(badge.getBoundingClientRect()),warning=itaca.querySelector('.itaca-guard-indicator').getBoundingClientRect(),br=badge.getBoundingClientRect();
    const guardLeft=warning.right<br.left;
    const support=row.querySelector('.category-tinted .grade-cell-support');
    const extra=document.createElement('small');extra.className='orthography-meta';extra.textContent='Texto auxiliar de prueba con varias palabras para ocupar más de una línea';support.append(extra);
    const withText=grades.map(e=>center(e.getBoundingClientRect()).y);
    extra.remove();added.forEach(e=>e.remove());
    return {before,cellCenters,after,guardLeft,withText};
  });
  assert.equal(alignment.before.length,6);
  const first=alignment.before[0],last=alignment.before.at(-1);
  assert(alignment.before.every((r,i)=>Math.abs(r.x-alignment.cellCenters[i])<2&&Math.abs(r.y-first.y)<2),JSON.stringify(alignment));
  assert(alignment.withText.every((y,i)=>Math.abs(y-alignment.before[i].y)<2),JSON.stringify(alignment));
  assert(Math.abs(alignment.after.x-last.x)<2&&Math.abs(alignment.after.y-last.y)<2&&alignment.guardLeft,JSON.stringify(alignment));
  assert(alignment.before.every(r=>Math.abs(r.w-first.w)<2&&Math.abs(r.h-first.h)<2),JSON.stringify(alignment));
  await page.screenshot({path:out+'/'+name+'-'+theme+'.png'});
 }
 await page.locator('#notebook-density').selectOption('compact');
 await page.locator('#notebook-zoom-in').click();await page.locator('#notebook-zoom-out').click();
 await page.locator('.grade-table tbody [data-view-student]').first().click();await page.locator('.redesign-evolution-item').first().waitFor();assert.equal(await page.locator('.redesign-evolution-item').count(),3);await page.screenshot({path:out+'/'+name+'-student.png'});
 await page.reload();await page.locator('#password').fill(pw);await page.getByRole('button',{name:'Desbloquear',exact:true}).click();await page.locator('#notebook-density').waitFor();assert.equal(await page.locator('#notebook-density').inputValue(),'compact');assert.deepEqual(await page.locator(gradeSelector).allTextContents(),values);assert.deepEqual(errors,[]);console.log(name+': widths, themes, density, zoom, student and persistence passed');
 }finally{await browser.close();}
}
}finally{await new Promise(ok=>server.close(ok));}
