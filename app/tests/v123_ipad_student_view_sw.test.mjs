import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {emptyNotebook,addGroup,addStudent,addAssessment,setGrade,assertModel,
  sortStudentPeriodActivities,STUDENT_ACTIVITY_SORT_MODES,
  groupOrthographyRefundable,setGroupOrthographyRefundable,setOrthographyGrade} from '../src/model.js';
import {overallGrade,effectiveAssessmentScore} from '../src/calculations.js';

const fixture=()=>{
  const doc=emptyNotebook();
  const group=addGroup(doc,'Latín I optativa','Latín I','2026-2027','1bach');
  const student=addStudent(doc,group.id,{firstName:'Ana',lastName:'García',originGroup:'1.º A'});
  const period=doc.periods[0];
  return {doc,group,student,period};
};
const orth={enabled:true,penaltyPerFault:.1,repetitions:30,refundable:true};

test('grupo: las notas se devuelven o no según configuración local, incluso con varios grupos',()=>{
  const f=fixture();
  const other=addGroup(f.doc,'Latín I B','Latín I','2026-2027','1bach');
  const a=addAssessment(f.doc,{name:'Examen con faltas',groupId:f.group.id,periodId:f.period.id,categoryId:f.doc.categories[0].id,orthography:orth});
  const b=addAssessment(f.doc,{name:'Examen segundo grupo',groupId:other.id,periodId:f.period.id,categoryId:f.doc.categories[0].id,orthography:orth});
  setOrthographyGrade(f.doc,f.student.id,a.id,{score:8,faults:3,delivered:false});
  const before=overallGrade(f.doc,f.student.id,f.group.id,f.period.id);
  assert.equal(before,7.7);
  setGroupOrthographyRefundable(f.doc,f.group.id,false);
  assert.equal(groupOrthographyRefundable(f.doc,f.group.id),false);
  assert.equal(a.orthography.refundable,false);
  assert.equal(b.orthography.refundable,true);
  assert.equal(overallGrade(f.doc,f.student.id,f.group.id,f.period.id),before);
  assert.throws(()=>setOrthographyGrade(f.doc,f.student.id,a.id,{score:8,faults:3,delivered:true}),/entrega|marcar/);
  // El control de grupo también se aplica a exámenes nuevos.
  const c=addAssessment(f.doc,{name:'Examen nuevo',groupId:f.group.id,periodId:f.period.id,categoryId:f.doc.categories[0].id});
  assert.equal(c.orthography.refundable,false);
  const d=addAssessment(f.doc,{name:'Nuevo de otro grupo',groupId:other.id,periodId:f.period.id,categoryId:f.doc.categories[0].id});
  assert.equal(d.orthography.refundable,true);
  assertModel(f.doc);
});

test('grupo: no puede desactivarse la devolución que ya se ha concedido; operación atómica',()=>{
  const f=fixture();
  const a=addAssessment(f.doc,{name:'Examen',groupId:f.group.id,periodId:f.period.id,categoryId:f.doc.categories[0].id,orthography:orth});
  setOrthographyGrade(f.doc,f.student.id,a.id,{score:8,faults:2,delivered:true});
  const before=structuredClone(f.doc);
  assert.throws(()=>setGroupOrthographyRefundable(f.doc,f.group.id,false),/Hay faltas ya entregadas/);
  assert.deepEqual(f.doc,before);
  assert.equal(effectiveAssessmentScore(f.doc,a,f.doc.grades[0]),8);
  assert.throws(()=>setGroupOrthographyRefundable(f.doc,f.group.id,'false'),/inválida/);
  assert.deepEqual(f.doc,before);
  assertModel(f.doc);
});

test('grupo: activar devolución tras penalización conserva nota y permite recibir copias',()=>{
  const f=fixture();
  setGroupOrthographyRefundable(f.doc,f.group.id,false);
  const a=addAssessment(f.doc,{name:'Examen',groupId:f.group.id,periodId:f.period.id,categoryId:f.doc.categories[0].id});
  setOrthographyGrade(f.doc,f.student.id,a.id,{score:9,faults:2,delivered:false});
  assert.equal(overallGrade(f.doc,f.student.id,f.group.id,f.period.id),8.8);
  setGroupOrthographyRefundable(f.doc,f.group.id,true);
  setOrthographyGrade(f.doc,f.student.id,a.id,{score:9,faults:2,delivered:true});
  assert.equal(overallGrade(f.doc,f.student.id,f.group.id,f.period.id),9);
  assertModel(f.doc);
});

test('visor: cada evaluación admite distintos órdenes sin mutar documentos ni cálculos',()=>{
  const f=fixture();
  const category=f.doc.categories;
  const z=addAssessment(f.doc,{name:'Zoología',groupId:f.group.id,periodId:f.period.id,categoryId:category[1].id});
  const a=addAssessment(f.doc,{name:'Análisis',groupId:f.group.id,periodId:f.period.id,categoryId:category[0].id});
  const x=addAssessment(f.doc,{name:'Xilófono',groupId:f.group.id,periodId:f.period.id,categoryId:category[1].id});
  setGrade(f.doc,f.student.id,z.id,8);
  setGrade(f.doc,f.student.id,a.id,9);
  setGrade(f.doc,f.student.id,x.id,7);
  const original=structuredClone(f.doc);
  const before=overallGrade(f.doc,f.student.id,f.group.id,f.period.id);
  const names=mode=>sortStudentPeriodActivities(f.doc,f.group.id,f.period.id,mode).map(item=>item.name);
  assert.deepEqual(names('category'),['Análisis','Zoología','Xilófono']);
  assert.deepEqual(names('column'),['Zoología','Análisis','Xilófono']);
  assert.deepEqual(names('alphabetical'),['Análisis','Xilófono','Zoología']);
  assert.deepEqual(names('reverse'),['Xilófono','Análisis','Zoología']);
  assert.equal(STUDENT_ACTIVITY_SORT_MODES.length,4);
  assert.throws(()=>names('invalid'),/inválido/);
  assert.equal(overallGrade(f.doc,f.student.id,f.group.id,f.period.id),before);
  assert.deepEqual(f.doc,original);
});

test('Safari: SW limpia bandera de redirección SOLO en respuesta 200 HTML del ámbito correcto',async()=>{
  const source=await readFile(new URL('../sw.js',import.meta.url),'utf8');
  const listeners={};
  let cached=null,network=null,opened=null;
  const scope='https://appnotas-docente.pages.dev/';
  const worker={
    location:{origin:'https://appnotas-docente.pages.dev'},
    registration:{scope},
    clients:{claim:async()=>{}},
    addEventListener:(name,fn)=>{listeners[name]=fn;},
    skipWaiting:()=>{}
  };
  const cache={match:async()=>cached,addAll:async assets=>{opened=assets}};
  const caches={open:async()=>cache,keys:async()=>[],delete:async()=>true};
  const fakeNetwork=async()=>network;
  runInNewContext(source,{self:worker,caches,fetch:fakeNetwork,URL,Response,Promise,console});
  const withRequest=async(request)=>{
    let promise;
    const event={request,respondWith(p){promise=p}};
    listeners.fetch(event);
    return promise?await promise:undefined;
  };
  const base={ok:true,redirected:true,url:scope,status:200,statusText:'OK',
    headers:new Headers({'Content-Type':'text/html'}),body:'<html>válido</html>'};
  cached=base;
  let result=await withRequest({method:'GET',mode:'navigate',url:scope+'index.html'});
  assert(result instanceof Response);
  assert.equal(result.redirected,false);
  assert.equal(await result.text(),'<html>válido</html>');
  assert.equal(result.headers.get('content-type'),'text/html');
  result=await withRequest({method:'GET',mode:'navigate',url:scope});
  assert.equal(result.redirected,false);
  const plain=await withRequest({method:'GET',mode:'same-origin',url:scope+'app.js'});
  assert.equal(plain,base,'La normalización nunca se hace sobre scripts o recursos');
  assert.equal(await withRequest({method:'GET',mode:'navigate',url:'https://externo.example/'}),undefined);
  cached=null;network=base;
  result=await withRequest({method:'GET',mode:'navigate',url:scope+'index.html'});
  assert.equal(result.redirected,false,'También limpia redirects en navegación no almacenada');
  network={...base,url:'https://externo.example/other'};
  result=await withRequest({method:'GET',mode:'navigate',url:scope+'index.html'});
  assert.equal(result,network,'No disimular redirecciones a un sitio ajeno');
  let wait;
  listeners.install({waitUntil(p){wait=p}});
  await wait;
  assert(opened.includes('./')&&opened.includes('./index.html'));
});

test('interfaz: desplegables de período, rúbrica y criterio + Enter sin salto',async()=>{
  const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
  const css=await readFile(new URL('../styles.css',import.meta.url),'utf8');
  const begin=app.indexOf('function renderStudentView(){');
  const end=app.indexOf('function bindStudentView(){',begin);
  const view=app.slice(begin,end);
  assert(view.includes('data-student-period='));
  assert(view.includes('data-student-period-order='));
  assert(view.includes('student-rubric-breakdown'));
  assert(view.includes('student-rubric-item'));
  assert(view.includes('criterion.levels?.find'));
  assert(view.includes('level.description'));
  assert(view.includes('grade.notSubmitted?'));
  assert(view.includes('id="student-period-select"'));
  assert(view.includes('STATE.studentFull?renderActivities()'));
  assert(app.includes("localStorage.setItem('cuaderno-docente-student-activity-orders'"));
  assert(app.includes('setGroupOrthographyRefundable(d,g.id'));
  assert(app.includes('groupOrthographyRefundable(STATE.doc,STATE.groupId)'));
  assert(app.includes('snapshotGradeScroll()'));
  assert(app.includes('next.focus({preventScroll:true})'));
  assert(app.includes('requestAnimationFrame(()=>{restoreGradeScroll(position)'));
  assert(css.includes('.student-period-summary'));
  assert(css.includes('.student-rubric-item'));
  assert(css.includes('html[data-theme="oled"] .student-rubric-breakdown'));
});
