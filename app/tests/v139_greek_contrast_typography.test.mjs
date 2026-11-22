import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {initialNotebook,subjectKey,SUBJECT_COLORS,assertModel} from '../src/model.js';
import {overallGrade,finalGrade} from '../src/calculations.js';

const read=name=>readFile(new URL('../'+name,import.meta.url),'utf8');
const hexChannels=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));

async function presentation(subject){
  const js=await read('app.js'),start=js.indexOf('const CLASSICAL_SUBJECT_ACCENTS='),
    end=js.indexOf('const pairOptions=',start);
  assert(start>0&&end>start);
  const doc=initialNotebook();
  const cssProps=new Map(),dataset={};
  const state={theme:'light',level:'1bach',subject,doc};
  if(subject==='Griego II')state.level='2bach';
  const api=runInNewContext(js.slice(start,end)+';({applyTheme,colorFor})',{
    STATE:state,SUBJECT_COLORS,subjectKey,
    document:{documentElement:{dataset,style:{setProperty:(key,value)=>cssProps.set(key,value)}}}
  });
  const before=structuredClone(doc);
  api.applyTheme();
  assert.deepEqual(doc,before,'La apariencia no modifica el documento académico');
  return {state,dataset,cssProps};
}

test('Griego I y II comparten vestidura pero tienen acentos de curso distintos',async()=>{
  const one=await presentation('Griego I'),two=await presentation('Griego II');
  assert.equal(one.dataset.courseSkin,'attica');
  assert.equal(two.dataset.courseSkin,'attica');
  assert.equal(one.dataset.courseVariant,'griego-i');
  assert.equal(two.dataset.courseVariant,'griego-ii');
  assert.equal(one.cssProps.get('--accent'),'#438DB8');
  assert.equal(two.cssProps.get('--accent'),'#2878AF');
  assert.notEqual(one.cssProps.get('--classic-accent'),two.cssProps.get('--classic-accent'));
  assert.equal(one.dataset.theme,'light');
  assert.equal(two.dataset.theme,'light');
});

test('la cabecera, los textos, la selección, las notas y el bloqueo cambian realmente entre cursos griegos',async()=>{
  const css=await read('styles.css');
  const a=css.indexOf('/* Dos acentos de Grecia perceptibles'),b=css.indexOf('html[data-theme="oled"][data-course-variant]',a);
  const part=css.slice(a,b);
  assert(a>0&&b>a);
  const block=variant=>{
    const prefix='html[data-course-skin="attica"][data-course-variant="'+variant+'"]{',
      index=part.indexOf(prefix),end=part.indexOf('}',index);
    assert(index>=0&&end>index);
    return part.slice(index,end);
  };
  const first=block('griego-i'),second=block('griego-ii');
  const match=(text,key)=>{const m=text.match(new RegExp('--'+key+':(#[0-9a-fA-F]{6})'));assert(m,key);return m[1];};
  for(const token of ['attica-banner-start','attica-banner-end','attica-title','attica-line','attica-button','attica-selected','attica-table-final'])
    assert.notEqual(match(first,token),match(second,token),token+' debe variar');
  const rgb1=hexChannels(match(first,'attica-banner-start')),
    rgb2=hexChannels(match(second,'attica-banner-start'));
  assert(rgb2.every((c,i)=>c<rgb1[i]),'La franja de Griego II debe ser más intensa');
  for(const target of ['.topbar::before','.brand-mark','.headrow h1','.topmeta .lock-btn',
    '.tabs .tab.active','.grade-table th.final-col','.student-mode-title']){
    assert(part.includes(target),'Falta reflejar el curso en '+target);
  }
  assert(part.includes('background:linear-gradient(108deg,var(--attica-banner-start)'));
  assert(part.includes('color:var(--attica-title)'));
});

test('se utiliza una familia tipográfica editorial común para todos los cursos',async()=>{
  const css=await read('styles.css'),start=css.indexOf('/* v139 · Tipografía humanista');
  assert(start>0);
  const part=css.slice(start);
  for(const name of ['Avenir Next','Optima','Gill Sans','Trebuchet MS','Palatino Linotype','Baskerville','Georgia'])
    assert(part.includes(name),'Falta familia de respaldo '+name);
  assert(part.includes('--serif:var(--classical-heading)'));
  assert(part.includes('body,button,input,select,textarea,dialog{'));
  assert(part.includes('font-family:var(--app-humanist)'));
  assert(part.includes('h1,h2,h3,h4,.brand-copy strong,.tabs .nav-text'));
  assert(part.includes('font-family:var(--classical-heading)'));
  assert(part.includes('.grade-table th,.grade-table td,.stats-table'));
  assert(part.includes('font-variant-numeric:tabular-nums lining-nums'));
  assert(!part.includes('@import'),'No introducir fuentes que exijan red');
  assert(!part.includes('https://fonts.'),'Tipografías sin terceros');
});

test('el contraste especial no invade otros diseños ni el modo OLED',async()=>{
  const css=await read('styles.css');
  assert(css.includes('html[data-theme="light"][data-course-skin="attica"][data-course-variant]'));
  assert(css.includes('html[data-theme="dark"][data-course-variant="griego-i"]'));
  assert(css.includes('html[data-theme="dark"][data-course-variant="griego-ii"]'));
  assert(css.includes('html[data-theme="oled"][data-course-variant] .topbar::before{background:#000!important}'));
  const doc=initialNotebook(),before=structuredClone(doc);
  assertModel(doc);
  for(const student of doc.students){
    const g=doc.groups.find(x=>x.id===student.groupId);
    if(g){
      overallGrade(doc,student.id,g.id,doc.periods[0].id);
      finalGrade(doc,student.id,g.id);
    }
  }
  assert.deepEqual(doc,before,'El rediseño no debe alterar cálculos ni alumnos');
});
