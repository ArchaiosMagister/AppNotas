# Auditoría y pruebas · v1.8 (21-11-2026)

## Cambios

Incorporada una tarjeta informativa de estadísticas para actividades, categorías, competencias vinculadas, evaluaciones trimestrales y nota anual. El cálculo utiliza el motor existente, conserva la precisión interna y no añade campos al modelo persistido.

## Criterios

- Media calculada **solo entre alumnos calificados** y en la escala efectiva que se visualiza.
- Aprobados / total calculado sobre el **total de alumnos matriculados en el grupo**, incluyendo quienes aún no tienen nota. La tarjeta da también el total con nota y el porcentaje entre los evaluados.
- Las notas vacías no son ceros. Un 4,995 sin redondear no aprueba aunque se visualice como 5,00.
- Se aplican penalizaciones por faltas pendientes, y se restaura la puntuación cuando la entrega está marcada. Las medias trimestrales y anuales respetan las recuperaciones y los sobrescritos manuales.
- Sin mostrar datos de la clase en Modo alumno.

## Pruebas ejecutadas

- `npm test`: **245/245 superadas** (233 anteriores + 12 específicas).
- Chromium sin red ni servidor con persistencia simulada: apertura de tarjetas por hover, clic, Escape, navegación entre Cuaderno / Cálculos / Evaluación final y ausencia de estadísticas en Modo alumno. **0 errores JavaScript**.
- Chromium emulando tamaños de iPhone (390 px) e iPad (820 px) con interacción táctil: abrir, cerrar, tocar fuera y recálculo tras editar nota. **0 errores JavaScript**.
- HTML único reconstruido con dos scripts y CSS protegidos por hashes SHA-256 de CSP. Se conserva JSZip y los PDF curriculares incorporados.
- Aún **pendiente**: Safari Mac, iPhone e iPad reales; persistencia IndexedDB real en archivo `file://` y prueba completa de actualización offline de la PWA.

**Ninguna publicación en GitHub.** Solo alumnado ficticio hasta superar validación real y controles legales/institucionales.
