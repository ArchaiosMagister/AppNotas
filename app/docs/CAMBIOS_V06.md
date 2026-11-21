# CuadernoDocente v0.6 — integridad del almacenamiento y preparación offline

## Alcance

Continuación exacta de la v0.5. Se mantiene el **esquema v5** del cuaderno, el formato `.cdoc`, la derivación de claves y las fórmulas; no se han introducido servicios ni sincronización. La versión continúa **exclusivamente para pruebas con datos ficticios**.

## Cambios implementados

1. **Escrituras protegidas ante varias pestañas.** Antes de sustituir el sobre cifrado de IndexedDB se comprueba en **la misma transacción de lectura-escritura** que su contenido coincide con la última versión conocida. Si otra pestaña guardó algo, se aborta la operación y aparece un mensaje inequívoco. No se mezcla ni se sobrescribe ningún cuaderno automáticamente. Al crear un cuaderno nuevo se exige que el almacén esté vacío. El método rechaza las escrituras que omitan la versión esperada.
2. **Error de guardado visible.** La cabecera muestra «¡Sin guardar!» y se bloquean más mutaciones tras un error de persistencia. Es necesario resolver el problema y volver a abrir la copia actualizada. Deshacer/Rehacer también se bloquean durante ese error.
3. **Exportación responsable.** Antes de descargar una copia se contrasta con el sobre cifrado realmente guardado. Si otra pestaña lo ha cambiado, se cancela la descarga para no etiquetar un estado obsoleto como copia actual.
4. **Restauración controlada.** La confirmación de sustitución solo se muestra después de descifrar y validar el esquema. El guardado de la restauración está protegido por la misma comparación transaccional.
5. **Contraseñas enmascaradas.** Restaurar y verificar copias usa un formulario `type=password` en lugar de `window.prompt`.
6. **Verificación no destructiva de `.cdoc`.** Botón «Verificar copia»: valida formato, descifrado, versión y modelo; informa del número de grupos, alumnos y calificaciones. No restaura ni modifica IndexedDB.
7. **Comprobación de recursos offline.** «Ajustes y copias» incorpora un botón que comprueba que los 14 recursos estáticos existen en la caché `cuaderno-docente-static-v06` y que hay un Service Worker activo. Esto **no garantiza** que el dispositivo pueda reiniciar offline: sigue siendo necesaria una prueba real.
8. **Caché versionada.** Versión `v06` del precache para facilitar actualizaciones sin retener recursos de código v05.

## Pruebas efectuadas

- **103 pruebas automatizadas**: 96 anteriores más 7 nuevas. Incluyen cifrado AES-GCM real en Node, lectura/descifrado, escrituras con condiciones de versión, dos pestañas simuladas con transacciones serializadas, copia restaurable, servicio offline simulado, error de recurso no precargado y mantenimiento de reglas matemáticas anteriores.
- **720 escenarios deterministas previos** de contraste de reglas matemáticas siguen dentro del test heredado.
- **Interfaz real renderizada en Chromium con datos y persistencia simulados**: creación/edición rúbricas, deshacer/rehacer, edición de alumnado, password enmascarado y presencia de botones de verificación/offline; capturas de 1320 px y 390 px; sin errores JavaScript.
- **No se ha conseguido probar** IndexedDB ni Service Worker desde `localhost` en Chromium: navegación bloqueada por política de administración del entorno (`ERR_BLOCKED_BY_ADMINISTRATOR`). Los simuladores no equivalen a test real de almacenamiento, reinstalación y funcionamiento sin internet.

## Prueba manual necesaria en Mac (datos ficticios)

1. Descomprimir el ZIP, ejecutar `npm start` con Node.js 20 o posterior y abrir `http://127.0.0.1:4173/` en Safari.
2. Crear el cuaderno de demostración con contraseña ficticia larga. Cambiar una nota, recargar, desbloquear y verificar persistencia y media.
3. Descargar `.cdoc`; usar **Verificar copia** y confirmar que el archivo se descifra sin sobrescribir nada.
4. Abrir una segunda pestaña con el mismo origen; desbloquearla; cambiar una nota en la primera y otra en la segunda. La segunda debe rechazar la escritura por conflicto, sin modificar la primera.
5. Comprobar «Preparación offline». Tras activar y controlar el Service Worker y verificar la caché, detener el servidor local y **recargar la página**: debería abrir desde caché sin servidor. Volver a iniciar el servidor, comprobar que la nota persiste y repetir con actualizaciones.
6. Recuperar una copia `.cdoc` usando un cuaderno exclusivamente ficticio y contrastar número de alumnos, actividades, calificaciones y medias antes/después.

Un iPad no puede abrir `127.0.0.1` del Mac: esa dirección apunta al propio iPad. Las pruebas en iPad/iPhone necesitarán una instalación HTTPS autorizada y accesible, sin introducir datos reales ni conectar servicios de notas.

## Limitaciones conocidas

- Control de versiones en el servidor local y navegador **no verificado en Safari/iPadOS**.
- El sistema bloquea escrituras concurrentes conflictivas, pero todavía **no sincroniza** modificaciones hechas en dos dispositivos ni ofrece fusión de conflictos.
- La aplicación **no está autorizada para datos del alumnado** hasta que se realicen pruebas reales de persistencia y seguridad y se revisen las condiciones institucionales de protección de datos.
