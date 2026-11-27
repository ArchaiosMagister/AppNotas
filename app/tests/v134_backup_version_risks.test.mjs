import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initialNotebook,setGrade,assertModel} from '../src/model.js';
import {createVault,saltFromEnvelope} from '../src/vault.js';
import {
  ensureBookMetadata,markBookChange,compareBookVersions,importRiskLevel,
  canConfirmImport,createPortableCopy,readBackupFile,portableFilename
} from '../src/cuaderno.js';

const pass='Contraseña segura ficticia para la auditoría de noviembre 2026';
const root=()=>{const d=initialNotebook();ensureBookMetadata(d);return d;};
const edit=(d,student=0,score=8)=>{
  const next=structuredClone(d);
  setGrade(next,next.students[student].id,next.assessments[0].id,score);
  markBookChange(next,d);assertModel(next);
  return next;
};
test('historial fiable permite importar revisiones sucesivas sin pedir autorizaciones',()=>{
  const first=root(),second=edit(first),third=edit(second,1,6);
  assert.equal(compareBookVersions(first,third),'newer');
  assert.equal(compareBookVersions(third,first),'older');
  assert.equal(importRiskLevel('newer',true),0);
  assert.equal(canConfirmImport('newer',true,{}),true);
  assert.equal(canConfirmImport('older',true,{}),false);
  assert.equal(canConfirmImport('older',true,{accepted:true}),true);
});
test('cambios independientes que comparten un antepasado son divergentes',()=>{
  const common=root(),ipad=edit(common,0,7),iphone=edit(common,1,4);
  assert.equal(compareBookVersions(ipad,iphone),'divergent');
  assert.equal(compareBookVersions(iphone,ipad),'divergent');
  assert.equal(importRiskLevel('divergent',true),1);
  assert.equal(canConfirmImport('divergent',true,{accepted:true}),true);
});
test('dos raíces no relacionadas del mismo identificador son historial desconocido',()=>{
  const original=root(),other=structuredClone(original);
  other._portability.head=crypto.randomUUID();
  assert.equal(compareBookVersions(original,other),'unknown');
  assert.equal(importRiskLevel('unknown',true),2);
  assert.equal(canConfirmImport('unknown',true,{accepted:true}),false);
  assert.equal(canConfirmImport('unknown',true,{phrase:'SUSTITUIR'}),true);
});
test('un mismo head con datos distintos nunca se trata como copia idéntica',()=>{
  const local=root(),other=structuredClone(local);
  setGrade(other,other.students[0].id,other.assessments[0].id,1.75);
  assert.equal(compareBookVersions(local,other),'unknown');
  assert.equal(compareBookVersions(local,structuredClone(local)),'same');
  assert.equal(canConfirmImport('same',true,{phrase:'SUSTITUIR'}),false);
});
test('revisiones incoherentes no eluden la protección de historial desconocido',()=>{
  const local=root(),future=edit(local);
  future._portability.revision=10;
  assert.equal(compareBookVersions(local,future),'unknown');
  assert.equal(importRiskLevel('unknown',true),2);
});
test('el nombre añade segundos sin afectar el contenido ni la compatibilidad del anterior',async()=>{
  const date1=new Date(2026,10,22,9,35,27),date2=new Date(2026,10,22,9,35,28);
  const newName=portableFilename(date1);
  assert.equal(newName,'Tabularium_2026-11-22_093527.cuaderno');
  assert.equal(portableFilename(date2),'Tabularium_2026-11-22_093528.cuaderno');
  assert.notEqual(portableFilename(date1),portableFilename(date2));
  const notebook=root();
  const {key,envelope}=await createVault(pass,notebook);
  const exportResult=await createPortableCopy(notebook,key,saltFromEnvelope(envelope),date1);
  const bytes=JSON.stringify(exportResult.file);
  const olderFilename={name:'Tabularium_2026-11-22_0935.cuaderno',
    size:Buffer.byteLength(bytes),text:async()=>bytes};
  const recovered=await readBackupFile(olderFilename,pass);
  assert.deepEqual(recovered.doc,notebook);
  assert.equal(compareBookVersions(notebook,recovered.doc),'same');
  assert.equal(exportResult.file.version,1);
  assert.equal(exportResult.file.vault.kdf,'PBKDF2-SHA-256');
  assert.equal(exportResult.file.vault.iterations,600000);
  assert(!bytes.includes('Tabularium_2026-11-22_093527'));
});
test('un archivo truncado se rechaza antes de cualquier sustitución',async()=>{
  const notebook=root(),before=structuredClone(notebook);
  const {key,envelope}=await createVault(pass,notebook);
  const copy=await createPortableCopy(notebook,key,saltFromEnvelope(envelope));
  const data=JSON.stringify(copy.file);
  await assert.rejects(readBackupFile({size:data.length-1,text:async()=>data.slice(0,-1)},pass));
  const partial={...copy.file,vault:{...copy.file.vault,data:copy.file.vault.data.slice(0,-12)}};
  const raw=JSON.stringify(partial);
  await assert.rejects(readBackupFile({size:raw.length,text:async()=>raw},pass));
  assert.deepEqual(notebook,before);
});
test('el flujo iOS conserva .cuaderno y nunca toma la fecha como prueba de descendencia',async()=>{
  const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
  const cuaderno=await readFile(new URL('../src/cuaderno.js',import.meta.url),'utf8');
  assert(app.includes('navigator.share({files:[downloadable]'));
  assert(app.includes("accept:{'application/octet-stream':['.cuaderno']}"));
  assert(app.includes('Esta aplicación no accede a ninguna nube ni confirma la sincronización posterior'));
  const compare=cuaderno.slice(cuaderno.indexOf('export function compareBookVersions('),cuaderno.indexOf('export function bookStatus('));
  assert(!compare.includes('exportedAt'));
  assert(!compare.includes('portableFilename'));
  assert(!compare.includes('Date.parse'));
});
