## Apartado propio: Sesiones de evaluación

La gestión de reuniones se encuentra en el menú principal, junto a **Agenda**, bajo **Sesiones de evaluación**. Agenda mantiene la visualización cronológica de las convocatorias y un botón que conduce al nuevo apartado, sin duplicar sus formularios.

El apartado incluye tres pestañas y selector de curso académico:

- **Sesiones:** tarjetas desplegables por tutoría y evaluación. Se puede programar, editar, eliminar o exportar convocatorias; el editor usa panel lateral en escritorio y ventana amplia en móvil/iPad, con campos fecha, inicio, finalización opcional y observaciones. Las posibles coincidencias entre grupos se muestran sin unirlas automáticamente.
- **Tutorías:** propuestas semiautomáticas de grupos equivalentes, confirmación explícita, creación y edición manual de tutorías, alta y retirada de asignaturas y enlace a la gestión de alumnos de varias materias.
- **Vista de notas:** seleccionar tutoría y trimestre y consultar la relación conjunta, con calificaciones decimales y Nota Ítaca por asignatura; no se calcula ninguna media entre Latín y Griego y no hay edición de notas desde el visor.

Se han reutilizado el modelo y los cálculos existentes. La confirmación de una tutoría no unifica fechas antiguas: la conciliación sigue solicitando elegir la convocatoria oficial y archiva íntegros los originales en el cuaderno cifrado. La exportación .ics no está cifrada y sigue requiriendo autorización explícita.

## Hora de finalización de las sesiones de evaluación

En **Agenda → Sesiones de evaluación**, al pulsar **Programar** o **Editar fecha y hora** puedes indicar:
- Día y hora de inicio (obligatorios).
- **Hora de finalización (opcional)**, posterior a la de inicio.
- Lugar u observaciones.

Funciona tanto en las tutorías compartidas como en convocatorias antiguas de Latín y Griego por separado. Las horas se muestran como intervalo (por ejemplo, 15:30–17:15) y se incorporan a la exportación del calendario (.ics). Si dejas el fin vacío, las citas anteriores siguen siendo válidas y el calendario utiliza su duración predeterminada de una hora, sin escribir un fin ficticio en el cuaderno. Se puede modificar o borrar la hora de finalización sin alterar las notas ni las otras sesiones.

## Sesiones de evaluación unificadas por tutoría

En **Agenda → Sesiones de evaluación** se muestra **una única lista**. Cada tutoría es un desplegable y contiene desplegables por trimestre. Las materias de un mismo grupo (p. ej. Latín I / Griego I de 1.º BACH A) aparecen juntas cuando ya están vinculadas.

- Las coincidencias probables de curso, etapa, grupo y procedencia se **agrupan visualmente como propuesta** para evitar filas repetidas; no se guardan ni fusionan sin confirmar «Confirmar tutoría común».
- Al confirmar se guarda la relación; **las convocatorias antiguas siguen intactas**. Si ya hay fechas distintas para la misma tutoría, aparece «Unificar convocatorias» para elegir expresamente la cita oficial y archivar las otras en el cuaderno cifrado.
- Las tutorías que no se pueden identificar con seguridad siguen separadas y pueden asociarse manualmente desde «Gestionar tutorías y vínculos de alumnos».
- El botón superior «Sesiones de evaluación» abre la lista única, sin entrar en un segundo inventario por asignaturas.
- Los cálculos de calificaciones, las matrículas y la agenda de clases no se modifican.

Se recomienda exportar y verificar una copia cifrada antes de reconciliar convocatorias del alumnado real.

## Vincular alumnos entre asignaturas (acceso docente)
En la barra superior abre **Materias y grupos → Vincular alumnos entre asignaturas**.

- Elige el curso académico y dos grupos de **materias diferentes** de la misma etapa.
- Busca y selecciona un alumno en cada grupo, aunque su nombre esté escrito de manera diferente.
- Confirma expresamente que son la misma persona. Se mantiene cada ficha, actividad, nota y regla de evaluación.
- Revisa también «Coincidencias sugeridas» (propuestas sin vinculación automática) y «Vínculos confirmados» (permite desvincular).
- Si se rechaza una vinculación por tutorías incompatibles, comprueba las etiquetas de procedencia de ambos alumnos en Cuaderno → Gestionar procedencias.

Los vínculos se guardan solamente en el cuaderno local cifrado. Antes de probar con datos reales, exporta y verifica una copia cifrada. En Agenda se mantiene la configuración de tutorías y sesiones de evaluación.

> **Versión experimental v1.19:** instalación y actualización PWA, Nota Ítaca y color por categoría. Ver [informe de prepublicación](RESULTADOS_PREPUBLICACION_V119.md). **No publicada aún.**

# CuadernoDocente v1.17 — Tabularium (copias portátiles, prepublicación local)

**No se ha fusionado ni publicado nada.** Nueva versión derivada únicamente del ZIP v1.16. Implementa los controles **Abrir cuaderno** y **Cerrar cuaderno** para exportar/importar archivos `.cuaderno` cifrados con Web Crypto. Mantiene IndexedDB cifrado, guardado automático, la evaluación y las rúbricas existentes. No se conecta a OneDrive ni transmite notas a servidores.

Para llevarlo de un ordenador a otro, desbloquea el cuaderno, pulsa **Cerrar cuaderno → Guardar archivo cifrado**, selecciona OneDrive/iCloud Drive/Archivos si aparece y confirma que el archivo está allí. En el otro dispositivo, pulsa **Abrir cuaderno**, elige ese fichero, introduce su contraseña, revisa el resumen y confirma la importación. El cuaderno local se conserva como rescate cifrado antes de sustituirse. Si tienes copias diferentes, no las combines: conserva ambas y decide expresamente cuál usar. **No se verifica automáticamente la subida ni la sincronización con OneDrive.**

**Limitaciones:** solo un rescate local, sin fusión automática; en Safari la descarga o compartición no acredita que el fichero se haya almacenado; faltan pruebas reales en iPhone, iPad y Safari. Esta edición sigue siendo experimental y debe usarse con **datos ficticios**. Consulta [el informe de pruebas v1.17](RESULTADOS_PREPUBLICACION_V117.md), [la seguridad del formato](docs/SEGURIDAD_CUADERNOS_V117.md) y [el checklist Apple](qa/CHECKLIST_SAFARI_V117.md). **El uso institucional de OneDrive y de notas reales exige autorización y validación adicional del centro/Generalitat; no existe declaración automática RGPD.**

---

# CuadernoDocente v1.16 — Tabularium (prepublicación local)

**No se ha modificado ni publicado GitHub.** Esta versión se ha generado a partir del ZIP `CuadernoDocente_v1.15_tabularium_prepublicacion.zip` y añade reglas de calificación individuales, ausencias justificadas pendientes y comprobaciones de conservación de datos.

## Cambios de v1.16

- **Cuatro reglas por alumno, categoría y evaluación**: (1) regla del grupo, (2) media obligatoria cuando un NP computa como cero, (3) media aritmética siempre, (4) última actividad sustitutiva incluso cuando es más baja. La regla general permanece por defecto y las excepciones se guardan en registros independientes, nunca reescribiendo notas originales.
- Dos accesos docentes: **Cálculos → Reglas por alumno** y **Cuaderno → nota final del alumno → ⚙ Regla individual** en cada categoría. El formulario muestra la nota anterior y una previsualización antes de guardar.
- **AJ · Ausencia justificada pendiente** en todas las actividades, diferenciada de NP y de una casilla vacía. AJ no computa. Si hay nota anterior, conserva la nota, su ID, la puntuación de rúbrica y los metadatos de faltas; al quitar AJ, la nota vuelve a computar. Sin nota anterior se usa un marcador reversible.
- **NP** continúa computando como 0 en las medias y estadísticas. Una recuperación de examen puede sustituir la anterior o conservar la mayor, sin contar ambas como exámenes separados. El botón **↺ Recuperación** ya existente se conserva.
- Las estadísticas de grupo y la evaluación final excluyen AJ, pero incluyen NP. El modo alumno muestra AJ como pendiente y no expone los controles docentes.

## Compatibilidad y seguridad

- Esquema cifrado **v8**: la primera apertura migra una copia v7 sin alterar alumnado, calificaciones o rúbricas. No tiene migración inversa. **Antes de probar, conserva un `.cdoc` de la v1.15** y no intentes abrir con v1.15 una copia creada por v1.16.
- Se conserva el funcionamiento offline, la política CSP del HTML autónomo, las rúbricas, la evaluación final, las competencias, la agenda y la navegación de cursos.
- `npm test`: 334/334 pruebas correctas, incluyendo 20 nuevas y 960 escenarios aritméticos aleatorios contrastados con una implementación independiente.
- La prueba visual con Chromium instrumentado confirma vistas de escritorio, iPad e iPhone simulado en los tres temas, sin errores JavaScript.
- **Pendiente:** validación del HTML abierto directamente en Safari real, almacenamiento IndexedDB `file://`, cierre/reapertura y restauración real con datos ficticios. Chromium en este entorno bloquea el acceso `file://`; no se afirma su validación.

Para ver resultados y pruebas, consulta `RESULTADOS_PREPUBLICACION_V116.md` y `qa/previews/`. La aplicación es experimental: **no introducir información personal real del alumnado.**

---

# CuadernoDocente v1.15 — Tabularium (prepublicación local)

**No publicado en GitHub.** Esta versión deriva exclusivamente del ZIP v1.14 facilitado en la conversación; se han modificado solo presentación, conexión del selector curso–asignatura, etiqueta de versión y caché PWA.

## Cambio v1.15

- **Cinco botones amplios de curso y asignatura**, sin desplegable redundante: Latín 4.º ESO, Latín 1.º Bachillerato, Griego 1.º Bachillerato, Latín 2.º Bachillerato y Griego 2.º Bachillerato. Conser­van el color personalizable de cada materia y resaltan la selección actual.
- Cambiar de botón selecciona **simultáneamente** nivel y asignatura y muestra únicamente los grupos pertinentes, sin alterar ni guardar notas, rúbricas, actividades o calendarios. Los grupos de versiones antiguas sin clasificar siguen teniendo un botón propio por materia.
- En Mac se muestran hasta cinco botones en una fila; en pantallas menores pasan a tres, dos o una columna para conservar legibilidad y objetivos táctiles.
- El texto informativo del cuaderno indica correctamente que las estadísticas solo se abren al **pulsar ⓘ**.
- La asignación dinámica de los colores se hace por CSSOM para respetar la CSP estricta de la versión autónoma. El cache offline PWA usa la clave `cuaderno-docente-static-v115-dev` también en su comprobador.

## Pruebas y seguridad

- `npm test`: **314/314** pruebas automatizadas correctas, incluidas tres nuevas de regresión sobre selección.
- Recorrido de interfaz Chromium simulado: cinco materias, estado seleccionado, foco de teclado, lectura sin escrituras y temas claro/oscuro/OLED, sin errores JavaScript.
- Anchuras visualizadas de **1440, 1024, 835, 390 y 320 px**, sin desbordamiento general y con botones de altura mínima 66 px en las anchuras examinadas.
- Los **16 módulos funcionales `src/` son idénticos byte a byte** a los de v1.14: no se cambian cálculos, NP, faltas, evaluaciones, rúbricas, almacenamiento ni planificador.
- HTML autónomo con JSZip y PDFs integrados y CSP con hashes, sin instalar, para abrir en Safari local con datos ficticios.
- Pendiente: comprobación manual de persistencia real en Safari `file://` y cifrado/reapertura, antes de publicar.

Consulta `RESULTADOS_PREPUBLICACION_V115.md` para el detalle de la verificación y las capturas de `qa/previews/`.

---

# CuadernoDocente v1.14 — Tabularium (prepublicación local)

**No publicado en GitHub.** Trabajamos a partir del ZIP de v1.13 aportado por el usuario. Abre el HTML autónomo `CuadernoDocente_sin_instalar.html` en Safari Mac (solo con datos ficticios y copia cifrada `.cdoc` de seguridad).

- **Estadísticas por pulsación:** las tarjetas de medias y aprobados ya **no** aparecen al pasar el ratón, al enfocar un indicador ni por hover sobre una cabecera. Pulsa o toca el botón ⓘ para abrirla; vuelve a pulsar, pulsa fuera o Escape para cerrarla. Activación accesible desde teclado con Intro o Espacio.
- **Modo alumno mejorado:** al abrir la sección se muestra una lista de alumnos **del grupo activo**. Pulsa el nombre para abrir la ficha individual con sus actividades, notas, medias trimestrales y final del curso. Los botones **Anterior** y **Siguiente** cambian de alumno sin volver al listado y se deshabilitan en los extremos; **Volver al listado** regresa a la selección. El acceso histórico «Ver» del cuaderno sigue funcionando.
- **Privacidad:** la ficha individual oculta la lista del grupo y las estadísticas colectivas. La pantalla inicial de selección sí contiene los nombres, así que selecciona la ficha antes de mostrársela a un alumno.
- **Sin cambios de modelo:** el motor de cálculo, la marca NP, la ortografía recuperable, los porcentajes, el cifrado y los formatos de copia se conservan sin cambios respecto a la v1.13.
- **Verificación:** consulta [RESULTADOS_PREPUBLICACION_V114.md](RESULTADOS_PREPUBLICACION_V114.md) y [checklist Safari](qa/CHECKLIST_SAFARI_V114.md). Prueba visual automatizada con Chromium simulado, no sustituye Safari real. No se ha verificado persistencia de Safari `file://`.

---

# CuadernoDocente v1.13 — Tabularium

Abre `CuadernoDocente_sin_instalar.html` para probar la aplicación de forma local con datos ficticios.

- **Cursos.** Pulsa el botón del curso para cambiar de nivel. Los selectores de asignatura y grupo y las acciones de gestión siguen disponibles. Los grupos de versiones antiguas sin nivel tienen su propio botón hasta que se clasifiquen.
- **No presentado.** Pulsa **NP** junto a la calificación de cualquier actividad. La celda queda marcada y aporta un cero a los cálculos. Pulsa de nuevo para dejarla pendiente o introduce una nota para sustituir NP. Las actividades con rúbrica o faltas se editan con su editor habitual.
- **Copias cifradas.** Antes de actualizar, conserva una copia `.cdoc` hecha desde la v1.12. La v1.13 abre las copias anteriores y las migra al esquema 7. Las copias creadas en v1.13 requieren esta versión o una posterior compatible.

Ejecuta `node --test tests/*.test.mjs` para comprobar los cálculos, los datos, el cifrado y el empaquetado. La prueba `node qa/brave-v113.mjs` requiere un perfil nuevo de Brave con depuración local activada en el puerto 47652.

---

# CuadernoDocente v1.12 — Tabularium · Rediseño de prepublicación

**Edición local para probar en Safari, sin Node y sin publicar en GitHub.** Descarga `CuadernoDocente_sin_instalar.html` y ábrelo directamente en tu Mac. Usa únicamente datos ficticios.

Esta edición incorpora **solo** el rediseño clásico contemporáneo aprobado: navegación lateral plegable y adaptable, cabecera epigráfica, tipografía editorial, tabla de notas más clara, agenda rediseñada, diálogo de creación de actividades con secciones plegables y tres temas (claro, oscuro y OLED). Los acentos por asignatura y los colores de las notas se conservan.

**Integridad:** los 16 módulos funcionales de `src/` no han cambiado respecto a v1.11. Se han superado **300 de 300 pruebas automatizadas** y un recorrido visual con Chromium simulado. Sigue pendiente la aceptación de persistencia en Safari real.

- [Informe de rediseño y verificaciones](RESULTADOS_PREPUBLICACION_V112.md)
- [Checklist Safari](qa/CHECKLIST_SAFARI_V112.md)
- [Historial de auditorías y funcionamiento anterior](RESULTADOS_PREPUBLICACION_V111.md)

---

# CuadernoDocente v1.11 — prepublicación, cuarta auditoría

**Candidata local: no publicada en GitHub.** Abrir `CuadernoDocente_sin_instalar.html` con Safari Mac sin Node. Exclusivamente con alumnado ficticio. Antes de actualizar, exportar copia cifrada `.cdoc`; la persistencia real de Safari `file://` continúa pendiente de aceptación.

La v1.11 incorpora correcciones de integridad de entregas ortográficas, CSV, Excel, JSON y copias entre períodos; las operaciones inválidas se rechazan sin modificar notas. No altera las fórmulas docentes ni el esquema de cifrado v6. **294/294 pruebas automatizadas correctas.** Ver [informe de cuarta auditoría](RESULTADOS_PREPUBLICACION_V111.md) y [checklist de Safari](qa/CHECKLIST_SAFARI_V111.md).

---

# CuadernoDocente v1.10 — prepublicación, tercera ronda de correcciones

**Versión local para pruebas, no publicada en GitHub.** Abrir `CuadernoDocente_sin_instalar.html` en Safari Mac sin Node ni servidor; usar datos ficticios y exportar una copia cifrada `.cdoc` antes de cambiar de versión. El almacenamiento real con `file://` continúa pendiente de aceptación en Safari.

Esta ronda corrige la edición de exámenes con faltas entregadas, preserva los descriptores de las rúbricas JSON, mejora la importación de libros Excel con hoja de instrucciones, valida antes las rúbricas inválidas y restringe la vinculación de exámenes a sesiones de clase. Refuerza las validaciones de edición para evitar modificaciones inesperadas. **No cambia las fórmulas de notas ni el esquema cifrado v6.**

**Pruebas:** 277/277 en Node y recorrido de navegador simulado; consulta [informe completo v1.10](RESULTADOS_PREPUBLICACION_V110.md) y [checklist de Safari](qa/CHECKLIST_SAFARI_V110.md).

---

# CuadernoDocente v1.9 — prepublicación (auditoría matemática e integridad)

**Candidata local de pruebas: no se ha publicado en GitHub.** Antes de sustituir la v1.8, exporta una copia cifrada `.cdoc`; usa alumnado ficticio. Abre `CuadernoDocente_sin_instalar.html` con Safari Mac, sin Node ni servidor. El guardado `file://` en Safari real sigue pendiente de validación.

La v1.9 incorpora una revisión exhaustiva de no interferencia entre grupos, preservación de vínculos competenciales y validación previa a las modificaciones. No cambia ninguna fórmula de cálculo ni el esquema cifrado (v6). Los cambios y las limitaciones están documentados en [la auditoría v1.9](RESULTADOS_PREPUBLICACION_V19.md) y el [protocolo de Safari](qa/CHECKLIST_SAFARI_V19.md).

---

# CuadernoDocente v1.8 · Prepublicación (estadísticas por elemento de calificación)

> **Versión para probar localmente con datos ficticios. Sin publicación en GitHub.** Archivo para Safari Mac: `CuadernoDocente_v1.8_prepublicacion_sin_instalar.html` (en el ZIP: `CuadernoDocente_sin_instalar.html`). Antes de cambiar de versión, exporta una copia cifrada `.cdoc` del cuaderno anterior y verifica su restauración.

## Novedad v1.8: estadísticas de la clase al pasar el ratón o tocar

- En el cuaderno, pasa el ratón sobre la **cabecera de una actividad** o sobre **Nota final**, o pulsa/toca el botón **ⓘ** de su cabecera. También accesible con teclado mediante Tab y Escape.
- En **Evaluación final** están disponibles las estadísticas de **cada evaluación** (incluidas las notas manuales) y de la **nota final del curso**.
- Hay indicadores adicionales para categorías en **Cálculos** y competencias vinculadas en **Competencias (notas)**.
- La tarjeta presenta **media**, **aprobados / total del grupo (porcentaje)** y **alumnos con nota / total**. También indica el porcentaje de aprobados entre quienes tienen nota.
- La media solo contempla calificaciones existentes; una casilla vacía no suma cero ni se cuenta como suspenso. El porcentaje principal utiliza **todo el grupo** como denominador, incluyendo alumnos sin nota; el número de evaluados se muestra aparte.
- Cada actividad usa la escala que se ve en la tabla: notas /10 tras conversión o penalización, o escala original si la conversión está desactivada. Aprobado = mitad de la escala; los cálculos no redondean antes de comparar. Las medias de evaluación y de curso emplean las reglas habituales de recuperaciones, categorías y ajustes manuales, sin duplicar resultados.
- **Privacidad**: estas tarjetas no aparecen en «Modo alumno»; las estadísticas se calculan en memoria, no se guardan en la base de datos ni se sincronizan.

## Verificación

Consultar `RESULTADOS_PREPUBLICACION_V18.md`. Las pruebas automatizadas y los recorridos simulados en Chromium **no sustituyen** a las pruebas en Safari reales ni validan por sí solos el almacenamiento al abrir mediante `file://`.

---

# CuadernoDocente v1.7 — prepublicación (segunda auditoría y correcciones)

> **Pruebas con datos ficticios**. No se han publicado estos cambios en GitHub. La versión de doble clic se entrega aparte como `CuadernoDocente_v1.7_prepublicacion_sin_instalar.html`. Puedes abrirla en Safari Mac **sin instalar Node ni ejecutar un servidor**. Las pruebas de IndexedDB en Safari real siguen pendientes. Haz una **copia cifrada `.cdoc` antes de cambiar de archivo** y restáurala si el nuevo archivo abre un almacén independiente.

**Novedad v1.7:** segunda ronda de auditoría con trece pruebas adicionales (233 en total); protección al recortar fechas académicas para que no queden eventos fuera del curso; traslado de contenidos pendientes a la próxima clase real del mismo grupo, incluso si es otro día o la segunda clase de la misma jornada; consultas de calificaciones acotadas al grupo correspondiente; límite de dos decimales aplicado también a puntuaciones numéricas internas. Cálculos de varias categorías optimizados mediante un índice temporal por alumno, sin caché entre ediciones ni cambios de resultado. Mantiene el **esquema cifrado v6**. [Informe y limitaciones](RESULTADOS_PREPUBLICACION_V17.md).

**Novedad de la v1.6 (histórica):** mejoras de rendimiento en el cálculo de calificaciones, corrección de horas de exámenes cuando se edita una excepción del horario, límites adicionales para XLSX y validaciones de integridad del planificador. No se ha modificado la fórmula docente de calificación. Resultados y limitaciones en [el informe de auditoría v1.6](RESULTADOS_PREPUBLICACION_V16.md) y [el protocolo actualizado de aceptación en Safari](qa/CHECKLIST_SAFARI_V17.md).

[Cambios del Planificador en v1.4](docs/CAMBIOS_PREPUBLICACION_V14.md) y [cambios anteriores](docs/CAMBIOS_PREPUBLICACION_V13.md) y [resultados de pruebas de v1.4](RESULTADOS_PREPUBLICACION_V13.md). Las verificaciones de v1.1 y v1.2 se conservan como histórico.

Cuaderno local de calificaciones de Latín y Griego. Esta versión candidata se ha probado con datos ficticios. La aceptación para uso con alumnado real sigue pendiente de las verificaciones indicadas en el [informe](docs/ESTABILIZACION_RC1.md).

## Abrir la versión autónoma (recomendada para la prueba)

1. Descarga el archivo HTML independiente `CuadernoDocente_v1.9_prepublicacion_sin_instalar.html`.
2. Ábrelo con **Safari** usando «Abrir con → Safari». No necesita Node ni instalar programas.
3. Utiliza únicamente alumnado ficticio. Comprueba que las notas se conservan al cerrar y abrir Safari, y prueba la exportación/restauración de una copia cifrada.
4. La edición autónoma no es instalable como PWA y la persistencia de `file://` puede variar entre versiones del navegador. La carpeta fuente permite hacer pruebas mediante servidor HTTPS o localhost.

## Ejecutar código fuente (opcional)

1. Descomprime el ZIP en una carpeta de tu Mac e instala Node.js 20 o posterior.
2. En Terminal, entra en esa carpeta y ejecuta `npm start` o `node server.mjs`. La aplicación carece de dependencias npm.
3. Abre [http://127.0.0.1:4173/](http://127.0.0.1:4173/) con el navegador de prueba. Crea una contraseña de al menos 12 caracteres. Para empezar desde una copia existente, selecciona **Restaurar una copia cifrada** en la misma pantalla.
4. En **Ajustes y copias**, comprueba los recursos offline. Antes de trabajar sin conexión por primera vez, deja que termine la instalación de esos recursos y prueba una recarga con el servidor detenido.

Para actualizar una instalación local, exporta y verifica una copia, detén el servidor anterior y arranca esta carpeta con el mismo puerto. Abre la misma dirección desde el mismo perfil de navegador y comprueba que aparece `v1.9`. El almacenamiento depende del navegador, perfil, dirección y puerto. Cambiar cualquiera de esos elementos puede abrir un almacén distinto.


## Penalización recuperable de faltas (nuevo en v1.5)

Para **nuevas actividades de la categoría Exámenes**, la opción «Penalización por faltas de ortografía» se activa por defecto. Cada examen puede tener su propia configuración: descuento por falta (0,10 puntos por defecto), repeticiones requeridas (30 por defecto) y recuperación de la nota (activada). Se puede activar también en otras actividades numéricas con conversión a 0–10, pero no en rúbricas ni notas que no se conviertan a diez. Las columnas de exámenes **creadas antes de v1.5 siguen sin penalización** hasta que las actives expresamente desde **⋯ → Editar datos**; no se modifican medias históricas sin consentimiento.

Al pulsar una nota de un examen que tiene esta opción activa aparece un editor con **Nota original sin faltas**, **Número de faltas** y la casilla **Entregadas — faltas copiadas N veces**. La nota que se utiliza para las medias se calcula así: `máximo(0, nota original convertida a diez − número de faltas × descuento)`. Al marcar «Entregadas», cuando esté habilitada la recuperación, se utiliza la nota original completa; al desmarcarla vuelve la penalización. La casilla queda inhabilitada si no hay faltas o si el examen no admite devolución. La entrega es una **confirmación manual** del profesor, no una comprobación automática de copias.

El cuaderno muestra la **nota efectiva sobre diez como principal**, y debajo la nota original, faltas y descuento o la confirmación de entrega. Esta misma nota efectiva se propaga una sola vez a las categorías, recuperaciones, competencias, evaluación del periodo y evaluación final. Internamente se preservan el valor base y los metadatos de faltas sin redondeos intermedios; los valores introducidos admiten hasta dos decimales. Puedes ajustar valores predeterminados en **Ajustes y copias → Valores predeterminados para faltas**; solo afectarán a actividades creadas después. Al copiar columnas a otros trimestres se replican las reglas, **nunca** las notas ni las faltas.

La versión v1.5 actualizó el esquema cifrado de datos a 6, con migración probada de v1.4 (esquema 5) sin modificar notas previas. **Antes de abrir otro archivo HTML autónomo, descarga y verifica una copia cifrada `.cdoc`**. En Safari la dirección `file://` de diferentes archivos puede abrir almacenamientos separados; si no aparecen tus datos, restaura esa copia. Prueba exclusivamente con alumnado ficticio.

[Detalle técnico y pruebas](docs/CAMBIOS_PREPUBLICACION_V15.md).

## Planificador docente (nuevo en v1.4)

**Planificador** es una pestaña nueva y autónoma, dentro de la misma copia cifrada que el cuaderno de calificaciones. Configura el año académico en **Fechas** y las sesiones de lunes a viernes en **Horario base → + Clase / horario**, eligiendo grupo existente o asignatura manual. Incluye clases, guardias, atención a familias, hora complementaria, reunión y jefatura de departamento. Utiliza **Hoy/día**, **Semana** y **Mes** para programar las clases. Cada sesión acepta «Qué voy a hacer»; marcar como realizada y escribir qué se hizo es **opcional**. Se pueden trasladar pendientes a la siguiente sesión lectiva.

En **Cuaderno → Programar examen** o «⋯» de la columna → «Programar examen», elige una fecha; el programa deduce la hora si el grupo tiene una única clase ese día, pide elegir si hay varias y permite hora manual en caso contrario. Los eventos se pueden crear y editar también desde el calendario. Incluye festivos, vacaciones, cambios excepcionales, tareas personales, creación de cursos y copia de la estructura del horario de un año a otro. La impresión y exportación `.ics` son manuales. **Los archivos `.ics` exportados no están cifrados y pueden contener anotaciones personales.** No hay conexión con calendarios externos ni se modifican notas al planificar.

Consulta [las características y la validación de v1.4](docs/CAMBIOS_PREPUBLICACION_V14.md). El horario y el diario son privados y se guardan únicamente en el cuaderno local cifrado; crea y comprueba una copia `.cdoc` con datos ficticios antes de probar otra versión.

## Registrar calificaciones

Selecciona curso y asignatura, crea un grupo y añade alumnos ficticios manualmente o por CSV. Crea una actividad con su máximo y marca si se convierte a diez. Las notas escritas admiten como máximo dos decimales. Cuando una actividad se convierte desde otra escala, la nota sobre diez se muestra **grande y coloreada arriba**; debajo aparece **entre paréntesis la nota original, editable**. Pulsar la cifra principal coloca el cursor en el campo original. En la barra de períodos, **+ Período** crea otra evaluación y el lápiz junto al nombre permite renombrarla o cambiar su orden sin perder calificaciones. En **Cálculos**, configura los pesos de las categorías del grupo y periodo. Puedes retirar una categoría vacía del grupo sin modificar las columnas de otras asignaturas; si tiene actividades en cualquier trimestre del grupo, antes debes moverlas o eliminarlas. Las categorías creadas a partir de esta versión son propias del grupo. Usa coma o punto para los decimales. Introduce `0` para una nota cero. Vacía la casilla para quitar la nota. Pulsa Intro para bajar una fila tras registrar una nota.

Elige una rúbrica al crear una actividad si quieres calificarla mediante criterios. En **Evaluación final**, puedes sustituir la nota automática de un periodo por una manual. Vaciar la nota manual recupera el cálculo automático. Consulta las explicaciones de las medias desde el cuaderno y las tarjetas normativas desde **Currículo**.

## Aspecto

En la cabecera puedes elegir **Claro, Oscuro u OLED**. El modo OLED utiliza negro puro de fondo y bandas de tabla muy oscuras para distinguir filas. Las filas alternan fondos con contraste suave pero claramente perceptible, y el color específico de la materia se aplica a más elementos de navegación y paneles. La preferencia de aspecto se intenta conservar localmente en el navegador y no altera las calificaciones. Los colores de las notas sobre diez son: granate (0–3,49), rojo vivo (3,50–4,99), amarillo (5–5,99), verde (6–6,99), azul claro a oscuro (7–9,99) y morado (10).

## Copia y restauración

1. Espera a que aparezca **Guardado cifrado**. Ve a **Ajustes y copias → Descargar copia cifrada** y conserva el archivo `.cdoc` fuera del navegador. Guarda la contraseña que abre esa copia.
2. Selecciona **Verificar copia** e introduce su contraseña. Comprueba los recuentos que muestra la aplicación.
3. Para reemplazar el cuaderno, verifica la copia y exporta primero el estado actual. Selecciona **Restaurar copia** o usa la opción de restauración de la pantalla de desbloqueo. Confirma la sustitución y revisa una muestra de notas.
4. Usa **Recuperar versión anterior** para intercambiar el cuaderno activo con el rescate cifrado. Necesitas la contraseña del rescate. Puedes descargar ese rescate antes de volver a restaurar. IndexedDB conserva un punto de rescate y una nueva restauración lo sustituye.
5. Si el guardado falla y aparece **Descargar intento cifrado**, descárgalo antes de salir. Tras volver a abrir, exporta también el cuaderno vigente y verifica ambos archivos. Cada copia es un cuaderno completo. La restauración del intento sustituye el conjunto y el contenido requiere reconciliación manual si hubo cambios en otra pestaña.

## Verificación

- [Resultados ejecutados](RESULTADOS_PRUEBAS.md)
- [Incidencias, cambios y compatibilidad](docs/ESTABILIZACION_RC1.md)
- [Protocolo pendiente en Safari](qa/PROTOCOLO_SAFARI.md)
- [Fuentes curriculares](docs/CURRICULOS_FUENTES.md)
- [Modelo de datos](docs/MODELO_DATOS.md)

## Competencias específicas por materia

La pestaña **Competencias (notas)** presenta las cinco competencias oficiales completas para cada una de las cinco materias (Latín 4.º, Latín I, Griego I, Latín II y Griego II), a partir de los extractos curriculares incluidos. No mezcla competencias entre grupos ni calcula resultados sin seleccionar antes los pesos relativos de categorías; las competencias propias anteriores quedan disponibles por separado y sus notas se preservan. La biblioteca «Currículo» sigue ofreciendo criterios y saberes. **Atención al calendario normativo:** para Latín II en 2026–2027 se utiliza por defecto el currículo de 2022 y se permite consultar el de 2026, aplicable desde 2027–2028; para Griego II solo se ha facilitado el currículo de 2026, por lo que para 2026–2027 se advierte que es referencia futura y no se atribuye falsamente una versión de 2022.
