> **Documento histórico v0.3.** La versión activa v1.9 utiliza el esquema 6; véanse README y `RESULTADOS_PREPUBLICACION_V19.md`.

# Contrato de datos — CuadernoDocente v0.3

El cuaderno es un único JSON **cifrado** en IndexedDB (`schemaVersion: 5`). El archivo descargable `.cdoc` contiene un *envelope* AES-GCM con parámetros de derivación de clave, nonce y texto cifrado, no nombres ni notas legibles.

## Colecciones

| Colección | Principales propiedades | Descripción |
|---|---|---|
| `groups` | `id`, `name`, `level`, `subject`, `course` | Grupos ligados a nivel educativo y asignatura; `course` conserva el año escolar |
| `periods` | `id`, `name`, `order` | Periodos compartidos, con parámetros de evaluación configurables por grupo |
| `students` | `id`, `groupId`, `name`, `order` | Alumnos pertenecientes a grupos |
| `categories` | `id`, `name`, `weight`, `rule`, `bestCount` | Plantillas predeterminadas para nuevas combinaciones de grupo/periodo |
| `gradingProfiles` | `id`, `groupId`, `periodId`, `overrides: [{categoryId, weight, rule, bestCount}]` | Ajustes de categorías por grupo y periodo |
| `assessments` | `id`, `name`, `groupId`, `periodId`, `categoryId`, `maxScore`, `weight`, `convertToTen`, `rubricId`, `order`, `recoveryOf?`, `recoveryMode?` | Actividades y recuperaciones; `weight` solo interviene en media ponderada |
| `grades` | `id`, `studentId`, `assessmentId`, `score`, `rubricRatings?` | Una nota por alumno y actividad; ausencia de registro = no evaluado |
| `competencies` | `id`, `name`, `links:[{categoryId,weight}]` | Competencias ponderadas a partir de categorías |
| `rubrics` | `id`, `name`, `criteria:[{id,name,maxScore,weight}]` | Rúbricas globales de criterio, sin datos personales |
| `finalConfigs` | `id`, `groupId`, `rule`, `weights`, `excludedPeriodIds` | Reglas y pesos por grupo para evaluación final, separada de los periodos |
| `finalOverrides` | `id`, `studentId`, `periodId`, `score` | Nota manual opcional /10 para sustituir la final automática de un periodo |
| `settings` | `decimals`, `rounding`, `subjectAccents` | Precisión, redondeo y colores por nivel/asignatura de presentación |

Todos los registros nuevos tienen ID aleatorio y marcas `createdAt`/`updatedAt`. Las notas y los cambios se guardan como un único estado cifrado; todavía **no** existe sincronización ni historial por registro.

## Semántica de los cálculos

Una nota se normaliza a 0–10: `10 × score / maxScore` **solo cuando** `convertToTen: true` (valor predeterminado); de lo contrario se usa el valor bruto. Las rúbricas se normalizan siempre. Por grupo, periodo y categoría se recogen las actividades evaluadas, excluyendo las recuperaciones como entradas separadas.

Cuando una recuperación tiene nota:
- `recoveryMode: higher`: evidencia = máximo entre original y recuperación (o recuperación si no hay original).
- `recoveryMode: replace`: evidencia = recuperación, incluso si es menor (o original si la recuperación está vacía).
- Solo se permite una actividad de recuperación por actividad de origen, ambas en la misma categoría, grupo y periodo. La evidencia corregida conserva el orden lógico del examen original.

Reglas de categoría: `mean`, `weighted_mean`, `highest`, `best_n`, `last`, `latest_if_highest`. `best_n` usa `bestCount` (1–100); la última regla elige la última **evidencia evaluada** si iguala o supera la mayor, de lo contrario calcula la media. Si no hay ninguna evidencia, la nota de la categoría es `null`.

Se obtienen reglas vigentes combinando la categoría base con el ajuste del perfil `groupId+periodId`. La suma de porcentajes debe ser 100 para poder calcular nota final. Si alguna categoría no tiene evidencia, se prorratea el peso entre las restantes categorías evaluadas. Una nota cero explícita sí computa.

Las competencias son medias ponderadas de categorías y sus pesos relativos. No se aplican redondeos durante los cálculos: `settings.decimals` y `settings.rounding` solo se utilizan al mostrar resultados.

## Migración de 0.1

`migrateNotebook` transforma documentos con `schemaVersion=1` a `2`, preserva IDs y calificaciones, crea `gradingProfiles: []`, añade `bestCount: 2` y `weight: 1` a cada actividad y valida las referencias. Cuando se desbloquea un cuaderno antiguo, la app lo vuelve a cifrar con la contraseña y sal previas. Los respaldos antiguos también se migran al restaurarse.

La v0.1 no entiende la v0.2; se recomienda conservar una copia `.cdoc` de la versión anterior antes de la primera apertura en v0.2.

## Limitaciones importantes

- Las categorías y competencias globales siguen compartidas entre grupos (sus **pesos y reglas** sí son independientes por grupo y periodo).
- Borrar una actividad borra las notas ligadas a ella; aún no existe deshacer, papelera, registro de auditoría ni tombstones.
- La sustitución de recuperaciones no distingue entre intentos múltiples o parciales; una recuperación por actividad como máximo.
- Aún no hay fórmula escrita por el usuario, fórmula libre escrita por el usuario ni vínculo competencial directo por actividad (sí hay ponderación anual y rúbricas).
- Todavía no hay soporte seguro de edición concurrente ni formato de sincronización. OneDrive se mantiene fuera de alcance.
- No hay validación jurídica ni de seguridad independiente para datos personales reales.

## Clasificación de grupos y colores — v0.2.1

`level` representa el curso curricular: `4eso`, `1bach`, `2bach`. `subject` debe estar permitido en el nivel correspondiente. El campo `course` es el **año escolar**, p. ej. `2026-2027`, y no se modifica. Las claves de `settings.subjectAccents` son `level:subject`. Los colores se validan como cadenas hexadecimales de seis dígitos y cambian únicamente la presentación, nunca el cálculo.

El paso v1/v2 → v3 preserva todas las calificaciones y sus referencias, reconoce cursos por asignaturas existentes y sitúa sin reclasificación los grupos antiguos de materia desconocida en «Sin clasificar».

## Paleta y compatibilidad — v0.2.2

El esquema v4 añade una migración v3 → v4 de colores: se sustituyen los antiguos tonos predeterminados cuando el valor almacenado coincide con el predeterminado de v0.2.1 y se conservan los valores distintos. Las notas, alumnos y relaciones no se modifican. Los respaldos cifrados de versiones 1, 2 y 3 se siguen pudiendo abrir mediante migración.

## Novedades del esquema v5

`migrateNotebook` admite v1–v4 y asigna por defecto `convertToTen:true` a las actividades antiguas para no cambiar ninguna calificación. Se añaden `rubrics`, `finalConfigs` y `finalOverrides` como colecciones versionadas con IDs. `finalEvidence` evita el redondeo intermedio, admite notas manuales y periodos excluidos, y calcula pesos relativos por grupo. Las rúbricas exigen la valoración completa de cada criterio y se verifica la coherencia de la nota con el detalle. Consultar `CAMBIOS_V03.md`.
