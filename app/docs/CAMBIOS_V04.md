# CuadernoDocente v0.4 — edición visual de rúbricas e historial reversible

## Novedades funcionales

- El editor de rúbricas utiliza **filas con campos separados** para nombre de criterio, máximo y peso. Permite añadir y quitar criterios hasta un máximo de 40, valida nombres, límites y pesos, y presenta el peso relativo acumulado. Se mantiene la importación CSV/JSON.
- Las rúbricas que ya tienen calificaciones quedan protegidas contra edición. El botón **Duplicar** crea otra rúbrica con identificadores nuevos; no altera las notas existentes ni recalcula retrospectivamente las valoraciones.
- El formulario de calificación con rúbrica incluye **previsualización de 0–10 sin redondeos intermedios**, indicador de criterios completados, intervalo posible para criterios pendientes y botones rápidos «0», «½» y «Máx.». Es obligatorio completar todos los criterios. Se distingue el cero real del campo vacío.
- **Guardar y siguiente alumno** permite encadenar valoraciones, conservando la confirmación individual antes de avanzar. **Borrar nota** tiene confirmación y es reversible mediante Deshacer.
- **Deshacer/Rehacer** revierte operaciones realizadas en esta sesión, incluidas notas, borrados de actividades y sus calificaciones, edición de reglas, rubricas, periodos y ajustes. Se conserva un máximo de 30 estados anteriores (y 30 de rehacer). Los atajos **Ctrl/Cmd+Z** y **Ctrl/Cmd+Mayús+Z** funcionan si el foco no está editando un campo; la edición nativa de texto conserva sus atajos.
- La secuencia de cambios está **serializada** y se valida el modelo y se escribe correctamente la copia cifrada antes de confirmar cada cambio en pantalla. Si guardar falla, no se marca el cambio como confirmado.

## Alcance y limitaciones de Deshacer

El historial existe **solamente en memoria** mientras el cuaderno esté desbloqueado. Se borra al bloquear, restaurar una copia o volver a abrir la aplicación; no forma parte del archivo cifrado. Esto evita acumular versiones antiguas de datos personales en soportes persistentes. No reemplaza las copias de seguridad.

Los botones no estarán disponibles si no hay operaciones del tipo correspondiente. Un cambio nuevo después de deshacer elimina la pila de rehacer. Los formularios de rúbrica no guardan valores incompletos. **Una operación de restauración de copia sustituye todo el cuaderno y no es deshacible** mediante historial: debe confirmarse expresamente.

## Cambios internos

No cambia el esquema v5 ni el formato de cifrado de v0.3, por lo que se pueden abrir cuadernos cifrados anteriores a través de su migración ya existente, sin cambiar IDs o contraseña. El servidor local ahora solo sirve una lista explícita de archivos de aplicación. El service worker únicamente elimina cachés antiguas de CuadernoDocente, sin borrar cachés de otras aplicaciones del mismo origen.

No se ha añadido OneDrive ni se han enviado datos a servicios remotos. Prototipo experimental para datos ficticios; siguen pendientes validación del almacenamiento y modo offline en navegadores reales, especialmente Safari/iPadOS, auditoría de seguridad y conformidad institucional.

## Validación

- `npm test`: pruebas unitarias, integridad y migraciones del modelo, cálculo, CSV, cifrado y PWA.
- `python qa/browser_simulado.py`: recorrido gráfico **simulado** en Chromium (sin almacenamiento real) de tabla, deshacer/rehacer, alta y duplicación de rúbricas, puntuaciones y continuación al siguiente alumno, borrado restaurado, vista individual y tamaños de pantalla. Esta prueba NO valida IndexedDB, cifrado en navegador, carga real de módulos ni Service Worker.
- `npm start`: servidor local en `127.0.0.1`; probar manualmente creación, restauración, persistencia y desconexión antes de utilizar la aplicación.
