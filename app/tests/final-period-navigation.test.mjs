import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {initialNotebook,finalGrade} from '../src/model.js';

const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const app=read('app.js');
const begin=app.indexOf('function renderPeriodButtons(){');
const end=app.indexOf('\nfunction render(){',begin);
assert(begin>=0&&end>begin,'No se encontró la barra de períodos');
const renderPeriodButtons=app.slice(begin,end);

function renderFor(periods,tab='cuaderno',periodId='p1'){
  return runInNewContext(renderPeriodButtons+';renderPeriodButtons()',{
    STATE:{doc:{periods},tab,periodId,groupId:'g1'},
    esc:value=>String(value),
    renderNotebookEvaluationNotice:()=>'<div data-evaluation-notice></div>'
  });
}
const item=(id,order,name)=>({id,order,name});

test('Final aparece inmediatamente después del último período real, no siempre del tercero',()=>{
  for(const [unordered,expectedLast] of [
    [[item('p2',2,'Segunda'),item('p1',1,'Primera'),item('p3',3,'Tercera')],'p3'],
    [[item('p4',4,'Cuarta'),item('p3',3,'Tercera'),item('p1',1,'Primera'),item('p2',2,'Segunda')],'p4'],
    [[item('p1',5,'Primera renombrada')],'p1']
  ]){
    const html=renderFor(unordered);
    const ordered=[...html.matchAll(/data-period-choice="([^"]+)"/g)].map(match=>match[1]);
    assert.deepEqual(ordered,unordered.slice().sort((a,b)=>a.order-b.order).map(p=>p.id));
    const start=html.indexOf('<span class="term-last-and-final">');
    const end=html.indexOf('<button type="button" class="term-add"',start);
    assert(start>=0&&end>start,'Último período y Final deben compartir contenedor');
    const pair=html.slice(start,end);
    assert(pair.includes('data-period-choice="'+expectedLast+'"'));
    assert(pair.includes('data-academic-quick="final"'));
    assert(pair.indexOf('data-period-choice="'+expectedLast+'"')<pair.indexOf('data-academic-quick="final"'));
    assert(!ordered.slice(0,-1).some(id=>pair.includes('data-period-choice="'+id+'"')));
    assert(html.indexOf('data-academic-quick="final"')<html.indexOf('id="new-period"'));
    assert.equal((html.match(/data-academic-quick="final"/g)||[]).length,1);
  }
});

test('Final sigue al lado de los períodos al entrar en la vista final',()=>{
  const periods=[item('p1',1,'1.ª evaluación'),item('p2',2,'2.ª evaluación'),item('p3',3,'3.ª evaluación')];
  const final=renderFor(periods,'final','p3');
  assert(final.includes('class="term-button term-final active"'));
  assert(final.includes('aria-pressed="true" aria-current="page">Evaluación final'));
  assert(final.includes('data-period-choice="p3"'));
  assert(!final.includes('data-evaluation-notice'),'No mostrar aviso trimestral en vista final');
  const first=renderFor(periods,'cuaderno','p1');
  assert(first.includes('class="term-button term-final " data-academic-quick="final" aria-pressed="false"'));
  assert(first.includes('data-evaluation-notice'),'El aviso por evaluación no desaparece del cuaderno');
});

test('el acceso Final se mueve de la navegación secundaria, no se duplica ni pierde',()=>{
  const from=app.indexOf('const NOTEBOOK_WORKSPACE_TABS=');
  const until=app.indexOf('function renderPeriodButtons(){',from);
  const quick=app.slice(from,until);
  assert(!quick.includes("['final','Evaluación final']"));
  assert(app.includes('data-academic-quick="final"'));
  assert(app.includes("document.querySelectorAll('[data-academic-quick]').forEach"));
  assert(app.includes("['cuaderno','calculos','competencias','final','alumno'].includes(STATE.tab)?renderPeriodButtons()"));
  const css=read('styles.css');
  assert(css.includes('.term-buttons>.term-last-and-final{'));
  assert(css.includes('.term-bar .term-last-and-final .term-final.active{'));
  assert(css.includes('@media(max-width:650px){\n  .term-bar .term-buttons>.term-last-and-final{'));
  assert(css.includes('grid-template-columns:repeat(2,minmax(0,1fr))'));
});

test('Final se mantiene accesible si no hay períodos sin añadir períodos ficticios',()=>{
  const html=renderFor([]);
  assert(html.includes('data-academic-quick="final"'));
  assert.equal((html.match(/data-period-choice=/g)||[]).length,0);
  assert(html.includes('id="new-period"'));
});
