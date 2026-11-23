import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('Acciones de la tabla se sitúa por delante de Exámenes, Trabajos y Alumno sticky',async()=>{
  const [css,app]=await Promise.all([read('styles.css'),read('app.js')]);
  const openPanel=css.match(/\.panel:has\(> \.panel-header \.notebook-more-actions\[open\]\)\{([^}]+)\}/)?.[1]||'';
  const openHeader=css.match(/\.panel:has\(> \.panel-header \.notebook-more-actions\[open\]\)>\.panel-header\{([^}]+)\}/)?.[1]||'';
  const studentSticky=css.match(/\.grade-table thead th\.name-col\{([^}]+)\}/)?.[1]||'';
  const menu=css.match(/\.notebook-more-panel\{([^}]+)\}/)?.[1]||'';
  const layer=Number(openHeader.match(/z-index:\s*(\d+)/)?.[1]);
  const studentLayer=Number(studentSticky.match(/z-index:\s*(\d+)/)?.[1]);
  assert.match(openPanel,/overflow:\s*visible/,'El panel no debe recortar el menú');
  assert.match(openHeader,/position:\s*relative/,'La cabecera necesita su propia capa');
  assert(Number.isFinite(layer)&&layer>studentLayer,
    'La cabecera abierta debe superar incluso el encabezado fijo Alumno');
  assert.match(menu,/position:\s*absolute/,'En escritorio el menú se superpone sin desplazar la tabla');
  assert(app.includes('<details class="notebook-more-actions">'));
  assert(app.includes('Acciones de la tabla'));
});

test('En pantallas estrechas las acciones siguen desplegándose en el flujo',async()=>{
  const css=await read('styles.css');
  assert.match(css,/@media\(max-width:640px\)\{[\s\S]*?\.notebook-more-panel\{position:static/);
  assert(css.includes('html[data-theme="oled"] .notebook-more-panel'));
});
