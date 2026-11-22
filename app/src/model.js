import {ATTITUDE_2BACH_CRITERIA} from './attitude-template.js';
import {createPlanner,assertPlanner,weeklySlotCount} from './planner.js';
export const SCHEMA_VERSION = 8;
export const INDIVIDUAL_RULES = Object.freeze(['np_mean','mean','last']);
/** Nota Ítaca: aplica únicamente a la salida trimestral, no modifica las medias. */
export const ITACA_ROUNDING = Object.freeze(['half','seven','none']);
const validCategoryColumnColor = color => color===undefined||color===null||(/^#[0-9A-Fa-f]{6}$/.test(color));
export function itacaGroupRule(doc,groupId){
  return doc.groups.find(g=>g.id===groupId)?.itacaRounding??'half';
}
export function itacaStudentRule(doc,studentId,periodId){
  return doc.students.find(s=>s.id===studentId)?.itacaRoundingOverrides?.[periodId]??'general';
}
export function setItacaGroupRule(doc,groupId,rule){
  const group=doc.groups.find(g=>g.id===groupId);
  if(!group||!ITACA_ROUNDING.includes(rule))throw new Error('Regla general de Nota Ítaca inválida.');
  group.itacaRounding=rule;group.updatedAt=doc.updatedAt=now();return doc;
}
export function setItacaStudentRule(doc,studentId,periodId,rule){
  const student=doc.students.find(s=>s.id===studentId);
  if(!student||!doc.periods.some(p=>p.id===periodId)||!['general',...ITACA_ROUNDING].includes(rule))throw new Error('Excepción de Nota Ítaca inválida.');
  const overrides={...(student.itacaRoundingOverrides||{})};
  if(rule==='general')delete overrides[periodId];else overrides[periodId]=rule;
  if(Object.keys(overrides).length)student.itacaRoundingOverrides=overrides;
  else delete student.itacaRoundingOverrides;
  student.updatedAt=doc.updatedAt=now();return doc;
}
/** Colores estables y distintos por categoría. La identidad de la categoría,
 * no el nombre de cada prueba ni la puntuación, determina el color del bloque.
 * Colores anteriores personalizados siguen teniendo prioridad. */
export const DEFAULT_CATEGORY_COLUMN_COLORS=Object.freeze({
  examenes:'#C5DDF9',
  trabajos:'#FCE0B7',
  actitud:'#C9EBD1'
});
const EXTRA_CATEGORY_COLUMN_COLORS=Object.freeze(['#E1D4FA','#F9D3E7','#B9EAE8','#F7E2C7','#D8E5B9']);
const categoryColorKey=name=>String(name??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').trim();
export function categoryColumnColor(doc,categoryId){
  const category=doc?.categories?.find(c=>c.id===categoryId);
  if(!category)return null;
  if(category.columnColor)return category.columnColor;
  const key=categoryColorKey(category.name);
  if(key==='examen'||key==='examenes')return DEFAULT_CATEGORY_COLUMN_COLORS.examenes;
  if(key==='trabajo'||key==='trabajos')return DEFAULT_CATEGORY_COLUMN_COLORS.trabajos;
  if(key==='actitud')return DEFAULT_CATEGORY_COLUMN_COLORS.actitud;
  // Nombre normalizado: dos categorías personalizadas del mismo tipo reciben
  // el mismo color predeterminado, aunque pertenezcan a grupos distintos.
  let hash=0;
  for(const char of key)hash=(Math.imul(hash,31)+char.codePointAt(0))>>>0;
  return EXTRA_CATEGORY_COLUMN_COLORS[hash%EXTRA_CATEGORY_COLUMN_COLORS.length];
}
export function setCategoryColumnColor(doc,categoryId,color){
  const category=doc.categories.find(c=>c.id===categoryId);
  if(!category||!validCategoryColumnColor(color))throw new Error('Color de columna inválido.');
  if(color===null)delete category.columnColor;else category.columnColor=color.toUpperCase();
  category.updatedAt=doc.updatedAt=now();return doc;
}
/** Reglas independientes de la nota original: la corrección se aplica sobre /10. */
export const ORTHOGRAPHY_DEFAULTS = Object.freeze({enabledForExams:true,penaltyPerFault:0.1,repetitions:30,refundable:true});
export function validOrthographyConfig(config){
  return !!config&&typeof config==='object'&&!Array.isArray(config)&&typeof config.enabled==='boolean'&&
    typeof config.refundable==='boolean'&&Number.isInteger(config.repetitions)&&config.repetitions>=1&&config.repetitions<=1000&&
    Number.isFinite(config.penaltyPerFault)&&config.penaltyPerFault>=0&&config.penaltyPerFault<=10&&
    Math.abs(config.penaltyPerFault*100-Math.round(config.penaltyPerFault*100))<1e-8;
}
export function setOrthographyDefaults(doc,patch){
  if(!patch||typeof patch!=='object'||Array.isArray(patch)||
    Object.keys(patch).some(k=>!['enabledForExams','penaltyPerFault','repetitions','refundable'].includes(k)))
    throw new Error('Campo de preferencias ortográficas no permitido.');
  const current={...ORTHOGRAPHY_DEFAULTS,...doc.settings.orthographyDefaults};
  const next={...current,...patch};
  if(typeof next.enabledForExams!=='boolean'||!validOrthographyConfig({enabled:true,refundable:next.refundable,repetitions:next.repetitions,penaltyPerFault:next.penaltyPerFault}))throw new Error('Configuración de faltas inválida.');
  doc.settings.orthographyDefaults=next;doc.updatedAt=now();return next;
}

/** Preferencia por grupo de la asignatura. Se aplica a todos los exámenes
 * con penalización activa y a los nuevos, sin eliminar las faltas ya anotadas.
 * Si existe una entrega ya concedida, no se puede retirar retroactivamente. */
export function groupOrthographyRefundable(doc,groupId){
  const group=doc.groups.find(g=>g.id===groupId);
  if(!group)throw new Error('Grupo inexistente.');
  return group.orthographyRefundable??doc.settings.orthographyDefaults.refundable;
}
export function setGroupOrthographyRefundable(doc,groupId,refundable){
  const group=doc.groups.find(g=>g.id===groupId);
  if(!group||typeof refundable!=='boolean')throw new Error('Configuración de devolución por faltas inválida.');
  const targets=doc.assessments.filter(a=>a.groupId===groupId&&a.orthography?.enabled);
  if(!refundable&&targets.some(a=>doc.grades.some(grade=>grade.assessmentId===a.id&&grade.orthographyDelivered)))
    throw new Error('Hay faltas ya entregadas en este grupo. Revisa esas calificaciones antes de desactivar la devolución; no se ha modificado nada.');
  if(group.orthographyRefundable===refundable&&targets.every(a=>a.orthography.refundable===refundable))return doc;
  const stamp=now();
  group.orthographyRefundable=refundable;group.updatedAt=stamp;
  for(const a of targets){
    if(a.orthography.refundable!==refundable){
      a.orthography={...a.orthography,refundable};
      a.updatedAt=stamp;
    }
  }
  doc.updatedAt=stamp;return doc;
}

export const COURSE_SUBJECTS = Object.freeze({
  '4eso': Object.freeze({label:'4.º ESO',subjects:['Latín 4.º']}),
  '1bach': Object.freeze({label:'1.º Bachillerato',subjects:['Latín I','Griego I']}),
  '2bach': Object.freeze({label:'2.º Bachillerato',subjects:['Latín II','Griego II']})
});
// Estos valores solo se aplican por defecto. El usuario puede elegir otros colores.
export const SUBJECT_COLORS = Object.freeze({
  '4eso:Latín 4.º':'#B43F60', // granate frambuesa, distinto del ámbar de Latín I
  '1bach:Latín I':'#F59E0B', // ámbar
  '1bach:Griego I':'#0284C7', // azul celeste
  '2bach:Latín II':'#EA580C', // naranja
  '2bach:Griego II':'#1D4ED8' // azul profundo
});
// Paleta de la versión 0.2.1, para actualizar solo los valores no personalizados.
const PREVIOUS_SUBJECT_COLORS = Object.freeze({
  '4eso:Latín 4.º':'#A44E24',
  '1bach:Latín I':'#2563B0',
  '1bach:Griego I':'#6948A5',
  '2bach:Latín II':'#16765C',
  '2bach:Griego II':'#9A3D70'
});
export const subjectKey=(level,subject)=>`${level}:${subject}`;
/** Catálogo extensible almacenado dentro del mismo cuaderno cifrado.
 * Los cinco cursos del profesor permanecen como valores iniciales.
 * Las materias predeterminadas retiradas se ocultan, sin destruir datos. */
export const catalogForNotebook=doc=>Object.entries(COURSE_SUBJECTS).map(([level,entry])=>({
 level,label:entry.label,
 subjects:[
  ...entry.subjects.filter(name=>!doc?.settings?.hiddenSubjects?.includes(subjectKey(level,name))),
  ...(doc?.settings?.customSubjects||[]).filter(item=>item.level===level).map(item=>item.subject)
 ]
}));
const existingSubject=(doc,level,subject)=>catalogForNotebook(doc).some(entry=>entry.level===level&&entry.subjects.includes(subject));
const validSubjectName=subject=>typeof subject==='string'&&subject===subject.trim()&&subject.length>0&&subject.length<=65&&!/[:<>\x00-\x1f]/.test(subject);
export function addNotebookSubject(doc,level,subject,color='#64748B'){
 if(!Object.hasOwn(COURSE_SUBJECTS,level)||!validSubjectName(subject)||!/^#[0-9A-Fa-f]{6}$/.test(color))throw new Error('Etapa, nombre o color de la materia no válido.');
 if(existingSubject(doc,level,subject))throw new Error('Esa materia ya está disponible en esta etapa.');
 const key=subjectKey(level,subject);
 const settings=doc.settings;
 if(COURSE_SUBJECTS[level].subjects.includes(subject)){
  settings.hiddenSubjects=(settings.hiddenSubjects||[]).filter(item=>item!==key);
 }else{
  settings.customSubjects=[...(settings.customSubjects||[]),{level,subject}];
 }
 settings.subjectAccents[key]=color.toUpperCase();
 doc.updatedAt=now();return {level,subject};
}
export function removeNotebookSubject(doc,level,subject){
 if(!existingSubject(doc,level,subject))throw new Error('La materia no está disponible.');
 if(doc.groups.some(g=>g.level===level&&g.subject===subject))throw new Error('La materia tiene grupos: conserva sus alumnos y notas. Traslada o elimina esos grupos antes de retirarla.');
 if(catalogForNotebook(doc).reduce((n,item)=>n+item.subjects.length,0)<=1)throw new Error('El cuaderno necesita al menos una materia.');
 const key=subjectKey(level,subject),settings=doc.settings;
 if(COURSE_SUBJECTS[level].subjects.includes(subject)){
  settings.hiddenSubjects=[...(settings.hiddenSubjects||[]),key];
 }else{
  settings.customSubjects=(settings.customSubjects||[]).filter(item=>subjectKey(item.level,item.subject)!==key);
  delete settings.subjectAccents[key];
 }
 doc.updatedAt=now();
}
export const defaultSubjectAccent=(level,subject)=>SUBJECT_COLORS[subjectKey(level,subject)]||
 (level==='4eso'?'#B88641':level==='1bach'?'#397DAB':'#7657A8');
export function levelForSubject(subject){
  return Object.keys(COURSE_SUBJECTS).find(level=>COURSE_SUBJECTS[level].subjects.includes(subject))??null;
}
export function validSubject(level,subject,doc=null){return doc?existingSubject(doc,level,subject):!!COURSE_SUBJECTS[level]?.subjects.includes(subject);}
export function setSubjectAccent(doc,level,subject,color){
  const key=subjectKey(level,subject);
  if(!validSubject(level,subject,doc)||!/^#[0-9a-fA-F]{6}$/.test(color))throw new Error('Curso, asignatura o color inválidos.');
  doc.settings.subjectAccents[key]=color.toUpperCase();doc.updatedAt=now();
}
export function classifyGroup(doc,id,level,subject){
  const group=doc.groups.find(g=>g.id===id);
  if(!group||!validSubject(level,subject,doc))throw new Error('Curso o asignatura inválidos.');
  Object.assign(group,{level,subject,legacyUnclassified:false,updatedAt:now()});doc.updatedAt=now();return group;
}

export const CATEGORY_RULES = ['mean','weighted_mean','highest','best_n','last','latest_if_highest'];
const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();
const mark = (obj, date = now()) => ({ ...obj, updatedAt: date });
/** Acepta decimales castellanos; rechaza cadenas vacías, hexadecimales y notación exponencial. */
export function parseScore(value){
  if(typeof value==='number'){
    if(!Number.isFinite(value))throw new Error('Puntuación no numérica.');
    // Las rutas internas también aceptan números (no solo texto del formulario):
    // aplicarles el mismo límite que a una entrada escrita evita notas de 3 decimales.
    if(Math.abs(value*100-Math.round(value*100))>1e-8)throw new Error('Introduce una nota válida con un máximo de dos decimales.');
    return value;
  }
  if(typeof value!=='string')throw new Error('Puntuación no numérica.');
  const input=value.trim();
  if(!/^(?:\d+(?:[.,]\d{1,2})?|[.,]\d{1,2})$/.test(input))throw new Error('Introduce una nota válida con un máximo de dos decimales.');
  const parsed=Number(input.replace(',','.'));
  if(!Number.isFinite(parsed))throw new Error('Puntuación fuera de rango.');
  return parsed;
}

export function initialNotebook({empty=false}={}) {
  const group = mark({id: uid(), name: 'Latín I · A', course: '2026-2027', level:'1bach', subject: 'Latín I', createdAt: now()});
  const period = mark({id: uid(), name: '1.ª evaluación', order: 0, createdAt: now()});
  const otherPeriods = [1,2].map((order)=>mark({id:uid(),name:`${order+1}.ª evaluación`,order,createdAt:now()}));
  const e = mark({id: uid(), name: 'Exámenes', weight: 60, rule: 'latest_if_highest', bestCount:2, createdAt: now()});
  const t = mark({id: uid(), name: 'Trabajos', weight: 30, rule: 'mean', bestCount:2, createdAt: now()});
  const a = mark({id: uid(), name: 'Actitud', weight: 10, rule: 'mean', bestCount:2, createdAt: now()});
  const students = empty?[]:Array.from({length: 8}, (_,i) => mark({id: uid(), groupId:group.id, name:`Alumno ${String(i+1).padStart(2,'0')}`, order:i, createdAt: now()}));
  const assessments = empty?[]:[
    {name:'Examen UD1',categoryId:e.id,maxScore:10,weight:1,convertToTen:true,rubricId:null,order:0},
    {name:'Examen UD2',categoryId:e.id,maxScore:10,weight:1,convertToTen:true,rubricId:null,order:1},
    {name:'Trabajo 1',categoryId:t.id,maxScore:10,weight:1,convertToTen:true,rubricId:null,order:2},
    {name:'Actitud',categoryId:a.id,maxScore:10,weight:1,convertToTen:true,rubricId:null,order:3}
  ].map(x => mark({...x,id:uid(),groupId:group.id,periodId:period.id,createdAt: now()}));
  const matrix = [
    [6.5,8,7.5,9],[8,7,9,8],[4,6.5,7,8],[9,9.5,8,10],
    [5,6,8,7],[7,6,7.5,8],[8.5,8.5,9,9],[3,5,6,7]
  ];
  const grades = students.flatMap((s,i)=>assessments.map((p,j)=>mark({id:uid(),studentId:s.id,assessmentId:p.id,score:matrix[i][j],createdAt:now()})));
  const competencies = empty?[]:[mark({id:uid(),name:'CE1 · Interpretación de textos',links:[{categoryId:e.id,weight:70},{categoryId:t.id,weight:30}],createdAt:now()})];
  return {schemaVersion:SCHEMA_VERSION,tutorships:[],evaluationArchive:[],planner:createPlanner(group.course),gradingProfiles:[],individualCategoryRules:[],rubrics:[],finalConfigs:[],finalOverrides:[],id:uid(),title:'CuadernoDocente',createdAt:now(),updatedAt:now(),settings:{decimals:2,rounding:'half-up',orthographyDefaults:{...ORTHOGRAPHY_DEFAULTS},subjectAccents:{...SUBJECT_COLORS},customSubjects:[],hiddenSubjects:[]},groups:empty?[]:[group],periods:[period,...otherPeriods],categories:[e,t,a],students,assessments,grades,gradeObservations:[],competencies};
}

/** Cuaderno sin datos de demostración: conserva solo tres evaluaciones y categorías base. */
export function emptyNotebook(){return initialNotebook({empty:true});}

export function assertModel(doc) {
  if (!doc || doc.schemaVersion !== SCHEMA_VERSION) throw new Error('Versión de datos incompatible. No se ha modificado el cuaderno.');
  for (const key of ['groups','periods','categories','students','assessments','grades','competencies','rubrics','finalConfigs','finalOverrides','individualCategoryRules']) {
    if (!Array.isArray(doc[key])) throw new Error(`Modelo inválido: falta ${key}.`);
    const ids = doc[key].map(x=>x.id);
    if(ids.some(x=>typeof x!=='string') || new Set(ids).size!==ids.length) throw new Error(`Identificadores duplicados o inválidos en ${key}.`);
  }
  if(!Array.isArray(doc.gradingProfiles))throw new Error('Faltan perfiles de evaluación.');
  if(!doc.groups.every(g=>g.weeklyHours===undefined||(Number.isInteger(g.weeklyHours)&&g.weeklyHours>=1&&g.weeklyHours<=30)))throw new Error('Horas semanales del grupo inválidas.');
  assertPlanner(doc);
  if(!doc.groups.every(g=>(g.itacaRounding===undefined||ITACA_ROUNDING.includes(g.itacaRounding))))throw new Error('Regla general de Nota Ítaca inválida.');
  if(!doc.groups.every(g=>g.orthographyRefundable===undefined||typeof g.orthographyRefundable==='boolean'))throw new Error('Regla de devolución por faltas del grupo inválida.');
  if(!doc.students.every(s=>s.itacaRoundingOverrides===undefined||(
    s.itacaRoundingOverrides&&typeof s.itacaRoundingOverrides==='object'&&!Array.isArray(s.itacaRoundingOverrides)&&
    Object.entries(s.itacaRoundingOverrides).every(([periodId,rule])=>doc.periods.some(p=>p.id===periodId)&&ITACA_ROUNDING.includes(rule))
  )))throw new Error('Excepciones individuales de Nota Ítaca inválidas.');
  if(!doc.groups.every(g=>(g.hiddenCategoryIds===undefined||(Array.isArray(g.hiddenCategoryIds)&&new Set(g.hiddenCategoryIds).size===g.hiddenCategoryIds.length&&g.hiddenCategoryIds.every(id=>doc.categories.some(c=>c.id===id)&&!doc.assessments.some(a=>a.groupId===g.id&&a.categoryId===id))))&&typeof g.name==='string'&&typeof g.course==='string'&&(
    validSubject(g.level,g.subject,doc) || (g.level===null&&g.legacyUnclassified===true&&typeof g.subject==='string')
  )))throw new Error('Grupo con curso o asignatura inválidos.');
  if(!doc.settings||!doc.settings.subjectAccents||Object.keys(SUBJECT_COLORS).some(k=>!/^#[0-9A-Fa-f]{6}$/.test(doc.settings.subjectAccents[k]??'')))throw new Error('Colores de asignatura inválidos.');
 const custom=doc.settings.customSubjects||[],hidden=doc.settings.hiddenSubjects||[];
 if(!Array.isArray(custom)||custom.length>100||custom.some(x=>!x||!Object.hasOwn(COURSE_SUBJECTS,x.level)||!validSubjectName(x.subject)||COURSE_SUBJECTS[x.level].subjects.includes(x.subject))||
    new Set(custom.map(x=>subjectKey(x.level,x.subject))).size!==custom.length||
    !Array.isArray(hidden)||hidden.some(x=>!Object.hasOwn(SUBJECT_COLORS,x))||new Set(hidden).size!==hidden.length||
    catalogForNotebook(doc).every(entry=>!entry.subjects.length))throw new Error('Catálogo de materias inválido.');
 const subjectKeys=new Set([...Object.keys(SUBJECT_COLORS),...custom.map(x=>subjectKey(x.level,x.subject))]);
 if(Object.entries(doc.settings.subjectAccents).some(([key,color])=>!subjectKeys.has(key)||!/^#[0-9A-Fa-f]{6}$/.test(color))||
    custom.some(x=>!/^#[0-9A-Fa-f]{6}$/.test(doc.settings.subjectAccents[subjectKey(x.level,x.subject)]??'')))
  throw new Error('Colores de asignatura inválidos.');
  if(!doc.settings || !Number.isInteger(doc.settings.decimals) || doc.settings.decimals<0 || doc.settings.decimals>3 || !['half-up','floor','ceil'].includes(doc.settings.rounding))throw new Error('Configuración de redondeo inválida.');
  const od=doc.settings.orthographyDefaults;
  if(!od||typeof od.enabledForExams!=='boolean'||!validOrthographyConfig({...od,enabled:true}))throw new Error('Preferencias ortográficas inválidas.');
  const has = key => new Set(doc[key].map(x=>x.id));
  const gs = has('groups'), ps = has('periods'), cs = has('categories'), ss=has('students'), as=has('assessments'), rs=has('rubrics');
  if(doc.students.some(x=>!gs.has(x.groupId))) throw new Error('Estudiante sin grupo válido.');
  // Vínculos de identidad opcionales: copias v8 antiguas siguen siendo válidas.
  if(doc.students.some(s=>s.personId!==undefined&&(typeof s.personId!=='string'||!/^[a-f0-9-]{36}$/i.test(s.personId))))
    throw new Error('Identidad compartida de alumno inválida.');
  const identityGroups=new Set();
  for(const s of doc.students.filter(s=>s.personId)){
    const key=s.personId+'|'+s.groupId;
    if(identityGroups.has(key))throw new Error('La misma identidad aparece dos veces en una asignatura.');
    identityGroups.add(key);
  }
  // El cotejo no depende de tildes, puntos de ordinales ni de «Bachillerato/BACH»:
  // la validación debe aceptar las mismas equivalencias que el vinculador.
  const canonicalTutoringName=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLocaleLowerCase('es').replace(/bachillerato/g,'bach').replace(/1\.?[º°ª]/g,'1').replace(/2\.?[º°ª]/g,'2')
    .replace(/[^a-z0-9]+/g,' ').trim().replace(/([12])bach/g,'$1 bach').replace(/\s+/g,' ');
  const shared=new Map();
  for(const s of doc.students.filter(s=>s.personId)){
    const g=doc.groups.find(g=>g.id===s.groupId);
    const prev=shared.get(s.personId);
    if(prev&&(prev.course!==g.course||prev.level!==g.level||
      prev.origin&&s.originGroup&&canonicalTutoringName(prev.origin)!==canonicalTutoringName(s.originGroup)))
      throw new Error('Identidad vinculada a cursos o tutorías incompatibles.');
    shared.set(s.personId,{course:g.course,level:g.level,origin:prev?.origin||s.originGroup||''});
  }
  if(doc.tutorships!==undefined){
    if(!Array.isArray(doc.tutorships)||new Set(doc.tutorships.map(t=>t.id)).size!==doc.tutorships.length)
      throw new Error('Tutorías compartidas inválidas.');
    const used=new Set();
    for(const t of doc.tutorships){
      if(!t||typeof t.id!=='string'||typeof t.name!=='string'||!t.name.trim()||
       t.name.length>100||typeof t.course!=='string'||!Array.isArray(t.sources)||!t.sources.length||t.sources.length>80)
        throw new Error('Tutoría compartida incompleta.');
      for(const source of t.sources){
        const g=doc.groups.find(g=>g.id===source?.groupId);
        if(!g||g.course!==t.course||g.level!==t.level||typeof source.originGroup!=='string'||source.originGroup.length>60)
         throw new Error('Procedencia de tutoría incompatible.');
        const key=g.id+'|'+canonicalTutoringName(source.originGroup);
        if(used.has(key))throw new Error('Procedencia vinculada a varias tutorías.');
        used.add(key);
      }
    }
  }
  if(doc.evaluationArchive!==undefined){
    if(!Array.isArray(doc.evaluationArchive)||new Set(doc.evaluationArchive.map(a=>a.event?.id)).size!==doc.evaluationArchive.length||
      doc.evaluationArchive.some(a=>!a?.tutorshipId||!doc.tutorships?.some(t=>t.id===a.tutorshipId)||
        !a.event||a.event.type!=='evaluation'||typeof a.academicYear!=='string'))
       throw new Error('Archivo histórico de convocatorias inválido.');
  }
  if(doc.students.some(student=>{
    if(typeof student.name!=='string'||!student.name.trim())return true; // Un registro histórico podía superar 150 caracteres; no bloquear su lectura.
    if(student.originGroup!==undefined&&(typeof student.originGroup!=='string'||student.originGroup.length>60))return true;
    const hasFirst=student.firstName!==undefined,hasLast=student.lastName!==undefined;
    if(hasFirst!==hasLast)return true;
    if(hasFirst){
      if(typeof student.firstName!=='string'||typeof student.lastName!=='string'||!student.firstName.trim()||!student.lastName.trim()||
        student.firstName!==student.firstName.trim()||student.lastName!==student.lastName.trim()||
        student.firstName.length>80||student.lastName.length>100||
        student.name!==`${student.lastName}, ${student.firstName}`)return true;
    }
    return false;
  }))throw new Error('Identidad o grupo de procedencia de alumno inválidos.');
  if(doc.assessments.some(x=>!gs.has(x.groupId)||!ps.has(x.periodId)||!cs.has(x.categoryId)||!Number.isFinite(x.maxScore)||!(x.maxScore>0)||!Number.isFinite(x.weight)||!(x.weight>0)||x.weight>1000||x.maxScore>1000||!Number.isInteger(x.order)||x.order<0||typeof x.convertToTen!=='boolean'||(x.rubricId!==null&&x.rubricId!==undefined&&(!rs.has(x.rubricId)||x.maxScore!==10||!x.convertToTen)))) throw new Error('Actividad con referencia, escala o ponderación inválida.');
  for(const a of doc.assessments){
    if(a.orthography!==undefined&&a.orthography!==null){
      if(!validOrthographyConfig(a.orthography)||a.orthography.enabled&&(a.rubricId||!a.convertToTen))throw new Error('Configuración de faltas incompatible con la actividad.');
    }
  }
  for(const a of doc.assessments.filter(a=>a.recoveryOf)){
    const original=doc.assessments.find(x=>x.id===a.recoveryOf);
    if(!original || original.recoveryOf || original.groupId!==a.groupId || original.periodId!==a.periodId || original.categoryId!==a.categoryId || !['higher','replace'].includes(a.recoveryMode))throw new Error('Referencia de recuperación inválida.');
    if(doc.assessments.filter(x=>x.recoveryOf===a.recoveryOf).length>1)throw new Error('Solo se admite una recuperación por actividad.');
  }
  if(doc.categories.some(x=>(x.ownerGroupId!==undefined&&!gs.has(x.ownerGroupId))||!Number.isFinite(x.weight)||x.weight<0||x.weight>100||!CATEGORY_RULES.includes(x.rule) || !validBestCount(x.bestCount??2) || !validCategoryColumnColor(x.columnColor))) throw new Error('Categoría inválida.');
  if(doc.assessments.some(a=>!categoryAvailableForGroup(doc,a.groupId,a.categoryId)))throw new Error('Actividad en categoría no disponible para su grupo.');
  const profileKeys = new Set();
  for(const profile of doc.gradingProfiles){
    if(!profile || typeof profile.id!=='string' || !gs.has(profile.groupId) || !ps.has(profile.periodId) || !Array.isArray(profile.overrides)) throw new Error('Perfil de evaluación inválido.');
    const key=profile.groupId+'|'+profile.periodId;
    if(profileKeys.has(key)) throw new Error('Perfil de evaluación duplicado.');
    profileKeys.add(key);
    const categoriesSeen=new Set();
    for(const o of profile.overrides){
      if(!cs.has(o.categoryId)||categoriesSeen.has(o.categoryId)||!Number.isFinite(o.weight)||o.weight<0||o.weight>100||!CATEGORY_RULES.includes(o.rule)||!validBestCount(o.bestCount))throw new Error('Regla de periodo inválida.');
      categoriesSeen.add(o.categoryId);
    }
  }
  const individualKeys=new Set();
  for(const rule of doc.individualCategoryRules){
    const student=doc.students.find(s=>s.id===rule.studentId);
    const key=rule.studentId+'|'+rule.categoryId+'|'+rule.periodId;
    if(!student||!ps.has(rule.periodId)||!categoryAvailableForGroup(doc,student.groupId,rule.categoryId)||
       !INDIVIDUAL_RULES.includes(rule.rule)||individualKeys.has(key))
      throw new Error('Excepción de cálculo individual inválida.');
    individualKeys.add(key);
  }
  const seen = new Set();
  for(const x of doc.grades){
    const assessment=doc.assessments.find(a=>a.id===x.assessmentId);
    const student=doc.students.find(s=>s.id===x.studentId);
    if(!ss.has(x.studentId)||!as.has(x.assessmentId)||!assessment||!student||student.groupId!==assessment.groupId||!Number.isFinite(x.score)||x.score<0||x.score>assessment.maxScore) throw new Error('Calificación inválida o fuera de escala.');
    if(x.notSubmitted!==undefined&&(x.notSubmitted!==true||x.score!==0||x.pendingJustified||x.rubricRatings!==undefined||x.orthographyFaults!==undefined||x.orthographyDelivered!==undefined))throw new Error('Calificación «No presentado» inconsistente.');
    if(x.pendingJustified!==undefined&&x.pendingJustified!==true)throw new Error('Estado de ausencia justificada inválido.');
    if(x.pendingPlaceholder!==undefined&&(!x.pendingJustified||x.pendingPlaceholder!==true||x.score!==0||x.rubricRatings!==undefined||x.orthographyFaults!==undefined||x.orthographyDelivered!==undefined))throw new Error('Ausencia justificada sin nota inconsistente.');
    if(x.pendingWasNotSubmitted!==undefined&&(x.pendingWasNotSubmitted!==true||!x.pendingJustified||!x.pendingPlaceholder||x.notSubmitted||x.score!==0))
      throw new Error('Ausencia justificada con NP anterior inconsistente.');
    if(!x.notSubmitted&&!x.pendingPlaceholder&&assessment.rubricId){const rubric=doc.rubrics.find(r=>r.id===assessment.rubricId);if(!Array.isArray(x.rubricRatings)||x.rubricRatings.length!==rubric.criteria.length||new Set(x.rubricRatings.map(r=>r.criterionId)).size!==rubric.criteria.length||rubric.criteria.some(c=>!x.rubricRatings.some(r=>r.criterionId===c.id&&Number.isFinite(r.score)&&r.score>=0&&r.score<=c.maxScore&&(!c.levels||c.levels.some(l=>l.score===r.score))))||!consistentRubricScore(rubric,x))throw new Error('Calificación de rúbrica inconsistente.');}
    else if(x.rubricRatings!==undefined&&!assessment.rubricId)throw new Error('Calificación de rúbrica sin actividad correspondiente.');
    if(x.orthographyFaults!==undefined&&(!Number.isInteger(x.orthographyFaults)||x.orthographyFaults<0||x.orthographyFaults>1000||assessment.rubricId))throw new Error('Número de faltas inválido.');
    if(x.orthographyDelivered!==undefined&&(typeof x.orthographyDelivered!=='boolean'||assessment.rubricId||x.orthographyDelivered&&(!x.orthographyFaults||!assessment.orthography?.refundable)))throw new Error('Entrega de faltas inválida.');
    const k=x.studentId+'|'+x.assessmentId;
    if(seen.has(k)) throw new Error('Calificación duplicada.');
    seen.add(k);
  }
  // Opcional para poder abrir cuadernos antiguos del mismo schemaVersion=8.
  // Las observaciones son anotaciones, nunca calificaciones ni evidencias.
  if(doc.gradeObservations!==undefined){
    if(!Array.isArray(doc.gradeObservations))throw new Error('Formato de observaciones inválido.');
    const observationPairs=new Set(),observationIds=new Set();
    for(const note of doc.gradeObservations){
      const student=doc.students.find(s=>s.id===note?.studentId);
      const assessment=doc.assessments.find(a=>a.id===note?.assessmentId);
      const key=note?.studentId+'|'+note?.assessmentId;
      if(!student||!assessment||student.groupId!==assessment.groupId||
         typeof note.id!=='string'||!note.id||observationIds.has(note.id)||
         observationPairs.has(key)||typeof note.text!=='string'||!note.text.trim()||
         note.text!==note.text.trim()||note.text.length>1500||
         typeof note.visibleToStudent!=='boolean')
        throw new Error('Observación de calificación inválida o duplicada.');
      observationPairs.add(key);observationIds.add(note.id);
    }
  }
  for(const c of doc.competencies){
    if(c.groupId!==undefined&&!gs.has(c.groupId))throw new Error('Competencia con grupo inexistente.');
    if(c.curriculumKey!==undefined&&(typeof c.curriculumKey!=='string'||c.curriculumKey.length>70))throw new Error('Código competencial inválido.');
    if(!Array.isArray(c.links) || c.links.some(l=>!cs.has(l.categoryId)||!Number.isFinite(l.weight)||l.weight<=0||l.weight>1000)) throw new Error('Vínculo competencial inválido.');
    if(new Set(c.links.map(l=>l.categoryId)).size!==c.links.length) throw new Error('Vínculo competencial duplicado.');
  }
  for(const r of doc.rubrics){if(typeof r.name!=='string'||!r.name.trim())throw new Error('Rúbrica sin nombre.');validateCriteria(r.criteria);}
  const cfgGroups=new Set();
  for(const c of doc.finalConfigs){
    if(!gs.has(c.groupId)||cfgGroups.has(c.groupId)||!['mean','weighted_mean','latest_if_highest'].includes(c.rule)||!Array.isArray(c.excludedPeriodIds)||new Set(c.excludedPeriodIds).size!==c.excludedPeriodIds.length||c.excludedPeriodIds.some(id=>!ps.has(id))||typeof c.weights!=='object'||c.weights===null||Array.isArray(c.weights)||Object.entries(c.weights).some(([k,v])=>!ps.has(k)||!Number.isFinite(v)||v<0||v>1000))throw new Error('Configuración final inválida.');
    cfgGroups.add(c.groupId);
  }
  const overridden=new Set();
  for(const o of doc.finalOverrides){
    const st=doc.students.find(s=>s.id===o.studentId);
    if(!st||!ps.has(o.periodId)||!Number.isFinite(o.score)||o.score<0||o.score>10||overridden.has(o.studentId+'|'+o.periodId))throw new Error('Nota manual de periodo inválida.');
    overridden.add(o.studentId+'|'+o.periodId);
  }
  return true;
}

export function validateCriteria(criteria){
  if(!Array.isArray(criteria)||!criteria.length||criteria.length>40)throw new Error('La rúbrica requiere entre 1 y 40 criterios.');
  const ids=new Set();
  for(const c of criteria){
    if(typeof c.id!=='string'||!c.id||ids.has(c.id)||typeof c.name!=='string'||!c.name.trim()||!Number.isFinite(c.maxScore)||c.maxScore<=0||c.maxScore>1000||!Number.isFinite(c.weight)||c.weight<=0||c.weight>1000)throw new Error('Criterio de rúbrica inválido.');
    if(c.levels!==undefined){
      if(!Array.isArray(c.levels)||!c.levels.length||c.levels.length>20||new Set(c.levels.map(l=>l.score)).size!==c.levels.length||!c.levels.some(l=>l.score===c.maxScore))throw new Error('Niveles de rúbrica inválidos.');
      for(const l of c.levels){
        if(!Number.isFinite(l.score)||l.score<0||l.score>c.maxScore||typeof l.label!=='string'||!l.label.trim()||l.label.length>100||typeof l.description!=='string'||l.description.length>2000)throw new Error('Descriptor de rúbrica inválido.');
      }
    }
    ids.add(c.id);
  }
}
/** Las calificaciones de cada criterio admiten como máximo dos decimales.
 * Validar SOLO al crear/editar una rúbrica, sin invalidar copias antiguas
 * que el usuario deba poder abrir y revisar antes de corregirlas. */
export function validateRubricInputPrecision(criteria){
  for(const criterion of criteria){
    for(const score of [criterion.maxScore,...(criterion.levels??[]).map(level=>level.score)]){
      if(!Number.isFinite(score)||Math.abs(score*100-Math.round(score*100))>1e-8)
        throw new Error('Los máximos y niveles de puntuación de una rúbrica deben tener como máximo dos decimales.');
    }
  }
}
export function rubricGradeFromRatings(rubric,ratings){
  const maxWeight=Math.max(...rubric.criteria.map(c=>c.weight));
  let sum=0,weight=0;
  for(const criterion of rubric.criteria){
    const scaled=criterion.weight/maxWeight;
    const score=ratings.find(r=>r.criterionId===criterion.id)?.score;
    sum+=((score/criterion.maxScore)*10)*scaled;
    weight+=scaled;
  }
  return Math.min(10,sum/weight);
}

function consistentRubricScore(rubric,grade){
  if(Math.abs(grade.score-rubricGradeFromRatings(rubric,grade.rubricRatings))<=1e-7)return true;
  let sum=0,weight=0;
  for(const criterion of rubric.criteria){
    const rating=grade.rubricRatings.find(r=>r.criterionId===criterion.id);
    sum+=(rating.score/criterion.maxScore)*criterion.weight;
    weight+=criterion.weight;
  }
  return Math.abs(grade.score-(10*sum)/weight)<=1e-7;
}

export function recordedScore(doc,assessment,grade){
  if(grade.pendingJustified)return null;
  if(grade.notSubmitted)return 0;
  if(!assessment.rubricId)return grade.score;
  const rubric=doc.rubrics.find(r=>r.id===assessment.rubricId);
  return rubricGradeFromRatings(rubric,grade.rubricRatings);
}

const validBestCount=n=>Number.isInteger(n)&&n>=1&&n<=100;
export function migrateNotebook(input){
  if(input?.schemaVersion===SCHEMA_VERSION){
    // Solo cambia el antiguo color PREDETERMINADO de Latín 4.º.
    // Los colores distintos, elegidos por el docente, permanecen intactos.
    const previous=input.settings?.subjectAccents?.['4eso:Latín 4.º'];
    const updateDefault=typeof previous==='string'&&previous.toUpperCase()==='#EAB308';
    if(!input.planner||updateDefault){
      const doc=structuredClone(input);
      if(!doc.planner)doc.planner=createPlanner(doc.groups?.[0]?.course);
      if(updateDefault)doc.settings.subjectAccents['4eso:Latín 4.º']=SUBJECT_COLORS['4eso:Latín 4.º'];
      assertModel(doc);return {doc,migrated:true};
    }
    assertModel(input);return {doc:input,migrated:false};
  }
  if([5,6,7].includes(input?.schemaVersion)){
    const doc=structuredClone(input);
    if(input.schemaVersion===5)doc.settings.orthographyDefaults={...ORTHOGRAPHY_DEFAULTS};
    if(!doc.planner)doc.planner=createPlanner(doc.groups?.[0]?.course);
    doc.schemaVersion=SCHEMA_VERSION;
    doc.individualCategoryRules=[];
    assertModel(doc);
    return {doc,migrated:true};
  }
  if(![1,2,3,4].includes(input?.schemaVersion))throw new Error('Versión de datos incompatible. No se ha modificado el cuaderno.');
  const doc=structuredClone(input);
  if(doc.schemaVersion===1){
    doc.gradingProfiles=[];
    doc.categories.forEach(c=>{c.bestCount=2;});
    doc.assessments.forEach(a=>{a.weight=1;});
  }
  if(doc.schemaVersion===1 || doc.schemaVersion===2){
    // v0.1/v0.2 guardaban en `course` el año escolar. Se preserva íntegro.
    for(const g of doc.groups){
      const level=levelForSubject(g.subject);
      g.level=level;
      if(!level)g.legacyUnclassified=true;
    }
    doc.settings.subjectAccents={...SUBJECT_COLORS};
  }else if(doc.schemaVersion===3){
    // v0.2.1 guarda explícitamente los acentos predeterminados de entonces.
    // No distingue un valor anterior sin personalizar de otro elegido idéntico.
    // Solo se actualizan los valores que coinciden con el antiguo predeterminado.
    const saved=doc.settings.subjectAccents || {};
    doc.settings.subjectAccents=Object.fromEntries(Object.entries(SUBJECT_COLORS).map(([key,latest])=>[
      key,typeof saved[key]==='string' && saved[key].toUpperCase()!==PREVIOUS_SUBJECT_COLORS[key]
        ? saved[key] : latest
    ]));
  }
  doc.rubrics=[];doc.finalConfigs=[];doc.finalOverrides=[];
  doc.assessments.forEach(a=>{a.convertToTen=true;a.rubricId=null;});
  doc.schemaVersion=SCHEMA_VERSION;
  doc.individualCategoryRules=[];
  doc.settings.orthographyDefaults={...ORTHOGRAPHY_DEFAULTS};
  doc.planner=createPlanner(doc.groups?.[0]?.course);
  assertModel(doc);
  return {doc,migrated:true};
}
/** Las categorías antiguas son compartidas. Las nuevas pueden pertenecer a un grupo,
 * y cada grupo puede ocultar una categoría compartida sin modificar otros grupos. */
export function availableCategories(doc,groupId){
  const hidden=doc.groups.find(g=>g.id===groupId)?.hiddenCategoryIds||[];
  return doc.categories.filter(c=>(!c.ownerGroupId||c.ownerGroupId===groupId)&&!hidden.includes(c.id));
}
export const categoryAvailableForGroup=(doc,groupId,categoryId)=>availableCategories(doc,groupId).some(c=>c.id===categoryId);
export function effectiveCategories(doc,groupId,periodId){
  const profile=doc.gradingProfiles.find(p=>p.groupId===groupId&&p.periodId===periodId);
  return availableCategories(doc,groupId).map(c=>({...c,...profile?.overrides.find(o=>o.categoryId===c.id)}));
}
/** Reglas excepcionales; la ausencia de registro conserva la regla general. */
export function individualCategoryRule(doc,studentId,categoryId,periodId){
  return doc.individualCategoryRules.find(r=>r.studentId===studentId&&r.categoryId===categoryId&&r.periodId===periodId)?.rule??'general';
}
export function setIndividualCategoryRule(doc,studentId,categoryId,periodId,rule){
  const student=doc.students.find(s=>s.id===studentId);
  if(!student||!doc.periods.some(p=>p.id===periodId)||!categoryAvailableForGroup(doc,student.groupId,categoryId)||
     !['general',...INDIVIDUAL_RULES].includes(rule))throw new Error('Regla individual, alumno, categoría o evaluación inválidos.');
  const index=doc.individualCategoryRules.findIndex(r=>r.studentId===studentId&&r.categoryId===categoryId&&r.periodId===periodId);
  if(rule==='general'){
    if(index<0)return doc;
    doc.individualCategoryRules.splice(index,1);
  }else if(index>=0){
    if(doc.individualCategoryRules[index].rule===rule)return doc;
    doc.individualCategoryRules[index]={...doc.individualCategoryRules[index],rule,updatedAt:now()};
  }else doc.individualCategoryRules.push(mark({id:uid(),studentId,categoryId,periodId,rule,createdAt:now()}));
  doc.updatedAt=now();return doc;
}

export function setPeriodCategory(doc,groupId,periodId,categoryId,patch){
  if(!doc.groups.some(g=>g.id===groupId)||!doc.periods.some(p=>p.id===periodId))throw new Error('Grupo o periodo inexistente.');
  const base=doc.categories.find(c=>c.id===categoryId);
  if(!base||!categoryAvailableForGroup(doc,groupId,categoryId))throw new Error('Categoría no disponible para este grupo.');
  // Los identificadores son inmutables. Un parche de interfaz no puede
  // convertir una regla de un periodo en una regla de otra categoría.
  if(!patch||typeof patch!=='object'||Array.isArray(patch)||Object.keys(patch).some(k=>!['weight','rule','bestCount'].includes(k)))
    throw new Error('Campo de categoría no permitido.');
  const next={categoryId,weight:base.weight,rule:base.rule,bestCount:base.bestCount??2,
    ...(doc.gradingProfiles.find(x=>x.groupId===groupId&&x.periodId===periodId)?.overrides.find(x=>x.categoryId===categoryId)||{}),...patch};
  if(!Number.isFinite(next.weight)||next.weight<0||next.weight>100||!CATEGORY_RULES.includes(next.rule)||!validBestCount(next.bestCount))throw new Error('Regla o porcentaje inválidos.');
  let profile=doc.gradingProfiles.find(x=>x.groupId===groupId&&x.periodId===periodId);
  if(!profile){profile=mark({id:uid(),groupId,periodId,overrides:[],createdAt:now()});doc.gradingProfiles.push(profile);}
  profile.overrides=profile.overrides.filter(x=>x.categoryId!==categoryId);
  profile.overrides.push(next);
  profile.updatedAt=doc.updatedAt=now();
  return next;
}
export function resetPeriodCategories(doc,groupId,periodId){
  doc.gradingProfiles=doc.gradingProfiles.filter(x=>x.groupId!==groupId||x.periodId!==periodId);
  doc.updatedAt=now();
}
export function copyPeriodCategories(doc,groupId,sourcePeriodId,targetPeriodId){
  if(sourcePeriodId===targetPeriodId)throw new Error('Selecciona otro periodo.');
  if(!doc.groups.some(g=>g.id===groupId)||!doc.periods.some(p=>p.id===sourcePeriodId)||!doc.periods.some(p=>p.id===targetPeriodId))
    throw new Error('Grupo o periodo de origen o destino inexistente.');
  for(const c of effectiveCategories(doc,groupId,sourcePeriodId))setPeriodCategory(doc,groupId,targetPeriodId,c.id,{weight:c.weight,rule:c.rule,bestCount:c.bestCount??2});
}
export function addGroup(doc,name,subject='Latín I',course='2026-2027',level=levelForSubject(subject),weeklyHours=null){
  const n=name.trim();
  if(!n||!validSubject(level,subject,doc)||!course?.trim())throw new Error('Introduce grupo, curso y una asignatura compatible.');
  const weekly=weeklyHours===null||weeklyHours===''?null:Number(weeklyHours);
  if(weekly!==null&&(!Number.isInteger(weekly)||weekly<1||weekly>30))
    throw new Error('Las horas semanales deben estar entre 1 y 30.');
  doc.groups.push(mark({id:uid(),name:n,subject,level,course:course.trim(),...(weekly!==null?{weeklyHours:weekly}:{}),createdAt:now()}));doc.updatedAt=now();
  const group=doc.groups.at(-1);
  if(level==='2bach'&&['Latín II','Griego II'].includes(subject))configureSecondBachGroup(doc,group);
  return group;
}
/** Plantilla editable de 2.º Bachillerato; no añade notas ni afecta a otros grupos. */
function configureSecondBachGroup(doc,group){
  if(doc.periods.length===1&&doc.periods[0].name==='1.ª evaluación'){
    addPeriod(doc,'2.ª evaluación');addPeriod(doc,'3.ª evaluación');
  }
  const category=(name)=>doc.categories.find(c=>c.name===name&&!c.ownerGroupId)||addCategory(doc,name,0);
  const exams=category('Exámenes'),attitude=category('Actitud');
  const special=category(group.subject==='Latín II'?'Literatura':'Cultura');
  for(const c of availableCategories(doc,group.id)){
    const weight=c.id===exams.id?60:c.id===special.id?30:c.id===attitude.id?10:0;
    setPeriodCategory(doc,group.id,doc.periods[0].id,c.id,{weight,rule:c.id===exams.id?'weighted_mean':'mean',bestCount:2});
  }
  let rubric=doc.rubrics.find(r=>r.name==='Actitud · 2.º Bachillerato');
  if(!rubric)rubric=createRubric(doc,'Actitud · 2.º Bachillerato',ATTITUDE_2BACH_CRITERIA);
  for(const [name,cat,rubricId] of [
    ['Examen parcial',exams,null],['Examen final',exams,null],
    [group.subject==='Latín II'?'Literatura':'Cultura',special,null],
    ['Actitud',attitude,rubric.id]
  ])addAssessment(doc,{name,groupId:group.id,periodId:doc.periods[0].id,categoryId:cat.id,rubricId,maxScore:10,convertToTen:true,weight:1});
}
export function addPeriod(doc,name){
  if(!name.trim())throw new Error('Introduce un nombre de periodo.');
  doc.periods.push(mark({id:uid(),name:name.trim(),order:doc.periods.length,createdAt:now()})); doc.updatedAt=now();
  return doc.periods.at(-1);
}
/** El grupo de procedencia identifica la tutoría/clase, NO el grupo de la asignatura.
 * Mantener name por compatibilidad con cálculos, importaciones y copias anteriores.
 * No se intenta separar automáticamente un nombre histórico desconocido. */
export function studentIdentity(input){
  if(typeof input==='string'){
    const name=input.trim();
    if(!name||name.length>150)throw new Error('Nombre o código de alumno inválido.');
    return {name};
  }
  if(!input||typeof input!=='object'||Array.isArray(input)||
    Object.keys(input).some(key=>!['firstName','lastName','originGroup','name'].includes(key)))
    throw new Error('Datos de alumno inválidos.');
  if(['originGroup','firstName','lastName','name'].some(key=>input[key]!==undefined&&typeof input[key]!=='string'))
    throw new Error('Los campos de alumno deben ser texto.');
  const originGroup=String(input.originGroup??'').trim();
  if(originGroup.length>60)throw new Error('La etiqueta del grupo supera 60 caracteres.');
  const firstName=String(input.firstName??'').trim(),lastName=String(input.lastName??'').trim();
  if(firstName||lastName||Object.hasOwn(input,'firstName')||Object.hasOwn(input,'lastName')){
    if(!firstName||!lastName||firstName.length>80||lastName.length>100||`${lastName}, ${firstName}`.length>150)
      throw new Error('Introduce nombre y apellidos válidos (máximo 150 caracteres en total).');
    return {name:`${lastName}, ${firstName}`,firstName,lastName,originGroup};
  }
  const name=String(input.name??'').trim();
  if(!name||name.length>150)throw new Error('Nombre o código de alumno inválido.');
  return {name,originGroup};
}
export const STUDENT_SORT_MODES=Object.freeze(['surname','firstName','originGroup','manual']);

/** El modo alumno puede ordenar las actividades de cada evaluación sin mover
 * columnas ni cambiar la estructura docente del cuaderno. */
export const STUDENT_ACTIVITY_SORT_MODES=Object.freeze(['category','column','alphabetical','reverse']);
export function sortStudentPeriodActivities(doc,groupId,periodId,mode='category'){
  if(!STUDENT_ACTIVITY_SORT_MODES.includes(mode))throw new Error('Orden de actividades del alumno inválido.');
  const categories=availableCategories(doc,groupId);
  const positions=new Map(categories.map((c,i)=>[c.id,i]));
  const collator=new Intl.Collator('es',{numeric:true,sensitivity:'base'});
  return doc.assessments.filter(a=>a.groupId===groupId&&a.periodId===periodId).sort((a,b)=>{
    if(mode==='category'){
      const left=positions.get(a.categoryId)??Number.MAX_SAFE_INTEGER;
      const right=positions.get(b.categoryId)??Number.MAX_SAFE_INTEGER;
      if(left!==right)return left-right;
    }
    if(mode==='alphabetical'){
      const name=collator.compare(a.name,b.name);
      if(name)return name;
    }
    return (mode==='reverse'?b.order-a.order:a.order-b.order)||
      collator.compare(a.name,b.name)||collator.compare(a.id,b.id);
  });
}

const studentCollator=new Intl.Collator('es',{sensitivity:'base',numeric:true});
/** Orden de presentación: nunca reescribe ni renumera notas/alumnos. */
export function sortStudents(students,mode='surname'){
  if(!STUDENT_SORT_MODES.includes(mode))throw new Error('Modo de ordenación inválido.');
  const ordered=[...students];
  const by=(a,b)=>studentCollator.compare(a,b);
  const surname=s=>s.lastName||s.name||'';
  const given=s=>s.firstName||s.name||'';
  const stable=(a,b)=>(a.order??0)-(b.order??0)||by(a.id,b.id);
  return ordered.sort((a,b)=>{
    if(mode==='manual')return stable(a,b);
    if(mode==='originGroup'){
      const ga=a.originGroup||'',gb=b.originGroup||'';
      if(!ga&&gb)return 1;
      if(ga&&!gb)return -1;
      const diff=by(ga,gb);if(diff)return diff;
    }
    if(mode==='firstName')return by(given(a),given(b))||by(surname(a),surname(b))||stable(a,b);
    return by(surname(a),surname(b))||by(given(a),given(b))||stable(a,b);
  });
}
export function addStudent(doc,groupId,identity){
  if(!doc.groups.some(g=>g.id===groupId))throw new Error('Grupo inexistente.');
  const fields=studentIdentity(identity);
  const student=mark({id:uid(),groupId,...fields,order:doc.students.filter(s=>s.groupId===groupId).length,createdAt:now()});
  doc.students.push(student);doc.updatedAt=now();return student;
}
export function addCategory(doc,name,weight=0,rule='mean',ownerGroupId=null){
  const n=name.trim();if(!n||!Number.isFinite(weight)||weight<0||weight>100||!CATEGORY_RULES.includes(rule)||(ownerGroupId&&!doc.groups.some(g=>g.id===ownerGroupId)))throw new Error('Categoría inválida.');
  if(ownerGroupId&&availableCategories(doc,ownerGroupId).some(c=>c.name.toLocaleLowerCase('es')===n.toLocaleLowerCase('es')))throw new Error('Ya existe una categoría con ese nombre en el grupo.');
  const category=mark({id:uid(),name:n,weight,rule,bestCount:2,...(ownerGroupId?{ownerGroupId}:{}),createdAt:now()});doc.categories.push(category);doc.updatedAt=now();return category;
}
/** Elimina una categoría sólo cuando no afecta a actividades, vínculos o calificaciones. */
export function removeCategory(doc,categoryId){
  const cat=doc.categories.find(c=>c.id===categoryId);
  if(!cat)throw new Error('Categoría inexistente.');
  if(doc.assessments.some(a=>a.categoryId===categoryId))throw new Error('Esta categoría contiene actividades. Muévelas o elimínalas antes de borrar la categoría.');
  if(doc.individualCategoryRules.some(r=>r.categoryId===categoryId))throw new Error('Hay excepciones individuales de esta categoría. Restablécelas antes de eliminarla.');
  // Nunca romper silenciosamente las ponderaciones competenciales.
  if(doc.competencies.some(c=>c.links.some(l=>l.categoryId===categoryId)))
    throw new Error('Esta categoría tiene vínculos con competencias. Desvincúlalas antes de eliminarla.');
  doc.categories=doc.categories.filter(c=>c.id!==categoryId);
  doc.groups.forEach(g=>{if(g.hiddenCategoryIds)g.hiddenCategoryIds=g.hiddenCategoryIds.filter(id=>id!==categoryId);});
  doc.gradingProfiles.forEach(p=>p.overrides=p.overrides.filter(o=>o.categoryId!==categoryId));
  doc.competencies.forEach(c=>c.links=c.links.filter(l=>l.categoryId!==categoryId));
  doc.updatedAt=now();
}
/** Retira una categoría únicamente del grupo solicitado. Nunca borra notas de otros grupos. */
export function removeCategoryFromGroup(doc,groupId,categoryId){
  const group=doc.groups.find(g=>g.id===groupId);
  if(!group||!categoryAvailableForGroup(doc,groupId,categoryId))throw new Error('Categoría o grupo inválidos.');
  if(doc.assessments.some(a=>a.groupId===groupId&&a.categoryId===categoryId))throw new Error('Esta categoría tiene actividades en alguna evaluación de este grupo. Muévelas o elimínalas antes.');
  if(doc.individualCategoryRules.some(r=>r.categoryId===categoryId&&doc.students.some(s=>s.id===r.studentId&&s.groupId===groupId)))throw new Error('Hay excepciones individuales: restablécelas antes de retirar la categoría.');
  // Los enlaces de este grupo son configuración docente, aunque todavía
  // no existan notas. Se deben desvincular expresamente antes de retirar.
  if(doc.competencies.some(c=>c.links.some(l=>l.categoryId===categoryId)&&
      (c.groupId===groupId||(c.groupId===undefined&&doc.groups[0]?.id===groupId))))
    throw new Error('La categoría está vinculada a una competencia de este grupo. Desvincúlala antes de retirarla.');
  const category=doc.categories.find(c=>c.id===categoryId);
  // Las categorías compartidas siguen existiendo para los demás grupos,
  // incluso cuando solo tienen ajustes de peso y todavía ninguna actividad.
  if(category.ownerGroupId===groupId){removeCategory(doc,categoryId);return 'deleted';}
  group.hiddenCategoryIds=[...(group.hiddenCategoryIds||[]),categoryId];
  group.updatedAt=doc.updatedAt=now();
  return 'hidden';
}
/** Copia estructura, escalas, rúbricas y vínculos de recuperaciones; nunca notas. */
export function copyPeriodAssessments(doc,groupId,sourcePeriodId,targetPeriodIds){
  if(!Array.isArray(targetPeriodIds)||!targetPeriodIds.length||new Set(targetPeriodIds).size!==targetPeriodIds.length)throw new Error('Selecciona evaluaciones distintas.');
  if(!doc.groups.some(g=>g.id===groupId)||!doc.periods.some(p=>p.id===sourcePeriodId))throw new Error('Grupo o evaluación inválidos.');
  const source=doc.assessments.filter(a=>a.groupId===groupId&&a.periodId===sourcePeriodId).sort((a,b)=>a.order-b.order);
  if(!source.length)throw new Error('La evaluación de origen no tiene actividades.');
  for(const targetId of targetPeriodIds){
    if(targetId===sourcePeriodId||!doc.periods.some(p=>p.id===targetId))throw new Error('Evaluación de destino inválida.');
    if(doc.assessments.some(a=>a.groupId===groupId&&a.periodId===targetId))throw new Error('Una evaluación de destino ya contiene actividades. No se ha sobrescrito nada.');
  }
  for(const targetId of targetPeriodIds){
    const translated=new Map();
    for(const a of source.filter(a=>!a.recoveryOf)){
      const copy=addAssessment(doc,{name:a.name,groupId,periodId:targetId,categoryId:a.categoryId,maxScore:a.maxScore,weight:a.weight,convertToTen:a.convertToTen,rubricId:a.rubricId,orthography:a.orthography??null});
      translated.set(a.id,copy.id);
    }
    for(const a of source.filter(a=>a.recoveryOf)){
      const originalId=translated.get(a.recoveryOf);
      if(!originalId)throw new Error('La recuperación carece de actividad original.');
      const copy=addAssessment(doc,{name:a.name,groupId,periodId:targetId,categoryId:a.categoryId,maxScore:a.maxScore,weight:a.weight,convertToTen:a.convertToTen,rubricId:a.rubricId,recoveryOf:originalId,recoveryMode:a.recoveryMode,orthography:a.orthography??null});
      translated.set(a.id,copy.id);
    }
    // Conservar el orden original aunque las recuperaciones se creen al final.
    for(const [order,a] of source.entries())doc.assessments.find(x=>x.id===translated.get(a.id)).order=order;
    // También se copian reglas y porcentajes: sin ellos, una columna de Literatura
    // podría tener peso cero aunque estuviera presente en la copia.
    copyPeriodCategories(doc,groupId,sourcePeriodId,targetId);
  }
}
export function addAssessment(doc,{name,groupId,periodId,categoryId,maxScore=10,weight=1,recoveryOf=null,recoveryMode='higher',convertToTen=true,rubricId=null,orthography=undefined}){
  if(!name?.trim()||!doc.groups.some(g=>g.id===groupId)||!doc.periods.some(p=>p.id===periodId)||!categoryAvailableForGroup(doc,groupId,categoryId)||!Number.isFinite(maxScore)||maxScore<=0||maxScore>1000||!Number.isFinite(weight)||weight<=0||weight>1000)throw new Error('Datos de actividad inválidos.');
  if(typeof convertToTen!=='boolean'||(rubricId!==null&&(!doc.rubrics.some(r=>r.id===rubricId)||maxScore!==10||!convertToTen)))throw new Error('Escala o rúbrica inválida.');
  if(recoveryOf){
    const old=doc.assessments.find(x=>x.id===recoveryOf);
    if(!old||old.recoveryOf||old.groupId!==groupId||old.periodId!==periodId||old.categoryId!==categoryId||!['higher','replace'].includes(recoveryMode)||doc.assessments.some(x=>x.recoveryOf===recoveryOf))throw new Error('No se puede vincular esa recuperación.');
  }
  if(orthography===undefined){
    const category=doc.categories.find(c=>c.id===categoryId);
    const defaults={...ORTHOGRAPHY_DEFAULTS,...doc.settings.orthographyDefaults};
    orthography=category?.name?.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()==='examenes'&&defaults.enabledForExams&&!rubricId&&convertToTen
      ?{enabled:true,penaltyPerFault:defaults.penaltyPerFault,repetitions:defaults.repetitions,refundable:doc.groups.find(g=>g.id===groupId)?.orthographyRefundable??defaults.refundable}:null;
  }
  if(orthography!==null&&(!validOrthographyConfig(orthography)||orthography.enabled&&(rubricId||!convertToTen)))throw new Error('Penalización ortográfica no compatible con esta actividad.');
  const order=Math.max(-1,...doc.assessments.filter(x=>x.groupId===groupId&&x.periodId===periodId).map(x=>x.order))+1;
  // La configuración anidada no debe compartir referencia con el llamador ni
  // con una actividad de otro período que haya copiado su estructura.
  const ownOrthography=orthography===null?null:structuredClone(orthography);
  const assessment=mark({id:uid(),name:name.trim(),groupId,periodId,categoryId,maxScore,weight,convertToTen,rubricId,orthography:ownOrthography,order,...(recoveryOf?{recoveryOf,recoveryMode}:{}),createdAt:now()});doc.assessments.push(assessment);doc.updatedAt=now();return assessment;
}
export function updateAssessment(doc,id,patch){
  const a=doc.assessments.find(x=>x.id===id);
  if(!a)throw new Error('Actividad inexistente.');
  if(!patch||typeof patch!=='object'||Array.isArray(patch)||
    Object.keys(patch).some(k=>!['name','maxScore','weight','categoryId','convertToTen','rubricId','orthography'].includes(k)))
    throw new Error('Campo de actividad no permitido.');
  const updated={...a,...patch};
  if(typeof updated.convertToTen!=='boolean'||(updated.rubricId!==null&&(!doc.rubrics.some(r=>r.id===updated.rubricId)||updated.maxScore!==10||!updated.convertToTen)))throw new Error('Escala o rúbrica inválida.');
  if(updated.orthography!==undefined&&updated.orthography!==null&&(!validOrthographyConfig(updated.orthography)||updated.orthography.enabled&&(updated.rubricId||!updated.convertToTen)))throw new Error('Penalización ortográfica no compatible con esta actividad.');
  if(a.rubricId!==updated.rubricId&&doc.grades.some(g=>g.assessmentId===id))throw new Error('No cambies el tipo de actividad con notas registradas.');
  // Una devolución ya concedida no puede desaparecer por desactivar la
  // recuperación de faltas; impedir el cambio antes de tocar actividad o agenda.
  if(doc.grades.some(g=>g.assessmentId===id&&g.orthographyDelivered)&&!updated.orthography?.refundable)
    throw new Error('Este examen tiene faltas entregadas. No desactives la devolución ni elimines su configuración sin revisar antes esas calificaciones.');
  if(!updated.name?.trim()||updated.name.length>150||!Number.isFinite(updated.maxScore)||updated.maxScore<=0||updated.maxScore>1000||!Number.isFinite(updated.weight)||updated.weight<=0||updated.weight>1000||!categoryAvailableForGroup(doc,a.groupId,updated.categoryId))throw new Error('Datos de actividad inválidos.');
  if(doc.grades.some(g=>g.assessmentId===id&&g.score>updated.maxScore))throw new Error('Hay calificaciones que superan la nueva nota máxima.');
  if(updated.categoryId!==a.categoryId&&(a.recoveryOf||doc.assessments.some(x=>x.recoveryOf===a.id)))throw new Error('No puedes cambiar la categoría mientras haya una recuperación vinculada.');
  // Si el evento seguía el título de la columna, acompañar el renombrado sin sobrescribir títulos editados a mano.
  doc.planner?.years?.forEach(y=>y.events.filter(e=>e.assessmentId===id&&e.title===a.name).forEach(e=>{e.title=updated.name.trim();}));
  Object.assign(a,{name:updated.name.trim(),maxScore:updated.maxScore,weight:updated.weight,categoryId:updated.categoryId,convertToTen:updated.convertToTen,rubricId:updated.rubricId,orthography:updated.orthography===undefined||updated.orthography===null?null:structuredClone(updated.orthography),updatedAt:now()});doc.updatedAt=now();return a;
}
export function moveAssessment(doc,id,direction){
  if(![-1,1].includes(direction))throw new Error('Dirección inválida.');
  const a=doc.assessments.find(x=>x.id===id);
  if(!a)throw new Error('Actividad inexistente.');
  const list=doc.assessments.filter(x=>x.groupId===a.groupId&&x.periodId===a.periodId).sort((x,y)=>x.order-y.order||x.id.localeCompare(y.id));
  const at=list.findIndex(x=>x.id===id),other=list[at+direction];
  if(!other)return;
  const ids=[...list];[ids[at],ids[at+direction]]=[ids[at+direction],ids[at]];
  ids.forEach((x,i)=>{x.order=i;x.updatedAt=now();});doc.updatedAt=now();
}
export function removeAssessment(doc,id){
  if(doc.assessments.some(x=>x.recoveryOf===id))throw new Error('Elimina primero la recuperación vinculada.');
  if(!doc.assessments.some(x=>x.id===id))throw new Error('Actividad inexistente.');
  doc.assessments=doc.assessments.filter(x=>x.id!==id);
  doc.grades=doc.grades.filter(x=>x.assessmentId!==id);
  if(doc.gradeObservations)doc.gradeObservations=doc.gradeObservations.filter(x=>x.assessmentId!==id);
  // Conservar la cita del calendario aunque se quite la columna del cuaderno.
  doc.planner?.years?.forEach(y=>y.events.forEach(e=>{if(e.assessmentId===id)e.assessmentId=null;}));
  doc.updatedAt=now();
}
/** Una observación pertenece al alumno y la actividad, independientemente de
 * que exista una nota. Permanece ante cambios de nota, NP, AJ o rúbrica.
 * visibleToStudent=false por defecto impide exposiciones accidentales. */
export function getGradeObservation(doc,studentId,assessmentId){
  return (doc.gradeObservations??[]).find(n=>n.studentId===studentId&&n.assessmentId===assessmentId)??null;
}
export function setGradeObservation(doc,studentId,assessmentId,text,visibleToStudent=false){
  const student=doc.students.find(s=>s.id===studentId);
  const assessment=doc.assessments.find(a=>a.id===assessmentId);
  if(!student||!assessment||student.groupId!==assessment.groupId)
    throw new Error('Alumno o actividad inexistente para la observación.');
  if(typeof text!=='string'||text.length>1500||typeof visibleToStudent!=='boolean')
    throw new Error('La observación debe ser texto de hasta 1500 caracteres.');
  const normalized=text.trim();
  const original=getGradeObservation(doc,studentId,assessmentId);
  if(original?.text===normalized&&original.visibleToStudent===visibleToStudent)return doc;
  if(!original&&!normalized)return doc;
  if(!doc.gradeObservations)doc.gradeObservations=[];
  if(!normalized)doc.gradeObservations=doc.gradeObservations.filter(n=>n!==original);
  else if(original){
    original.text=normalized;original.visibleToStudent=visibleToStudent;original.updatedAt=now();
  }else{
    doc.gradeObservations.push(mark({id:uid(),studentId,assessmentId,text:normalized,visibleToStudent,createdAt:now()}));
  }
  doc.updatedAt=now();return doc;
}

/** Ausencia justificada: omite la actividad de todos los cálculos. Si existía
 * nota, se conserva íntegra en el mismo registro y reaparece al desmarcar AJ.
 * Si no existía nota, se usa un marcador reversible sin calificación real. */
export function setPendingJustified(doc,studentId,assessmentId,enabled){
  const student=doc.students.find(s=>s.id===studentId);
  const assessment=doc.assessments.find(a=>a.id===assessmentId);
  if(!student||!assessment||student.groupId!==assessment.groupId||typeof enabled!=='boolean')throw new Error('Alumno, actividad o estado de ausencia justificada inválidos.');
  const index=doc.grades.findIndex(g=>g.studentId===studentId&&g.assessmentId===assessmentId);
  const previous=doc.grades[index];
  if(enabled){
    if(previous?.pendingJustified)return doc;
    if(previous?.notSubmitted){
      // AJ suspende el cero de NP, pero no debe destruirlo: quitar AJ
      // restaura exactamente el estado NP previo, con su identidad.
      doc.grades[index]=mark({id:previous.id,studentId,assessmentId,score:0,pendingJustified:true,pendingPlaceholder:true,pendingWasNotSubmitted:true,createdAt:previous.createdAt});
    }
    else if(previous){doc.grades[index]=mark({...previous,pendingJustified:true});}
    else doc.grades.push(mark({id:uid(),studentId,assessmentId,score:0,pendingJustified:true,pendingPlaceholder:true,createdAt:now()}));
  }else{
    if(!previous?.pendingJustified)return doc;
    if(previous.pendingPlaceholder){
      if(previous.pendingWasNotSubmitted){
        doc.grades[index]=mark({id:previous.id,studentId,assessmentId,score:0,notSubmitted:true,createdAt:previous.createdAt});
      }else doc.grades.splice(index,1);
    }else{
      const {pendingJustified,pendingPlaceholder,pendingWasNotSubmitted,...unchanged}=previous;
      doc.grades[index]=mark(unchanged);
    }
  }
  doc.updatedAt=now();return doc;
}

/** Registra una ausencia en cualquier actividad, sin valoración ni faltas asociadas. */
export function setNotSubmitted(doc,studentId,assessmentId,enabled){
  const student=doc.students.find(s=>s.id===studentId);
  const assessment=doc.assessments.find(a=>a.id===assessmentId);
  if(!student||!assessment||student.groupId!==assessment.groupId)throw new Error('Alumno o actividad inválidos.');
  if(typeof enabled!=='boolean')throw new Error('Estado «No presentado» inválido.');
  const at=doc.grades.findIndex(g=>g.studentId===studentId&&g.assessmentId===assessmentId);
  const previous=doc.grades[at];
  if(!enabled){
    if(!previous?.notSubmitted)return doc;
    doc.grades.splice(at,1);
  }else{
    if(previous?.notSubmitted)return doc;
    const grade=mark({id:previous?.id??uid(),studentId,assessmentId,score:0,notSubmitted:true,createdAt:previous?.createdAt??now()});
    if(previous)doc.grades[at]=grade;
    else doc.grades.push(grade);
  }
  doc.updatedAt=now();return doc;
}
function numericGrade(previous,fields){
  const {notSubmitted,pendingJustified,pendingPlaceholder,pendingWasNotSubmitted,...grade}=previous;
  return mark({...grade,...fields});
}
export function setGrade(doc,studentId,assessmentId,score){
  const student=doc.students.find(x=>x.id===studentId), assessment=doc.assessments.find(x=>x.id===assessmentId);
  if(!student||!assessment||student.groupId!==assessment.groupId)throw new Error('Alumno o actividad inválidos.');
  if(assessment.rubricId)throw new Error('Evalúa esta actividad mediante su rúbrica.');
  const at=doc.grades.findIndex(x=>x.studentId===studentId&&x.assessmentId===assessmentId);
  if(score === null || score === ''){
    if(at<0)return doc; // Un borrado sin registro no debe escribir ni generar historial.
    doc.grades.splice(at,1); // En sincronización futura se sustituirá por marca de borrado (tombstone).
  }else{
    const val=parseScore(score);
    if(!Number.isFinite(val)||val<0||val>assessment.maxScore)throw new Error(`Introduce una nota entre 0 y ${assessment.maxScore}.`);
    // Una nota idéntica a la conservada bajo AJ NO es un no-op: reintroducirla
    // debe reactivar la evidencia y retirarla del estado pendiente.
    if(at>=0&&!doc.grades[at].notSubmitted&&!doc.grades[at].pendingJustified&&doc.grades[at].score===val)return doc;
    if(at>=0)doc.grades[at]=numericGrade(doc.grades[at],{score:val});
    else doc.grades.push(mark({id:uid(),studentId,assessmentId,score:val,createdAt:now()}));
  }
  doc.updatedAt=now();return doc;
}
/** Cambia de forma atómica la nota original y los metadatos de faltas. */
export function setOrthographyGrade(doc,studentId,assessmentId,{score,faults=0,delivered=false}){
  const student=doc.students.find(s=>s.id===studentId),assessment=doc.assessments.find(a=>a.id===assessmentId);
  if(!student||!assessment||student.groupId!==assessment.groupId||!assessment.orthography?.enabled||assessment.rubricId||!assessment.convertToTen)throw new Error('Este examen no admite penalización ortográfica.');
  const at=doc.grades.findIndex(g=>g.studentId===studentId&&g.assessmentId===assessmentId);
  if(score===null||score===''){
    if(faults!==0&&faults!=='0'||delivered)throw new Error('No se pueden registrar faltas sin nota original.');
    if(at<0)return doc;
    doc.grades.splice(at,1);
  }else{
    const base=parseScore(score);
    const count=typeof faults==='string'&&/^\d{1,4}$/.test(faults)?Number(faults):faults;
    if(!Number.isFinite(base)||base<0||base>assessment.maxScore)throw new Error(`Introduce una nota entre 0 y ${assessment.maxScore}.`);
    if(!Number.isInteger(count)||count<0||count>1000)throw new Error('Introduce entre 0 y 1000 faltas, sin decimales.');
    if(typeof delivered!=='boolean'||delivered&&(!count||!assessment.orthography.refundable))throw new Error('La entrega no puede marcarse en este examen.');
    const previous=at>=0?doc.grades[at]:{id:uid(),studentId,assessmentId,createdAt:now()};
    // AJ conserva puntuación y faltas; volver a confirmarlas debe reactivar
    // el cálculo incluso aunque los números no hayan cambiado.
    if(at>=0&&!previous.notSubmitted&&!previous.pendingJustified&&previous.score===base&&(previous.orthographyFaults??0)===count&&!!previous.orthographyDelivered===delivered)return doc;
    const grade=numericGrade(previous,{score:base,orthographyFaults:count,orthographyDelivered:delivered});
    if(at>=0)doc.grades[at]=grade;else doc.grades.push(grade);
  }
  doc.updatedAt=now();return doc;
}

export function setCategory(doc,id,patch){
  const x=doc.categories.find(c=>c.id===id);if(!x)throw new Error('Categoría inexistente.');
  if(!patch||typeof patch!=='object'||Array.isArray(patch)||Object.keys(patch).some(k=>!['name','weight','rule','bestCount'].includes(k)))
    throw new Error('Campo de categoría no permitido.');
  if('name' in patch&&(typeof patch.name!=='string'||!patch.name.trim()||patch.name.length>150))throw new Error('Nombre de categoría inválido.');
  if('weight' in patch && (!Number.isFinite(patch.weight)||patch.weight<0||patch.weight>100))throw new Error('Porcentaje fuera de 0–100.');
  if('rule' in patch && !CATEGORY_RULES.includes(patch.rule))throw new Error('Regla desconocida.');
  if('bestCount' in patch && !validBestCount(patch.bestCount))throw new Error('Número de mejores notas inválido.');
  Object.assign(x,patch,{updatedAt:now()});doc.updatedAt=now();return doc;
}
export function addCompetency(doc,name,groupId=null,curriculumKey=null){
  if(typeof name!=='string'||!name.trim())throw new Error('Introduce una competencia.');
  if(groupId!==null&&!doc.groups.some(g=>g.id===groupId))throw new Error('Grupo de competencia inexistente.');
  if(curriculumKey!==null&&(typeof curriculumKey!=='string'||!/^[-a-z0-9]+:CE[1-9][0-9]*$/i.test(curriculumKey)))throw new Error('Código competencial inválido.');
  if(curriculumKey&&doc.competencies.some(c=>c.groupId===groupId&&c.curriculumKey===curriculumKey))throw new Error('Competencia oficial ya vinculada a este grupo.');
  const c=mark({id:uid(),name:name.trim(),links:[],createdAt:now(),...(groupId?{groupId}:{}),...(curriculumKey?{curriculumKey}:{})});doc.competencies.push(c);doc.updatedAt=now();return c;
}
export function setCompetencyLink(doc,competencyId,categoryId,weight){
  const c=doc.competencies.find(x=>x.id===competencyId);
  if(!c||!doc.categories.some(x=>x.id===categoryId))throw new Error('Referencia competencial inexistente.');
  // Comprobar todos los parámetros ANTES de modificar enlaces existentes.
  if(weight!==null&&(!Number.isFinite(weight)||weight<=0||weight>1000))throw new Error('Peso de competencia inválido.');
  const owner=c.groupId??doc.groups[0]?.id;
  if(weight!==null&&owner&&!categoryAvailableForGroup(doc,owner,categoryId))throw new Error('Categoría no disponible para la competencia de este grupo.');
  c.links=c.links.filter(x=>x.categoryId!==categoryId);
  if(weight!==null)c.links.push({categoryId,weight});
  c.updatedAt=now();doc.updatedAt=now();return c;
}

// Rúbricas portables: el JSON solo contiene definiciones, nunca datos del alumnado.
export function createRubric(doc,name,criteria){
  const n=String(name??'').trim();
  if(!n||n.length>150)throw new Error('Introduce un nombre de rúbrica válido.');
  if(!Array.isArray(criteria))throw new Error('Faltan criterios de rúbrica.');
  const normalized=criteria.map(c=>({id:uid(),name:String(c.name??'').trim(),maxScore:Number(c.maxScore),weight:Number(c.weight??1),...(c.levels?{levels:c.levels.map(l=>({score:Number(l.score),label:String(l.label),description:String(l.description??'')}))}:{})}));
  validateCriteria(normalized);validateRubricInputPrecision(normalized);
  const rubric=mark({id:uid(),name:n,criteria:normalized,createdAt:now()});
  doc.rubrics.push(rubric);doc.updatedAt=now();return rubric;
}
export function updateRubric(doc,id,name,criteria){
  const old=doc.rubrics.find(r=>r.id===id);
  if(!old)throw new Error('Rúbrica inexistente.');
  if(doc.assessments.some(a=>a.rubricId===id&&doc.grades.some(g=>g.assessmentId===a.id)))throw new Error('Esta rúbrica tiene calificaciones. Crea una copia antes de modificarla.');
  const n=String(name??'').trim();if(!n||n.length>150)throw new Error('Nombre inválido.');
  const normalized=criteria.map(c=>({id:uid(),name:String(c.name??'').trim(),maxScore:Number(c.maxScore),weight:Number(c.weight??1),...(c.levels?{levels:c.levels.map(l=>({score:Number(l.score),label:String(l.label),description:String(l.description??'')}))}:{})}));validateCriteria(normalized);validateRubricInputPrecision(normalized);
  Object.assign(old,{name:n,criteria:normalized,updatedAt:now()});doc.updatedAt=now();return old;
}
export function duplicateRubric(doc,id){
  const original=doc.rubrics.find(r=>r.id===id);
  if(!original)throw new Error('Rúbrica inexistente.');
  return createRubric(doc,`Copia de ${original.name}`.slice(0,150),original.criteria.map(({name,maxScore,weight,levels})=>({name,maxScore,weight,...(levels?{levels:levels.map(l=>({...l}))}:{})})));
}
export function setRubricGrade(doc,studentId,assessmentId,ratings){
  const assessment=doc.assessments.find(a=>a.id===assessmentId),student=doc.students.find(s=>s.id===studentId);
  if(!student||!assessment||assessment.groupId!==student.groupId||!assessment.rubricId)throw new Error('Actividad de rúbrica inválida.');
  const rubric=doc.rubrics.find(r=>r.id===assessment.rubricId);
  const idx=doc.grades.findIndex(g=>g.studentId===studentId&&g.assessmentId===assessmentId);
  if(ratings===null){if(idx<0)return;doc.grades.splice(idx,1);doc.updatedAt=now();return;}
  const entries=rubric.criteria.map(c=>({criterionId:c.id,score:ratings&&ratings[c.id]!==''&&ratings[c.id]!==null&&ratings[c.id]!==undefined?parseScore(ratings[c.id]):NaN}));
  if(entries.some((x,i)=>!Number.isFinite(x.score)||x.score<0||x.score>rubric.criteria[i].maxScore||(rubric.criteria[i].levels&&!rubric.criteria[i].levels.some(l=>l.score===x.score))))throw new Error('Puntuación de rúbrica fuera de escala.');
  const score=rubricGradeFromRatings(rubric,entries);
  // Una rúbrica con AJ conserva sus valoraciones, pero reintroducirlas
  // debe quitar AJ para volver a contar la nota aunque sean idénticas.
  if(idx>=0&&!doc.grades[idx].pendingJustified&&Math.abs(doc.grades[idx].score-score)<1e-12&&
     Array.isArray(doc.grades[idx].rubricRatings)&&doc.grades[idx].rubricRatings.length===entries.length&&
     entries.every(entry=>doc.grades[idx].rubricRatings.some(r=>r.criterionId===entry.criterionId&&r.score===entry.score)))return score;
  if(idx>=0)doc.grades[idx]=numericGrade(doc.grades[idx],{score,rubricRatings:entries});
  else doc.grades.push(mark({id:uid(),studentId,assessmentId,score,rubricRatings:entries,createdAt:now()}));
  doc.updatedAt=now();return score;
}
export function setFinalConfig(doc,groupId,patch){
  if(!doc.groups.some(g=>g.id===groupId))throw new Error('Grupo inexistente.');
  const current=doc.finalConfigs.find(c=>c.groupId===groupId);
  const proposed=current??{id:uid(),groupId,rule:'mean',weights:{},excludedPeriodIds:[],createdAt:now()};
  const next={...proposed,...patch,weights:{...proposed.weights,...(patch.weights||{})}};
  if(!['mean','weighted_mean','latest_if_highest'].includes(next.rule)||!Array.isArray(next.excludedPeriodIds)||new Set(next.excludedPeriodIds).size!==next.excludedPeriodIds.length||next.excludedPeriodIds.some(id=>!doc.periods.some(p=>p.id===id))||Object.entries(next.weights).some(([periodId,weight])=>!doc.periods.some(p=>p.id===periodId)||!Number.isFinite(weight)||weight<0||weight>1000))throw new Error('Regla de evaluación final inválida.');
  // Evitar registros fantasma si el cambio era inválido.
  const c=current??mark(proposed);if(!current)doc.finalConfigs.push(c);
  // Copiar los arrays de configuración; un selector o utilidad externa no
  // puede mutar después la evaluación final sin pasar por una transacción.
  Object.assign(c,{rule:next.rule,weights:next.weights,excludedPeriodIds:[...next.excludedPeriodIds],updatedAt:now()});doc.updatedAt=now();return c;
}
export function setFinalOverride(doc,studentId,periodId,score){
  if(!doc.students.some(s=>s.id===studentId)||!doc.periods.some(p=>p.id===periodId))throw new Error('Alumno o periodo inexistente.');
  const index=doc.finalOverrides.findIndex(x=>x.studentId===studentId&&x.periodId===periodId);
  if(score===null||score===''){if(index<0)return;doc.finalOverrides.splice(index,1);}
  else{
    const value=parseScore(score);if(!Number.isFinite(value)||value<0||value>10)throw new Error('La nota manual debe estar entre 0 y 10.');
    if(index>=0&&doc.finalOverrides[index].score===value)return;
    if(index>=0)doc.finalOverrides[index]=mark({...doc.finalOverrides[index],score:value});
    else doc.finalOverrides.push(mark({id:uid(),studentId,periodId,score:value,createdAt:now()}));
  }
  doc.updatedAt=now();
}


// Ediciones de gestión: no cambian IDs ni referencias a calificaciones.
/** Edición de identidad: preserva ID, notas, curso y excepciones individuales. */
export function updateStudentIdentity(doc,studentId,identity){
  const student=doc.students.find(s=>s.id===studentId);
  if(!student)throw new Error('Alumno inexistente.');
  const fields=studentIdentity(identity);
  if('firstName' in fields){student.firstName=fields.firstName;student.lastName=fields.lastName;}
  else{delete student.firstName;delete student.lastName;}
  student.name=fields.name;
  if('originGroup' in fields)student.originGroup=fields.originGroup;
  student.updatedAt=doc.updatedAt=now();return student;
}
export function renameStudent(doc,studentId,name){
  return updateStudentIdentity(doc,studentId,name);
}
export function moveStudent(doc,studentId,direction){
  if(![-1,1].includes(direction))throw new Error('Dirección inválida.');
  const student=doc.students.find(s=>s.id===studentId);
  if(!student)throw new Error('Alumno inexistente.');
  const list=doc.students.filter(s=>s.groupId===student.groupId).sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id));
  const index=list.findIndex(s=>s.id===studentId);
  if(!list[index+direction])return;
  [list[index],list[index+direction]]=[list[index+direction],list[index]];
  list.forEach((s,i)=>{s.order=i;s.updatedAt=now();});doc.updatedAt=now();
}
export function removeStudent(doc,studentId){
  if(!doc.students.some(s=>s.id===studentId))throw new Error('Alumno inexistente.');
  doc.grades=doc.grades.filter(g=>g.studentId!==studentId);
  if(doc.gradeObservations)doc.gradeObservations=doc.gradeObservations.filter(g=>g.studentId!==studentId);
  doc.finalOverrides=doc.finalOverrides.filter(o=>o.studentId!==studentId);
  doc.individualCategoryRules=doc.individualCategoryRules.filter(o=>o.studentId!==studentId);
  const groupId=doc.students.find(s=>s.id===studentId).groupId;
  doc.students=doc.students.filter(s=>s.id!==studentId);
  doc.students.filter(s=>s.groupId===groupId).sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id)).forEach((s,i)=>{if(s.order!==i){s.order=i;s.updatedAt=now();}});
  doc.updatedAt=now();
}
/** Límite por grupo optativo, separado entre horario ordinario y verano.
 * Rechazar reducciones que dejarían el horario existente inconsistente. */
export function setGroupWeeklyHours(doc,groupId,value){
 const group=doc.groups.find(g=>g.id===groupId);
 if(!group)throw new Error('Grupo inexistente.');
 const hours=value===null||value===undefined||value===''?null:Number(value);
 if(hours!==null&&(!Number.isInteger(hours)||hours<1||hours>30))
  throw new Error('Indica entre 1 y 30 horas semanales o deja el campo vacío.');
 if(hours!==null&&doc.planner?.years.some(y=>['regular','summer'].some(mode=>
   weeklySlotCount(y,groupId,mode)>hours)))
  throw new Error('El horario ya tiene más sesiones que el nuevo límite. Revisa antes las clases asignadas.');
 if(hours===null)delete group.weeklyHours;else group.weeklyHours=hours;
 group.updatedAt=doc.updatedAt=now();return group;
}
/** Asignar la tutoría de procedencia a varios alumnos sin moverlos ni tocar notas. */
export function setStudentOriginGroups(doc,groupId,assignments){
 if(!doc.groups.some(g=>g.id===groupId)||!Array.isArray(assignments)||assignments.length>2000)
  throw new Error('Grupo o listado de procedencias inválidos.');
 const ids=new Set();
 const entries=assignments.map(a=>{
  const student=doc.students.find(s=>s.id===a?.studentId&&s.groupId===groupId);
  if(!student||ids.has(student.id)||typeof a.originGroup!=='string')
    throw new Error('Alumno o grupo de procedencia inválido.');
  const origin=a.originGroup.trim();
  if(origin.length>60||/[<>\x00-\x1f]/.test(origin))
    throw new Error('Nombre del subgrupo inválido (máximo 60 caracteres).');
  ids.add(student.id);return {student,origin};
 });
 const time=now();let changed=false;
 for(const {student,origin} of entries){
  if((student.originGroup||'')===origin)continue;
  student.originGroup=origin;student.updatedAt=time;changed=true;
 }
 if(changed)doc.updatedAt=time;
 return doc;
}
export function updateGroupInfo(doc,groupId,name,course){
  const group=doc.groups.find(g=>g.id===groupId);
  const n=String(name??'').trim(),c=String(course??'').trim();
  if(!group||!n||n.length>150||!c||c.length>40)throw new Error('Nombre o curso escolar inválidos.');
  group.name=n;group.course=c;group.updatedAt=doc.updatedAt=now();return group;
}
export function renamePeriod(doc,periodId,name){
  const period=doc.periods.find(p=>p.id===periodId);
  const value=String(name??'').trim();
  if(!period||!value||value.length>150)throw new Error('Periodo inválido.');
  period.name=value;period.updatedAt=doc.updatedAt=now();return period;
}
export function movePeriod(doc,periodId,direction){
  if(![-1,1].includes(direction))throw new Error('Dirección inválida.');
  const p=doc.periods.find(p=>p.id===periodId);if(!p)throw new Error('Periodo inexistente.');
  const list=[...doc.periods].sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id));
  const index=list.findIndex(x=>x.id===periodId);
  if(!list[index+direction])return;
  [list[index],list[index+direction]]=[list[index+direction],list[index]];
  list.forEach((x,i)=>{x.order=i;x.updatedAt=now();});doc.updatedAt=now();
}
