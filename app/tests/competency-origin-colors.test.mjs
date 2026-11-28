import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {initialNotebook,addGroup,addCategory,addCompetency,setCompetencyLink,setPeriodCategoryEnabled,availableCategories,assertModel} from '../src/model.js';
import {competencyGrade} from '../src/calculations.js';
const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
test('Competencias muestra solo las categorías activas del grupo y evaluación, conservando vínculos previos',()=>{
 const doc=initialNotebook(),group=doc.groups[0],period=doc.periods[1],other=doc.periods[0];
 const literature=addCategory(doc,'Literatura',0,'mean');
 const c=addCompetency(doc,'Competencia de prueba',group.id);
 setCompetencyLink(doc,c.id,literature.id,30);
 const prior=structuredClone(c.links);
 setPeriodCategoryEnabled(doc,group.id,period.id,literature.id,false);
 const state={doc,groupId:group.id,periodId:period.id};
 const code=source.match(/const visibleCategories=.*?;/)[0];
 const visible=runInNewContext(code+';visibleCategories',{STATE:state,availableCategories});
 assert(!visible().some(x=>x.id===literature.id));
 assert.equal(competencyGrade(doc,doc.students[0].id,c.id,group.id,period.id),null);
 state.periodId=other.id;assert(visible().some(x=>x.id===literature.id));
 assert.deepEqual(c.links,prior);
 const second=addGroup(doc,'Griego','Griego I','2026-2027','1bach');
 state.groupId=second.id;state.periodId=period.id;assert(visible().some(x=>x.id===literature.id));
 state.groupId=group.id;setPeriodCategoryEnabled(doc,group.id,period.id,literature.id,true);
 assert(visible().some(x=>x.id===literature.id));assert.deepEqual(c.links,prior);assertModel(doc);
 const render=source.slice(source.indexOf('function renderCompetencies(){'),source.indexOf('function currentCurriculum(){'));
 assert.equal(render.split('visibleCategories()').length-1,2,'oficiales y propias');
 assert(source.includes('availableCategories(d,groupId,periodId).some(c=>c.id===categoryId)'));
});
test('mismo color de subgrupo en diferentes cursos; etiquetas libres neutras y escapadas',()=>{
 const code=source.slice(source.indexOf('const ORIGIN_PALETTE='),source.indexOf('const originEqual='));
 const {originColorClass,originLabel}=runInNewContext(code+';({originColorClass,originLabel})',{esc:s=>String(s).replace(/</g,'&lt;').replace(/>/g,'&gt;')});
 for(const label of ['A','a','1A','1.º A','2º Bach A','Grupo A'])assert.equal(originColorClass(label),'origin-color-blue',label);
 assert.equal(originColorClass('2B'),'origin-color-red');assert.equal(originColorClass('1.º C'),'origin-color-green');assert.equal(originColorClass('1.º F'),'origin-color-orange');
 for(const label of ['','Optativa','Sin etiqueta','<script>'])assert.equal(originColorClass(label),'origin-color-neutral');
 assert(originLabel('<script>').includes('&lt;script&gt;'));assert.equal(originLabel(''),'');
 for(const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ')assert(css.includes('.student-origin-badge.'+originColorClass(letter)+'{'));
 for(const theme of ['light','dark','oled'])assert(css.includes('html[data-theme="'+theme+'"] .student-origin-badge[class*="origin-color-"]'));
});

test('paleta de procedencias: contraste WCAG AA en claro, oscuro y OLED y separación C/F',()=>{
 const rgb=hex=>hex.slice(1).match(/../g).map(v=>parseInt(v,16));
 const lum=hex=>rgb(hex).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
 const contrast=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
 const values=new Map();
 for(const match of css.matchAll(/\.student-origin-badge\.origin-color-([a-z]+)\{--origin-light:(#[0-9a-f]{6});--origin-ink:(#[0-9a-f]{6});--origin-border:(#[0-9a-f]{6});--origin-dark:(#[0-9a-f]{6});--origin-dark-ink:(#[0-9a-f]{6})\}/g)){
  const [,name,bg,ink,border,dark,darkInk]=match;
  values.set(name,{bg,ink,border,dark,darkInk});
  for(const [a,b] of [[bg,ink],[dark,darkInk],['#000000',darkInk]])assert(contrast(a,b)>=4.5,name);
 }
 assert.equal(values.size,13);
 const green=values.get('green'),orange=values.get('orange');
 for(const key of ['bg','border','darkInk']){
  const a=rgb(green[key]),b=rgb(orange[key]);assert(Math.hypot(...a.map((v,i)=>v-b[i]))>80,key+' C/F');
 }
});
