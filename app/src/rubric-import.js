import {parseCsv} from './csv.js';
import {validateCriteria,validateRubricInputPrecision} from './model.js';
const asNumber=x=>Number(String(x??'').trim().replace(',','.'));
function criteriaFromRows(rows){
  if(!rows.length)throw new Error('La rúbrica no tiene criterios.');
  const criteria=rows.map((cols,i)=>({name:String(cols[0]??'').trim(),maxScore:asNumber(cols[1]),weight:cols[2]===undefined||String(cols[2]).trim()===''?1:asNumber(cols[2])}));
  if(criteria.length>40||criteria.some(c=>!c.name||c.name.length>150||!Number.isFinite(c.maxScore)||c.maxScore<=0||c.maxScore>1000||!Number.isFinite(c.weight)||c.weight<=0||c.weight>1000))throw new Error('Cada criterio debe tener nombre, máximo positivo y peso válido (hasta 40 criterios).');
  return criteria;
}
export function parseRubricText(text){
  const lines=String(text??'').trim().split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  return criteriaFromRows(lines.map(x=>x.split(/[;|]/).map(y=>y.trim())));
}
export function parseRubricImport(text,filename='rubrica.json'){
  if(typeof text!=='string'||text.length>2_000_000)throw new Error('Archivo de rúbrica demasiado grande.');
  if(filename.toLowerCase().endsWith('.json')){
    let obj;try{obj=JSON.parse(text);}catch{throw new Error('JSON de rúbrica inválido.');}
    if(!obj||typeof obj.name!=='string'||!Array.isArray(obj.criteria))throw new Error('Se necesita un nombre y una lista de criterios.');
    if(!obj.name.trim()||obj.name.length>150)throw new Error('Nombre de rúbrica inválido.');
    const criteria=criteriaFromRows(obj.criteria.map(c=>[c.name,c.maxScore,c.weight??1]));
    // Conservar los niveles y los descriptores al reimportar una rúbrica JSON.
    // El modelo asignará nuevos IDs al instalar la rúbrica en el cuaderno.
    for(let i=0;i<criteria.length;i++){
      const raw=obj.criteria[i];
      if(!Object.hasOwn(raw,'levels'))continue;
      if(!Array.isArray(raw.levels))throw new Error('Niveles JSON inválidos.');
      criteria[i].levels=raw.levels.map(level=>{
        // Number('') y Number(null) son cero. Sin este control, un nivel
        // sin puntuación se importaba silenciosamente como «0».
        if(!level||typeof level!=='object'||!Object.hasOwn(level,'score')||level.score===null||
           String(level.score).trim()==='')throw new Error('Nivel de rúbrica sin puntuación. No se ha importado.');
        return {score:asNumber(level.score),label:level.label,description:level.description??''};
      });
    }
    validateCriteria(criteria.map((criterion,i)=>({...criterion,id:String(i)})));
    validateRubricInputPrecision(criteria);
    return {name:obj.name,criteria};
  }
  const rows=parseCsv(text);const headers=rows[0].map(x=>x.trim().toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g,''));
  const nameIdx=headers.findIndex(h=>['criterio','indicador','nombre'].includes(h));
  const maxIdx=headers.findIndex(h=>['maximo','puntuacion maxima','max','maxscore'].includes(h));
  const wIdx=headers.findIndex(h=>['peso','ponderacion','weight'].includes(h));
  if(nameIdx<0||maxIdx<0)throw new Error('CSV: se necesitan columnas «criterio» y «maximo» (opcional «peso»).');
  const criteria=criteriaFromRows(rows.slice(1).map(r=>[r[nameIdx],r[maxIdx],wIdx>=0?r[wIdx]:1]));
  validateRubricInputPrecision(criteria);
  return {name:filename.replace(/\.[^.]+$/,'').replace(/[_-]+/g,' '),criteria};
}
