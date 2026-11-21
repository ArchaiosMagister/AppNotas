import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initialNotebook,addAssessment,addPeriod,setGrade,setPeriodCategory,setFinalConfig,setFinalOverride,
  createRubric,setRubricGrade,assertModel,migrateNotebook
} from '../src/model.js';
import {categoryGrade,finalGrade,overallGrade} from '../src/calculations.js';
import {previewRubric} from '../src/rubric-ui.js';
import {parseRubricImport} from '../src/rubric-import.js';

function fixture(){
  const doc=initialNotebook();
  doc.grades=[];
  const group=doc.groups[0].id,student=doc.students[0].id,period=doc.periods[0].id;
  return {doc,group,student,period,category:doc.categories[0].id};
}
function activity(f,maxScore,weight,periodId=f.period){
  return addAssessment(f.doc,{name:'Prueba',groupId:f.group,periodId,categoryId:f.category,maxScore,weight}).id;
}

test('pesos subnormales conservan divisiones exactas en actividad, periodo y evaluación final',()=>{
  const f=fixture(),weight=Number.MIN_VALUE;
  const other=addPeriod(f.doc,'Segunda').id;
  const first=activity(f,3,weight),second=activity(f,5,weight);
  setPeriodCategory(f.doc,f.group,f.period,f.category,{weight,rule:'weighted_mean'});
  setPeriodCategory(f.doc,f.group,f.period,f.doc.categories[1].id,{weight:100});
  setPeriodCategory(f.doc,f.group,f.period,f.doc.categories[2].id,{weight:0});
  setGrade(f.doc,f.student,first,.75);
  setGrade(f.doc,f.student,second,0);
  assert.equal(categoryGrade(f.doc,f.student,f.category,f.group,f.period),1.25);
  assert.equal(overallGrade(f.doc,f.student,f.group,f.period),1.25);
  setFinalOverride(f.doc,f.student,other,0);
  setFinalConfig(f.doc,f.group,{rule:'weighted_mean',weights:{[f.period]:weight,[other]:weight}});
  assert.equal(finalGrade(f.doc,f.student,f.group),.625);
  setGrade(f.doc,f.student,second,null);
  assert.equal(finalGrade(f.doc,f.student,f.group),1.25);
});

test('rúbrica importada y cuaderno antiguo con pesos subnormales',()=>{
  const f=fixture(),weight=Number.MIN_VALUE;
  const raw=JSON.stringify({name:'Trabajo',criteria:[
    {name:'Comentario',maxScore:5,weight},{name:'Vocabulario',maxScore:3,weight}
  ]});
  const {name,criteria}=parseRubricImport(raw);
  const rubric=createRubric(f.doc,name,criteria);
  const assessment=addAssessment(f.doc,{name,groupId:f.group,periodId:f.period,categoryId:f.category,rubricId:rubric.id});
  const [a,b]=rubric.criteria;
  const scores={[a.id]:'1,25',[b.id]:0};
  assert.equal(previewRubric(rubric,scores).grade,1.25);
  assert.equal(previewRubric(rubric,{[a.id]:0,[b.id]:''}).grade,null);
  setRubricGrade(f.doc,f.student,assessment.id,scores);
  assert.equal(f.doc.grades[0].score,1.25);
  // La fórmula de v0.9 redondeaba el numerador subnormal a cero.
  f.doc.grades[0].score=0;
  assertModel(f.doc);
  assert.equal(migrateNotebook(f.doc).migrated,false);
  assert.equal(overallGrade(f.doc,f.student,f.group,f.period),1.25);
  assert.equal(f.doc.grades[0].score,0);
});

test('4096 escenarios con un oráculo racional independiente y contraste de escalas, pesos y exclusiones',()=>{
  const f=fixture();
  const period2=addPeriod(f.doc,'Segunda').id;
  const scales=[3,5,8];
  const columns=scales.map((scale,i)=>activity(f,scale,i+1));
  setPeriodCategory(f.doc,f.group,f.period,f.category,{rule:'weighted_mean'});
  let random=0x8fa213bc;
  const next=max=>{random=(Math.imul(random,1664525)+1013904223)>>>0;return (random>>>8)%max;};
  for(let i=0;i<4096;i++){
    // 120 es múltiplo común de las tres escalas. Las contribuciones del
    // oráculo se mantienen como enteros hasta obtener el resultado esperado.
    let numerator=0n,denominator=0n;
    scales.forEach((scale,j)=>{
      const raw=next(scale+3)-2;
      setGrade(f.doc,f.student,columns[j],raw<0?null:raw);
      if(raw<0)return;
      numerator+=BigInt(raw*(120/scale)*(j+1));
      denominator+=BigInt(j+1);
    });
    const override=next(11);
    setFinalOverride(f.doc,f.student,period2,override);
    const excluded=i%4===0, firstWeight=i%7,secondWeight=i%3;
    setFinalConfig(f.doc,f.group,{rule:'weighted_mean',weights:{[f.period]:firstWeight,[period2]:secondWeight},excludedPeriodIds:excluded?[period2]:[]});
    const expectedPeriod=denominator?Number(numerator)/Number(12n*denominator):null;
    const actualPeriod=overallGrade(f.doc,f.student,f.group,f.period);
    if(expectedPeriod===null)assert.equal(actualPeriod,null);
    else assert(Math.abs(actualPeriod-expectedPeriod)<1e-12);
    const activeSecond=excluded?0:secondWeight;
    const total=(denominator?firstWeight:0)+activeSecond;
    const common=denominator||1n;
    const annualNumerator=numerator*BigInt(firstWeight)+BigInt(override*activeSecond)*12n*common;
    const expectedAnnual=total?Number(annualNumerator)/Number(12n*common*BigInt(total)):null;
    const actualAnnual=finalGrade(f.doc,f.student,f.group);
    if(expectedAnnual===null)assert.equal(actualAnnual,null);
    else assert(Math.abs(actualAnnual-expectedAnnual)<1e-12);
  }
});
