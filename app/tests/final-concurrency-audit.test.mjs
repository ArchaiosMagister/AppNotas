import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
test('las modificaciones de Cálculos mantienen grupo, evaluación y valor del DOM de origen',async()=>{
 const code=source.slice(source.indexOf('function bindRules(){'),source.indexOf('function bindCompetencies(){'));
 const state={groupId:'A',periodId:'p1',doc:{categories:[]}};
 const weight={dataset:{periodweight:'exams'},value:'40'};
 const rule={dataset:{periodrule:'exams'},value:'mean'};
 const best={dataset:{bestcount:'exams'},value:'2'};
 const calls=[],queue=[],nodes=new Map();
 const get=id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id);};
 const api=runInNewContext(code+';bindRules;',{STATE:state,currentView:()=>({...state}),document:{querySelectorAll:s=>s==='[data-periodweight]'?[weight]:s==='[data-periodrule]'?[rule]:s==='[data-bestcount]'?[best]:[]},$:get,openIndividualRuleDirectory:()=>{},commit:fn=>new Promise(resolve=>queue.push(()=>{fn({});resolve();})),setPeriodCategory:(d,g,p,c,patch)=>calls.push(JSON.stringify({g,p,c,patch})),fail:e=>{throw e;},render:()=>{}});
 get('#individual-rules').addEventListener=()=>{};get('#enable-category').addEventListener=()=>{};
 api();
 const a=weight.onchange(),b=rule.onchange(),c=best.onchange();
 state.groupId='B';state.periodId='p2';weight.value='90';rule.value='last';best.value='8';
 queue.forEach(fn=>fn());await Promise.all([a,b,c]);
 assert.deepEqual(calls.map(JSON.parse),[{g:'A',p:'p1',c:'exams',patch:{weight:40}},{g:'A',p:'p1',c:'exams',patch:{rule:'mean'}},{g:'A',p:'p1',c:'exams',patch:{bestCount:2}}]);
});
test('la cola rechaza una mutación de otro cuaderno o sesión y exportación registra la revisión capturada',()=>{
 assert(source.includes('STATE.key!==view.key||STATE.doc.id!==view.bookId'));
 assert(source.includes('recordExportReceipt(source.db,receipt,source.expected)'));
 assert(source.includes('const prepared=await createPortableCopy(snapshot,key,salt,exportedDate,preferences)'));
 assert(source.includes('!sameEnvelope(await readEnvelope(db),expected)||!stillCurrent()'));
});

test('una revisión remota terminada durante una edición no reconstruye la interfaz',()=>{
 const start=source.indexOf('  adopt:()=>{'),end=source.indexOf('  onStatus:',start);
 const code=source.slice(start,end).trim().replace(/,$/,'');
 const state={history:['old'],studentId:'s',doc:{students:[{id:'s'}]}};
 const calls=[];let editing=true;
 const ctx={STATE:state,emptyHistory:()=>[],canRefreshView:()=>!editing,document:{activeElement:{matches:()=>editing}},scheduleDeferredRefresh:()=>calls.push('defer'),renderAfterMutation:()=>calls.push('render'),deferredRender:false};
 const adopt=runInNewContext('({'+code+'}).adopt',ctx);
 adopt();assert.deepEqual(calls,['defer']);assert.equal(ctx.deferredRender,true);assert.deepEqual(state.history,[]);
 editing=false;adopt();assert.deepEqual(calls,['defer','render']);
});
