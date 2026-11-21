# Cambios de CuadernoDocente 0.3 (experimental)

## 1. Escalas individuales y normalización opcional

Cada actividad permite una puntuación máxima configurable (por ejemplo 10, 5, 3 u otra positiva). `convertToTen` es un booleano por actividad, **verdadero por defecto**: al calcular categorías, convierte la puntuación bruta a escala 0–10 mediante `score / maxScore * 10`. Si se desactiva, usa el valor numérico bruto; no modifica las notas almacenadas. Cambiar de opción recalcula el resultado, y puede hacer que categorías con escalas no normalizadas dejen de ser comparables: responsabilidad docente.

Las actividades con rúbrica se califican **siempre** sobre 10. Las recuperaciones conservan escala y normalización propia, y se enlazan a una sola evidencia original.

## 2. Rúbricas

Se pueden crear plantillas en la pestaña Rúbricas o importar archivos de definición **JSON** (`name` y `criteria[{name,maxScore,weight}]`) y **CSV** (`criterio;maximo;peso`). No se importan PDF ni Word en esta versión.

Para cada criterio, la nota se calcula sobre su máximo y se pondera por su peso relativo. El resultado de la rúbrica en /10 es:

`10 * SUMA( (puntos_obtenidos_i / puntos_maximos_i) * peso_i ) / SUMA(peso_i)`.

Una rúbrica exige que se puntúen **todos** los criterios; no hay valores implícitos cero. Se conserva el detalle por criterio en la calificación `rubricRatings` y se almacena la nota resultante en `score`, verificada por `assertModel`. Si hay calificaciones registradas, se impide cambiar la rúbrica o sus criterios sin crear otra plantilla. Se pueden borrar valoraciones individualmente.

## 3. Visor individual del alumno

Desde «Ver» junto al alumno se abre «Modo alumno», que muestra exclusivamente sus calificaciones por periodo y categoría, así como su evaluación final. El visor oculta el listado, la tabla y los controles docentes mientras hay un alumno seleccionado. «Ocultar notas» deja el visor sin mostrar alumnos, antes de volver al cuaderno. No garantiza por sí solo privacidad de otras ventanas, notificaciones ni dispositivos de proyección.

## 4. Evaluación final (pestaña separada)

No crea un periodo adicional. Usa el resultado **sin redondear** de `overallGrade` para cada periodo. Por alumno y periodo se admite una calificación manual opcional `/10` que, si existe, sustituye el cálculo automático solo para la evaluación final. Borrarla restaura el valor automático. Una nota manual cero es distinta de una ausencia.

Reglas por grupo: `mean`, `weighted_mean` (pesos relativos configurables), `latest_if_highest` (si la última nota disponible es igual o superior a todas, cuenta solo esa; si no, media). Los periodos sin nota se excluyen de la media y se renormalizan los pesos de los restantes. Se pueden excluir manualmente periodos del resultado anual, sin borrarlos.

## 5. Migración y límites

Esquema v5; se migra desde v1, v2, v3 y v4, conservando grupos, alumnado, actividades, calificaciones, vínculos y colores personalizados. Las actividades antiguas adoptan `convertToTen: true` para **conservar exactamente los cálculos anteriores** y `rubricId: null`. Se crean colecciones vacías `rubrics`, `finalConfigs` y `finalOverrides`. No se modifica el mecanismo de cifrado de la copia `.cdoc`.

**Antes de actualizar:** descarga una copia cifrada de la versión previa. No hay migración inversa; si vuelves a una versión anterior, podría rechazar el nuevo esquema. La PWA exige localhost o un origen seguro; abrir `index.html` directamente como `file://` no es un método compatible de ejecución.

**Estado de validación:** pruebas unitarias automatizadas; pruebas de navegación real y funcionamiento offline en iPad/iPhone siguen pendientes porque el entorno de automatización devuelve `ERR_BLOCKED_BY_ADMINISTRATOR` al navegar hacia la aplicación. Exclusivamente datos ficticios hasta auditoría independiente y autorización institucional.
