# Estabilización de CuadernoDocente v1.0-rc1

La versión candidata se construyó a partir del ZIP v0.9. La auditoría comenzó comprobando la integridad del ZIP y su manifiesto SHA-256 y ejecutando las 129 pruebas originales. Se priorizaron los resultados de calificación, la confirmación de escrituras, la recuperación, el modo offline, las regresiones y la interfaz.

## Incidencias y resolución

| Incidencia | Cambio |
|---|---|
| Productos con pesos subnormales podían perder contribuciones por redondeo de coma flotante. | Se reescalan pesos extremos antes de multiplicar. Las medias ordinarias mantienen su orden de operaciones. Se probó un oráculo racional independiente. |
| Las rúbricas antiguas con pesos extremos podían almacenar una puntuación errónea. La vista previa y el guardado usaban fórmulas distintas. | La vista previa y el cálculo usan la misma fórmula. Si las valoraciones de una rúbrica antigua son coherentes con el algoritmo original, el documento sigue siendo legible. Los resultados visibles se derivan de las valoraciones conservadas. |
| El rescate podía requerir otra lectura tras una restauración ya confirmada. Recuperar un esquema antiguo podía exigir una segunda escritura. | La transacción devuelve su punto de rescate al confirmar. La versión migrada se escribe en el intercambio atómico. |
| Un error de escritura podía descartar el único intento de un cambio al cerrar. | Si el cifrado finalizó se puede descargar el intento fallido en Ajustes. Se solicita durabilidad estricta en IndexedDB cuando está disponible. La navegación avisa mientras hay una mutación pendiente o un error, en la medida que el navegador admita `beforeunload`. |
| Una actividad numérica nueva quedaba bloqueada por la validación del selector de rúbrica. | El selector permite la opción numérica vacía. El flujo se comprobó en Brave sin red. |
| Los periodos marcados casi simultáneamente podían basarse en la misma lista antigua. Una casilla de peso vacía se interpretaba como cero. | Se aplica cada inclusión al borrador vigente en la cola y se valida el campo numérico antes de guardar. |
| Cambiar de grupo mientras se leía un CSV podía desviar la importación. | Se captura el grupo que abrió el archivo y se utiliza en la confirmación y escritura. |
| El estado de guardado quedaba oculto en pantallas pequeñas. | El estado permanece visible y se anuncia. Se añadió modo oscuro según el sistema, se ampliaron objetivos táctiles y se indexaron las notas visibles al construir la tabla. |
| El currículo 2022 de Latín II carecía de tarjetas. | Se incorporaron 5 competencias con descriptores, 22 criterios y 32 saberes de 2.º a partir del anexo oficial. Se incluye el extracto del DOGV y se identifican por año escolar las dos versiones. |

## Regresiones y compatibilidad

- Se conserva el esquema 5, el formato `.cdoc` versión 1 y el nombre de IndexedDB. Las pruebas de migración incluidas verifican esquemas anteriores, identificadores, notas y colores personalizados.
- La actualización real desde v0.9 se comprobó en el mismo origen y perfil de Brave. Después del cambio, la nota ficticia `6,25` reapareció desde IndexedDB al desbloquear y volvió a estar disponible con el servidor detenido.
- Se conservan las reglas de las categorías, las recuperaciones y la elección del último periodo cuando está incluido, calificado e iguala o supera la mejor calificación de los periodos utilizados. Los resultados ordinarios de la batería anterior permanecieron iguales.
- La biblioteca normativa es de consulta. La actualización del catálogo no convierte criterios curriculares en rúbricas ni en pesos de calificación.
- La instalación local usa un servidor enlazado a loopback. El protocolo de iPhone y iPad requiere servir los mismos archivos desde un origen HTTPS accesible por esos dispositivos, usando exclusivamente datos ficticios durante la prueba.

## Pendiente antes de una versión estable

- Completar en Safari de macOS el cierre y reapertura del navegador o PWA instalada, la actualización instalada, la restauración, el rescate y la concurrencia. La pantalla inicial se comprobó en Safari 27.2 con su interfaz. WebDriver tiene desactivada la automatización remota.
- Repetir en iPhone e iPad reales las pruebas de persistencia, instalación, actualización, conexión intermitente y entrada táctil. Las capturas de Brave a 820 y 390 px corresponden a tamaños emulados. OLED no es un modo independiente en esta versión.
- Terminar el cotejo íntegro de las fichas curriculares largas contra los PDF oficiales y revisar las correcciones normativas aplicables. Los extractos y los identificadores de página están disponibles para esa revisión.
- Griego II conserva la ficha de 2026 para consulta anticipada. Queda pendiente incluir su currículo aplicable a 2026–2027.
- La interfaz permite crear grupos dentro del catálogo de cinco materias. El alta de asignaturas arbitrarias queda pendiente.
- Antes del uso institucional queda por validar el tratamiento de datos en el entorno del centro, la recuperación ante expulsión de IndexedDB y el procedimiento de copias. Un conflicto puede requerir reconciliar manualmente dos cuadernos completos. Un cierre forzado antes del cifrado o de la confirmación de una escritura puede perder la edición en curso.
