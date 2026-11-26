import {isoDate} from './planner.js';

export const extracurricularActivities=doc=>doc.extracurricularActivities===undefined?[]:doc.extracurricularActivities;
export const extracurricularCourseKey=group=>JSON.stringify([group.course,group.level]);
export const extracurricularStudentKey=student=>student.personId||student.id;

function validCourseKey(key){
  if(typeof key!=='string')return false;
  try{
    const parts=JSON.parse(key);
    return Array.isArray(parts)&&parts.length===2&&typeof parts[0]==='string'&&
      (parts[1]===null||typeof parts[1]==='string')&&JSON.stringify(parts)===key;
  }catch{return false;}
}

function assertActivity(activity,studentIds){
  if(typeof activity?.id!=='string'||typeof activity.name!=='string'||!activity.name.trim()||
    !Array.isArray(activity.courses)||!activity.courses.length||
    new Set(activity.courses).size!==activity.courses.length||!activity.courses.every(validCourseKey)||
    !activity.answers||typeof activity.answers!=='object'||Array.isArray(activity.answers)||
    !Object.entries(activity.answers).every(([id,answer])=>studentIds.has(id)&&typeof answer==='boolean'))
    throw new Error('Actividad extraescolar inválida.');
  isoDate(activity.date);
}

export function assertExtracurricular(doc){
  const activities=extracurricularActivities(doc);
  if(!Array.isArray(activities)||new Set(activities.map(activity=>activity?.id)).size!==activities.length)
    throw new Error('Actividades extraescolares inválidas.');
  if(!activities.length)return;
  const studentIds=new Set(doc.students.map(student=>student.id));
  for(const activity of activities)assertActivity(activity,studentIds);
}

// La matrícula se consulta en el cuaderno. Las fichas vinculadas forman una sola fila.
export function extracurricularRoster(doc,courses){
  const selected=new Set(courses);
  const groups=new Map(doc.groups.filter(group=>selected.has(extracurricularCourseKey(group))).map(group=>[group.id,group]));
  const roster=new Map();
  for(const student of doc.students){
    const group=groups.get(student.groupId);
    if(!group)continue;
    const key=extracurricularStudentKey(student);
    const current=roster.get(key);
    if(current){
      current.ids.push(student.id);
      if(!current.student.originGroup&&student.originGroup)Object.assign(current,{student,group});
    }else roster.set(key,{key,student,group,ids:[student.id]});
  }
  return [...roster.values()];
}

export function extracurricularAnswer(activity,ids){
  const answers=new Set(ids.map(id=>activity.answers[id]).filter(answer=>typeof answer==='boolean'));
  return answers.size===1?[...answers][0]:undefined;
}

export function setExtracurricularAnswer(doc,activityId,key,answer){
  const activity=extracurricularActivities(doc).find(item=>item.id===activityId);
  const row=activity&&extracurricularRoster(doc,activity.courses).find(item=>item.key===key);
  if(!row||![true,false,undefined].includes(answer))throw new Error('Participación inválida.');
  for(const id of row.ids){
    if(answer===undefined)delete activity.answers[id];
    else activity.answers[id]=answer;
  }
}
