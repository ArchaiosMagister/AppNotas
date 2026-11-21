# Cambios v1.16 — reglas individuales, AJ y recuperaciones

1. `src/model.js`: esquema 8 con `individualCategoryRules` y `setIndividualCategoryRule`. Nuevos estados AJ reversibles y validaciones de pertenencia a grupo, exclusión mutua NP/AJ y nota original retenida.
2. `src/calculations.js`: reglas individuales por alumno/categoría/período; NP cuenta como 0 cuando está en la evidencia efectiva; AJ no contribuye. Las recuperaciones existentes siguen construyendo una única evidencia. Los cálculos de competencias, periodos y curso reutilizan estas funciones sin fórmulas duplicadas.
3. `src/statistics.js`: excluye AJ de los denominadores de alumnos evaluados, no lo trata como suspenso.
4. `app.js`: controles AJ junto a NP; editor docente de reglas con previsualización y cancelación; acceso desde Cálculos y desglose del alumno. Modo alumno solo lectura.
5. `styles.css`: estilos de controles y modal acordes con Tabularium, con tres temas y diseño adaptable.
6. `tests/v116_individual_rules_and_justified_absences.test.mjs`: 20 pruebas nuevas, incluyendo 960 escenarios de contraste. Migraciones y cifrado verificados.
7. `sw.js`: versión nueva de la caché; el HTML autónomo incluye los 17 módulos JS y cuatro PDFs curriculares, con CSP por hashes.

## Nota docente

La opción «Media obligatoria si hay NP» solo sustituye la regla general cuando hay un NP que sigue computando como cero tras las recuperaciones. Si la recuperación ya lo sustituye por una calificación, no se fuerza la media. Si la última actividad está sin calificar o en AJ, la regla «última sustitutiva» no la toma como evaluada y aplica la media de las evidencias disponibles.

Los ajustes son excepciones reversibles: al elegir «Aplicar regla general» desaparece el registro individual sin alterar ninguna nota.
