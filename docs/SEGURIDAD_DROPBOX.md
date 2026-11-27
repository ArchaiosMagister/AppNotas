# Revisión de seguridad: sincronización cifrada con Dropbox

Estado: candidato en pruebas, PR #63. No constituye certificación ni auditoría independiente. No autoriza el tratamiento de datos reales ni el despliegue en producción.

## Alcance y arquitectura

- AppNotas conserva el cuaderno en IndexedDB del origen HTTPS exclusivo. Cloudflare sirve código estático; no recibe el cuaderno. No se publica contenido personal en GitHub.
- La aplicación Dropbox registrada se llama CuadernoProfesorado. Se ha solicitado acceso App folder y únicamente los permisos files.content.read y files.content.write. El identificador público no es un secreto.
- El flujo OAuth usa PKCE S256, estado aleatorio, tiempo de validez limitado y URI de retorno exacta. No hay secreto de aplicación. El código de autorización se consume y se elimina de la URL. Solo la sesión desbloqueada maneja credenciales en memoria.
- La copia remota contiene una envoltura AES-256-GCM, IV aleatorio de 96 bits y sal de 128 bits. El contexto autenticado distingue las copias Dropbox, los archivos portátiles y las credenciales. El modelo y los metadatos de revisión se comprueban después de autenticar el cifrado.
- Las nuevas copias utilizan PBKDF2-HMAC-SHA-256 de 600.000 iteraciones; se mantienen las copias antiguas de 310.000 para recuperación local. Dropbox no admite instantáneas antiguas. Se ofrece una migración local, comprobada antes de escribir, con nueva contraseña y copia externa verificada.
- Contraseña de al menos 16 caracteres al vincular. La longitud por sí sola no implica entropía. Se recomienda generar localmente una contraseña de 32 caracteres (192 bits aleatorios), conservarla de forma segura y no compartirla.
- Las credenciales de renovación se guardan cifradas y separadas del cuaderno; nunca se incluyen en una copia ni se envían a Cloudflare. Se verifican de nuevo antes del acceso remoto. Bloquear, restaurar, cambiar de clave o desvincular invalida la sesión local.
- Solo se permiten los endpoints exactos de OAuth y lectura/escritura de archivos Dropbox en la compilación Cloudflare habilitada; la PWA histórica y otros orígenes no tienen acceso Dropbox. La vista previa usa un archivo exclusivo de pruebas, nunca el archivo definitivo.

## Decisión criptográfica y riesgo residual

OWASP prefiere Argon2id para almacenamiento de contraseñas; también documenta PBKDF2-HMAC-SHA-256 con 600.000 iteraciones como configuración recomendada (especialmente para compatibilidad FIPS). Referencia: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html. Esto no certifica automáticamente la protección de una copia cifrada. Se ha elegido conservar WebCrypto nativo sin dependencias criptográficas externas en esta versión, con contraseña aleatoria fuerte; Argon2id queda como posible mejora versionada y validada por separado. No se debe usar una contraseña de diccionario, reutilizada o predecible.

Dropbox recomienda PKCE para clientes públicos y, para aplicaciones puramente JavaScript, tokens de corta duración sin renovación persistente (https://docs.dropboxapi.com/dropbox-api/docs/oauth). La exigencia de sincronización automática tras reabrir dispositivos requiere una decisión explícita: se conserva el token de renovación únicamente cifrado bajo la clave del cuaderno, y se usa en memoria solo mientras está desbloqueado. Es una desviación de la recomendación conservadora del proveedor, no una garantía contra un navegador o código comprometido. Debe ser aceptada por el responsable de seguridad/DPD antes del tratamiento real; si no se acepta, deberá usarse autorización interactiva por sesión.

La confidencialidad depende de contraseña fuerte, navegador/dispositivo íntegros, origen y código de confianza. Ni Dropbox ni Cloudflare necesitan recibir la contraseña o el cuaderno en claro. Un atacante que obtenga una copia cifrada puede intentar adivinar la contraseña offline; el cifrado no impide la captura de datos de un cuaderno desbloqueado por malware, extensiones o una aplicación modificada. No existe una garantía absoluta de imposibilidad de acceso. No se ha realizado una auditoría externa. Los tamaños, fechas y existencia del archivo remoto siguen siendo metadatos observables.

## Integridad y disponibilidad

- La sincronización solo sigue una relación de ascendencia verificable. El reloj y el nombre del archivo no deciden la precedencia.
- El fichero remoto se crea solo tras confirmación; las subidas posteriores requieren la revisión exacta de Dropbox. Si el archivo desaparece, no se recrea automáticamente.
- Las escrituras locales son transaccionales y condicionadas al sobre previamente leído; la recepción remota comprueba también la credencial en esa transacción. Restaurar/reiniciar conserva el rescate cifrado y elimina el vínculo local anterior.
- Si ambas versiones divergen, se detienen las escrituras automáticas. No se hace fusión ciega de notas. Descargar ambas .cdoc cifradas, comprobar su lectura, conservar una copia de cada una, restaurar la versión Dropbox mediante la restauración normal, volver a vincular y aplicar manualmente los cambios locales que procedan. Si no se puede autenticar la versión remota con la misma clave, no se sustituye nada; recuperar con la contraseña original y las copias externas.
- La sincronización se ejecuta con el cuaderno desbloqueado y la página activa, al guardar, al volver a la aplicación, al recuperar red y periódicamente. No se promete ejecución con la PWA cerrada o suspendida por iOS. Un envío ya confirmado por Dropbox no puede deshacerse mediante bloqueo local.
- Mantener dos copias externas cifradas y verificadas. Dropbox no es copia independiente y no garantiza disponibilidad ni evita borrados del proveedor. Un dispositivo vacío no puede determinar por sí solo si el proveedor ha restaurado una revisión antigua auténtica.
- No rotar una contraseña de una copia vinculada sin un procedimiento explícito: conservar y verificar las dos copias, desvincular dispositivos, retirar la copia remota anterior de forma controlada y volver a vincular con la nueva clave. No se ha implementado rotación remota automática. Las copias anteriores conservan su contraseña anterior.

## Validación y publicación

El docente ha comunicado que la autorización real, recuperación en otro dispositivo y sincronización bidireccional automática funcionan en la vista previa con datos ficticios. Las pruebas automatizadas de módulos y navegadores no utilizan su cuenta. La suite de navegador simula la API de Dropbox, usa contextos de navegador e IndexedDB/WebCrypto reales y comprueba la pérdida de red, divergencias, descargas y desvinculación.

Antes de fusionar: verificar las cuatro validaciones para el commit exacto de la PR (general, cabecera, táctil y Dropbox navegador), revisar la política de seguridad de la compilación definitiva, conservar copias independientes, comprobar la configuración del proveedor y obtener autorización explícita de publicación. El uso de datos reales sigue sujeto a la aceptación institucional de los riesgos residuales y condiciones del servicio. Mantener producción deshabilitada hasta terminar las verificaciones y recibir autorización.
