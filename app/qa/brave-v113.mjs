import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {join,resolve} from 'node:path';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {addAssessment,createRubric,initialNotebook} from '../src/model.js';
import {createVault,unlockVault} from '../src/vault.js';
import {tab} from './cdp-tab.mjs';

// Ejecutar con un perfil Brave de pruebas y depuración local en el puerto 47652.
const url=pathToFileURL(resolve(process.argv[2]||'CuadernoDocente_sin_instalar.html')).href;
const password='Contraseña de prueba local v1.13';
const browser=await tab(url,password);
const scratch=await mkdtemp(join(tmpdir(),'cuaderno-docente-v113-'));
const first='tr:first-child';
const np=first+' [data-np-student]';
const note=first+' input.note-input';
const read=selector=>`document.querySelector(${JSON.stringify(selector)})`;
const pressed=selector=>`${read(selector)}?.getAttribute('aria-pressed')`;
const npIs=value=>`${pressed(np)} === '${value}'`;
const noteIs=value=>`${read(note)}?.value === ${JSON.stringify(value)}`;
try{
  await browser.open();
  assert.equal(await browser.run("!!document.querySelector('#confirm-password')"),true,'Usa un perfil de prueba nuevo');
  await browser.unlock(undefined,true);
  assert.equal(await browser.run("document.querySelectorAll('[data-course-choice]').length"),3);
  assert.equal(await browser.run("!!document.querySelector('#level-select')"),false);
  await browser.press('[data-course-choice="2bach"]');
  assert.equal(await browser.run(pressed('[data-course-choice="2bach"]')),'true');
  assert.equal(await browser.run("document.querySelector('#subject-select').value"),'Latín II');
  await browser.press('[data-course-choice="1bach"]');
  assert.equal(await browser.run(pressed('[data-course-choice="1bach"]')),'true');
  assert.equal(await browser.run("document.querySelector('#subject-select').value"),'Latín I');
  assert.equal(await browser.run("document.querySelector('#edit-group').disabled"),false);
  await browser.press('#edit-group');
  await browser.wait("!!document.querySelector('dialog[open] #rename-group-btn')");
  await browser.press('#close-group-tools');

  assert.equal(await browser.run(`${read(note)}.value`),'6,5');
  await browser.press(np);
  await browser.wait(npIs(true));
  assert.equal(await browser.run(`${read(note)}.placeholder`),'NP');
  await browser.press('#undo-change');
  await browser.wait(noteIs('6,5'));
  await browser.press('#redo-change');
  await browser.wait(npIs(true));
  await browser.press(first+' [data-view-student]');
  await browser.wait("document.querySelector('.student-assessment').innerText.includes('NP')");
  await browser.press('[data-tab="cuaderno"]');
  await browser.edit(note,'0');
  await browser.wait(`${npIs(false)} && ${noteIs('0')}`);
  await browser.press(np);
  await browser.wait(npIs(true));
  await browser.press(np);
  await browser.wait(`${npIs(false)} && ${noteIs('')}`);
  assert.equal(await browser.run(`${read(note)}.placeholder`),'—');
  await browser.press(np);
  await browser.wait(npIs(true));
  await browser.open();
  await browser.unlock();
  await browser.wait(npIs(true));
  assert.equal(await browser.run('location.protocol'),'file:');
  await browser.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  assert.equal(await browser.run('document.body.scrollWidth <= innerWidth + 2'),true);
  await browser.send('Emulation.clearDeviceMetricsOverride');

  // Una copia v1.12 con los dos tipos de actividad especiales debe poder restaurarse.
  const doc=initialNotebook();
  doc.schemaVersion=6;
  const groupId=doc.groups[0].id,periodId=doc.periods[0].id,categoryId=doc.categories[1].id;
  const rubric=createRubric(doc,'Rúbrica QA',[{name:'Criterio',maxScore:4}]);
  const rubricActivity=addAssessment(doc,{name:'Trabajo QA',groupId,periodId,categoryId,rubricId:rubric.id});
  const exam=addAssessment(doc,{name:'Examen QA',groupId,periodId,categoryId,maxScore:20,
    orthography:{enabled:true,penaltyPerFault:.1,repetitions:30,refundable:true}});
  const backup=join(scratch,'v112.cdoc');
  await writeFile(backup,JSON.stringify((await createVault(password,doc)).envelope));
  await browser.press('[data-tab="ajustes"]');
  await browser.upload('#backup-file',backup);
  await browser.restorePassword();
  for(const activity of [rubricActivity,exam]){
    const button=first+` [data-np-assessment="${activity.id}"]`;
    await browser.wait(`!!${read(button)}`);
    await browser.press(button);
    await browser.wait(`${pressed(button)} === 'true'`);
  }
  await browser.press(first+` [data-orthography-grade="${exam.id}"]`);
  await browser.wait("!!document.querySelector('dialog[open] #orth-base')");
  assert.equal(await browser.run("document.querySelector('#orth-base').value"),'');
  await browser.press('#cancel-orthography');
  await browser.press(first+` [data-rubric-grade="${rubricActivity.id}"]`);
  await browser.wait("!!document.querySelector('dialog[open] #rubric-rating-form')");
  assert.equal(await browser.run("document.querySelector('[data-rating-id]').value"),'');
  await browser.press('#cancel-rubric-grade');

  // Captura el Blob exacto de la descarga para comprobar el resultado descifrado.
  await browser.run(`(() => {
    const create=URL.createObjectURL;
    URL.createObjectURL=blob=>{
      globalThis.qaBackup=blob.text();
      return create.call(URL,blob);
    };
  })()`);
  await browser.press('[data-tab="ajustes"]');
  await browser.press('#backup-download');
  await browser.wait('!!globalThis.qaBackup');
  const exported=JSON.parse(await browser.run('globalThis.qaBackup'));
  const {doc:restored}=await unlockVault(password,exported);
  assert.equal(restored.schemaVersion,7);
  assert.deepEqual(restored.grades.filter(g=>g.notSubmitted).map(g=>g.assessmentId),[rubricActivity.id,exam.id]);
  assert.deepEqual(browser.errors,[]);
  console.log('HTML autónomo en Brave: cursos, gestión, NP, cero, vacío, historial, visor, móvil, reapertura, restauración v1.12 y exportación cifrada.');
}finally{
  browser.close();
  await rm(scratch,{recursive:true,force:true});
}
