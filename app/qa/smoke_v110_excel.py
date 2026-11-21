"""Recorrido visual aislado: Chrome simulado; no demuestra persistencia Safari."""
from pathlib import Path
import re, json, tempfile
from playwright.sync_api import sync_playwright
source=Path(__file__).resolve().parents[1]/'CuadernoDocente_sin_instalar.html'
html=source.read_text()
scripts=re.findall(r'<script>([\s\S]*?)</script>',html)
assert len(scripts)==2
code=scripts[1]
assert code.count('init();')==1
code=code.replace('init();', "STATE.db={};STATE.key={};STATE.salt={};STATE.envelope={format:'simulado'};STATE.doc=(0, model_js_1.initialNotebook)();chooseInitial();render();")
code=code.replace('async function persist(snapshot) {','async function persist(snapshot) {\n    STATE.envelope={format:"simulado"}; STATE.saveError=null;return;')
html=re.sub(r'<meta http-equiv="Content-Security-Policy"[^>]*>','',html)
html=re.sub(r'<script>[\s\S]*?</script>','',html)
model=Path(__file__).resolve().parents[1]/'examples/Rubrica_Actitud_2bach.xlsx'
assert model.is_file(),model
with tempfile.NamedTemporaryFile(mode='w',suffix='.json',encoding='utf-8',delete=False) as temp:
 temp.write(json.dumps({'name':'Descriptores para prueba', 'criteria':[{'name':'Puntualidad', 'weight':1,'maxScore':2, 'levels':[{'score':2,'label':'Bien','description':'A tiempo'},{'score':0,'label':'Mal','description':'Retraso'}]}]},ensure_ascii=False))
 out=Path(temp.name)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1450,'height':920},accept_downloads=True)
 errors=[]
 page.on('pageerror',lambda e: errors.append(str(e)))
 page.goto('about:blank')
 page.set_content(html,wait_until='domcontentloaded')
 page.evaluate('''() => {let n=0;Object.defineProperty(window.crypto,'randomUUID',{value:()=>`00000000-0000-4000-8000-${String(++n).padStart(12,'0')}`});window.confirm=()=>true;}''')
 page.add_script_tag(content=scripts[0]);page.add_script_tag(content=code)
 page.locator('.grade-table tbody tr').first.wait_for(timeout=10000)
 initial_stats=page.locator('[data-class-stat^="assessment:"]').count()
 page.locator('[data-tab="rubricas"]').click()
 page.locator('#rubric-import-file').set_input_files(str(model))
 page.locator('#tab-content').get_by_text('5 criterios',exact=False).first.wait_for(timeout=8000)
 # Examinar la rúbrica importada renderizada (5 criterios) y el mensaje de edición segura
 txt=page.locator('#tab-content').inner_text()
 assert 'Uso del móvil' in txt,txt[:2000]
 assert '5 criterios' in txt,txt[:2000]
 assert 'Con niveles descriptivos' in txt,txt[:3000]
 print('EXCEL_ACTITUD_REAL_5_CRITERIOS_OK')
 page.locator('#rubric-import-file').set_input_files(str(out))
 page.get_by_text('Descriptores para prueba',exact=False).first.wait_for(timeout=8000)
 assert 'Descriptores para prueba' in page.locator('#tab-content').inner_text()
 assert 'Con niveles descriptivos' in page.locator('#tab-content').inner_text()
 print('JSON_RUBRICA_DESCRIPTIVA_OK')
 page.locator('[data-tab="cuaderno"]').click()
 assert page.locator('[data-class-stat^="assessment:"]').count()==initial_stats
 page.locator('[data-class-stat^="assessment:"]').first.click()
 assert 'Estadísticas de la clase' in page.locator('#class-stat-popover').inner_text()
 print('ESTADISTICAS_SIN_REGRESIONES_OK')
 print('ERRORES_JS',errors)
 assert not errors
 browser.close()
out.unlink(missing_ok=True)
