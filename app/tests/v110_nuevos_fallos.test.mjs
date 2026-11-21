import test from 'node:test';
import assert from 'node:assert/strict';
import {initialNotebook,addAssessment,setOrthographyGrade,updateAssessment,assertModel,createRubric,setRubricGrade,setOrthographyDefaults} from '../src/model.js';
import {overallGrade} from '../src/calculations.js';
import {parseRubricImport} from '../src/rubric-import.js';
import {parseRubricXlsx} from '../src/rubric-xlsx.js';
import {saveSlot,saveEvent} from '../src/planner.js';

const copy=v=>structuredClone(v);
const fixture=()=>{const d=initialNotebook(),g=d.groups[0],p=d.periods[0],student=d.students[0];return {d,g,p,student};};
const activeOrthography={enabled:true,penaltyPerFault:0.1,repetitions:30,refundable:true};

test('v1.10: no puede dejarse una nota entregada inconsistente al desactivar la devolución ortográfica',()=>{
  const {d,g,p,student}=fixture();
  const exam=addAssessment(d,{name:'Examen con faltas',groupId:g.id,periodId:p.id,categoryId:d.categories[0].id,orthography:copy(activeOrthography)});
  setOrthographyGrade(d,student.id,exam.id,{score:8.5,faults:4,delivered:true});
  const before=copy(d),calculated=overallGrade(d,student.id,g.id,p.id);
  assert.throws(()=>updateAssessment(d,exam.id,{orthography:{...activeOrthography,refundable:false}}),/entregadas|devoluci/i);
  assert.deepEqual(d,before);
  assert.equal(overallGrade(d,student.id,g.id,p.id),calculated);
  assertModel(d);
});

test('v1.10: eliminar una configuración ortográfica con entregas no modifica notas ni calendario',()=>{
  const {d,g,p,student}=fixture();
  const exam=addAssessment(d,{name:'Examen pendiente de entregar',groupId:g.id,periodId:p.id,categoryId:d.categories[0].id,orthography:copy(activeOrthography)});
  setOrthographyGrade(d,student.id,exam.id,{score:9,faults:2,delivered:true});
  const original=copy(d);
  assert.throws(()=>updateAssessment(d,exam.id,{orthography:null}),/entregadas/i);
  assert.deepEqual(d,original);assertModel(d);
});

test('v1.10: después de retirar explícitamente la entrega puede cambiarse la configuración sin alterar la nota base',()=>{
  const {d,g,p,student}=fixture();
  const exam=addAssessment(d,{name:'Examen configurable',groupId:g.id,periodId:p.id,categoryId:d.categories[0].id,orthography:copy(activeOrthography)});
  setOrthographyGrade(d,student.id,exam.id,{score:7.5,faults:2,delivered:true});
  setOrthographyGrade(d,student.id,exam.id,{score:7.5,faults:2,delivered:false});
  updateAssessment(d,exam.id,{orthography:{...activeOrthography,refundable:false}});
  assert.equal(d.grades.find(x=>x.assessmentId===exam.id&&x.studentId===student.id).score,7.5);
  assertModel(d);
});

test('v1.10: los ajustes de actividad no permiten cambiar id, grupo, período ni referencias invisibles',()=>{
  const {d}=fixture(),a=d.assessments[0],base=copy(d);
  for(const patch of [{id:'otro'},{groupId:'otro'},{periodId:'otro'},{recoveryMode:'replace'},{createdAt:'2000-01-01'}]){
    assert.throws(()=>updateAssessment(d,a.id,patch),/no permitido/i);
    assert.deepEqual(d,base);
  }
  assertModel(d);
});

test('v1.10: las preferencias por defecto admiten solo sus cuatro claves y no tocan calificaciones',()=>{
  const {d}=fixture(),base=copy(d);
  for(const patch of [{grades:[]},{unknown:true},{enabled:true},{repetitions:40,settings:{}}]){
    assert.throws(()=>setOrthographyDefaults(d,patch),/no permitido/i);
    assert.deepEqual(d,base);
  }
  setOrthographyDefaults(d,{repetitions:31});assert.equal(d.settings.orthographyDefaults.repetitions,31);
  assert.deepEqual(d.grades,base.grades);assertModel(d);
});

test('v1.10: JSON conserva los niveles y los descriptores de una rúbrica al importarla',()=>{
  const source={name:'Actitud 2 bach',criteria:[
    {id:'orig1',name:'Puntualidad',maxScore:2,weight:20,levels:[{score:2,label:'Bien',description:'Llega siempre puntual'},{score:1,label:'Regular',description:'Algún retraso'},{score:0,label:'Mal',description:'Retrasos frecuentes'}]},
    {id:'orig2',name:'Uso del móvil',maxScore:2,weight:20,levels:[{score:2,label:'Bien',description:'No lo usa'},{score:0,label:'Mal',description:'Lo usa sin permiso'}]}
  ]};
  const parsed=parseRubricImport(JSON.stringify(source),'Actitud.json');
  assert.equal(parsed.criteria.length,2);
  assert.deepEqual(parsed.criteria.map(c=>c.levels?.length),[3,2]);
  assert.equal(parsed.criteria[0].levels[1].description,'Algún retraso');
  assert.equal(parsed.criteria[1].levels.some(l=>l.score===1),false);
  assert.equal(parsed.criteria[0].id,undefined,'se regeneran los IDs para evitar colisiones al importar');
  const d=initialNotebook(),r=createRubric(d,parsed.name,parsed.criteria);
  assert.equal(r.criteria[0].levels[2].label,'Mal');
  const a=addAssessment(d,{name:'Actitud',groupId:d.groups[0].id,periodId:d.periods[0].id,categoryId:d.categories[2].id,rubricId:r.id});
  const scores=Object.fromEntries(r.criteria.map(c=>[c.id,2]));
  setRubricGrade(d,d.students[0].id,a.id,scores);
  assertModel(d);
});

test('v1.10: JSON con niveles inválidos se rechaza en vez de degradarse a rúbrica numérica',()=>{
  const start={name:'Rúbrica',criteria:[{name:'Prueba',maxScore:2,weight:1,levels:[{score:2,label:'Bien',description:'Ok'},{score:0,label:'Mal',description:'No'}]}]};
  for(const levels of [[],[{score:0,label:'Mal',description:'No'}], [{score:2,label:'Bien',description:''},{score:2,label:'Igual',description:''}], 'niveles', [{score:2,label:'',description:''}]]){
    const altered=copy(start);altered.criteria[0].levels=levels;
    assert.throws(()=>parseRubricImport(JSON.stringify(altered),'test.json'),/niveles|descriptor/i);
  }
});

test('v1.10: un examen no puede ligarse por accidente a una guardia',()=>{
  const {d,g}=fixture();const guard=saveSlot(d,{day:0,start:'08:00',end:'08:50',type:'guardia'});
  const before=copy(d);
  assert.throws(()=>saveEvent(d,{type:'exam',title:'Prueba',date:'2026-11-23',groupId:g.id,slotId:guard.id}),/solo.*clase/i);
  assert.deepEqual(d,before);assertModel(d);
  assert.equal(saveEvent(d,{type:'exam',title:'Examen extraordinario',date:'2026-11-23',groupId:g.id,time:'13:30'}).time,'13:30');
});

// Constructor DOM mínimo de prueba: no sustituye el parser XML real del navegador.
function fakeNode(text,attrs={}){
  return {textContent:text,getAttribute:name=>attrs[name]??null,getElementsByTagName(tag){
    const regex=new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)<\\/${tag}>`,'gi');
    return [...text.matchAll(regex)].map(m=>fakeNode(m[2],Object.fromEntries([...m[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(x=>[x[1],x[2]]))));
  }};
}
class SimpleDomParser{parseFromString(text){return fakeNode(text);}}
const xmlCell=(col,row,value)=>`<c r="${col}${row}" t="inlineStr"><is><t>${value}</t></is></c>`;
const xmlRow=(i,cols)=>`<row r="${i}">${cols.map(([col,value])=>xmlCell(col,i,value)).join('')}</row>`;
const xmlSheet=rows=>`<?xml version="1.0"?><worksheet><sheetData>${rows.join('')}</sheetData></worksheet>`;

test('v1.10: un XLSX con portada antes de la rúbrica encuentra los criterios de la segunda hoja',async()=>{
  const cover=xmlSheet([xmlRow(1,[['A','Información del departamento']])]);
  const data=xmlSheet([
    xmlRow(1,[['A','Criterio'],['B','Máximo'],['C','Peso']]),
    xmlRow(2,[['A','Participación'],['B','2'],['C','20']]),
    xmlRow(3,[['A','Material'],['B','3'],['C','30']])
  ]);
  const entries={'xl/worksheets/sheet1.xml':cover,'xl/worksheets/sheet2.xml':data};
  const zip={files:Object.fromEntries(Object.keys(entries).map(name=>[name,{}])),file:name=>entries[name]?{_data:{uncompressedSize:entries[name].length},async:async()=>entries[name]}:null};
  const lib={loadAsync:async()=>zip};
  const parsed=await parseRubricXlsx(new ArrayBuffer(5),'Planificación.xlsx',lib,SimpleDomParser);
  assert.equal(parsed.criteria.length,2);
  assert.equal(parsed.criteria[0].name,'Participación');
  assert.equal(parsed.criteria[0].weight,20);
  assert.equal(parsed.criteria[1].maxScore,3);
});

test('v1.10: una hoja XLSX mal formada con criterios identificados no se ignora por otra',async()=>{
  const bad=xmlSheet([xmlRow(1,[['A','Criterio'],['B','Máximo']]),xmlRow(2,[['A','Absurdo'],['B','-4']])]);
  const next=xmlSheet([xmlRow(1,[['A','Criterio'],['B','Máximo']]),xmlRow(2,[['A','Válido'],['B','2']])]);
  const entries={'xl/worksheets/sheet1.xml':bad,'xl/worksheets/sheet2.xml':next};
  const zip={files:Object.fromEntries(Object.keys(entries).map(name=>[name,{}])),file:name=>entries[name]?{_data:{uncompressedSize:entries[name].length},async:async()=>entries[name]}:null};
  await assert.rejects(parseRubricXlsx(new ArrayBuffer(3),'test.xlsx',{loadAsync:async()=>zip},SimpleDomParser),/criterio|máximo|nivel/i);
});
