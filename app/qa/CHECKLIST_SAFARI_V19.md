# Lista de aceptación en Safari — CuadernoDocente v1.9

**Solo con alumnado y notas ficticias.** Antes de abrir la v1.9, exportar y conservar una copia cifrada `.cdoc` desde la versión anterior. No confiar en que `file://` comparta IndexedDB entre archivos distintos.

1. **Arranque del HTML autónomo:** abrir el archivo mediante doble clic, comprobar que desaparece «Preparando el cuaderno» y que aparecen todas las pestañas. Verificar que al tocar ⓘ se abren las estadísticas sin dejar la interfaz bloqueada.
2. **Guardar y reabrir:** introducir notas en /10, /5 y /3, guardar, cerrar Safari por completo, reabrir el mismo HTML y desbloquear. Deben permanecer idénticos los valores originales, el número de faltas y su entrega.
3. **Copia y restauración:** exportar una copia `.cdoc`, modificar una nota y restaurar la copia. Deben recuperarse exactamente notas, rúbricas, recuperaciones, categorías, competencias y configuración final. Probar también la copia de rescate cuando proceda.
4. **Cambio sin efectos colaterales:** en dos grupos con calificaciones, cambiar nombre, color, curso escolar y orden del alumnado en uno. Confirmar que el otro no cambia y que las notas originales son las mismas.
5. **Categoría compartida vacía:** ocultar una categoría de un grupo sin actividades; verificar que las reglas y la categoría siguen disponibles en el otro grupo. Si hay un vínculo competencial propio, el cuaderno debe solicitar que se desvincule antes.
6. **Operaciones fallidas:** introducir peso de competencia negativo, escala inválida o fecha académica incorrecta. Nada debe cambiar tras el aviso. Probar Deshacer/Rehacer tras una modificación válida.
7. **Operaciones idempotentes:** guardar otra vez una nota exactamente igual, o borrar una celda ya vacía; no debe producirse un nuevo cambio en el historial.
8. **Muestras matemáticas:** probar una evaluación con categorías 60/30/10, medias ponderadas, regla última si es mayor, recuperación reemplazante y mayor, rúbrica, faltas con y sin entrega y evaluación final con periodos excluidos.
9. **Estadísticas:** verificar que los alumnos sin nota no cuentan como suspensos, y que la tarjeta explica aprobados/total y evaluados/total.
10. **Planificador y notas:** crear un examen vinculado, cambiar una sesión excepcional, añadir festivos y trasladar contenidos; confirmar que las calificaciones del cuaderno no cambian.
11. **Dispositivos:** repetir en Safari macOS y, tras desplegar HTTPS con autorización, en iPhone/iPad. El HTML local en Safari no sustituye las pruebas HTTPS/PWA reales.

No se debe introducir información de alumnado real hasta validar la persistencia en los dispositivos que se utilizarán, restauración, privacidad y requisitos del centro.
