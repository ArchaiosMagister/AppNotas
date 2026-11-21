import test from 'node:test';
import assert from 'node:assert/strict';
import {initialNotebook,assertModel} from '../src/model.js';
import {createVault,seal,unlockVault,saltFromEnvelope,validateEnvelope} from '../src/vault.js';
const pass='clave extensa y robusta 2026';
test('la copia contiene solo JSON cifrado; descifrado conserva el modelo',async()=>{
  const doc=initialNotebook();const {key,envelope}=await createVault(pass,doc);
  assert.equal(JSON.stringify(envelope).includes('Alumno 01'),false);
  const restored=await unlockVault(pass,envelope);assert.equal(assertModel(restored.doc),true);
  assert.equal(restored.doc.students[0].name,'Alumno 01');
  const another=await seal(doc,key,saltFromEnvelope(envelope));
  assert.notEqual(envelope.iv,another.iv);assert.notEqual(envelope.data,another.data);
});
test('contraseña incorrecta y alteración del cifrado fallan de forma segura',async()=>{
  const {envelope}=await createVault(pass,initialNotebook());
  await assert.rejects(unlockVault('clave incorrecta muy larga',envelope));
  const tampered={...envelope,data:envelope.data.slice(0,-5)+'AAAAA'};
  await assert.rejects(unlockVault(pass,tampered));
});
test('rechaza formato obsoleto y contraseña corta',async()=>{
  assert.throws(()=>validateEnvelope({version:1}));
  await assert.rejects(createVault('corta',initialNotebook()));
});
