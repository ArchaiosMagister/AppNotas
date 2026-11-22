import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createPlanner,activeYear,scheduleBands,saveSlot,plannerSlotColor,setSummerSchedule} from '../src/planner.js';
import {renderTimetableGrid,renderPlanner,applyPlannerColors} from '../src/planner-ui.js';

const notebook=()=>{
 const planner=createPlanner('2026-2027');
 return {planner,groups:[],periods:[],students:[],updatedAt:''};
};

test('el color personalizado se guarda y se representa sin estilos inline prohibidos por CSP',()=>{
 const doc=notebook(),year=activeYear(doc),band=scheduleBands(year).find(b=>b.kind==='lesson');
 const slot=saveSlot(doc,{day:0,start:band.start,end:band.end,type:'class',label:'Latín I',color:'#3a8ec1',bandId:band.id});
 assert.equal(slot.color,'#3A8EC1');
 assert.equal(plannerSlotColor(slot),'#3A8EC1');
 const html=renderTimetableGrid(doc,year);
 assert.match(html,/data-planner-color="#3A8EC1"/);
 assert.doesNotMatch(html,/style="--planner-color:/);
 assert.match(html,/data-edit-slot="/);
 setSummerSchedule(doc,true);
 const summer=activeYear(doc).slots.find(s=>s.scheduleMode==='summer'&&s.type==='class');
 assert.equal(summer.color,'#3A8EC1','el horario de verano conserva la elección');
 assert.match(renderTimetableGrid(doc,activeYear(doc)),/data-planner-color="#3A8EC1"/);
});

test('las tarjetas de horario y agenda aplican la paleta mediante CSSOM y validan hexadecimales',()=>{
 const calls=[];
 const node=(color)=>({dataset:{plannerColor:color},style:{setProperty:(...args)=>calls.push(args)}});
 applyPlannerColors({querySelectorAll:()=>[node('#ac19ef'),node('#C0FFEE'),node('red'),node('url(javascript:alert(1))')]});
 assert.deepEqual(calls,[['--planner-color','#AC19EF'],['--planner-color','#C0FFEE']]);
 applyPlannerColors(null);
});

test('el calendario diario y semanal hereda el color de la sesión',()=>{
 const doc=notebook(),year=activeYear(doc),band=scheduleBands(year).find(b=>b.kind==='lesson');
 saveSlot(doc,{day:0,start:band.start,end:band.end,type:'class',label:'Griego',color:'#123ABC'});
 const ui={plannerMode:'week',plannerDate:'2026-11-16'};
 const html=renderPlanner(doc,ui);
 assert.match(html,/class="planner-slot [^"]*" data-planner-color="#123ABC"/);
});

test('las guardias se ordenan por mes y semana, sin duplicados ni pérdida de acciones',()=>{
 const doc=notebook(),year=activeYear(doc);
 const dates=['2026-10-30','2026-11-02','2026-11-04','2026-11-20','2026-12-01'];
 year.events=dates.map((date,i)=>({id:'patio-'+i,type:'patio',date,time:'10:45',endTime:'11:15',title:'Zona '+i,notes:'Zona lluvia '+i}));
 const html=renderPlanner(doc,{plannerMode:'patio',plannerDate:'2026-11-20'});
 assert.equal((html.match(/class="planner-patio-month"/g)||[]).length,3);
 assert.equal((html.match(/class="planner-patio-week"/g)||[]).length,4);
 assert.ok(html.indexOf('octubre')<html.indexOf('noviembre')&&html.indexOf('noviembre')<html.indexOf('diciembre'));
 for(let i=0;i<dates.length;i++){
  assert.equal((html.match(new RegExp('data-edit-event="patio-'+i+'"','g'))||[]).length,1);
  assert.equal((html.match(new RegExp('data-export-event="patio-'+i+'"','g'))||[]).length,1);
 }
 assert.match(html,/<details class="planner-patio-month" open>/);
 assert.match(html,/<details class="planner-patio-week" open>/);
 assert.match(html,/Semana del/);
});

test('sin guardias se conserva el mensaje inicial y la importación de Excel',()=>{
 const html=renderPlanner(notebook(),{plannerMode:'patio',plannerDate:'2026-11-20'});
 assert.match(html,/Sin guardias incorporadas/);
 assert.match(html,/id="plan-import-patio-panel"/);
});

test('los estilos no fuerzan colores de guardias o departamentos sobre los personalizados',async()=>{
 const css=await readFile(new URL('../styles.css',import.meta.url),'utf8');
 assert.doesNotMatch(css,/\.planner-slot\[data-plan-type="guardia"\][^{]*\{--planner-color:/);
 assert.match(css,/\.planner-patio-week>summary/);
 assert.match(css,/\.planner-timetable-assignment\{/);
});
