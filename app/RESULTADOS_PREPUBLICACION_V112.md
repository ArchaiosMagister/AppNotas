# CuadernoDocente v1.12 · Tabularium — rediseño aprobado

**Fecha:** 21 de noviembre de 2026. **Estado:** prepublicación local, **sin actualizar GitHub**.
**Base:** ZIP original de CuadernoDocente v1.11 (cuarta auditoría). **Ámbito:** interfaz, estructura visual, navegación y recursos de presentación exclusivamente.

## Los nueve apartados aprobados

1. **Identidad clásica contemporánea.** Marca «CuadernoDocente / Tabularium», cabecera editorial, columna jónica esquemática y ornamentación geométrica muy discreta.
2. **Tipografía y motivos.** Titulares con serif nativa de estilo editorial; cifras, tablas y controles con fuentes de sistema. Sin dependencias externas ni fuentes descargadas.
3. **Navegación.** Barra lateral agrupada por Docencia, Evaluación y Recursos. Plegable en escritorio; horizontal desplazable en pantallas estrechas. Se conservan las ocho vistas anteriores y Evaluación final dentro del cuaderno.
4. **Cuaderno.** Reorganización de jerarquía visual, acciones claras, filas alternas legibles, cabecera y nombre del alumno fijos al desplazarse, notas y estadísticas intactas.
5. **Acento por asignatura.** Sigue leyendo exactamente los colores de preferencias existentes; se utiliza más consistentemente en cabeceras, selección, bordes, estados y tarjetas. El color de las **calificaciones** conserva su escala independiente.
6. **Planificador.** Estética de agenda académica, tarjetas de clase discretas y diferenciación neutral de guardias y reuniones. Sin nuevos campos de datos ni cambios en la programación.
7. **Formularios.** El editor «Nueva actividad» presenta secciones plegables nativas para escala/rúbrica y penalización ortográfica, con controles originales intactos. Se mejora la visibilidad de las acciones en diálogos largos.
8. **Claro / oscuro / OLED.** Marfil y piedra; grafito y bronce; negro absoluto en OLED, respectivamente. Selector original y colores de acento conservados.
9. **Detalles clásicos.** Pequeña greca geométrica en separadores, marca de columna y motivos discretos. Sin imágenes pesadas, animaciones obligatorias ni fondos que tapen las notas.

## Protección de notas y datos

- Los **16 archivos JavaScript del directorio `src/` son byte por byte idénticos** a los de v1.11, incluidos `model.js`, `calculations.js`, `statistics.js`, `vault.js`, `storage.js`, `rubric-xlsx.js` y `planner.js`.
- Los cuatro PDF curriculares, `server.mjs` y `vendor/jszip.min.js` tampoco se han modificado.
- La única lógica nueva en `app.js` es el estado **visual** de plegado de navegación, guardado bajo `localStorage` sin entrar en los datos académicos cifrados.
- No se han modificado fórmulas, redondeos, estadísticas, reglas por trimestre, vínculo de competencias, faltas, rúbricas, ni la estructura cifrada de las copias `.cdoc`.
- Se actualizó la versión de caché offline a `cuaderno-docente-static-v112-dev` para no reciclar recursos visuales anteriores.

## Verificación realizada

- **300/300 pruebas automáticas Node correctas** (294 previas + 6 nuevas de interfaz, navegación, tema y formularios).
- **Prueba visual aislada en Chromium con persistencia simulada:** Mac (1512×982, claro/oscuro/OLED), iPad (1024×768), iPhone (390×844), menú plegable, ocho rutas de navegación, períodos, cuaderno, planificador, rúbricas, ajustes y evaluación final.
- Editor de actividad: despliegue de las opciones, creación real de una actividad ficticia; **notas originales intactas**.
- Protección de cambios inválidos: se vuelve a rechazar la edición de penalización ortográfica que revocaría entregas, sin modificar las notas.
- Tarjetas de estadísticas: ratón, teclado, evaluación final, categorías y privacidad del modo alumno, sin errores JavaScript en la prueba.
- No hay desbordamiento horizontal del documento en los cinco tamaños probados. La tabla del cuaderno conserva desplazamiento horizontal propio.
- HTML autónomo: **17 módulos embebidos**, estilos íntegros y hashes CSP comprobados. Icono SVG original actualizado para la identidad visual.
- Archivo ZIP: manifiesto SHA-256 por archivo y equivalencia exacta con el HTML autónomo descargable.

## Límites y siguientes pruebas

Las pruebas con Chromium usaron un documento ficticio **en memoria**, no IndexedDB ni persistencia real de Safari. El HTML `file://` puede tener limitaciones propias de Safari, y la importación, reapertura y restauración de copias cifradas necesitan prueba manual en Mac real. Tampoco constituye una auditoría independiente de protección de datos.

Antes de probar: conservar copia cifrada `.cdoc` del cuaderno anterior. Usar **únicamente alumnos ficticios**. No publicar ni tratar calificaciones reales antes de completar las comprobaciones y obtener aprobación expresa.
