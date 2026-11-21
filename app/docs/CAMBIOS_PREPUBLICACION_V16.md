# CuadernoDocente v1.6 — modificaciones sobre v1.5

Fecha: 21 de noviembre de 2026. **Sin publicación en GitHub.**

- **Cálculos:** el cálculo de evidencias por categoría genera un índice temporal de calificaciones del alumno y recuperaciones, en vez de buscar repetidamente entre todas las calificaciones del documento. No se almacena caché reutilizable y las ediciones se reflejan de inmediato.
- **Horario:** si una excepción pasa de «cambio de hora» a cancelación o se mueve a otra fecha/sesión, los exámenes que conservan el vínculo recuperan la hora base en la ubicación anterior antes de actualizar la nueva.
- **Integridad:** las copias restauradas no pueden introducir sesiones con tipos no admitidos, excepciones duplicadas para un mismo día/sesión, clases planificadas duplicadas ni dos eventos enlazados al mismo examen en el mismo año.
- **Rúbricas XLSX:** verificación anticipada de tamaños de XML descomprimido, número de entradas ZIP y rechazo de DTD/entidades XML. Se mantiene la importación de la rúbrica de Actitud de 2.º Bachillerato.
- **PWA:** se actualiza y coordina el identificador de caché del Service Worker con la comprobación de recursos offline en la interfaz.
- **Pruebas:** se añaden 18 casos de regresión a los 200 anteriores y se valida el código en un recorrido de interfaz con Chromium simulado.

La estructura de datos sigue en la versión 6; **no hay migración de calificaciones**. Las fórmulas y pesos preexistentes se preservan. La validación de Safari macOS, iOS e iPadOS real sigue pendiente.
