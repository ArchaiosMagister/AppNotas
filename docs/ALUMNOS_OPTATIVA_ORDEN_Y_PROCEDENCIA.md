# Alumnado de asignaturas optativas: apellidos y grupos de procedencia

La **asignatura optativa** funciona como **un solo grupo académico** en AppNotas. Cada alumno puede indicar por separado:
- **Apellidos**: admite dos apellidos, partículas y tildes (por ejemplo, «de la Cruz Pérez»).
- **Nombre**: admite nombres compuestos.
- **Grupo de procedencia**: etiqueta libre y opcional (por ejemplo, «1.º A», «1.º B» o «2.º C»). **No crea otro grupo de la asignatura ni separa notas o medias.**

El formulario **+ Alumno** y **⋯ → Editar nombre, apellidos y procedencia** mantienen los mismos identificadores, notas, reglas individuales y actividades.

## Orden visual de los alumnos

- **Apellidos (A–Z)**: predeterminado, con orden lingüístico español y desempate por nombre.
- **Nombre (A–Z)**: alternativa alfabética.
- **Grupo de procedencia · apellidos**: agrupa a todo el alumnado por su etiqueta, con encabezado de grupo y recuento de alumnos; dentro de cada grupo, orden por apellidos. Los alumnos sin etiqueta quedan al final como «Sin etiqueta».
- **Orden manual**: conserva la posibilidad anterior de subir y bajar alumnos desde «⋯». Los botones de mover están deshabilitados en ordenaciones alfabéticas para no provocar cambios invisibles.

El selector de orden se encuentra en **Cuaderno de notas**, **Evaluación final** y el directorio de **Modo alumno**. Las etiquetas se ven junto a cada nombre incluso cuando el orden es alfabético. La elección de orden se recuerda en el navegador del iPad, pero **no modifica el orden físico del registro ni las calificaciones**, ni se sincroniza con otros dispositivos. En el visor individual solo se muestran las notas del alumno seleccionado.

## Importar CSV

Para importar los tres campos, usar cabeceras como:

    apellidos;nombre;grupo
    García López;Ana María;1.º A
    de la Cruz Pérez;Luis;2.º B
    Martí Ferrer;Clara;1.º A

También se admiten cabeceras «apellido», «grupo de procedencia», «clase» y variantes habituales, archivos con comas o punto y coma y campos entrecomillados. Se rechaza **toda la importación** si falta un nombre o un apellido cuando la columna de apellidos está presente, o si hay etiquetas excesivamente largas.

Un CSV antiguo con la sola cabecera **nombre** seguirá funcionando: su contenido se guarda **sin adivinar cuál es el apellido**. Al editar un registro heredado, se mostrarán sus nombres históricos y deberá completarse el campo de apellidos manualmente.

## Compatibilidad y privacidad

- Los cuadernos cifrados anteriores se abren sin alterar nombres ni intentar separarlos por espacios. Los nuevos campos son opcionales para registros antiguos.
- Los grupos de procedencia, apellidos y nombres **sí se incluyen cifrados** en el archivo .cuaderno junto con las notas; GitHub y Cloudflare siguen alojando exclusivamente el código.
- Para las pruebas, usar datos ficticios. El tratamiento de nombres reales debe ajustarse a las autorizaciones y políticas del centro educativo.
