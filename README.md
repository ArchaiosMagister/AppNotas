# CuadernoDocente · v1.0-rc1

**Candidata para pruebas en Safari macOS, iPhone y iPad, con datos ficticios exclusivamente.** No introducir datos reales del alumnado hasta completar las pruebas y la revisión institucional.

## Versión y procedencia

Este repositorio es privado y contiene una copia **íntegra y verificable** del ZIP original `CuadernoDocente_v1.0-rc1.zip`. La transferencia se realizó como 22 fragmentos Base64 en `payload/part_*.b64` por los límites del conector. El flujo de GitHub Actions los une y comprueba el SHA-256 antes de ejecutar pruebas y desplegar el sitio.

SHA-256 del ZIP original: `105162db702e5205bd307db8f48e9e975b480cf6105ce27eb31ccd72525af6be`.

Los archivos del ZIP —código JavaScript, CSS, datos curriculares, pruebas, documentos y PDFs— se recuperan **sin modificaciones** mediante:

```bash
cat payload/part_*.b64 | base64 --decode > CuadernoDocente_v1.0-rc1.zip
unzip CuadernoDocente_v1.0-rc1.zip
cd CuadernoDocente_v1.0-rc1
sha256sum -c MANIFEST_SHA256.txt
npm test
```

## Prueba de la webapp en dispositivos reales

El flujo `.github/workflows/pages.yml` reconstruye el ZIP, verifica los archivos, ejecuta **133 pruebas automatizadas** y genera el sitio estático. Si la cuenta permite GitHub Pages desde un repositorio privado, intenta habilitar y publicar la web de prueba. Comprueba el resultado en **Actions** y en **Settings → Pages**. En caso de requerir activación manual, selecciona **GitHub Actions** como origen de publicación.

**Importante: GitHub Pages puede ser público aunque el repositorio sea privado.** La URL web prevista, si se habilita y despliega correctamente, es `https://archaiosmagister.github.io/AppNotas/`; no debe darse por operativa sin comprobar el workflow. El código distribuido es estático y los datos del cuaderno se guardan cifrados localmente en cada navegador. No se sincronizan notas entre dispositivos.

Para repetir las pruebas, consulta `qa/PROTOCOLO_SAFARI.md` y `docs/ESTABILIZACION_RC1.md` dentro del ZIP. Las pruebas en dispositivos físicos están pendientes. La prueba de persistencia de un navegador no demuestra persistencia en los demás: cada origen y cada navegador mantiene su propio almacenamiento.

## Descarga del ZIP íntegro

Una ejecución correcta del workflow en `main` publica el ZIP original como artefacto `CuadernoDocente_v1.0-rc1-original` en **Actions → Validate and publish CuadernoDocente RC1 → última ejecución → Artifacts**. Ese artefacto requiere acceso autorizado al repositorio.
