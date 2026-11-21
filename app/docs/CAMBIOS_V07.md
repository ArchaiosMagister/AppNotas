# CuadernoDocente v0.7 — comprobación de persistencia sin alterar notas

**Continuación de v0.6. Estado experimental privado. No publicado; solo datos ficticios.**

## Funcionalidad

- Se incorpora, en **Ajustes y copias → Preparación para trabajar offline**, el botón **«Probar guardado y recarga»**.
- Al pulsarlo, espera todas las operaciones pendientes, consulta IndexedDB y **rechaza** iniciar la prueba si la copia cifrada no coincide con la abierta. Obtiene un SHA-256 de los campos del sobre cifrado y guarda **solo esta huella**, y la hora, en `sessionStorage`.
- Recarga la página. En el arranque consulta de nuevo IndexedDB, compara la huella y muestra el resultado en la pantalla de desbloqueo. Tras introducir la contraseña se valida también el modelo de notas. La huella temporal se elimina al leerla; caduca a los 30 minutos.
- Si el registro falta, ha cambiado, ha caducado o no es válido, **nunca muestra éxito**. Una segunda pestaña puede haber modificado legítimamente el cuaderno; esta prueba no identifica por sí sola la causa de la diferencia.
- Este control no escribe calificaciones ni cambia la contraseña o el esquema v5. **Tampoco equivale a cerrar Safari ni a arrancar la PWA sin red**, pruebas que siguen requiriendo un dispositivo real.
- Se añade `src/diagnostics.js` al servidor local y al precache. La caché pasa a `cuaderno-docente-static-v07`, con **15 recursos** estáticos.

## Pruebas ejecutadas aquí

- `npm test`: **111/111**, cero fallos. Se conservan las 103 pruebas previas y los 720 escenarios matemáticos anteriores.
- Ocho pruebas nuevas: huella SHA-256 consistente, simulación de guardado/recarga/descifrado, detección de cambio, ausencia del registro, marcador caducado o malformado, recuperación del modelo anual, cambio de versión y **1.600 combinaciones matemáticas deterministas** de escalas heterogéneas con categorías parcialmente vacías.
- `python qa/browser_simulado.py`: navegación por cuaderno, historial, rúbricas, gestión, vista individual y pantallas de 1320/390 px, sin errores JavaScript; almacenamiento y cifrado de la interfaz **simulados**.
- Sigue siendo imposible navegar a `localhost` en Chromium de este entorno (`ERR_BLOCKED_BY_ADMINISTRATOR`), aunque el servidor local responda por HTTP. **No se ha probado con IndexedDB real, Service Worker real ni Safari/iPad/iPhone.**

## Compatibilidad y limitaciones

- Se mantiene el mismo `schemaVersion=5`, formato `.cdoc`, cifrado y motor de evaluación de v0.6. No es necesaria una migración de datos desde v0.6.
- La memoria del navegador y el almacenamiento siguen siendo locales; no hay nube ni sincronización. Dos pestañas siguen protegidas frente a sobrescrituras, no fusionadas.
- La huella SHA-256 temporal es un *diagnóstico* de una recarga en la misma pestaña: no es auditoría antifraude ni garantía de permanencia futura.
- **No introducir notas ni datos reales del alumnado** hasta las pruebas de los dispositivos finales y la revisión institucional de privacidad y seguridad.

Consulta `qa/PROTOCOLO_SAFARI.md` para cerrar las pruebas faltantes con datos ficticios.
