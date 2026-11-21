# Segunda auditoría técnica — CuadernoDocente v1.7 (prepublicación)

**Fecha:** 21 de noviembre de 2026. **Origen:** `CuadernoDocente_v1.6_prepublicacion.zip`. **Destino:** una candidata local v1.7. **GitHub:** sin cambios ni publicación.

## Resultado comprobado

| Prueba | Resultado | Observaciones |
|---|---|---|
| Node.js (`npm test`) | **233/233 correctas** | 220 precedentes y 13 nuevas: fechas de curso, traslado de sesiones, separación de grupos, precisión de notas y recálculo tras cambios |
| Reproducción previa de errores | **7 fallos reproducidos** | Las pruebas nuevas fallaban en la v1.6 antes de aplicar las correcciones; pasan después |
| Comparación de medias v1.6 / v1.7 | **Resultados idénticos** | 158 alumnos, 76 actividades, 12 040 notas sintéticas |
| Tiempo de cálculo de medias | **60,59 → 31,22 ms** | Cuarta medición local; mejora aproximada ×1,94 del recorrido medido, no de la web completa |
| Interfaz con Chromium | **Sin errores JavaScript** | Ejecución simulada sin servidor: cuaderno, navegación, planificador, temas, vista móvil |
| Importación de Excel real | **Correcta** | `Rúbrica_-_Actitud_2bach.xlsx`: cinco criterios y solo dos niveles en «Uso del móvil» |
| HTML autónomo/CSP | **Correcto mediante pruebas de integridad** | CSS y dos scripts con hashes SHA-256 incorporados; PDF curriculares incluidos, sin conexión a terceros |
| Safari macOS `file://` | **Pendiente** | El navegador automatizado de este entorno bloquea rutas `file://`; no se ha podido comprobar persistencia real |
| Safari iOS / iPadOS | **Pendiente** | Necesaria prueba real con origen HTTPS compatible para el modo PWA |

## Cambios verificados

- El acortamiento del curso se rechaza si dejaría datos existentes fuera del rango. La operación fallida conserva el documento sin mutaciones.
- El traslado de un contenido pendiente utiliza la próxima clase del grupo, no solo la siguiente aparición semanal del mismo tramo horario; considera clases dobles, excepciones, festivos y sesiones ocupadas.
- Los cálculos por categoría y grupo rechazan consultas cruzadas; la revisión del identificador precede a la búsqueda de notas.
- Notas numéricas con tres o más decimales se rechazan del mismo modo que las cadenas.
- La media de un grupo se actualiza tras editar una nota; el índice de búsqueda es efímero y no altera cálculos ni el fichero de datos.

## Alcance y limitaciones

- No se modifican las reglas docentes ni la precisión interna utilizada para ponderar.
- No se altera el formato `.cdoc`, la clave de cifrado ni la versión 6 del modelo.
- Las pruebas visuales se han ejecutado con almacenamiento simulado, no representan una prueba real de IndexedDB ni de Safari.
- Es necesario verificar **en Safari real**, utilizando exclusivamente datos ficticios: cerrar/reabrir el mismo archivo autónomo, guardar/notas, faltas, planificador, cambio de período, exportación/restauración `.cdoc` y comportamiento entre pestañas.
- No usar para calificaciones reales sin aprobación institucional, evaluación de protección de datos y pruebas reales de recuperación.

**Conclusión:** candidata v1.7 apta para validación local con datos ficticios; publicación en GitHub no autorizada ni realizada.
