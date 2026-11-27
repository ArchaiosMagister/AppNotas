import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const cssPath=fileURLToPath(new URL('./redesign-preview.css',import.meta.url));
export async function applyRedesignPreview(output){
  const edit=async(rel,fn)=>{const file=path.join(output,rel);const old=await readFile(file,'utf8');const next=fn(old);if(next===old)throw new Error('Preview sin cambio: '+rel);await writeFile(file,next,'utf8');};
  const one=(s,a,b)=>{if(s.split(a).length!==2)throw new Error('Ancla no inequívoca: '+a.slice(0,80));return s.replace(a,()=>b);};
  await edit('src/storage.js',s=>one(s,"const DB_NAME='cuaderno-docente-v1';","const DB_NAME='cuaderno-docente-redesign-preview-v1';"));
  await edit('src/dropbox-config.js',s=>s.replace(/export const dropboxConfigured=origin=>[\s\S]*?;/,"export const dropboxConfigured=()=>false;"));
  await edit('sw.js',s=>s.replaceAll('cuaderno-docente-static-','cuaderno-redesign-preview-static-').replace(/(const CACHE='[^']+)';/,"$1-r3';"));
  await edit('manifest.webmanifest',s=>{const m=JSON.parse(s);m.name='CuadernoDocente · PRUEBAS';m.short_name='Notas PRUEBAS';return JSON.stringify(m,null,2);});
  await edit('index.html',s=>one(one(s,'<body>','<body><aside class="redesign-preview-banner" role="note">VERSIÓN DE PRUEBAS · Solo alumnado ficticio · No importes el cuaderno real</aside>'),'CuadernoDocente · v1.0 · Tabularium','CuadernoDocente · PRUEBAS de diseño').replace('content="Cuaderno"','content="Notas PRUEBAS"'));
  await edit('app.js',s=>{
    s=one(s,'async function init(){',`async function init(){
  if(!(/^(?:localhost|127\\.0\\.0\\.1)$/.test(location.hostname)||/^[a-z0-9-]+\\.appnotas-docente\\.pages\\.dev$/.test(location.hostname)&&location.hostname!=='feature-dropbox-e2ee-sync.appnotas-docente.pages.dev')){root.textContent='Esta copia experimental solo se abre en un alojamiento de pruebas aislado.';return;}
  document.documentElement.dataset.redesignPreview='yes';
  try{document.documentElement.dataset.previewDensity=localStorage.getItem('cuaderno-redesign-preview-density')||'compact';}catch{document.documentElement.dataset.previewDensity='compact';}
`);
    s=one(s,"const creationMode=e.submitter?.dataset.createMode==='demo'?'demo':'empty';","const creationMode='demo';");
    s=one(s,'function applyTheme(){',`function applyTheme(){
  document.documentElement.dataset.previewSubject=STATE.subject||'';
`);
    s=one(s,'<span>Zoom</span><button class="btn small" type="button" id="notebook-zoom-out"',`<label class="preview-density">Densidad <select id="preview-density"><option value="compact">Compacta</option><option value="normal">Normal</option><option value="wide">Amplia</option></select></label><span>Zoom</span><button class="btn small" type="button" id="notebook-zoom-out"`);
    s=one(s,'function bindNotebook(){',`function bindNotebook(){
  const density=root.querySelector('#preview-density');
  if(density){density.value=document.documentElement.dataset.previewDensity||'compact';density.addEventListener('change',()=>{document.documentElement.dataset.previewDensity=density.value;try{localStorage.setItem('cuaderno-redesign-preview-density',density.value);}catch{}bindGradeTableHeaders();});}
  const table=root.querySelector('.grade-table');
  if(table){
    let last=null;for(const th of table.querySelectorAll('thead th[data-column-category]')){const cat=th.dataset.columnCategory;if(cat!==last)th.classList.add('preview-category-start');last=cat;}
    const clear=()=>table.querySelectorAll('.preview-active-column').forEach(el=>el.classList.remove('preview-active-column'));
    table.addEventListener('focusin',e=>{const cell=e.target.closest('td,th');if(!cell)return;clear();for(const row of table.rows){if(row.cells[cell.cellIndex]&&row.cells[cell.cellIndex].colSpan===1)row.cells[cell.cellIndex].classList.add('preview-active-column');}});
    table.addEventListener('focusout',e=>{if(!table.contains(e.relatedTarget))clear();});
  }
`);
    s=one(s,'    <div class="student-period-grades">',`    <div class="preview-evolution"><h3>Evolución por evaluaciones</h3><div class="preview-evolution-grid">\${periods.map(term=>\x60<div class="preview-evolution-item"><small>\${esc(term.name)}</small>\${gradeChip(overallGrade(STATE.doc,student.id,groupId,term.id))}</div>\x60).join('')}</div></div>
    <div class="student-period-grades">`);
    // All browser preferences are scoped to the experimental copy.
    s=s.replace(/(['"])(cuaderno-docente-(?:theme|nav-collapsed|student-sort(?:-before-group)?|student-activity-orders)|appnotas-notebook-zoom)\1/g,(_,q,k)=>q+'redesign-preview-'+k+q);
    return s;
  });
  const css=await readFile(cssPath,'utf8');
  await edit('styles.css',s=>s+'\n'+css);
}