import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCsv,namesFromCsv} from '../src/csv.js';
test('CSV con BOM, semicolon y CRLF',()=>assert.deepEqual(namesFromCsv('\uFEFFnombre;grupo\r\nAna;A\r\nJuan;B\r\n'),['Ana','Juan']));
test('CSV con comas, comillas y saltos internos',()=>assert.deepEqual(namesFromCsv('alumno,grupo\n"García, ""M""",1\n"Lu\ncía",1'),['García, "M"','Lu\ncía']));
test('CSV inválidos se rechazan',()=>{assert.throws(()=>namesFromCsv('grupo\n1'));assert.throws(()=>parseCsv('alumno\n"mal cerrado'));assert.throws(()=>namesFromCsv('nombre\n'));});
test('importación limitada a 1000 filas',()=>assert.throws(()=>namesFromCsv('nombre\n'+Array(1002).fill('A').join('\n'))));
