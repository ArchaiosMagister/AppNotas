import {effectiveCategories,recordedScore,individualCategoryRule,itacaGroupRule,itacaStudentRule,itacaAttitudeCondition} from './model.js';
/** Cálculos puros; las notas se expresan internamente en escala 0-10. */
export const mean = values => values.length ? values.reduce((a,b)=>a+b,0)/values.length : null;
export function normalizedScore(score,maxScore,convertToTen=true){return convertToTen?(score/maxScore)*10:score;}
export const isTenGrade=value=>Number.isFinite(value)&&value>=0&&value<=10+1e-8;
/** La nota original se preserva siempre. La penalización se descuenta después de normalizar a /10. */
export function orthographyPenalty(assessment,grade){
  if(!grade||!assessment.orthography?.enabled||grade.orthographyDelivered)return 0;
  return (grade.orthographyFaults??0)*assessment.orthography.penaltyPerFault;
}
/** Punto extra solo con examen aprobado ANTES del bonus, sin faltas pendientes
 * (o con todas ellas entregadas), y únicamente cuando la opción está habilitada. */
export function greekEtymologyBonusApplied(doc,assessment,grade){
  if(!assessment.greekEtymologyBonusEnabled||!grade||grade.pendingJustified||grade.notSubmitted)return 0;
  if((grade.orthographyFaults??0)>0&&!grade.orthographyDelivered)return 0;
  const original=normalizedScore(recordedScore(doc,assessment,grade),assessment.maxScore,assessment.convertToTen);
  const afterSpelling=Math.max(0,original-orthographyPenalty(assessment,grade));
  if(afterSpelling<5)return 0;
  return grade.greekEtymologyBonus??0;
}
export function effectiveAssessmentScore(doc,assessment,grade){
  if(!grade||grade.pendingJustified)return null;
  const base=normalizedScore(recordedScore(doc,assessment,grade),assessment.maxScore,assessment.convertToTen);
  const afterSpelling=Math.max(0,base-orthographyPenalty(assessment,grade));
  const bonus=greekEtymologyBonusApplied(doc,assessment,grade);
  // Sin bonificación conservar también los valores brutos >10: la auditoría
  // de escalas debe detectarlos, nunca truncarlos silenciosamente.
  return bonus>0?Math.min(10,afterSpelling+bonus):afterSpelling;
}

function weightedGrade(entries, valueOf, weightOf){
  const maxWeight=entries.reduce((max,entry)=>Math.max(max,weightOf(entry)),0);
  if(!maxWeight)return null;
  const divisor=maxWeight<1e-300?maxWeight:1;
  let sum=0,weight=0;
  for(const entry of entries){
    const scaled=weightOf(entry)/divisor;
    if(scaled===0)continue;
    sum+=valueOf(entry)*scaled;
    weight+=scaled;
  }
  return sum/weight;
}
/** Índice efímero por consulta. Nunca se conserva tras cambios en las notas. */
function studentGradeIndex(doc,studentId){
  const map=new Map();
  for(const grade of doc.grades)if(grade.studentId===studentId)map.set(grade.assessmentId,grade);
  return map;
}
export function categoryEvidence(doc,studentId,categoryId,groupId,periodId,studentGrades=null){
  if(!doc.students.some(s=>s.id===studentId&&s.groupId===groupId)||!doc.periods.some(p=>p.id===periodId))return {grade:null,rule:null,evidence:[],used:[],issue:null};
  const category=effectiveCategories(doc,groupId,periodId).find(c=>c.id===categoryId);
  if(!category)return {grade:null,rule:null,evidence:[],used:[],issue:null};
  const assessments=doc.assessments.filter(a=>a.groupId===groupId&&a.periodId===periodId&&a.categoryId===categoryId).sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id));
  const base=assessments.filter(a=>!a.recoveryOf);
  // La nota del alumno se indexa una vez para todas las categorías del cálculo.
  // Si se solicita una categoría aislada se construye aquí; no hay caché persistente.
  const gradesByAssessment=studentGrades??studentGradeIndex(doc,studentId);
  const recoveryByOriginal=new Map();
  for(const assessment of assessments){
    if(assessment.recoveryOf)recoveryByOriginal.set(assessment.recoveryOf,assessment);
  }
  const evidence=base.flatMap(a=>{
    const own=gradesByAssessment.get(a.id);
    const recovery=recoveryByOriginal.get(a.id);
    const recovered=recovery&&gradesByAssessment.get(recovery.id);
    const first=own?effectiveAssessmentScore(doc,a,own):null;
    const second=recovered?effectiveAssessmentScore(doc,recovery,recovered):null;
    const value=second===null?first:first===null?second:recovery.recoveryMode==='replace'?second:Math.max(first,second);
    return value===null?[]:[{assessmentId:a.id,name:a.name,value,weight:a.weight,original:first,recovery:second,recoveryName:recovered?recovery.name:null,...(own?.notSubmitted?{originalNotSubmitted:true}:{}),...(recovered?.notSubmitted?{recoveryNotSubmitted:true}:{})}];
  });
  const exception=individualCategoryRule(doc,studentId,categoryId,periodId);
  const countedNP=evidence.some(e=>e.value===0&&(e.originalNotSubmitted||e.recoveryNotSubmitted));
  const appliedRule=exception==='mean'||(exception==='np_mean'&&countedNP)?'mean':exception==='last'?'last':category.rule;
  const context={individualRule:exception,groupRule:category.rule,npTriggered:exception==='np_mean'&&countedNP};
  if(!evidence.length)return {grade:null,rule:appliedRule,evidence,used:[],issue:null,...context};
  // Una calificación sin normalizar superior a 10 no puede mezclarse de forma
  // segura con categorías o competencias que se expresan sobre diez.
  if(evidence.some(e=>!isTenGrade(e.value)))return {grade:null,rule:appliedRule,evidence,used:[],issue:'out_of_ten',...context};
  let used=evidence;
  if(appliedRule==='highest')used=[...evidence].sort((a,b)=>b.value-a.value).slice(0,1);
  else if(appliedRule==='best_n')used=[...evidence].sort((a,b)=>b.value-a.value).slice(0,category.bestCount??2);
  else if(appliedRule==='last')used=exception==='last'&&base.at(-1)?.id!==evidence.at(-1)?.assessmentId?evidence:evidence.slice(-1);
  else if(appliedRule==='latest_if_highest' && base.at(-1)?.id===evidence.at(-1)?.assessmentId && evidence.at(-1).value>=Math.max(...evidence.map(e=>e.value)))used=evidence.slice(-1);
  const grade=appliedRule==='weighted_mean'
    ? weightedGrade(used,e=>e.value,e=>e.weight)
    : mean(used.map(e=>e.value));
  return {grade:isTenGrade(grade)?grade:null,rule:appliedRule,evidence,used,issue:isTenGrade(grade)?null:'out_of_ten',...context};
}
export function categoryGrade(doc,studentId,categoryId,groupId,periodId){
  return categoryEvidence(doc,studentId,categoryId,groupId,periodId).grade;
}
export function overallGrade(doc,studentId,groupId,periodId) {
  if(!doc.students.some(s=>s.id===studentId&&s.groupId===groupId)||!doc.periods.some(p=>p.id===periodId))return null;
  const categories=effectiveCategories(doc,groupId,periodId);
  const total=categories.reduce((sum,c)=>sum+c.weight,0);
  if(Math.abs(total-100)>1e-8)return null;
  const grades=studentGradeIndex(doc,studentId);
  const entries=categories.filter(c=>c.weight>0).map(c=>({weight:c.weight,...categoryEvidence(doc,studentId,c.id,groupId,periodId,grades)}));
  if(entries.some(x=>x.issue))return null;
  const evaluated=entries.filter(x=>x.grade!==null);
  const grade=weightedGrade(evaluated,e=>e.grade,e=>e.weight);
  return grade===null||!isTenGrade(grade)?null:grade;
}
/** Una condición activa nunca altera la media: solo permite o veta redondearla.
 * Sin evidencias, AJ, rúbrica o criterio desaparecidos => no redondear.
 * El requisito por criterio usa la escala BRUTA propia del criterio.
 * El requisito por categoría usa la nota agregada 0–10 de Actitud. */
export function itacaAttitudeBlock(doc,studentId,groupId,periodId){
  const config=itacaAttitudeCondition(doc,groupId,periodId);
  if(!config)return null;
  const category=doc.categories.find(c=>c.id===config.categoryId);
  const invalid='Falta la calificación o la configuración de Actitud requerida.';
  if(!category)return invalid;
  if(config.mode==='category'){
    const grade=categoryGrade(doc,studentId,config.categoryId,groupId,periodId);
    if(grade===null)return invalid;
    return grade+1e-9<config.minScore
      ?'La categoría Actitud no alcanza 5/10.':null;
  }
  const activity=doc.assessments.find(a=>a.id===config.assessmentId&&a.groupId===groupId&&
    a.periodId===periodId&&a.categoryId===config.categoryId&&a.rubricId);
  const criterion=doc.rubrics.find(r=>r.id===activity?.rubricId)?.criteria.find(c=>c.id===config.criterionId);
  const grade=doc.grades.find(g=>g.studentId===studentId&&g.assessmentId===activity?.id);
  if(!activity||!criterion||!grade||grade.pendingJustified||grade.notSubmitted)return invalid;
  const score=grade.rubricRatings?.find(r=>r.criterionId===config.criterionId)?.score;
  if(!Number.isFinite(score))return invalid;
  return score+1e-9<config.minScore?
    'El criterio '+criterion.name+' no alcanza '+config.minScore+'/'+criterion.maxScore+'.':null;
}
/** Nota Ítaca: siempre un entero de 0 a 10. La media trimestral original
 * no se modifica. «none» o un veto de Actitud conservan la parte entera;
 * «half» y «seven» solo permiten subir si se alcanza el umbral.
 * Las calificaciones ausentes siguen siendo nulas, nunca cero.
 */
export function itacaGrade(doc,studentId,groupId,periodId){
  const average=overallGrade(doc,studentId,groupId,periodId);
  if(average===null)return null;
  const chosen=itacaStudentRule(doc,studentId,periodId);
  const rule=chosen==='general'?itacaGroupRule(doc,groupId):chosen;
  if(rule==='none'||itacaAttitudeBlock(doc,studentId,groupId,periodId))return Math.min(10,Math.floor(average+1e-10));
  const base=Math.floor(average+1e-10);
  const fraction=average-base;
  return Math.min(10,base+(fraction+1e-10>=(rule==='seven'?0.7:0.5)?1:0));
}
/** Escala competencial descendente: 1 = máxima adquisición; 4 = no adquirida.
 * Se convierte la media íntegra de 0–10, SIN redondeos intermedios.
 * Los límites exactos 5, 6.5 y 8 pasan al nivel inmediatamente superior.
 * Sin evidencias o fuera de 0–10 no debe mostrarse nivel alguno.
 */
export const COMPETENCY_ACQUISITION_LABELS=Object.freeze({
  1:'Adquisición alta',
  2:'Adquisición media',
  3:'Adquisición baja',
  4:'No adquirida'
});
export function competencyAcquisitionLevel(grade){
  if(typeof grade!=='number'||!Number.isFinite(grade)||grade<0||grade>10+1e-8)return null;
  if(grade<5)return 4;
  if(grade<6.5)return 3;
  if(grade<8)return 2;
  return 1;
}
export function competencyAcquisitionLabel(grade){
  const level=competencyAcquisitionLevel(grade);
  return level===null?null:COMPETENCY_ACQUISITION_LABELS[level];
}

export function competencyGrade(doc,studentId,competencyId,groupId,periodId) {
  const comp=doc.competencies.find(c=>c.id===competencyId);
  if(!comp||!doc.students.some(s=>s.id===studentId&&s.groupId===groupId)||
      (comp.groupId!==undefined?comp.groupId!==groupId:doc.groups[0]?.id!==groupId))return null;
  const grades=studentGradeIndex(doc,studentId);
  const all=comp.links.map(l=>({weight:l.weight,...categoryEvidence(doc,studentId,l.categoryId,groupId,periodId,grades)}));
  if(all.some(x=>x.issue))return null;
  const entries=all.filter(x=>x.grade!==null);
  const grade=weightedGrade(entries,e=>e.grade,e=>e.weight);
  return grade===null||!isTenGrade(grade)?null:grade;
}
/** Media aritmética REAL de competencias evaluadas, sin ponderación entre CE. */
export function competencyArithmeticMean(doc,studentId,competencyIds,groupId,periodId){
  if(!Array.isArray(competencyIds))throw new Error('Lista de competencias inválida.');
  if(!doc.students.some(s=>s.id===studentId&&s.groupId===groupId)||!doc.periods.some(p=>p.id===periodId))return null;
  const values=[...new Set(competencyIds.filter(id=>typeof id==='string'))]
    .map(id=>competencyGrade(doc,studentId,id,groupId,periodId))
    .filter(grade=>grade!==null);
  return mean(values);
}
/** Escala de adquisición 1–4: 1 = alta; 4 = no adquirida. No es lineal. */
export function gradeToFour(scoreTen){
  return competencyAcquisitionLevel(scoreTen);
}
export function roundGrade(n,decimals=2,method='half-up') {
  if(n===null || n===undefined || !Number.isFinite(n))return null;
  if(!Number.isInteger(decimals)||decimals<0||decimals>3)throw new Error('Precisión inválida.');
  const f=10**decimals, x=n*f;
  const tolerance=Number.EPSILON*Math.max(1,Math.abs(x))*2;
  if(method==='floor')return Math.floor(x+tolerance)/f;
  if(method==='ceil')return Math.ceil(x-tolerance)/f;
  if(method!=='half-up')throw new Error('Redondeo desconocido.');
  return Math.round(x+tolerance)/f;
}
export function formatGrade(x,settings={decimals:2,rounding:'half-up'}){
  const decimals=Math.min(2,Math.max(0,settings.decimals));
  const n=roundGrade(x,decimals,settings.rounding);
  return n===null?'—':n.toLocaleString('es-ES',{minimumFractionDigits:decimals,maximumFractionDigits:decimals});
}
export function calculationBreakdown(doc,studentId,groupId,periodId){
  if(!doc.students.some(s=>s.id===studentId&&s.groupId===groupId)||!doc.periods.some(p=>p.id===periodId))return [];
  const grades=studentGradeIndex(doc,studentId);
  return effectiveCategories(doc,groupId,periodId).map(c=>({category:c.name,categoryId:c.id,weight:c.weight,rule:c.rule, ...categoryEvidence(doc,studentId,c.id,groupId,periodId,grades)}));
}

/** La evaluación final se basa en resultados de periodos, con sustitución manual opcional. */
export function finalEvidence(doc,studentId,groupId){
  const student=doc.students.find(s=>s.id===studentId);
  if(!student||student.groupId!==groupId)return {grade:null,rule:'mean',evidence:[],used:[]};
  const cfg=doc.finalConfigs.find(x=>x.groupId===groupId);
  const rule=cfg?.rule||'mean';
  const periods=[...doc.periods].sort((a,b)=>a.order-b.order);
  const evidence=periods.map(p=>{
    const override=doc.finalOverrides.find(o=>o.studentId===studentId&&o.periodId===p.id);
    const automatic=overallGrade(doc,studentId,groupId,p.id);
    return {periodId:p.id,name:p.name,automatic,manual:override?.score??null,value:override?override.score:automatic,weight:cfg?.weights[p.id]??1,included:!cfg?.excludedPeriodIds?.includes(p.id)};
  });
  const blocking=evidence.some(e=>e.included&&(rule!=='weighted_mean'||e.weight>0)&&e.manual===null&&e.automatic===null&&
    doc.grades.some(g=>g.studentId===studentId&&!g.pendingJustified&&doc.assessments.some(a=>a.id===g.assessmentId&&a.groupId===groupId&&a.periodId===e.periodId)));
  let used=evidence.filter(e=>e.included&&e.value!==null);
  const lastIncluded=evidence.filter(e=>e.included).at(-1);
  if(rule==='latest_if_highest'&&lastIncluded&&lastIncluded.value!==null&&used.length&&lastIncluded.periodId===used.at(-1).periodId&&lastIncluded.value>=Math.max(...used.map(e=>e.value)))used=used.slice(-1);
  const candidate=rule==='weighted_mean'
    ? weightedGrade(used,e=>e.value,e=>e.weight)
    : mean(used.map(e=>e.value));
  const grade=blocking||candidate===null||!isTenGrade(candidate)?null:candidate;
  return {grade,rule,evidence,used,issue:blocking?'invalid_period':candidate!==null&&!isTenGrade(candidate)?'out_of_ten':null};
}
export const finalGrade=(doc,studentId,groupId)=>finalEvidence(doc,studentId,groupId).grade;


/** Errores matemáticos que deben mostrarse al profesor, no silenciarse. */
export function periodCalculationWarnings(doc,studentId,groupId,periodId){
  if(!doc.students.some(s=>s.id===studentId&&s.groupId===groupId)||!doc.periods.some(p=>p.id===periodId))return [];
  const categories=effectiveCategories(doc,groupId,periodId);
  const warnings=[];
  const sum=categories.reduce((total,c)=>total+c.weight,0);
  if(Math.abs(sum-100)>1e-8)warnings.push('Los porcentajes de las categorías no suman 100 %.');
  const grades=studentGradeIndex(doc,studentId);
  for(const category of categories.filter(c=>c.weight>0)){
    const evidence=categoryEvidence(doc,studentId,category.id,groupId,periodId,grades);
    if(evidence.issue==='out_of_ten')warnings.push(`«${category.name}» contiene una nota sin conversión que supera 10/10. Activa la conversión de esa actividad.`);
  }
  return warnings;
}

/** Paleta accesible para notas de 0 a 10. Azul graduado, de claro (7) a oscuro (9,99). */
export function gradeTone(value){
  if(value===null||value===undefined||!Number.isFinite(value)||value<0||value>10)return null;
  const n=roundGrade(value,2,'half-up');
  let background;
  if(n<3.5)background='#78162B';
  else if(n<5)background='#FA3D46';
  else if(n<6)background='#FFE16A';
  else if(n<7)background='#73DCA2';
  else if(n<10){
    const ratio=Math.max(0,Math.min(1,(n-7)/2.99));
    const from=[195,233,255],to=[19,55,135];
    background='#'+from.map((v,i)=>Math.round(v+(to[i]-v)*ratio).toString(16).padStart(2,'0')).join('').toUpperCase();
  }else background='#743BB9';
  const channels=[1,3,5].map(i=>parseInt(background.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
  const lum=channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;
  const dark=(lum+.05)/.05,light=1.05/(lum+.05);
  return {background,color:dark>=light?'#000000':'#FFFFFF',contrast:Math.max(dark,light)};
}
