"""Control visual de v1.12 sobre HTML empaquetado, Chromium con persistencia simulada.
No equivale a validar Safari/IndexedDB real ni a usar notas verdaderas.
"""
from pathlib import Path
import re
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
html=(root/'CuadernoDocente_sin_instalar.html').read_text()
scripts=re.findall(r'<script>([\s\S]*?)</script>',html)
assert len(scripts)==2
code=scripts[1]
assert code.count('init();')==1
code=code.replace('init();', '''STATE.db={};STATE.key={};STATE.salt={};STATE.envelope={format:'ui-test'};
STATE.doc=(0,model_js_1.initialNotebook)();
globalThis.__doc=()=>JSON.stringify(STATE.doc);
chooseInitial();render();''')
code=code.replace('async function persist(snapshot) {','async function persist(snapshot) {\n STATE.envelope={format:"ui-test"};STATE.saveError=null;return;')
html=re.sub(r'<meta http-equiv="Content-Security-Policy"[^>]*>','',html)
html=re.sub(r'<script>[\s\S]*?</script>','',html)
shots=Path('/mnt/data/cd_classical_work/previews');shots.mkdir(exist_ok=True)
with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
  for label,w,h,theme in [('mac_claro',1512,982,'light'),('mac_oscuro',1512,982,'dark'),('mac_oled',1512,982,'oled'),('ipad',1024,768,'light'),('iphone',390,844,'light')]:
    page=browser.new_page(viewport={'width':w,'height':h},device_scale_factor=1)
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('console',lambda e:errors.append('console:'+e.text) if e.type=='error' else None)
    page.goto('about:blank');page.set_content(html,wait_until='domcontentloaded')
    page.evaluate('''() => {let n=0;Object.defineProperty(window.crypto,'randomUUID',{value:()=>`00000000-0000-4000-8000-${String(++n).padStart(12,'0')}`});window.confirm=()=>true;}''')
    page.add_script_tag(content=scripts[0]);page.add_script_tag(content=code)
    page.locator('.grade-table').wait_for(timeout=8000)
    page.locator('#theme-select').select_option(theme)
    assert page.locator('.brand-copy strong').inner_text()=='CuadernoDocente'
    assert page.locator('.tabs [data-tab]').count()==8
    assert page.locator('.term-bar').count()==1
    assert page.locator('.notebook-primary-actions .btn').count()==4
    assert page.locator('.grade-table tbody tr').count()>0
    layout=page.evaluate('''() => ({bodyWidth:document.body.scrollWidth,screen:innerWidth,workspace:getComputedStyle(document.querySelector('.workspace')).display,navRect:document.querySelector('.tabs').getBoundingClientRect().toJSON(),contentRect:document.querySelector('.work-area').getBoundingClientRect().toJSON(),background:getComputedStyle(document.body).backgroundColor})''')
    print('LAYOUT',label,layout)
    # Table has its own scrolling; the body must not overflow just because the table is wide.
    assert layout['bodyWidth']<=w+2,(label,layout)
    if w>=1300:
      before=page.evaluate('window.__doc()')
      assert page.locator('#toggle-navigation').is_visible()
      page.locator('#toggle-navigation').click()
      assert page.locator('.shell.nav-collapsed').count()==1
      page.locator('#toggle-navigation').click()
      assert page.locator('.shell.nav-collapsed').count()==0
      assert page.evaluate('window.__doc()')==before
    page.screenshot(path=str(shots/(label+'.png')),full_page=True)
    if label=='mac_claro':
      before=page.evaluate('window.__doc()')
      page.locator('#new-assessment').click()
      assert page.locator('#activity-form').is_visible()
      assert page.locator('.activity-disclosure').count()==2
      page.locator('.activity-disclosure').last.locator('summary').click()
      assert page.locator('.activity-disclosure').last.get_attribute('open') is not None
      assert page.evaluate('window.__doc()')==before
      page.screenshot(path=str(shots/'modal_actividad.png'),full_page=True)
      page.locator('#cancel-activity').click()
      page.locator('[data-tab="planificador"]').click()
      page.locator('.planner-view').wait_for()
      assert page.locator('#plan-add-slot').is_visible()
      page.screenshot(path=str(shots/'planificador.png'),full_page=True)
      page.locator('[data-tab="cuaderno"]').click()
      assert page.evaluate('window.__doc()')==before
      page.locator('[data-final-choice]').click()
      assert page.locator('#tab-content').is_visible()
      page.locator('[data-tab="rubricas"]').click()
      assert page.locator('#create-rubric').is_visible()
      page.locator('[data-tab="curriculo"]').click()
      assert page.locator('#tab-content').is_visible()
      page.locator('[data-tab="ajustes"]').click()
      assert page.locator('#backup-download').is_visible()
      assert page.evaluate('window.__doc()')==before
      # Crear actividad: el rediseño despliega contenido con <details> sin cambiar el modelo.
      page.locator('[data-tab="cuaderno"]').click()
      old_assessments=page.locator('.grade-table thead th').count()
      original_grades=page.evaluate('JSON.stringify(JSON.parse(window.__doc()).grades)')
      page.locator('#new-assessment').click()
      page.locator('#activity-form [name=name]').fill('Prueba visual Tabularium')
      page.locator('#activity-form button[type=submit]').click()
      page.locator('.grade-table thead th').last.wait_for()
      assert page.locator('.grade-table thead th').count()==old_assessments+1
      assert page.evaluate('JSON.stringify(JSON.parse(window.__doc()).grades)')==original_grades
    if label=='iphone':
      page.locator('[data-tab="planificador"]').click()
      assert page.locator('.planner-view').is_visible()
      page.screenshot(path=str(shots/'planificador_movil.png'),full_page=True)
    assert not errors,(label,errors)
    print('PASS',label,'errors=',errors)
    page.close()
  browser.close()
print('VISUAL TESTS PASSED')
