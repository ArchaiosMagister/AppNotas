import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {COURSE_SUBJECTS,subjectKey,validSubject,SUBJECT_COLORS} from '../src/model.js';
const root=new URL('../',import.meta.url);
const app=readFileSync(new URL('app.js',root),'utf8');
const css=readFileSync(new URL('styles.css',root),'utf8');

test('cada curso y asignatura forma una opción válida e independiente',()=>{
 const pairs=Object.entries(COURSE_SUBJECTS).flatMap(([level,x])=>x.subjects.map(subject=>({level,subject})));
 assert.deepEqual(pairs.map(x=>subjectKey(x.level,x.subject)),[
  '4eso:Latín 4.º','1bach:Latín I','1bach:Griego I','2bach:Latín II','2bach:Griego II'
 ]);
 assert.equal(new Set(pairs.map(x=>subjectKey(x.level,x.subject))).size,5);
 for(const {level,subject} of pairs){assert.ok(validSubject(level,subject));assert.match(SUBJECT_COLORS[subjectKey(level,subject)],/^#[0-9A-F]{6}$/i);}
});
test('el selector cambia materia y curso juntos, conservando el grupo anterior por materia',()=>{
 assert.match(app,/data-course-level=/);
 assert.match(app,/data-course-subject=/);
 assert.match(app,/STATE\.level===x\.level&&STATE\.subject===x\.subject/);
 assert.match(app,/setSubjectChoice\(level,subject\)/);
 assert.doesNotMatch(app,/<select id="subject-select"/);
 assert.match(app,/g\.level===null&&g\.subject===subject/);
});
test('botones accesibles y grandes, acentos CSSOM compatibles con la política CSP',()=>{
 assert.match(css,/course-choice\{[\s\S]*?min-height:69px/);
 assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(css,/course-choice:focus-visible/);
 assert.match(app,/button\.style\.setProperty\('--course-accent'/);
 assert.match(app,/aria-pressed="\$\{STATE\.level===x\.level&&STATE\.subject===x\.subject\}"/);
});
