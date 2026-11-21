#!/usr/bin/env python3
"""Comprueba o actualiza el manifiesto de fuentes versionadas en app/.

Uso:
  python3 scripts/source_manifest.py --check  # sin modificar archivos
  python3 scripts/source_manifest.py --write  # después de cambiar fuentes
"""
from __future__ import annotations
import argparse
import hashlib
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1] / "app"
MANIFEST = ROOT / "MANIFEST_SHA256.txt"
REJECT_NAMES = {".env", ".env.local", ".env.production", "id_rsa", "id_ed25519"}
REJECT_EXT = {".cuaderno", ".cdoc", ".db", ".sqlite", ".sqlite3", ".pem", ".pfx", ".p12", ".key"}
REJECT_PARTS = {".git", "node_modules", ".venv", "__pycache__", ".ssh"}

def inventory():
    if not ROOT.is_dir() or not MANIFEST.is_file():
        raise SystemExit("Falta app/ o su manifiesto")
    paths = [path for path in ROOT.rglob("*") if path.is_file() and path != MANIFEST]
    for path in paths:
        rel = path.relative_to(ROOT)
        if (any(part in REJECT_PARTS for part in rel.parts) or
                rel.name.lower() in REJECT_NAMES or rel.suffix.lower() in REJECT_EXT):
            raise SystemExit(f"Se ha detectado un archivo potencialmente privado: {rel}")
    return sorted(paths, key=lambda path: path.relative_to(ROOT).as_posix())

def build_manifest():
    rows = []
    for path in inventory():
        relative = path.relative_to(ROOT).as_posix()
        if "\n" in relative or "\r" in relative:
            raise SystemExit("Nombre de archivo inválido")
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        rows.append(f"{digest}  {relative}\n")
    return "".join(rows), len(rows)

def main():
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--check", action="store_true")
    group.add_argument("--write", action="store_true")
    args = parser.parse_args()
    expected, count = build_manifest()
    if args.check:
        actual = MANIFEST.read_text(encoding="utf-8")
        if actual != expected:
            raise SystemExit("Manifiesto desactualizado: ejecuta python3 scripts/source_manifest.py --write")
        print(f"Manifiesto e inventario correctos: {count} archivos")
    else:
        MANIFEST.write_text(expected, encoding="utf-8")
        print(f"Manifiesto recalculado: {count} archivos")

if __name__ == "__main__":
    main()
