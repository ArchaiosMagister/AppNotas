import test from 'node:test';
import assert from 'node:assert/strict';
import {
 initialNotebook,assertModel,setNotSubmitted,setPendingJustified,setGrade,
 addAssessment,setRubricGrade,createRubric
} from '../src/model.js';
import {categoryGrade,overallGrade,finalGrade,effectiveAssessmentScore} from '../src/calculations.js';
import {ensureBookMetadata,markBookChange,createPortableCopy,readBackupFile} from '../src/cuaderno.js';
import {createVault,saltFromEnvelope} from '../src/vault.js';

const fx=()=>{const doc=initialNotebook();return {doc,st:doc.students[0],g:doc.groups[0],p:doc.periods[0],a:doc.assessments[0]};};
const grade=(doc,studentId,assessmentId)=>doc.grades.find(x=>x.studentId===studentId&&x.assessmentId===assessmentId);
const pwd='Contraseña de verificación cifrada de NP y AJ 2026';

test('NP → AJ → quitar AJ restaura el NP y el cero que estaba en la media',()=>{
 const {doc,st,g,p,a}=fx();
 setNotSubmitted(doc,st.id,a.id,true);
 const np=structuredClone(grade(doc,st.id,a.id)),before=overallGrade(doc,st.id,g.id,p.id);
 assert.equal(np.notSubmitted,true);
 assert.equal(np.score,0);
 setPendingJustified(doc,st.id,a.id,true);
 const paused=grade(doc,st.id,a.id);
 assert.equal(paused.pendingJustified,true);
 assert.equal(paused.pendingPlaceholder,true);
 assert.equal(paused.pendingWasNotSubmitted,true);
 assert.equal(paused.notSubmitted,undefined);
 assert.equal(effectiveAssessmentScore(doc,a,paused),null);
 setPendingJustified(doc,st.id,a.id,false);
 const restored=grade(doc,st.id,a.id);
 assert.equal(restored.id,np.id);
 assert.equal(restored.createdAt,np.createdAt);
 assert.equal(restored.score,0);
 assert.equal(restored.notSubmitted,true);
 assert.equal(restored.pendingJustified,undefined);
 assert.equal(restored.pendingPlaceholder,undefined);
 assert.equal(restored.pendingWasNotSubmitted,undefined);
 assert.equal(overallGrade(doc,st.id,g.id,p.id),before,'El cero debe volver a contar');
 assertModel(doc);
});

test('AJ creada sobre una casilla vacía continúa quitándose sin generar ceros ni NP',()=>{
 const {doc,st,g,p}=fx();
 const a=addAssessment(doc,{name:'Actividad nunca evaluada',groupId:g.id,periodId:p.id,categoryId:doc.categories[0].id});
 setPendingJustified(doc,st.id,a.id,true);
 assert.equal(grade(doc,st.id,a.id).pendingWasNotSubmitted,undefined);
 setPendingJustified(doc,st.id,a.id,false);
 assert.equal(grade(doc,st.id,a.id),undefined);
 assertModel(doc);
});

test('AJ con NP anterior y nota numérica nueva elimina los indicadores heredados',()=>{
 const {doc,st,g,p,a}=fx();
 setNotSubmitted(doc,st.id,a.id,true);
 setPendingJustified(doc,st.id,a.id,true);
 setGrade(doc,st.id,a.id,0);
 const current=grade(doc,st.id,a.id);
 assert.equal(current.notSubmitted,undefined);
 assert.equal(current.pendingJustified,undefined);
 assert.equal(current.pendingWasNotSubmitted,undefined);
 assert.equal(current.score,0);
 assertModel(doc);
});

test('NP→AJ→restaurar NP persiste en .cuaderno autenticado sin perder historial',async()=>{
 const {doc,st,g,p,a}=fx();
 ensureBookMetadata(doc);
 const previous=structuredClone(doc);
 setNotSubmitted(doc,st.id,a.id,true);
 setPendingJustified(doc,st.id,a.id,true);
 markBookChange(doc,previous);
 const expected=structuredClone(doc);
 const {key,envelope}=await createVault(pwd,doc);
 const {file}=await createPortableCopy(doc,key,saltFromEnvelope(envelope));
 const text=JSON.stringify(file);
 const read=await readBackupFile({size:Buffer.byteLength(text),text:async()=>text},pwd);
 assert.deepEqual(read.doc,expected);
 const pre=read.doc;
 assert.equal(grade(pre,st.id,a.id).pendingWasNotSubmitted,true);
 setPendingJustified(pre,st.id,a.id,false);
 assert.equal(grade(pre,st.id,a.id).notSubmitted,true);
 assert.equal(grade(pre,st.id,a.id).score,0);
 assertModel(pre);
});

test('restaurar rechaza un marcador incoherente sin permitir que se pierdan notas',()=>{
 const {doc,st,a}=fx(),original=structuredClone(doc);
 const g=grade(doc,st.id,a.id);
 g.pendingWasNotSubmitted=true; // Inyección deliberada en un dato de prueba.
 assert.throws(()=>assertModel(doc),/NP anterior inconsistente/);
 assert.equal(original.grades.length,doc.grades.length);
});

test('AJ+NP en rúbrica también restituye NP sin fabricar valoraciones de criterios',()=>{
 const {doc,st,g,p}=fx();
 const rubric=createRubric(doc,'Rúbrica de control',[{name:'Criterio',maxScore:5,weight:1}]);
 const a=addAssessment(doc,{name:'Actividad rúbrica',groupId:g.id,periodId:p.id,
  categoryId:doc.categories[1].id,rubricId:rubric.id});
 setNotSubmitted(doc,st.id,a.id,true);
 setPendingJustified(doc,st.id,a.id,true);
 setPendingJustified(doc,st.id,a.id,false);
 assert.equal(grade(doc,st.id,a.id).notSubmitted,true);
 assert.equal(grade(doc,st.id,a.id).rubricRatings,undefined);
 assert.equal(effectiveAssessmentScore(doc,a,grade(doc,st.id,a.id)),0);
 assertModel(doc);
});
