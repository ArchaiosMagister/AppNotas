# Comprobaciones de CuadernoDocente v1.3-prepublicación

Fecha: 2026-11-21. **Estado: candidata local, sin publicar.**

- **157/157 pruebas automatizadas** correctas, sin regresiones. A las 152 anteriores se añaden cinco comprobaciones sobre inventario de las CE de las cinco materias, versión normativa de Latín II, aislamiento por grupo y vínculos sin ponderaciones automáticas, renombrado no destructivo de períodos y estructura de los nuevos controles.
- La batería comprobó además reglas de ponderación y último examen, rúbricas, conversión 0–10, decimales, guardado cifrado, restauración, protección ante concurrencia, categorías por grupo y caché offline con el módulo adicional.
- **Pruebas visuales con Chromium instrumentado (sin servidor):** renombrar y añadir períodos y conservar Evaluación final; capturar nota original 4,25/5 y verificar 8,50/10 arriba y `(4,25 /5)` debajo editable, pulsación del valor superior enfoca el campo; filas diferenciadas en los tres temas; cambiar entre los catálogos 2022/2026 de Latín II; vincular una competencia oficial; navegación en pantalla de 390 px; ningún error JavaScript registrado en este recorrido.
- Colores de las bandas en Chromium (celda de nombre): claro `#ffffff`/`#edf3fb`; oscuro `#1b2638`/`#2b3b51`; OLED `#000000`/`#171717`.
- Cuatro extractos PDF oficiales incorporados en el HTML autónomo, con seis catálogos curriculares (cinco materias, dos versiones de Latín II). No se han creado competencias de Griego II del currículo de 2022 al carecer del extracto de esa normativa: se informa de la vigencia de 2026 en la propia interfaz.
- **Pendiente:** apertura nativa `file://`, persistencia y restauración en Safari Mac real, iPhone y iPad. Probar solo con nombres ficticios y guardar/verificar una copia `.cdoc`. La prueba instrumentada no sustituye esas verificaciones.
