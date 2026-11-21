# CuadernoDocente v1.11 — cuarta auditoría de integridad y cálculos

**Estado:** candidata de prepublicación local. **Sin cambios en GitHub.** Utilizar datos ficticios. Antes de probar, exportar una copia cifrada `.cdoc` del cuaderno anterior y guardar la contraseña de manera segura.

## Alcance de la auditoría

Revisión de la v1.10 y corrección de defectos reproducibles. Se ha conservado la formulación de las notas y el esquema de cifrado v6. Las operaciones inválidas deben rechazar los cambios antes de afectar calificaciones, rúbricas o datos de otro grupo.

## Incidencias corregidas

1. **Entregas de faltas:** el editor desmarcaba automáticamente las entregas de todos los alumnos al intentar desactivar su recuperación en un examen. Se ha eliminado esa mutación masiva; ahora se rechaza el cambio hasta que se revisen individualmente las entregas. Prueba automática y recorrido de interfaz verifican que se conserva el registro de calificaciones **byte a byte en su representación JSON** antes y después de la operación inválida.
2. **Modificación de la penalización:** un cambio de tarifa ortográfica con faltas pendientes exigirá confirmación docente porque modifica las notas computadas, sin alterar las notas originales.
3. **Alumnos CSV:** un nombre en blanco dentro de una fila con datos dejaba de importarse silenciosamente; ahora se rechaza **toda** la importación. El lector detecta delimitadores ignorando comas/semicolons dentro de comillas y rechaza caracteres ilegales después de cerrarlas.
4. **Rúbricas JSON:** un nivel sin puntuación (campo omitido, vacío o `null`) se convertía silenciosamente en cero; ahora se rechaza el archivo. Las puntuaciones válidas conservan el cero cuando se declara explícitamente.
5. **Rúbricas Excel:** las filas de criterio sin nombre pero con puntuaciones o descriptores podían omitirse sin aviso; ahora la importación se rechaza y explica el problema.
6. **Precisión de rúbricas:** el importador y editor admitían máximos o niveles con más de dos decimales imposibles de introducir desde el evaluador. Ahora se validan **antes de crear o modificar** una rúbrica, tanto en JSON, CSV como XLSX. No se alteran de manera retroactiva las rúbricas existentes en copias históricas.
7. **Copias entre períodos:** la configuración ortográfica de una actividad copiada compartía una referencia anidada con la original; ahora se clona. Las modificaciones a opciones del formulario tampoco pueden mutar la configuración guardada al margen de una transacción.
8. **Configuración final:** el array de evaluaciones excluidas recibía una referencia mutable del llamador; ahora se copia para impedir cambios involuntarios posteriores.
9. **Planificador restaurado:** se rechazan horarios de guardia asociados a un grupo y eventos de tipo reunión ligados a un examen, en lugar de reinterpretarlos silenciosamente.

## Comprobaciones realizadas

- **294/294 pruebas automatizadas de Node superadas**, 17 nuevas respecto a las 277 de v1.10. Incluye los contrastes docentes independientes previos de **3.000 escenarios trimestrales y 1.200 anuales**.
- **Cobertura de líneas del motor de cálculos: 98,88 %; del modelo de datos: 98,94 %**. XLSX sigue siendo el módulo con menor cobertura relevante, **87,29 % de líneas** (70,37 % de ramas). La cobertura es una medida de ejercicios, no una garantía de corrección.
- **100 secuencias de operaciones no relacionadas** (nombres, colores, anotaciones, calendario y grupos) conservan las matrices de notas y los resultados trimestrales y anuales.
- **Prueba de interfaz en Chromium simulado:** el intento de desactivar entregas registradas muestra el error, mantiene abiertas las opciones y preserva exactamente el contenido de `grades`.
- **Prueba de importación real:** Excel original de Actitud de 2.º Bachillerato con cinco criterios y rúbrica JSON con descriptores; estadísticas sin regresiones. Sin errores JavaScript observados en los recorridos.
- **HTML autónomo:** empaquetados los 17 módulos y cuatro PDF curriculares; comprobación de hashes CSP, arranque e integridad de recursos.
- **Servidor local:** recursos públicos esenciales 200; archivos internos, fuentes de pruebas y manifiesto 404.
- **Cifrado y persistencia:** se han ejecutado las pruebas automatizadas incluidas; **la persistencia real en Safari abriendo `file://`, la reapertura y la restauración en iPhone/iPad siguen sin verificarse en hardware real**.

## Riesgos restantes y protocolo de aceptación

- Los cálculos no pueden garantizarse sin defectos en todas las configuraciones posibles mediante una batería finita. No utilizar para expedientes reales hasta completar la aceptación.
- Safari puede gestionar `file://` e IndexedDB de modo distinto al navegador simulado. Es obligatorio probar cierre/reapertura y restauración de `.cdoc` con **alumnos ficticios**.
- Probar específicamente: activar/desactivar recuperación de faltas con entregas registradas; editar penalización de otro examen; copia de una actividad entre evaluaciones sin notas; cambios de nombres, colores, horario y festivos; importaciones de rúbricas válidas e inválidas; evaluación final.
- Las rúbricas históricas con más de dos decimales pueden seguir presentes en copias antiguas; no se han redondeado ni eliminado automáticamente.
- No se ha publicado esta versión; el repositorio privado conserva el estado anterior.

Se conserva documentación histórica de versiones anteriores para trazabilidad.
