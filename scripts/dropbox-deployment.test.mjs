import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,rm} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const dir=path.resolve('_site');
const prod='https://appnotas-docente.pages.dev',preview='https://feature-dropbox-e2ee-sync.appnotas-docente.pages.dev';
const endpoints=['https://api.dropboxapi.com/oauth2/token','https://content.dropboxapi.com/2/files/download','https://content.dropboxapi.com/2/files/upload'];
async function build(branch,cloudflare=true){
 const env={...process.env,APPNOTAS_BUILD_DIR:'_site',CF_PAGES:cloudflare?'1':'0',CF_PAGES_BRANCH:branch};
 execFileSync(process.execPath,['scripts/build-static-site.mjs'],{env});
 const [html,headers,source]=await Promise.all(['index.html','_headers','src/dropbox-config.js'].map(f=>readFile(path.join(dir,f),'utf8')));
 const config=await import(pathToFileURL(path.join(dir,'src/dropbox-config.js')).href+'?mode='+encodeURIComponent(branch)+'&cf='+cloudflare);
 return {html,headers,source,config};
}
test('only approved Cloudflare main artifact activates production; preview uses its own file',async()=>{
 try{
  for(const [branch,cf,active,network] of [['main',false,false,false],['some-other-branch',true,false,false],['feature/dropbox-e2ee-sync',true,false,true],['main',true,true,true]]){
   const {html,headers,config}=await build(branch,cf);
   assert.equal(config.DROPBOX_PRODUCTION_ENABLED,active);
   assert.equal(config.dropboxConfigured(prod),active);
   assert.equal(config.dropboxConfigured('https://untrusted.example'),false);
   assert.equal(config.dropboxFilePath(preview),'/pruebas-cuaderno-cifrado.json');
   assert.equal(config.dropboxFilePath(prod),'/cuaderno-cifrado.json');
   for(const endpoint of endpoints){
    assert.equal(html.includes(endpoint),network);
    assert.equal(headers.includes(endpoint),network);
   }
   assert.match(headers,/script-src 'self'/);
   assert.match(headers,/Referrer-Policy: no-referrer/);
   assert.doesNotMatch(headers,/unsafe-inline|unsafe-eval|https:\/\/\*|connect-src[^;]*\*/);
  }
 }finally{await rm(dir,{recursive:true,force:true});}
});
