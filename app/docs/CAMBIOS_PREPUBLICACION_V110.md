# Cambios v1.10



1. **Ajuste ortográfico que invalida notas ya recuperadas.** En v1.9, cambiar la opción de devolución de faltas de un examen que ya tenía «Entregadas» se aceptaba, pero dejaba el modelo incompatible con sus propias reglas. Ahora se rechaza *antes de modificar ningún campo*, conservando la nota original, el estado de entrega, la configuración, el historial y los eventos. Si el profesor necesita desactivar la devolución, deberá revisar primero los registros entregados.
2. **Importación JSON de rúbricas con pérdida silenciosa de información.** Importar un JSON que contenía niveles y descripciones convertía la rúbrica en una lista de criterios sin niveles. Ahora conserva todas las opciones y descriptores, preservando la ausencia de niveles no disponibles (por ejemplo, el nivel Regular de «Uso del móvil»); rechaza niveles inválidos. Los IDs de los criterios se regeneran para no reutilizar referencias del archivo externo.
3. **Excel con primera hoja de instrucciones.** Si una portada antecedía a la hoja de la rúbrica, el importador detenía la lectura con un error. Ahora continúa hasta una hoja reconocible; nunca ignora fallos de seguridad o una hoja reconocida con valores inválidos.
4. **Excel inválido aceptado demasiado pronto.** Los XLSX en formato «criterio, máximo, peso» podían devolverse al formulario con máximos negativos, y fallar solo al intentar guardar. Ahora se validan los criterios durante la importación.
5. **Exámenes ligados a guardias.** El calendario permitía vincular un examen a una sesión que no era de clase (como una guardia) y asignar su hora automáticamente. Ahora exige una sesión docente si se elige un hueco; para exámenes extraordinarios sin sesión se sigue admitiendo una hora manual.
6. **Parámetros ocultos en operaciones de edición.** El modelo ignoraba propiedades no previstas en algunos parches de actividad y preferencias ortográficas. Ahora solo permite campos declarados, rechazando cambios de identificador, grupo, período o estructura ajena, sin escrituras laterales.

