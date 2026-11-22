import {normalizeStudentName as norm} from './evaluation-groups.js';

const sourceKey=(groupId,origin='')=>groupId+'|'+norm(origin);
const groupSort=(a,b)=>a.name.localeCompare(b.name,'es',{numeric:true,sensitivity:'base'});
/** Solo son propuestas visuales; nunca se crean tutorías ni se cambian eventos
 * hasta que el docente confirma la correspondencia. */
export function sessionPresentation(doc,year){
 const groups=doc.groups.filter(g=>g.course===year.name);
 const assigned=new Set((doc.tutorships||[]).filter(t=>t.course===year.name)
  .flatMap(t=>t.sources.map(s=>sourceKey(s.groupId,s.originGroup))));
 const sources=[];
 for(const group of groups){
  const students=doc.students.filter(s=>s.groupId===group.id);
  const legacy=year.events.filter(e=>e.type==='evaluation'&&!e.tutorshipId&&e.groupId===group.id);
  const known=new Map();
  for(const student of students){
   const origin=(student.originGroup||'').trim(),key=norm(origin);
   if(!known.has(key))known.set(key,origin);
  }
  for(const event of legacy){
   const origin=(event.originGroup||'').trim(),key=norm(origin);
   if(!known.has(key))known.set(key,origin);
  }
  if(!known.size)known.set('','');
  for(const originGroup of known.values()){
   if(assigned.has(sourceKey(group.id,originGroup)))continue;
   sources.push({groupId:group.id,originGroup,group,events:legacy.filter(e=>norm(e.originGroup||'')===norm(originGroup)),
     students:students.filter(s=>norm(s.originGroup||'')===norm(originGroup)).length});
  }
 }
 const normalizeOrigin=(s)=>{
  const raw=norm(s.originGroup||''),base=norm(s.group.name);
  return raw.startsWith(base+' ')?raw.slice(base.length+1):raw;
 };
 const possible=new Map();
 for(const source of sources){
  const key=[source.group.level,norm(source.group.name),normalizeOrigin(source)].join('|');
  if(!possible.has(key))possible.set(key,[]);
  possible.get(key).push(source);
 }
 const cards=[];
 for(const t of (doc.tutorships||[]).filter(t=>t.course===year.name)){
  cards.push({kind:'confirmed',id:'tutor:'+t.id,name:t.name,sources:t.sources.map(s=>({
   ...s,group:doc.groups.find(g=>g.id===s.groupId)
  })).filter(s=>s.group),tutorship:t});
 }
 for(const list of possible.values()){
  const distinctSubjects=new Set(list.map(s=>s.group.subject));
  const candidate=list.length>1&&distinctSubjects.size===list.length&&
   // No sugerir un emparejamiento que solo existe por grupos vacíos sin alumnado ni cita.
   list.every(s=>s.students>0||s.events.length>0);
  if(candidate){
   const first=list[0],suffix=first.originGroup?(' · '+normalizeOrigin(first).toLocaleUpperCase('es')):'';
   cards.push({kind:'suggested',id:'suggest:'+list.map(s=>sourceKey(s.groupId,s.originGroup)).sort().join('~'),
    name:first.group.name+suffix,sources:list});
  }else{
   for(const source of list){
    cards.push({kind:'single',id:'single:'+sourceKey(source.groupId,source.originGroup),
     name:source.group.name+(source.originGroup?' · '+source.originGroup:''),sources:[source]});
   }
  }
 }
 cards.sort((a,b)=>groupSort(a,b)||(a.kind==='confirmed'?-1:b.kind==='confirmed'?1:0)||
  a.id.localeCompare(b.id));
 return cards;
}
