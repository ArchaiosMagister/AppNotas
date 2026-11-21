import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initialNotebook,assertModel,addGroup,setGrade,ITACA_ROUNDING,setItacaGroupRule,setItacaStudentRule,itacaGroupRule,itacaStudentRule,setCategoryColumnColor} from '../src/model.js';
import {overallGrade,finalGrade,itacaGrade} from '../src/calculations.js';
import {ensureBookMetadata,createPortableCopy,decodeBackupContent} from '../src/cuaderno.js';
import {createVault,unlockVault} from '../src/vault.js';
const current=()=>{const d=initialNotebook(),group=d.groups[0],period=d.periods[0],student=d.students[0];return {d,group,period,student};};
function allTheSame(d,student,group,period,value){
  const active=d.assessments.filter(a=>a.periodId===period.id&&a.groupId===group.id);
  for(const a of active)setGrade(d,student.id,a.id,value);
}
test('Ítaca: regla general 0,5 (sin cambiar medias, curso ni evidencias)',()=>{
  const {d,group,period,student}=current();
  for(const v of [0,4.49,4.5,6.49,6.5,6.7,9.49,9.5,10]){
    allTheSame(d,student,group,period,v);
    const originalGrades=structuredClone(d.grades),before=overallGrade(d,student.id,group.id,period.id),year=finalGrade(d,student.id,group.id);
    assert(Math.abs(before-v)<1e-9);
    assert.equal(itacaGrade(d,student.id,group.id,period.id),Math.min(10,Math.floor(v)+(v-Math.floor(v)>=.5?1:0)));
    assert.deepEqual(d.grades,originalGrades);assert.equal(overallGrade(d,student.id,group.id,period.id),before);assert.equal(finalGrade(d,student.id,group.id),year);
  }
});
test('Ítaca 0,7 y sin redondear; umbral decimal exacto y ausencia de notas',()=>{
  const {d,group,period,student}=current();
  setItacaGroupRule(d,group.id,'seven');assert.equal(itacaGroupRule(d,group.id),'seven');
  for(const [v,expected] of [[2.49,2],[2.5,2],[2.69,2],[2.7,3],[2.71,3],[9.7,10],[10,10]]){
    allTheSame(d,student,group,period,v);
    assert.equal(itacaGrade(d,student.id,group.id,period.id),expected);
  }
  setItacaGroupRule(d,group.id,'none');allTheSame(d,student,group,period,6.73);
  assert.equal(itacaGrade(d,student.id,group.id,period.id),overallGrade(d,student.id,group.id,period.id));
  assert.equal(itacaGrade(d,student.id,group.id,d.periods[2].id),null);
});
test('excepción individual de un periodo no afecta a otras evaluaciones o alumnos ni al grupo',()=>{
  const {d,group,period,student}=current();const second=d.students[1];
  allTheSame(d,student,group,period,6.6);allTheSame(d,second,group,period,6.6);
  setItacaGroupRule(d,group.id,'seven');
  assert.equal(itacaGrade(d,student.id,group.id,period.id),6);
  setItacaStudentRule(d,student.id,period.id,'half');
  assert.equal(itacaGrade(d,student.id,group.id,period.id),7);
  assert.equal(itacaGrade(d,second.id,group.id,period.id),6);
  assert.equal(itacaStudentRule(d,student.id,d.periods[1].id),'general');
  assert.equal(itacaGroupRule(d,group.id),'seven');
  assert.equal(overallGrade(d,student.id,group.id,period.id),overallGrade(d,second.id,group.id,period.id));
  setItacaStudentRule(d,student.id,period.id,'general');
  assert.equal(itacaGrade(d,student.id,group.id,period.id),6);
  assert.equal(d.students[0].itacaRoundingOverrides,undefined);
});
test('las reglas y colores se validan ANTES de afectar a otros datos',()=>{
  const {d,group,period,student}=current(),category=d.categories[0];
  assert.deepEqual(ITACA_ROUNDING,['half','seven','none']);
  const original=structuredClone(d);assert.throws(()=>setItacaGroupRule(d,group.id,'up'),/inválida/);assert.deepEqual(d,original);
  assert.throws(()=>setItacaStudentRule(d,student.id,period.id,'weird'),/inválida/);assert.deepEqual(d,original);
  assert.throws(()=>setCategoryColumnColor(d,category.id,'red'),/inválido/);assert.deepEqual(d,original);
  setCategoryColumnColor(d,category.id,'#34aAbB');assert.equal(category.columnColor,'#34AABB');
  assertModel(d);
  d.categories[0].columnColor='url(javascript:alert(1))';assert.throws(()=>assertModel(d),/Categoría inválida/);
  d.categories[0].columnColor='#34AABB';setCategoryColumnColor(d,category.id,null);assert.equal(category.columnColor,undefined);
  assertModel(d);
  d.students[0].itacaRoundingOverrides={[period.id]:'none',not_a_period:'half'};assert.throws(()=>assertModel(d),/Ítaca/);
});
test('copiar/exportar/importar cuaderno cifrado conserva colores e Ítaca sin pérdida numérica',async()=>{
  const {d,group,period,student}=current();ensureBookMetadata(d);
  allTheSame(d,student,group,period,6.7);
  setItacaGroupRule(d,group.id,'seven');setItacaStudentRule(d,student.id,period.id,'half');
  setCategoryColumnColor(d,d.categories[0].id,'#88AABB');
  const values=d.students.flatMap(s=>d.periods.flatMap(p=>[overallGrade(d,s.id,group.id,p.id),itacaGrade(d,s.id,group.id,p.id)]));
  const {key,envelope}=await createVault('Contraseña-ficticia-pruebas-2026!',d);
  const salt=(await unlockVault('Contraseña-ficticia-pruebas-2026!',envelope)).salt;
  const file=(await createPortableCopy(d,key,salt)).file;
  assert(!JSON.stringify(file).includes('Alumno 01'));
  const restored=(await decodeBackupContent(file,'Contraseña-ficticia-pruebas-2026!')).doc;
  assert.deepEqual(restored,d);
  const after=d.students.flatMap(s=>d.periods.flatMap(p=>[overallGrade(restored,s.id,group.id,p.id),itacaGrade(restored,s.id,group.id,p.id)]));
  assert.deepEqual(after,values);
  assert.equal(restored.categories[0].columnColor,'#88AABB');
});
test('los cuadernos previos sin nuevos campos siguen siendo válidos y usan la regla 0,5',()=>{
  const {d,group,period,student}=current();
  for(const g of d.groups)delete g.itacaRounding;
  for(const s of d.students)delete s.itacaRoundingOverrides;
  for(const c of d.categories)delete c.columnColor;
  assert.doesNotThrow(()=>assertModel(d));
  allTheSame(d,student,group,period,6.5);
  assert.equal(itacaGrade(d,student.id,group.id,period.id),7);
});
test('interfaz: cabecera Ítaca, selector general, opción por alumno, colores y OLED',async()=>{
 const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
 const css=await readFile(new URL('../styles.css',import.meta.url),'utf8');
 for(const needle of ['itaca-general-rule','data-itaca-student','Nota Ítaca','setItacaStudentRule','data-category-color','data-category-color-reset','category-tinted','itacaGrade('])assert(app.includes(needle),needle);
 assert(css.includes('html[data-theme="oled"] .grade-table th.category-tinted'));
 assert(css.includes('border-left:3px solid var(--category-color)'));
});
test('la columna presenta enteros o media con decimales independientemente de la precisión visual general',async()=>{
 const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
 assert(app.includes('rule===\'none\'?score.toLocaleString'));
 assert(app.includes("minimumFractionDigits:2,maximumFractionDigits:2"));
 assert(app.includes("return `<span class=\"grade-chip\""));
});
