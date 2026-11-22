import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 initialNotebook,emptyNotebook,assertModel,migrateNotebook,addGroup,addStudent,setSubjectAccent,
 setGroupWeeklyHours,setStudentOriginGroups,SUBJECT_COLORS
} from '../src/model.js';
import {
 activeYear,saveSlot,setSummerSchedule,weeklySlotCount,plannerSlotColor,PLANNER_COLORS,
 saveEvaluationSession,saveEvent,calendarEventIcs
} from '../src/planner.js';
import {timetableRows} from '../src/timetable-export.js';
import {renderPlanner,renderTimetableGrid} from '../src/planner-ui.js';
import {overallGrade,finalGrade,competencyGrade} from '../src/calculations.js';
import {createVault,saltFromEnvelope} from '../src/vault.js';
import {ensureBookMetadata,markBookChange,createPortableCopy,readBackupFile} from '../src/cuaderno.js';
const setup=()=>{const d=initialNotebook();return {d,g:d.groups[0],p:d.periods[0],st:d.students[0],y:activeYear(d)};};
const gradeSignature=(d,s,g,p)=>({
 trim:overallGrade(d,s.id,g.id,p.id),annual:finalGrade(d,s.id,g.id),
 comp:competencyGrade(d,s.id,d.competencies[0].id,g.id,p.id),
 grades:structuredClone(d.grades)
});
const assertGrading=(d,s,g,p,b)=>{
 assert.equal(overallGrade(d,s.id,g.id,p.id),b.trim);
 assert.equal(finalGrade(d,s.id,g.id),b.annual);
 assert.equal(competencyGrade(d,s.id,d.competencies[0].id,g.id,p.id),b.comp);
 assert.deepEqual(d.grades,b.grades);
};

test('Latín de 4.º y Latín I tienen acentos claramente distintos',()=>{
 const doc=initialNotebook();
 assert.notEqual(SUBJECT_COLORS['4eso:Latín 4.º'],SUBJECT_COLORS['1bach:Latín I']);
 assert.equal(doc.settings.subjectAccents['4eso:Latín 4.º'],'#B43F60');
 assert.equal(doc.settings.subjectAccents['1bach:Latín I'],'#F59E0B');
 assertModel(doc);
});

test('solo actualiza el anterior color por defecto de Latín 4.º; conserva colores personalizados',()=>{
 const doc=initialNotebook();
 doc.settings.subjectAccents['4eso:Latín 4.º']='#EAB308';
 const result=migrateNotebook(doc);
 assert.equal(result.migrated,true);
 assert.equal(result.doc.settings.subjectAccents['4eso:Latín 4.º'],'#B43F60');
 assert.equal(doc.settings.subjectAccents['4eso:Latín 4.º'],'#EAB308');
 const personalized=initialNotebook();
 personalized.settings.subjectAccents['4eso:Latín 4.º']='#8945AA';
 assert.equal(migrateNotebook(personalized).migrated,false);
 assert.equal(migrateNotebook(personalized).doc.settings.subjectAccents['4eso:Latín 4.º'],'#8945AA');
 assertModel(result.doc);
});

test('color elegido para clase prevalece sobre acento y Word/PDF usan la misma fuente',()=>{
 const {d,g,y}=setup();
 const slot=saveSlot(d,{day:0,start:'08:00',end:'08:55',type:'class',groupId:g.id,color:'#124E37'});
 assert.equal(plannerSlotColor(slot),'#124E37');
 assert.equal(timetableRows(d,y)[0].cells[0].slots[0].color,'#124E37');
 setSubjectAccent(d,g.level,g.subject,'#FF0000');
 assert.equal(plannerSlotColor(slot),'#124E37');
 assert.equal(timetableRows(d,y)[0].cells[0].slots[0].color,'#124E37');
 const html=renderTimetableGrid(d,y);
 assert(html.includes('--planner-color:#124E37'));
 assert(!html.includes('--planner-color:#FF0000'));
 assertModel(d);
});

test('sin color personal se usa verde oscuro para cada tipo, no el acento',()=>{
 const {d,g,y}=setup();
 const a=saveSlot(d,{day:0,start:'08:00',end:'08:55',type:'class',groupId:g.id});
 const guard=saveSlot(d,{day:1,start:'10:45',end:'11:15',type:'guardia'});
 assert.equal(plannerSlotColor(a),PLANNER_COLORS.class);
 assert.equal(plannerSlotColor(guard),PLANNER_COLORS.guardia);
 assert.notEqual(plannerSlotColor(a),d.settings.subjectAccents[g.level+':'+g.subject]);
 assert.equal(timetableRows(d,y)[0].cells[0].slots[0].color,PLANNER_COLORS.class);
 assertModel(d);
});

test('límite semanal exacto 4/4 impide quinta sesión, sin alterar las existentes ni notas',()=>{
 const {d,g,p,st,y}=setup(),baseline=gradeSignature(d,st,g,p);
 setGroupWeeklyHours(d,g.id,4);
 const slots=[0,1,2,3].map(day=>saveSlot(d,{day,start:'08:00',end:'08:55',type:'class',groupId:g.id}));
 assert.equal(weeklySlotCount(y,g.id),4);
 const before=structuredClone(d);
 assert.throws(()=>saveSlot(d,{day:4,start:'08:00',end:'08:55',type:'class',groupId:g.id}),/Límite semanal/);
 assert.deepEqual(d,before);
 saveSlot(d,{id:slots[0].id,day:0,start:'08:00',end:'08:55',type:'class',groupId:g.id,color:'#103F31'});
 assert.equal(weeklySlotCount(y,g.id),4,'editar no debe contar como nueva clase');
 assertGrading(d,st,g,p,baseline);assertModel(d);
});

test('modificar un límite por debajo del horario existente se rechaza sin modificar el cuaderno',()=>{
 const {d,g,y}=setup();
 for(const day of [0,1,2,3])saveSlot(d,{day,start:'08:00',end:'08:55',type:'class',groupId:g.id});
 const before=structuredClone(d);
 assert.throws(()=>setGroupWeeklyHours(d,g.id,3),/más sesiones/);
 assert.deepEqual(d,before);
 setGroupWeeklyHours(d,g.id,4);
 assert.equal(d.groups[0].weeklyHours,4);
 setGroupWeeklyHours(d,g.id,'');
 assert.equal('weeklyHours' in d.groups[0],false);
 saveSlot(d,{day:4,start:'08:00',end:'08:55',type:'class',groupId:g.id});
 assert.equal(weeklySlotCount(y,g.id),5);
 assertModel(d);
});

test('en dos grupos de la misma materia el límite y las sesiones son independientes',()=>{
 const {d,g,y}=setup();
 const second=addGroup(d,'Optativa B',g.subject,g.course,g.level,2);
 setGroupWeeklyHours(d,g.id,1);
 saveSlot(d,{day:0,start:'08:00',end:'08:55',type:'class',groupId:g.id});
 saveSlot(d,{day:1,start:'08:00',end:'08:55',type:'class',groupId:second.id});
 saveSlot(d,{day:2,start:'08:00',end:'08:55',type:'class',groupId:second.id});
 assert.equal(weeklySlotCount(y,g.id),1);
 assert.equal(weeklySlotCount(y,second.id),2);
 assert.throws(()=>saveSlot(d,{day:3,start:'08:00',end:'08:55',type:'class',groupId:second.id}),/Límite semanal/);
 assertModel(d);
});

test('ordinario y verano respetan independientemente el límite 4/4 y no duplican clases',()=>{
 const {d,g,y}=setup();
 setGroupWeeklyHours(d,g.id,4);
 for(let day=0;day<4;day++)saveSlot(d,{day,start:'08:00',end:'08:55',type:'class',groupId:g.id,bandId:'hora-1'});
 assert.equal(weeklySlotCount(y,g.id,'regular'),4);
 setSummerSchedule(d,true);
 assert.equal(weeklySlotCount(y,g.id,'summer'),4);
 assert.equal(weeklySlotCount(y,g.id,'regular'),4);
 assert.throws(()=>saveSlot(d,{day:4,start:'08:00',end:'08:45',type:'class',groupId:g.id,bandId:'hora-1'}),/Límite semanal/);
 setSummerSchedule(d,false);
 assert.equal(weeklySlotCount(y,g.id,'regular'),4);
 assertModel(d);
});

test('validación de cuaderno restaurado rechaza límites violados o valores decimales',()=>{
 const {d,g}=setup();
 saveSlot(d,{day:0,start:'08:00',end:'08:55',type:'class',groupId:g.id});
 const invalid=structuredClone(d);
 invalid.groups[0].weeklyHours=0.5;
 assert.throws(()=>assertModel(invalid),/Horas semanales/);
 invalid.groups[0].weeklyHours=0;
 assert.throws(()=>assertModel(invalid),/Horas semanales/);
 invalid.groups[0].weeklyHours=1;
 assertModel(invalid);
 invalid.groups[0].weeklyHours=2;
 assertModel(invalid);
 const excessive=structuredClone(d);
 saveSlot(excessive,{day:1,start:'08:00',end:'08:55',type:'class',groupId:g.id});
 excessive.groups[0].weeklyHours=1; // Simular una copia alterada: no usar la API protegida.
 assert.throws(()=>assertModel(excessive),/más clases/);
});

test('asignar procedencias en lote no mueve alumnos, notas ni aplica cambios parciales',()=>{
 const {d,g,p,st}=setup(),base=gradeSignature(d,st,g,p);
 const students=d.students.filter(s=>s.groupId===g.id);
 const ids=students.map(s=>s.id),grades=structuredClone(d.grades);
 setStudentOriginGroups(d,g.id,students.map((s,i)=>({studentId:s.id,originGroup:i%2?'1.º BACH A':'1.º BACH B'})));
 assert.deepEqual(d.students.filter(s=>s.groupId===g.id).map(s=>s.id),ids);
 assert.deepEqual(d.grades,grades);
 const before=structuredClone(d);
 assert.throws(()=>setStudentOriginGroups(d,g.id,[{studentId:ids[0],originGroup:'1.º BACH C'},{studentId:'inexistente',originGroup:'1.º BACH B'}]),/Alumno/);
 assert.deepEqual(d,before);
 assertGrading(d,st,g,p,base);assertModel(d);
});

test('subgrupos A y B del mismo grupo optativo tienen citas distintas en una evaluación',()=>{
 const {d,g,p,y}=setup(),students=d.students.filter(s=>s.groupId===g.id);
 setStudentOriginGroups(d,g.id,students.map((s,i)=>({studentId:s.id,originGroup:i%2?'1.º BACH A':'1.º BACH B'})));
 const a=saveEvaluationSession(d,{groupId:g.id,periodId:p.id,originGroup:'1.º BACH A',date:'2026-12-18',time:'15:30'});
 const b=saveEvaluationSession(d,{groupId:g.id,periodId:p.id,originGroup:'1.º BACH B',date:'2026-12-19',time:'17:00'});
 assert.notEqual(a.id,b.id);
 assert.equal(y.events.length,2);
 assert(a.title.includes('1.º BACH A'));
 assert(b.title.includes('1.º BACH B'));
 assert(calendarEventIcs(a).replace(/\r\n /g,'').includes('BACH A'));
 const before=structuredClone(d);
 assert.throws(()=>saveEvaluationSession(d,{groupId:g.id,periodId:p.id,originGroup:'1.º BACH A',date:'2026-12-22',time:'15:30'}),/ya tiene/);
 assert.deepEqual(d,before);
 assertModel(d);
});

test('sesión general previa se conserva si después se asignan subgrupos',()=>{
 const {d,g,p,y}=setup();
 const all=saveEvaluationSession(d,{groupId:g.id,periodId:p.id,date:'2026-12-18',time:'16:00'});
 setStudentOriginGroups(d,g.id,[{studentId:d.students[0].id,originGroup:'1.º BACH B'}]);
 const one=saveEvaluationSession(d,{groupId:g.id,periodId:p.id,originGroup:'1.º BACH B',date:'2026-12-19',time:'17:00'});
 assert(y.events.some(e=>e.id===all.id&&!e.originGroup));
 assert(y.events.some(e=>e.id===one.id&&e.originGroup==='1.º BACH B'));
 const html=renderPlanner(d,{plannerMode:'week',plannerDate:'2026-12-18'});
 assert(html.includes('data-eval-origin="1.º BACH B"'));
 assert(html.includes('Sesiones de evaluación por grupo, subgrupo y trimestre'));
 assertModel(d);
});

test('pestaña de guardias de patio muestra fechas, zonas y acciones sin exponer alumnos',()=>{
 const {d,y,st}=setup();
 saveEvent(d,{date:'2026-11-24',type:'patio',title:'1.er patio · Huerto',time:'10:45',endTime:'11:15',notes:'Lluvia: conserjería'});
 const html=renderPlanner(d,{plannerMode:'patio',plannerDate:'2026-11-24'});
 assert(html.includes('data-plan-mode="patio"'));
 assert(html.includes('Guardias de patio'));
 assert(html.includes('plan-import-patio-panel'));
 assert(html.includes('Huerto'));
 assert(html.includes('conserjería'));
 assert(!html.includes(st.name));
 assertModel(d);
});

test('tarjetas de materias presentan el grupo debajo del nombre y permiten crear grupo si falta',()=>{
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
 assert(app.includes('course-group-caption'));
 assert(app.includes("groupNames.length?x.groupNames.join(' · '):'Sin grupo · crear grupo'"));
 assert(css.includes('.course-choice .course-group-caption'));
 assert(app.includes('manage-origin-groups'));
 assert(app.includes('setGroupWeeklyHours'));
});

test('exportación cifrada recupera límite, colores, procedencias y citas sin alterar notas',async()=>{
 const {d,g,p,st,y}=setup(),password='Clave de prueba para optativas seguras 2026';
 ensureBookMetadata(d);
 const old=structuredClone(d),base=gradeSignature(d,st,g,p);
 setGroupWeeklyHours(d,g.id,4);
 const ids=d.students.filter(s=>s.groupId===g.id).map(s=>s.id);
 setStudentOriginGroups(d,g.id,ids.map((id,i)=>({studentId:id,originGroup:i%2?'1.º BACH A':'1.º BACH B'})));
 saveSlot(d,{day:0,start:'08:00',end:'08:55',type:'class',groupId:g.id,color:'#214E37'});
 saveEvaluationSession(d,{groupId:g.id,periodId:p.id,originGroup:'1.º BACH A',date:'2026-12-18',time:'16:00'});
 markBookChange(d,old);
 const original=structuredClone(d);
 const {key,envelope}=await createVault(password,d);
 const {file}=await createPortableCopy(d,key,saltFromEnvelope(envelope));
 const text=JSON.stringify(file);
 assert(!text.includes(st.name));
 const recovered=await readBackupFile({size:Buffer.byteLength(text),text:async()=>text},password);
 assert.deepEqual(recovered.doc,original);
 assertGrading(recovered.doc,st,g,p,base);
 assert.equal(weeklySlotCount(activeYear(recovered.doc),g.id),1);
 assert.equal(recovered.doc.groups.find(x=>x.id===g.id).weeklyHours,4);
 assertModel(recovered.doc);
});
