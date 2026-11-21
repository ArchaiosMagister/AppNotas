# Informe de prepublicación — CuadernoDocente v1.16

**Fecha de trabajo:** 21 de noviembre de 2026. **Fuente:** ZIP v1.15 proporcionado en el proyecto. **Estado:** candidato local, no publicado.

## Implementación solicitada

- Cuatro reglas de cálculo para cada alumno/categoría/evaluación: general, media condicional si hay NP computable, media siempre, última prueba sustitutiva aunque sea inferior. La regla general se hereda por defecto.
- Estados diferenciados: **NP** (cuenta como 0), **AJ** (ausencia justificada pendiente, no computa), y **sin nota** (no computa); AJ puede ocultar temporalmente una nota sin destruirla.
- Recuperaciones de actividad: sigue vigente la función de recuperación vinculada, «solo si mejora» o «sustituir siempre»; una recuperación no duplica la evidencia.
- Acceso docente en Cálculos y desglose de la nota final, mostrando antes y después de cambiar la regla.
- Nota final del período, curso, competencias y tarjetas estadísticas siguen el cálculo efectivo.

## Resultados

| Verificación | Resultado |
|---|---|
| `node --test tests/*.test.mjs` | **334/334 correctas** |
| Nuevas pruebas de reglas, AJ, migración y seguridad | 20 |
| Contraste independiente adicional | 960 configuraciones de exámenes, NP, AJ y reglas |
| Migración del esquema v7 a v8 | Preserva IDs, notas, alumnos y rúbricas; idempotente |
| Copia cifrada y apertura de sobre en Node | Datos íntegros, incluidas excepciones y AJ |
| Historial de deshacer/rehacer | Estado exacto restaurado |
| Separación entre alumnos y asignaturas | Sin alteración cruzada en las pruebas |
| Copia de estructura entre trimestres | No duplica notas ni reglas individuales |
| Prueba visual con Chromium instrumentado | Regla individual, vista previa, guardar, AJ reversible, modo alumno |
| Modos visuales | Claro, oscuro y OLED |
| Anchuras visuales simuladas | 1440, 834 y 390 píxeles |
| Errores JavaScript en recorridos ensayados | 0 |
| Validación Safari físico `file://` | Pendiente: no disponible en este entorno |

## Riesgos residuales y protocolo de prueba

No puede garantizarse que no existan errores fuera de los escenarios examinados. El entorno Chromium de ejecución **bloquea abrir rutas `file://`**, por lo que las comprobaciones del HTML autónomo se hicieron mediante una página instrumentada con la misma aplicación, pero con guardado simulado. El descifrado y cifrado de archivos se contrastó por pruebas Node, no con el almacenamiento persistente de Safari real.

1. Descargar una **copia `.cdoc` de v1.15** antes de abrir la nueva edición.
2. Abrir HTML v1.16 en Safari con datos ficticios, crear una regla individual y marcar AJ en una nota; cerrar y volver a abrir, verificar cifras y estado.
3. Descargar una copia `.cdoc` v1.16, restaurarla en la **misma versión v1.16** y comprobar que la nota previa reaparece al desmarcar AJ.
4. No intentar restaurar copias v1.16 en v1.15: el esquema nuevo tiene migración ascendente, no descendente.

**GitHub privado ArchaiosMagister/AppNotas: sin cambios. No se ha fusionado ni publicado nada.**
