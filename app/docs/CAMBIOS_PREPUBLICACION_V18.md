# Cambios de la v1.8 · Estadísticas docentes

1. `src/statistics.js`: cálculo puro, aislado por grupo y con umbral de aprobado sobre cada escala, sin persistencia ni alteraciones del modelo.
2. Cabeceras interactivas de actividades, evaluación trimestral, períodos del resumen anual, evaluación final de curso, categorías y competencias.
3. Tarjeta de media, aprobados/total, porcentaje sobre el total, alumnos evaluados y porcentaje sobre evaluados. Las celdas vacías no se consideran ceros.
4. Ratón: al pasar por cabeceras; tacto y teclado: botón ⓘ, cierre al volver a tocar, fuera de la tarjeta o mediante Escape. No aparece en modo alumno.
5. Nuevos recursos incluidos en `sw.js`, `server.mjs` y comprobación offline. HTML autónomo con código y hojas de estilo incorporados, y política CSP SHA-256 actualizada.
6. Sin cambios en datos cifrados, fórmulas de ponderación, planificador ni rúbricas. Sin publicación en GitHub.
