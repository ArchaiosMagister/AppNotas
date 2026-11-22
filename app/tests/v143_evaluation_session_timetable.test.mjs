import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initialNotebook,assertModel,addGroup} from '../src/model.js';
import {overallGrade} from '../src/calculations.js';
import {
 DEFAULT_TIMETABLE_BANDS,createPlanner,activeYear,scheduleBands,saveTimetableBand,removeTimetableBand,
 saveSlot,saveEvent,addAcademicYear,setActiveYear,assertPlanner
} from '../src/planner.js';
import {renderTimetableGrid,renderPlanner} from '../src/planner-ui.js';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const setup=()=>{const doc=initialNotebook();return {doc,year:activeYear(doc),group:doc.groups[0],student:doc.students[0],period:doc.periods[0]};};
const bands=[
 ['hora-1','08:00','08:55','lesson'],
 ['hora-2','08:55','09:50','lesson'],
 ['hora-3','09:50','10:45','lesson'],
 ['patio-1','10:45','11:15','break'],
 ['hora-4','11:15','12:10','lesson'],
 ['hora-5','12:10','13:05','lesson'],
 ['hora-6','13:05','14:00','lesson'],
 ['patio-2','14:00','14:20','break'],
 ['hora-7','14:20','15:15','lesson']
];

test('el horario nuevo contiene exactamente las siete horas y ambos patios',()=>{
  const {doc,year}=setup();
  assert.deepEqual(DEFAULT_TIMETABLE_BANDS.map(b=>[b.id,b.start,b.end,b.kind]),bands);
  assert.deepEqual(scheduleBands(year).map(b=>[b.id,b.start,b.end,b.kind]),bands);
  assert.equal(year.slots.length,0,'Las franjas no inventan clases');
  assert.equal(doc.grades.length>0,true);
  assertModel(doc);
});

test('el horario semanal muestra 9 filas, lunes a viernes y botones táctiles de asignación',()=>{
  const {doc,year}=setup(),html=renderTimetableGrid(doc,year);
  assert.match(html,/Horario semanal personalizable/);
  for(const time of bands)assert(html.includes(time[1]+'–'+time[2]));
  for(const day of ['Lunes','Martes','Miércoles','Jueves','Viernes'])assert(html.includes(day));
  assert.equal((html.match(/data-band-slot=/g)||[]).length,45);
  assert.equal((html.match(/data-edit-band=/g)||[]).length,9);
  assert.equal((html.match(/data-band-day=/g)||[]).length,45);
  assert(html.includes('Primer patio'));
  assert(html.includes('Segundo patio'));
  assert(html.includes('data-band-slot="hora-7"'));
  assert(html.includes('id="plan-add-band"'));
});

test('tocar franja asigna clase del cuaderno y guarda aula en el mismo cuaderno',()=>{
  const {doc,year,group}=setup(),first=scheduleBands(year)[0];
  const saved=saveSlot(doc,{day:0,start:first.start,end:first.end,type:'class',groupId:group.id,
    room:'Aula 2.12',bandId:first.id});
  assert.equal(saved.room,'Aula 2.12');
  assert.equal(saved.bandId,first.id);
  const html=renderTimetableGrid(doc,year);
  assert(html.includes(group.subject));
  assert(html.includes(group.name));
  assert(html.includes('Aula: Aula 2.12'));
  assert(html.includes('data-edit-slot="'+saved.id+'"'));
  assertModel(doc);
});

test('se puede escribir una materia no presente en el cuaderno sin crear alumnos o grupos',()=>{
  const {doc,year}=setup(),first=scheduleBands(year)[3];
  const groups=doc.groups.length,students=doc.students.length;
  const slot=saveSlot(doc,{day:2,start:first.start,end:first.end,type:'class',label:'Atención Educativa',
    room:'Aula de apoyo',bandId:first.id});
  const html=renderTimetableGrid(doc,year);
  assert(html.includes('Atención Educativa'));
  assert(html.includes('Aula: Aula de apoyo'));
  assert.equal(slot.groupId,null);
  assert.equal(doc.groups.length,groups);
  assert.equal(doc.students.length,students);
  assertModel(doc);
});

test('nombres y aulas manuales se escapan para evitar inyección de HTML',()=>{
  const {doc,year}=setup(),band=scheduleBands(year)[0];
  saveSlot(doc,{day:3,start:band.start,end:band.end,type:'class',label:'<img src=x onerror=alert(1)>',
    room:'<script>alert(2)</script>',bandId:band.id});
  const html=renderTimetableGrid(doc,year);
  assert(!html.includes('<img'));
  assert(!html.includes('<script'));
  assert(html.includes('&lt;img'));
  assert(html.includes('&lt;script'));
  assertModel(doc);
});

test('editar una franja conserva su clase, aula, fecha de examen y sincroniza su hora',()=>{
  const {doc,year,group,student,period}=setup(),grades=structuredClone(doc.grades);
  const original=overallGrade(doc,student.id,group.id,period.id);
  const band=scheduleBands(year)[0];
  const slot=saveSlot(doc,{day:0,start:band.start,end:band.end,type:'class',groupId:group.id,
    bandId:band.id,room:'B-14'});
  const event=saveEvent(doc,{date:'2026-11-23',type:'exam',title:'Examen UD3',groupId:group.id,slotId:slot.id});
  saveTimetableBand(doc,{...band,start:'08:05'});
  assert.equal(slot.start,'08:05');
  assert.equal(event.time,'08:05');
  assert.equal(event.slotId,slot.id);
  assert.equal(slot.room,'B-14');
  assert.deepEqual(doc.grades,grades);
  assert.equal(overallGrade(doc,student.id,group.id,period.id),original);
  assertModel(doc);
});

test('no se aceptan horarios solapados ni horas invertidas ni aulas excesivamente largas',()=>{
  const {doc,year,group}=setup(),before=structuredClone(year.bands);
  assert.throws(()=>saveTimetableBand(doc,{...scheduleBands(year)[0],end:'09:30'}),/Franjas inválidas/);
  assert.throws(()=>saveTimetableBand(doc,{...scheduleBands(year)[0],start:'09:55'}),/Franjas inválidas/);
  assert.deepEqual(year.bands,before);
  assert.throws(()=>saveSlot(doc,{day:0,start:'08:00',end:'08:55',type:'class',
    groupId:group.id,room:'A'.repeat(61)}),/aula/);
  assert.throws(()=>saveSlot(doc,{day:0,start:'09:50',end:'10:45',type:'class',
    groupId:group.id,bandId:'hora-1'}),/franja/);
  assertModel(doc);
});

test('puede añadirse, editarse y eliminarse una franja personalizada sin datos perdidos',()=>{
  const {doc,year}=setup();
  const extra=saveTimetableBand(doc,{label:'8.ª hora',start:'15:15',end:'16:10',kind:'lesson'});
  assert.equal(scheduleBands(year).length,10);
  saveTimetableBand(doc,{id:extra.id,label:'8.ª hora personalizada',start:'15:20',end:'16:10',kind:'lesson'});
  assert.equal(scheduleBands(year).at(-1).start,'15:20');
  removeTimetableBand(doc,extra.id);
  assert.equal(scheduleBands(year).length,9);
  assertModel(doc);
});

test('impide eliminar franjas con clases enlazadas hasta retirar asignaciones',()=>{
  const {doc,year,group}=setup(),band=scheduleBands(year)[1];
  saveSlot(doc,{day:1,start:band.start,end:band.end,type:'class',groupId:group.id,bandId:band.id});
  assert.throws(()=>removeTimetableBand(doc,band.id),/Retira primero las clases/);
  assert.equal(scheduleBands(year).length,9);
  assertModel(doc);
});

test('los cuadernos antiguos sin campo bands conservan sus clases, horarios y calificaciones',()=>{
  const {doc,year,group}=setup();
  const saved=saveSlot(doc,{day:2,start:'09:10',end:'10:00',type:'class',
    groupId:group.id,room:'Aula antigua'});
  delete year.bands;
  const current=structuredClone(doc.grades);
  assert.equal(scheduleBands(year).length,9);
  const html=renderTimetableGrid(doc,year);
  assert(html.includes('Otras sesiones guardadas'));
  assert(html.includes('Aula: Aula antigua'));
  assert(html.includes('data-edit-slot="'+saved.id+'"'));
  assert.deepEqual(doc.grades,current);
  assertPlanner(doc);
  assertModel(doc);
});

test('copiar año lleva franjas personalizadas y aulas sin eventos del año anterior',()=>{
  const {doc,year,group}=setup(),band=scheduleBands(year)[0];
  saveTimetableBand(doc,{...band,start:'08:05'});
  saveSlot(doc,{day:0,start:'08:05',end:'08:55',type:'class',groupId:group.id,
    room:'Sala 4',bandId:'hora-1'});
  const newGroup=addGroup(doc,group.name,group.subject,'2027-2028',group.level);
  const copied=addAcademicYear(doc,{name:'2027-2028',start:'2027-09-01',end:'2028-06-30',copyFrom:year.id});
  assert.equal(copied.slots.length,1);
  assert.equal(copied.slots[0].groupId,newGroup.id);
  assert.equal(copied.slots[0].room,'Sala 4');
  assert.equal(copied.slots[0].bandId,'hora-1');
  assert.equal(copied.bands[0].start,'08:05');
  assert.notEqual(copied.slots[0].id,year.slots[0].id);
  setActiveYear(doc,year.id);assertModel(doc);
});

test('no modifica el cálculo académico al usar la sesión de evaluación',async()=>{
  const {doc,year,group,student,period}=setup();
  const expected=overallGrade(doc,student.id,group.id,period.id);
  const grades=structuredClone(doc.grades);
  renderTimetableGrid(doc,year);
  renderPlanner(doc,{plannerMode:'schedule',plannerDate:'2026-11-23'});
  assert.equal(overallGrade(doc,student.id,group.id,period.id),expected);
  assert.deepEqual(doc.grades,grades);
  assertModel(doc);
  const js=await read('app.js');
  assert(js.includes("['alumno','Modo sesión de evaluación','◉']"));
  assert(js.includes('Modo sesión de evaluación · '));
  assert(js.includes('Mostrar también en el Modo sesión de evaluación'));
  assert(js.includes("STATE.tab==='alumno'"),'El ID interno sigue estable por compatibilidad');
});

test('los formularios permiten aula, clase del cuaderno, materia libre, edición y eliminar',async()=>{
  const [ui,css]=await Promise.all([read('src/planner-ui.js'),read('styles.css')]);
  for(const snippet of ['data-band-slot','data-band-day','data-edit-band','data-edit-slot',
    "id:'room',label:'Aula (opcional)'","id:'groupId',label:'Clase del cuaderno",
    "id:'label',label:'Otra asignatura / actividad","function bandModal(",
    'saveTimetableBand(d,','removeTimetableBand(d,','bandId:validBand'])
    assert(ui.includes(snippet),'No aparece: '+snippet);
  assert(css.includes('/* v143 · Horario base docente'));
  assert(css.includes('.planner-timetable-scroll{'));
  assert(css.includes('.planner-timetable-assignment'));
  assert(css.includes('html[data-theme="oled"] .planner-timetable-scroll'));
  assert(css.includes('@media(max-width:640px)'));
  assert(css.includes('min-width:815px'));
});

test('ni el horario ni las etiquetas requieren comunicación externa o una migración de notas',async()=>{
 const [ui,planner,workflow]=await Promise.all([read('src/planner-ui.js'),read('src/planner.js'),read('../.github/workflows/pages.yml')]);
 assert(!planner.includes('fetch('));
 assert(!ui.includes('fetch('));
 assert(!workflow.includes('actions/deploy-pages@'));
 assert(!workflow.includes('actions/upload-pages-artifact@'));
});
