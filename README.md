# AppNotas · CuadernoDocente v1.17 (pruebas)

**Repositorio público de código de una PWA docente. No almacena cuadernos personales, contraseñas, notas de alumnos ni ficheros de copia cifrada.** Los ejemplos incluidos en el ZIP son ficticios. **No introducir calificaciones reales** hasta completar las pruebas en dispositivos físicos y la evaluación del centro.

## Versión publicada

Se conserva íntegra la versión histórica v1.0-rc1 en `payload/`. La nueva versión v1.17 está contenida en el ZIP original, fragmentado en `releases/v1.17/part_*.b64` para su transferencia verificable. Los fragmentos son código y recursos de pruebas, no datos docentes.

SHA-256 del ZIP v1.17:
`b90c00e31a723756387b53309ff5a2bcd82787eca23461f23d9c50481fcf81be`.

Para recuperar las fuentes completas:

```bash
cat releases/v1.17/part_*.b64 | base64 --decode > CuadernoDocente_v1.17.zip
echo 'b90c00e31a723756387b53309ff5a2bcd82787eca23461f23d9c50481fcf81be  CuadernoDocente_v1.17.zip' | sha256sum --check
unzip CuadernoDocente_v1.17.zip
cd CuadernoDocente_v1.17-prepublicacion
sha256sum -c MANIFEST_SHA256.txt
npm test
```

## Web de pruebas

URL prevista de GitHub Pages (solo si la acción termina correctamente):
https://archaiosmagister.github.io/AppNotas/

La publicación reconstruye y verifica el ZIP, pasa las pruebas `npm test` y despliega únicamente la PWA estática (`index.html`, CSS, JS, módulos, librería local, manifiesto, service worker y recursos curriculares). No se publica ninguna base IndexedDB, ni copias `.cuaderno` o `.cdoc`.

Si la configuración inicial de Pages falla con `Resource not accessible by integration`, abrir **Settings → Pages**, elegir **GitHub Actions** como origen y volver a ejecutar el workflow. GitHub Pages es accesible públicamente incluso cuando los datos del cuaderno permanecen exclusivamente en cada dispositivo.

## Pruebas propuestas

1. Crear un cuaderno solo con alumnos ficticios en un dispositivo.
2. Introducir puntuaciones, rúbricas y reglas de ponderación; confirmar que los cálculos se mantienen.
3. Pulsar **Cerrar cuaderno** para obtener un archivo `.cuaderno` cifrado y comprobar la ubicación de guardado.
4. Abrirlo en otro dispositivo con **Abrir cuaderno**, introducir la contraseña, revisar el resumen y confirmar.
5. Probar contraseña equivocada, archivo alterado, copias antiguas y conflictos entre dispositivos.
6. Comprobar que una cancelación nunca borra las notas locales, y que la PWA funciona sin conexión tras instalarse.

La v1.17 conserva almacenamiento local IndexedDB y cifra los archivos antes de descargarlos. **El sitio público no es un control de acceso a la aplicación** y el cifrado de las copias no sustituye a las políticas de protección de dispositivos o autorización institucional.
