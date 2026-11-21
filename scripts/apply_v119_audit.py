#!/usr/bin/env python3
"""Parche auditado de la agenda de CuadernoDocente v1.19.

Detiene la compilación si el código fuente difiere del auditado.
"""
from pathlib import Path
import hashlib
import re
import sys

root = Path(sys.argv[1]).resolve()
ui = root / "src" / "planner-ui.js"
manifest = root / "MANIFEST_SHA256.txt"
if not ui.is_file() or not manifest.is_file():
    raise SystemExit("No se reconoce el paquete PWA v1.19")
source = ui.read_text(encoding="utf-8")

def replace_exact(old, new, expected=1):
    global source
    count = source.count(old)
    if count != expected:
        raise SystemExit(
            f"Parche inseguro: esperaba {expected} apariciones de {old!r}; encontradas {count}"
        )
    source = source.replace(old, new)

# Sábado y domingo: primera sesión nueva, lunes.
replace_exact(
    "selectedDay=weekday(dateNow())%5",
    "selectedDay=(weekday(dateNow())<5?weekday(dateNow()):0)",
)
# El nombre del curso se puede personalizar: las fechas derivan de y.start.
replace_exact("y.name.slice(0,4)", "y.start.slice(0,4)", expected=4)
# No borrar una hora introducida a mano cuando se refresca el formulario.
replace_exact(
    "else if(!event)fields.time.value='';",
    "else if(!event&&previous&&!matches.some(s=>s.id===previous))fields.time.value='';",
)
# RFC 5545: normalizar CRLF/CR antes de escapar texto.
replace_exact(
    r"String(t||'').replace(/\\/g",
    r"String(t||'').replace(/\r\n?/g,'\n').replace(/\\/g",
)
# RFC 5545: plegar cada línea a un máximo de 75 octetos UTF-8.
replace_exact(
    "lines.push('END:VCALENDAR');const blob=",
    r"lines.push('END:VCALENDAR');const foldIcsLine=line=>{let out='',bytes=0;const encoder=new TextEncoder();for(const ch of line){const size=encoder.encode(ch).length;if(bytes+size>75){out+='\r\n ';bytes=1;}out+=ch;bytes+=size;}return out;};const blob=",
)
replace_exact(
    r"lines.join('\r\n')+'\r\n'",
    r"lines.map(foldIcsLine).join('\r\n')+'\r\n'",
)
ui.write_text(source, encoding="utf-8")

# Actualizar el manifiesto del paquete extraído, sin tocar el ZIP original.
newlines = []
changed = 0
for line in manifest.read_text(encoding="utf-8").splitlines(keepends=True):
    m = re.match(r"^([0-9a-fA-F]{64})(\s+)(\*?)(.+?)(\r?\n)?$", line)
    if not m:
        newlines.append(line)
        continue
    old_digest, whitespace, binary, filename, newline = m.groups()
    target = (root / filename).resolve()
    if not target.is_relative_to(root) or not target.is_file():
        raise SystemExit(f"Ruta del manifiesto no válida: {filename}")
    digest = hashlib.sha256(target.read_bytes()).hexdigest()
    changed += digest != old_digest
    newlines.append(digest + whitespace + binary + filename + (newline or ""))
if not changed:
    raise SystemExit("El manifiesto no contiene el módulo modificado")
manifest.write_text("".join(newlines), encoding="utf-8")
print("Aplicadas cuatro correcciones de agenda e iCalendar; hashes actualizados:", changed)
print("Configuración original del service worker:")
print((root / "sw.js").read_text(encoding="utf-8")[:1500])
