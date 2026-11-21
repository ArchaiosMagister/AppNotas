# Prepublicación local v1.17: abrir/cerrar cuadernos cifrados

**Base**: ZIP v1.16 adjuntado. **GitHub**: no consultado, no modificado y sin despliegues. **Datos**: solo los alumnos ficticios del paquete y datos generados en tests.

## Cambios

- Barra principal: **Abrir cuaderno**, **Cerrar cuaderno** y estado de exportación. En móvil se muestran como acciones táctiles independientes.
- Exportación completa `.cuaderno`: AES-256-GCM y PBKDF2-SHA-256, IV distinto en cada operación, metadatos cifrados, selector de guardado/hoja de compartir/descarga según navegador. No se declara guardada en nube sin prueba.
- Apertura de `.cuaderno` y `.cdoc` anteriores con contraseña enmascarada, validación de contenido, resumen descifrado, avisos de antigüedad/divergencia y tres decisiones expresas antes de modificar IndexedDB.
- Revisión por cuaderno con ascendencia acotada y estado «exportación confirmada / cambios posteriores / no verificable». Rescate transaccional del sobre cifrado anterior, comprobación concurrente entre pestañas.
- Se mantiene el motor de calificaciones y datos del esquema v8. No se cambiaron las fórmulas de `src/calculations.js` ni el modelo base.
- Corregida carrera entre eventos `close` de los diálogos al autenticar y confirmar importación. Entrada de archivo se reinicia al elegir para admitir el mismo archivo de nuevo.
- Paquete autónomo reconstruido con sus 18 módulos y CSP de hashes regenerada; service worker y prueba offline incluyen el nuevo módulo, caché v117.

## Pruebas automatizadas y navegador

- `npm test`: **348/348** pruebas correctas (334 históricas + 11 nuevas de portabilidad + 3 nuevas de acuses transaccionales).
- Exportar → descifrar → importar: JSON de cuaderno idéntico; comparaciones de todos los resultados numéricos de categoría, grupo, competencia y evaluación final; rúbricas y ponderaciones iguales.
- Contraseña errónea, ciphertext alterado o truncado, formato o versión incorrectos, modelo inválido, tamaño excesivo y JSON malformado: rechazo.
- Copias iguales, anteriores, posteriores, distintas y divergentes: clasificación verificada. Copia histórica sin ascendencia: procedencia incierta.
- Transacciones simuladas: preservación del original ante fallos, conflictos entre pestañas y acuse de exportación que falla sin alterar notas.
- Chromium en `about:blank` con cifrado e IndexedDB **simulados**: escritorio 1366 px, iPad 820 px e iPhone 390 px; visible «Abrir/Cerrar», confirmaciones, cancelación de exportación, rescate local, detección de copia antigua; cero errores JS y sin desbordamientos.
- Navegación real de Chromium en HTTP y `file://` **bloqueada por la política del entorno**. Por tanto no se afirma prueba real de IndexedDB, descarga, selector ni PWA Safari. No hay dispositivos Apple reales disponibles aquí.

## Riesgos y limitaciones

- `showSaveFilePicker` solo en navegadores compatibles. En Safari/iPhone/iPad se usa hoja de compartir si admite archivos o descarga convencional, y **no se da por confirmado el guardado**.
- Solo un punto de recuperación local, que se reemplaza en la siguiente restauración. Conviene mantener copias externas.
- El historial se inicia al convertir un cuaderno anterior: no puede inferir la cronología de los `.cdoc` antiguos. Divergencias no se fusionan.
- No se han realizado auditorías independientes de seguridad, pruebas en Apple real ni comprobación de historial Git (no hay `.git` dentro del ZIP). No usar datos reales hasta que el centro autorice y se complete la aceptación.
- No hay integración OneDrive ni declaración de cumplimiento RGPD automático.

## Cómo usar

1. Desbloquea el cuaderno local. Las notas se siguen guardando automáticamente en IndexedDB cifrado.
2. Pulsa **Cerrar cuaderno → Guardar archivo cifrado**. Elige carpeta OneDrive/iCloud/Archivos donde el sistema lo permita. Si se comparte o descarga sin confirmación, comprueba manualmente la ubicación y sincronización.
3. Puedes pulsar **Bloquear cuaderno** después de exportar; la copia local **no se borra**.
4. En otro dispositivo abre la PWA, pulsa **Abrir cuaderno**, elige el `.cuaderno`, introduce la contraseña de ese archivo y revisa cursos, fecha, número de alumnos y advertencia. Pulsa **Importar copia** solo si deseas sustituir los datos locales (o **Conservar datos actuales** para no importar).
5. Si hay conflicto, guarda primero una copia de cada dispositivo. No hagas cambios simultáneos sin resolver las versiones.
