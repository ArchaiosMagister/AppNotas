# CuadernoDocente v0.5 — auditoría prioritaria de cálculos

## Alcance y criterio de aceptación

Se parte íntegramente de v0.4. **No se modifica el esquema de datos (v5)**, los identificadores ni la configuración de cifrado. No se publica ni se sincroniza nada. Todos los ejemplos y capturas utilizan alumnos ficticios.

### Hallazgos corregidos

1. **Último examen pendiente**: la regla «último si es la mejor nota; si no, media» solo usa la última evidencia cuando se ha evaluado el último examen del conjunto. Si la última actividad todavía está en blanco, calcula la media de las disponibles. La regla diferenciada «última evaluada» sigue escogiendo la última con nota. Las recuperaciones conservan la posición lógica de su actividad original.
2. **Escalas incompatibles**: se respeta la opción docente de usar la nota bruta si la conversión a /10 se desactiva. Si esa nota bruta supera 10, no se genera un resultado /10 inválido: se bloquean la categoría y los cálculos derivados; se muestra una advertencia y se puede activar la conversión. La escala y la nota original almacenadas se conservan. Los datos sin evaluar no se transforman en cero. Una categoría con peso 0 no invalida la media de las demás, aunque sus competencias relacionadas seguirán sin calificación válida.
3. **Evaluación anual**: las reglas de último periodo respetan el orden establecido. Un periodo incluido pero aún sin calificar impide tratar el penúltimo como «último». Si un periodo tiene notas, pero su nota automática no puede calcularse por porcentajes incoherentes o escalas incompatibles, no se oculta el problema excluyéndolo silenciosamente de la media anual; la nota final se bloquea hasta resolverlo, excluir expresamente ese periodo o introducir su nota manual. Un periodo de peso cero no afecta a la media ponderada.
4. **Rúbricas con coma decimal**: el formulario permitía previsualizar, por ejemplo, `2,5`, pero el guardado podía rechazarlo. Vista previa, guardado y cálculo tienen ahora un comportamiento coherente. Se rechazan entradas no decimales (hexadecimales, notación científica, espacios, valores booleanos), en lugar de convertirlas accidentalmente.
5. **Protecciones del modelo**: los porcentajes no pueden superar 100, los máximos y pesos de actividades están acotados a 1000 y los pesos de competencias se validan. Estas restricciones impiden resultados no interpretables y no alteran cuadernos válidos.
6. **Edición de escala con notas**: la interfaz exige confirmación cuando modificar el máximo o la conversión puede cambiar las notas calculadas de una actividad ya evaluada.

### Gestión del cuaderno

- Renombrar alumno o editar su código manteniendo su identificador y calificaciones.
- Mover alumnos arriba o abajo conservando sus notas.
- Eliminar un alumno con confirmación explícita: borra sus notas y sus anulaciones manuales, sin tocar otros alumnos. Se puede recuperar mediante **Deshacer** en la misma sesión.
- Editar nombre y curso escolar del grupo sin cambiar asignatura ni mover alumnos.
- Renombrar y reordenar periodos. Se avisa de que el orden interviene en las reglas del último periodo.
- El selector de periodos muestra el orden configurado.

## Ejemplos de referencia

| Situación | Resultado exacto esperado |
| --- | --- |
| Exámenes 6 y 9; examen posterior sin calificar, regla «último si mejor» | 7,5 (media, no 9) |
| Exámenes 6, 9 y 9,5, último corregido y mejor | 9,5 |
| Calificación original 18/20 sin conversión a /10 | Resultado /10 bloqueado; no produce 18/10 |
| Rúbrica: criterios 2,5/3 (peso 2) y 4,5/5 (peso 1) | `10 * ((2,5/3)*2 + 4,5/5) / 3`, sin redondeos parciales |
| Nota anual: evaluación 6 y evaluación 9, tercer periodo todavía sin evaluar | 7,5 en la regla condicional de último |
| Nota de periodo inválida con peso final 0 en media ponderada | No contamina la nota anual |

## Pruebas

- 96 pruebas automatizadas (`npm test`), incluidas 21 nuevas para reglas, escalas, rúbricas, validación y gestión.
- 720 escenarios deterministas calculados contra un oráculo separado para las seis reglas de categoría.
- Recorrido con Chromium **simulado**: edición y restauración de notas, creación de rúbricas, entrada de coma decimal y guardado, gestión de alumnos, grupos y periodos, y presentación estrecha de 390 px, sin errores JavaScript.
- Servidor local: entrega recursos estáticos esperados con HTTP 200 y rechaza recursos internos (pruebas, documentación y archivos ocultos) con HTTP 404.

**No verificado todavía:** navegador real con IndexedDB, AES-GCM y Service Worker desde un origen seguro, desconexión efectiva, restauración tras apagado y Safari/iPadOS/iOS. La navegación de Chromium a `localhost` quedó bloqueada por una política del entorno (`ERR_BLOCKED_BY_ADMINISTRATOR`). Las pruebas simuladas no equivalen a una auditoría de seguridad ni validan la versión 1.0.
