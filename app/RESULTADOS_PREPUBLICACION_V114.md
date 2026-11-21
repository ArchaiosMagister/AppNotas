# CuadernoDocente v1.14 · Tabularium — Informe de prepublicación

Fecha: 21 de noviembre de 2026. **No se ha publicado en GitHub.** Fuente: ZIP v1.13 adjuntado por el usuario.

## Modificaciones solicitadas

1. **Estadísticas por pulsación (ⓘ).** La tarjeta de media de clase, aprobados, porcentaje y número de alumnos con nota ya no se abre al pasar el ratón por el icono ni por la cabecera de la actividad, al enfocar un indicador o por desplazamiento. Se abre solo con clic, toque o activación de botón con teclado. Se cierra al volver a pulsar, pulsar fuera, pulsar Escape, desplazarse o cambiar de vista. Se conserva para actividades, categorías, competencias y evaluaciones trimestrales y final.
2. **Modo alumno con listado propio.** Muestra exclusivamente la lista de alumnos del grupo seleccionado. El nombre pulsable abre su ficha individual de calificaciones, medias por categorías y evaluaciones, y nota final del curso. «Anterior» y «Siguiente» avanzan en el orden del grupo sin mostrar los nombres de otros alumnos, quedando deshabilitados en los extremos. «Volver al listado» regresa al listado del grupo. El enlace «Ver» del cuaderno sigue funcionando.
3. **Diseño y accesibilidad.** Respeta los tres temas y acentos configurados. Controles táctiles con tamaños adecuados y estados `aria-expanded`, `aria-controls`, etiquetas y gestión de Escape. Se incluyen capturas de las pruebas en `qa/v114_capturas/`.
4. **Offline.** Se ha actualizado la versión de caché tanto en `sw.js` como en `app.js` para evitar mezclar recursos de versiones anteriores.

## Garantía de no modificación de reglas

Los **16 módulos de `src/` son idénticos, byte a byte**, a los del ZIP v1.13 original; no se han modificado cálculos, rúbricas, modelo de calificaciones, definición de NP, penalizaciones ortográficas, almacenamiento ni cifrado. Tampoco se ha cambiado el esquema del documento.

El nuevo «Modo alumno» utiliza `overallGrade`, `categoryGrade`, `finalGrade`, `effectiveAssessmentScore` y la presentación original de rúbricas, NP y faltas sin reimplementarlas. La navegación y apertura de estadísticas no invocan operaciones de guardado.

## Pruebas

- **311/311 pruebas Node**, incluidas 6 nuevas para esta versión y regresiones anteriores de cálculo, modelo, persistencia y seguridad.
- **Navegador Chromium instrumentado:** hover sobre ⓘ no abre; clic/teclado abre; doble clic/Escape/pulsación fuera cierra. Sin errores JavaScript.
- **Listado y navegación:** recorrido de los 8 alumnos ficticios, extremos deshabilitados, anterior/siguiente, vuelta al listado y acceso «Ver» desde el cuaderno; comprobación de que no aparecen los nombres de otros alumnos en la ficha individual.
- **Conservación:** comparación `JSON.stringify(doc)` antes y después de toda la navegación, cambios de tema y consulta de estadísticas, sin modificaciones; NP sigue visible y computa 0.
- **Táctil Chromium emulado:** apertura de estadísticas y navegación con `.tap()` en 390 px, sin desbordamiento horizontal; contraste visual de los temas claro, oscuro y OLED.
- **Versión autónoma:** 17 módulos JS incluidos, 4 PDFs de currículo incrustados, JSZip incrustado; hashes SHA-256 de CSP verificados por la batería de pruebas.

## Limitaciones y aceptación pendientes

- El entorno bloquea abrir directamente `file://` en Chromium (`ERR_BLOCKED_BY_ADMINISTRATOR`). Por tanto **no se ha verificado la persistencia real con doble clic en Safari**, ni la restauración tras cerrar y reabrir Safari en ese esquema.
- Las pruebas de navegador de la interfaz se han hecho con un HTML instrumentado con persistencia simulada; el HTML entregado por separado es la compilación no instrumentada y se ha verificado criptográficamente en las pruebas de empaquetado. **No debe interpretarse la simulación como prueba de almacenamiento real.**
- No se ha efectuado ningún cambio en el repositorio privado ni publicación.

## Recomendación de aceptación

Probar con alumnado ficticio: abrir en Safari; comprobar apertura de estadísticas solo mediante ⓘ, listado y navegación por alumnos, notas NP, y guardado/cierre/reapertura/restauración de copia `.cdoc`. Conservar una copia cifrada antes de cambiar de edición.
