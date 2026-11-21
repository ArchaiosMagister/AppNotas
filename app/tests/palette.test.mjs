import test from 'node:test';
import assert from 'node:assert/strict';
import {initialNotebook,migrateNotebook,assertModel,SCHEMA_VERSION,SUBJECT_COLORS,setSubjectAccent} from '../src/model.js';
import {overallGrade} from '../src/calculations.js';
import {createVault,unlockVault} from '../src/vault.js';

const legacyColors = {
  '4eso:Latín 4.º':'#A44E24','1bach:Latín I':'#2563B0',
  '1bach:Griego I':'#6948A5','2bach:Latín II':'#16765C',
  '2bach:Griego II':'#9A3D70'
};
function from021(){
 const doc=initialNotebook();doc.schemaVersion=3;
 doc.settings.subjectAccents={...legacyColors};return doc;
}

test('paleta predeterminada: Latín amarillo/ámbar/naranja y Griego azules',()=>{
 assert.equal(SUBJECT_COLORS['4eso:Latín 4.º'],'#EAB308');
 assert.equal(SUBJECT_COLORS['1bach:Latín I'],'#F59E0B');
 assert.equal(SUBJECT_COLORS['2bach:Latín II'],'#EA580C');
 assert.equal(SUBJECT_COLORS['1bach:Griego I'],'#0284C7');
 assert.equal(SUBJECT_COLORS['2bach:Griego II'],'#1D4ED8');
 assert.deepEqual(initialNotebook().settings.subjectAccents,SUBJECT_COLORS);
});
test('v0.2.1 → v0.2.2 actualiza solo antiguos colores predeterminados',()=>{
 const prev=from021();const gradeBefore=structuredClone(prev.grades);
 const result=migrateNotebook(prev);
 assert.equal(result.migrated,true);
 assert.equal(result.doc.schemaVersion,SCHEMA_VERSION);
 assert.deepEqual(result.doc.settings.subjectAccents,SUBJECT_COLORS);
 assert.deepEqual(result.doc.grades,gradeBefore);
 assertModel(result.doc);
 assert.equal(migrateNotebook(result.doc).migrated,false);
});
test('los cinco acentos personalizados sobreviven a la migración',()=>{
 const prev=from021();
 const custom=['#445566','#12ab34','#1a2B3c','#abcdef','#FFEEDD'];
 Object.keys(legacyColors).forEach((k,i)=>prev.settings.subjectAccents[k]=custom[i]);
 const result=migrateNotebook(prev).doc;
 Object.keys(legacyColors).forEach((k,i)=>assert.equal(result.settings.subjectAccents[k],custom[i]));
 assertModel(result);
});
test('se actualiza solo el predeterminado mientras se preserva la personalización por materia',()=>{
 const prev=from021();
 prev.settings.subjectAccents['1bach:Griego I']='#3949AB';
 prev.settings.subjectAccents['2bach:Latín II']='#aBcDeF';
 const oldGrades=structuredClone(prev.grades);
 const student=prev.students[0],group=prev.groups[0],period=prev.periods[0];
 const gradeBefore=overallGrade(prev,student.id,group.id,period.id);
 const newDoc=migrateNotebook(prev).doc;
 assert.equal(newDoc.settings.subjectAccents['1bach:Griego I'],'#3949AB');
 assert.equal(newDoc.settings.subjectAccents['2bach:Latín II'],'#aBcDeF');
 assert.equal(newDoc.settings.subjectAccents['1bach:Latín I'],SUBJECT_COLORS['1bach:Latín I']);
 assert.deepEqual(newDoc.grades,oldGrades);
 assert.equal(overallGrade(newDoc,student.id,group.id,period.id),gradeBefore);
});
test('los acentos personalizados siguen siendo editables después de migrar',()=>{
 const d=migrateNotebook(from021()).doc;
 setSubjectAccent(d,'2bach','Griego II','#123abc');
 assert.equal(d.settings.subjectAccents['2bach:Griego II'],'#123ABC');
 assertModel(d);
});
test('copia cifrada antigua se abre y migra sin perder notas ni colores personalizados',async()=>{
 const old=from021();
 old.settings.subjectAccents['4eso:Latín 4.º']='#C49A00';
 const grades=structuredClone(old.grades);
 const {envelope}=await createVault('clave-de-prueba-correcta',old);
 const decrypted=await unlockVault('clave-de-prueba-correcta',envelope);
 const updated=migrateNotebook(decrypted.doc);
 assert.equal(updated.migrated,true);
 assert.deepEqual(updated.doc.grades,grades);
 assert.equal(updated.doc.settings.subjectAccents['4eso:Latín 4.º'],'#C49A00');
 assert.equal(updated.doc.settings.subjectAccents['1bach:Griego I'],SUBJECT_COLORS['1bach:Griego I']);
 assertModel(updated.doc);
});
