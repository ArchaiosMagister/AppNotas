# Cambios de v1.3 — prepublicación (21 de noviembre de 2026)

Este paquete es una candidata local para probar con datos ficticios. **No se ha publicado ni fusionado en GitHub.** El proyecto conserva el motor de cálculos y cifrado, su modelo de datos y sus archivos curriculares, sin sincronización remota.

1. **Conversión 0–10:** en el cuaderno, un valor como `4,25 /5` convertido aparece **8,50** como nota principal coloreada, con `(4,25 /5)` debajo. El valor original permanece editable y pulsar el principal enfoca ese campo. El modo alumno sigue el mismo orden. No se modifican los valores almacenados ni los cálculos internos.
2. **Períodos:** el botón `+ Período` está integrado al final de las pestañas de evaluación, antes de la Evaluación final fija. Cada pestaña tiene un lápiz propio para renombrarla con toque/clic; doble clic en el nombre también permite cambiarlo. El diálogo de renombrado conserva los controles de reordenación anterior/siguiente, con confirmación porque puede afectar reglas que usan la última evaluación. Los IDs y las notas permanecen intactos.
3. **Filas alternas:** se refuerza la diferencia cromática en Claro, Oscuro y OLED, respetando filas fijas de nombres y la columna final. Los colores de nota conservan su paleta y contraste WCAG AA.
4. **Acento de materia:** colorea además borde de la cabecera, encabezado del curso, títulos de secciones, cabeceras de tabla, controles de períodos, selección de pestañas, focos y casillas de selección. La nota conserva su paleta independiente.
5. **Competencias:** la pestaña «Competencias (notas)» incorpora las cinco CE específicas de Latín 4.º, Latín I, Griego I, Latín II y Griego II, con textos oficiales **sin resumir** procedentes de `data/curriculos/`. Las CE son distintas por grupo y versión, configurables con pesos de categorías no presuntos. Si no se vinculan categorías no se genera nota competencial. Competencias personalizadas previas se mantienen. En Latín II se respeta vigencia del currículo 2022 para 2026–2027 y versión 2026 desde 2027–2028; en Griego II la fuente disponible es 2026 (vigencia desde 2027–2028), por lo que se advierte explícitamente de esa limitación al consultar en 2026–2027.

## Integridad y límites

- Se mantiene `schemaVersion=5`: las nuevas relaciones de competencia son atributos opcionales compatibles con copias anteriores.
- No se trasladan calificaciones entre grupos. Una consulta competencial verifica la pertenencia tanto de competencia como de alumno al grupo.
- La caché PWA cambia de identificador e incorpora `src/official-competencies.js`.
- Las pruebas de navegador son instrumentadas en Chromium, no sustituyen la aceptación de Safari real. Abrir `file://` puede tener limitaciones específicas de IndexedDB; exporta y verifica la copia `.cdoc` antes de actualizar.
