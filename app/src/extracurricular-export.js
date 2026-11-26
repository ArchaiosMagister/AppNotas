import {COURSE_SUBJECTS,sortStudents} from './model.js';
import {extracurricularRoster,extracurricularAnswer} from './extracurricular.js';
import {canEncodePdfText,pdfDocumentBytes,pdfLiteral,wrapPdfText,wordDocumentBlob,wordXml} from './timetable-export.js';

const compare=new Intl.Collator('es',{numeric:true,sensitivity:'base'}).compare;
const levels=Object.keys(COURSE_SUBJECTS);
const levelOrder=level=>levels.includes(level)?levels.indexOf(level):levels.length;
export const compareExtracurricularCourses=([yearA,levelA],[yearB,levelB])=>
  compare(yearA,yearB)||levelOrder(levelA)-levelOrder(levelB);
export const extracurricularLevelLabel=level=>COURSE_SUBJECTS[level]?.label||'Sin clasificar';
export const extracurricularGroupLabel=({student,group})=>student.originGroup||group.name;

function valencianLabel(label){
  return label.replace(/bachillerato|bach(?=$|[^a-zà-ÿ])/gi,word=>{
    const translated=word.length===4?'bat':'batxillerat';
    if(word===word.toUpperCase())return translated.toUpperCase();
    if(word[0]===word[0].toUpperCase())return translated[0].toUpperCase()+translated.slice(1);
    return translated;
  }).replace(/([124])\.?º/g,(_,number)=>({1:'1r',2:'2n',4:'4t'})[number])
    .replace(/^Sin clasificar$/,'Sense classificar');
}

export function sortedExtracurricularRoster(doc,courses){
  const rows=extracurricularRoster(doc,courses);
  const byStudent=new Map(rows.map(row=>[row.student.id,row]));
  return sortStudents(rows.map(row=>row.student)).map(student=>byStudent.get(student.id)).sort((a,b)=>
    compareExtracurricularCourses([a.group.course,a.group.level],[b.group.course,b.group.level])||
    compare(extracurricularGroupLabel(a),extracurricularGroupLabel(b)));
}

export function extracurricularReport(doc,activity,language='es'){
  const valencian=language==='val';
  const date=new Intl.DateTimeFormat(valencian?'ca-ES-valencia':'es-ES',{
    dateStyle:'full',timeZone:'UTC'
  }).format(new Date(activity.date+'T12:00:00Z'));
  const title=(valencian?"Alumnat que participa en l’activitat extraescolar ":
    'Alumnado que participa en la actividad extraescolar ')+activity.name+(valencian?' del dia ':' del día ')+date+':';
  const groups=new Map();
  for(const row of sortedExtracurricularRoster(doc,activity.courses)){
    if(extracurricularAnswer(activity,row.ids)!==true)continue;
    const {student,group}=row;
    const level=extracurricularLevelLabel(group.level),label=extracurricularGroupLabel(row);
    const key=JSON.stringify([group.course,group.level,label]);
    if(!groups.has(key)){
      const translated=valencian?[level,label].map(valencianLabel):[level,label];
      groups.set(key,{heading:[...new Set(translated),group.course].filter(Boolean).join(' · '),students:[]});
    }
    groups.get(key).students.push(student.name);
  }
  return {title,groups:[...groups.values()],empty:valencian?'Cap alumne amb participació confirmada.':'Ningún alumno con participación confirmada.'};
}

export function extracurricularWord(report,Zip){
  const paragraph=(value,size,bold=false)=>'<w:p><w:pPr>'+
    (bold?'<w:keepNext/>':'')+'<w:spacing w:after="100"/></w:pPr><w:r><w:rPr>'+
    '<w:rFonts w:ascii="Palatino Linotype" w:hAnsi="Palatino Linotype" w:cs="Palatino Linotype" w:eastAsia="Palatino Linotype"/>'+
    (bold?'<w:b/>':'')+'<w:sz w:val="'+size+'"/></w:rPr><w:t xml:space="preserve">'+
    wordXml(value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g,''))+'</w:t></w:r></w:p>';
  const body=paragraph(report.title,28,true)+(report.groups.length?
    report.groups.map(group=>paragraph(group.heading,24,true)+group.students.map(name=>paragraph(name,22)).join('')).join(''):
    paragraph(report.empty,22));
  return wordDocumentBlob('<?xml version="1.0" encoding="UTF-8"?>'+
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+
    body+'<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080"/></w:sectPr>'+
    '</w:body></w:document>',Zip);
}

// Mantiene legibles las grafías que las fuentes PDF estándar no pueden codificar.
function pdfUnicodeLine(line,size,bold,x,y){
  const canvas=document.createElement('canvas'),scale=3,width=480,height=size*2;
  canvas.width=width*scale;
  canvas.height=height*scale;
  const context=canvas.getContext('2d');
  context.scale(scale,scale);
  context.fillStyle='white';
  context.fillRect(0,0,width,height);
  context.fillStyle='black';
  context.font=`${bold?'bold ':''}${size}px "Palatino Linotype", "Book Antiqua", Georgia, serif`;
  context.fillText(line,0,size,width);
  const data=atob(canvas.toDataURL('image/jpeg',0.96).split(',')[1]);
  const hex=Array.from(data,byte=>byte.charCodeAt(0).toString(16).padStart(2,'0')).join('');
  return `q ${width} 0 0 ${height} ${x} ${y-size} cm\nBI /W ${canvas.width} /H ${canvas.height} /BPC 8 /CS /RGB /F [/AHx /DCT] ID\n${hex}>\nEI\nQ`;
}

export function extracurricularPdf(report){
  const pages=[[]];
  let y=790;
  const newPage=()=>{pages.push([]);y=790;};
  const write=(lines,size,bold,x=48)=>{
    for(const line of lines){
      if(y<48)newPage();
      const text=line.normalize('NFC');
      pages.at(-1).push(canEncodePdfText(text)?
        'BT /F'+(bold?2:1)+' '+size+' Tf '+x+' '+y+' Td ('+pdfLiteral(text)+') Tj ET':
        pdfUnicodeLine(text,size,bold,x,y));
      y-=size+5;
    }
  };
  write(wrapPdfText(report.title,40),14,true);
  if(!report.groups.length)write(wrapPdfText(report.empty,64),11,false);
  for(const group of report.groups){
    const heading=wrapPdfText(group.heading,46),names=group.students.map(name=>wrapPdfText(name,49));
    if(y-12-heading.length*17-names[0].length*16<48)newPage();
    else y-=12;
    write(heading,12,true);
    for(const name of names)write(name,11,false,60);
  }
  return new Blob([pdfDocumentBytes(pages,595.28,841.89,'Times-Roman','Times-Bold')],{type:'application/pdf'});
}
