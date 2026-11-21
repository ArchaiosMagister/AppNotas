# Reorganización de interfaz B — AppNotas (iPad, móvil y escritorio)

Esta fase reorganiza **únicamente la presentación** y los accesos a funciones existentes. No modifica los datos de los alumnos, el modelo académico, las fórmulas de calificaciones, Ítaca, las rúbricas, las competencias, el planificador, el cifrado ni las copias portátiles.

## Navegación priorizada

Cuatro pantallas aparecen siempre como accesos principales: **Cuaderno**, **Modo alumno**, **Agenda** y **Evaluación final**.

**Gestión académica** agrupa sin eliminar:
- Cálculos (porcentajes, reglas individuales, categorías y colores).
- Competencias y sus vínculos.
- Currículo.
- Rúbricas.

**Ajustes y copias** conserva su acceso independiente. No se han movido formularios a otra pantalla: se ha cambiado su *posición en la navegación* para evitar que nueve destinos compitan visualmente a la vez.

En escritorio sigue habiendo una barra lateral plegable. En iPad y teléfonos los cuatro destinos se ven en una fila de navegación táctil y las demás secciones aparecen bajo Gestión académica; la navegación se mantiene accesible sin desplazamientos horizontales.

## Cabecera más clara

Se mantienen visibles la identidad de la aplicación, el estado del guardado cifrado, el acceso a **Herramientas** y el bloqueo de cuaderno.

**Herramientas** agrupa:
- Selección de aspecto (claro, oscuro y OLED).
- Abrir y cerrar cuaderno (incluidos el selector de archivo y el procedimiento de copia cifrada).
- Instalación de la PWA y búsqueda de actualizaciones.
- Deshacer y rehacer.

No se alteran las operaciones ni se ejecuta ninguna por abrir el menú.

## Asignatura y grupo

La asignatura se identifica con su nombre y etapa en un selector resumido; al abrirlo siguen estando los botones de todos los cursos existentes. El **grupo** seleccionado y **+ Grupo** se ven sin abrir menús.

**Opciones de grupo** reúne:
- Editar grupo y curso escolar.
- Color de acento.
- Clasificar grupo antiguo, si procede.
- Importar CSV de alumnos.
- Crear recuperación.

La selección y las operaciones mantienen los IDs, los alumnos y sus notas.

## Cuaderno de notas

Junto al encabezado de la tabla se mantienen visibles las dos acciones más repetidas, **+ Alumno** y **+ Actividad**. Dentro de **Más acciones** están **Copiar actividades** y **Programar examen**.

La tabla mantiene intactos: entrada de notas y salto con Enter, NP/AJ, botón de observación, penalización de ortografía, rúbricas, colores de categoría, estadísticas por columna, medias, Nota Ítaca, orden por grupo de procedencia y períodos de evaluación.

## Adaptación a pantalla

- **Escritorio:** barra lateral y grupos de herramientas con acceso contextual.
- **iPad horizontal y vertical:** barra superior compacta, cuatro destinos priorizados; las tablas conservan su desplazamiento interno y la primera columna fija.
- **Móvil:** botones y campos táctiles de al menos 40–44 px, selección de asignatura expandible sin desbordarse, cuatro destinos principales distribuidos en una sola línea, Gestión académica desplegable y botones de operación dentro de menús de ancho adaptable.
- **Claro/oscuro/OLED:** se conservan los colores configurados de asignaturas, categorías y notas. Los menús siguen el tema actual.
- **Accesibilidad:** controles de detalles con teclado, indicador de foco, etiquetas de navegación y títulos; las funcionalidades permanecen en el DOM.

## Criterios de aceptación

1. Los nueve destinos originales son accesibles, incluida Evaluación final.
2. Todos los botones antiguos funcionan y no hay controles duplicados con el mismo ID.
3. Las acciones de copias, desbloqueo, recuperación y actualización PWA mantienen su flujo.
4. Las calificaciones y cálculos son idénticos antes y después de la actualización.
5. iPad y teléfono no necesitan desplazamiento lateral de toda la página; el desplazamiento horizontal queda limitado a tablas con muchas columnas.
6. Con la pantalla del modo alumno abierta se sigue ocultando el entorno del profesor.
7. Se comprueban los temas claro, oscuro y OLED y el comportamiento de los menús desplegables.
8. No se reinicia ni se limpia IndexedDB, ni se cambia el origen Cloudflare.

El nuevo diseño requiere una comprobación visual práctica en Safari/iPadOS incluso después de superar pruebas automatizadas. Antes de actualizar, es recomendable conservar una copia externa .cuaderno cifrada y verificada.
