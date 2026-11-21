# Política de copias de seguridad cifradas — AppNotas

**Alcance:** instalación principal en https://appnotas-docente.pages.dev/, sin almacenamiento de calificaciones en el servidor y sin sincronización automática. Aplicable a la versión experimental con datos ficticios; cualquier uso institucional con datos reales requiere la autorización y las salvaguardas establecidas por el centro.

## Objetivo

No depender de un único almacén IndexedDB. Una PWA guarda datos locales en el dispositivo y el navegador puede eliminarlos, incluso si se ha solicitado almacenamiento persistente. GitHub y Cloudflare alojan **el código, no las notas**; tampoco generan copias de los cuadernos.

## Regla práctica

1. **Cada semana y después de cambios importantes** (importación de alumnado, introducción de un bloque de notas, cierre de evaluación), abrir AppNotas, esperar a ver «Guardado cifrado», pulsar **Ajustes y copias → Guardar copia portátil (.cuaderno)**.
2. Guardar el archivo cifrado en una carpeta controlada. Conservar **al menos dos copias en ubicaciones distintas**, por ejemplo un almacenamiento institucional autorizado y otra ubicación de respaldo aprobada por el centro. No dar por completada la copia si el navegador solo abrió Compartir o inició una descarga: verificar su presencia en el destino.
3. En **Ajustes y copias → Verificar copia**, seleccionar **el archivo realmente guardado** e introducir la contraseña. La aplicación lo descifra y valida **sin importar ni alterar calificaciones**.
4. Si ese archivo contiene exactamente la revisión del cuaderno abierto, la app anotará en el propio dispositivo la fecha de verificación. Solo entonces mostrará el estado **«Archivo .cuaderno reabierto y comprobado»**. Si faltan 7 días desde la última comprobación o se guardan nuevos cambios, pedirá otra copia.
5. Conservar **generaciones anteriores** (por ejemplo, las últimas cuatro copias semanales) para protegerse de errores introducidos antes de advertirlos. Una restauración automática interna solo ofrece un punto de rescate y **no es una copia externa**.
6. Ensayar una restauración en un navegador o dispositivo de prueba, con datos ficticios. Conservar los originales y evitar sobrescribir cuadernos con cambios divergentes.

## Lo que significa cada estado

- **Sin copia comprobada:** no consta ninguna lectura reciente de un archivo portátil que coincida con el cuaderno. No prueba que no exista una copia: puede estar en otro dispositivo.
- **Exportación sin verificar:** el navegador confirmó una escritura con selector, pero aún no se ha reabierto el archivo. La aplicación no presume de sincronización en la nube.
- **Verificada recientemente:** el usuario seleccionó un archivo portable que se pudo descifrar y cuya revisión coincidía; el registro es local y **no garantiza que el archivo siga presente**, que la nube lo haya sincronizado o que exista otra copia independiente.
- **Cambios posteriores:** desde aquella verificación se ha guardado una revisión más nueva. La copia anterior puede recuperarse pero **no contiene los últimos cambios**.
- **Antigua:** la última verificación de la misma revisión supera 7 días; comprobar una copia actual.
- **Copia histórica .cdoc:** puede recuperarse, pero no activa el indicador de copia portátil actual, para no confundir respaldo de emergencia y respaldo portable verificado.

## Reglas de seguridad

- Crear una frase de paso robusta y exclusiva; conservarla en un gestor de contraseñas o un procedimiento institucional autorizado. Si se pierde, no se podrán descifrar las copias.
- No guardar archivos .cuaderno, .cdoc, CSV de alumnado, datos identificativos ni contraseñas en el **repositorio GitHub**, issues, PR o chat.
- No añadir copias cifradas a carpetas personales de nube si la normativa de tu centro exige almacenamiento institucional.
- No utilizar la versión antigua de GitHub Pages para seguir editando notas: dos orígenes distintos **no sincronizan cuadernos** y podrían divergir.
- Si una copia falla al verificarse, **no borrar el cuaderno ni reinstalar la PWA**. Probar otra copia existente, confirmar contraseña, y conservar el archivo que falló para diagnóstico.

## Pruebas automatizadas

Las regresiones comprueban cifrado AES-GCM, integridad del archivo, contraseña incorrecta, comparación de revisión, cambio de estado al modificar notas, fecha de verificación futura o antigua, y correspondencia del guardado entre pestañas. Estas pruebas no pueden demostrar que el almacenamiento externo conserve físicamente el archivo: esa comprobación requiere la selección y lectura real del documento exportado.

**La política es deliberadamente manual:** una PWA estática no puede escribir silenciosamente en carpetas arbitrarias de iCloud, OneDrive o el sistema de archivos ni demostrar su sincronización.
