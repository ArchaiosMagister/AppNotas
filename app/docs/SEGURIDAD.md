# Política de seguridad del prototipo

**Uso permitido: pruebas con datos ficticios. Prohibido introducir datos reales del alumnado antes de auditoría y autorización de la organización educativa.**

1. No hay servicios de datos remotos ni sincronización. La aplicación almacena snapshots cifrados exclusivamente en IndexedDB del origen del navegador. La PWA almacena en caché **solo código estático**.
2. Derivación de clave mediante PBKDF2-SHA-256 con 310.000 iteraciones y sal aleatoria de 128 bits, cifrado autenticado AES-GCM 256 con IV aleatorio de 96 bits en cada escritura. La contraseña no se almacena; la clave derivada vive en memoria hasta bloquear o cerrar.
3. Los respaldos `.cdoc` contienen exclusivamente un sobre cifrado JSON (no una exportación legible). Se debe verificar su recuperación antes de depender de ellos. Perder la contraseña puede hacer irrecuperables los datos.
4. La información descifrada existe en memoria mientras el cuaderno está abierto. Este mecanismo no protege frente a equipos comprometidos, extensiones maliciosas o acceso a una sesión desbloqueada. Un atacante con acceso al código de la aplicación distribuida podría intentar comprometer la clave durante la ejecución; por tanto, el alojamiento también forma parte del modelo de amenaza.
5. No hay telemetría, SDK externos, analítica, fuentes externas ni API remota. Se aplica una política CSP estricta para scripts.
6. Pendiente de endurecer antes de uso real: protección contra sesiones simultáneas y sobrescritura de escrituras, bloqueo por inactividad, validaciones más profundas del esquema, pruebas de actualizaciones de SW, política de recuperación y migraciones, observabilidad local sin PII, revisión de dependencias y pruebas automatizadas en navegadores iOS.
7. El almacenamiento de Safari/PWA no equivale a una copia de seguridad. Descargar periódicamente copias cifradas en soporte institucional autorizado.
8. El RGPD y las instrucciones del centro se aplican aunque se usen códigos seudónimos. No almacenar cuadernos con datos personales en GitHub.

## OneDrive futuro

Cuando el centro apruebe la integración, usar Microsoft Graph con la identidad institucional autorizada, sin incluir credenciales en el repositorio. El cifrado/descifrado permanecerá en el dispositivo y OneDrive guardará únicamente archivos cifrados. El cifrado de extremo a extremo efectivo requiere diseño de claves, gestión de dispositivos y prevención de conflictos; no basta con activar cifrado de servidor del proveedor.

## Historial local en la v0.4

Los estados de Deshacer/Rehacer permanecen en memoria mientras se mantiene desbloqueada la sesión, hasta un máximo de 30 entradas. Se eliminan al bloquear, restaurar una copia o iniciar otra sesión; **no se guardan en IndexedDB ni se exportan**. El historial es una ayuda de edición, nunca una copia de seguridad recuperable tras cerrar o reiniciar. La pantalla de «Modo alumno» no muestra la lista docente, pero no oculta otras ventanas ni notificaciones del equipo.

El servidor local mantiene una lista explícita de archivos públicos; no sirve pruebas, documentación ni archivos arbitrarios. No se han añadido conexiones a servicios remotos. Las pruebas en un navegador real y el examen institucional del tratamiento de datos siguen pendientes.
