"""Visual smoke with real UI logic but in-memory stub persistence: NOT proof of offline storage."""
from pathlib import Path
import re
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
paths=['src/model.js','src/calculations.js','src/csv.js','src/rubric-import.js','src/history.js','src/rubric-ui.js','src/diagnostics.js','src/curriculum-data.js','app.js']
js=[]
for name in paths:
 code=(root/name).read_text()
 code=re.sub(r'^import .*?;\s*$', '', code, flags=re.M)
 code=re.sub(r'^export ', '', code, flags=re.M)
 if name=='app.js':
  start=code.index('async function persist(snapshot){');end=code.index('/** Guardar antes de confirmar',start)
  code=code[:start]+"async function persist(snapshot){STATE.envelope={format:'testonly'};STATE.saveError=null;}\n"+code[end:]
  code=code.replace('init();',"STATE.db={};STATE.key={};STATE.salt={};STATE.envelope={format:'testonly'};STATE.doc=initialNotebook();chooseInitial();render();")
 js.append(code)
bundle='\n'.join(js)
# No se guarda ni publica el paquete de prueba con almacenamiento simulado.
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 context=browser.new_context(viewport={'width':1320,'height':900})
 page=context.new_page()
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('console',lambda m: errors.append('console: '+m.text) if m.type=='error' else None)
 page.goto('about:blank')
 html=(root/'index.html').read_text()
 html=re.sub(r'<meta http-equiv="Content-Security-Policy"[^>]*>', '',html)
 html=re.sub(r'<script type="module" src="\./app\.js"></script>','',html)
 html=re.sub(r'<link rel="stylesheet" href="\./styles.css"/>','<style>'+ (root/'styles.css').read_text()+'</style>',html)
 page.set_content(html)
 page.evaluate("""() => {let n=0;Object.defineProperty(window.crypto,'randomUUID',{value:()=>`00000000-0000-4000-8000-${String(++n).padStart(12,'0')}`});window.confirm=()=>true;}""")
 page.add_script_tag(content=bundle)
 page.locator('.grade-table tbody tr').first.wait_for(timeout=5000)
 assert page.locator('.grade-table tbody tr').count()==8
 print('UI load: 8 rows')
 field=page.locator('[data-student][data-assessment]').first
 before=field.input_value()
 
 field.fill('7,5');field.press('Tab')
 page.locator('#undo-change:not([disabled])').wait_for(timeout=3000)
 assert page.locator('[data-student][data-assessment]').first.input_value()=='7,5'
 page.locator('#undo-change').click()
 assert page.locator('[data-student][data-assessment]').first.input_value()==before
 page.locator('#redo-change').click()
 assert page.locator('[data-student][data-assessment]').first.input_value()=='7,5'
 print('UI undo+redo grade: OK')
 page.locator('[data-tab="rubricas"]').click()
 page.locator('#create-rubric').click()
 assert page.locator('[data-editor-row]').count()==3
 page.locator('#add-criterion').click()
 assert page.locator('[data-editor-row]').count()==4
 page.locator('[data-editor-row]').last.locator('[data-criterion-name]').fill('Originalidad')
 page.locator('#rubric-editor [type=submit]').click()
 page.get_by_text('Trabajo escrito',exact=True).wait_for(timeout=3000)
 page.locator('[data-copy-rubric]').first.click()
 assert page.locator('[data-edit-rubric]').count()==2
 print('UI create+duplicate rubric: OK')
 page.locator('[data-tab="cuaderno"]').click()
 page.locator('#new-assessment').click()
 dlg=page.locator('#modal')
 dlg.locator('input[name="name"]').fill('Trabajo rubricado')
 # rubric id is the second select? use name attribute
 rubr=dlg.locator('select[name="rubricId"]');rubr.select_option(index=1)
 dlg.locator('#modal-form button[type="submit"]').click()
 page.locator('[data-rubric-grade]').first.click()
 assert page.locator('.rubric-rating-row').count()==4
 assert page.locator('#save-rubric-grade').is_disabled()
 page.locator('[data-rating-quick="1"]').first.click()
 assert '1/4' in page.locator('#rubric-live-score').inner_text()
 page.locator('[data-rating-quick="1"]').nth(1).click()
 page.locator('[data-rating-quick="1"]').nth(2).click()
 page.locator('[data-rating-quick="1"]').nth(3).click()
 assert '10' in page.locator('#rubric-live-score').inner_text()
 assert not page.locator('#save-rubric-grade').is_disabled()
 page.locator('#save-rubric-grade').click()
 assert page.locator('#modal').get_attribute('open') is None
 page.locator('[data-rubric-grade]').first.click()
 assert page.locator('[data-rating-id]').first.input_value()!=''
 assert page.locator('#save-rubric-next').count()==1
 page.locator('#save-rubric-next').click()
 assert 'Alumno 02' in page.locator('#modal').inner_text()
 page.locator('#cancel-rubric-grade').click()
 # La coma decimal se mostraba correctamente antes, pero fallaba al guardar.
 page.locator('[data-rubric-grade]').first.click()
 page.locator('[data-rating-id]').first.fill('2,5')
 assert not page.locator('#save-rubric-grade').is_disabled()
 page.locator('#save-rubric-grade').click()
 assert page.locator('#modal').get_attribute('open') is None
 print('UI grade+preview+comma-decimal save+next student: OK')
 page.locator('[data-edit]').first.click()
 page.locator('#delete-assessment').click()
 assert page.locator('[data-edit]').count()==4
 page.locator('#undo-change').click()
 assert page.locator('[data-edit]').count()==5
 print('UI delete + undo: OK')
 # Gestión: grupo y periodo, sin tocar claves ni calificaciones.
 page.locator('#edit-group').click()
 page.locator('#rename-group-btn').click()
 page.locator('#modal-form input[name="name"]').fill('Grupo Renombrado')
 page.locator('#modal-form input[name="course"]').fill('2027-2028')
 page.locator('#modal-form button[type="submit"]').click()
 assert 'Grupo Renombrado' in page.locator('.headrow h1').inner_text()
 page.locator('#edit-period').click()
 page.locator('#rename-period-btn').click()
 page.locator('#modal-form input[name="name"]').fill('Trimestre primero')
 page.locator('#modal-form button[type="submit"]').click()
 assert 'Trimestre primero' in page.locator('#period-select').inner_text()
 print('UI rename group + period: OK')
 page.locator('[data-edit-student]').first.click()
 page.locator('#rename-student-btn').click()
 page.locator('#modal-form input[name="name"]').fill('Alumno Ficticio A')
 page.locator('#modal-form button[type="submit"]').click()
 assert 'Alumno Ficticio A' in page.locator('.grade-table tbody tr').first.inner_text()
 page.locator('[data-edit-student]').first.click()
 page.locator('[data-move-student="1"]').click()
 assert 'Alumno Ficticio A' in page.locator('.grade-table tbody tr').nth(1).inner_text()
 page.locator('[data-edit-student]').nth(1).click()
 page.locator('#remove-student-btn').click()
 assert page.locator('.grade-table tbody tr').count()==7
 page.locator('#undo-change').click()
 assert page.locator('.grade-table tbody tr').count()==8
 print('UI student edit + move + remove + undo: OK')
 page.locator('[data-view-student]').first.click()
 assert page.locator('.grade-table').count()==0
 assert page.locator('.student-privacy').count()==1
 page.locator('#hide-student').click()
 assert page.locator('.student-hidden').count()==1
 page.locator('[data-tab="cuaderno"]').click()
 page.locator('[data-tab="ajustes"]').click()
 assert page.locator('#backup-verify').count()==1
 assert page.locator('#check-offline').count()==1
 page.evaluate("() => {requestBackupPassword('Prueba de campo enmascarado').then(s => window.__testSecret = s);}")
 assert page.locator('#backup-password').get_attribute('type')=='password'
 page.locator('#backup-password').fill('contraseña ficticia 12345')
 page.locator('#backup-password-form button[type=submit]').click()
 assert page.evaluate('window.__testSecret')=='contraseña ficticia 12345'
 assert not page.locator('#modal').get_attribute('open')
 page.locator('[data-tab="cuaderno"]').click()
 print('UI verify-backup + masked secret form: OK')
 page.screenshot(path=str(root/'qa'/'vista_escritorio_simulada.png'),full_page=True)
 page.set_viewport_size({'width':390,'height':844})
 page.locator('[data-tab="rubricas"]').click()
 assert page.locator('[data-tab="rubricas"]').bounding_box()['x']<390
 page.screenshot(path=str(root/'qa'/'vista_movil_simulada.png'),full_page=True)

 # Verificación funcional de la biblioteca curricular y su independencia de los grupos.
 page.set_viewport_size({'width':1320,'height':900})
 page.locator('#level-select').select_option('2bach')
 page.locator('[data-tab="curriculo"]').click()
 assert page.locator('.curr-warning').count()==1
 assert page.locator('[data-curr-version="2022"]').get_attribute('aria-pressed')=='true'
 assert page.locator('.curr-competency').count()==0
 page.locator('[data-curr-version="2026"]').click()
 assert page.locator('.curr-competency').count()==5
 assert page.locator('.curriculum-view a[href*="lat1y2-nuevo.pdf"]').count()>=1
 page.evaluate("document.getElementById('toast')?.remove()")
 page.screenshot(path=str(root/'qa'/'curriculo_escritorio_simulado.png'),full_page=True)
 page.locator('[data-curr-section="criterios"]').click()
 assert page.locator('.curr-criterion').count()==19
 page.locator('#curr-competence').select_option('2')
 assert page.locator('.curr-criterion').count()==4
 page.locator('#curr-search').fill('sin palabras posibles zzqqxx')
 assert page.locator('.curr-criterion').count()==0
 page.locator('#curr-search').fill('fonéticos')
 assert page.locator('.curr-criterion').count()>=1
 page.locator('#curr-competence').select_option('all')
 page.locator('[data-curr-section="saberes"]').click()
 assert page.locator('.curr-block').count()==5
 page.locator('#subject-select').select_option('Griego II')
 page.locator('[data-curr-section="criterios"]').click()
 assert page.locator('.curr-criterion').count()==18
 page.locator('#level-select').select_option('4eso')
 assert page.locator('.curriculum-view h2').inner_text()=='Latín 4.º ESO'
 assert page.locator('.curr-criterion').count()==21
 page.locator('[data-curr-section="saberes"]').click()
 assert page.locator('.curr-block').count()==4
 page.set_viewport_size({'width':390,'height':844})
 page.locator('[data-curr-section="competencias"]').click()
 assert page.locator('.curr-competency').count()==5
 page.screenshot(path=str(root/'qa'/'curriculo_movil_simulado.png'),full_page=True)
 assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), 'Desbordamiento horizontal del currículo en móvil'
 # El panel de rescate se muestra en todas las medidas sin alterar el resto de vistas.
 page.evaluate("""() => {STATE.recovery={version:1,createdAt:'2026-11-21T09:00:00Z',envelope:{format:'CuadernoDocenteEncrypted'}};STATE.tab='ajustes';render();}""")
 assert page.locator('#backup-recover').count()==1
 assert page.locator('#backup-download-recovery').count()==1
 assert 'un punto de rescate' in page.locator('.recovery-help').inner_text()
 page.screenshot(path=str(root/'qa'/'rescate_escritorio_simulado.png'),full_page=True)
 page.set_viewport_size({'width':390,'height':844})
 assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), 'Desbordamiento horizontal en ajustes con rescate'
 page.screenshot(path=str(root/'qa'/'rescate_movil_simulado.png'),full_page=True)
 page.evaluate('showUnlock(false)')
 assert page.locator('#recover-locked').count()==1
 assert page.locator('#download-recovery-locked').count()==1
 assert page.locator('#modal').get_attribute('open') is None
 print('UI recovery: actions in settings and locked state, 390px: OK')
 print('CURRICULUM UI: Latin II dual, search, filters, source links, Griego II, Latin 4ESO, responsive: OK')
 print('SYNTHETIC VISUAL: desktop and 390px screenshots captured')
 print('JS ERRORS:',errors)
 assert not errors,errors
 browser.close()
