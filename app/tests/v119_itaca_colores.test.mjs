import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initialNotebook,assertModel,addGroup,setGrade,ITACA_ROUNDING,setItacaGroupRule,setItacaStudentRule,itacaGroupRule,itacaStudentRule,setCategoryColumnColor,setItacaAttitudeCondition,itacaAttitudeCondition,createRubric,addAssessment,setRubricGrade} from '../src/model.js';
import {overallGrade,finalGrade,itacaGrade,itacaAttitudeBlock} from '../src/calculations.js';
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
  assert.equal(itacaGrade(d,student.id,group.id,period.id),6);
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
test('la columna Ítaca siempre muestra enteros y permite configurar actitud pulsando el título',async()=>{
 const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
 assert(app.includes('<th class="itaca-col"><button type="button" id="configure-itaca-attitude"'));
 assert(app.includes('${esc(String(score))}'));
 assert(!app.includes('rule===\'none\'?score.toLocaleString'));
 assert(app.includes('data-itaca-student'));
});

test('Ítaca muestra 5 para 5,9 cuando Actitud impide la subida y 6 cuando se permite',()=>{
 const {d,group,period,student,category,rubric,activity}=attitudeFixture();
 const id=student.id,gid=group.id,pid=period.id;
 for(const a of d.assessments.filter(a=>a.groupId===gid&&a.periodId===pid&&!a.rubricId))setGrade(d,id,a.id,5.9);
 const original=overallGrade(d,id,gid,pid),grades=structuredClone(d.grades);
 assert(Math.abs(original-5.9)<1e-9);
 assert.equal(itacaGrade(d,id,gid,pid),6);
 setItacaGroupRule(d,gid,'none');
 assert.equal(itacaGrade(d,id,gid,pid),5);
 setItacaGroupRule(d,gid,'half');
 setItacaAttitudeCondition(d,gid,pid,{mode:'criterion',categoryId:category.id,assessmentId:activity.id,criterionId:rubric.criteria[0].id,minScore:1});
 assert.equal(itacaGrade(d,id,gid,pid),5,'Sin evidencia de rúbrica no se permite subir');
 assert.equal(overallGrade(d,id,gid,pid),original);
 assert.deepEqual(d.grades,grades);
 setRubricGrade(d,id,activity.id,{[rubric.criteria[0].id]:1,[rubric.criteria[1].id]:1});
 assert.equal(itacaAttitudeBlock(d,id,gid,pid),null,'Al cumplir Actitud puede subir');
 assert.equal(itacaGrade(d,id,gid,pid),6);
 setItacaAttitudeCondition(d,gid,pid,null);
 assert.equal(itacaGrade(d,id,gid,pid),6);
});

function attitudeFixture(){
 const {d,group,period,student}=current();
 allTheSame(d,student,group,period,6.7);
 const category=d.categories.find(c=>c.name==='Actitud');
 const rubric=createRubric(d,'Actitud de prueba',[
  {name:'Participación',maxScore:2,weight:1},{name:'Atención',maxScore:2,weight:1}
 ]);
 const activity=addAssessment(d,{name:'Actitud con rúbrica',groupId:group.id,periodId:period.id,
  categoryId:category.id,rubricId:rubric.id,maxScore:10,convertToTen:true});
 return {d,group,period,student,category,rubric,activity};
}
test('Ítaca: umbral de un criterio de Actitud bloquea solo el redondeo, no el cálculo',()=>{
 const {d,group,period,student,category,rubric,activity}=attitudeFixture();
 const id=student.id,gid=group.id,pid=period.id;
 const criteria=rubric.criteria;
 setRubricGrade(d,id,activity.id,{[criteria[0].id]:0,[criteria[1].id]:2});
 const base=overallGrade(d,id,gid,pid),snapshot=structuredClone(d.grades);
 assert(base>6.5&&base<7);
 assert.equal(itacaGrade(d,id,gid,pid),7);
 setItacaAttitudeCondition(d,gid,pid,{mode:'criterion',categoryId:category.id,
  assessmentId:activity.id,criterionId:criteria[0].id,minScore:1});
 assert.equal(itacaGrade(d,id,gid,pid),Math.floor(base));
 assert.match(itacaAttitudeBlock(d,id,gid,pid),/Participación/);
 assert.deepEqual(d.grades,snapshot);
 assertModel(d);
 setRubricGrade(d,id,activity.id,{[criteria[0].id]:2,[criteria[1].id]:2});
 assert.equal(itacaAttitudeBlock(d,id,gid,pid),null);
 assert.equal(itacaGrade(d,id,gid,pid),7);
 setItacaAttitudeCondition(d,gid,pid,null);
 assert.equal(itacaAttitudeCondition(d,gid,pid),null);
});
test('Ítaca: falta de rúbrica o AJ bloquea por precaución; periodo siguiente no se ve afectado',()=>{
 const {d,group,period,student,category,rubric,activity}=attitudeFixture();
 const [first]=rubric.criteria;
 setItacaAttitudeCondition(d,group.id,period.id,{mode:'criterion',categoryId:category.id,
  assessmentId:activity.id,criterionId:first.id,minScore:1});
 const average=overallGrade(d,student.id,group.id,period.id);
 assert.equal(itacaGrade(d,student.id,group.id,period.id),Math.floor(average));
 assert.match(itacaAttitudeBlock(d,student.id,group.id,period.id),/Falta/);
 assert.equal(itacaAttitudeCondition(d,group.id,d.periods[1].id),null);
 assertModel(d);
});
test('Ítaca: aprobado de la categoría Actitud y excepciones personales no eluden el requisito',()=>{
 const {d,group,period,student,category,rubric,activity}=attitudeFixture();
 const [first,second]=rubric.criteria;
 for(const base of d.assessments.filter(a=>a.groupId===group.id&&a.periodId===period.id&&!a.rubricId))
  setGrade(d,student.id,base.id,6.9);
 setRubricGrade(d,student.id,activity.id,{[first.id]:0,[second.id]:0});
 const base=overallGrade(d,student.id,group.id,period.id);
 assert(base>6.5&&base<7);
 setItacaStudentRule(d,student.id,period.id,'half');
 setItacaAttitudeCondition(d,group.id,period.id,{mode:'category',categoryId:category.id,minScore:5});
 assert.equal(itacaGrade(d,student.id,group.id,period.id),Math.floor(base));
 assert.match(itacaAttitudeBlock(d,student.id,group.id,period.id),/5\/10/);
 setRubricGrade(d,student.id,activity.id,{[first.id]:2,[second.id]:2});
 assert.equal(itacaAttitudeBlock(d,student.id,group.id,period.id),null);
 assert.equal(itacaGrade(d,student.id,group.id,period.id),7);
 assertModel(d);
});
test('Ítaca: no se aceptan referencias ajenas, umbrales fuera de escala ni configuración corrupta',()=>{
 const {d,group,period,category,rubric,activity}=attitudeFixture();
 const before=structuredClone(d),crit=rubric.criteria[0].id;
 const base={mode:'criterion',categoryId:category.id,assessmentId:activity.id,criterionId:crit,minScore:5};
 assert.throws(()=>setItacaAttitudeCondition(d,group.id,period.id,base),/umbral/);
 assert.deepEqual(d,before);
 assert.throws(()=>setItacaAttitudeCondition(d,group.id,period.id,
  {mode:'category',categoryId:d.categories[0].id,minScore:5}),/categoría Actitud/);
 assert.deepEqual(d,before);
 setItacaAttitudeCondition(d,group.id,period.id,{...base,minScore:1});
 assertModel(d);
 d.groups[0].itacaAttitudeConditions[period.id].minScore=-1;
 assert.throws(()=>assertModel(d),/Ítaca/);
});
