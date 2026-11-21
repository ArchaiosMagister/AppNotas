# Verificación de prepublicación — CuadernoDocente v1.15 (21 de noviembre de 2026)

## Solicitud

Aumentar tamaño y claridad de los botones de curso y mostrar la asignatura en cada uno. Mantener acentos individualizados y no alterar calificaciones ni el resto del cuaderno.

## Cambios efectuados

1. La vista superior presenta cinco botones: **Latín 4.º ESO**, **Latín 1.º Bachillerato**, **Griego 1.º Bachillerato**, **Latín 2.º Bachillerato**, **Griego 2.º Bachillerato**. No hay desplegable duplicado de asignatura.
2. `setSubjectChoice(level, subject)` se reutiliza para seleccionar ambas dimensiones. El grupo y el color proceden del modelo existente. Se conserva acceso por botón a materias heredadas «Sin clasificar».
3. Distribución de botones adaptable a escritorio, tableta y móvil. Colores de acento propios, sin alterar las escalas de notas. Foco y `aria-pressed` accesibles.
4. Aplicación de estilos mediante CSSOM para respetar CSP del HTML autónomo. Ajustada la caché de la edición a v115 y el texto informativo de las estadísticas.

## Resultados

| Control | Resultado |
|---|---|
| Pruebas automáticas Node | **314 aprobadas / 0 fallidas** |
| Pruebas nuevas del selector | 3 |
| Botones verificados en Chromium simulado | 5 de 5, texto completo correcto |
| Datos del documento antes/después de seleccionar | **Iguales**, comparación JSON |
| Foco, `aria-pressed`, grupo por materia | Correctos |
| Modos claro, oscuro, OLED | Correctos |
| Pantallas 1440/1024/835/390/320 px | Sin desbordamiento horizontal general |
| Altura mínima botones en móvil | 66 px en tamaños ensayados |
| Errores JavaScript del recorrido | 0 |
| Recursos `src/` frente a v1.14 | 16 de 16 idénticos |
| Política CSP y color personalizado | Verificada color de borde visible bajo CSP |
| Integridad ZIP y equivalencia HTML | Verificada en cierre de paquete |

## Restricciones

Las pruebas visuales usan Chromium y almacenamiento de prueba instrumentado. **No validan de forma concluyente el almacenamiento IndexedDB real al abrir `file://` con Safari** ni sustituyen pruebas con datos ficticios en dispositivo físico. GitHub no se ha modificado ni se ha publicado nada.
