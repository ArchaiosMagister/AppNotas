import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {formatGrade,competencyAcquisitionLevel,competencyAcquisitionLabel} from '../src/calculations.js';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
test('medias competenciales visibles con dos decimales, sin redondear el nivel',()=>{
 const code=app.slice(app.indexOf('const competencySourceGrade='),app.indexOf('function competencyScaleLegend('));
 const render=runInNewContext(code+';competencyLevelChip',{formatGrade,competencyAcquisitionLevel,competencyAcquisitionLabel,esc:s=>String(s)});
 for(const [n,formatted,level] of [[.59583333,'0,60',4],[0,'0,00',4],[4.9999,'5,00',4],[6.4999,'6,50',3],[7.9999,'8,00',2],[10,'10,00',1]]){
  const html=render(n);
  assert(html.includes('competency-level-'+level+'"'));assert(html.includes(formatted+' / 10'));
  assert.deepEqual([...html.matchAll(/([\d]+,\d+) \/ 10/g)].map(m=>m[1]),[formatted,formatted]);
  assert.equal((html.match(/class="competency-source-grade/g)||[]).length,1);
 }
 assert(render(null).includes('Sin evidencias'));
 const mean=render(.59583333,'Media aritmética');
 assert(mean.includes('Media aritmética:'));assert(!mean.includes('Media original'));
 assert.equal((mean.match(/class="competency-source-grade/g)||[]).length,1);
});
test('tablas oficiales y personalizadas comparten diseño aislado de las ponderaciones',()=>{
 const render=app.slice(app.indexOf('function renderCompetencies(){'),app.indexOf('function currentCurriculum(){'));
 assert.equal((render.match(/class="comp-table competency-results-table"/g)||[]).length,2);
 assert.equal((render.match(/class="overflow-auto competency-results-scroll"/g)||[]).length,2);
 assert(render.includes("competencyLevelChip(score,'Media aritmética')"));
 assert(css.includes('grid-template-rows:minmax(30px,1fr) 44px minmax(30px,1fr)'));
 assert(css.includes('.competency-view .competency-results-table{table-layout:fixed'));
 assert(css.includes('.competency-results-table .competency-source-value{display:block;white-space:nowrap}'));
});
