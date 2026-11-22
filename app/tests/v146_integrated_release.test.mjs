import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initialNotebook,assertModel} from '../src/model.js';
import {competencyAcquisitionLevel,competencyArithmeticMean,gradeToFour,overallGrade} from '../src/calculations.js';
import {CURRICULA} from '../src/curriculum-data.js';
import {curriculumCompetenciesWithCriteria} from '../src/official-competencies.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('v1.0 integra catálogo de materias y horario en el modelo y la agenda',()=>{
 const app=read('app.js'),model=read('src/model.js'),planner=read('src/planner.js'),ui=read('src/planner-ui.js');
 for(const token of ['catalogForNotebook','addNotebookSubject','removeNotebookSubject','renderAcademicQuickNav','openSubjectsManager','Materias y grupos','Modo sesión de evaluación'])
   assert(app.includes(token),'Falta '+token);
 assert(model.includes('catalogForNotebook'));assert(model.includes('addNotebookSubject'));
 assert(planner.includes('DEFAULT_TIMETABLE_BANDS'));assert(ui.includes('planner-timetable'));
});
test('v1.0 conserva currículo con criterios dentro de cada CE',()=>{
 const app=read('app.js');
 assert(app.includes('curriculumCompetenciesWithCriteria'));
 assert(app.includes('renderCurriculumCriteria'));
 assert(app.includes('Competencias y criterios'));
 for(const key of ['lat4','lat1','lat2','gr1','gr2','lat2-2022']){
  const dat=CURRICULA[key],groups=curriculumCompetenciesWithCriteria(dat);
  assert.equal(groups.reduce((n,g)=>n+g.criterios.length,0),dat.criterios.length);
 }
});
test('v1.0: escala categórica estricta 1=alta y 4=no adquirida, media sin ponderar',()=>{
 const cases=[[0,4],[4.999,4],[5,3],[6.4999,3],[6.5,2],[7.9999,2],[8,1],[10,1]];
 for(const [grade,level] of cases){assert.equal(gradeToFour(grade),level);assert.equal(competencyAcquisitionLevel(grade),level);}
 assert.equal(gradeToFour(null),null);
 const doc=initialNotebook(),before=structuredClone(doc),st=doc.students[0],g=doc.groups[0],p=doc.periods[0];
 const old=overallGrade(doc,st.id,g.id,p.id);
 const mean=competencyArithmeticMean(doc,st.id,doc.competencies.map(c=>c.id),g.id,p.id);
 assert(mean===null||mean>=0&&mean<=10);
 assert.equal(old,overallGrade(doc,st.id,g.id,p.id));assert.deepEqual(doc,before);assertModel(doc);
});
test('v1.0: PWA única y clases de navegación responsivas',()=>{
 const app=read('app.js'),sw=read('sw.js'),css=read('styles.css');
 const current=sw.match(/const CACHE='(cuaderno-docente-static-v(\d+)-dev)'/);
  assert(current&&Number(current[2])>=150,'La nueva caché no puede retroceder de v150');
  assert(app.includes(`caches.open('${current[1]}')`),'La UI y el service worker deben usar la misma caché');
 
 assert(css.includes('.academic-quick-nav'));
 assert(css.includes('.planner-timetable'));
 assert(css.includes('.curr-criteria-group'));
 assert(css.includes('.competency-mean-values'));
 assert(!app.includes('equivalencia lineal de 1 a 4'));
});
