"""Prueba de interfaz Chromium en origen about:blank con cifrado/IndexedDB simulados.
La administración del entorno bloquea navegación HTTP y file://, por lo que NO
verifica las APIs reales de almacenamiento ni de descarga en Safari o Chromium.
La criptografía sí se contrasta en tests Node WebCrypto reales.
"""
from pathlib import Path
import re,json
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
html=(root/'CuadernoDocente_sin_instalar.html').read_text()
scripts=re.findall(r'<script>([\s\S]*?)</script>',html)
assert len(scripts)==2
code=scripts[1]
assert code.count('init();')==1
code=code.replace('async function persist(snapshot) {','''async function persist(snapshot) {
  STATE.envelope={format:'simulado',data:'siguiente-'+(Date.now())};globalThis.__envelope=STATE.envelope;
  STATE.saveError=null;STATE.failedEnvelope=null;return;
''')
code=code.replace('init();', '''
// SOLO QA: reemplazos visibles para no afirmar que se prueban APIs reales.
const cs=__require('src/cuaderno.js');
cs.createPortableCopy=async doc=>({file:{type:'TabulariumCuaderno',version:1,vault:{data:'SIMULADO'}},exportedAt:new Date().toISOString(),bookId:doc.id,head:doc._portability.head});
cs.readBackupFile=async()=>({doc:structuredClone(globalThis.__candidate),key:{},salt:new Uint8Array(16),exportedAt:new Date().toISOString()});
const storage=__require('src/storage.js');
storage.readEnvelope=async()=>globalThis.__envelope;
storage.recordExportReceipt=async()=>{};
storage.replaceEnvelopeWithRecovery=async(db,replacement)=>{const previous=globalThis.__envelope;globalThis.__envelope=replacement;return {version:1,createdAt:new Date().toISOString(),envelope:previous};};
const vault=__require('src/vault.js');
vault.seal=async()=>({format:'simulado',data:'restaurado'});
STATE.db={};STATE.key={};STATE.salt=new Uint8Array(16);STATE.envelope={format:'simulado',data:'primero'};
globalThis.__envelope=STATE.envelope;
STATE.doc=(0,model_js_1.initialNotebook)();(0,cuaderno_js_1.ensureBookMetadata)(STATE.doc);
globalThis.__smokeDoc=()=>structuredClone(STATE.doc);globalThis.__smokeState=STATE;
chooseInitial();render();
''')
html=re.sub(r'<meta http-equiv="Content-Security-Policy"[^>]*>','',html)
html=re.sub(r'<script>[\s\S]*?</script>','',html)
results=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 for name,width,height in [('escritorio',1366,900),('iPad emulado',820,1100),('iPhone emulado',390,844)]:
  page=browser.new_page(viewport={'width':width,'height':height},has_touch=width<1024)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('about:blank');page.set_content(html,wait_until='domcontentloaded')
  page.evaluate("""() => {let n=1;Object.defineProperty(window.crypto,'randomUUID',{value:()=>`00000000-0000-4000-8000-${String(n++).padStart(12,'0')}`});window.showSaveFilePicker=async()=>({createWritable:async()=>({write:async blob=>{window.__lastFile=await blob.text()},close:async()=>{}})});}""")
  page.add_script_tag(content=scripts[0]);page.add_script_tag(content=code)
  page.locator('#open-notebook').wait_for()
  assert page.locator('#open-notebook').is_visible()
  assert page.locator('#close-notebook').is_visible()
  page.evaluate('window.__candidate=window.__smokeDoc()')
  page.locator('#close-notebook').click()
  page.locator('#close-save').click()
  page.wait_for_function("document.querySelector('#close-result')?.textContent.includes('Archivo escrito')")
  assert page.evaluate('JSON.parse(window.__lastFile).type')=='TabulariumCuaderno'
  page.locator('#close-cancel').click()
  assert 'Copia escrita' in page.locator('#portable-status').inner_text()
  page.locator('[data-tab="ajustes"]').click()
  page.locator('#decimals').select_option('1')
  page.wait_for_function("document.querySelector('#portable-status')?.textContent.includes('Modificaciones')")
  page.locator('#open-notebook-file').set_input_files({'name':'test.cuaderno','mimeType':'application/json','buffer':b'{}'})
  page.locator('#backup-password').fill('Una contraseña larga, solo prueba')
  page.locator('#backup-password-form button[type=submit]').click()
  page.locator('#import-cancel').wait_for()
  assert 'anterior' in page.locator('.import-warning').inner_text().lower()
  page.locator('#import-keep').click()
  assert page.locator('#decimals').input_value()=='1'
  page.locator('#open-notebook-file').set_input_files({'name':'test2.cuaderno','mimeType':'application/json','buffer':b'{}'})
  page.locator('#backup-password').fill('Una contraseña larga, solo prueba',)
  page.locator('#backup-password-form button[type=submit]').click()
  page.locator('#import-confirm').click()
  page.locator('[data-tab="ajustes"]').click()
  assert page.locator('#decimals').input_value()=='2'
  assert page.locator('#backup-recover').count()==1
  page.evaluate("() => {window.showSaveFilePicker=async()=>{throw new DOMException('Cancelado','AbortError')}}")
  page.locator('#close-notebook').click()
  page.locator('#close-save').click(timeout=4000)
  page.wait_for_function("document.querySelector('#close-result')?.textContent.includes('cancelada')")
  page.locator('#close-cancel').click()
  assert page.locator('#decimals').input_value()=='2'
  info=page.evaluate('({pageWidth:document.documentElement.scrollWidth, viewport:innerWidth})')
  assert info['pageWidth']<=info['viewport']+3,(name,info)
  assert not errors,(name,errors)
  results.append({'pantalla':name,'ancho':width,'controles':'visibles','elección_importación':'conservar o importar explícitamente','detección_copia_antigua':'correcta','errores_js':0})
  page.close()
 browser.close()
print(json.dumps(results,ensure_ascii=False,indent=2))
