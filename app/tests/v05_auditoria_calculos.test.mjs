import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initialNotebook,assertModel,addAssessment,addPeriod,addGroup,addStudent,
  setGrade,setCategory,setPeriodCategory,setFinalOverride,setFinalConfig,
  addCompetency,setCompetencyLink,createRubric,setRubricGrade,
  renameStudent,moveStudent,removeStudent,updateGroupInfo,renamePeriod,movePeriod
} from '../src/model.js';
import {categoryEvidence,categoryGrade,overallGrade,competencyGrade,periodCalculationWarnings,finalEvidence,finalGrade,normalizedScore} from '../src/calculations.js';
const close=(actual,expected,tolerance=1e-10)=>assert.ok(Math.abs(actual-expected)<=tolerance,`Esperado ${expected}, recibido ${actual}`);
const fx=()=>{const d=initialNotebook();return {d,g:d.groups[0],p:d.periods[0],s:d.students[0],c:d.categories[0],as:d.assessments}};

test('regla último si mejor no adelanta la última actividad pendiente',()=>{
 const {d,g,p,s,c,as}=fx();setGrade(d,s.id,as[0].id,6);setGrade(d,s.id,as[1].id,9);
 const a=addAssessment(d,{name:'Examen UD3 sin corregir',groupId:g.id,periodId:p.id,categoryId:c.id});
 close(categoryGrade(d,s.id,c.id,g.id,p.id),7.5);
 setGrade(d,s.id,a.id,9.5);close(categoryGrade(d,s.id,c.id,g.id,p.id),9.5);
 setGrade(d,s.id,a.id,2);close(categoryGrade(d,s.id,c.id,g.id,p.id),(6+9+2)/3);
});
test('regla último con recuperación conserva la posición del examen original',()=>{
 const {d,g,p,s,c,as}=fx();setGrade(d,s.id,as[0].id,9);setGrade(d,s.id,as[1].id,8);
 const r=addAssessment(d,{name:'Recuperación UD1',groupId:g.id,periodId:p.id,categoryId:c.id,recoveryOf:as[0].id,recoveryMode:'replace'});
 setGrade(d,s.id,r.id,10);close(categoryGrade(d,s.id,c.id,g.id,p.id),9); // media 10 y 8, no último 10
 assert.equal(categoryEvidence(d,s.id,c.id,g.id,p.id).used.length,2);
});
test('una nota bruta mayor de 10 invalida el cálculo en lugar de crear una media mayor de 10',()=>{
 const {d,g,p,s,c}=fx();const a=addAssessment(d,{name:'Sin convertir /20',groupId:g.id,periodId:p.id,categoryId:c.id,maxScore:20,convertToTen:false});
 setGrade(d,s.id,a.id,18);
 assert.equal(categoryGrade(d,s.id,c.id,g.id,p.id),null);
 assert.equal(overallGrade(d,s.id,g.id,p.id),null);
 assert(periodCalculationWarnings(d,s.id,g.id,p.id).some(x=>x.includes('supera 10')));
 assertModel(d);
});
test('una nota no convertida inferior a 10 se utiliza como nota bruta por elección docente',()=>{
 const {d,g,p,s,c}=fx();const a=addAssessment(d,{name:'Mini /5 bruto',groupId:g.id,periodId:p.id,categoryId:c.id,maxScore:5,convertToTen:false});
 setGrade(d,s.id,a.id,5);close(categoryGrade(d,s.id,c.id,g.id,p.id), (6.5+8+5)/3);
});
test('un problema en categorías con peso 0 no bloquea las demás',()=>{
 const {d,g,p,s}=fx();const c=d.categories[2];setPeriodCategory(d,g.id,p.id,c.id,{weight:0});setPeriodCategory(d,g.id,p.id,d.categories[0].id,{weight:70});
 const extra=addAssessment(d,{name:'Actitud sin conversión /20',groupId:g.id,periodId:p.id,categoryId:c.id,maxScore:20,convertToTen:false});setGrade(d,s.id,extra.id,20);
 close(overallGrade(d,s.id,g.id,p.id),(8*70+7.5*30)/100);
 const comp=addCompetency(d,'CE afectada');setCompetencyLink(d,comp.id,c.id,100);
 assert.equal(competencyGrade(d,s.id,comp.id,g.id,p.id),null);
});
test('rúbrica con distintas escalas se compone sin redondeos intermedios',()=>{
 const {d,g,p,s}=fx();const r=createRubric(d,'Rúbrica',[{name:'A',maxScore:3,weight:3},{name:'B',maxScore:7,weight:1},{name:'C',maxScore:9,weight:2}]);
 const a=addAssessment(d,{name:'Trabajo',groupId:g.id,periodId:p.id,categoryId:d.categories[1].id,rubricId:r.id});
 const score=setRubricGrade(d,s.id,a.id,{[r.criteria[0].id]:2,[r.criteria[1].id]:5,[r.criteria[2].id]:8});
 close(score,10*((2/3)*3+(5/7)+(8/9)*2)/6);
 assertModel(d);
});
test('pesos de actividades ignoran tareas sin nota y conservan el cero real',()=>{
 const {d,g,p,s,c,as}=fx();setPeriodCategory(d,g.id,p.id,c.id,{rule:'weighted_mean'});
 as[0].weight=3;as[1].weight=1;
 setGrade(d,s.id,as[0].id,0);setGrade(d,s.id,as[1].id,null);
 close(categoryGrade(d,s.id,c.id,g.id,p.id),0);
 setGrade(d,s.id,as[1].id,10);close(categoryGrade(d,s.id,c.id,g.id,p.id),2.5);
});
test('final anual no usa el penúltimo periodo como último si el posterior está sin evaluar',()=>{
 const {d,g,s}=fx();setFinalOverride(d,s.id,d.periods[0].id,6);
 const p2=addPeriod(d,'2º');setFinalOverride(d,s.id,p2.id,9);
 const p3=addPeriod(d,'3º');setFinalConfig(d,g.id,{rule:'latest_if_highest'});
 close(finalGrade(d,s.id,g.id),7.5);
 setFinalConfig(d,g.id,{excludedPeriodIds:[p3.id]});close(finalGrade(d,s.id,g.id),9);
});
test('final anual se bloquea ante un periodo con notas e invalidez de escala',()=>{
 const {d,g,p,s}=fx();const p2=addPeriod(d,'Periodo bruto');
 const a=addAssessment(d,{name:'Examen /20',groupId:g.id,periodId:p2.id,categoryId:d.categories[0].id,maxScore:20,convertToTen:false});setGrade(d,s.id,a.id,17);
 assert.equal(finalGrade(d,s.id,g.id),null);assert.equal(finalEvidence(d,s.id,g.id).issue,'invalid_period');
 setFinalConfig(d,g.id,{excludedPeriodIds:[p2.id]});close(finalGrade(d,s.id,g.id),7.95);
 setFinalConfig(d,g.id,{excludedPeriodIds:[]});setFinalOverride(d,s.id,p2.id,8);close(finalGrade(d,s.id,g.id),(7.95+8)/2);
});
test('la configuración incorrecta de ponderaciones no se silencia al calcular la nota anual',()=>{
 const {d,g,p,s,c}=fx();setCategory(d,c.id,{weight:58});
 assert.equal(overallGrade(d,s.id,g.id,p.id),null);
 assert.equal(finalGrade(d,s.id,g.id),null);
 assert.equal(finalEvidence(d,s.id,g.id).issue,'invalid_period');
});
test('porcentajes independientes por grupo y periodo sin contaminación',()=>{
 const {d,g,p,s,c}=fx();const group2=addGroup(d,'Latín I · B','Latín I','2026-2027','1bach');const s2=addStudent(d,group2.id,'Alumno 20');
 const p2=addPeriod(d,'Evaluación 2');
 setPeriodCategory(d,g.id,p2.id,c.id,{weight:70});setPeriodCategory(d,g.id,p2.id,d.categories[1].id,{weight:20});
 setPeriodCategory(d,group2.id,p.id,c.id,{weight:50});setPeriodCategory(d,group2.id,p.id,d.categories[1].id,{weight:40});
 const a=addAssessment(d,{name:'Otro grupo',groupId:group2.id,periodId:p.id,categoryId:c.id});setGrade(d,s2.id,a.id,3);
 assert.equal(overallGrade(d,s.id,g.id,p.id),7.95);assert.equal(overallGrade(d,s.id,g.id,p2.id),null);
 close(overallGrade(d,s2.id,group2.id,p.id),3);assertModel(d);
});
test('gestión: renombrar alumno y grupo conserva identificadores, notas y notas finales manuales',()=>{
 const {d,g,p,s}=fx();setFinalOverride(d,s.id,p.id,7);
 const oldGrade=overallGrade(d,s.id,g.id,p.id),ids=d.grades.filter(x=>x.studentId===s.id).map(x=>x.id);
 renameStudent(d,s.id,'Alumno anónimo 1');updateGroupInfo(d,g.id,'Grupo nuevo','2027-2028');
 assert.equal(s.name,'Alumno anónimo 1');assert.equal(g.name,'Grupo nuevo');assert.equal(g.course,'2027-2028');
 assert.deepEqual(d.grades.filter(x=>x.studentId===s.id).map(x=>x.id),ids);close(overallGrade(d,s.id,g.id,p.id),oldGrade);
 assert.equal(d.finalOverrides.find(x=>x.studentId===s.id).score,7);assertModel(d);
});
test('gestión: reordenar alumnado no modifica calificaciones y evita mezclar grupos',()=>{
 const {d,g,p,s}=fx();const another=d.students[1],id=s.id,initial=overallGrade(d,id,g.id,p.id);
 moveStudent(d,id,1);assert.equal(d.students.filter(s=>s.groupId===g.id).sort((a,b)=>a.order-b.order)[1].id,id);
 close(overallGrade(d,id,g.id,p.id),initial);assertModel(d);
 assert.throws(()=>moveStudent(d,id,8),/Dirección/);
});
test('gestión: eliminar alumno borra solo sus notas y anulaciones manuales; deshacer mediante copia',()=>{
 const {d,g,p,s}=fx(),backup=structuredClone(d),other=d.students[1];
 setFinalOverride(d,s.id,p.id,8);setFinalOverride(d,other.id,p.id,9);
 const otherGrades=d.grades.filter(x=>x.studentId===other.id).map(x=>x.id);
 removeStudent(d,s.id);
 assert(!d.students.find(x=>x.id===s.id));assert(!d.grades.some(x=>x.studentId===s.id));assert(!d.finalOverrides.some(x=>x.studentId===s.id));
 assert.deepEqual(d.grades.filter(x=>x.studentId===other.id).map(x=>x.id),otherGrades);assert.equal(d.finalOverrides.find(x=>x.studentId===other.id).score,9);
 assertModel(d);assertModel(backup);
});
test('gestión: cambiar el orden de periodos altera únicamente reglas que dependen del último',()=>{
 const {d,g,p,s}=fx();const p2=addPeriod(d,'2º');renamePeriod(d,p2.id,'Segundo trimestre');
 setFinalOverride(d,s.id,p.id,6);setFinalOverride(d,s.id,p2.id,9);setFinalConfig(d,g.id,{rule:'latest_if_highest'});
 assert.equal(finalGrade(d,s.id,g.id),9);
 movePeriod(d,p2.id,-1);close(finalGrade(d,s.id,g.id),7.5);
 assert.equal(d.periods.find(x=>x.id===p2.id).name,'Segundo trimestre');assertModel(d);
});
test('rechaza valores no numéricos o fuera de escala antes de guardar',()=>{
 const {d,g,p,s,as}=fx();for(const invalid of ['  ','NaN','Infinity',true,false,{},[],undefined])assert.throws(()=>setGrade(d,s.id,as[0].id,invalid));
 for(const invalid of ['  ','NaN',true,[],{}])assert.throws(()=>setFinalOverride(d,s.id,p.id,invalid));
 assertModel(d);
});
test('validación rechaza pesos fuera de rango y extremos de la escala',()=>{
 const {d,g,p,s}=fx();const x=structuredClone(d);x.categories[0].weight=101;assert.throws(()=>assertModel(x),/Categoría/);
 const y=structuredClone(d);y.competencies[0].links[0].weight=1001;assert.throws(()=>assertModel(y),/competencial/);
 assert.throws(()=>addAssessment(d,{name:'Escala enorme',groupId:g.id,periodId:p.id,categoryId:d.categories[0].id,maxScore:1001}),/inválidos/);
});
test('media anual ponderada ignora un periodo inválido si su peso es exactamente cero',()=>{
 const {d,g,p,s}=fx();const p2=addPeriod(d,'Con escala inválida');
 const a=addAssessment(d,{name:'Bruto fuera de diez',groupId:g.id,periodId:p2.id,categoryId:d.categories[0].id,maxScore:20,convertToTen:false});
 setGrade(d,s.id,a.id,18);
 setFinalConfig(d,g.id,{rule:'weighted_mean',weights:{[p.id]:1,[p2.id]:0}});
 close(finalGrade(d,s.id,g.id),7.95);
});
test('las puntuaciones con coma decimal en una rúbrica coinciden entre vista previa y dato guardado',async()=>{
 const {d,g,p,s}=fx(),r=createRubric(d,'Trabajo',[{name:'Contenido',maxScore:3,weight:2},{name:'Forma',maxScore:5,weight:1}]);
 const assessment=addAssessment(d,{name:'Trabajo',groupId:g.id,periodId:p.id,categoryId:d.categories[1].id,rubricId:r.id});
 const values={[r.criteria[0].id]:'2,5',[r.criteria[1].id]:'4,5'};
 const {previewRubric}=await import('../src/rubric-ui.js');
 const preview=previewRubric(r,values);
 const grade=setRubricGrade(d,s.id,assessment.id,values);
 close(grade,preview.grade);close(grade,10*((2.5/3)*2+4.5/5)/3);
 assertModel(d);
});
test('ni las rúbricas ni las calificaciones aceptan entradas que parecen números pero no son decimales',()=>{
 const {d,g,p,s,as}=fx(),r=createRubric(d,'R',[{name:'C',maxScore:5,weight:1}]);
 const a=addAssessment(d,{name:'R',groupId:g.id,periodId:p.id,categoryId:d.categories[1].id,rubricId:r.id});
 for(const bad of ['0x4','1e1',' ','1,2.3','2,3,4']){
   assert.throws(()=>setRubricGrade(d,s.id,a.id,{[r.criteria[0].id]:bad}));
   assert.throws(()=>setGrade(d,s.id,as[0].id,bad));
   assert.throws(()=>setFinalOverride(d,s.id,p.id,bad));
 }
 assert.equal(d.grades.filter(x=>x.studentId===s.id&&x.assessmentId===a.id).length,0);
});
test('auditoría determinista: 720 escenarios de reglas calculadas contra un oráculo independiente',()=>{
 let seed=1849;const rand=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
 const rules=['mean','weighted_mean','highest','best_n','last','latest_if_highest'];
 for(const rule of rules)for(let iteration=0;iteration<120;iteration++){
   const {d,g,p,s,c,as}=fx();const exams=as.filter(a=>a.categoryId===c.id);
   while(exams.length<5){exams.push(addAssessment(d,{name:'Examen extra '+exams.length,groupId:g.id,periodId:p.id,categoryId:c.id}));}
   setPeriodCategory(d,g.id,p.id,c.id,{rule,bestCount:3});
   const items=[];
   for(const assessment of exams){
     assessment.weight=1+Math.floor(rand()*10);
     if(rand()<0.24){setGrade(d,s.id,assessment.id,null);continue;}
     const value=Math.round(rand()*1000)/100;setGrade(d,s.id,assessment.id,value);
     items.push({id:assessment.id,value,weight:assessment.weight});
   }
   const actual=categoryGrade(d,s.id,c.id,g.id,p.id);
   if(!items.length){assert.equal(actual,null);continue;}
   const avg=xs=>xs.reduce((total,x)=>total+x.value,0)/xs.length;
   let expected;
   switch(rule){
     case 'mean':expected=avg(items);break;
     case 'weighted_mean':expected=items.reduce((t,x)=>t+x.value*x.weight,0)/items.reduce((t,x)=>t+x.weight,0);break;
     case 'highest':expected=Math.max(...items.map(x=>x.value));break;
     case 'best_n':expected=avg([...items].sort((a,b)=>b.value-a.value).slice(0,3));break;
     case 'last':expected=items.at(-1).value;break;
     case 'latest_if_highest':expected=items.at(-1).id===exams.at(-1).id&&items.at(-1).value>=Math.max(...items.map(x=>x.value))?items.at(-1).value:avg(items);break;
   }
   close(actual,expected);
 }
});
