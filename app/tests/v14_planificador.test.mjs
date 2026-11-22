import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initialNotebook,migrateNotebook,assertModel,addGroup,addAssessment,removeAssessment} from '../src/model.js';
import {overallGrade} from '../src/calculations.js';
import {createPlanner,activeYear,isoDate,weekday,addDays,daySlots,daySessions,findExamSlots,saveSlot,removeSlot,saveEvent,saveHoliday,saveLesson,carryLesson,nextClassDate,saveTask,saveException,addAcademicYear,setActiveYear,updateAcademicYear,deletePlannerItem,assertPlanner} from '../src/planner.js';

const setup=()=>{const d=initialNotebook(),g=d.groups[0],p=d.periods[0],y=activeYear(d);return {d,g,p,y};};
const slot=(d,g,day=0,start='08:00',end='08:55')=>saveSlot(d,{day,start,end,type:'class',groupId:g.id,label:''});

test('planificador se incluye en el cuaderno cifrado sin cambiar las notas existentes',()=>{
 const {d,g,p,y}=setup(),original=structuredClone(d.grades),n=overallGrade(d,d.students[0].id,g.id,p.id);
 assert.equal(d.schemaVersion,8);assert.equal(y.start,'2026-09-01');assert.equal(y.end,'2027-06-30');
 saveSlot(d,{day:1,start:'09:00',end:'09:55',type:'guardia'});
 saveTask(d,{title:'Preparar examen',dueDate:'2026-11-23'});
 assertModel(d);assert.deepEqual(d.grades,original);assert.equal(overallGrade(d,d.students[0].id,g.id,p.id),n);
});
test('migración de documento v1.3 sin planner conserva todas las calificaciones y grupos',()=>{
 const d=initialNotebook(),before=structuredClone(d.grades);delete d.planner;
 const {doc,migrated}=migrateNotebook(d);assert(migrated);assert.deepEqual(doc.grades,before);assert.equal(activeYear(doc).name,'2026-2027');assertModel(doc);
 assert.equal(migrateNotebook(doc).migrated,false);
});
test('calendario calculado en UTC sin desajustes de huso horario; 23-11-2026 cae lunes',()=>{
 assert.equal(weekday('2026-11-23'),0);assert.equal(weekday('2026-11-27'),4);assert.equal(weekday('2026-11-28'),5);
 assert.equal(addDays('2026-11-30',1),'2026-12-01');assert.equal(addDays('2027-01-01',-1),'2026-12-31');
 assert.throws(()=>isoDate('2026-02-29'),/imposible/);assert.equal(isoDate('2028-02-29'),'2028-02-29');
});
test('sesiones de lunes a viernes: clases de grupos, asignatura manual y tipos docentes',()=>{
 const {d,g,y}=setup();slot(d,g);saveSlot(d,{day:2,start:'09:00',end:'10:00',type:'class',label:'Filosofía'});
 for(const [i,type] of ['guardia','familias','complementaria','departamento','jefatura','otro'].entries()){
  const h=String(11+i).padStart(2,'0');
  saveSlot(d,{day:3,start:h+':00',end:h+':55',type});
 }
 assert.equal(y.slots.length,8);assert.equal(daySlots(y,'2026-11-23').length,1);assert.equal(daySlots(y,'2026-11-25')[0].label,'Filosofía');assert.equal(daySlots(y,'2026-11-26').length,6);
 assert.equal(daySlots(y,'2026-11-28').length,0);assertModel(d);
});
test('rechaza grupo incorrecto, hora imposible, superposición invertida y fin de semana',()=>{
 const {d,g}=setup();assert.throws(()=>saveSlot(d,{day:5,start:'10:00',end:'11:00',type:'class',groupId:g.id}),/lunes a viernes/);
 assert.throws(()=>saveSlot(d,{day:0,start:'11:00',end:'10:00',type:'class',groupId:g.id}),/horas válidas/);
 assert.throws(()=>saveSlot(d,{day:0,start:'11:99',end:'12:00',type:'class',groupId:g.id}),/horas válidas/);
 assert.throws(()=>saveSlot(d,{day:0,start:'10:00',end:'11:00',type:'class',groupId:'missing'}),/Grupo/);
 assert.throws(()=>saveSlot(d,{day:0,start:'10:00',end:'11:00',type:'class'}),/asignatura/);
 assert.throws(()=>saveSlot(d,{day:0,start:'10:00',end:'11:00',type:'guardia',groupId:g.id}),/Solo las clases/);
});
test('examen del cuaderno usa hora del horario, incluso con cambios de hora',()=>{
 const {d,g,y}=setup(),s=slot(d,g),a=d.assessments[0];
 assert.equal(findExamSlots(y,g.id,'2026-11-23').length,1);
 const e=saveEvent(d,{type:'exam',title:'Examen UD1',date:'2026-11-23',groupId:g.id,assessmentId:a.id,slotId:s.id});
 assert.equal(e.time,'08:00');assert.equal(e.assessmentId,a.id);
 assert.throws(()=>saveEvent(d,{type:'exam',title:'Duplicado',date:'2026-11-30',groupId:g.id,assessmentId:a.id}),/ya está programado/);
 saveException(d,{date:'2026-11-30',slotId:s.id,type:'move',start:'11:30',end:'12:30'});
 const next=saveEvent(d,{type:'exam',title:'Examen extra',date:'2026-11-30',groupId:g.id,slotId:s.id});
 assert.equal(next.time,'11:30');assert.equal(findExamSlots(y,g.id,'2026-11-30')[0].effectiveStart,'11:30');assertModel(d);
});
test('varias sesiones mismo día dan alternativas, sin seleccionar arbitrariamente',()=>{
 const {d,g,y}=setup();slot(d,g,0,'08:00','08:55');slot(d,g,0,'12:00','12:55');
 assert.deepEqual(findExamSlots(y,g.id,'2026-11-23').map(s=>s.start),['08:00','12:00']);
 assert.equal(saveEvent(d,{type:'exam',date:'2026-11-23',title:'Parcial',groupId:g.id,time:'13:00'}).time,'13:00');
});
test('sin clase programada permite examen con hora manual; no inventa horas',()=>{
 const {d,g}=setup();const e=saveEvent(d,{type:'exam',date:'2026-11-25',title:'Examen extraordinario',groupId:g.id,time:'15:30'});
 assert.equal(e.time,'15:30');assert.equal(e.slotId,null);assert.throws(()=>saveEvent(d,{type:'exam',date:'2026-11-25',title:'Hora inválida',time:'29:00'}),/Hora/);
});
test('eliminar actividad del cuaderno conserva evento programado sin vínculo roto',()=>{
 const {d,g}=setup(),a=d.assessments[0];const ev=saveEvent(d,{type:'exam',date:'2026-11-23',title:'Examen',groupId:g.id,assessmentId:a.id});
 removeAssessment(d,a.id);assert.equal(ev.assessmentId,null);assertModel(d);
});
test('festivos individuales e intervalos ocultan clases pero mantienen exámenes existentes',()=>{
 const {d,g,y}=setup();slot(d,g);saveEvent(d,{type:'exam',date:'2026-11-23',title:'Examen',groupId:g.id,time:'08:00'});
 saveHoliday(d,{name:'Festivo local',start:'2026-11-23'});assert.equal(daySlots(y,'2026-11-23').length,0);assert.equal(y.events.length,1);
 saveHoliday(d,{name:'Navidad',start:'2026-12-23',end:'2027-01-06'});
 assert.equal(y.holidays.length,2);assert.throws(()=>saveHoliday(d,{name:'Fuera',start:'2027-07-20'}),/fuera/);assertModel(d);
});
test('planificación diaria separa trabajo previsto de realización opcional',()=>{
 const {d,g,y}=setup(),s=slot(d,g,2);const before=structuredClone(d.grades);
 const l=saveLesson(d,{date:'2026-11-25',slotId:s.id,planned:'Adjetivos en Latín I'});
 assert.equal(l.done,false);assert.equal(l.actual,'');
 saveLesson(d,{id:l.id,date:l.date,slotId:s.id,planned:l.planned,done:true,actual:'Terminados los ejercicios'});
 assert.equal(y.lessons[0].actual,'Terminados los ejercicios');assert.deepEqual(d.grades,before);assertModel(d);
});
test('una planificación por sesión y fecha; otra en diferente fecha permitida',()=>{
 const {d,g}=setup(),s=slot(d,g);saveLesson(d,{date:'2026-11-23',slotId:s.id,planned:'Traducir'});
 assert.throws(()=>saveLesson(d,{date:'2026-11-23',slotId:s.id,planned:'Duplicado'}),/Ya hay una planificación/);
 saveLesson(d,{date:'2026-11-30',slotId:s.id,planned:'Traducir otra'});assertModel(d);
});
test('trasladar pendiente encuentra siguiente clase lectiva, saltando festivo y cancelación',()=>{
 const {d,g,y}=setup(),s=slot(d,g);saveHoliday(d,{name:'Sin clase',start:'2026-11-30'});
 saveException(d,{date:'2026-12-07',slotId:s.id,type:'cancel'});
 const l=saveLesson(d,{date:'2026-11-23',slotId:s.id,planned:'Analizar un texto'});
 assert.equal(nextClassDate(y,s.id,l.date),'2026-12-14');const moved=carryLesson(d,l.id);
 assert.equal(moved.date,'2026-12-14');assert.equal(moved.planned,'Analizar un texto');assert.equal(l.planned,'');assertModel(d);
});
test('cambios excepcionales no cambian el horario base ni afectan a otros días',()=>{
 const {d,g,y}=setup(),s=slot(d,g);saveException(d,{date:'2026-11-23',slotId:s.id,type:'replace',label:'Excursión'});
 assert.equal(daySessions(y,'2026-11-23')[0].exception.label,'Excursión');assert.equal(daySessions(y,'2026-11-30')[0].exception,undefined);
 assert.throws(()=>saveException(d,{date:'2026-11-23',slotId:s.id,type:'cancel'}),/Ya existe/);
 assert.throws(()=>saveEvent(d,{type:'exam',title:'Examen',date:'2026-11-23',groupId:g.id,slotId:s.id}),/no está disponible/);
 assertModel(d);
});
test('nuevo curso conserva agenda e historial anterior, copia solamente estructura del horario',()=>{
 const {d,g,y}=setup(),s=slot(d,g);saveTask(d,{title:'Corregir',dueDate:'2026-11-26'});
 const next=addAcademicYear(d,{name:'2027-2028',start:'2027-09-01',end:'2028-06-30',copyFrom:y.id});
 assert.equal(next.slots.length,1);assert.equal(next.events.length,0);assert.equal(next.tasks.length,0);
 assert.equal(next.slots[0].groupId,null);assert.match(next.slots[0].label,/Latín I/);
 assert.notEqual(next.slots[0].id,s.id);assert.equal(d.planner.years.length,2);
 setActiveYear(d,y.id);assert.equal(activeYear(d).tasks[0].title,'Corregir');assertModel(d);
});
test('reutiliza el grupo del siguiente año si coincide nombre y asignatura',()=>{
 const {d,g,y}=setup();slot(d,g);const newer=addGroup(d,g.name,g.subject,'2027-2028',g.level);
 const next=addAcademicYear(d,{name:'2027-2028',start:'2027-09-01',end:'2028-06-30',copyFrom:y.id});
 assert.equal(next.slots[0].groupId,newer.id);assertModel(d);
});
test('fechas del curso se pueden corregir sin alterar horario ni notas',()=>{
 const {d,y}=setup(),grades=JSON.stringify(d.grades);
 updateAcademicYear(d,y.id,{name:'2026–27',start:'2026-08-31',end:'2027-07-02'});
 assert.equal(y.start,'2026-08-31');assert.equal(JSON.stringify(d.grades),grades);
 assert.throws(()=>updateAcademicYear(d,y.id,{start:'2027-09-01',end:'2027-06-30'}),/Fechas/);assertModel(d);
});
test('borrar sesión conserva trabajo diario y mantiene formato de un evento desligado',()=>{
 const {d,g,y}=setup(),s=slot(d,g),lesson=saveLesson(d,{date:'2026-11-23',slotId:s.id,planned:'Adjetivos'}),e=saveEvent(d,{date:'2026-11-23',title:'Prueba',type:'exam',slotId:s.id,groupId:g.id});
 removeSlot(d,s.id);assert.equal(lesson.slotId,null);assert.equal(e.slotId,null);assert.equal(e.time,'08:00');assertModel(d);
});
test('tareas con estado, eliminación reversible vía historial y cierre del modelo',()=>{
 const {d,y}=setup(),t=saveTask(d,{title:'Enviar actas',dueDate:'2026-11-25',notes:'Revisar puntuaciones'});
 saveTask(d,{...t,done:true});assert(y.tasks[0].done);deletePlannerItem(d,'tasks',t.id);assert.equal(y.tasks.length,0);
 assert.throws(()=>deletePlannerItem(d,'grades','x'),/Apartado inválido/);assertModel(d);
});
test('modelo prohíbe referencias de curso y eventos corruptos sin sobrescribir datos válidos',()=>{
 const {d,g,y}=setup(),s=slot(d,g);y.events.push({id:crypto.randomUUID(),date:'2026-11-25',type:'exam',title:'Falso',groupId:g.id,assessmentId:'no existe',slotId:null,time:'08:00'});
 assert.throws(()=>assertModel(d),/Evento inválido/);y.events.pop();
 y.slots[0].day=8;assert.throws(()=>assertModel(d),/Horario inválido/);y.slots[0].day=0;assertModel(d);
});
test('interfaz del planificador tiene navegación, agenda, horario, tareas y enlace desde el cuaderno',()=>{
 const code=readFileSync(new URL('../app.js',import.meta.url),'utf8'),planner=readFileSync(new URL('../src/planner-ui.js',import.meta.url),'utf8'),sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 for(const x of ['renderPlanner','bindPlanner','id="schedule-exam"','id="plan-assessment"',"'planificador'"])assert(code.includes(x),x);
 for(const x of ['plan-add-slot','plan-add-event','plan-add-lesson','plan-add-holiday','plan-new-year','planner-view-btn','planner-month','planner-week','plan-export-ics'])assert(planner.includes(x),x);
 for(const x of ['./src/planner.js','./src/planner-ui.js'])assert(sw.includes(x));
});

test('cambiar la hora semanal sincroniza el examen, cambiar el día conserva la cita manual',()=>{
 const {d,g,y}=setup(),s=slot(d,g,0,'08:00','08:55'),a=d.assessments[0];
 const e=saveEvent(d,{type:'exam',date:'2026-11-23',title:a.name,groupId:g.id,assessmentId:a.id,slotId:s.id});
 saveSlot(d,{id:s.id,day:0,start:'09:00',end:'09:55',type:'class',groupId:g.id});assert.equal(e.time,'09:00');
 saveSlot(d,{id:s.id,day:2,start:'09:00',end:'09:55',type:'class',groupId:g.id});assert.equal(e.slotId,null);assert.equal(e.date,'2026-11-23');assertModel(d);
});
test('editar el nombre del examen enlazado actualiza el título automático sin pisar títulos personalizados',async()=>{
 const {updateAssessment}=await import('../src/model.js');
 const {d,g}=setup(),a=d.assessments[0];
 const auto=saveEvent(d,{type:'exam',date:'2026-11-23',title:a.name,groupId:g.id,assessmentId:a.id,time:'08:00'});
 updateAssessment(d,a.id,{name:'Examen de morfología'});assert.equal(auto.title,'Examen de morfología');
 auto.title='Examen extraordinario personalizado';updateAssessment(d,a.id,{name:'Examen UD3'});
 assert.equal(auto.title,'Examen extraordinario personalizado');assertModel(d);
});
test('deshacer y rehacer conserva los datos del horario y las notas del alumno',async()=>{
 const {recordChange,stepHistory,emptyHistory}=await import('../src/history.js');
 const {d,g}=setup(),before=structuredClone(d),grades=structuredClone(d.grades);
 slot(d,g);
 const h=recordChange(emptyHistory(),before,d,'Añadir horario');const undo=stepHistory(h,d,'undo');
 assert.equal(activeYear(undo.doc).slots.length,0);assert.deepEqual(undo.doc.grades,grades);
 const redo=stepHistory(undo.history,undo.doc,'redo');assert.equal(activeYear(redo.doc).slots.length,1);assert.deepEqual(redo.doc.grades,grades);
});
test('copia cifrada .cdoc puede guardar y recuperar un planificador sin modificar evaluaciones',async()=>{
 const {createVault,unlockVault}=await import('../src/vault.js');
 const {d,g}=setup();slot(d,g);saveHoliday(d,{name:'Puente',start:'2026-12-07',end:'2026-12-08'});
 const password='contraseña_segura_de_ensayo_2026';
 const {envelope}=await createVault(password,d);
 const opened=await unlockVault(password,envelope);assertModel(opened.doc);
 assert.deepEqual(opened.doc.planner,d.planner);assert.deepEqual(opened.doc.grades,d.grades);
});
test('los desplegables de edición conservan el valor existente',()=>{
 const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert.match(source,/f\.options\.map\(o=>opt\(o\.value,o\.label,f\.value\)\)/);
});
