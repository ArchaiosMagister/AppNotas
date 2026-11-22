import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CURRICULA} from '../src/curriculum-data.js';
import {curriculumCompetenciesWithCriteria} from '../src/official-competencies.js';
import {initialNotebook} from '../src/model.js';
import {overallGrade,finalGrade} from '../src/calculations.js';

for(const key of ['lat4','lat1','lat2','gr1','gr2','lat2-2022']){
  test('criterios agrupados sin pérdidas ni duplicados: '+key,()=>{
    const data=CURRICULA[key],grouped=curriculumCompetenciesWithCriteria(data);
    assert.equal(grouped.length,5);
    assert.equal(grouped.reduce((sum,g)=>sum+g.criterios.length,0),data.criterios.length);
    assert.deepEqual(grouped.map(g=>g.competencia.id),data.competencias.map(c=>c.id));
    for(const item of grouped){
      assert.deepEqual(item.criterios,data.criterios.filter(c=>String(c.competencia)===String(item.competencia.id)));
    }
    assert.equal(new Set(grouped.flatMap(g=>g.criterios)).size,data.criterios.length);
  });
}
test('buscar un código de criterio muestra solamente su coincidencia y la competencia correspondiente',()=>{
  const groups=curriculumCompetenciesWithCriteria(CURRICULA.lat2,{query:'1.2'});
  assert.deepEqual(groups.map(g=>g.competencia.id),[1]);
  assert.deepEqual(groups[0].criterios.map(c=>c.codigo),['1.2']);
  assert.deepEqual(curriculumCompetenciesWithCriteria(CURRICULA.lat2,{query:'sin coincidencias imposibles'}),[]);
});
test('buscar una competencia muestra todos sus criterios y filtra por CE seleccionada',()=>{
  const data=CURRICULA['lat2-2022'],groups=curriculumCompetenciesWithCriteria(data,{competence:'3',query:'CE3'});
  assert.equal(groups.length,1);
  assert.equal(groups[0].competencia.id,3);
  assert.equal(groups[0].criterios.length,data.criterios.filter(c=>c.competencia===3).length);
  assert.deepEqual(curriculumCompetenciesWithCriteria(data,{query:'5.1.1'})[0].criterios.map(c=>c.codigo),['5.1.1']);
  assert.deepEqual(curriculumCompetenciesWithCriteria(data,{competence:'5',query:'5.1.1'}),[]);
});
test('la vista curricular no modifica repertorios originales, datos privados ni notas',()=>{
  const data=CURRICULA.lat4,dataBefore=JSON.stringify(data),doc=initialNotebook(),docBefore=JSON.stringify(doc);
  const s=doc.students[0],g=doc.groups[0],p=doc.periods[0];
  const grade=overallGrade(doc,s.id,g.id,p.id),annual=finalGrade(doc,s.id,g.id);
  curriculumCompetenciesWithCriteria(data,{query:'romanización'});
  curriculumCompetenciesWithCriteria(CURRICULA.gr1,{competence:'2'});
  assert.equal(JSON.stringify(data),dataBefore);
  assert.equal(JSON.stringify(doc),docBefore);
  assert.equal(overallGrade(doc,s.id,g.id,p.id),grade);
  assert.equal(finalGrade(doc,s.id,g.id),annual);
  assert.deepEqual(curriculumCompetenciesWithCriteria(null),[]);
});
test('interfaz muestra criterios bajo cada CE y elimina la pestaña independiente',()=>{
  const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
  const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
  assert(app.includes("['competencias','Competencias y criterios']"));
  assert(!app.includes("['criterios','Criterios de evaluación']"));
  for(const marker of ['curriculumCompetenciesWithCriteria(data,','renderCurriculumCriteria(data,criterios,c.id)','curr-criteria-group','curr-criteria-list','curr-criterion-code','id="curr-search"','id="curr-competence"'])assert(app.includes(marker),marker);
  assert(css.includes('.curr-card-grid.curr-competency-grid'));
});
