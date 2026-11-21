# Auditoría y optimización — CuadernoDocente v1.6 (prepublicación)

**Fecha:** 21/11/2026 · **Origen:** ZIP `CuadernoDocente_v1.5_prepublicacion.zip` · **Destino:** nueva candidata local v1.6 · **GitHub:** sin modificaciones ni publicación.

## Resultado resumido

| Verificación | Resultado | Alcance |
|---|---|---|
| Batería Node.js | **220/220 correctas** | Incluye 20 pruebas nuevas sobre la v1.5 (18 de funcionalidad/seguridad y 2 de integridad de publicación) |
| Regresión visual de notas y rúbricas | **Correcta** | Chromium simulado, sin servidor; 8,50 − 0,40 = 8,10, Entregadas = 8,50, /5→/10, 2 decimales, temas y modo alumno |
| Regresión visual del planificador | **Correcta** | Chromium simulado; horario, guardias, clases, exámenes vinculados, festivos, vistas y exportación ICS |
| Importación Excel adjunto | **Correcta** | XLSX original de Actitud 2bach: cinco criterios, 20 % cada uno y «Uso del móvil» con niveles 2/0 (sin Regular ficticio) |
| Integridad de HTML autónomo | **Correcta** | Dos scripts y CSS con SHA-256 coincidente con CSP; cuatro PDF incorporados, sin enlaces remotos |
| Servidor de desarrollo | **Correcto** | Archivos permitidos: HTTP 200; `package.json`, tests y rutas ajenas: HTTP 404; CSP, nosniff, no-store |
| Rendimiento de medias | **Mejora medida** | 160 alumnos, 80 actividades, 12 832 notas, 160 resultados idénticos |
| Safari macOS, iPhone/iPad reales | **Pendiente** | Pruebas manuales de persistencia, PWA y recuperación con datos ficticios |

## Optimizaciones y errores corregidos

1. **Cálculo de categorías.** La versión anterior buscaba la calificación de un alumno mediante `Array.find` por actividad y recuperación, sobre toda la matriz de notas. La v1.6 construye índices temporales por alumno y recuperación para cada consulta. Los índices no persisten entre cambios: las calificaciones se recalculan con los datos actualizados.
2. **Cambios de horario.** Al cambiar una excepción de «cambio de hora» a cancelación, o al trasladarla a otra fecha, se restaura la hora semanal de los eventos de la fecha original antes de actualizar la nueva. Se ha probado también el borrado de la excepción.
3. **Integridad del planificador.** Al restaurar datos, se rechazan tipos heredados de `Object.prototype` (como `constructor`) y duplicados de excepción día/sesión, planificación día/sesión y examen vinculado (por año).
4. **Lectura de XLSX.** Límites adicionales por hoja XML (5 MB descomprimidos), cadenas compartidas (3 MB), número de entradas ZIP (1000) y rechazo de DTD/entidades XML. El ZIP importado sigue limitado a 3 MB. No hay envío a terceros.
5. **Actualización PWA.** Nuevo nombre de caché `cuaderno-docente-static-v16-dev`, sincronizado con la comprobación offline de la interfaz y verificado automáticamente.

La versión **no cambia el esquema de datos (v6)** ni las reglas docentes de ponderación, conversión, recuperación, faltas, redondeo y cálculo final.

## Medición de rendimiento

Datos sintéticos: 160 alumnos, 80 actividades por grupo, 12832 calificaciones en total. Dos recorridos equivalentes sin alterar notas:

- v1.5: **1057.74 y 986.47 ms**.
- v1.6: **57.79 y 43.3 ms**.
- Mejora aproximada en el mejor recorrido: **×22.8**.
- Resultados numéricos iguales en los 160 alumnos.

La mejora es una medición local orientativa sobre un caso sintético; el rendimiento real dependerá del dispositivo y del tamaño del cuaderno. **No implica que toda la aplicación sea 23 veces más rápida.**

## Pruebas manuales aún necesarias

- **Safari Mac `file://`:** abrir, crear datos ficticios, cerrar y reabrir el mismo HTML; verificar notas, rúbricas, historial, estado de faltas, planificación y cambios de tema.
- **Copias cifradas `.cdoc`:** exportación, restauración, comprobación de contraseña incorrecta y recuperación de datos originales en Safari.
- **iPad y iPhone:** accesibilidad táctil, scroll de tabla, selección de niveles, entrada de notas y almacenamiento en una URL HTTPS o entorno PWA apropiado.
- **Concurrencia:** dos pestañas del mismo origen en Safari y reacción ante cambios simultáneos.
- **Decisiones institucionales:** uso con datos reales solo tras auditoría de seguridad, políticas de protección de datos y autorización del centro.

**Conclusión:** la candidata es adecuada para *pruebas locales con datos ficticios*; no se puede certificar todavía para uso con calificaciones reales. No se ha publicado en GitHub.
