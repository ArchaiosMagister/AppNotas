"""Recorrido de interfaz aislado sin persistencia: no equivale a Safari real."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import re

root=Path(__file__).resolve().parents[1]
html=(root/'CuadernoDocente_sin_instalar.html').read_text()
scripts=re.findall(r'<script>([\s\S]*?)</script>',html)
assert len(scripts)==2
code=scripts[1]
assert code.count('init();')==1
inject="""STATE.db={};STATE.key={};STATE.salt={};STATE.envelope={format:'simulado'};
STATE.doc=(0, model_js_1.initialNotebook)();
{
const d=STATE.doc,g=d.groups[0],p=d.periods[0],s=d.students[0];
const a=(0,model_js_1.addAssessment)(d,{name:'Examen prueba faltas',groupId:g.id,periodId:p.id,categoryId:d.categories[0].id,orthography:{enabled:true,refundable:true,penaltyPerFault:.1,repetitions:30}});
(0,model_js_1.setOrthographyGrade)(d,s.id,a.id,{score:8.5,faults:4,delivered:true});
globalThis.__gradeBaseline=JSON.stringify(d.grades);
globalThis.__getGrades=()=>JSON.stringify(STATE.doc.grades);
}
chooseInitial();render();"""
code=code.replace('init();',inject)
code=code.replace('async function persist(snapshot) {','async function persist(snapshot) {\n STATE.envelope={format:"simulado"};STATE.saveError=null;return;')
html=re.sub(r'<meta http-equiv="Content-Security-Policy"[^>]*>','',html)
html=re.sub(r'<script>[\s\S]*?</script>','',html)
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=b.new_page(viewport={'width':1400,'height':900})
 errors=[]
 page.on('pageerror',lambda e: errors.append(str(e)))
 page.goto('about:blank');page.set_content(html,wait_until='domcontentloaded')
 page.evaluate('''() => {let n=0; Object.defineProperty(window.crypto,'randomUUID',{value:()=>`00000000-0000-4000-8000-${String(++n).padStart(12,'0')}`});window.confirm=()=>true;}''')
 page.add_script_tag(content=scripts[0]);page.add_script_tag(content=code)
 page.locator('[data-edit]').filter(has=page.locator('span')).count()
 page.locator('[data-edit]').last.click()
 page.locator('#edit-assessment').click()
 page.locator('#modal-form [name=orthRecoverable]').select_option('false')
 page.locator('#modal-form button[type=submit]').click()
 page.locator('#modal-form .modal-error').get_by_text('Desmárcalas individualmente',exact=False).wait_for(timeout=8000)
 assert page.evaluate('window.__getGrades() === window.__gradeBaseline'), 'Se han modificado notas al intentar desactivar entregas'
 assert not errors,errors
 print('EDICION_ORTOGRAFICA_RECHAZADA_SIN_DESTRUIR_NOTAS_OK')
 print('ERRORES_JS',errors)
 b.close()
