# Auditoría focalizada de integridad de notas y cuadernos · 22-11-2026

## Versión y alcance
- Base: `main`, commit `0781ba586d0332958b0aeaa7b5a8e717280da75f`, paquete `1.0.0`.
- Ámbitos inspeccionados: `src/calculations.js`, `src/model.js`, `src/cuaderno.js`, `src/vault.js`, `src/storage.js`, `src/history.js`, `app.js`, planificador y pruebas existentes.
- Se priorizaron la fidelidad de la media/trimestres/Ítaca/competencias, transiciones de estado NP/AJ, rúbricas y ortografía, confirmación de guardado, recuperación y restauraciones.
- No se han alterado los umbrales académicos ni las fórmulas de cálculo.

## Incidencias verificadas y correcciones

### A. Nota idéntica sobre ausencia justificada (AJ)
**Hallazgo:** `setGrade`, `setOrthographyGrade` y `setRubricGrade` tenían una salida anticipada cuando los valores nuevos coincidían con los guardados. Si la nota estaba oculta bajo AJ, esos caminos no retiraban la marca y el cálculo seguía ignorándola, aunque el docente hubiese confirmado la calificación.

**Corrección:** ahora el atajo de «sin cambios» solo se utiliza si la calificación **no** está en AJ. Confirmar la misma nota desmarca AJ y vuelve a contabilizar el valor existente, sin cambiar puntuaciones, faltas, entregas, IDs ni rúbricas.

**Pruebas:** reactivación de valores positivos y cero, penalización y devolución de faltas, rúbricas, medias de categoría/trimestre y restauración `.cuaderno` cifrada.

### B. NP → AJ → quitar AJ perdía la constancia de «No presentado»
**Hallazgo:** al aplicar AJ a una calificación NP, se descartaba el estado original y se guardaba un marcador vacío. Al quitar AJ desaparecía el registro. Esto convertía un cero exigible (NP) en una ausencia de nota, cambiando potencialmente la media.

**Corrección:** un indicador opcional `pendingWasNotSubmitted` recuerda, de forma cifrada y comprobada por `assertModel`, que AJ suspendió un NP. Al desactivar AJ, reaparece el NP original con su ID, fecha y valor cero. El marcador se elimina si se introduce expresamente una calificación numérica. Cuando AJ se creó desde una casilla realmente vacía, esta sigue vacía al quitarlo.

**Compatibilidad:** el campo es opcional en el esquema existente y no modifica ningún cuaderno antiguo. Un AJ guardado con la implementación anterior sin ese indicador no puede reconstruir retrospectivamente si procedía de NP o de una casilla vacía; no se inventan datos históricos.

## Salvaguardas comprobadas en el código
- `commit` crea una copia profunda, valida el modelo y espera al guardado cifrado **antes** de sustituir el cuaderno visible y anotar el cambio en el historial.
- `writeEnvelope` verifica la versión anterior y escribe el nuevo sobre AES-GCM en la **misma transacción** IndexedDB; rechaza conflictos entre pestañas.
- Las restauraciones conservan un punto de rescate cifrado y realizan sustituciones atómicas con comprobación de versión. Los cambios y cancelaciones previos no deben borrar el contenido local.
- `readBackupFile` comprueba tamaño/formato, descifra mediante autenticación AES-GCM, migra si procede y valida las relaciones del modelo antes de exponer los datos restaurados.
- `compareBookVersions` no presume que una copia sea más reciente solamente por la fecha y pide autorización adicional para cuadernos diferentes o historias divergentes.
- El guardado y la restauración de demostración se cotejan mediante pruebas automatizadas de equivalencia de notas, notas Ítaca, competencias y datos íntegros.

## Regresiones
- `tests/v149_audit_grade_reactivation_and_backups.test.mjs`: 8 casos.
- `tests/v150_audit_np_aj_preservation.test.mjs`: 6 casos.
- Se vuelve a ejecutar toda la suite anterior (incluidos los oráculos aleatorios de notas y las simulaciones de fallos atómicos) y se verifica el manifiesto SHA-256 y la reconstrucción autónoma.

## Riesgos residuales y condiciones de uso
- No se puede garantizar que un navegador o su sistema operativo conserven indefinidamente IndexedDB: borrar los datos del sitio, cambiar de perfil o agotar el almacenamiento puede hacer inaccesible el cuaderno.
- El punto de rescate local es único para restauraciones y **no es** una copia externa independiente.
- Una contraseña perdida no se puede recuperar; la aplicación no envía calificaciones ni contraseñas a servidores.
- Para datos reales sigue siendo imprescindible la autorización institucional y mantener al menos dos copias cifradas **verificadas**, en ubicaciones locales no sincronizadas. No confundir una descarga iniciada con una copia restaurable.
- Esta revisión es una auditoría focalizada de integridad y pruebas de regresión, **no** una certificación de ausencia de defectos ni una auditoría externa de seguridad.

## Entrega
La PR de auditoría permanece en borrador, separada de `main`. Fusionar y publicar únicamente tras CI verde y autorización de publicación.
