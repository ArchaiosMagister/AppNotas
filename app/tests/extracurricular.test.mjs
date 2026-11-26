import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {emptyNotebook,addGroup,addStudent,assertModel,migrateNotebook,removeStudent} from '../src/model.js';
import {linkStudentRecords} from '../src/evaluation-groups.js';
import {extracurricularCourseKey,extracurricularStudentKey,extracurricularRoster,setExtracurricularAnswer} from '../src/extracurricular.js';
import {extracurricularReport,extracurricularWord,extracurricularPdf} from '../src/extracurricular-export.js';

const Zip=runInNewContext(readFileSync(new URL('../vendor/jszip.min.js',import.meta.url),'utf8')+';JSZip',
  {Blob,ArrayBuffer,Uint8Array,Uint16Array,Uint32Array,Int32Array,setImmediate,setTimeout});
function fixture(){
  const doc=emptyNotebook();
  const latin=addGroup(doc,'1.º BACH B','Latín I');
  const greek=addGroup(doc,'1.º BACH B','Griego I');
  const older=addGroup(doc,'2.º Bachillerato A','Latín II');
  const eso=addGroup(doc,'4.º ESO A','Latín 4.º');
  const ana=addStudent(doc,latin.id,{name:'Ana Vidal',originGroup:'1.º BACH B'});
  const duplicate=addStudent(doc,greek.id,'Ana Vidal');
  linkStudentRecords(doc,[ana.id,duplicate.id]);
  const elena=addStudent(doc,older.id,'Elena Adell');
  const sara=addStudent(doc,latin.id,{name:'Sara Roig',originGroup:'1.º BACH A'});
  const outside=addStudent(doc,eso.id,'Alumno de otro curso');
  const activity={id:'visita',name:'Museo & teatro',date:'2026-11-26',
    courses:[extracurricularCourseKey(older),extracurricularCourseKey(latin)],answers:{}};
  return {doc,activity,ana,duplicate,elena,sara,outside};
}

test('la actividad incorpora la matrícula de cada curso y conserva respuestas en el cuaderno',()=>{
  const {doc,activity,ana,duplicate,elena,outside}=fixture();
  assert.equal(migrateNotebook(doc).migrated,false);
  doc.extracurricularActivities=[activity];
  assert.equal(extracurricularRoster(doc,activity.courses).length,3);
  assert.throws(()=>setExtracurricularAnswer(doc,activity.id,outside.id,true),/Participación inválida/);
  setExtracurricularAnswer(doc,activity.id,extracurricularStudentKey(ana),true);
  setExtracurricularAnswer(doc,activity.id,elena.id,false);
  assert.equal(assertModel(doc),true);
  assert.equal(activity.answers[duplicate.id],true);
  removeStudent(doc,ana.id);
  assert(!Object.hasOwn(activity.answers,ana.id));
  const restored=migrateNotebook(structuredClone(doc)).doc;
  assert.deepEqual(extracurricularReport(restored,restored.extracurricularActivities[0]).groups.flatMap(g=>g.students),['Ana Vidal']);
  assert.throws(()=>assertModel({...doc,extracurricularActivities:[{...activity,date:'2026-02-30'}]}),/Fecha imposible/);
});

test('Word y PDF contienen solo el sí, con fecha completa y grupos ordenados y traducidos',async()=>{
  const {doc,activity,ana,sara,elena}=fixture();
  doc.extracurricularActivities=[activity];
  for(const student of [ana,elena])setExtracurricularAnswer(doc,activity.id,extracurricularStudentKey(student),true);
  setExtracurricularAnswer(doc,activity.id,sara.id,false);
  const spanish=extracurricularReport(doc,activity);
  assert.equal(spanish.title,'Alumnado que participa en la actividad extraescolar Museo & teatro del día jueves, 26 de noviembre de 2026:');
  assert.deepEqual(spanish.groups.map(group=>group.students),[['Ana Vidal'],['Elena Adell']]);
  const valencian=extracurricularReport(doc,activity,'val');
  assert.match(valencian.title,/Alumnat que participa en l’activitat extraescolar Museo & teatro del dia dijous, 26 de novembre del? 2026:/);
  assert.match(valencian.groups[0].heading,/1r Batxillerat · 1r BAT B/);
  assert.match(valencian.groups[1].heading,/2n Batxillerat A/);
  const word=await extracurricularWord(valencian,Zip);
  const zip=await Zip.loadAsync(await word.arrayBuffer());
  const xml=await zip.file('word/document.xml').async('string');
  assert.match(xml,/Palatino Linotype/);
  assert.match(xml,/Museo &amp; teatro/);
  assert.match(xml,/Ana Vidal.*Elena Adell/);
  assert.doesNotMatch(xml,/Sara Roig|Alumno de otro curso/);
  const many={...spanish,groups:[{heading:'1.º Bachillerato',students:Array.from({length:100},(_,index)=>'Alumno '+index)}]};
  const pdf=Buffer.from(await extracurricularPdf(many).arrayBuffer()).toString('latin1');
  assert.match(pdf,/^%PDF-1\.4/);
  assert.match(pdf,/\/Count 3\b/);
  assert.match(pdf,/\(Alumno 99\)/);
  const [,start]=pdf.match(/startxref\n(\d+)/);
  assert.equal(pdf.slice(Number(start),Number(start)+4),'xref');
});
