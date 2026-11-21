# Verificación de CuadernoDocente v1.5 — 21/11/2026

- Origen: ZIP de CuadernoDocente v1.4. Modificada una copia de trabajo; ningún cambio en GitHub.
- **200/200 pruebas automatizadas** con Node (183 originales con expectativas de versión actualizadas y 17 nuevas de la v1.5), todas correctas. Incluyen escala /5, descuento antes/después de entregar, mínima de 0, redondeo, migración v5→v6, recuperación, copia trimestral, competencias, validaciones y persistencia cifrada de metadatos.
- Prueba visual en Chromium simulado (HTML único instrumentado, sin servidor): se comprobó el editor, cambios de casilla, 8,50 − 0,40 = 8,10 y restauración a 8,50, escala 4,25/5 y dos faltas = 8,30, rechazo de 4,256, nuevos valores predeterminados, modo alumno, tres temas y móvil. **Sin errores JavaScript** en ese recorrido.
- Empaquetado de código fuente y HTML autónomo con CSP por hash y cuatro PDF curriculares incorporados. Los cálculos y el planificador se mantienen funcionales.
- No validado: almacenamiento local y cierre/reapertura de Safari macOS/iOS/iPadOS real, sincronización entre navegadores ni uso con alumnado real. Las pruebas se realizaron con datos ficticios; completar protocolo Safari antes de utilizar de forma productiva.
