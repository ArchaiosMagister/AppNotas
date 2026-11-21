# Cambios — Segunda ronda de auditoría v1.7

**Origen:** ZIP v1.6, no código publicado en GitHub. **Destino:** candidata local v1.7. No se han alterado las ponderaciones, competencias, rúbricas, recuperación de exámenes, formato de las copias cifradas ni esquema 6.

1. **Fechas académicas protegidas:** al editar la fecha de comienzo/fin, se comprueba que no queden fuera del intervalo exámenes, anotaciones de clase, excepciones, tareas ni festivos. Si hay datos afectados, se informa y no se guarda el cambio. No se destruyen registros.
2. **Trasladar a la siguiente clase:** busca la siguiente sesión lectiva de ese grupo o asignatura manual, incluso si es otro día de la semana o una segunda sesión el mismo día; respeta cambios de horario, festivos y cancelaciones. Si la sesión ya está planificada, informa sin borrar el contenido anterior. Una clase marcada como impartida no se traslada.
3. **Separación de grupos en las consultas:** categorías, medias, desglose y advertencias no devuelven calificaciones si se pasa el identificador de un alumno de otro grupo.
4. **Dos decimales:** las entradas a funciones numéricas también respetan el máximo de dos decimales, igual que las notas escritas en el formulario. No se truncan ni redondean silenciosamente entradas inválidas. Los cálculos conservan precisión completa.
5. **Índices temporales de calificaciones:** al calcular varias categorías de un mismo estudiante se reutiliza un mapa local de notas; se reconstruye tras cada edición, sin cambios en resultados ni persistencia adicional.
6. **Actualización offline:** versión de caché PWA `cuaderno-docente-static-v17-dev`; HTML autónomo reconstruido con CSP y PDF curriculares incorporados.

No se ha realizado ninguna publicación remota. Uso exclusivamente de datos ficticios mientras se realizan las pruebas de Safari.
