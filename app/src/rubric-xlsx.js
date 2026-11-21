/** Importación XLSX local: no se envían archivos a terceros ni se leen alumnos. */
import {parseRubricImport} from './rubric-import.js';
import {validateCriteria,validateRubricInputPrecision} from './model.js';

const LIMIT_BYTES=3_000_000;
// El XLSX es un ZIP: 3 MB comprimidos pueden contener cientos de MB de XML.
// Rechazar entradas sobredimensionadas ANTES de descomprimirlas.
const MAX_SHEET_XML=5_000_000;
const MAX_SHARED_XML=3_000_000;
async function boundedXml(entry,max){
  const uncompressed=entry?._data?.uncompressedSize;
  if(Number.isFinite(uncompressed)&&uncompressed>max)throw new Error('El contenido descomprimido del Excel es demasiado grande.');
  const xml=await entry.async('string');
  if(xml.length>max)throw new Error('El contenido XML del Excel supera el límite permitido.');
  return xml;
}
const norm=x=>String(x??'').trim().toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const num=x=>Number(String(x??'').trim().replace(',','.'));
const colIndex=ref=>[...ref.replace(/\d/g,'').toUpperCase()].reduce((n,c)=>26*n+c.charCodeAt(0)-64,0)-1;
function xmlDocument(xml,Parser){
  if(/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml))throw new Error('El Excel contiene definiciones XML no permitidas.');
  const dom=new Parser().parseFromString(xml,'application/xml');
  if(dom.getElementsByTagName('parsererror').length)throw new Error('El Excel contiene XML inválido.');
  return dom;
}
function cellText(cell,shared){
  const kind=cell.getAttribute('t');
  if(kind==='inlineStr')return [...cell.getElementsByTagName('t')].map(t=>t.textContent??'').join('');
  const raw=cell.getElementsByTagName('v')[0]?.textContent??'';
  return kind==='s'?shared[Number(raw)]??'':raw;
}
function readRows(xml,shared,Parser){
  const doc=xmlDocument(xml,Parser), rows=[];
  for(const row of doc.getElementsByTagName('row')){
    const cols=[];
    for(const cell of row.getElementsByTagName('c')){
      const index=colIndex(cell.getAttribute('r')||'');
      if(index>=0&&index<60)cols[index]=cellText(cell,shared);
    }
    if(cols.some(x=>String(x??'').trim()))rows.push(cols);
    if(rows.length>500)throw new Error('Demasiadas filas en el Excel.');
  }
  return rows;
}
function rowsToRubric(rows,filename){
  const heading=rows[0]||[];
  const first=heading.map(norm);
  const criterionIndex=first.findIndex(x=>['criterio','indicador','nombre'].includes(x));
  const maximumIndex=first.findIndex(x=>['maximo','max','puntuacion maxima','maxscore'].includes(x));
  if(criterionIndex>=0&&maximumIndex>=0){
    const weightIndex=first.findIndex(x=>['peso','ponderacion','weight'].includes(x));
    const dataRows=rows.slice(1);
    if(dataRows.some(r=>!String(r[criterionIndex]??'').trim()&&
      (String(r[maximumIndex]??'').trim()||(weightIndex>=0&&String(r[weightIndex]??'').trim()))))
      throw new Error('Hay puntuaciones de rúbrica sin nombre de criterio. No se han descartado silenciosamente.');
    const values=dataRows.filter(r=>String(r[criterionIndex]??'').trim()).map(r=>({
      name:String(r[criterionIndex]).trim(),maxScore:num(r[maximumIndex]),weight:weightIndex>=0&&String(r[weightIndex]??'').trim()?num(r[weightIndex]):1
    }));
    validateCriteria(values.map((criterion,i)=>({...criterion,id:String(i)})));
    validateRubricInputPrecision(values);
    return {name:filename.replace(/\.[^.]+$/,'').replace(/[_-]+/g,' '),criteria:values};
  }
  // Formato por niveles (como «Rúbrica - Actitud 2bach.xlsx»):
  // A: criterio y peso; B-D: descripciones con puntuaciones en la cabecera.
  const levelHeaders=heading.slice(1).map((title,i)=>{
    const match=String(title??'').trim().match(/^([\s\S]*?)\s*(?:\n|\s)\s*(\d+(?:[.,]\d+)?)\s*$/);
    return match?{index:i+1,label:match[1].trim(),score:num(match[2])}:null;
  }).filter(Boolean);
  if(levelHeaders.length<2||levelHeaders.some(l=>!l.label))throw new Error('Excel no reconocido: se esperan columnas «criterio, máximo, peso» o niveles (Bien 2, Regular 1, Mal 0).');
  const maxScore=Math.max(...levelHeaders.map(l=>l.score));
  const rubricRows=rows.slice(1);
  if(rubricRows.some(r=>!String(r[0]??'').trim()&&
    levelHeaders.some(l=>String(r[l.index]??'').trim())))
    throw new Error('Hay descriptores Excel sin nombre de criterio. No se han omitido silenciosamente.');
  const criteria=rubricRows.filter(r=>String(r[0]??'').trim()).map(r=>{
    const label=String(r[0]).trim();
    const weightMatch=label.match(/(\d+(?:[.,]\d+)?)\s*%/);
    const name=label.split(/\r?\n/)[0].trim().replace(/^\d+\.\s*/,'');
    const levels=levelHeaders.map(l=>({score:l.score,label:l.label,description:String(r[l.index]??'').trim()}))
      .filter(l=>l.description&&l.description!=='-'&&l.description!=='–');
    return {name,maxScore,weight:weightMatch?num(weightMatch[1]):1,levels};
  });
  if(!criteria.length||criteria.length>40||criteria.some(c=>!c.name||c.name.length>150||c.weight<=0||!Number.isFinite(c.weight)||!Number.isFinite(c.maxScore)||c.maxScore<=0||!c.levels.length||!c.levels.some(l=>l.score===c.maxScore)))throw new Error('Criterios o niveles de Excel inválidos.');
  validateRubricInputPrecision(criteria);
  return {name:filename.replace(/\.[^.]+$/,'').replace(/[_-]+/g,' '),criteria};
}
export async function parseRubricXlsx(arrayBuffer,filename='rubrica.xlsx',zipLibrary=globalThis.JSZip,Parser=globalThis.DOMParser){
  if(!zipLibrary||!Parser)throw new Error('El lector Excel no está disponible en este navegador.');
  if(!(arrayBuffer instanceof ArrayBuffer)||arrayBuffer.byteLength>LIMIT_BYTES)throw new Error('El Excel supera el tamaño máximo de 3 MB.');
  let zip;try{zip=await zipLibrary.loadAsync(arrayBuffer);}catch{throw new Error('Archivo XLSX dañado o no reconocido.');}
  if(Object.keys(zip.files).length>1000)throw new Error('El Excel contiene demasiados archivos internos.');
  const sheets=Object.keys(zip.files).filter(name=>/^xl\/worksheets\/sheet\d+\.xml$/i.test(name)).sort((a,b)=>Number(a.match(/\d+/g).at(-1))-Number(b.match(/\d+/g).at(-1)));
  if(!sheets.length)throw new Error('No se ha encontrado ninguna hoja Excel.');
  const sharedFile=zip.file('xl/sharedStrings.xml');
  const shared=sharedFile ? [...xmlDocument(await boundedXml(sharedFile,MAX_SHARED_XML),Parser).getElementsByTagName('si')].map(si=>[...si.getElementsByTagName('t')].map(t=>t.textContent??'').join('')) : [];
  // Algunos Excel traen primero una portada, instrucciones o una hoja vacía.
  // Buscar la primera hoja con estructura reconocida sin aceptar rúbricas
  // mal formadas ni ocultar problemas de seguridad/descompresión.
  let rejected=0;
  for(const sheet of sheets){
    const rows=readRows(await boundedXml(zip.file(sheet),MAX_SHEET_XML),shared,Parser);
    if(!rows.length)continue;
    try{
      const result=rowsToRubric(rows,filename);
      if(result.criteria.length)return result;
    }catch(error){
      if(!String(error.message).startsWith('Excel no reconocido:'))throw error;
      rejected++;
    }
  }
  throw new Error(rejected?'No se ha encontrado una hoja con el formato de rúbrica requerido.':'No se han encontrado criterios de rúbrica.');
}
export async function parseRubricFile(file){
  if(!file||file.size>LIMIT_BYTES)throw new Error('Archivo de rúbrica demasiado grande.');
  if(/\.xlsx$/i.test(file.name))return parseRubricXlsx(await file.arrayBuffer(),file.name);
  if(/\.(csv|json)$/i.test(file.name))return parseRubricImport(await file.text(),file.name);
  throw new Error('Selecciona un archivo Excel .xlsx, CSV o JSON.');
}
