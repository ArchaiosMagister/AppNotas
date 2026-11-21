import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initialNotebook,addGroup,addCompetency,setCompetencyLink,assertModel,renamePeriod,setGrade} from '../src/model.js';
import {overallGrade,competencyGrade,normalizedScore} from '../src/calculations.js';
import {officialCompetenciesForGroup,groupCompetencies,linkedOfficialCompetency} from '../src/official-competencies.js';
import {CURRICULA} from '../src/curriculum-data.js';
const base=new URL('../',import.meta.url);
const official=[['4eso','Latín 4.º','lat4'],['1bach','Latín I','lat1'],['1bach','Griego I','gr1'],['2bach','Latín II','lat2-2022'],['2bach','Griego II','gr2']];
test('se incorporan las cinco competencias específicas oficiales de cada materia con su enunciado completo',()=>{
 const d=initialNotebook();
 for(const [level,subject,expected] of official){
  const group=addGroup(d,subject,subject,'2026-2027',level);
  const catalog=officialCompetenciesForGroup(group);
  assert.equal(catalog.data.id,expected);
  assert.equal(catalog.competencias.length,5);
  assert.deepEqual(catalog.competencias.map(c=>c.code),['CE1','CE2','CE3','CE4','CE5']);
  for(const c of catalog.competencias){
    assert(c.enunciado.length>85);
    assert(c.key.startsWith(expected+':'));
    assert.equal(c.source,catalog.data.norma);
    assert.equal(c.enunciado,catalog.data.competencias.find(x=>'CE'+x.id===c.code).enunciado);
  }
  if(subject==='Griego II')assert.match(catalog.warning,/referencia futura/);
 }
 assertModel(d);
});
test('Latín II aplica los períodos normativos 2026–2027 y 2027–2028 sin mezclar competencias',()=>{
 const d=initialNotebook();
 const gOld=addGroup(d,'Latín II actual','Latín II','2026-2027','2bach');
 const gNew=addGroup(d,'Latín II siguiente','Latín II','2027-2028','2bach');
 assert.equal(officialCompetenciesForGroup(gOld).data.id,'lat2-2022');
 assert.equal(officialCompetenciesForGroup(gNew).data.id,'lat2');
 assert.equal(officialCompetenciesForGroup(gOld,'2026').data.id,'lat2');
 assert.match(officialCompetenciesForGroup(gOld,'2026').warning,/referencia futura/);
 assert.notEqual(officialCompetenciesForGroup(gOld).competencias[0].enunciado,officialCompetenciesForGroup(gNew).competencias[0].enunciado);
 assertModel(d);
});
test('Las competencias nuevas se vinculan explícitamente y solo al grupo creado',()=>{
 const d=initialNotebook(), g1=d.groups[0], g2=addGroup(d,'Griego I A','Griego I','2026-2027','1bach');
 const oldScores=structuredClone(d.grades);
 const before=overallGrade(d,d.students[0].id,g1.id,d.periods[0].id);
 const official=officialCompetenciesForGroup(g2).competencias[0];
 assert.equal(linkedOfficialCompetency(d,g2.id,official.key),null);
 const c=addCompetency(d,official.code+' · '+official.enunciado,g2.id,official.key);
 setCompetencyLink(d,c.id,d.categories[0].id,2);
 assert.equal(linkedOfficialCompetency(d,g2.id,official.key).id,c.id);
 assert(!groupCompetencies(d,g1.id).some(x=>x.id===c.id));
 assert.equal(groupCompetencies(d,g2.id).length,1);
 assert.equal(groupCompetencies(d,g1.id).length,1); // legacy CE1 original not erased
 assert.throws(()=>addCompetency(d,official.code,g2.id,official.key),/ya vinculada/);
 assert.throws(()=>addCompetency(d,'Falsa',g2.id,'x"><img'),/Código competencial inválido/);
 assert.equal(competencyGrade(d,d.students[0].id,c.id,g1.id,d.periods[0].id),null); // student belongs to other group but model legacy category has no grade in g2
 assert.deepEqual(d.grades,oldScores);
 assert.equal(overallGrade(d,d.students[0].id,g1.id,d.periods[0].id),before);
 assertModel(d);
});
test('renombrar período conserva identificadores, notas y medias; la conversión es solo de presentación',()=>{
 const d=initialNotebook(),p=d.periods[0],beforeGrades=structuredClone(d.grades),s=d.students[0],g=d.groups[0];
 const before=overallGrade(d,s.id,g.id,p.id);
 renamePeriod(d,p.id,'Primer trimestre personalizado');
 assert.equal(d.periods[0].id,p.id);
 assert.deepEqual(d.grades,beforeGrades);
 assert.equal(overallGrade(d,s.id,g.id,p.id),before);
 assert.equal(normalizedScore(4.25,5,true),8.5);
 assertModel(d);
});
test('la v1.3 incluye el control nuevo de período y el original editable debajo de la nota convertida',()=>{
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
 assert.match(app,/data-rename-period/);
 assert.match(app,/id="new-period"/);
 assert.doesNotMatch(app,/id="edit-period"/);
 assert.match(app,/converted-primary/);
 assert.match(app,/original-note-input/);
 assert.match(app,/officialCompetenciesForGroup/);
 assert.match(css,/--row-even/);
 assert.match(css,/term-add/);
 assert.match(css,/border-bottom:4px solid var\(--accent\)/);
});
