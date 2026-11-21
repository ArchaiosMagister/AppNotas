#!/usr/bin/env python3
"""Extrae UNA VEZ el árbol de fuentes v1.19 desde el ZIP verificado.

No altera releases/, payload/, ni las versiones anteriores. La PWA se reconstruirá
desde app/ después de la migración. No utilizar para despliegues habituales.
"""
from __future__ import annotations

import base64
import hashlib
import os
from pathlib import Path, PurePosixPath
import shutil
import stat
import subprocess
import sys
import tempfile
import zipfile

REPO = Path(__file__).resolve().parents[1]
DEST = REPO / "app"
PARTS = sorted((REPO / "releases" / "v1.19").glob("part_*.b64"))
EXPECTED_SHA = "85189a3b59a7e6829664d6b89fcb48b624761f963b023eb560fc0575861e8f29"
PREFIX = "CuadernoDocente_v1.19-prepublicacion"
FORBIDDEN_SUFFIXES = {".cuaderno", ".cdoc", ".sqlite", ".sqlite3", ".db", ".pem", ".p12", ".pfx", ".key", ".jks"}
FORBIDDEN_NAMES = {".env", ".env.local", ".env.production", "id_rsa", "id_ed25519", ".ds_store"}
FORBIDDEN_PARTS = {"node_modules", ".git", "__pycache__", ".venv", "venv", ".ssh"}
MAX_UNCOMPRESSED = 140_000_000


def assert_safe_archive(archive: zipfile.ZipFile) -> None:
    seen = set()
    total = 0
    for entry in archive.infolist():
        path = PurePosixPath(entry.filename)
        parts = path.parts
        if (
            path.is_absolute()
            or not parts
            or parts[0] != PREFIX
            or ".." in parts
            or any(p.lower() in FORBIDDEN_PARTS for p in parts)
            or any(p.lower() in FORBIDDEN_NAMES for p in parts)
            or Path(entry.filename).suffix.lower() in FORBIDDEN_SUFFIXES
        ):
            raise SystemExit(f"Archivo peligroso o inesperado: {entry.filename}")
        if entry.filename in seen:
            raise SystemExit(f"Ruta duplicada en ZIP: {entry.filename}")
        seen.add(entry.filename)
        mode = (entry.external_attr >> 16) & 0xFFFF
        if stat.S_ISLNK(mode):
            raise SystemExit(f"Enlace simbólico prohibido: {entry.filename}")
        total += entry.file_size
    if total > MAX_UNCOMPRESSED:
        raise SystemExit(f"ZIP excede el límite de expansión: {total:,} bytes")
    print(f"Inventario seguro: {len(seen)} entradas, {total:,} bytes descomprimidos")
    for entry in archive.infolist():
        if not entry.is_dir():
            print("  ", entry.filename)


def main():
    if DEST.exists():
        raise SystemExit("app/ ya existe: no se sobrescribe el árbol de fuentes")
    if len(PARTS) != 65:
        raise SystemExit(f"Se esperaban 65 fragmentos v1.19; encontrados {len(PARTS)}")
    with tempfile.TemporaryDirectory(prefix="appnotas-source-") as directory:
        tmp = Path(directory)
        zip_path = tmp / "source.zip"
        checksum = hashlib.sha256()
        with zip_path.open("wb") as output:
            carry = ""
            for part in PARTS:
                data = (carry + part.read_text(encoding="ascii")).strip()
                valid_length = (len(data) // 4) * 4
                block, carry = data[:valid_length], data[valid_length:]
                if block:
                    raw = base64.b64decode(block, validate=True)
                    output.write(raw)
                    checksum.update(raw)
            if carry:
                raw = base64.b64decode(carry, validate=True)
                output.write(raw)
                checksum.update(raw)
        actual_sha = checksum.hexdigest()
        if actual_sha != EXPECTED_SHA:
            raise SystemExit(f"SHA-256 del ZIP no coincide: {actual_sha}")
        print("SHA-256 ZIP original: verificado", actual_sha)
        with zipfile.ZipFile(zip_path) as archive:
            assert_safe_archive(archive)
            archive.extractall(tmp / "extract")
        source = tmp / "extract" / PREFIX
        if not source.is_dir():
            raise SystemExit("No se encontró el directorio esperado del ZIP")
        subprocess.run(["sha256sum", "--check", "MANIFEST_SHA256.txt"], cwd=source, check=True, stdout=subprocess.DEVNULL)
        subprocess.run([sys.executable, str(REPO / "scripts" / "apply_v119_audit.py"), str(source)], check=True)
        subprocess.run(["sha256sum", "--check", "MANIFEST_SHA256.txt"], cwd=source, check=True, stdout=subprocess.DEVNULL)
        required = [
            "index.html", "styles.css", "app.js", "sw.js", "manifest.webmanifest",
            "package.json", "src/planner-ui.js", "src/calculations.js",
            "src/storage.js", "src/cuaderno.js", "tests",
            "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png",
            "vendor/jszip.min.js", "data/curriculos/lat4.pdf",
            "data/curriculos/gr1y2-nuevo.pdf", "data/curriculos/lat1y2-nuevo.pdf",
            "data/curriculos/lat2-2022.pdf",
        ]
        for rel in required:
            if not (source / rel).exists():
                raise SystemExit("Falta un archivo necesario: " + rel)
        shutil.copytree(source, DEST, symlinks=False)
        subprocess.run(["sha256sum", "--check", "MANIFEST_SHA256.txt"], cwd=DEST, check=True, stdout=subprocess.DEVNULL)
        print("Fuentes migradas a app/ con manifiesto íntegro.")
        print("No se ha modificado el paquete original de releases/v1.19.")
        print("Comparación exacta de archivos (pre/post extracción):")
        original = {p.relative_to(source): hashlib.sha256(p.read_bytes()).hexdigest() for p in source.rglob("*") if p.is_file()}
        copied = {p.relative_to(DEST): hashlib.sha256(p.read_bytes()).hexdigest() for p in DEST.rglob("*") if p.is_file()}
        if copied != original:
            raise SystemExit("ERROR: el árbol migrado no coincide byte a byte con el reparado")
        print(f"{len(copied)} archivos idénticos, sin pérdida de datos.")


if __name__ == "__main__":
    main()
