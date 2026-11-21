import {recordedScore} from './model.js';
import {categoryGrade,competencyGrade,effectiveAssessmentScore,finalEvidence,finalGrade,normalizedScore,overallGrade} from './calculations.js';

/** Estadísticas puras, efímeras y agrupadas: no se guardan ni crean nuevos datos personales. */
export function summarizeClass(values,maximum=10){
  if(!Array.isArray(values)||!Number.isFinite(maximum)||maximum<=0)throw new Error('Escala estadística inválida.');
  const total=values.length;
  const evaluated=values.filter(value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=maximum+1e-8);
  const passed=evaluated.filter(value=>value>=maximum/2-1e-8).length;
  return {total,graded:evaluated.length,ungraded:total-evaluated.length,passed,failed:evaluated.length-passed,
    mean:evaluated.length?evaluated.reduce((sum,value)=>sum+value,0)/evaluated.length:null,
    percentTotal:total?100*passed/total:null,percentGraded:evaluated.length?100*passed/evaluated.length:null,
    maximum};
}
const members=(doc,groupId)=>doc.students.filter(s=>s.groupId===groupId);
const invalid=()=>null;
export function assessmentClassStatistics(doc,groupId,assessmentId){
  const a=doc.assessments.find(item=>item.id===assessmentId&&item.groupId===groupId);
  if(!a)return invalid();
  const byStudent=new Map(doc.grades.filter(g=>g.assessmentId===a.id).map(g=>[g.studentId,g]));
  const maximum=a.rubricId||a.orthography?.enabled||a.convertToTen?10:a.maxScore;
  const values=members(doc,groupId).map(s=>{
    const grade=byStudent.get(s.id);
    if(!grade||grade.pendingJustified)return null;
    if(a.rubricId||a.orthography?.enabled)return effectiveAssessmentScore(doc,a,grade);
    return normalizedScore(recordedScore(doc,a,grade),a.maxScore,a.convertToTen);
  });
  return summarizeClass(values,maximum);
}
export function periodClassStatistics(doc,groupId,periodId,{finalView=false}={}){
  if(!doc.periods.some(p=>p.id===periodId))return invalid();
  const values=members(doc,groupId).map(s=>{
    if(!finalView)return overallGrade(doc,s.id,groupId,periodId);
    // En la vista anual se muestra el valor manual si existe; también se usa en este resumen.
    return finalEvidence(doc,s.id,groupId).evidence.find(e=>e.periodId===periodId)?.value??null;
  });
  return summarizeClass(values);
}
export function finalClassStatistics(doc,groupId){
  return summarizeClass(members(doc,groupId).map(s=>finalGrade(doc,s.id,groupId)));
}
export function categoryClassStatistics(doc,groupId,periodId,categoryId){
  return summarizeClass(members(doc,groupId).map(s=>categoryGrade(doc,s.id,categoryId,groupId,periodId)));
}
export function competencyClassStatistics(doc,groupId,periodId,competencyId){
  return summarizeClass(members(doc,groupId).map(s=>competencyGrade(doc,s.id,competencyId,groupId,periodId)));
}
