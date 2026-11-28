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
  let prior=0;const heights={};
  for(const density of ['compact','normal','wide']){
   await page.locator('#notebook-density').selectOption(density);
   const metrics=await page.evaluate(()=>{const table=document.querySelector('.grade-table');const row=table.querySelector('tbody tr:not(.student-origin-divider)');const cols=[...table.querySelectorAll('thead th.category-tinted,thead th.final-col,thead th.itaca-col')];const centers=[...row.querySelectorAll('.grade-cell-face')].map(face=>{const r=(face.querySelector('.grade-chip,.np-grade-marker,.grade-empty,.aj-badge,.note-input')||face.firstElementChild).getBoundingClientRect(),td=face.closest('td').getBoundingClientRect();return {dx:Math.abs(r.x+r.width/2-td.x-td.width/2),dy:Math.abs(r.y+r.height/2-td.y-td.height/2),y:r.y+r.height/2};});return {widths:cols.map(c=>c.getBoundingClientRect().width),height:row.getBoundingClientRect().height,scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth,centers,colors:[...row.querySelectorAll('.grade-chip')].map(c=>[getComputedStyle(c).color,getComputedStyle(c).backgroundColor])};});
   assert(metrics.centers.every(c=>c.dx<2&&c.dy<2&&Math.abs(c.y-metrics.centers[0].y)<2),name+' '+theme+' '+density+' '+JSON.stringify(metrics.centers));
   assert(metrics.widths.length===6,JSON.stringify(metrics));assert(metrics.widths.every(w=>Math.abs(w-165)<2),name+' '+theme+' '+JSON.stringify(metrics.widths));assert(metrics.height>prior||prior===0,name+' density must change row height '+JSON.stringify(metrics));prior=metrics.height;heights[density]=metrics.height;assert(metrics.scroll<=metrics.client+3,name+' overflow');assert.deepEqual(await page.locator(gradeSelector).allTextContents(),values);
  }
  console.log(name+' '+theme+' row heights px '+JSON.stringify(heights));
  // Comprueba la geometría del cuaderno real y simula los dos indicadores
  // en una celda de Ítaca sin alterar ninguna calificación persistida.
  const alignment=await page.evaluate(()=>{
    const row=document.querySelector('.grade-table tbody tr:not(.student-origin-divider)');
    const faces=[...row.querySelectorAll('.grade-cell-face')];
    const center=r=>({x:r.x+r.width/2,y:r.y+r.height/2});
    const grades=faces.map(face=>face.querySelector('.grade-chip,.np-grade-marker,.grade-empty,.aj-badge,.note-input')||face.firstElementChild);
    const before=grades.map(e=>{const r=e.getBoundingClientRect();return {...center(r),w:r.width,h:r.height};});
    const cellCenters=faces.map(f=>center(f.closest('td').getBoundingClientRect()));
    const menus=faces.flatMap((face,i)=>{
      const menu=face.closest('.grade-cell-stack').querySelector('.grade-cell-actions-trigger');
      if(!menu)return [];
      const r=menu.getBoundingClientRect(),b=grades[i].getBoundingClientRect();
      return [{dx:Math.abs(center(r).x-center(b).x),gap:r.top-b.bottom,w:r.width,h:r.height}];
    });
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
    const withTextCenters=faces.map(f=>center(f.closest('td').getBoundingClientRect()).y);
    const noOverlap=extra.getBoundingClientRect().top>=support.parentElement.querySelector('.grade-cell-actions-trigger').getBoundingClientRect().bottom-1;
    extra.remove();added.forEach(e=>e.remove());
    return {before,cellCenters,after,guardLeft,withText,withTextCenters,menus,noOverlap};
  });
  assert.equal(alignment.before.length,6);
  const first=alignment.before[0],last=alignment.before.at(-1);
  assert(alignment.before.every((r,i)=>Math.abs(r.x-alignment.cellCenters[i].x)<2&&Math.abs(r.y-alignment.cellCenters[i].y)<2&&Math.abs(r.y-first.y)<2),JSON.stringify(alignment));
  assert(alignment.withText.every((y,i)=>Math.abs(y-alignment.withTextCenters[i])<2&&Math.abs(y-alignment.withText[0])<2),JSON.stringify(alignment));
  assert(alignment.menus.length===4&&alignment.menus.every(m=>m.dx<2&&m.gap>=-1&&m.gap<12&&m.w>=43.5&&m.h>=43.5),JSON.stringify(alignment));
  assert(alignment.noOverlap,JSON.stringify(alignment));
  assert(Math.abs(alignment.after.x-last.x)<2&&Math.abs(alignment.after.y-last.y)<2&&alignment.guardLeft,JSON.stringify(alignment));
  assert(alignment.before.every(r=>Math.abs(r.w-first.w)<2&&Math.abs(r.h-first.h)<2),JSON.stringify(alignment));
  await page.screenshot({path:out+'/'+name+'-'+theme+'.png'});
 }
 await page.locator('#notebook-density').selectOption('compact');
 await page.locator('#notebook-zoom-in').click();await page.locator('#notebook-zoom-out').click();
 await page.locator('.grade-table tbody [data-view-student]').first().click();await page.locator('.redesign-evolution-item').first().waitFor();assert.equal(await page.locator('.redesign-evolution-item').count(),3);await page.screenshot({path:out+'/'+name+'-student.png'});
 await page.reload();await page.locator('#password').fill(pw);await page.getByRole('button',{name:'Desbloquear',exact:true}).click();await page.locator('#notebook-density').waitFor();assert.equal(await page.locator('#notebook-density').inputValue(),'compact');assert.deepEqual(await page.locator(gradeSelector).allTextContents(),values);const nextPeriod=await page.locator('[data-period-choice]').nth(1).getAttribute('data-period-choice');
 await page.locator('[data-period-choice]').nth(1).click();
 await page.waitForFunction(id=>document.querySelector('[data-period-choice][aria-pressed="true"]')?.dataset.periodChoice===id,nextPeriod);
 await page.locator('[data-academic-quick="final"]').click();
 await page.locator('.final-table').waitFor();
 await page.locator('[data-academic-quick="cuaderno"]').click();
 await page.waitForFunction(id=>document.querySelector('[data-period-choice][aria-pressed="true"]')?.dataset.periodChoice===id,nextPeriod);
 await page.reload();await page.locator('#password').fill(pw);await page.getByRole('button',{name:'Desbloquear',exact:true}).click();
 await page.waitForFunction(id=>document.querySelector('[data-period-choice][aria-pressed="true"]')?.dataset.periodChoice===id,nextPeriod);
 // Reproduce a race: the first save is asynchronous while a second field
 // already contains an uncommitted edit. Do not replace that input or steal focus.
 await page.locator('[data-period-choice]').first().click();
 const firstPeriod=await page.locator('[data-period-choice]').first().getAttribute('data-period-choice');
 await page.waitForFunction(id=>document.querySelector('[data-period-choice][aria-pressed="true"]')?.dataset.periodChoice===id,firstPeriod);
 const gradeInput='.grade-table input[data-student][data-assessment]';
 await page.locator(gradeInput).first().waitFor();
 const edited=await page.evaluate(selector=>{
  const fields=[...document.querySelectorAll(selector)].filter(e=>!e.disabled&&!e.readOnly&&e.getBoundingClientRect().width>0);
  const a=fields[0],b=fields[1];if(!a||!b)throw Error('Need two editable grades');
  const av=a.value==='2'?'3':'2',bv=b.value==='4'?'3':'4';
  a.focus();a.value=av;a.dispatchEvent(new Event('input',{bubbles:true}));a.dispatchEvent(new Event('change',{bubbles:true}));a.blur();
  b.focus();b.value=bv;b.dispatchEvent(new Event('input',{bubbles:true}));
  window.__auditSecondField=b;
  return [{student:a.dataset.student,assessment:a.dataset.assessment,value:av},{student:b.dataset.student,assessment:b.dataset.assessment,value:bv}];
 },gradeInput);
 await page.waitForFunction(()=>document.querySelector('#save-status')?.textContent==='Guardado cifrado');
 // Permit the normal rendering and deferred-refresh timers to run.
 await page.waitForTimeout(180);
 assert(await page.evaluate(()=>window.__auditSecondField.isConnected&&document.activeElement===window.__auditSecondField));
 assert.equal(await page.evaluate(()=>window.__auditSecondField.value),edited[1].value);
 await page.evaluate(()=>{const b=window.__auditSecondField;b.dispatchEvent(new Event('change',{bubbles:true}));b.blur();delete window.__auditSecondField;});
 await page.waitForFunction(()=>document.querySelector('#save-status')?.textContent==='Guardado cifrado');
 await page.reload();await page.locator('#password').fill(pw);await page.getByRole('button',{name:'Desbloquear',exact:true}).click();
 await page.locator(gradeInput).first().waitFor();
 for(const e of edited)assert.equal(await page.locator(gradeInput+'[data-student="'+e.student+'"][data-assessment="'+e.assessment+'"]').inputValue(),e.value);
 assert.deepEqual(errors,[]);console.log(name+': widths, themes, density, zoom, student, final, periods and concurrent grade edits passed');
 // Real orthography and converted grades in a fresh encrypted fixture.
 const detailsContext=await browser.newContext(opts);
 try{
 const detailPage=await detailsContext.newPage();detailPage.on('pageerror',e=>errors.push(e.message));
 await detailPage.goto(url);
 await detailPage.evaluate(async pw=>{
  const {emptyNotebook,addGroup,addStudent,addAssessment,setOrthographyGrade,setGrade,addCategory,addCompetency,setCompetencyLink,addNotebookSubject}=await import('./src/model.js');
  const {officialCompetenciesForGroup}=await import('./src/official-competencies.js');
  const {createVault}=await import('./src/vault.js');const {openDb,writeEnvelope}=await import('./src/storage.js');
  const doc=emptyNotebook(),group=addGroup(doc,'Latín 4.º · prueba','Latín 4.º','2026-2027','4eso'),p=doc.periods[0],cat=doc.categories.find(c=>c.name==='Exámenes');
  const student=addStudent(doc,group.id,'Alumno ficticio'),other=addStudent(doc,group.id,'Alumno sin nota');
  const a=addAssessment(doc,{name:'Ortografía',groupId:group.id,periodId:p.id,categoryId:cat.id,maxScore:10,convertToTen:true,orthography:{enabled:true,penaltyPerFault:.1,repetitions:30,refundable:true},greekEtymologyBonusEnabled:true});
  const b=addAssessment(doc,{name:'Conversión',groupId:group.id,periodId:p.id,categoryId:cat.id,maxScore:5,convertToTen:true,orthography:null});
  setOrthographyGrade(doc,student.id,a.id,{score:'9.1',faults:'3',delivered:false,greekEtymologyBonus:'0.4'});
  setGrade(doc,student.id,b.id,4);
  const catA=addCategory(doc,'Prueba A',0,'mean',group.id),catB=addCategory(doc,'Prueba B',0,'mean',group.id);
  const a1=addAssessment(doc,{name:'Prueba A',groupId:group.id,periodId:p.id,categoryId:catA.id,maxScore:10,orthography:null}),a2=addAssessment(doc,{name:'Prueba B',groupId:group.id,periodId:p.id,categoryId:catB.id,maxScore:10,orthography:null});
  setGrade(doc,student.id,a1.id,.59);setGrade(doc,student.id,a2.id,.60);
  const ce=officialCompetenciesForGroup(group).competencias;
  const low=addCompetency(doc,'CE1',group.id,ce[0].key),high=addCompetency(doc,'CE2',group.id,ce[1].key);
  setCompetencyLink(doc,low.id,catA.id,5);setCompetencyLink(doc,low.id,catB.id,7);setCompetencyLink(doc,high.id,cat.id,1);
  addNotebookSubject(doc,'4eso','Materia de prueba');const custom=addGroup(doc,'Grupo de prueba','Materia de prueba','2026-2027','4eso');
  const cStudent=addStudent(doc,custom.id,'Nombre de alumno ficticio con apellidos muy largos');const cExam=addAssessment(doc,{name:'Prueba',groupId:custom.id,periodId:p.id,categoryId:cat.id,maxScore:10,orthography:null});setGrade(doc,cStudent.id,cExam.id,7);
  for(const label of ['Competencia de nombre extraordinariamente largo que debe repartirse en varias líneas','Competencia propia sin evidencia']){const c=addCompetency(doc,label,custom.id);if(label.startsWith('Competencia de nombre'))setCompetencyLink(doc,c.id,cat.id,1);}
  const {envelope}=await createVault(pw,doc),db=await openDb();await writeEnvelope(db,envelope,null);db.close();
 },pw);
 await detailPage.reload();await detailPage.locator('#password').fill(pw);await detailPage.getByRole('button',{name:'Desbloquear',exact:true}).click();
 const info=detailPage.locator('.grade-info-trigger');await info.waitFor();assert.equal(await info.count(),1);
 assert.match(await info.getAttribute('data-grade-info'),/Original: 9,1\/10.*−0,30.*3 faltas.*Etimología \+0,4 \(no computa\)/);
 const tooltip=detailPage.locator('#grade-info-popover');
 for(const density of ['compact','normal','wide']){
  await detailPage.locator('#notebook-density').selectOption(density);
  const geometry=await info.evaluate(button=>{
   const td=button.closest('td'),row=td.closest('tr'),r=button.getBoundingClientRect(),menu=td.querySelector('.grade-cell-actions-trigger').getBoundingClientRect();
   return {overlap:r.left<menu.right-1,centers:[...row.querySelectorAll('.grade-cell-face')].map(f=>{const x=f.getBoundingClientRect(),t=f.closest('td').getBoundingClientRect();return Math.abs(x.y+x.height/2-t.y-t.height/2);})};
  });
  assert(!geometry.overlap&&geometry.centers.every(y=>y<2),name+' info '+density+' '+JSON.stringify(geometry));
  if(opts.hasTouch)await info.tap();else await info.click();await tooltip.waitFor();assert.equal(await tooltip.innerText(),await info.getAttribute('data-grade-info'));
  const bounds=await tooltip.boundingBox();assert(bounds&&bounds.x>=0&&bounds.x+bounds.width<=opts.viewport.width+2,name+' tooltip viewport');
  await detailPage.keyboard.press('Escape');await tooltip.waitFor({state:'detached'});
 }
 if(!opts.hasTouch){await detailPage.locator('h1').hover();await info.scrollIntoViewIfNeeded();await info.hover();await tooltip.waitFor();await detailPage.evaluate(()=>window.dispatchEvent(new Event('scroll')));assert(await tooltip.isVisible(),name+' visible hover survives scroll notification');await detailPage.locator('h1').hover();await tooltip.waitFor({state:'detached'});}
 await info.click();await tooltip.waitFor();await detailPage.locator('h1').click();await tooltip.waitFor({state:'detached'});
 await detailPage.locator('.converted-primary').click();assert(await detailPage.locator('.original-note-input').evaluate(e=>e===document.activeElement));
 await detailPage.locator('.orthography-grade-button').first().click();await detailPage.locator('#orth-base').waitFor();assert.equal(await detailPage.locator('#orth-base').inputValue(),'9,1');await detailPage.locator('#cancel-orthography').click();
 assert.deepEqual(errors,[]);console.log(name+': actual orthography detail, touch/hover, original grade editing and centers passed');
 await detailPage.locator('[data-academic-quick="competencias"]').click();
 const results=detailPage.locator('.competency-results-table');await results.waitFor();
 assert(await results.getByText('0,60 / 10',{exact:true}).isVisible());
 assert.equal(await results.locator('.competency-mean-cell .competency-source-grade').count(),1);
 assert.match(await results.locator('.competency-mean-cell .competency-source-grade').innerText(),/Media aritmética:/);
 const auditCompetencyGeometry=async()=>{
  const result=await results.evaluate(table=>{
   const metrics=[...table.querySelectorAll('tbody tr')].map(row=>[...row.cells].slice(1).map(td=>{
    const cell=td.getBoundingClientRect(),badge=td.querySelector('.competency-level-badge,.grade-empty'),r=badge.getBoundingClientRect(),source=td.querySelector('.competency-source-grade'),s=source?.getBoundingClientRect();
    return {dx:Math.abs(r.x+r.width/2-cell.x-cell.width/2),dy:Math.abs(r.y+r.height/2-cell.y-cell.height/2),width:r.width,height:r.height,source:source?.textContent,overflow:td.scrollWidth>td.clientWidth+1||!!source&&(source.scrollWidth>source.clientWidth+1||s.bottom>cell.bottom+1||s.top<r.bottom-1)};
   }));
   const scroller=table.closest('.competency-results-scroll');
   return {metrics,documentWidth:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth,tableWidth:table.getBoundingClientRect().width,scrollWidth:scroller.clientWidth};
  });
  assert(result.documentWidth<=result.viewport+3,name+' overflow competencial '+JSON.stringify(result));
  assert(result.metrics.flat().every(m=>m.dx<2&&m.dy<2&&!m.overflow&&Math.abs(m.width-132)<2&&Math.abs(m.height-44)<2),name+' competency alignment '+JSON.stringify(result));
  assert(result.metrics.flat().every(m=>!m.source||/\d+,\d{2} \/ 10$/.test(m.source)),name+' competency two decimals '+JSON.stringify(result));
  if(opts.hasTouch)assert(result.tableWidth>=result.scrollWidth-2);
 };
 for(const theme of ['light','dark','oled']){
  await detailPage.locator('.header-tools>summary').click();await detailPage.locator('#theme-select').selectOption(theme);
  if(await detailPage.locator('.header-tools').getAttribute('open')!==null)await detailPage.locator('#close-header-tools').click();
  await auditCompetencyGeometry();await detailPage.screenshot({path:out+'/'+name+'-competencias-'+theme+'.png'});
 }
 await detailPage.locator('[data-course-subject="Materia de prueba"]').click();
 await results.waitFor();assert(await results.getByText('7,00 / 10',{exact:true}).isVisible());
 await auditCompetencyGeometry();
 assert.deepEqual(errors,[]);console.log(name+': official and custom competency results centered, two decimals, safe scrolling, all themes passed');
 }finally{await detailsContext.close();}
 }finally{await browser.close();}
}
}finally{await new Promise(ok=>server.close(ok));}
