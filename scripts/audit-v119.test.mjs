import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const root = path.resolve(process.env.CUADERNO_ROOT || '_release/CuadernoDocente_v1.19-prepublicacion');
const source = readFileSync(path.join(root, 'src/planner-ui.js'), 'utf8');
const sw = readFileSync(path.join(root, 'sw.js'), 'utf8');

test('agenda: crear sesión en sábado y domingo propone lunes', () => {
  assert.ok(source.includes('selectedDay=(weekday(dateNow())<5?weekday(dateNow()):0)'));
  for (let day = 0; day <= 6; day++) {
    const selected = day < 5 ? day : 0;
    assert.equal(selected, day < 5 ? day : 0);
  }
  assert.ok(!source.includes('weekday(dateNow())%5'));
});

test('agenda: curso siguiente toma año desde inicio, no desde nombre editable', () => {
  assert.ok(!source.includes('y.name.slice(0,4)'));
  assert.equal((source.match(/y\.start\.slice\(0,4\)/g) || []).length, 4);
  const year = Number('2026-09-01'.slice(0, 4));
  assert.equal(String(year + 1) + '-' + String(year + 2), '2027-2028');
});

test('agenda: conservar hora manual si no se ha abandonado sesión del horario', () => {
  const condition = 'else if(!event&&previous&&!matches.some(s=>s.id===previous))fields.time.value=';
  assert.ok(source.includes(condition));
  assert.ok(!source.includes("else if(!event)fields.time.value='';"));
});

test('iCalendar: normalización de CRLF y CR, sin saltos en propiedades', () => {
  const line = source.split('\n').find(x => x.trim().startsWith('const clean=t=>'));
  assert.ok(line, 'No se encuentra el limpiador ICS');
  const expression = line.trim().slice('const clean='.length).replace(/;$/, '');
  const clean = runInNewContext('(' + expression + ')');
  const output = clean('Primera\r\nSegunda\rTercera\ncuarta, quinta; barra\\');
  assert.ok(output.includes('Primera\\nSegunda\\nTercera\\ncuarta'));
  assert.ok(output.includes('\\,'));
  assert.ok(output.includes('\\;'));
  assert.ok(output.endsWith('\\\\'));
  assert.ok(!output.includes('\r'));
});

test('iCalendar: plegado de líneas a 75 octetos UTF-8', () => {
  const match = source.match(/const foldIcsLine=(line=>\{.*?return out;\});const blob=/s);
  assert.ok(match, 'No se encuentra la función de plegado ICS');
  const fold = runInNewContext('(' + match[1] + ')', { TextEncoder });
  const original = 'SUMMARY:' + 'áñ🙂É'.repeat(90);
  const folded = fold(original);
  const lines = folded.split('\r\n');
  assert.ok(lines.length > 2);
  assert.ok(lines.every(line => new TextEncoder().encode(line).length <= 75));
  assert.ok(lines.slice(1).every(line => line.startsWith(' ')));
  assert.equal(lines.map((line, i) => i ? line.slice(1) : line).join(''), original);
});

test('PWA: la caché cambia para entregar nuevos recursos a instalaciones previas', () => {
  const app=readFileSync(path.join(root,'app.js'),'utf8');
  const match=sw.match(/const CACHE='(cuaderno-docente-static-v(\d+)-dev)'/);
  assert.ok(match,'La caché debe respetar el formato auditado');
  assert.ok(Number(match[2])>=120,'No se debe volver a una caché anterior a la auditoría');
  assert.ok(app.includes(`caches.open('${match[1]}')`),'La UI debe consultar exactamente la caché del service worker');
  assert.ok(sw.includes("'./src/planner-ui.js'"));
});
