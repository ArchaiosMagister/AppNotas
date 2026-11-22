import {activeYear,isoDate,timeValid} from './planner.js';
import {overallGrade,itacaGrade,categoryEvidence} from './calculations.js';
import {effectiveCategories} from './model.js';

const stamp=()=>new Date().toISOString();
const uid=()=>crypto.randomUUID();
const clean=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es')
 .replace(/bachillerato/g,'bach').replace(/1\.?[º°ª]/g,'1').replace(/2\.?[º°ª]/g,'2')
 .replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
const sourceKey=(groupId,originGroup='')=>groupId+'|'+clean(originGroup);
export const normalizeStudentName=clean;
const activeGroups=(doc,course)=>doc.groups.filter(g=>g.course===course);
const identityLevel=(group)=>group?.level??null;
const compatiblePeople=(a,b,doc)=>{
 const g1=doc.groups.find(g=>g.id===a.groupId),g2=doc.groups.find(g=>g.id===b.groupId);
 return !!g1&&!!g2&&g1.id!==g2.id&&g1.course===g2.course&&g1.level===g2.level&&
  (!(a.originGroup&&b.originGroup)||clean(a.originGroup)===clean(b.originGroup));
};
function near(a,b){
 if(!a||!b||Math.abs(a.length-b.length)>2||Math.min(a.length,b.length)<7)return false;
 const row=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++){
  let prev=row[0];row[0]=i;
  for(let j=1;j<=b.length;j++){
   const old=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));prev=old;
  }
  if(Math.min(...row)>2)return false;
 }
 return row[b.length]<=2;
}
/** Detección local solamente: la coincidencia nunca enlaza registros por sí sola. */
export function suggestStudentLinks(doc,course){
 const groups=new Set(activeGroups(doc,course).map(g=>g.id));
 const students=doc.students.filter(s=>groups.has(s.groupId));
 const proposals=[];
 for(let i=0;i<students.length;i++)for(let j=i+1;j<students.length;j++){
  const a=students[i],b=students[j];
  if(!compatiblePeople(a,b,doc)||a.personId&&a.personId===b.personId)continue;
  if(a.personId&&b.personId&&a.personId!==b.personId)continue;
  const na=clean(a.name),nb=clean(b.name);
  if(na===nb||near(na,nb))proposals.push({a,b,quality:na===nb?'exacta':'aproximada'});
 }
 return proposals.sort((x,y)=>(x.quality==='exacta'?0:1)-(y.quality==='exacta'?0:1)||
  x.a.name.localeCompare(y.a.name,'es'));
}
export function linkStudentRecords(doc,studentIds){
 if(!Array.isArray(studentIds)||studentIds.length<2||new Set(studentIds).size!==studentIds.length)throw new Error('Elige al menos dos registros diferentes.');
 const chosen=studentIds.map(id=>doc.students.find(s=>s.id===id));
 if(chosen.some(s=>!s))throw new Error('Registro de alumno inexistente.');
 const existingIds=[...new Set(chosen.map(s=>s.personId).filter(Boolean))];
 if(existingIds.length>1)throw new Error('Desvincula primero las identidades existentes antes de unirlas.');
 const family=doc.students.filter(s=>existingIds.includes(s.personId));
 const all=[...new Map([...chosen,...family].map(s=>[s.id,s])).values()];
 const groups=new Set(all.map(s=>s.groupId));
 if(groups.size!==all.length)throw new Error('No pueden vincularse dos fichas del mismo grupo de asignatura.');
 for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++)
  if(!compatiblePeople(all[i],all[j],doc))throw new Error('Los registros deben pertenecer a grupos distintos del mismo curso y tutorías compatibles.');
 const personId=existingIds[0]||uid(),time=stamp();
 for(const student of all){student.personId=personId;student.updatedAt=time;}
 doc.updatedAt=time;return personId;
}
export function unlinkStudentRecord(doc,studentId){
 const s=doc.students.find(s=>s.id===studentId);
 if(!s)throw new Error('Alumno inexistente.');
 if(!s.personId)return false;
 delete s.personId;s.updatedAt=doc.updatedAt=stamp();return true;
}
export function linkedStudentFamilies(doc,course){
 const ids=new Set(activeGroups(doc,course).map(g=>g.id)),families=new Map();
 for(const s of doc.students)if(ids.has(s.groupId)&&s.personId){
  if(!families.has(s.personId))families.set(s.personId,[]);
  families.get(s.personId).push(s);
 }
 return [...families.values()].filter(x=>x.length>1);
}
/** Cada fuente es un grupo de asignatura + su división A/B, no la asignatura. */
export function tutoringSources(doc,course){
 const sources=[];
 for(const g of activeGroups(doc,course)){
  const origins=new Set(doc.students.filter(s=>s.groupId===g.id).map(s=>s.originGroup||''));
  for(const y of doc.planner?.years||[])if(y.name===course)
   for(const e of y.events||[])if(e.type==='evaluation'&&e.groupId===g.id&&!e.tutorshipId)origins.add(e.originGroup||'');
  if(!origins.size)origins.add('');
  for(const originGroup of origins)
   sources.push({groupId:g.id,originGroup,label:g.subject+' · '+g.name+(originGroup?' · '+originGroup:' · grupo completo'),level:g.level,course});
 }
 return sources.sort((a,b)=>a.label.localeCompare(b.label,'es',{numeric:true}));
}
export function availableTutoringSources(doc,course,exceptId=null){
 const taken=new Set((doc.tutorships||[]).filter(t=>t.id!==exceptId).flatMap(t=>t.sources.map(s=>sourceKey(s.groupId,s.originGroup))));
 return tutoringSources(doc,course).filter(s=>!taken.has(sourceKey(s.groupId,s.originGroup)));
}
export function suggestTutorships(doc,course){
 const grouped=new Map(),available=availableTutoringSources(doc,course);
 for(const s of available){
  const group=doc.groups.find(g=>g.id===s.groupId),key=[s.level,clean(group?.name),clean(s.originGroup)].join('|');
  if(!grouped.has(key))grouped.set(key,[]);
  grouped.get(key).push(s);
 }
 return [...grouped.values()].filter(sources=>new Set(sources.map(s=>s.groupId)).size>1)
  .map(sources=>({name:doc.groups.find(g=>g.id===sources[0].groupId).name+(sources[0].originGroup?' · '+sources[0].originGroup:''),sources}));
}
export function saveTutorship(doc,{id=null,name,sources}){
 if(typeof name!=='string'||!name.trim()||name.trim().length>100||/[<>\x00-\x1f]/.test(name))throw new Error('Nombre de tutoría inválido.');
 if(!Array.isArray(sources)||!sources.length||sources.length>80)throw new Error('Selecciona al menos una procedencia.');
 const existing=(doc.tutorships||[]).find(t=>t.id===id);
 if(id&&!existing)throw new Error('Tutoría inexistente.');
 const all=doc.tutorships||[];
 const accepted=[],seen=new Set(),taken=new Set(all.filter(t=>t.id!==id).flatMap(t=>t.sources.map(s=>sourceKey(s.groupId,s.originGroup))));
 let course=null,level=null;
 for(const item of sources){
  const g=doc.groups.find(g=>g.id===item?.groupId);
  const originGroup=String(item?.originGroup??'').trim();
  if(!g||originGroup.length>60||/[<>\x00-\x1f]/.test(originGroup))throw new Error('Grupo de procedencia inválido.');
  if(course===null){course=g.course;level=identityLevel(g);}
  if(g.course!==course||identityLevel(g)!==level)throw new Error('Todas las asignaturas de la tutoría deben pertenecer al mismo curso y etapa.');
  const key=sourceKey(g.id,originGroup);
  if(seen.has(key)||taken.has(key))throw new Error('Una procedencia no puede pertenecer a dos tutorías.');
  if(!tutoringSources(doc,course).some(s=>sourceKey(s.groupId,s.originGroup)===key))throw new Error('La procedencia todavía no tiene alumnos ni convocatoria.');
  seen.add(key);accepted.push({groupId:g.id,originGroup});
 }
 if(existing&&existing.course!==course)throw new Error('No se puede mover una tutoría a otro curso.');
 const time=stamp(),record={id:id||uid(),name:name.trim(),course,level,sources:accepted};
 if(existing)Object.assign(existing,record,{updatedAt:time});
 else{record.createdAt=time;record.updatedAt=time;(doc.tutorships??=[]).push(record);}
 doc.updatedAt=time;return existing||record;
}
export function removeTutorship(doc,tutorshipId){
 const tutor=(doc.tutorships||[]).find(t=>t.id===tutorshipId);
 if(!tutor)throw new Error('Tutoría inexistente.');
 if((doc.planner?.years||[]).some(y=>y.events.some(e=>e.tutorshipId===tutorshipId))||
   (doc.evaluationArchive||[]).some(a=>a.tutorshipId===tutorshipId))
  throw new Error('Esta tutoría tiene convocatorias: consérvala para no perder su historial.');
 doc.tutorships=doc.tutorships.filter(t=>t!==tutor);doc.updatedAt=stamp();
}
export function tutorStudents(doc,tutorshipId){
 const t=(doc.tutorships||[]).find(t=>t.id===tutorshipId);
 if(!t)return [];
 const map=new Map();
 for(const source of t.sources){
  const g=doc.groups.find(g=>g.id===source.groupId);
  for(const s of doc.students.filter(s=>s.groupId===source.groupId&&clean(s.originGroup||'')===clean(source.originGroup))){
   const identity=s.personId||s.id;
   if(!map.has(identity))map.set(identity,{id:identity,name:s.name,records:[]});
   const row=map.get(identity);
   row.records.push({student:s,group:g});
  }
 }
 return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name,'es',{numeric:true,sensitivity:'base'}));
}
export function tutorGradeRows(doc,tutorshipId,periodId){
 const t=(doc.tutorships||[]).find(t=>t.id===tutorshipId);
 if(!t||!doc.periods.some(p=>p.id===periodId))throw new Error('Tutoría o evaluación inexistente.');
 const groups=[...new Set(t.sources.map(s=>s.groupId))].map(id=>doc.groups.find(g=>g.id===id));
 const students=tutorStudents(doc,tutorshipId);
 return {tutorship:t,groups,rows:students.map(entry=>({
  ...entry,grades:groups.map(g=>{
   const record=entry.records.find(r=>r.group.id===g.id)?.student;
   if(!record)return {groupId:g.id,studentId:null,mean:null,itaca:null};
   return {groupId:g.id,studentId:record.id,mean:overallGrade(doc,record.id,g.id,periodId),
     itaca:itacaGrade(doc,record.id,g.id,periodId)};
  })
 }))};
}
export function tutorGradeBreakdown(doc,studentId,groupId,periodId){
 const s=doc.students.find(s=>s.id===studentId&&s.groupId===groupId);
 if(!s)throw new Error('Alumno no matriculado en esta asignatura.');
 return effectiveCategories(doc,groupId,periodId).map(c=>({
  name:c.name,weight:c.weight,...categoryEvidence(doc,studentId,c.id,groupId,periodId)
 }));
}
/** La convocatoria canónica pertenece a una tutoría; no se escriben notas. */
export function saveTutorshipEvaluation(doc,{tutorshipId,periodId,id=null,date,time,notes=''}) {
 const t=(doc.tutorships||[]).find(t=>t.id===tutorshipId);
 const p=doc.periods.find(p=>p.id===periodId),y=doc.planner?.years.find(y=>y.name===t?.course);
 if(!t||!p||!y)throw new Error('Tutoría, periodo o curso inexistente.');
 isoDate(date);
 if(date<y.start||date>y.end||!timeValid(time)||typeof notes!=='string'||notes.length>4000)
  throw new Error('Fecha, hora u observaciones inválidas.');
 const existing=y.events.find(e=>e.type==='evaluation'&&e.tutorshipId===t.id&&e.periodId===p.id);
 if(existing&&id&&existing.id!==id||id&&!existing)throw new Error('Convocatoria distinta o inexistente.');
 if(!existing&&y.events.some(e=>e.type==='evaluation'&&!e.tutorshipId&&t.sources.some(s=>
  e.groupId===s.groupId&&clean(e.originGroup||'')===clean(s.originGroup))&&e.periodId===periodId))
  throw new Error('Antes de programar, revisa las convocatorias previas de estas asignaturas.');
 const timeStamp=stamp(),record={id:existing?.id||uid(),date,type:'evaluation',title:p.name+' · '+t.name,
  groupId:null,slotId:null,assessmentId:null,tutorshipId:t.id,periodId,time,notes:notes.trim()};
 if(existing)Object.assign(existing,record);else y.events.push(record);
 doc.updatedAt=timeStamp;return existing||record;
}
/** Reconciliación explícita: no desaparece ningún dato; las entradas antiguas
 * se archivan íntegramente dentro del mismo cuaderno cifrado antes de ocultarlas. */
export function consolidateTutorshipEvaluation(doc,{tutorshipId,periodId,chosenEventId}){
 const t=(doc.tutorships||[]).find(t=>t.id===tutorshipId);
 const y=doc.planner?.years.find(y=>y.name===t?.course);
 if(!t||!y||!doc.periods.some(p=>p.id===periodId))throw new Error('Tutoría o evaluación inexistente.');
 const prior=y.events.filter(e=>e.type==='evaluation'&&!e.tutorshipId&&e.periodId===periodId&&
  t.sources.some(s=>e.groupId===s.groupId&&clean(e.originGroup||'')===clean(s.originGroup)));
 if(!prior.length||!prior.some(e=>e.id===chosenEventId))throw new Error('Elige una convocatoria existente para conservar como oficial.');
 if(y.events.some(e=>e.type==='evaluation'&&e.tutorshipId===t.id&&e.periodId===periodId))
  throw new Error('Ya existe una convocatoria común. No se han modificado las antiguas.');
 const chosen=prior.find(e=>e.id===chosenEventId),archive=doc.evaluationArchive||[];
 if(prior.some(e=>archive.some(a=>a.event?.id===e.id)))throw new Error('Convocatoria ya archivada.');
 const copy=prior.map(event=>({tutorshipId,academicYear:y.name,event:structuredClone(event),archivedAt:stamp()}));
 const canonical={...chosen,groupId:null,assessmentId:null,slotId:null,tutorshipId:t.id,
  title:doc.periods.find(p=>p.id===periodId).name+' · '+t.name};
 delete canonical.originGroup;
 y.events=y.events.filter(e=>!prior.includes(e));y.events.push(canonical);
 doc.evaluationArchive=[...archive,...copy];doc.updatedAt=stamp();return canonical;
}
export const tutorshipLegacyEvents=(doc,tutorshipId,periodId)=>{
 const t=(doc.tutorships||[]).find(t=>t.id===tutorshipId);
 const y=doc.planner?.years.find(y=>y.name===t?.course);
 return !t||!y?[]:y.events.filter(e=>e.type==='evaluation'&&!e.tutorshipId&&e.periodId===periodId&&
  t.sources.some(s=>e.groupId===s.groupId&&clean(e.originGroup||'')===clean(s.originGroup)));
};
export const tutorshipEvent=(doc,tutorshipId,periodId)=>{
 const t=(doc.tutorships||[]).find(t=>t.id===tutorshipId);
 return doc.planner?.years.find(y=>y.name===t?.course)?.events.find(e=>e.type==='evaluation'&&e.tutorshipId===tutorshipId&&e.periodId===periodId)||null;
};
