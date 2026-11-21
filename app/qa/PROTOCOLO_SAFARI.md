# Pruebas de aceptación en Safari — CuadernoDocente v1.0-rc1

**Todas las operaciones se realizarán con alumnos y notas ficticias. No trabajar sobre un cuaderno que contenga datos reales.** Mantener copia de seguridad de la versión anterior antes de sustituir archivos.

## 1. Preparación

1. Descomprimir el ZIP en el Mac, sin modificar la carpeta `src` ni `sw.js`.
2. En Terminal, desde la carpeta del proyecto, ejecutar `npm start` con Node.js 20 o superior.
3. Abrir `http://127.0.0.1:4173/` en Safari del **mismo Mac**. No abrir el HTML como archivo suelto.
4. Crear un cuaderno de demostración con contraseña ficticia larga o desbloquear uno ya creado **en ese mismo origen y perfil**. Anotar el grupo, la nota de un alumno y su media antes de los pasos siguientes.

## 2. Guardado y recarga

1. Cambiar una nota ficticia y esperar «Guardado cifrado».
2. Abrir «Ajustes y copias» → **Probar guardado y recarga**.
3. Al recargar debe aparecer «Recarga verificada: la misma copia cifrada continúa en IndexedDB». Desbloquear de nuevo.
4. Confirmar que la nota y la media son idénticas y que aparece el mensaje final de validación.
5. **Resultado:** [ ] superado  [ ] fallo. Anotar versión de macOS/Safari: __________.

## 3. Cierre y reapertura completa

1. Descargar una copia `.cdoc` cifrada y verificarla con **Verificar copia**. No borrar el archivo.
2. Cerrar todas las ventanas de Safari y salir completamente de Safari. Volver a abrir la misma URL, con el servidor en ejecución.
3. Desbloquear y contrastar nota, número de alumnos y media con el paso 1.
4. **Resultado:** [ ] superado  [ ] fallo.

## 4. PWA sin servidor / desconexión efectiva

1. Con el servidor activo, abrir **Comprobar recursos offline**. Deben figurar **19 recursos** y un Service Worker activo; recargar una vez si fuese necesario.
2. **Sin cerrar la pestaña aún**, detener el servidor con Ctrl+C y recargar `http://127.0.0.1:4173/`. Comprobar que se muestra el desbloqueo, que acepta la contraseña y que permite consultar las medias. Si falla, anotar el error exacto.
3. Restaurar el servidor. Comprobar que las notas y la media siguen guardadas.
4. **Resultado:** [ ] superado  [ ] fallo. Una respuesta de caché no prueba, por sí sola, la persistencia entre cierres.

## 5. Dos pestañas concurrentes

1. Abrir y desbloquear el mismo cuaderno en dos pestañas.
2. En la primera cambiar una nota y esperar «Guardado cifrado».
3. En la segunda cambiar otra nota, sin recargar antes. Debe aparecer un error de conflicto y «¡Sin guardar!»; **no debe sustituirse la primera nota**.
4. Cerrar la segunda pestaña; volver a abrir y desbloquear. Comprobar que la primera modificación permanece.
5. **Resultado:** [ ] superado  [ ] fallo.

## 6. Copia y restauración

1. Descargar una copia `.cdoc` y pulsar **Verificar copia**. Confirmar recuentos de grupos, alumnos y calificaciones.
2. Modificar una nota ficticia y confirmar el guardado; apuntar la nueva media.
3. Pulsar **Restaurar copia**, elegir el `.cdoc`, introducir la contraseña y confirmar la sustitución.
4. La nota anterior y su media deben recuperarse exactamente, sin duplicar alumnos ni actividades. Verificar también la evaluación final del curso.
5. **Resultado:** [ ] superado  [ ] fallo.

## 7. Pruebas en iPad/iPhone

No abrir `127.0.0.1:4173` en el iPad/iPhone: esa dirección apunta al propio dispositivo. Para Safari de iPadOS/iOS hará falta un origen HTTPS de pruebas explícitamente autorizado y accesible, con **solo datos ficticios**. Repetir pasos 2, 3, 4 y 6; además comprobar teclado decimal, desplazamientos de tablas y salida/entrada de la PWA.

**Criterio de aceptación:** cualquier discrepancia de calificaciones, fallo de recuperación de copias o pérdida de persistencia bloquea el uso con datos reales y requiere investigación antes de cualquier publicación.


## 8. Punto de rescate de restauración (v0.9)

1. Con una copia `.cdoc` válida de un cuaderno de prueba diferente y **con las dos contraseñas conocidas**, apunta la nota de un alumno antes de restaurar.
2. Restaura el otro cuaderno y verifica que muestra sus notas y grupos. Se habilitarán «Recuperar versión anterior» y «Descargar rescate».
3. Descarga el rescate `.cdoc` y verifica que se puede abrir con la **contraseña anterior**. No puede salir texto de alumnos sin descifrar el archivo.
4. Pulsa «Recuperar versión anterior», introduce la contraseña de la primera versión y confirma. Deben regresar exactamente las notas originales.
5. Tras la recuperación, comprueba que la versión recién sustituida está cifrada como nuevo rescate y se puede volver a abrir.
6. Repite el intento con contraseña incorrecta y en dos pestañas desincronizadas: ninguna operación fallida debe modificar las notas originales.
7. Detén por completo Safari y ábrelo de nuevo en el mismo perfil y origen. Las dos opciones de rescate deben conservarse. No elimines el almacenamiento de Safari, que eliminaría también las copias internas.

**Resultado:** [ ] superado  [ ] fallo. **Limitación:** el rescate interno conserva UNA versión anterior y no sustituye una copia exportada fuera del navegador.
