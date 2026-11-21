import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initialNotebook,addGroup,addStudent,addAssessment,setGrade,setOrthographyGrade,
  setPeriodCategory,setFinalOverride,setFinalConfig,assertModel,addCompetency,setCompetencyLink,
  renameStudent,moveStudent,setSubjectAccent,renamePeriod
} from '../src/model.js';
import {categoryGrade,overallGrade,finalGrade,competencyGrade,finalEvidence,categoryEvidence} from '../src/calculations.js';
import {assessmentClassStatistics,periodClassStatistics,finalClassStatistics} from '../src/statistics.js';

function rng(seed){let state=seed>>>0;return ()=>{state=(1664525*state+1013904223)>>>0;return state/4294967296;};}
function pick(r,arr){return arr[Math.floor(r()*arr.length)];}
function byId(list,id){return list.find(x=>x.id===id);}
function approx(a,b,label){if(a===null||b===null)assert.equal(a,b,label);else assert.ok(Math.abs(a-b)<1e-9,`${label}: ${a} vs ${b}`);}

// Oráculo no reutiliza ninguna función de cálculos del producto.
function oracleCategory(d,student,group,period,cat){
 const p=d.gradingProfiles.find(x=>x.groupId===group&&x.periodId===period);
 const base=byId(d.categories,cat),override=p?.overrides.find(x=>x.categoryId===cat);
 const settings={...base,...override};
 const as=d.assessments.filter(a=>a.groupId===group&&a.periodId===period&&a.categoryId===cat).sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id));
 const scored=a=>{
   const g=d.grades.find(x=>x.studentId===student&&x.assessmentId===a.id);if(!g)return null;
   const baseScore=a.convertToTen?g.score*10/a.maxScore:g.score;
   return Math.max(0,baseScore-(a.orthography?.enabled&&!g.orthographyDelivered?(g.orthographyFaults||0)*a.orthography.penaltyPerFault:0));
 };
 const evidence=[];
 for(const a of as.filter(x=>!x.recoveryOf)){
   const own=scored(a),rec=as.find(x=>x.recoveryOf===a.id),second=rec?scored(rec):null;
   if(own===null&&second===null)continue;
   evidence.push({a,value:second===null?own:own===null?second:rec.recoveryMode==='replace'?second:Math.max(own,second)});
 }
 if(!evidence.length)return null;
 if(evidence.some(e=>e.value>10+1e-8))return null;
 let used=evidence;
 if(settings.rule==='highest')used=evidence.slice().sort((x,y)=>y.value-x.value).slice(0,1);
 if(settings.rule==='best_n')used=evidence.slice().sort((x,y)=>y.value-x.value).slice(0,settings.bestCount);
 if(settings.rule==='last')used=evidence.slice(-1);
 if(settings.rule==='latest_if_highest'&&as.filter(x=>!x.recoveryOf).at(-1).id===evidence.at(-1).a.id&&evidence.at(-1).value>=Math.max(...evidence.map(e=>e.value)))used=evidence.slice(-1);
 if(settings.rule==='weighted_mean')return used.reduce((x,y)=>x+y.value*y.a.weight,0)/used.reduce((x,y)=>x+y.a.weight,0);
 return used.reduce((x,y)=>x+y.value,0)/used.length;
}
function oraclePeriod(d,student,group,period){
 const p=d.gradingProfiles.find(x=>x.groupId===group&&x.periodId===period);
 const hidden=byId(d.groups,group)?.hiddenCategoryIds||[];
 const cats=d.categories.filter(c=>(!c.ownerGroupId||c.ownerGroupId===group)&&!hidden.includes(c.id)).map(c=>({...c,...p?.overrides.find(x=>x.categoryId===c.id)}));
 if(Math.abs(cats.reduce((a,c)=>a+c.weight,0)-100)>1e-8)return null;
 const grades=cats.filter(c=>c.weight>0).map(c=>({weight:c.weight,value:oracleCategory(d,student,group,period,c.id)})).filter(x=>x.value!==null);
 return grades.length?grades.reduce((x,y)=>x+y.value*y.weight,0)/grades.reduce((x,y)=>x+y.weight,0):null;
}
function oracleFinal(d,student,group){
 const cfg=d.finalConfigs.find(x=>x.groupId===group),rule=cfg?.rule||'mean';
 const all=d.periods.slice().sort((a,b)=>a.order-b.order);
 const values=all.map(p=>{const override=d.finalOverrides.find(x=>x.studentId===student&&x.periodId===p.id);return {period:p.id,value:override?override.score:oraclePeriod(d,student,group,p.id),weight:cfg?.weights[p.id]??1,included:!(cfg?.excludedPeriodIds||[]).includes(p.id)};});
 let present=values.filter(x=>x.included&&x.value!==null);
 if(!present.length)return null;
 if(rule==='latest_if_highest'){
   const last=values.filter(x=>x.included).at(-1);
   if(last?.value!==null&&last.period===present.at(-1).period&&last.value>=Math.max(...present.map(x=>x.value)))present=[last];
 }
 if(rule==='weighted_mean'){
   const positive=present.filter(x=>x.weight>0);
   return positive.length?positive.reduce((a,x)=>a+x.value*x.weight,0)/positive.reduce((a,x)=>a+x.weight,0):null;
 }
 return present.reduce((a,x)=>a+x.value,0)/present.length;
}

// 3000 semillas x 3 periodos x 6 reglas, con pesos y faltas variados.
test('oráculo independiente: 3000 cuadernos aleatorios con escalas, faltas, recuperaciones y reglas',()=>{
 const rules=['mean','weighted_mean','highest','best_n','last','latest_if_highest'];
 let checked=0;
 for(let seed=1;seed<=3000;seed++){
  const r=rng(seed*907),d=initialNotebook(),g=d.groups[0],p=d.periods[0],s=d.students[0];
  d.assessments=[];d.grades=[];
  const categories=d.categories;
  const extra=addGroup(d,'Grupo de contraste','Griego I','2026-2027','1bach');
  const other=addStudent(d,extra.id,'Alumno contraste');
  const weights=[pick(r,[0,10,20,30,40,50,60,70]),0,0];weights[1]=pick(r,[0,10,20,30,40,50,60,70,80,90,100-weights[0]]);
  if(weights[0]+weights[1]>100)weights[1]=100-weights[0];weights[2]=100-weights[0]-weights[1];
  const entries=[];
  for(let ci=0;ci<3;ci++){
   const cat=categories[ci],rule=pick(r,rules);
   setPeriodCategory(d,g.id,p.id,cat.id,{weight:weights[ci],rule,bestCount:Math.floor(r()*3)+1});
   const count=1+Math.floor(r()*5);
   for(let i=0;i<count;i++){
    const max=pick(r,[3,5,10,20]);
    const a=addAssessment(d,{name:`${cat.name} ${i}`,groupId:g.id,periodId:p.id,categoryId:cat.id,maxScore:max,weight:pick(r,[1,2,3,5,10]),convertToTen:true,orthography:ci===0&&r()>.4?{enabled:true,penaltyPerFault:.1,repetitions:30,refundable:true}:null});
    entries.push(a);
    if(r()>.22){const raw=Math.floor(r()*(max*100+1))/100;if(a.orthography?.enabled)setOrthographyGrade(d,s.id,a.id,{score:raw,faults:Math.floor(r()*8),delivered:false});else setGrade(d,s.id,a.id,raw);}
    if(r()>.72){
     const rec=addAssessment(d,{name:`Rec ${i}`,groupId:g.id,periodId:p.id,categoryId:cat.id,maxScore:max,weight:1,convertToTen:true,recoveryOf:a.id,recoveryMode:pick(r,['replace','higher']),orthography:null});
     if(r()>.2)setGrade(d,s.id,rec.id,Math.floor(r()*(max*100+1))/100);
    }
   }
  }
  const only=addAssessment(d,{name:'Grupo B',groupId:extra.id,periodId:p.id,categoryId:categories[0].id,orthography:null});setGrade(d,other.id,only.id,9.5);
  assertModel(d);
  const frozen=JSON.stringify(d);
  for(const c of categories){approx(categoryGrade(d,s.id,c.id,g.id,p.id),oracleCategory(d,s.id,g.id,p.id,c.id),`semilla ${seed} categoría ${c.name}`);checked++;}
  approx(overallGrade(d,s.id,g.id,p.id),oraclePeriod(d,s.id,g.id,p.id),`semilla ${seed} periodo`);checked++;
  approx(overallGrade(d,other.id,extra.id,p.id),9.5,`semilla ${seed} otro grupo`);checked++;
  // Las consultas matemáticas son puras; no pueden alterar el cuaderno.
  assert.equal(JSON.stringify(d),frozen,`mutación oculta en semilla ${seed}`);
  const beforeGrade=d.grades.find(x=>x.studentId===other.id).score;
  renameStudent(d,s.id,'Alumno renombrado');moveStudent(d,s.id,1);setSubjectAccent(d,'1bach','Latín I','#345678');renamePeriod(d,p.id,'Evaluación editada');
  approx(overallGrade(d,s.id,g.id,p.id),oraclePeriod(d,s.id,g.id,p.id),`semilla ${seed} cambios cosméticos`);
  assert.equal(d.grades.find(x=>x.studentId===other.id).score,beforeGrade);
  assertModel(d);
 }
 assert.equal(checked,3000*5);
});

test('oráculo independiente: 1200 combinaciones de calificación final, recuperaciones y pesos',()=>{
 for(let seed=1;seed<=1200;seed++){
  const r=rng(seed*311),d=initialNotebook(),g=d.groups[0],s=d.students[0];
  d.grades=[];d.assessments=[];
  for(const p of d.periods){
   const a=addAssessment(d,{name:`Examen ${p.name}`,groupId:g.id,periodId:p.id,categoryId:d.categories[0].id,maxScore:pick(r,[5,10,20]),convertToTen:true,orthography:null});
   if(r()>.2)setGrade(d,s.id,a.id,Math.floor(r()*(a.maxScore*100+1))/100);
  }
  const weights={};for(const p of d.periods)weights[p.id]=pick(r,[0,.5,1,2,4]);
  const excluded=d.periods.filter(()=>r()>.8).map(x=>x.id);
  setFinalConfig(d,g.id,{rule:pick(r,['mean','weighted_mean','latest_if_highest']),weights,excludedPeriodIds:excluded});
  if(r()>.65)setFinalOverride(d,s.id,pick(r,d.periods).id,Math.floor(r()*1001)/100);
  assertModel(d);
  approx(finalGrade(d,s.id,g.id),oracleFinal(d,s.id,g.id),`semilla final ${seed}`);
 }
});

test('invariancia por grupo: alterar la nota de uno no modifica resultados de los demás',()=>{
 const doc=initialNotebook(),g=doc.groups[0],p=doc.periods[0];
 const original=doc.students[0],unrelated=doc.students[1],otherGroup=addGroup(doc,'Grupo paralelo','Latín I','2026-2027','1bach');
 const studentOther=addStudent(doc,otherGroup.id,'Alumno B');const activity=addAssessment(doc,{name:'Examen B',groupId:otherGroup.id,periodId:p.id,categoryId:doc.categories[0].id,orthography:null});setGrade(doc,studentOther.id,activity.id,6);
 const stableIds=doc.grades.filter(x=>x.studentId===unrelated.id||x.studentId===studentOther.id).map(x=>({...x}));
 const a=doc.assessments.find(x=>x.groupId===g.id&&x.categoryId===doc.categories[0].id);
 const s1=overallGrade(doc,unrelated.id,g.id,p.id),s2=overallGrade(doc,studentOther.id,otherGroup.id,p.id);
 setGrade(doc,original.id,a.id,9.4);
 approx(overallGrade(doc,unrelated.id,g.id,p.id),s1,'mismo grupo');
 approx(overallGrade(doc,studentOther.id,otherGroup.id,p.id),s2,'grupo diferente');
 assert.deepEqual(doc.grades.filter(x=>x.studentId===unrelated.id||x.studentId===studentOther.id),stableIds);
 assertModel(doc);
});
