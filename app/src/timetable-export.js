/** Exportación local del horario semanal: no consulta la red ni lee calificaciones. */
import {scheduleBands,slotsForMode,activeScheduleMode,SLOT_TYPES} from './planner.js';

const dayNames=['Lunes','Martes','Miércoles','Jueves','Viernes'];
const validColor=c=>typeof c==='string'&&/^#[0-9A-Fa-f]{6}$/.test(c);
const xml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'' :'&apos;'}[c]));
const palette=(doc,slot)=>{
 const group=doc.groups.find(g=>g.id===slot.groupId);
 const subjectColor=group&&doc.settings?.subjectAccents?.[group.level+':'+group.subject];
 return validColor(subjectColor)?subjectColor:validColor(slot.color)?slot.color:'#69788B';
};
const slotLabel=(doc,s)=>{
 const g=doc.groups.find(x=>x.id===s.groupId);
 return s.type==='class'?(g?[g.subject,g.name].filter(Boolean).join(' · '):s.label):(s.label||SLOT_TYPES[s.type]);
};
export function timetableRows(doc,y){
 const slots=slotsForMode(y);
 return scheduleBands(y).map(b=>({
  band:{...b},
  cells:dayNames.map((day,i)=>({
   day,slots:slots.filter(s=>s.day===i&&(s.bandId===b.id||(!s.bandId&&s.start===b.start&&s.end===b.end)))
    .map(s=>({label:slotLabel(doc,s),room:s.room||'',color:palette(doc,s),type:s.type}))
  }))
 }));
}
export const timetableFileBase=y=>
 'AppNotas-horario-'+String(y.name||'curso').replace(/[^a-zA-Z0-9_-]/g,'-')+
 (activeScheduleMode(y)==='summer'?'-verano':'-ordinario');

function wordRun(value,size=18,bold=false){
 return '<w:r><w:rPr>'+(bold?'<w:b/>':'')+'<w:sz w:val="'+size+'"/></w:rPr><w:t xml:space="preserve">'+xml(value)+'</w:t></w:r>';
}
function wordParagraph(value,size=18,bold=false){
 return '<w:p><w:pPr><w:spacing w:after="40"/></w:pPr>'+wordRun(value,size,bold)+'</w:p>';
}
function tint(hex){const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
 return [r,g,b].map(v=>Math.round(240+v*15/255).toString(16).padStart(2,'0')).join('').toUpperCase();
}
function wordCell(lines,width,shade='FFFFFF'){
 return '<w:tc><w:tcPr><w:tcW w:w="'+width+'" w:type="dxa"/><w:shd w:fill="'+shade+'"/><w:vAlign w:val="center"/></w:tcPr>'+
 (lines.length?lines.map((x,i)=>wordParagraph(x,i===0?18:16,i===0)).join(''):wordParagraph(' ',16))+'</w:tc>';
}
export function timetableDocxXml(doc,y){
 const rows=timetableRows(doc,y),mode=activeScheduleMode(y)==='summer'?'verano':'ordinario';
 const head='<w:tr>'+wordCell(['Franja'],1850,'DDE5EF')+dayNames.map(d=>wordCell([d],2700,'DDE5EF')).join('')+'</w:tr>';
 const content=rows.map(row=>{
  const title=[row.band.label,row.band.start+'–'+row.band.end];
  return '<w:tr>'+wordCell(title,1850,row.band.kind==='break'?'EFF1F4':'F7F9FC')+
   row.cells.map(cell=>wordCell(cell.slots.flatMap(s=>[s.label,...(s.room?['Aula: '+s.room]:[])]),
    2700,cell.slots[0]?tint(cell.slots[0].color):(row.band.kind==='break'?'F4F5F7':'FFFFFF'))).join('')+'</w:tr>';
 }).join('');
 const body=wordParagraph('Horario semanal · '+mode,30,true)+wordParagraph('Curso '+y.name+' · lunes a viernes',18)+
  '<w:tbl><w:tblPr><w:tblW w:w="15350" w:type="dxa"/><w:tblBorders>'+
  ['top','left','bottom','right','insideH','insideV'].map(side=>'<w:'+side+' w:val="single" w:sz="4" w:color="CDD4DF"/>').join('')+
  '</w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="1850"/>'+dayNames.map(()=>'<w:gridCol w:w="2700"/>').join('')+
  '</w:tblGrid>'+head+content+'</w:tbl>'+wordParagraph('Documento generado localmente por AppNotas. Archivo sin cifrar: guárdalo en un dispositivo autorizado.',14)+
  '<w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="720" w:right="650" w:bottom="720" w:left="650" w:header="350" w:footer="350" w:gutter="0"/></w:sectPr>';
 return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
 '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+body+'</w:body></w:document>';
}
export async function timetableWordBlob(doc,y,Zip){
 if(typeof Zip!=='function')throw new Error('No está disponible el exportador Word local.');
 const zip=new Zip();
 zip.file('[Content_Types].xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
 zip.file('_rels/.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
 zip.file('word/document.xml',timetableDocxXml(doc,y));
 return zip.generateAsync({type:'blob',compression:'DEFLATE'});
}
/** PDF A4 apaisado, elaborado en el navegador sin bibliotecas ni llamadas externas. */
const WIN1252=Object.freeze({'€':128,'‚':130,'ƒ':131,'„':132,'…':133,'†':134,'‡':135,'ˆ':136,'‰':137,
 'Š':138,'‹':139,'Œ':140,'Ž':142,'‘':145,'’':146,'“':147,'”':148,'•':149,'–':150,'—':151,
 '˜':152,'™':153,'š':154,'›':155,'œ':156,'ž':158,'Ÿ':159});
function pdfBytes(text){
 const out=[];
 for(const cp of String(text)){const n=cp.codePointAt(0);out.push(n<=255?n:(WIN1252[cp]||63));}
 return out;
}
function pdfLiteral(text){
 return Array.from(String(text),ch=>{
  const n=ch.codePointAt(0);const v=n<=255?n:(WIN1252[ch]||63);
  return v===40?'\\(':v===41?'\\)':v===92?'\\\\':v<32||v===127?' ':' '+String.fromCharCode(v);
 }).join('').replace(/ \x20/g,' ');
}
function wrap(value,max=21){
 const words=String(value).split(/\s+/),lines=[];
 let line='';
 for(const word of words){
  if(!word)continue;
  if(word.length>max){
   if(line){lines.push(line);line='';}
   for(let i=0;i<word.length;i+=max)lines.push(word.slice(i,i+max));
  }else if(!line)line=word;
  else if(line.length+1+word.length<=max)line+=' '+word;
  else{lines.push(line);line=word;}
 }
 if(line)lines.push(line);
 return lines;
}
function lightRgb(hex){
 const values=[1,3,5].map(x=>parseInt(hex.slice(x,x+2),16)/255);
 return values.map(v=>(0.90+v*0.10).toFixed(3)).join(' ');
}
export function timetablePdfBytes(doc,y){
 const rows=timetableRows(doc,y),summer=activeScheduleMode(y)==='summer';
 const commands=['0.22 0.30 0.39 rg','BT /F1 17 Tf 34 554 Td ('+pdfLiteral('Horario semanal · '+(summer?'verano':'ordinario'))+') Tj ET',
 '0.40 0.47 0.55 rg','BT /F1 10 Tf 34 536 Td ('+pdfLiteral('Curso '+y.name+' · lunes a viernes')+') Tj ET'];
 const pageW=841.89,top=514,left=28,firstWidth=105,dayWidth=136.5,rowHeight=Math.min(51,450/rows.length);
 const columns=[{label:'Franja',x:left,w:firstWidth},...dayNames.map((name,i)=>({label:name,x:left+firstWidth+i*dayWidth,w:dayWidth}))];
 function fill(x,y,w,h,color){
  commands.push(color+' rg',x.toFixed(2)+' '+y.toFixed(2)+' '+w.toFixed(2)+' '+h.toFixed(2)+' re f');
 }
 function printLine(t,x,y,size=8){
  commands.push('0.14 0.20 0.28 rg','BT /F1 '+size+' Tf 1 0 0 1 '+x.toFixed(2)+' '+y.toFixed(2)+' Tm ('+pdfLiteral(t)+') Tj ET');
 }
 fill(left,top-25,firstWidth+5*dayWidth,25,'0.84 0.89 0.94');
 columns.forEach(col=>printLine(col.label,col.x+6,top-17,10));
 rows.forEach((row,i)=>{
  const yBase=top-25-(i+1)*rowHeight;
  fill(left,yBase,firstWidth+5*dayWidth,rowHeight,i%2?'0.975 0.98 0.985':'1 1 1');
  fill(left,yBase,firstWidth,rowHeight,row.band.kind==='break'?'0.93 0.94 0.96':'0.96 0.97 0.99');
  printLine(row.band.label,left+4,yBase+rowHeight-14,8.8);
  printLine(row.band.start+'–'+row.band.end,left+4,yBase+rowHeight-28,8);
  row.cells.forEach((cell,j)=>{
   const x=left+firstWidth+j*dayWidth,slot=cell.slots[0];
   if(slot)fill(x+1,yBase+1,dayWidth-2,rowHeight-2,lightRgb(slot.color));
   const lines=cell.slots.flatMap(s=>[...wrap(s.label,24),...(s.room?wrap('Aula: '+s.room,24):[])]);
   const visible=lines.slice(0,Math.max(1,Math.floor((rowHeight-8)/10)));
   visible.forEach((line,k)=>printLine(line,x+5,yBase+rowHeight-13-k*10,7.8));
  });
  commands.push('0.77 0.81 0.86 RG 0.4 w',left+' '+yBase.toFixed(2)+' '+(firstWidth+5*dayWidth)+' 0 m 0 0 l S');
 });
 const lower=top-25-rows.length*rowHeight;
 commands.push('0.70 0.75 0.80 RG 0.5 w');
 columns.forEach(c=>commands.push(c.x.toFixed(2)+' '+lower.toFixed(2)+' m '+c.x.toFixed(2)+' '+top.toFixed(2)+' l S'));
 commands.push((left+firstWidth+5*dayWidth).toFixed(2)+' '+lower.toFixed(2)+' m '+(left+firstWidth+5*dayWidth).toFixed(2)+' '+top.toFixed(2)+' l S');
 printLine('AppNotas · Exportación local no cifrada · Conserva este archivo en una ubicación autorizada',left,22,7);
 const stream=commands.join('\n')+'\n',raw=[];let length=0,offsets=[0];
 const append=text=>{const bytes=pdfBytes(text);raw.push(...bytes);length+=bytes.length;};
 const obj=(i,body)=>{offsets[i]=length;append(i+' 0 obj\n'+body+'\nendobj\n');};
 append('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
 obj(1,'<< /Type /Catalog /Pages 2 0 R >>');
 obj(2,'<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
 obj(3,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+pageW+' 595.28] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>');
 obj(4,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
 obj(5,'<< /Length '+pdfBytes(stream).length+' >>\nstream\n'+stream+'endstream');
 const xref=length;append('xref\n0 6\n0000000000 65535 f \n');
 for(let i=1;i<=5;i++)append(String(offsets[i]).padStart(10,'0')+' 00000 n \n');
 append('trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF');
 return Uint8Array.from(raw);
}
