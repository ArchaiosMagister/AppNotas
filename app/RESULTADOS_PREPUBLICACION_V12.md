# Informe de verificación · CuadernoDocente v1.2-prepublicación

Fecha: 21-11-2026. Estado: **candidata local**, no desplegada en GitHub.

- **152 / 152 pruebas automatizadas de Node correctas.** Incluye 9 casos específicos nuevos y las 143 comprobaciones anteriores. Pruebas de cálculos, cambios de escala, rúbricas, reglas de evaluación, cifrado, recuperación, importación de rúbricas y compatibilidad.
- La eliminación de Trabajos en Latín II cuando solo existen trabajos en Latín I deja intactos los datos y la nota de Latín I. Se bloquea el borrado cuando una categoría tiene actividades en otro trimestre del mismo grupo.
- Se comprueba la disponibilidad por grupo de categorías nuevas y la compatibilidad con categorías globales preexistentes.
- Se comprueba el rechazo de notas con más de dos decimales, la lectura de valores históricos de tres decimales sin pérdida de precisión interna, y el redondeo de presentación.
- Se ensayan los límites del color y el contraste real WCAG AA (mínimo 4,5:1) de todas las centésimas entre 0 y 10.
- **Prueba de interfaz automatizada con Chromium e HTML instrumentado:** cambio de temas claro/oscuro/OLED; OLED con fondo y paneles negros, eliminación de Trabajos en Latín II, preservación de trabajos de Latín I, nueva actividad sobre cinco, nota `4,25` con equivalencia `(8,50 /10)`, rechazo de `4,256`, color aplicándose de forma efectiva bajo CSP. Sin errores de JavaScript en el recorrido.
- **Límite:** el navegador de este entorno bloquea abrir `file://` directamente. No se ha podido probar la persistencia de la edición autónoma ni el Safari real en Mac, iPhone o iPad. Verificarlo con alumnado ficticio y copia `.cdoc`.

Archivo independiente: `CuadernoDocente_v1.2_prepublicacion_sin_instalar.html`. Archivo en el ZIP: `CuadernoDocente_sin_instalar.html`.
