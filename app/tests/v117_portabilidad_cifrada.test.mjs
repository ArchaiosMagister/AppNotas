import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initialNotebook,assertModel,addGroup,addPeriod,addAssessment,setGrade,createRubric,
  setRubricGrade,setFinalConfig,setFinalOverride,setPeriodCategory,setIndividualCategoryRule,setPendingJustified
} from '../src/model.js';
import {categoryGrade,overallGrade,finalGrade,competencyGrade} from '../src/calculations.js';
import {createVault,unlockVault} from '../src/vault.js';
import {
  ensureBookMetadata,validateBookMetadata,markBookChange,createPortableCopy,decodeBackupContent,
  readBackupFile,compareBookVersions,bookStatus,portableFilename,MAX_CUADERNO_BYTES
} from '../src/cuaderno.js';
const password='Contraseña larga de prueba, 2026: 3bra!';
const empty=()=>{const d=initialNotebook();ensureBookMetadata(d);return d;};
function exerciseDoc(){
  const d=empty(),group=d.groups[0],period=d.periods[0],student=d.students[0];
  const other=addGroup(d,'Griego I B','Griego I','2026-2027','1bach');
  const second=addPeriod(d,'Evaluación extraordinaria');
  const category=d.categories[0];
  const act=addAssessment(d,{name:'Examen escala 0–5',groupId:group.id,periodId:second.id,categoryId:category.id,maxScore:5,convertToTen:true,weight:4});
  setGrade(d,student.id,act.id,3.75);
  const rubric=createRubric(d,'Rúbrica de actitud',[{name:'Participación',maxScore:3,weight:2},{name:'Esfuerzo',maxScore:7,weight:1}]);
  const rubricAct=addAssessment(d,{name:'Rúbrica',groupId:group.id,periodId:second.id,categoryId:d.categories[2].id,rubricId:rubric.id});
  setRubricGrade(d,student.id,rubricAct.id,{[rubric.criteria[0].id]:2,[rubric.criteria[1].id]:6.5});
  setPeriodCategory(d,group.id,second.id,category.id,{weight:70,rule:'weighted_mean',bestCount:2});
  setFinalConfig(d,group.id,{rule:'weighted_mean',weights:{[period.id]:2,[second.id]:3}});
  setFinalOverride(d,student.id,second.id,6.25);
  setIndividualCategoryRule(d,student.id,category.id,second.id,'np_mean');
  setPendingJustified(d,student.id,d.assessments[0].id,true);
  d.planner.years[0].name=d.planner.years[0].name||'Curso ficticio';
  assertModel(d);validateBookMetadata(d);
  return {d,group,second,student,other};
}
function numericResults(d){
  const grade=[];
  for(const st of d.students){
    const group=d.groups.find(g=>g.id===st.groupId);
    for(const period of d.periods){
      grade.push(overallGrade(d,st.id,group.id,period.id));
      for(const cat of d.categories) grade.push(categoryGrade(d,st.id,cat.id,group.id,period.id));
      for(const comp of d.competencies)grade.push(competencyGrade(d,st.id,comp.id,group.id,period.id));
    }
    grade.push(finalGrade(d,st.id,group.id));
  }
  return grade;
}
test('cifrado portátil integral: exportar, autenticar, importar y comparar cada colección y TODOS los cálculos',async()=>{
  const {d}=exerciseDoc(),before=numericResults(d);
  const {key,envelope}=await createVault(password,d);const salt=(await unlockVault(password,envelope)).salt;
  const prepared=await createPortableCopy(d,key,salt);
  const bytes=JSON.stringify(prepared.file);
  assert(!bytes.includes('Alumno 01'));assert(!bytes.includes('Examen escala'));
  assert(!bytes.includes('Griego I B'));assert(!bytes.includes('Rúbrica de actitud'));
  assert.equal(prepared.file.type,'TabulariumCuaderno');
  assert.equal(prepared.file.version,1);
  const restored=await decodeBackupContent(JSON.parse(bytes),password);
  assert.equal(restored.legacy,false);
  assert.equal(restored.exportedAt,prepared.exportedAt);
  assert.deepEqual(restored.doc,d);
  assert.deepEqual(numericResults(restored.doc),before);
  assert.equal(compareBookVersions(d,restored.doc),'same');
});
test('otro IV para cada exportación del mismo cuaderno, ciphertext diferente',async()=>{
  const d=empty(),{key,envelope}=await createVault(password,d),salt=(await unlockVault(password,envelope)).salt;
  const a=await createPortableCopy(d,key,salt),b=await createPortableCopy(d,key,salt);
  assert.notEqual(a.file.vault.iv,b.file.vault.iv);
  assert.notEqual(a.file.vault.data,b.file.vault.data);
  assert.equal(a.file.vault.iterations,310000);
  assert.equal(a.file.vault.kdf,'PBKDF2-SHA-256');
});
test('contraseña incorrecta y datos alterados no producen un modelo restaurado',async()=>{
  const d=empty(),{key,envelope}=await createVault(password,d),salt=(await unlockVault(password,envelope)).salt;
  const {file}=await createPortableCopy(d,key,salt);
  await assert.rejects(decodeBackupContent(file,'Clave equivocada aunque bastante larga'),/Contraseña incorrecta|dañados/);
  const corrupt=structuredClone(file);corrupt.vault.data=corrupt.vault.data.slice(0,-8)+'ABCDwxyz';
  await assert.rejects(decodeBackupContent(corrupt,password),/Contraseña incorrecta|dañados/);
  const splice=structuredClone(file);splice.vault.data=splice.vault.data.slice(0,-32);
  await assert.rejects(decodeBackupContent(splice,password));
  // Los ficheros .cdoc locales no pueden pasar por .cuaderno (etiqueta AEAD).
  const disguised={type:'TabulariumCuaderno',version:1,vault:envelope};
  await assert.rejects(decodeBackupContent(disguised,password));
});
test('versiones, envolturas y archivos inválidos se rechazan antes de sustituir datos',async()=>{
  await assert.rejects(decodeBackupContent({type:'TabulariumCuaderno',version:999,vault:{}},password),/incompatible/);
  await assert.rejects(decodeBackupContent({format:'CualquierFormato',version:1},password),/Formato/);
  await assert.rejects(readBackupFile({size:MAX_CUADERNO_BYTES+1,text:()=>{throw Error('no debería leerse');}},password),/25 MB/);
  await assert.rejects(readBackupFile({size:20,text:async()=>'{ invalid'},password),/dañado|JSON/);
  await assert.rejects(readBackupFile({size:0,text:async()=>''},password),/vacío/);
});
test('no admite copia auténticamente cifrada si el modelo contiene referencias corruptas',async()=>{
  const d=empty();d.grades[0].studentId='no existe';
  const {key,envelope}=await createVault(password,d),salt=(await unlockVault(password,envelope)).salt;
  await assert.rejects(createPortableCopy(d,key,salt),/referencia|Estudiante|Alumno|Calificación|Nota|Referencia|Alumn/i);
});
test('detectar anterior, posterior, mismo, diferente y divergencia a partir de ascendencia',()=>{
  const original=empty();const local=structuredClone(original),remote=structuredClone(original);
  markBookChange(local,original);markBookChange(remote,original);
  assert.equal(compareBookVersions(local,original),'older');
  assert.equal(compareBookVersions(original,local),'newer');
  assert.equal(compareBookVersions(local,local),'same');
  assert.equal(compareBookVersions(local,remote),'divergent');
  assert.equal(compareBookVersions(local,empty()),'different');
  const legacy=structuredClone(original);delete legacy._portability;
  assert.equal(compareBookVersions(local,legacy),'unknown');
  assert.equal(compareBookVersions(null,original),'empty');
});
test('el seguimiento no altera ninguna calificación y retroceder/deshacer genera una nueva revisión',()=>{
  const initial=empty(),next=structuredClone(initial);setGrade(next,next.students[0].id,next.assessments[0].id,8);
  const expected=structuredClone(next.grades);markBookChange(next,initial);
  const undone=structuredClone(initial);markBookChange(undone,next);
  assert.equal(undone._portability.revision,2);
  assert.equal(compareBookVersions(undone,next),'older');
  assert.deepEqual(next.grades,expected);
  assert.deepEqual(undone.grades,initial.grades);
});
test('historial malformado o excedido no se acepta',()=>{
  const d=empty();d._portability.bookId='cambiado';assert.throws(()=>validateBookMetadata(d),/malformado/);
  d._portability.bookId=d.id;d._portability.ancestors=['mala'];assert.throws(()=>validateBookMetadata(d),/malformado/);
});
test('ausencia de acuse exportación no implica guardado en OneDrive',()=>{
  const d=empty(),head=d._portability.head;
  assert.equal(bookStatus(d,null),'unverified');
  const receipt={version:1,bookId:d.id,head,exportedAt:new Date().toISOString()};
  assert.equal(bookStatus(d,receipt),'exported');
  const updated=structuredClone(d);markBookChange(updated,d);
  assert.equal(bookStatus(updated,receipt),'modified');
  assert.equal(bookStatus(empty(),receipt),'unverified');
});
test('copia histórica .cdoc puede migrarse sin atribuirle falsamente un historial',async()=>{
  const d=initialNotebook(),{envelope}=await createVault(password,d);
  const back=await decodeBackupContent(envelope,password);
  assert.equal(back.legacy,true);assert.equal(back.exportedAt,null);
  assert.equal(back.doc._portability,undefined);
  assert.equal(ensureBookMetadata(back.doc),true);
  assertModel(back.doc);
});
test('nombres portátiles apropiados y sin nombres del alumnado',()=>{
  const file=portableFilename(new Date('2026-11-21T16:30:00Z'));
  assert.match(file,/^Tabularium_\d{4}-\d\d-\d\d_\d{4}\.cuaderno$/);
});
