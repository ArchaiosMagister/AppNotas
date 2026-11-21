# CuadernoDocente v1.1 — cambios de prepublicación

Copia derivada del ZIP v1.0-rc1 proporcionado por el usuario. **No publicada en GitHub.** No se ha modificado la estructura de los sobres cifrados ni se ha elevado la versión del esquema (sigue siendo v5), de modo que se respetan los cuadernos anteriores. Se recomienda siempre guardar y verificar una copia `.cdoc` antes de abrir una versión nueva.

## Interfaz

- Sustituido el desplegable de periodo por botones situados inmediatamente encima del cuaderno. «Evaluación final» se mantiene como último botón separado. En móviles se muestran las tres evaluaciones y, debajo, el botón final sin ocultarlas en scroll.
- «+ Alumno» y «+ Actividad» son ahora acciones principales junto a la tabla; «Copiar actividades» se sitúa al lado.
- En Cálculos, cada categoría es eliminable mientras no tenga actividades asociadas; las categorías siguen pudiéndose crear libremente. El bloqueo de borrado evita pérdidas de notas.

## Actividades y rúbricas

- En «+ Actividad» se puede elegir nota numérica, rúbrica guardada, crear una rúbrica de criterios o importar directamente Excel (.xlsx), CSV o JSON.
- Se ha incluido el lector ZIP/Excel JSZip local sin CDN ni servicios externos (ver licencia `vendor/LICENSE-JSZip.md`).
- Se conserva el texto de los niveles descriptivos de los Excel con formato matricial. El ejemplo aportado tiene cinco criterios ponderados al 20 %, con Bien 2, Regular 1 y Mal 0. En «Uso del móvil», «Regular» aparece con «–» y por ello **no es un nivel seleccionable**.
- Una rúbrica descriptiva se califica mediante la selección del nivel y la lectura de su descripción. La nota resulta de ponderar cada criterio y convertir al intervalo 0–10; no se redondea antes de calcular.
- Para modificar descriptores de rúbricas importadas se edita el Excel y se importa nuevamente; la aplicación no destruye los niveles al permitir una edición parcial del máximo o el peso. Una rúbrica con notas registradas sigue bloqueada contra cambios retroactivos.

## Estructura y configuración de trimestres

- «Copiar actividades» duplica nombre, categoría, escala, peso, rúbrica y referencias de recuperaciones en una o varias evaluaciones vacías.
- También se copian los porcentajes y reglas de las categorías del periodo de origen para que la copia no cambie la fórmula de cálculo. **Nunca se copian notas.** Si una evaluación de destino ya contiene actividades, no se sobrescribe.

## Plantilla de 2.º de Bachillerato

Al crear un **grupo nuevo** de Latín II o Griego II, el primer trimestre recibe automáticamente:

1. Examen parcial.
2. Examen final.
3. Literatura (Latín II) o Cultura (Griego II).
4. Actitud, vinculada a la rúbrica facilitada por el usuario.

Propuesta inicial **editable** para el primer trimestre: Exámenes 60 %, Literatura/Cultura 30 %, Actitud 10 %. «Trabajos» se mantiene como categoría global con peso **0 %** para ese grupo, sin borrar datos de otros cursos. Los dos exámenes se ponderan por igual dentro de su categoría, salvo modificación del docente.

Los grupos existentes no reciben nuevas columnas automáticamente, para evitar alteraciones silenciosas. Puedes crear o copiar actividades manualmente. Estas ponderaciones son una **propuesta de interfaz** que debe validarse con los criterios de evaluación del centro.

## Límites y aceptación

- La batería automatizada de Node y la prueba del importador con Chromium no equivalen a una prueba de Safari real.
- La prueba visual de interfaz se hizo mediante un entorno simulado **sin IndexedDB**; no valida guardado, cifrado ni restauración físicos.
- En Safari Mac deben validarse el guardado con `file://`, el cierre/reapertura, la importación XLSX y la copia cifrada `.cdoc` antes de uso real.
- Para iPhone/iPad se necesita un entorno adecuado (una web HTTPS o un archivo local admitido por el visor); la edición HTML no es instalable como PWA.
