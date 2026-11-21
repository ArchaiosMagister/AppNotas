# Tercera auditoría y correcciones — CuadernoDocente v1.10

**Fecha:** 21 de noviembre de 2026. **Estado:** candidata de pruebas locales; no subida ni publicada en GitHub.  
**Base examinada:** ZIP de CuadernoDocente v1.9. **Esquema cifrado:** v6 (sin cambios). No se han alterado algoritmos de ponderación ni calificaciones existentes.

## Incidencias reproducidas y corregidas

1. **Ajuste ortográfico que invalida notas ya recuperadas.** En v1.9, cambiar la opción de devolución de faltas de un examen que ya tenía «Entregadas» se aceptaba, pero dejaba el modelo incompatible con sus propias reglas. Ahora se rechaza *antes de modificar ningún campo*, conservando la nota original, el estado de entrega, la configuración, el historial y los eventos. Si el profesor necesita desactivar la devolución, deberá revisar primero los registros entregados.
2. **Importación JSON de rúbricas con pérdida silenciosa de información.** Importar un JSON que contenía niveles y descripciones convertía la rúbrica en una lista de criterios sin niveles. Ahora conserva todas las opciones y descriptores, preservando la ausencia de niveles no disponibles (por ejemplo, el nivel Regular de «Uso del móvil»); rechaza niveles inválidos. Los IDs de los criterios se regeneran para no reutilizar referencias del archivo externo.
3. **Excel con primera hoja de instrucciones.** Si una portada antecedía a la hoja de la rúbrica, el importador detenía la lectura con un error. Ahora continúa hasta una hoja reconocible; nunca ignora fallos de seguridad o una hoja reconocida con valores inválidos.
4. **Excel inválido aceptado demasiado pronto.** Los XLSX en formato «criterio, máximo, peso» podían devolverse al formulario con máximos negativos, y fallar solo al intentar guardar. Ahora se validan los criterios durante la importación.
5. **Exámenes ligados a guardias.** El calendario permitía vincular un examen a una sesión que no era de clase (como una guardia) y asignar su hora automáticamente. Ahora exige una sesión docente si se elige un hueco; para exámenes extraordinarios sin sesión se sigue admitiendo una hora manual.
6. **Parámetros ocultos en operaciones de edición.** El modelo ignoraba propiedades no previstas en algunos parches de actividad y preferencias ortográficas. Ahora solo permite campos declarados, rechazando cambios de identificador, grupo, período o estructura ajena, sin escrituras laterales.

## Batería de comprobación

- **277/277 pruebas Node superadas**, 0 fallidas (10 casos adicionales a las 267 pruebas anteriores).
- Las **3.000 comprobaciones aleatorias de evaluación trimestral y 1.200 de evaluación final** de la v1.9 continúan ejecutándose en `npm test`, con contraste frente a algoritmos independientes. Ninguna regla de cálculo ha sido modificada en esta ronda.
- Pruebas nuevas de atomicidad: los cambios inválidos de ortografía y de identificadores no alteran el documento ni una sola calificación. Pruebas de recuperación consciente y de invariantes con `assertModel`.
- Regresiones de rúbricas: JSON con niveles, descripciones y ausencia deliberada de un nivel; JSON inválido; XLSX con portada; XLSX reconocido pero mal formado.
- **Recorrido visual simulado con Chromium:** carga del HTML autónomo, importación del XLSX original proporcionado por el usuario (cinco criterios, porcentajes 20 y nivel Regular ausente de «Uso del móvil»), importación JSON con descriptores y tarjeta de estadísticas; ningún error JavaScript. Almacenamiento simulado.
- El recorrido previo de estadísticas por actividad, evaluación, categoría y curso, así como la ocultación en modo alumno, se ha repetido satisfactoriamente.
- Se actualizó la versión de caché del Service Worker para impedir reutilizar sin querer los recursos offline de la v1.9. La prueba del HTML autónomo verifica la inclusión de los 17 módulos, los cuatro PDF y los hashes de su CSP.

## Limitaciones de la auditoría

No existe garantía absoluta de ausencia de errores. Las pruebas de navegador ejecutadas en este entorno **no validan IndexedDB real ni Safari real**, especialmente la persistencia al abrir el HTML desde `file://`, los reinicios del sistema, la falta de espacio o la restauración de copias cifradas después de un fallo físico. La revisión no sustituye una auditoría independiente de protección de datos. No usar alumnado real antes de la aceptación del profesor y las validaciones del centro.

### Política de aprobado por redondeo

La aplicación sigue comparando el aprobado con la **nota no redondeada**, aunque muestre dos decimales. En casos frontera (por ejemplo, una nota exacta ligeramente inferior a 5 que se muestra como 5,00), es necesario confirmar la política docente antes de cambiar esta regla. No se ha alterado silenciosamente el criterio de aprobado.

## Recomendaciones para la prueba en Safari

1. Exportar y verificar una copia cifrada `.cdoc` antes de cambiar de HTML.
2. Usar alumnado ficticio y confirmar media trimestral/final, faltas «Entregadas», rúbrica JSON y archivo Excel original.
3. Cerrar Safari, volver a abrir y comprobar recuperación de notas, planificador y configuraciones; probar una restauración `.cdoc` con contraseña.
4. Probar tanto tema claro como oscuro/OLED y las estadísticas ⓘ en un dispositivo táctil real.
5. No publicar todavía; solo hacerlo después de la aceptación explícita del profesor.
