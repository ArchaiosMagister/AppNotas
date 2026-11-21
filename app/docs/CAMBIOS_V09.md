# CuadernoDocente v0.9 · Restauraciones reversibles

Fecha: 21 de noviembre de 2026. **Versión experimental, sin publicación y solo con datos ficticios.**

## Cambios técnicos

- Antes de **restaurar** un archivo `.cdoc`, la versión cifrada que estaba en IndexedDB se guarda automáticamente bajo la clave `pre-restore` **en la misma transacción** que sustituye `main`. Un error o conflicto aborta toda la operación.
- Hay dos operaciones independientes:
  - **Descargar rescate**: exporta el sobre cifrado anterior a `.cdoc`, sin pedir contraseña ni acceder a las notas en claro.
  - **Recuperar versión anterior**: pide la contraseña de la versión previa, descifra, migra y valida el modelo, y solo tras la confirmación intercambia `main` y `pre-restore` de forma atómica. La versión reemplazada sigue siendo el nuevo rescate.
- Al intercambiar se comprueban **dos versiones** en la misma transacción: el cuaderno principal y el punto de rescate. No se sobrescriben cambios de otras pestañas.
- La opción de recuperar y descargar el rescate se ofrece también en la pantalla **bloqueada**: resulta posible volver atrás incluso si la contraseña de la restauración nueva es desconocida, siempre que se conserve la de la copia anterior.
- El ZIP sigue utilizando el esquema de datos **v5**. No hay nuevas claves dentro del cuaderno cifrado, ni cambios de fórmulas, rúbricas, grupos, competencia evaluables, evaluaciones finales o colores.
- `sw.js` cambia a caché `cuaderno-docente-static-v09` para evitar entregar una combinación anterior de recursos estáticos; se mantienen los **19 recursos** de la v0.8.
- El plazo para revocar la URL temporal de descarga del navegador se amplía a 30 segundos para dar más margen al inicio de la descarga.

## Límites de la protección

- El punto de rescate interno contiene **una sola versión anterior a la última restauración**. Una restauración posterior reemplaza ese punto. No es un historial infinito ni incluye cada cambio de nota.
- Todos los rescates internos se guardan cifrados, pero están sujetos a las políticas de eliminación de datos de sitio de Safari/Chromium. **Guardar también copias `.cdoc` fuera del navegador.**
- Para recuperar la copia previa hay que conocer **la contraseña con la que se cifró esa copia**, que puede diferir de la del cuaderno restaurado.
- Los cambios hechos en la versión actual después de la restauración se perderán si se confirma la recuperación; por ello la versión actual pasa a ser el nuevo rescate y debe exportarse si se desea conservar ambas.
- Las pruebas de IndexedDB son transacciones **simuladas**; no hay validación real en Safari macOS/iOS/iPadOS, ni auditoría institucional de privacidad. No usar datos personales reales antes de completar esas comprobaciones.

## Verificaciones

- 129/129 pruebas Node (incluye 9 nuevas sobre restauración atómica y recuperaciones).
- 720 escenarios de cálculo independientes de v0.5 y 1.600 combinaciones de escalas y ponderación de v0.7, conservados; motores `src/model.js`, `src/calculations.js`, `src/vault.js` y `src/curriculum-data.js` idénticos byte a byte a la versión 0.8.
- Pruebas de restauración correcta, intercambio reversible, pestañas concurrentes, contraseñas diferentes, error de escritura a mitad de operación, copia de rescate obsoleta, negativa por contraseña, origen vacío y ausencia de versión esperada.
- Chromium con persistencia **simulada**: navegación y diseño de los controles de rescate en escritorio y 390 px; resto de flujo de la v0.8 sin errores JavaScript.
- El procedimiento real de Safari se actualiza en `qa/PROTOCOLO_SAFARI.md`.
