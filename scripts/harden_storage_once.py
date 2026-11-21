#!/usr/bin/env python3
"""Parche puntual de conservación local. Uso único en rama security/storage-retention-audit-20261121."""
from pathlib import Path
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[1]
APP=ROOT / "app"

def edit(path, old, new):
    target=APP / path
    data=target.read_text(encoding="utf-8")
    matches=data.count(old)
    if matches!=1:
        raise SystemExit(f"{path}: esperado un fragmento; encontrados {matches}")
    target.write_text(data.replace(old,new),encoding="utf-8")

pwa=APP / "src/pwa-controls.js"
with pwa.open("a",encoding="utf-8") as f:
    f.write("""
/** Consulta del almacenamiento del origen: nunca reemplaza una copia cifrada externa. */
export async function storagePersistence(storage,request=false){
  const method=request?'persist':'persisted';
  if(!storage||typeof storage[method]!=='function')return 'unsupported';
  try{
    const granted=await storage[method]();
    return granted===true?'persistent':granted===false?'best-effort':'unavailable';
  }catch{return 'unavailable';}
}
""")

edit("app.js",
    "import {installInstructions,mayReloadForUpdate} from './src/pwa-controls.js';",
    "import {installInstructions,mayReloadForUpdate,storagePersistence} from './src/pwa-controls.js';")

edit("app.js",
    "function renderSettings(){\n  const s=STATE.doc.settings;\n  return ",
    """function renderSettings(){
  const s=STATE.doc.settings;
  const originWarning=location.hostname==='archaiosmagister.github.io'
    ? '<p class="section-note">Aviso de aislamiento: las aplicaciones de este dominio GitHub Pages comparten origen y acceso al almacenamiento del navegador, aunque estén en rutas distintas. El cuaderno está cifrado, pero otro código del mismo origen podría copiar su sobre cifrado o borrar el almacén. No introduzcas datos reales hasta alojar AppNotas en un origen independiente y autorizar su uso.</p>' : '';
  return """)

edit("app.js",
    '</section><section class="panel panel-pad"><h2>Preparación para trabajar offline',
    """</section><section class="panel panel-pad"><h2>Conservación del almacenamiento local</h2><p>El navegador puede eliminar los datos de IndexedDB. La protección persistente reduce el riesgo de eliminación automática, pero no sustituye copias cifradas externas.</p><div class="actions"><button type="button" class="btn" id="storage-check">Comprobar protección</button><button type="button" class="btn" id="storage-protect">Solicitar almacenamiento persistente</button></div><p id="storage-status" class="hint" role="status" aria-live="polite">Sin comprobar.</p>${originWarning}</section><section class="panel panel-pad"><h2>Preparación para trabajar offline""")

edit("app.js",
    "function bindSettings(){",
    """function bindSettings(){
  async function reportStorageProtection(request=false){
    const el=$('#storage-status');if(!el)return;
    el.textContent=request?'Solicitando protección al navegador…':'Comprobando protección del almacenamiento…';
    const status=await storagePersistence(navigator.storage,request);
    if(!el.isConnected)return;
    el.textContent=status==='persistent'
      ? 'Almacenamiento persistente concedido. Aun así, descarga y verifica copias cifradas externas.'
      :status==='best-effort'
      ? 'Protección persistente no concedida. El navegador puede liberar estos datos; conserva copias cifradas externas.'
      :status==='unsupported'
      ? 'Este navegador no ofrece esta comprobación. No confíes únicamente en IndexedDB.'
      : 'No ha sido posible comprobar la protección del almacenamiento. Conserva una copia cifrada externa.';
  }
  $('#storage-check')?.addEventListener('click',()=>reportStorageProtection(false));
  $('#storage-protect')?.addEventListener('click',()=>reportStorageProtection(true));
  void reportStorageProtection(false);""")

edit("app.js",
    "caches.open('cuaderno-docente-static-v120-dev')",
    "caches.open('cuaderno-docente-static-v121-dev')")
edit("sw.js",
    "const CACHE='cuaderno-docente-static-v120-dev';",
    "const CACHE='cuaderno-docente-static-v121-dev';")

subprocess.run([sys.executable,str(ROOT/"scripts/source_manifest.py"),"--write"],check=True)
subprocess.run([sys.executable,str(ROOT/"scripts/source_manifest.py"),"--check"],check=True)
print("Comprobación y aviso integrados. No se han modificado notas ni cálculos.")
