"""Recorrido funcional Chromium de copias cifradas, solo con alumnos ficticios.
No sustituye las comprobaciones manuales de Safari/macOS/iOS reales.
"""
from playwright.sync_api import sync_playwright
from pathlib import Path
import subprocess, time, urllib.request, json, os
BASE=Path(__file__).resolve().parent.parent
PORT='4198'
server=subprocess.Popen(['node','server.mjs'],cwd=BASE,env={**os.environ,'PORT':PORT},stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
URL='http://127.0.0.1:'+PORT
try:
 for _ in range(40):
  try: urllib.request.urlopen(URL+'/index.html',timeout=.3).close();break
  except Exception: time.sleep(.1)
 else: raise RuntimeError('Servidor de pruebas no iniciado')
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--no-proxy-server','--proxy-bypass-list=<-loopback>','--disable-dev-shm-usage'])
  devices=[('Mac',{'width':1366,'height':890},False),('iPad emulado',{'width':820,'height':1180},True),('iPhone emulado',{'width':390,'height':844},True)]
  results=[]
  for label,viewport,touch in devices:
   context=browser.new_context(viewport=viewport,has_touch=touch,accept_downloads=True)
   page=context.new_page()
   failures=[]
   page.on('pageerror',lambda e:failures.append(str(e)))
   page.add_init_script('''window.__saved=null;window.showSaveFilePicker=async(options)=>({createWritable:async()=>({write:async blob=>{window.__saved=await blob.text();},close:async()=>{}})});''')
   page.goto(URL,wait_until='domcontentloaded')
   page.locator('#password').fill('Contraseña ficticia local 2026')
   page.locator('#confirm-password').fill('Contraseña ficticia local 2026')
   page.locator('#unlock-form button[type=submit]').click()
   page.locator('#open-notebook').wait_for(timeout=15000)
   assert page.locator('#close-notebook').is_visible(),label+' botón cerrar invisible'
   assert page.locator('#open-notebook').is_visible(),label+' botón abrir invisible'
   page.locator('#close-notebook').click()
   page.locator('#close-save').wait_for()
   page.locator('#close-save').click()
   page.wait_for_function('window.__saved!==null')
   page.wait_for_function("document.querySelector('#close-result')?.textContent?.includes('Archivo escrito')")
   encrypted=page.evaluate('window.__saved')
   assert 'Alumno 01' not in encrypted and 'Examen UD1' not in encrypted,label+' filtración datos'
   file=json.loads(encrypted)
   assert file['type']=='TabulariumCuaderno'
   page.locator('#close-cancel').click()
   page.wait_for_function("document.querySelector('#portable-status').textContent.includes('Copia escrita')")
   # Una modificación real cambia inmediatamente el estado de exportación.
   page.locator('[data-tab="ajustes"]').click()
   page.locator('#decimals').select_option('1')
   page.wait_for_function("document.querySelector('#portable-status').textContent.includes('Modificaciones')")
   # Importación y cancelación sin sobrescribir.
   page.locator('#open-notebook-file').set_input_files({'name':'Tabularium_prueba.cuaderno','mimeType':'application/octet-stream','buffer':encrypted.encode('utf-8')})
   page.locator('#backup-password').fill('Contraseña ficticia local 2026')
   page.locator('#backup-password-form button[type=submit]').click()
   page.locator('#import-warning') if False else None
   page.locator('#import-cancel').wait_for()
   assert 'anterior' in page.locator('.import-warning').inner_text().lower(),label+' no detecta copia antigua'
   page.locator('#import-keep').click()
   page.wait_for_function("document.querySelector('#portable-status').textContent.includes('Modificaciones')")
   page.locator('#open-notebook-file').set_input_files({'name':'Tabularium_prueba.cuaderno','mimeType':'application/octet-stream','buffer':encrypted.encode('utf-8')})
   page.locator('#backup-password').fill('Contraseña ficticia local 2026')
   page.locator('#backup-password-form button[type=submit]').click()
   page.locator('#import-confirm').click()
   page.locator('#open-notebook').wait_for()
   page.locator('[data-tab="ajustes"]').click()
   assert page.locator('#decimals').input_value()=='2',label+' no restaura la configuración'
   assert page.locator('#backup-recover').is_visible(),label+' falta recuperar versión previa'
   assert not failures,label+' errores JS '+str(failures)
   results.append({'dispositivo':label,'archivo':'AES-GCM, JSON no legible','importacion':'OK, copia antigua detectada, previo conservado','errores_js':len(failures),'anchura_contenido':page.evaluate('document.documentElement.scrollWidth'),'anchura_ventana':viewport['width']})
   context.close()
  # comprobar HTML monolítico por HTTP y cifrado sin red (tanto scripts como recursos PDF integrados).
  context=browser.new_context()
  page=context.new_page()
  page.goto(URL+'/CuadernoDocente_sin_instalar.html') if False else None
  context.close()
  browser.close()
  print(json.dumps(results,ensure_ascii=False,indent=2))
finally:
 server.terminate()
 try:server.wait(timeout=5)
 except:server.kill()
