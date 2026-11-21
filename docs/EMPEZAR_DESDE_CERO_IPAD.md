# Empezar desde cero en AppNotas (iPad)

Instalación principal: https://appnotas-docente.pages.dev/. No alternar versiones instaladas en otros contextos ni con la antigua GitHub Pages para editar el mismo cuaderno: sus bases IndexedDB no se sincronizan.

## Primera apertura: elección inicial

Cuando todavía **no existe un cuaderno guardado en esa instalación**, la pantalla inicial ofrece:

- **Crear cuaderno vacío** (opción principal): tres evaluaciones —1.ª, 2.ª y 3.ª— y las categorías Exámenes (60 %), Trabajos (30 %) y Actitud (10 %). No se crea ningún grupo, alumno, actividad, calificación, competencia o cita de agenda. El planificador académico inicial queda vacío y puede configurarse.
- **Crear cuaderno de demostración**: conserva exactamente el ejemplo anterior de Latín I, con ocho alumnos ficticios, cuatro actividades y notas para practicar.

Ambas opciones obligan a crear una contraseña de **12 caracteres como mínimo**. La contraseña no se envía al servidor y no hay cuenta docente. Debe conservarse, pues es necesaria también para abrir las copias cifradas.

Si aparece **«Desbloquear»**, ya existe un cuaderno local: crear uno nuevo desde esa pantalla sobrescribiendo silenciosamente el anterior no está permitido. Para empezar de cero, seguir el procedimiento de reinicio.

## Reiniciar un cuaderno ya existente

1. Abrir el cuaderno con su contraseña y esperar a **«Guardado cifrado»**. En **Ajustes y copias**, pulsar **«Guardar copia portátil (.cuaderno)»** y guardar físicamente el archivo fuera del navegador; comprobar su presencia en Archivos o en una ubicación externa autorizada.
2. Pulsar **«Reiniciar cuaderno (requiere copia comprobada)»**, en el apartado **«Empezar de cero»**. Seleccionar el archivo .cuaderno de la revisión actual. Se pide su contraseña y se descifra y valida el archivo.
3. Si el archivo es antiguo, es de otro cuaderno o no coincide exactamente con el estado actual, se rechaza el reinicio sin cambiar datos. No sirve una copia histórica .cdoc, una descarga no localizada ni el mero aviso de exportación.
4. Si coincide, aparece un resumen de grupos, alumnos, notas y rúbricas. Para continuar, escribir **REINICIAR** de forma exacta y confirmar. Cancelar, cerrar el cuadro de diálogo o introducir un texto diferente no sustituye el cuaderno.
5. La aplicación guarda, en **una misma transacción IndexedDB**, el nuevo cuaderno vacío cifrado y **un rescate cifrado del cuaderno anterior**. Mantiene la contraseña original, pero cambia la identidad del cuaderno. El rescate interno solo conserva una versión, que se reemplazará en una nueva restauración/reinicio; por ello hay que mantener el archivo externo.
6. Si otra pestaña cambió las notas desde que se comprobó la copia, o si hay errores de escritura, se cancela sin sobrescribir. Ante un fallo, no borrar IndexedDB ni reinstalar la PWA: conservar el archivo y recargar la instalación original.
7. Tras el reinicio, comprobar que no hay alumnos ni notas de ejemplo, crear el primer grupo de prueba, guardar una copia cifrada nueva y verificarla.

## Qué se elimina y qué se conserva

- **Nuevo cuaderno:** sin grupos, alumnos, actividades, calificaciones, rúbricas, competencias, reglas especiales ni sesiones/actos de agenda antiguos; tres evaluaciones y las categorías básicas; nuevo identificador e historial.
- **Contraseña:** se conserva para desbloquear el nuevo cuaderno. No se modifica mediante el reinicio.
- **Rescate interno:** el cuaderno anterior queda cifrado en un único punto de recuperación accesible desde Ajustes y copias. No es una eliminación segura/forense ni un borrado de copias externas.
- **Archivo externo:** permanece donde lo guardaste; la aplicación no lo borra ni lo puede sincronizar automáticamente.
- **Código:** el procedimiento no afecta al origen Cloudflare, repositorio GitHub, planes académicos, cálculos o motor de notas.

**Privacidad:** herramienta experimental sin autorización institucional expresa para introducir datos identificativos reales. Utilizar datos ficticios en las pruebas.
