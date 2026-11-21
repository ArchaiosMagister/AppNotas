# Validación de CuadernoDocente v1.4 — 21/11/2026

- Base: ZIP original `CuadernoDocente_v1.3_prepublicacion.zip` (no se han modificado versiones anteriores).
- Pruebas Node: **183/183 correctas** (`npm test`). De ellas, 26 nuevas sobre el planificador: horario, clases manuales, cálculo de fechas, festivos, eventos del cuaderno, copias cifradas, migración, excepciones, tareas y preservación de las calificaciones.
- Prueba de interfaz Chromium (HTML instrumentado para evitar dependencias externas): **correcta**, sin errores JS. Se han probado: alta de clase y guardia, planificación y realizado, examen desde el cuaderno y hora heredada, festivo, tarea, cambio excepcional de hora y edición, calendario mensual, exportación `.ics`, los tres temas y móvil a 390px.
- Servidor de desarrollo (Node): HTTP 200 para página y módulos `planner.js` y `planner-ui.js`; recursos no incluidos se rechazan como 404. GitHub Pages no se ha utilizado.
- Almacenamiento: el planificador comparte el sobre cifrado y se incluye en las copias `.cdoc` sin alterar notas; prueba de cifrar y recuperar correcta.
- La versión HTML autónoma está empaquetada, con estilos, motor, PDF, JSZip y planificador integrados en un único archivo, con CSP basada en hashes.
- **No se ha validado** persistencia/recuperación real con Safari de macOS, iOS ni iPadOS en `file://`. No introducir calificaciones reales.
- GitHub: sin cambios de v1.4; no se ha publicado.
