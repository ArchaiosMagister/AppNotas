import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('Alumno permanece en la esquina superior izquierda por encima de actividades y nombres',async()=>{
  const [css,js]=await Promise.all([read('styles.css'),read('app.js')]);
  const marker=css.indexOf('/* v131 · Esquina fija Alumno');
  assert(marker>0,'No se encontró la corrección');
  const patch=css.slice(marker);
  const rule=patch.match(/\.grade-table thead th\.name-col\{([^}]+)\}/)?.[1]||'';
  for(const declaration of ['position:sticky','top:0','left:0','z-index:8','background-clip:padding-box'])
    assert(rule.includes(declaration),'Falta '+declaration);
  assert(patch.includes('html[data-theme="oled"] .grade-table thead th.name-col'));
  assert(css.includes('.grade-table th.name-col,.grade-table td.name-col{position:sticky;left:0'));
  assert(js.includes('<th class="name-col">Alumno</th>'));
});

test('Rúbrica coloca valor y controles en dos niveles igual que la entrada ordinaria',async()=>{
  const [css,js]=await Promise.all([read('styles.css'),read('app.js')]);
  const begin=js.indexOf('function renderNotebook(){');
  const end=js.indexOf('const ITACA_OPTIONS=',begin);
  assert(begin>=0&&end>begin);
  const table=js.slice(begin,end);
  assert(table.includes('<div class="grade-entry rubric-grade-entry"><button class="rubric-grade-button"'));
  assert(table.includes('<small>/10</small></button></div>${npButton}${ajButton}${observationButton(s.id,a.id)}</td>'));
  assert(table.includes('<div class="grade-entry ${showConverted?'));
  for(const control of ['data-rubric-grade','data-rubric-student','data-np-student',
                        'data-aj-student','data-observation-student','data-orthography-grade'])
    assert(table.includes(control),'Control desaparecido: '+control);
  const patch=css.slice(css.indexOf('/* v131 · Esquina fija Alumno'));
  assert(patch.includes('.grade-table .rubric-grade-entry .rubric-grade-button .grade-chip'));
  assert(patch.includes('font-size:16px'));
  assert(patch.includes('width:auto'));
});

test('La PWA activa la nueva caché sin borrar notas almacenadas',async()=>{
  const [js,sw]=await Promise.all([read('app.js'),read('sw.js')]);
  assert(js.includes("caches.open('cuaderno-docente-static-v141-dev')"));
  assert(sw.includes("const CACHE='cuaderno-docente-static-v141-dev'"));
  assert(!js.includes('indexedDB.deleteDatabase'));
  assert(!sw.includes('indexedDB.deleteDatabase'));
});
