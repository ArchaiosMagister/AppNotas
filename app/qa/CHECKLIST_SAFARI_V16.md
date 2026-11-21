# Protocolo breve de aceptación — CuadernoDocente v1.6

**Siempre con alumnado ficticio.** La versión autónoma usa `file://` y su almacenamiento puede variar al cambiar de nombre o ubicación. Antes de comenzar, exporta un respaldo `.cdoc` de cualquier cuaderno de pruebas anterior y conserva la contraseña.

## Safari en Mac (prioridad)

1. Abre `CuadernoDocente_v1.6_prepublicacion_sin_instalar.html` desde Finder con Safari. Crea un cuaderno de prueba, un grupo ficticio y dos alumnos.
2. Añade tres exámenes (uno sobre 5, otro sobre 10 y una recuperación). Comprueba que 4,25/5 equivale a 8,50/10. Pon 4 faltas a 8,50/10: debe resultar 8,10; marca Entregadas y debe volver a 8,50. Desmarca y comprueba 8,10.
3. Prueba las reglas de media, ponderación, última más alta y evaluación final con valores conocidos; verifica también los cálculos al faltar alguna nota.
4. Importa el Excel de Actitud incluido en `examples/`, verifica sus cinco criterios de 20 % y que «Uso del móvil» no ofrezca Regular si estaba representado con «–».
5. Añade clases al horario; programa un examen y comprueba que hereda la hora. Crea cambio de hora, edítalo a cancelación y comprueba que no queda la hora desplazada. Renombra el período y cambia de tema claro/oscuro/OLED.
6. Cierra Safari, vuelve a abrir el MISMO archivo, desbloquea el cuaderno y comprueba calificaciones, planificador, rúbricas y casillas.
7. Exporta `.cdoc`, comprueba que no contiene nombres en texto legible y restáuralo. Vuelve a verificar todas las notas y el estado de entrega.
8. Repite con una segunda pestaña abierta para verificar que no sobrescribe silenciosamente las notas de la primera. Comprueba el flujo de recuperación antes de introducir nuevos cambios.

## iPhone y iPad

El HTML de doble clic no equivale a una webapp instalable en iOS. Las pruebas reales en iPhone/iPad precisan una URL HTTPS o un procedimiento compatible con su navegador. En esa versión, comprueba la navegación táctil, scroll horizontal del cuaderno, apertura de modales, colores, rúbricas y copia cifrada. La persistencia PWA e IndexedDB debe verificarse por separado.

## Resultado

Registra fecha, dispositivo, versión de Safari, pasos superados y el texto exacto de cualquier error. **No se publicará v1.6 sin autorización del usuario.**
