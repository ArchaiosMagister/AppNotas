/** Copias portátiles cifradas de Tabularium. El encabezado no contiene datos del alumnado.
 * AES-256-GCM autentica también el identificador/versionado externo por AAD.
 * Nunca se descifra ni se restaura un archivo en el almacenamiento sin validar su contenido.
 */
import {seal,unlockVault,validateEnvelope} from './vault.js';
import {assertModel,migrateNotebook,SCHEMA_VERSION} from './model.js';
export const PORTABLE_TYPE='TabulariumCuaderno';
export const PORTABLE_VERSION=1;
export const MAX_CUADERNO_BYTES=25_000_000;
export const MAX_ANCESTORS=4096;
const AAD='TabulariumCuaderno/v1';
const iso=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(s)&&!Number.isNaN(Date.parse(s));
function requireId(doc){
  if(typeof doc.id!=='string'||doc.id.length<1||doc.id.length>128||!iso(doc.createdAt))throw new Error('El cuaderno no contiene un identificador o fecha de creación válidos.');
}
export function validateBookMetadata(doc){
  requireId(doc);
  const p=doc._portability;
  if(!p||p.version!==1||p.bookId!==doc.id||p.createdAt!==doc.createdAt||
    !Number.isSafeInteger(p.revision)||p.revision<0||typeof p.head!=='string'||
    !/^[0-9a-f-]{36}$/i.test(p.head)||!Array.isArray(p.ancestors)||
    p.ancestors.length>MAX_ANCESTORS||p.ancestors.some(x=>typeof x!=='string'||!/^[0-9a-f-]{36}$/i.test(x))||
    new Set(p.ancestors).size!==p.ancestors.length||p.ancestors.includes(p.head)||
    p.ancestors.length>p.revision)
    throw new Error('Historial de versiones del cuaderno malformado. No se ha restaurado nada.');
  return p;
}
/** Al abrir una copia histórica .cdoc, se inicia una línea de seguimiento nueva.
 * Por ello, dos exportaciones anteriores a este cambio NO pueden ordenarse con certeza.
 */
export function ensureBookMetadata(doc){
  requireId(doc);
  if(doc._portability){validateBookMetadata(doc);return false;}
  doc._portability={version:1,bookId:doc.id,createdAt:doc.createdAt,revision:0,head:crypto.randomUUID(),ancestors:[]};
  return true;
}
export function markBookChange(next,previous){
  const p=validateBookMetadata(previous);
  const ancestors=[...p.ancestors,p.head].slice(-MAX_ANCESTORS);
  next._portability={...p,head:crypto.randomUUID(),revision:p.revision+1,ancestors};
  validateBookMetadata(next);
}
/** `older` significa que la copia que se quiere importar antecede al contenido local. */
export function compareBookVersions(local,incoming){
  if(!local)return 'empty';
  if(local.id!==incoming.id)return 'different';
  if(!local._portability||!incoming._portability)return 'unknown';
  const a=validateBookMetadata(local),b=validateBookMetadata(incoming);
  if(a.head===b.head)return 'same';
  if(a.ancestors.includes(b.head))return 'older';
  if(b.ancestors.includes(a.head))return 'newer';
  return 'divergent';
}
export function bookStatus(doc,receipt){
  if(!doc)return 'none';
  const p=validateBookMetadata(doc);
  if(receipt?.version===1&&receipt.bookId===p.bookId&&receipt.head===p.head&&iso(receipt.exportedAt))return 'exported';
  return receipt?.bookId===p.bookId?'modified':'unverified';
}
export async function createPortableCopy(doc,key,salt,date=new Date()){
  assertModel(doc);validateBookMetadata(doc);
  if(!key||!(salt instanceof Uint8Array))throw new Error('Desbloquea el cuaderno para crear una copia.');
  const exportedAt=date.toISOString();
  const payload={type:PORTABLE_TYPE,version:PORTABLE_VERSION,exportedAt,modelVersion:SCHEMA_VERSION,notebook:doc};
  const vault=await seal(payload,key,salt,undefined,AAD);
  const file={type:PORTABLE_TYPE,version:PORTABLE_VERSION,vault};
  if(JSON.stringify(file).length>MAX_CUADERNO_BYTES)throw new Error('El cuaderno supera el tamaño máximo de copia (25 MB).');
  return {file,exportedAt,head:doc._portability.head,bookId:doc.id};
}
export async function decodeBackupContent(raw,password){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Archivo de cuaderno no válido.');
  let unlocked,source,exportedAt=null;
  if(raw.type===PORTABLE_TYPE){
    if(raw.version!==PORTABLE_VERSION)throw new Error('Versión del archivo .cuaderno incompatible. No se han modificado datos.');
    if(!raw.vault||typeof raw.vault!=='object'||Array.isArray(raw.vault))throw new Error('Archivo de cuaderno incompleto.');
    validateEnvelope(raw.vault);
    unlocked=await unlockVault(password,raw.vault,AAD);
    const payload=unlocked.doc;
    if(payload?.type!==PORTABLE_TYPE||payload.version!==PORTABLE_VERSION||!iso(payload.exportedAt)||
      payload.modelVersion!==payload.notebook?.schemaVersion)
      throw new Error('Cabecera autenticada o versión del cuaderno incompatible.');
    if(!payload.notebook?._portability)throw new Error('El archivo no incluye historial de versiones válido.');
    validateBookMetadata(payload.notebook);
    source=payload.notebook;exportedAt=payload.exportedAt;
  }else if(raw.format==='CuadernoDocenteEncrypted'){
    validateEnvelope(raw);unlocked=await unlockVault(password,raw);source=unlocked.doc;
  }else{
    throw new Error('Formato de archivo no compatible: usa .cuaderno o una copia histórica .cdoc.');
  }
  const upgraded=migrateNotebook(source);
  assertModel(upgraded.doc);
  if(upgraded.doc._portability)validateBookMetadata(upgraded.doc);
  return {doc:upgraded.doc,key:unlocked.key,salt:unlocked.salt,exportedAt,
    upgraded:upgraded.migrated,legacy:!exportedAt};
}
export async function readBackupFile(file,password){
  if(!file||!Number.isFinite(file.size)||file.size<=0||file.size>MAX_CUADERNO_BYTES)
    throw new Error('Archivo vacío o superior al máximo de 25 MB.');
  let parsed;
  try{parsed=JSON.parse(await file.text());}catch{throw new Error('Archivo dañado, incompleto o JSON inválido.');}
  return decodeBackupContent(parsed,password);
}
export function backupSummary(doc,exportedAt){
  return {bookId:doc.id,createdAt:doc.createdAt,exportedAt,modelVersion:doc.schemaVersion,
    courses:doc.groups.map(g=>({name:g.name,subject:g.subject,course:g.course})),
    students:doc.students.length,grades:doc.grades.length,
    rubrics:doc.rubrics.length,assessments:doc.assessments.length};
}
export function portableFilename(date=new Date()){
  const n=x=>String(x).padStart(2,'0');
  return `Tabularium_${date.getFullYear()}-${n(date.getMonth()+1)}-${n(date.getDate())}_${n(date.getHours())}${n(date.getMinutes())}.cuaderno`;
}
