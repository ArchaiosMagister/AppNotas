import {parseScore, rubricGradeFromRatings} from './model.js';

/** Previsualización pura de una rúbrica, apta para puntuaciones incompletas. */
export function previewRubric(rubric,values){
  if(!rubric?.criteria?.length)throw new Error('Rúbrica sin criterios.');
  const maxWeight=Math.max(...rubric.criteria.map(c=>c.weight));
  const totalWeight=rubric.criteria.reduce((n,c)=>n+c.weight/maxWeight,0);
  if(!Number.isFinite(totalWeight)||totalWeight<=0)throw new Error('Pesos inválidos.');
  let sum=0,completed=0;
  const criteria=rubric.criteria.map(c=>{
    const raw=values?.[c.id];
    if(raw===null||raw===undefined||String(raw).trim()==='')return {id:c.id,filled:false,contribution:0};
    const score=parseScore(raw);
    if(!Number.isFinite(score)||score<0||score>c.maxScore)throw new Error(`«${c.name}»: puntuación entre 0 y ${c.maxScore}.`);
    if(c.levels&&!c.levels.some(l=>l.score===score))throw new Error(`«${c.name}»: selecciona uno de sus niveles permitidos.`);
    const contribution=10*(score/c.maxScore)*(c.weight/maxWeight)/totalWeight;
    sum+=contribution;completed++;
    return {id:c.id,filled:true,score,contribution};
  });
  const remainingWeight=rubric.criteria.reduce((n,c,i)=>n+(criteria[i].filled?0:c.weight/maxWeight),0);
  return {
    completed,total:rubric.criteria.length,
    grade:completed===rubric.criteria.length?rubricGradeFromRatings(rubric,criteria.map(c=>({criterionId:c.id,score:c.score}))):null,
    minimum:sum,maximum:sum+10*remainingWeight/totalWeight,
    criteria
  };
}
/** Un borrador editable puede validarse antes de guardarse con IDs nuevos en el modelo. */
export function validateRubricDraft(rows){
  if(!Array.isArray(rows)||rows.length<1||rows.length>40)throw new Error('Introduce entre 1 y 40 criterios.');
  return rows.map((c,index)=>{
    const name=String(c.name??'').trim(),maxScore=Number(String(c.maxScore).replace(',','.')),weight=Number(String(c.weight).replace(',','.'));
    if(!name||name.length>150||!Number.isFinite(maxScore)||maxScore<=0||maxScore>1000||!Number.isFinite(weight)||weight<=0||weight>1000)
      throw new Error(`Revisa el criterio ${index+1}: nombre, máximo y peso deben ser válidos.`);
    return {name,maxScore,weight};
  });
}
