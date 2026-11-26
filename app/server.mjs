import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('.',import.meta.url)));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.pdf':'application/pdf','.png':'image/png'};
const port=Number(process.env.PORT||4173);
const publicFiles=new Set(['/index.html','/app.js','/styles.css','/manifest.webmanifest','/sw.js','/icons/icon.svg','/icons/icon-192.png','/icons/icon-512.png','/icons/icon-maskable-512.png','/icons/apple-touch-icon.png','/src/pwa-controls.js','/src/model.js','/src/cuaderno.js','/src/planner.js','/src/planner-ui.js','/src/timetable-export.js','/src/student-link-ui.js','/src/patio-rotation.js','/src/notebook-evaluation-notice.js','/src/extracurricular.js','/src/extracurricular-ui.js','/src/extracurricular-export.js','/src/evaluation-workspace.js','/src/evaluation-ui.js','/src/evaluation-session-presentation.js','/src/evaluation-period-board.js','/src/evaluation-groups.js','/src/official-competencies.js','/src/attitude-template.js','/src/rubric-xlsx.js','/vendor/jszip.min.js','/src/calculations.js','/src/statistics.js','/src/csv.js','/src/rubric-import.js','/src/rubric-ui.js','/src/history.js','/src/storage.js','/src/vault.js','/src/diagnostics.js','/src/curriculum-data.js','/data/curriculos/gr1y2-nuevo.pdf','/data/curriculos/lat1y2-nuevo.pdf','/data/curriculos/lat4.pdf','/data/curriculos/lat2-2022.pdf']);
const server=createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const path=pathname==='/'?'/index.html':pathname;
    if(!publicFiles.has(path))throw new Error('Forbidden');
    const file=resolve(root,'.'+path);
    if(!file.startsWith(root+sep))throw new Error('Forbidden');
    const info=await stat(file);if(!info.isFile())throw new Error('Not file');
    const contents=await readFile(file);
    res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"});
    res.end(contents);
  }catch{res.writeHead(404);res.end('Not found');}
});
server.listen(port,'127.0.0.1',()=>console.log(`CuadernoDocente en http://127.0.0.1:${port}`));
