# CuadernoDocente v1.2 — correcciones locales de prepublicación

Fecha: 21 de noviembre de 2026. Partimos de v1.1; no se publica en GitHub.

## 1. Categorías por grupo

La categoría **Trabajos** se compartía entre grupos. En v1.1 el borrado comprobaba todas las actividades de todo el documento y, por ello, impedía eliminarla de Latín II aunque el grupo no la utilizara. Ahora se puede **retirar de un grupo** si no tiene actividades asociadas en ninguno de sus trimestres, preservando las actividades y calificaciones de otros grupos. Una categoría sin referencias en ningún grupo ni competencia se elimina de forma efectiva; las categorías creadas manualmente se asocian al grupo activo. Se conservan los IDs, las notas y las reglas de grupos no afectados. Retirar categorías puede requerir ajustar porcentajes del grupo si esos pesos no eran cero.

## 2. Conversión visible

Las actividades numéricas con conversión a /10 desde otra escala muestran la nota introducida y debajo la equivalente, **entre paréntesis**, por ejemplo `4,25` y `(8,50 /10)`. La normalización de escala determina el color, no la puntuación bruta. La información aparece también en modo alumno.

## 3. Dos decimales

Se admiten 0, 1 o 2 decimales en la entrada manual, con coma o punto. Se rechazan nuevas notas manuales con más de dos. Las cifras y notas derivadas se muestran con un máximo de dos decimales (y se conserva la posibilidad de elegir 0, 1 o 2 decimales). **No se redondean los cálculos internos ni se truncarán notas antiguas al abrirlas**. Una copia antigua que tenga notas con más de dos decimales sigue siendo legible y se muestra con el límite de precisión sin alterar el dato cifrado subyacente.

## 4. Gradación legible para valores /10

- 0–3,49: granate oscuro.
- 3,50–4,99: rojo vivo.
- 5–5,99: amarillo.
- 6–6,99: verde.
- 7–9,99: gradación azul claro a azul oscuro.
- 10: morado.

Se muestran coloreadas las notas normalizadas, rúbricas, medias, calificaciones de competencias y evaluación final. El contraste de cifra y fondo se comprueba con el criterio WCAG AA de 4,5:1 en todas las centésimas de 0 a 10.

## 5. Temas explícitos

Se incorpora un selector de cabecera: **Claro / Oscuro / OLED**. El modo claro ya no cambia por la preferencia de color del sistema. Oscuro conserva paneles de contraste suave; OLED usa negro puro como fondo principal y paneles. Se guarda la selección en `localStorage` si el navegador lo permite; la imposibilidad de guardar la preferencia no afecta al cuaderno cifrado.

## Seguridad y versiones

Se mantiene el esquema de datos v5: los campos de personalización de categorías son opcionales y compatibles con copias anteriores. Se conserva la CSP estricta: las variables cromáticas se aplican con CSSOM, no mediante estilos HTML inline ni `unsafe-inline`. La caché PWA cambia a `cuaderno-docente-static-v12-dev` para evitar recursos de la edición anterior. El ZIP incluye fuentes, pruebas, currículos y HTML autónomo para Safari Mac sin Node.

**Pendiente:** la persistencia real y las pruebas de aceptación en Safari Mac/iPad/iPhone sobre `file://` o sobre HTTPS, con datos ficticios. No utilizar aún con datos personales reales.
