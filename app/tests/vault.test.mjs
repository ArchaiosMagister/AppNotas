import test from 'node:test';
import assert from 'node:assert/strict';
import {initialNotebook,assertModel} from '../src/model.js';
import {createVault,seal,unlockVault,saltFromEnvelope,validateEnvelope,deriveKey,KDF_ITERATIONS,LEGACY_KDF_ITERATIONS,prepareVaultUpgrade} from '../src/vault.js';
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

test('legacy copies remain readable and retain their real KDF when resealed',async()=>{
  const doc=initialNotebook(),salt=crypto.getRandomValues(new Uint8Array(16));
  const key=await deriveKey(pass,salt,LEGACY_KDF_ITERATIONS);
  const legacy=await seal(doc,key,salt);
  assert.equal(legacy.iterations,310000);
  const opened=await unlockVault(pass,legacy);
  assert.deepEqual(opened.doc,doc);
  assert.equal((await seal(opened.doc,opened.key,opened.salt)).iterations,310000);
  await assert.rejects(seal(doc,key,salt,KDF_ITERATIONS));
  await assert.rejects(seal(doc,key,crypto.getRandomValues(new Uint8Array(16))));
});
test('verified upgrade uses new salt, password and stronger KDF without mutating legacy envelope',async()=>{
  const doc=initialNotebook(),salt=crypto.getRandomValues(new Uint8Array(16));
  const legacy=await seal(doc,await deriveKey(pass,salt,LEGACY_KDF_ITERATIONS),salt);
  const original=structuredClone(legacy),newPass='A different long fictional passphrase';
  const upgraded=await prepareVaultUpgrade(pass,newPass,legacy);
  assert.equal(upgraded.envelope.iterations,600000);
  assert.notEqual(upgraded.envelope.salt,legacy.salt);
  assert.deepEqual(legacy,original);
  assert.deepEqual((await unlockVault(newPass,upgraded.envelope)).doc,doc);
  await assert.rejects(unlockVault(pass,upgraded.envelope));
  await assert.rejects(prepareVaultUpgrade(pass,pass,legacy));
  await assert.rejects(prepareVaultUpgrade('Incorrect test passphrase',newPass,legacy));
});
