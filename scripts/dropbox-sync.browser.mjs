/** End-to-end regression in real browser contexts with real IndexedDB/WebCrypto.
 * Dropbox endpoints are simulated; no credentials, account or network are used.
 */
import {readFile} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
import {unlockVault} from '../app/src/vault.js';
const origin='https://feature-dropbox-e2ee-sync.appnotas-docente.pages.dev';
const password='Fictitious browser regression passphrase 2026';
execFileSync(process.execPath,['scripts/build-static-site.mjs'],{env:{...process.env,CF_PAGES:'1',CF_PAGES_BRANCH:'feature/dropbox-e2ee-sync'},stdio:'inherit'});
const dir=resolve('dist');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.pdf':'application/pdf'};
const headers={'access-control-allow-origin':origin,'access-control-allow-methods':'POST,OPTIONS','access-control-allow-headers':'authorization,dropbox-api-arg,content-type','access-control-expose-headers':'Dropbox-API-Result'};
const grade='.grade-table input.note-input:not(.original-note-input)';
async function waitStatus(page,status){await page.waitForFunction(s=>document.querySelector('#dropbox-sync')?.title===s,status,{timeout:30000});}
async function passwordForm(page,selector='#password'){await page.locator(selector).fill(password);}
async function edit(page,value){const input=page.locator(grade).first();await input.fill(value);await input.press('Tab');await page.locator('h1').click();await page.waitForFunction(v=>document.querySelector('.grade-table input.note-input:not(.original-note-input)')?.value===v,value);}
for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch({headless:true});
  let remote=null,revision=0,uploads=0;
  const requests=[],errors=[];
  async function waitRevision(previous){const until=Date.now()+30000;while(revision<=previous&&Date.now()<until)await new Promise(r=>setTimeout(r,100));assert(revision>previous,'expected a new remote revision');}
  async function device(){
    const ctx=await browser.newContext({serviceWorkers:'block',acceptDownloads:true,viewport:{width:834,height:1194}});
    await ctx.route('**/*',async route=>{
      const req=route.request(),url=new URL(req.url());
      const json=(data,status=200,extra={})=>route.fulfill({status,headers:{...headers,...extra,'content-type':'application/json'},body:JSON.stringify(data)});
      if(url.origin===origin){
        const target=resolve(dir,url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1)));
        if(!target.startsWith(dir+sep))return route.abort();
        try{return await route.fulfill({status:200,headers:{'content-type':mime[extname(target)]||'application/octet-stream','referrer-policy':'no-referrer'},body:await readFile(target)});}
        catch{return route.fulfill({status:404,body:''});}
      }
      if(url.origin==='https://www.dropbox.com'&&url.pathname==='/oauth2/authorize'){
        assert.equal(url.searchParams.get('redirect_uri'),origin+'/');
        assert.equal(url.searchParams.get('code_challenge_method'),'S256');
        assert.equal(url.searchParams.get('scope'),'files.content.read files.content.write');
        const callback=origin+'/?code=fictional-code&state='+encodeURIComponent(url.searchParams.get('state'));
        // WebKit cannot fulfill a 302 in Playwright routing. Navigate from a
        // synthetic provider page instead; same origin/state roundtrip.
        return route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><script>location.replace('+JSON.stringify(callback)+')</script>'});
      }
      if(['https://api.dropboxapi.com','https://content.dropboxapi.com'].includes(url.origin)){
        if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
        assert.equal(req.method(),'POST');
        requests.push(url.pathname);
        if(url.pathname==='/oauth2/token'){
          const body=new URLSearchParams(req.postData());
          assert.equal(body.get('client_secret'),null);
          if(body.get('grant_type')==='authorization_code')assert.equal(body.get('redirect_uri'),origin+'/');
          else assert.equal(body.get('grant_type'),'refresh_token');
          return json({access_token:'fictional-access-token',refresh_token:'fictional-refresh-token',token_type:'bearer',expires_in:14400,scope:'files.content.read files.content.write'});
        }
        const arg=JSON.parse(req.headers()['dropbox-api-arg']);
        assert.equal(arg.path,'/pruebas-cuaderno-cifrado.json');
        if(url.pathname==='/2/files/download'){
          if(!remote)return json({error:{'.tag':'path',path:{'.tag':'not_found'}}},409);
          return route.fulfill({status:200,headers:{...headers,'content-type':'application/octet-stream','Dropbox-API-Result':JSON.stringify({rev:'r'+revision,size:Buffer.byteLength(remote)})},body:remote});
        }
        if(url.pathname==='/2/files/upload'){
          assert.equal(arg.autorename,false);assert.equal(arg.strict_conflict,true);
          if(remote?arg.mode?.update!=='r'+revision:arg.mode!=='add')return json({},409);
          const body=req.postData(),snapshot=JSON.parse(body);
          assert.deepEqual(Object.keys(snapshot).sort(),['type','vault','version']);
          assert(!body.includes(password));assert(!body.includes('fictional-refresh-token'));assert(!body.includes('"students"'));
          remote=body;revision++;uploads++;return json({rev:'r'+revision});
        }
      }
      throw Error('Unexpected external request: '+url.origin+url.pathname);
    });
    const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
    page.on('dialog',dialog=>dialog.accept());
    await page.goto(origin+'/');return {ctx,page};
  }
  try{
    const a=await device(),p=a.page;
    await passwordForm(p);await p.locator('#confirm-password').fill(password);
    await p.locator('[data-create-mode="demo"]').click();
    await p.locator('#dropbox-sync').waitFor();
    await p.locator('#dropbox-sync').click();
    // Generate a password then cancel: the visible text and old password must
    // both be erased even though the closed dialog remains in the DOM.
    await p.locator('#dropbox-upgrade').click();
    await p.locator('#dropbox-old-password').fill(password);
    await p.locator('#dropbox-generate-password').click();
    assert.match(await p.locator('#dropbox-new-password').inputValue(),/^[A-Za-z0-9_-]{32}$/);
    await p.locator('#dropbox-upgrade-cancel').click();
    for(const id of ['#dropbox-old-password','#dropbox-new-password','#dropbox-repeat-password'])assert.equal(await p.locator(id).inputValue(),'');
    await p.locator('#dropbox-link').click();
    await p.getByText('Dropbox autorizado. Desbloquea tu cuaderno para confirmar la vinculación.',{exact:true}).waitFor({timeout:30000});
    await passwordForm(p);await p.locator('#unlock-form button[type=submit]').click();
    await p.locator('#backup-password').waitFor();await passwordForm(p,'#backup-password');
    await p.locator('#backup-password-form button[type=submit]').click();
    await waitStatus(p,'Sincronizado');assert.equal(uploads,1);
    assert.equal(await p.locator('#backup-password').inputValue(),'');console.log(name+': vinculación y primera copia OK');
    // Return to notebook after link and change a real UI score.
    await p.locator('.nav-primary [data-tab="cuaderno"]').click();
    const before=revision;await edit(p,'2');
    await waitRevision(before);await waitStatus(p,'Sincronizado');
    const b=await device(),q=b.page;
    await q.locator('#dropbox-restore-locked').click();
    await q.getByRole('button',{name:'Continuar recuperación de Dropbox'}).waitFor({timeout:30000});
    await q.locator('#dropbox-restore-locked').click();
    await q.locator('#backup-password').waitFor();await passwordForm(q,'#backup-password');
    await q.locator('#backup-password-form button[type=submit]').click();
    await q.locator(grade).first().waitFor();assert.equal(await q.locator(grade).first().inputValue(),'2');
    await waitStatus(q,'Sincronizado');console.log(name+': recuperación en segundo dispositivo OK');
    const beforeB=revision;await edit(q,'3');await waitRevision(beforeB);await waitStatus(q,'Sincronizado');
    await p.evaluate(()=>window.dispatchEvent(new Event('pageshow')));
    await p.waitForFunction(()=>document.querySelector('.grade-table input.note-input:not(.original-note-input)')?.value==='3');
    console.log(name+': sincronización bidireccional OK');
    // Offline concurrent edits must stop rather than overwrite either copy.
    await a.ctx.setOffline(true);await edit(p,'4');
    const beforeConflict=revision;
    await edit(q,'5');await waitRevision(beforeConflict);await waitStatus(q,'Sincronizado');
    await a.ctx.setOffline(false);
    await p.evaluate(()=>window.dispatchEvent(new Event('online')));
    await waitStatus(p,'Conflicto: se conservan ambas versiones');
    assert.equal(await p.locator(grade).first().inputValue(),'4');
    assert.equal(await q.locator(grade).first().inputValue(),'5');
    console.log(name+': conflicto offline conservado OK');
    const stableRevision=revision;
    await p.locator('#dropbox-sync').click();
    await p.locator('#dropbox-conflict-copies').click();
    await p.locator('#dropbox-copy-local').waitFor();
    const copies=[];
    for(const id of ['#dropbox-copy-local','#dropbox-copy-remote']){
      const pending=p.waitForEvent('download');await p.locator(id).click();const download=await pending;
      const raw=JSON.parse(await readFile(await download.path(),'utf8'));
      const opened=await unlockVault(password,raw);
      assert(opened.doc.students.length>0);
      copies.push(opened.doc);
    }
    assert.notDeepEqual(copies[0].grades,copies[1].grades);
    assert.equal(revision,stableRevision);
    await p.locator('#dropbox-copy-close').click();
    await p.locator('#dropbox-unlink').click();
    await waitStatus(p,'Dropbox no vinculado');
    assert.equal(revision,stableRevision);
    await p.locator('#lock').click();await p.locator('#unlock-form').waitFor();
    assert.equal(await p.locator('#modal').evaluate(el=>el.childElementCount),0);
    assert.deepEqual(errors,[]);
    assert(requests.includes('/oauth2/token'));
    console.log(name+': PKCE, IndexedDB, cifrado, sincronización bidireccional, offline, conflicto, exportación y desvinculación OK');
    await a.ctx.close();await b.ctx.close();
  }finally{await browser.close();}
}
