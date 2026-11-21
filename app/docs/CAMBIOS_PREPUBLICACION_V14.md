# CuadernoDocente v1.4 · Planificador docente (prepublicación)

## Prioridad y alcance

Planificador personal de futuro integrado como **apartado independiente** del cuaderno de calificaciones. El registro histórico de clases es **opcional**: por defecto se consignan solo planes pendientes; el campo «trabajo realizado» y la casilla «Realizada» no son obligatorios.

## Funciones

- **Horario semanal de lunes a viernes**, editable por sesión de inicio/fin. Cada sesión puede corresponder a un grupo de Latín o Griego del cuaderno, a una asignatura manual o a Guardia, Atención a familias, Hora complementaria, Reunión de departamento, Jefatura de departamento u Otra actividad. Los colores de los grupos se heredan del cuaderno.
- **Vistas Hoy/día, Semana, Mes y Horario base**. El botón Hoy abre la fecha local del dispositivo. En el calendario mensual, pulsar un día abre su agenda.
- **Exámenes y eventos** desde Planificador o desde **Cuaderno → Programar examen**. También hay un botón en las opciones «⋯» de cada columna, que permite vincular ese examen a la actividad sin incluir notas. La fecha y grupo determinan automáticamente la hora si hay una única sesión compatible. Si hay varias clases, se elige una; sin clase, puede asignarse una hora manual. Si el horario cambia de hora, un examen vinculado a esa sesión actualiza su hora. El evento se conserva si se borra la columna de notas, sin mantener referencias inválidas.
- **Trabajo diario** por clase, grupo o asignatura manual: campo «Qué voy a hacer». Opcionalmente se puede marcar como realizado y anotar qué se ha impartido. La planificación pendiente puede trasladarse a la próxima clase lectiva, sin saltarse festivos o cancelaciones y sin sobreescribir una sesión ya planificada.
- **Festivos y vacaciones** de un día o intervalo. Impiden mostrar las clases ordinarias, sin eliminar anotaciones ni eventos ya guardados.
- **Cambios excepcionales** de fecha: cancelar, sustituir actividad o cambiar hora sin modificar el horario base. También se pueden editar y eliminar.
- **Fechas de inicio y fin del curso académico**, configurables. Se pueden crear cursos adicionales y copiar solo la estructura del horario, sin copiar exámenes, tareas, días lectivos o anotaciones. Los anteriores se conservan.
- **Tareas docentes y recordatorios** independientes del cuaderno: vencimiento, grupo opcional, estado pendiente/realizado.
- **Imprimir** la planificación visible y **exportar `.ics`** los eventos y tareas para importación manual en Apple Calendar u otra agenda. No hay sincronización remota.

## Integridad y privacidad

El planificador vive dentro del documento cifrado del cuaderno, sujeto a las mismas contraseñas, guardados, restauraciones `.cdoc`, deshacer y rehacer. La migración de un cuaderno v1.3 añade el planificador sin tocar grupos, actividades, rúbricas, alumnos ni calificaciones. Se mantiene la versión de esquema 5 con un campo adicional opcional y se valida cualquier dato guardado. En la exportación `.ics` aparece una advertencia: el calendario descargado **no está cifrado**. Solo deben utilizarse datos ficticios para las pruebas.

## Comprobaciones y límites

**183 pruebas de Node superadas**, incluidas 26 nuevas sobre el planificador; no se han detectado regresiones en los cálculos. Prueba visual de Chromium simulado: creación de horario, guardias, trabajo planificado y realizado, examen desde el cuaderno con hora deducida, festivos, tareas, navegación mensual, excepciones editables, exportación ICS, tres temas y vista móvil. Sin errores JavaScript en este recorrido. CSP y precache ampliados, sin bibliotecas remotas.

**Pendiente**: pruebas reales de Safari Mac / iPhone / iPad del guardado cifrado, cierre/reapertura, restauración y exportación de ficheros. El archivo HTML autónomo se abre sin Node, pero `file://` puede tener restricciones de IndexedDB variables según el navegador. Se recomienda guardar y verificar una copia `.cdoc` antes de cambiar de versión.

**Publicación**: no se ha subido esta versión a GitHub ni se ha activado GitHub Pages.
