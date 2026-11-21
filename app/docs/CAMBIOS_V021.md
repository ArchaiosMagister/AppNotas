# Versión 0.2.1 · Selector de cursos, materias y acentos

Cursos habilitados:

| Curso | Asignaturas |
|---|---|
| 4.º ESO | Latín 4.º |
| 1.º Bachillerato | Latín I, Griego I |
| 2.º Bachillerato | Latín II, Griego II |

El selector de grupo filtra por curso/asignatura; si no hay grupo, se puede crear uno sin afectar a los demás. El curso escolar (`groups.course`) sigue almacenando el año (ej. 2026-2027); el campo nuevo `groups.level` guarda el nivel (`4eso`, `1bach`, `2bach`).

Colores: `settings.subjectAccents`, objeto con cinco claves `nivel:asignatura` y valores hexadecimales. El color se muestra en la interfaz y no altera los cálculos.

Migración a schemaVersion 3: conserva IDs, años escolares, calificaciones, actividades y perfiles. Identifica las asignaturas antiguas por su nombre. No elimina datos ni asigna de forma arbitraria grupos de materia desconocida: quedan `level:null` y `legacyUnclassified:true`, con un selector para clasificarlos manualmente. La migración se vuelve a cifrar usando la clave ya desbloqueada.

No se ha activado OneDrive, ni se ha publicado la webapp. La PWA debe servirse por localhost/HTTPS y no está auditada para datos reales.
