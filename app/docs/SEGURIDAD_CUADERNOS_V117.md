# Formato Tabularium `.cuaderno` — v1.17 (prepublicación)

## Formato y garantías

Archivo JSON UTF-8 con **solo** `{ "type": "TabulariumCuaderno", "version": 1, "vault": { ... } }`. `vault` contiene `format:CuadernoDocenteEncrypted`, `version:1`, `kdf:PBKDF2-SHA-256`, `iterations:310000`, `salt` (16 bytes aleatorios, Base64), `iv` (12 bytes aleatorios por cifrado, Base64) y `data` (ciphertext AES-256-GCM + etiqueta de autenticación de 128 bits, Base64). AES-GCM se ejecuta mediante Web Crypto API, sin bibliotecas criptográficas remotas. Al cifrar archivos `.cuaderno` se autentica también una etiqueta fija de tipo y versión como *additional authenticated data* (AAD: `TabulariumCuaderno/v1`); no se puede camuflar como archivo antiguo `.cdoc`. Ningún dato docente figura en texto claro, salvo el identificador genérico del tipo de archivo y los parámetros criptográficos.

PBKDF2-SHA-256 se conserva con **310.000 iteraciones** para usar la clave que la versión anterior ya derivó al desbloquear el cuaderno, sin volver a pedir la contraseña ni romper la compatibilidad con `.cdoc`. La sal se genera con `crypto.getRandomValues` al crear el almacén; **cada nueva exportación genera otro IV**. Web Crypto tiene PBKDF2 de forma interoperable en Safari/Chromium/Firefox; Argon2id no pertenece a la API Web Crypto nativa y exigiría código adicional. La solidez real depende también de una contraseña larga, única y no reutilizada. El parámetro 310.000 es un compromiso de compatibilidad: convendrá reevaluarlo en una futura migración con recifrado controlado, no modificarlo silenciosamente.

Dentro del texto autenticado están `type`, `version`, `modelVersion`, `exportedAt` y `notebook`. `notebook` incluye **sin filtros** el documento completo del esquema 8: alumnos, grupos, notas, rúbricas y valoraciones, configuraciones, planificador, porcentajes, reglas y evaluaciones, ajustes, etc. `notebook._portability` guarda `bookId` (el ID del cuaderno), fecha de creación, revisión, identificador aleatorio de la revisión y hasta 4096 antecesores. La lista tiene límite para evitar crecimiento ilimitado; cuando dos revisiones no pueden ordenarse se trata de conflicto. No se hace fusión.

## Importación y recuperación

1. Comprobar tamaño máximo de 25 MB y estructura exterior, parámetros criptográficos y versión.
2. Solicitar la contraseña y descifrar autenticadamente (GCM). Una clave incorrecta y un archivo alterado son indistinguibles criptográficamente; ambos producen un aviso sin reemplazar datos.
3. Comprobar la versión del formato interno, migraciones admitidas, `assertModel` y coherencia de la ascendencia. No hay escritura durante estos pasos.
4. Mostrar fechas, cursos y recuentos descifrados; clasificar como igual, anterior, posterior, divergente, otro cuaderno o procedencia incierta.
5. Exigir pulsar **Importar copia**. Las opciones **Conservar datos actuales** y **Cancelar** no escriben nada.
6. Preparar un *nuevo sobre cifrado local* con IV nuevo; sustituir en una **misma transacción IndexedDB** con comparación optimista del estado anterior. Antes de escribir `main`, se escribe el sobre cifrado anterior como `pre-restore`. Si la transacción falla o alguna pestaña cambió las notas, se aborta íntegra.
7. **Solo existe un punto de recuperación** dentro de IndexedDB. Una restauración adicional reemplaza ese punto: es recomendable descargar copias externas antes de importar.

El acuse local de exportación (solo `bookId`, `head` y fecha) se registra cuando el navegador confirma una escritura mediante `showSaveFilePicker`/`createWritable`. Es distinto de la sincronización posterior de OneDrive/iCloud, que **no puede verificarse desde la aplicación**. El selector de descarga o la hoja de compartir de Safari no confirman la ubicación final, por lo que **no** se registra un acuse de exportación verificada en esas vías. Los archivos no se suben desde la aplicación.

La pantalla solicita contraseña para desbloquear el cuaderno local al iniciar una nueva sesión, pues **IndexedDB ya estaba cifrado en v1.16**; durante la sesión abierta no se vuelve a pedir para guardar y exportar. La contraseña se mantiene solo en la entrada del formulario mientras se procesa el desbloqueo y no se almacena ni transmite; la aplicación mantiene la *clave derivada* exclusivamente en memoria de la sesión. El botón **Bloquear** o el nuevo **Bloquear cuaderno** tras exportar descartan esa clave de la aplicación. El almacenamiento local continúa cifrado en esta versión; en otras aplicaciones, la seguridad local puede depender del propio dispositivo, y la mera ausencia de contraseña de acceso nunca equivale a cifrado de disco.

## Límites y medidas que aún requieren comprobación

- No hay auditoría criptográfica independiente ni prueba de Safari en equipos reales. No se recomienda introducir datos reales antes de disponer de autorizaciones, políticas del centro y aceptación de los dispositivos utilizados.
- No hay sincronización automática; deben evitarse ediciones simultáneas en dos dispositivos. La detección de ascendencia informa de conflictos, pero no reconstruye ni fusiona cambios.
- Un archivo cifrado antiguo `.cdoc` se admite, pero sin historial fiable ni fecha de exportación. Se advierte al sustituirlo.
- Los archivos se cifran **antes** de guardarlos o compartirlos; la aplicación no solicita acceso a carpetas en la nube ni usa Graph, Supabase, APIs externas, telemetría o servidor de notas.
- La seguridad jurídica (RGPD y reglas de uso de OneDrive institucional) debe ser confirmada por el centro y la Generalitat Valenciana; el cifrado del formato **no implica cumplimiento automático**.
- Este ZIP no incluye `.git`; no se puede certificar el historial del repositorio sin examinarlo explícitamente antes de publicar.
