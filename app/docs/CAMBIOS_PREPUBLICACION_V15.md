# Cambios v1.5 — faltas de ortografía recuperables

## Modelo

- Esquema 6: añade a cada actividad opcional `orthography = {enabled,penaltyPerFault,repetitions,refundable}`. Por omisión, las nuevas actividades de la categoría «Exámenes» se crean con 0,10 puntos por falta, 30 repeticiones y recuperación al entregar; todo es modificable desde «⋯ Editar datos». Los ajustes generales se aplican exclusivamente a nuevos exámenes.
- La nota de cada estudiante conserva `score` sin penalizar y añade opcionalmente `orthographyFaults` (entero no negativo) y `orthographyDelivered` (booleano). No se destruyen ni se reescriben notas anteriores; la edición de nota y faltas se registra como una mutación atómica. Los datos se incluyen en la misma copia cifrada `.cdoc`.
- Se migra el esquema 5 (v1.4) al 6 sin tocar las notas; también siguen admitiéndose migraciones de versiones anteriores. Los exámenes existentes se mantienen sin penalización hasta activarla manualmente, para evitar cambios retrospectivos de medias.

## Matemáticas

- `base10 = (score / maxScore) * 10` si la actividad convierte; en escalas de diez equivale a su puntuación base. Se aplica una penalización `faultCount × penaltyPerFault` **después** de normalizar. `effective10 = max(0, base10 − penalty)` mientras la entrega está pendiente; si están «Entregadas», `effective10 = base10`.
- El cálculo no altera `score`. Los promedios de categoría, recuperaciones, competencias, trimestres y evaluación final emplean una sola vez el valor efectivo. Se conserva toda la precisión antes del redondeo visual. Puntuación mínima 0; máximo admitido de 1000 faltas por prueba; importe por falta editable entre 0 y 10 con dos decimales.
- Las rúbricas y las actividades sin conversión a diez no admiten esta penalización, para evitar escalas ambiguas. Las copias de estructura trimestral replican reglas y no registran notas.

## Interfaz

- Botón de nota y faltas en las celdas de exámenes configurados; muestra nota computable /10 y debajo nota original, cantidad y descuento o confirmación de entrega.
- Editor táctil: nota original, número de faltas, cálculo de penalización y vista previa, casilla «Entregadas — faltas copiadas N veces cada una». Casilla inhabilitada sin faltas o si la devolución no está permitida.
- En `+ Actividad` y en «⋯ → Editar datos» se configura penalización, descuento, número de copias y devolución. En «Ajustes y copias» se definen valores predeterminados para los exámenes futuros.
- El modo alumno muestra solamente la nota efectiva y el desglose del alumno seleccionado. Se mantiene la paleta de calificaciones y los tres temas.

## Seguridad y limitaciones

- Los cambios del cuaderno son cifrados mediante el sobre existente. La entrega de las copias se confirma manualmente; no se graban ni se suben documentos de alumnos.
- No se ha probado la persistencia de `file://` en Safari real ni en iOS/iPadOS. La versión HTML autónoma conserva el comportamiento y limitaciones de anteriores candidatas.
- No publicar ni usar notas reales sin completar aceptación y revisión de seguridad.
