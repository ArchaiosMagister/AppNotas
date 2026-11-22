import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('GitHub Actions no despliega ni prepara GitHub Pages',async()=>{
  const workflow=await read('.github/workflows/pages.yml');
  for(const forbidden of [
    /uses:\s*actions\/deploy-pages@/,
    /uses:\s*actions\/upload-pages-artifact@/,
    /uses:\s*actions\/configure-pages@/,
    /^\s+pages:\s*write\s*$/m,
    /^\s+id-token:\s*write\s*$/m,
    /^\s+environment:\s*\n\s+name:\s*github-pages/m,
    /^\s+deploy:\s*$/m
  ])assert.doesNotMatch(workflow,forbidden,'No debe quedar ninguna ruta de publicación GitHub Pages');
  assert.match(workflow,/name:\s*Validar AppNotas para Cloudflare Pages/);
});

test('GitHub conserva la auditoría, pruebas, comprobación de alojamiento y fuentes verificadas',async()=>{
  const workflow=await read('.github/workflows/pages.yml');
  for(const checked of [
    'on:\n  push:\n    branches: [main]',
    'pull_request:\n    branches: [main]',
    'python3 scripts/source_manifest.py --check',
    'sha256sum --check MANIFEST_SHA256.txt',
    'node --check app.js',
    'node --test scripts/audit-v119.test.mjs',
    'working-directory: app\n        run: npm test',
    'node scripts/build-static-site.mjs',
    'node --test scripts/dedicated-hosting.test.mjs scripts/backup-origin-migration.test.mjs scripts/cloudflare-only.test.mjs',
    'uses: actions/upload-artifact@v4',
    'zip -qr _release/CuadernoDocente_v1.19_fuentes.zip app'
  ])assert(workflow.includes(checked),'Conservar: '+checked);
  assert.match(workflow,/permissions:\n  contents: read/);
});

test('Cloudflare mantiene la compilación como dist con cabeceras HTTP',async()=>{
  const [builder,hosting]=await Promise.all([read('scripts/build-static-site.mjs'),read('scripts/dedicated-hosting.test.mjs')]);
  assert(builder.includes('dist'));
  assert(hosting.includes("const cf=await read('dist/_headers')"));
  assert(hosting.includes("const manifest=JSON.parse(await read('dist/manifest.webmanifest'))"));
});

test('la documentación dirige al dominio oficial y explica el almacenamiento aislado',async()=>{
  const [readme,guide]=await Promise.all([read('README.md'),read('docs/ALOJAMIENTO_AISLADO_Y_MIGRACION.md')]);
  for(const text of [readme,guide]){
    assert(text.includes('https://appnotas-docente.pages.dev/'));
    assert(text.includes('Unpublish site'));
    assert(text.includes('IndexedDB'));
    assert(text.includes('GitHub Pages'));
  }
  assert(readme.includes('**No se publica nada en GitHub Pages.**'));
  assert(guide.includes('El repositorio no se elimina.'));
});

test('esta transición no cambia el cuaderno ni requiere credenciales de Cloudflare en Actions',async()=>{
  const workflow=await read('.github/workflows/pages.yml');
  assert(!/secrets\.(CF_|CLOUDFLARE_)/.test(workflow),'Cloudflare despliega mediante su integración Git');
  assert(!/gh api.*(-X|--method).*DELETE|api\.github\.com.*pages.*DELETE/i.test(workflow));
  assert(!workflow.includes('rm -rf app/'),'No borrar las fuentes');
});
