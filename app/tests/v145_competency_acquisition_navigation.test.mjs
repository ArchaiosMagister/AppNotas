import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initialNotebook,assertModel} from '../src/model.js';
import {
  competencyAcquisitionLevel,competencyAcquisitionLabel,
  COMPETENCY_ACQUISITION_LABELS,overallGrade
} from '../src/calculations.js';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('escala descendente y límites exactos sobre 0–10, sin redondeo previo',()=>{
  const cases=[
    [0,4],[1,4],[4.9999999,4],[5,3],[5.000001,3],[6.49,3],
    [6.4999999,3],[6.5,2],[6.500001,2],[7.999999,2],
    [8,1],[8.000001,1],[9.5,1],[10,1]
  ];
  for(const [grade,expected] of cases)
    assert.equal(competencyAcquisitionLevel(grade),expected,'Nota '+grade);
  assert.equal(competencyAcquisitionLevel(7.999999),2,'No redondear 7.999999 a 8 antes de clasificar');
  assert.equal(competencyAcquisitionLevel(4.999999),4,'El 4 solo corresponde a suspenso');
});
test('sin nota, notas inválidas y ausencia de datos no producen nivel',()=>{
  for(const value of [null,undefined,NaN,Infinity,-Infinity,-0.01,11,'8',{},false])
    assert.equal(competencyAcquisitionLevel(value),null,String(value));
  for(const value of [null,undefined,NaN,-1,11])
    assert.equal(competencyAcquisitionLabel(value),null);
});
test('los cuatro descriptores corresponden al nivel de adquisición y no a calificaciones 1–4',()=>{
  assert.deepEqual({...COMPETENCY_ACQUISITION_LABELS},
    {1:'Adquisición alta',2:'Adquisición media',3:'Adquisición baja',4:'No adquirida'});
  assert.equal(competencyAcquisitionLabel(10),'Adquisición alta');
  assert.equal(competencyAcquisitionLabel(7),'Adquisición media');
  assert.equal(competencyAcquisitionLabel(6),'Adquisición baja');
  assert.equal(competencyAcquisitionLabel(4),'No adquirida');
});
test('la conversión competencial no muta notas ni cambia las medias oficiales de evaluación',()=>{
  const doc=initialNotebook(),before=structuredClone(doc);
  const student=doc.students[0],group=doc.groups[0],period=doc.periods[0];
  const original=overallGrade(doc,student.id,group.id,period.id);
  for(let grade=0;grade<=10;grade+=0.125)competencyAcquisitionLevel(grade);
  assert.deepEqual(doc,before);
  assert.equal(overallGrade(doc,student.id,group.id,period.id),original);
  assertModel(doc);
});
test('resultados de competencias oficiales y personalizadas muestran nivel, descriptor y media original',async()=>{
  const app=await read('app.js');
  const begin=app.indexOf('function renderCompetencies(){'),end=app.indexOf('function currentCurriculum(){',begin);
  assert(begin>0&&end>begin);
  const text=app.slice(begin,end);
  assert(text.includes('competencyLevelChip(competencyGrade('),'Rama de competencias personalizadas');
  assert(text.includes('const currentGrade=(student,comp)=>comp?.id?competencyLevelChip(competencyGrade('),'Rama oficial');
  assert(!text.includes('gradeChip(competencyGrade('),'No mostrar nota de 0–10 como único resultado');
  assert.equal((text.match(/competencyScaleLegend\(\)/g)||[]).length,2,'Leyenda en las dos ramas');
  const level=app.slice(app.indexOf('function competencyLevelChip('),app.indexOf('function competencyScaleLegend('));
  assert(level.includes('competencyAcquisitionLevel(score)'));
  assert(level.includes('competencyAcquisitionLabel(score)'));
  assert(level.includes("sourceLabel='Media original'"));
  assert(level.includes('${esc(sourceLabel)}:'));
  assert(level.includes('aria-label="Nivel'));
  assert(level.includes('Sin evidencias'));
  assert(app.includes('Nivel de adquisición de la media'),'Estadísticas de clase usan el nivel medio');
});
test('Cálculos y Competencias se encuentran juntos en la navegación secundaria del cuaderno',async()=>{
 const app=await read('app.js');
 const start=app.indexOf('const ACADEMIC_WORKSPACE_TABS='),end=app.indexOf('const NOTEBOOK_WORKSPACE_TABS=',start);
 const tools=app.slice(start,end);
 assert(!tools.includes("['calculos'"));
 assert(!tools.includes("['competencias'"));
 assert(tools.includes("['curriculo'"));
 assert(tools.includes("['rubricas'"));
 const secondary=app.slice(end,app.indexOf('function renderPeriodButtons(){',end));
 for(const key of ['cuaderno','calculos','competencias','alumno'])
  assert(secondary.includes("['"+key+"'"),key);
 assert(!secondary.includes("['final'"),'Final se sitúa junto a los períodos');
 const notebook=app.slice(app.indexOf('function renderNotebook(){'),app.indexOf('const ITACA_OPTIONS='));
 assert(notebook.includes('id="new-student"')&&notebook.includes('id="new-assessment"'));
 assert(!notebook.includes('id="notebook-calculations"'));
 assert(!notebook.includes('id="notebook-competencies"'));
});
test('navegación directa entre las cinco vistas del cuaderno sin volver a la portada',async()=>{
 const app=await read('app.js');
 const start=app.indexOf('const NOTEBOOK_WORKSPACE_TABS='),end=app.indexOf('function renderPeriodButtons(){',start);
 assert(start>0&&end>start);
 const quick=app.slice(start,end);
 for(const value of ['cuaderno','calculos','competencias','alumno'])
  assert(quick.includes("['"+value+"'"),value);
 assert(!quick.includes("['final'"),'La vista final se abre desde la barra de períodos');
 assert(app.includes('data-academic-quick="final"'),'El acceso a la evaluación final sigue disponible');
 assert(quick.includes('data-academic-quick="${key}"'));
 assert(quick.includes('aria-current="page"'));
 assert(app.includes("hasGroup&&['cuaderno','calculos','competencias','final','alumno'].includes(STATE.tab)?renderAcademicQuickNav():''"));
 assert(app.includes("document.querySelectorAll('[data-academic-quick]').forEach"));
 assert(app.includes("if(!['cuaderno','calculos','competencias','final','alumno'].includes(destination)||!STATE.groupId)return"));
 assert(!app.includes("$('#notebook-calculations')?.addEventListener("),'No duplicar los manejadores');
});
test('legibilidad en iPad, teléfono, temas oscuro y OLED',async()=>{
  const css=await read('styles.css');
  assert(css.includes('.competency-level-badge'));
  assert(css.includes('.competency-source-grade'));
  assert(css.includes('.competency-scale-items'));
  assert(css.includes('.competency-level-4'));
  assert(css.includes('html[data-theme="dark"] .competency-level-4'));
  assert(css.includes('html[data-theme="oled"] .competency-level-4'));
  assert(css.includes('.academic-quick-nav'));
  assert(css.includes('.notebook-primary-actions #notebook-competencies'));
  assert(css.includes('@media(max-width:540px)'));
  assert(css.includes('grid-column:auto;min-width:0;width:100%'));
  assert(css.includes('min-height:43px'));
});
test('nombres del menú y escala de adquisición no afectan a la persistencia ni las copias cifradas',async()=>{
  const [app,calculation,sw]=await Promise.all([read('app.js'),read('src/calculations.js'),read('sw.js')]);
  assert(app.includes('<summary>Materias y grupos'));
  assert(!app.includes('<summary>Opciones de grupo'));
  const current=sw.match(/const CACHE='(cuaderno-docente-static-v(\d+)-dev)'/);
  assert(current&&Number(current[2])>=150,'La nueva caché no puede retroceder de v150');
  assert(app.includes(`caches.open('${current[1]}')`),'La UI y el service worker deben usar la misma caché');
  
  assert(!calculation.includes("doc.settings.competencyAcquisition"),'No guardar indicadores derivados');
});
