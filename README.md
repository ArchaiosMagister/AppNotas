# AppNotas · CuadernoDocente v1.19

**Repositorio público de código:** https://github.com/ArchaiosMagister/AppNotas

**Alojamiento oficial exclusivo (Cloudflare Pages):** https://appnotas-docente.pages.dev/

**GitHub Pages histórico:** la publicación automática se ha retirado de GitHub Actions. Para dar de baja el despliegue antiguo existente, un administrador debe elegir «Unpublish site» en [Settings → Pages](https://github.com/ArchaiosMagister/AppNotas/settings/pages). Mientras esa acción no se complete, la URL antigua puede seguir accesible; **no utilizarla para trabajar con cuadernos** porque su almacenamiento no se sincroniza con Cloudflare.

La aplicación permite llevar calificaciones, rúbricas, agenda docente y evaluación final. Conserva los cuadernos en IndexedDB en cada dispositivo y exporta ficheros cifrados con AES-256-GCM. GitHub **no almacena ni sincroniza** notas o cuadernos personales.

> **Privacidad:** trabajar con datos ficticios durante las pruebas. No incorporar al repositorio información identificativa de alumnado, calificaciones reales, contraseñas ni copias `.cuaderno` / `.cdoc`. La utilización institucional requiere las comprobaciones y autorizaciones aplicables.


## Tutorías comunes y alumnos que cursan varias materias (nueva función)

En **Agenda docente → Sesiones de evaluación** se ofrece una sección «Alumnos vinculados y tutorías comunes»:

- Detecta posibles coincidencias de nombres entre asignaturas del mismo curso y etapa; **ninguna vinculación es automática**. Debe confirmarse manualmente; se puede desvincular.
- Permite crear tutorías comunes a partir de procedencias coincidentes (como 1.º BACH A/B) o asignarlas manualmente. Las asignaturas mantienen sus listas de clase y notas independientes.
- Una convocatoria puede pertenecer a la tutoría compartida; las citas anteriores deben **reconciliarse explícitamente**. La selección de una fecha y hora archiva íntegramente las convocatorias anteriores en el cuaderno cifrado.
- «Ver notas» muestra una fila por identidad confirmada, una columna por asignatura y la nota decimal y Nota Ítaca de cada matrícula. «—» representa ausencia de matrícula o calificación, nunca cero. El desglose es solo de lectura.
- Las estructuras antiguas de cuaderno (esquema v8) siguen abriéndose; los nuevos vínculos son opcionales y los cálculos originales no se alteran.

Antes de utilizar los nuevos vínculos con datos reales, guardar y verificar una copia cifrada del cuaderno. Se aconseja revisar visualmente coincidencias, tutorías y convocatorias con datos ficticios tras actualizar la PWA.

## Estructura del repositorio

| Ruta | Contenido |
| --- | --- |
| [`app/`](app/) | **Fuente editable y canónica de la PWA**, incluidos `index.html`, `app.js`, `styles.css`, `sw.js` y `manifest.webmanifest` |
| [`app/src/`](app/src/) | Módulos separados: cálculos, modelo, agenda, almacenamiento, cifrado, UI, etc. |
| [`app/tests/`](app/tests/) | Pruebas originales, de seguridad, conservación y copias cifradas |
| [`app/icons/`](app/icons/), [`app/vendor/`](app/vendor/) y [`app/data/curriculos/`](app/data/curriculos/) | Recursos PWA, dependencia JSZip y fuentes curriculares |
| [`scripts/audit-v119.test.mjs`](scripts/audit-v119.test.mjs) | Seis pruebas de regresión específicas de agenda, ICS y caché |
| [`scripts/source_manifest.py`](scripts/source_manifest.py) | Verificar o recalcular SHA-256 de los archivos versionados |
| [`.github/workflows/pages.yml`](.github/workflows/pages.yml) | CI de GitHub Actions: auditoría, pruebas, compilación verificable para Cloudflare y ZIP de fuentes; **sin despliegue en GitHub Pages** |
| [`releases/v1.19/`](releases/v1.19/) y [`releases/v1.17/`](releases/v1.17/) | Paquetes históricos **sin modificar**, para trazabilidad |
| [`payload/`](payload/) | Archivo histórico anterior; no interviene en el despliegue |
| [`scripts/export_source_tree.py`](scripts/export_source_tree.py) y [`scripts/apply_v119_audit.py`](scripts/apply_v119_audit.py) | Reproducción puntual de la migración desde el ZIP auditado; **no forman parte de la compilación normal** |

El código de `app/` se ha extraído de la v1.19 verificada, se ha aplicado la auditoría correctiva de agenda y se ha cotejado con el original. La arquitectura funcional y los algoritmos de calificación se mantienen.

El HTML `app/CuadernoDocente_sin_instalar.html` se conserva como **artefacto histórico autónomo**; Cloudflare Pages publica la PWA construida a partir de `app/index.html` y sus módulos.

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

Abre una rama y una PR hacia `main`. GitHub Actions valida el manifiesto, ejecuta la batería completa de pruebas automatizadas, verifica recursos y construye el sitio estático en `dist/`. **Tras fusionar una PR en `main`**, la integración Git de Cloudflare Pages despliega automáticamente la nueva versión; GitHub Actions solo verifica y adjunta un ZIP de fuentes auditadas. **No se publica nada en GitHub Pages.**

**Ya no se reconstruyen los ZIP fragmentados ni se ejecuta el parche de auditoría en cada despliegue.** Las correcciones están directamente en el código editable. Para futuras ediciones, conserva los tests de cálculos y cifrado y modifica el manifiesto mediante el script indicado.

## Auditoría de seguridad y conservación

Consulta [la auditoría del 21 de noviembre de 2026](SECURITY_AUDIT_2026-11-21.md). La auditoría original detectó el origen compartido de GitHub Pages como un riesgo. Desde entonces se ha desplegado y comprobado **Cloudflare Pages con origen HTTPS exclusivo**. El uso de datos reales sigue sujeto a la autorización del centro y los controles de seguridad aplicables.

En **Ajustes y copias** puedes comprobar y solicitar almacenamiento persistente. Es una protección complementaria contra ciertas eliminaciones automáticas, **no** una copia de seguridad. El cifrado y la restauración siguen siendo locales.

## Alojamiento con origen HTTPS exclusivo

El código sigue en este repositorio público. Para separar el almacenamiento local de las otras aplicaciones de GitHub Pages, hemos preparado una construcción estática en `dist/`, compatible con **Cloudflare Pages** y **Vercel**, y cabeceras HTTP de seguridad (`_headers` y `vercel.json`).

**Cloudflare Pages está conectado como único alojamiento oficial** en https://appnotas-docente.pages.dev/. GitHub Pages ya no recibe nuevas publicaciones desde este repositorio; para retirar su último despliegue hay que despublicar el sitio en los ajustes de GitHub. Si aún conservas un cuaderno únicamente en el origen histórico, expórtalo, verifica su archivo cifrado y restáuralo en Cloudflare **antes de despublicar**: los dos IndexedDB no se sincronizan.

Consulta la [guía de alojamiento y migración](docs/ALOJAMIENTO_AISLADO_Y_MIGRACION.md).

La construcción habitual ahora se realiza con:

```bash
node scripts/build-static-site.mjs
node --test scripts/dedicated-hosting.test.mjs scripts/backup-origin-migration.test.mjs scripts/cloudflare-only.test.mjs
```

Estas pruebas verifican que los recursos publicados coinciden con los archivos de la PWA, que no se filtran documentos personales en el sitio y que una **migración simulada** conserva las notas. La versión publicada en Cloudflare se ha cotejado con los archivos y cabeceras esperados; la restauración con datos de prueba también se ha comprobado en el iPad. Las nuevas funciones de reinicio seguro requieren comprobación manual antes de introducir datos reales.

## Política de copias cifradas externas

Consulta la [política de copias de seguridad](docs/POLITICA_COPIAS_CIFRADAS.md). La conservación de notas **no depende de Cloudflare o GitHub**: el cuaderno reside en IndexedDB y se recomienda mantener **dos copias cifradas en ubicaciones externas distintas**, renovadas al menos cada semana y después de cambios importantes.

En **Ajustes y copias** se distingue entre exportar un archivo portátil y **reabrirlo para comprobar su integridad y contraseña**. La verificación solo se registra para la misma revisión del cuaderno y no altera notas, rúbricas ni reglas. El indicador cambia cuando hay notas posteriores a la copia o pasan siete días sin comprobarla; no se afirma que la nube haya completado ninguna sincronización.

La copia histórica .cdoc se conserva como opción de rescate, separada del archivo portátil .cuaderno. El sistema **no realiza copias externas automáticas** sin intervención del usuario.

## Reorganización de interfaz para iPad y móvil

La navegación principal da acceso a **Cuaderno**, **Agenda**, **Evaluaciones** y **Recursos**. En Recursos están **Currículo**, **Rúbricas** y **Ajustes y copias**. El menú **Aplicación** de la cabecera reúne el tema, la apertura de cuadernos, la instalación, las actualizaciones y el historial de cambios. **Cerrar cuaderno** y **Bloquear** quedan visibles.

En **Cuaderno**, elige la materia y el grupo y pasa de **Notas** a **Cálculos**, **Competencias**, **Evaluación final** o **Vista alumno**. Los períodos aparecen en Notas. **+ Alumno** y **+ Actividad** están junto a **Acciones de la tabla**, donde se importa alumnado por CSV, se crean recuperaciones, se copian actividades y se programan exámenes. **Ítaca y procedencias** reúne los ajustes de redondeo y de tutorías de origen. **Materias y grupos** contiene la gestión de materias, los grupos y la vinculación de alumnado entre asignaturas.

**Agenda** usa su propio selector de curso académico. **Evaluaciones** conserva el acceso a las materias y grupos.

## Observaciones individuales por calificación

Cada casilla de calificación (normal, examen con penalización ortográfica o rúbrica) incluye un botón **«Obs.»**. Puedes escribir un comentario libre de hasta **1500 caracteres** sobre el alumno y esa actividad, por ejemplo «Realizó el examen en otra fecha» o «Llegó tarde». El indicador queda resaltado cuando existe comentario. Las observaciones son **independientes de la nota**: no modifican medias, porcentajes, Nota Ítaca ni resultados, y permanecen al cambiar o borrar una nota, marcar NP/AJ o modificar una rúbrica. También pueden anotarse antes de calificar.

Para usarlo en iPad: abre **Cuaderno de notas**, busca la casilla correspondiente al alumno y la actividad, pulsa **Obs.**, escribe el comentario y guarda. El botón resaltado indica que existe una observación. Puedes pulsarlo de nuevo para editarla; **guardar el texto vacío la elimina**.

Por privacidad, cada observación es **solo docente de forma predeterminada**. Si marcas expresamente **«Mostrar también en el modo alumno»**, aparece en un desplegable de solo lectura debajo de esa actividad en la ficha del alumno correspondiente. No se muestran observaciones privadas ni las de otros alumnos. Las observaciones son texto plano escapado (no ejecutan HTML), sin sugerencias automáticas y con saltos de línea preservados.

Se guardan **cifradas dentro del cuaderno y de sus copias .cuaderno**. Los cuadernos antiguos sin observaciones siguen siendo compatibles. Al eliminar el alumno o la actividad se eliminan sus comentarios vinculados. El botón de deshacer permite recuperar cambios durante la sesión; se recomiendan copias cifradas verificadas antes de cambios importantes.

## Colores de categoría también en el modo alumno

El **Modo alumno** utiliza los mismos colores que el cuaderno docente para los bloques y actividades de cada evaluación. Con el orden **Por categoría**, se tiñe el bloque de la categoría y se destaca cada actividad; con órdenes **del cuaderno, alfabético o últimas primero**, se colorea cada actividad según su categoría, aunque estén intercaladas. Los colores personalizados se comparten automáticamente y no se configuran dos veces.

La nota numérica mantiene sus colores semánticos por rango; las rúbricas y los detalles desplegables conservan su lectura. En oscuro se usan fondos suaves y en OLED permanece el negro, con bandas coloreadas. Todo es visual: no cambia notas, competencias, pesos ni datos personales.

## Colores de columnas por categoría

En **Cuaderno de notas**, todas las actividades de una misma categoría comparten color en su **cabecera y celdas**: Exámenes (azul), Trabajos (ámbar) y Actitud (verde) de forma predeterminada. Las categorías personalizadas reciben un color estable según su nombre. La correspondencia no depende de que las columnas estén juntas ni de la evaluación.

Los colores se personalizan desde **Cálculos → Color de columnas**. **Color predeterminado** restablece el tono de esa categoría (no deja la columna sin identificar); el cambio se guarda cifrado con el cuaderno. Los colores de nota por rango 0–10 se mantienen en los chips y entradas y **no se sustituyen por el color de categoría**.

Los temas claro y oscuro utilizan fondos de columna diferenciados; el tema OLED conserva los fondos negros con bandas verticales y cabeceras coloreadas. Se aplican los colores mediante CSSOM para respetar la política de seguridad CSP, sin estilos HTML bloqueados.

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

## Aceptación docente de v1.0 y cautelas de uso

El 22/11/2026 el usuario validó **las nueve comprobaciones** en la vista previa de Cloudflare de la PR #27 con datos ficticios, sin comunicar incidencias: desbloqueo, guía, nombres y botones, vista individual, catálogo seguro de materias, horario editable con siete clases y dos patios, currículo/escala competencial, verificación y restauración de copia cifrada en otro navegador o dispositivo de prueba y trabajo offline tras cerrar y reabrir. Confirmó también legibilidad en temas claro, oscuro y OLED.

La aceptación docente **no equivale a una auditoría independiente de seguridad**. Para los datos académicos reales se deben respetar las instrucciones del centro, trabajar solo en dispositivos autorizados y conservar las copias cifradas en soportes locales **no sincronizados**; una carpeta de iCloud Drive, OneDrive o Google Drive no cumple la condición de almacenamiento exclusivamente local. La aplicación sirve archivos estáticos desde Cloudflare y almacena los cuadernos cifrados en el dispositivo. Una contraseña perdida no se puede recuperar.

La versión de producción se despliega **solo en Cloudflare Pages** desde `main`. El contenido de vistas previas de otras ramas pertenece a otro origen y **no se traslada** automáticamente al sitio oficial. Ante actualizaciones importantes, exportar, verificar y conservar una copia local antes de modificar el cuaderno.
