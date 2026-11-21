"""Smoke con Chromium, persistencia simulada. No verifica Safari ni IndexedDB reales.
Requiere el módulo Playwright de Python y Chromium instalado; solo QA, no uso de la app.
"""
from pathlib import Path
import re
from playwright.sync_api import sync_playwright
src=(Path(__file__).resolve().parents[1]/'CuadernoDocente_sin_instalar.html').read_text()
scripts=re.findall(r'<script>([\s\S]*?)</script>',src)
assert len(scripts)==2
code=scripts[1]
assert code.count('init();')==1
code=code.replace('init();',"STATE.db={};STATE.key={};STATE.salt={};STATE.envelope={format:'testonly'};STATE.doc=(0, model_js_1.initialNotebook)();chooseInitial();render();")
# El estado se prueba en memoria: no sirve para validar IndexedDB real.
code=code.replace('async function persist(snapshot) {','async function persist(snapshot) {\n    STATE.envelope={format:"testonly"}; STATE.saveError=null;return;\n')
html=re.sub(r'<meta http-equiv="Content-Security-Policy"[^>]*>','',src)
html=re.sub(r'<script>[\s\S]*?</script>','',html)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1440,'height':930})
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('console',lambda e: errors.append('console:'+e.text) if e.type=='error' else None)
 page.goto('about:blank')
 page.set_content(html,wait_until='domcontentloaded')
 page.evaluate('''() => {let n=0;Object.defineProperty(window.crypto,'randomUUID',{value:()=>`00000000-0000-4000-8000-${String(++n).padStart(12,'0')}`});window.confirm=()=>true;}''')
 page.add_script_tag(content=scripts[0])
 page.add_script_tag(content=code)
 page.locator('.grade-table tbody tr').first.wait_for(timeout=8000)
 activity=page.locator('.grade-table thead [data-class-stat^="assessment:"]').first
 activity.hover()
 page.locator('#class-stat-popover').wait_for(timeout=3000)
 print('hover',page.locator('#class-stat-popover').inner_text())
 activity.click();assert activity.get_attribute('aria-expanded')=='true'
 page.keyboard.press('Escape'); assert page.locator('#class-stat-popover').count()==0
 page.locator('[data-class-stat^="period:"]').click();print('period',page.locator('#class-stat-popover').inner_text())
 # La captura de prueba se omite para no guardar datos, aunque sean ficticios.
 page.locator('[data-final-choice]').click()
 page.locator('[data-class-stat^="course:"]').first.click();print('course',page.locator('#class-stat-popover').inner_text())
 page.locator('[data-class-stat^="annual-period:"]').first.click();print('annual-period',page.locator('#class-stat-popover').inner_text())
 page.locator('[data-tab="calculos"]').click()
 page.locator('[data-class-stat^="category:"]').first.click();print('category',page.locator('#class-stat-popover').inner_text())
 page.locator('[data-tab="cuaderno"]').click()
 page.locator('[data-view-student]').first.click();assert page.locator('[data-class-stat]').count()==0
 print('privacy: no class info in student view')
 page.locator('#hide-student').click()
 page.locator('[data-tab="cuaderno"]').click()
 page.locator('#theme-select').select_option('oled')
 page.locator('[data-class-stat^="assessment:"]').first.click()
 # La captura de prueba se omite para no guardar datos, aunque sean ficticios.
 print('JS ERRORS',errors)
 assert not errors
 browser.close()
