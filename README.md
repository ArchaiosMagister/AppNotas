# AppNotas · CuadernoDocente v1.19

**Repositorio público de código:** https://github.com/ArchaiosMagister/AppNotas

**Instalación principal de pruebas (origen HTTPS exclusivo):** https://appnotas-docente.pages.dev/

**GitHub Pages histórico:** https://archaiosmagister.github.io/AppNotas/ (no editar el mismo cuaderno desde ambos orígenes, porque no se sincronizan)

La aplicación permite llevar calificaciones, rúbricas, agenda docente y evaluación final. Conserva los cuadernos en IndexedDB en cada dispositivo y exporta ficheros cifrados con AES-256-GCM. GitHub **no almacena ni sincroniza** notas o cuadernos personales.

> **Privacidad:** trabajar con datos ficticios durante las pruebas. No incorporar al repositorio información identificativa de alumnado, calificaciones reales, contraseñas ni copias `.cuaderno` / `.cdoc`. La utilización institucional requiere las comprobaciones y autorizaciones aplicables.

## Estructura del repositorio

| Ruta | Contenido |
| --- | --- |
| [`app/`](app/) | **Fuente editable y canónica de la PWA**, incluidos `index.html`, `app.js`, `styles.css`, `sw.js` y `manifest.webmanifest` |
| [`app/src/`](app/src/) | Módulos separados: cálculos, modelo, agenda, almacenamiento, cifrado, UI, etc. |
| [`app/tests/`](app/tests/) | Pruebas originales, de seguridad, conservación y copias cifradas |
| [`app/icons/`](app/icons/), [`app/vendor/`](app/vendor/) y [`app/data/curriculos/`](app/data/curriculos/) | Recursos PWA, dependencia JSZip y fuentes curriculares |
| [`scripts/audit-v119.test.mjs`](scripts/audit-v119.test.mjs) | Seis pruebas de regresión específicas de agenda, ICS y caché |
| [`scripts/source_manifest.py`](scripts/source_manifest.py) | Verificar o recalcular SHA-256 de los archivos versionados |
| [`.github/workflows/pages.yml`](.github/workflows/pages.yml) | CI y despliegue de GitHub Pages **directamente desde `app/`** |
| [`releases/v1.19/`](releases/v1.19/) y [`releases/v1.17/`](releases/v1.17/) | Paquetes históricos **sin modificar**, para trazabilidad |
| [`payload/`](payload/) | Archivo histórico anterior; no interviene en el despliegue |
| [`scripts/export_source_tree.py`](scripts/export_source_tree.py) y [`scripts/apply_v119_audit.py`](scripts/apply_v119_audit.py) | Reproducción puntual de la migración desde el ZIP auditado; **no forman parte de la compilación normal** |

El código de `app/` se ha extraído de la v1.19 verificada, se ha aplicado la auditoría correctiva de agenda y se ha cotejado con el original. La arquitectura funcional y los algoritmos de calificación se mantienen.

El HTML `app/CuadernoDocente_sin_instalar.html` se conserva como **artefacto histórico autónomo**; la versión que publica Pages es la PWA construida a partir de `app/index.html` y sus módulos.

## Editar, comprobar y publicar cambios

Necesitas Python 3 y Node.js 22 (o versión compatible indicada en `app/package.json`).

```bash
# Después de editar, añadir o eliminar archivos dentro de app/:
python3 scripts/source_manifest.py --write

# Comprobar integridad y sintaxis:
python3 scripts/source_manifest.py --check
( cd app && sha256sum --check MANIFEST_SHA256.txt )
node --check app/src/planner-ui.js
node --check app/app.js
node --check app/sw.js

# Suite del cuaderno y 6 regresiones de agenda/PWA:
( cd app && npm test )
CUADERNO_ROOT=app node --test scripts/audit-v119.test.mjs
```

Abre una rama y una PR hacia `main`. GitHub Actions valida el manifiesto, ejecuta la batería completa de pruebas automatizadas, verifica los recursos necesarios y construye el sitio estático. **Solo cuando la PR pasa las comprobaciones y se fusiona en `main`**, el flujo despliega GitHub Pages y adjunta un ZIP de fuentes verificadas a la ejecución.

**Ya no se reconstruyen los ZIP fragmentados ni se ejecuta el parche de auditoría en cada despliegue.** Las correcciones están directamente en el código editable. Para futuras ediciones, conserva los tests de cálculos y cifrado y modifica el manifiesto mediante el script indicado.

## Auditoría de seguridad y conservación

Consulta [la auditoría del 21 de noviembre de 2026](SECURITY_AUDIT_2026-11-21.md). La auditoría original detectó el origen compartido de GitHub Pages como un riesgo. Desde entonces se ha desplegado y comprobado **Cloudflare Pages con origen HTTPS exclusivo**. El uso de datos reales sigue sujeto a la autorización del centro y los controles de seguridad aplicables.

En **Ajustes y copias** puedes comprobar y solicitar almacenamiento persistente. Es una protección complementaria contra ciertas eliminaciones automáticas, **no** una copia de seguridad. El cifrado y la restauración siguen siendo locales.

## Alojamiento con origen HTTPS exclusivo

El código sigue en este repositorio público. Para separar el almacenamiento local de las otras aplicaciones de GitHub Pages, hemos preparado una construcción estática en `dist/`, compatible con **Cloudflare Pages** y **Vercel**, y cabeceras HTTP de seguridad (`_headers` y `vercel.json`).

**Cloudflare Pages ya está conectado, desplegado y verificado** en https://appnotas-docente.pages.dev/. La versión histórica GitHub Pages se conserva, pero su IndexedDB es distinto y no se sincroniza; los cuadernos se trasladan solo mediante archivos cifrados verificados.

Consulta la [guía de alojamiento y migración](docs/ALOJAMIENTO_AISLADO_Y_MIGRACION.md).

La construcción habitual ahora se realiza con:

```bash
node scripts/build-static-site.mjs
node --test scripts/dedicated-hosting.test.mjs scripts/backup-origin-migration.test.mjs
```

Estas pruebas verifican que los recursos publicados coinciden con los archivos de la PWA, que no se filtran documentos personales en el sitio y que una **migración simulada** conserva las notas. La versión publicada en Cloudflare se ha cotejado con los archivos y cabeceras esperados; la restauración con datos de prueba también se ha comprobado en el iPad. Las nuevas funciones de reinicio seguro requieren comprobación manual antes de introducir datos reales.

## Política de copias cifradas externas

Consulta la [política de copias de seguridad](docs/POLITICA_COPIAS_CIFRADAS.md). La conservación de notas **no depende de Cloudflare o GitHub**: el cuaderno reside en IndexedDB y se recomienda mantener **dos copias cifradas en ubicaciones externas distintas**, renovadas al menos cada semana y después de cambios importantes.

En **Ajustes y copias** se distingue entre exportar un archivo portátil y **reabrirlo para comprobar su integridad y contraseña**. La verificación solo se registra para la misma revisión del cuaderno y no altera notas, rúbricas ni reglas. El indicador cambia cuando hay notas posteriores a la copia o pasan siete días sin comprobarla; no se afirma que la nube haya completado ninguna sincronización.

La copia histórica .cdoc se conserva como opción de rescate, separada del archivo portátil .cuaderno. El sistema **no realiza copias externas automáticas** sin intervención del usuario.

## Modo alumno y estabilidad de la PWA en iPad

- **Evaluaciones plegables** en el visor de cada alumno, con orden de actividades configurable por evaluación (categoría, orden del cuaderno, alfabético o últimas primero).
- **Rúbricas consultables** en el modo alumno: criterios individuales desplegables con nota, peso y descriptor del nivel cuando exista.
- **Devolución por faltas** a nivel de grupo académico: aplica a sus exámenes sin cambiar otros grupos ni revocar notas ya devueltas. Se conserva la personalización por actividad.
- **Enter sin salto de página** al introducir notas: se mantiene la posición de la tabla y se intenta conservar la del navegador al pasar a la siguiente casilla.
- **Safari/iPadOS:** el service worker normaliza las respuestas de navegación que hayan pasado por una redirección HTTP hacia la portada de la misma PWA, evitando que WebKit rechace ese contenido; los datos de IndexedDB no se borran.

Guía: [Modo alumno, penalización y error de Safari](docs/MEJORAS_IPAD_MODO_ALUMNO_Y_SAFARI.md).

## Identificación y orden del alumnado de optativas

Cada alumno dispone de campos **Apellidos**, **Nombre** y **Grupo de procedencia** (etiqueta de su clase de tutoría, independiente del grupo académico de la optativa). La tabla de notas y el resumen anual permiten ordenar por **apellidos (predeterminado)**, **nombre**, **grupo de procedencia y apellidos**, o **orden manual**. En la vista agrupada aparecen separadores con el número de alumnos y etiquetas visibles.

La importación CSV admite las columnas apellidos, nombre y grupo, y sigue aceptando el formato antiguo sin dividir automáticamente nombres históricos. Todas las identidades y notas permanecen cifradas en el cuaderno. Guía: [Alumnos de optativas, apellidos y orden de grupos](docs/ALUMNOS_OPTATIVA_ORDEN_Y_PROCEDENCIA.md).

## Crear un cuaderno vacío y reiniciar de forma segura

En una instalación sin datos, se puede elegir entre **Crear cuaderno vacío** (tres evaluaciones y categorías básicas, sin alumnos ni notas) y **Crear cuaderno de demostración** (ocho alumnos ficticios). Ambas opciones requieren contraseña y cifran el contenido solo en el dispositivo.

Para reiniciar un cuaderno ya existente, entrar en **Ajustes y copias → Empezar de cero**. Es obligatorio seleccionar y descifrar un archivo .cuaderno que corresponda exactamente a la última revisión, y escribir **REINICIAR**. La sustitución y el punto único de rescate cifrado se registran en una sola transacción, sin modificar otros dispositivos ni carpetas externas.

Guía paso a paso para iPad: [Empezar desde cero](docs/EMPEZAR_DESDE_CERO_IPAD.md).

## Paquete histórico y reproducibilidad

El ZIP original v1.19 sigue disponible sin cambios en `releases/v1.19/part_*.b64`, con SHA-256:

`85189a3b59a7e6829664d6b89fcb48b624761f963b023eb560fc0575861e8f29`

Para reproducir la extracción histórica en una carpeta vacía, usa `CUADERNO_OUTPUT_DIR=/ruta/temporal python3 scripts/export_source_tree.py`. No utilices ese procedimiento para editar o desplegar la PWA habitual.

## Comprobación manual aún necesaria

Antes de usar datos reales, probar con un cuaderno ficticio: entrada y cálculo de calificaciones, reglas Ítaca, excepciones individuales, exportación e importación cifrada, cierre y reapertura, funcionamiento sin conexión y actualización de la PWA en Safari de macOS, iPhone y iPad. Las pruebas automáticas no sustituyen esta verificación.
