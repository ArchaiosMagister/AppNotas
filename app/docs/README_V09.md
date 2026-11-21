# CuadernoDocente v0.9 — avance hacia la versión 1.0

**Versión experimental privada, sin publicación. Usar únicamente datos ficticios.** Partiendo de la v0.8 y conservando el motor de calificaciones, esta entrega hace **reversible la restauración de copias**: antes de sustituir el cuaderno, almacena su versión cifrada anterior de forma atómica; puedes descargarla o recuperarla, incluso desde la pantalla bloqueada, usando su contraseña. Solo se conserva un punto de rescate interno y no sustituye las copias `.cdoc` externas.

- **129 pruebas automatizadas**, sin fallos; las 2.320 comprobaciones matemáticas previas permanecen. La interfaz se ha probado con almacenamiento *simulado* en escritorio y móvil.
- **No es aún la 1.0**: las pruebas reales en Safari/IndexedDB/offline y el cotejo definitivo de la normativa siguen pendientes.
- Consulta `docs/CAMBIOS_V09.md`, `docs/CRITERIOS_V10.md` y `qa/PROTOCOLO_SAFARI.md`. La consulta antigua de Latín II sigue a la espera de una transcripción independiente del Decreto 108/2022: no se ha utilizado tu programación de aula.

**Inicio en Mac:** con Node.js 20 o superior, `npm start` dentro de esta carpeta y abrir `http://127.0.0.1:4173/` en Safari. Ejecutar `npm test` para comprobar el código. Antes de actualizar desde la v0.8, descargar y verificar una copia `.cdoc` y conservar su contraseña.

---

# CuadernoDocente v0.7 — guardado y recarga comprobables

**ZIP privado, sin publicación ni sincronización. Utilizar exclusivamente datos ficticios.**

Esta revisión continúa la v0.6 sin alterar el modelo ni las fórmulas. En «Ajustes y copias» añade **Probar guardado y recarga** para comparar el cuaderno cifrado antes y después de recargar, sin cambiar ninguna nota. Las pruebas automatizadas suman **111/111**, con 720 escenarios matemáticos heredados y 1.600 combinaciones nuevas. La prueba de interfaz es simulada: **no se ha validado todavía la persistencia offline real en Safari/iPadOS/iOS**.

Para abrir en Mac: ejecutar `npm start` (Node.js 20+) y entrar en `http://127.0.0.1:4173/` con Safari. Para pruebas automáticas: `npm test`. Para completar la verificación de datos, copias y modo offline: `qa/PROTOCOLO_SAFARI.md`.

No utilices información real del alumnado hasta superar las comprobaciones de dispositivo y protección de datos. Más información: `docs/CAMBIOS_V07.md`.

---

# CuadernoDocente v0.6 — integridad del guardado y copias verificables

**ZIP privado. Solo datos ficticios. Sin publicación, sin OneDrive y sin modificación del esquema v5.**

### Novedades de esta entrega

- Guardado cifrado con control transaccional de versión: dos pestañas no pueden sobrescribir mutuamente sus notas sin aviso.
- Un error de guardado se muestra como **«¡Sin guardar!»** y bloquea nuevas ediciones hasta revisarlo.
- **Verificar copia** comprueba el descifrado y el modelo de un archivo `.cdoc` **sin restaurarlo**.
- Restaurar y verificar copias emplean una **contraseña enmascarada**.
- **Comprobar recursos offline** revisa que la caché contenga los archivos de la PWA; no sustituye una prueba real de desconexión.
- Nueva caché `cuaderno-docente-static-v06` y 103 pruebas automatizadas, conservando la auditoría matemática de la v0.5.

### Cómo probar

Desde la carpeta descomprimida, con Node.js 20+, ejecutar `npm start` y abrir `http://127.0.0.1:4173/` en el **mismo dispositivo**. Para pruebas automatizadas, ejecutar `npm test`. En «Ajustes y copias», verificar el respaldo cifrado y la preparación offline.

**No utilizar con notas reales:** persisten limitaciones de validación en Safari/iOS e instalación offline real. Consulta `docs/CAMBIOS_V06.md` y `RESULTADOS_PRUEBAS.md` para las pruebas y limitaciones exactas.

---

# CuadernoDocente v0.5 — auditoría prioritaria de cálculos

**Prototipo privado en ZIP, offline-first y solo con datos ficticios.** No hay publicación ni sincronización OneDrive. El modelo cifrado sigue siendo esquema v5, compatible con la v0.4.

## Lo nuevo de v0.5

- Corregida la regla «último examen/periodo si es el mejor» cuando hay una actividad o periodo posterior **sin calificar**: no se considera «último» un examen anterior; en ese supuesto se aplica la media de las notas disponibles.
- Protección contra resultados sobre diez incorrectos: si desactivas la conversión de una columna y su calificación bruta supera 10, se bloquean las medias y competencias dependientes, con aviso de corrección. Las notas originales **no** se alteran.
- Corregido el **guardado de rúbricas con coma decimal**, consistente con la vista previa; validación estricta de las entradas numéricas y aviso antes de cambiar escalas ya utilizadas.
- Nota final anual: los periodos con calificaciones pero cálculo automático inválido no desaparecen silenciosamente de la media. Puedes corregir el problema, excluir el periodo o introducir una nota manual; los periodos con ponderación cero no cuentan.
- Gestión: editar/reordenar alumnos, renombrar grupos y periodos, reordenar periodos y eliminar alumnos con confirmación y posibilidad de deshacer durante la sesión.
- **96 pruebas automatizadas + 720 casos deterministas de referencia**. Interfaz recorrida con Chromium y almacenamiento simulado; **no** se han podido validar el almacenamiento offline real ni Safari/iPadOS.

Para ejecutar localmente: instala Node.js 20 o superior, descomprime y ejecuta `npm start` dentro de `CuadernoDocente_v0.5`. Abre `http://127.0.0.1:4173/`. Para las pruebas, ejecuta `npm test`; para la prueba visual **simulada**, `python qa/browser_simulado.py` (requiere Playwright y Chromium).

Antes de actualizar, guarda una copia cifrada `.cdoc` de la versión anterior y conserva la contraseña. No se modifican ni se suben datos a OneDrive. La primera validación de v0.5 debe hacerse con datos ficticios.

Consulta `docs/CAMBIOS_V05.md` y `RESULTADOS_PRUEBAS.md` para los casos verificados, las reglas exactas y lo pendiente.

---

# CuadernoDocente v0.4 — rúbricas visuales y deshacer/rehacer

**Prototipo experimental: usar exclusivamente datos ficticios. Sin repositorio remoto, sin publicación y sin OneDrive.**

## Novedades de la v0.4

- Editor visual de rúbricas por filas, con añadir/quitar criterios, pesos y máximos editables.
- Calificar con rúbrica: puntuaciones rápidas (cero, mitad, máximo), cálculo sobre 10 en tiempo real, progreso de criterios y botón «Guardar y siguiente alumno».
- Duplicación segura de rúbricas incluso cuando la plantilla original tiene calificaciones.
- Deshacer y rehacer hasta 30 operaciones de esta sesión, incluyendo eliminación de una actividad con sus notas; atajos de teclado fuera de campos de edición. El historial es **volátil y se borra al bloquear**; guarda copias cifradas para recuperación a largo plazo.
- Guardado serializado y validación de los cambios antes de confirmarlos; mejoras de navegación horizontal por pestañas en móvil.

## Ejecutar localmente

Se necesita Node.js 20 o posterior. Descomprime y ejecuta `npm start` desde la carpeta `CuadernoDocente_v0.4`; abre **http://127.0.0.1:4173/** en el mismo ordenador. No abras `index.html` directamente mediante `file://`: no es un origen apropiado para una PWA.

Para ejecutar pruebas: `npm test`. La prueba visual con almacenamiento simulado requiere Python y Playwright: `python qa/browser_simulado.py`. **La simulación no demuestra funcionamiento offline ni almacenamiento IndexedDB real.** Las comprobaciones en Safari, iPad e iPhone siguen pendientes.

**Antes de actualizar desde la v0.3**, descarga una copia cifrada `.cdoc` desde la versión antigua, conserva la contraseña y utiliza el mismo perfil de navegador y origen local; no hay sincronización automática entre navegadores. El esquema permanece en v5 y la migración de versiones anteriores se conserva.

Detalles técnicos en `docs/CAMBIOS_V04.md`, `docs/MODELO_DATOS.md`, `docs/SEGURIDAD.md` y `RESULTADOS_PRUEBAS.md`.

---

## Historial de la v0.3 y anteriores

## Novedades v0.3

- **Escala por columna** (0–10, 0–5, 0–3, cualquier máximo positivo) y **conversión opcional a 0–10** para el cálculo. Las notas anteriores mantienen su conversión activada.
- **Rúbricas** para trabajos, actitud y otras actividades: creación en la app o importación **CSV/JSON**, valoración por criterios con pesos y conversión automática a 0–10.
- **Modo alumno individual**: botón «Ver» en cada fila del cuaderno; todas sus notas agrupadas por categoría y evaluación, sin mostrar la lista de otros alumnos. Botón «Ocultar notas».
- **Evaluación final del curso** en pestaña propia, con medias de los periodos automáticas o sustituidas manualmente para cada alumno, media aritmética, ponderada o última si es la mejor. Posibilidad de excluir periodos y configurar pesos por grupo.
- **Migración automática desde v0.2.2** (esquema v4 a v5) y desde anteriores; sin cambiar contraseña ni IDs.

## Uso local

Necesitas **Node.js 20+**. Descomprime el ZIP, ejecuta `npm start` dentro de la carpeta y abre `http://127.0.0.1:4173/` en **el mismo ordenador**. Para validar las funciones offline de PWA en Safari/iPad será necesaria una prueba de instalación posterior; no se admite la apertura directamente con `file://`.

`npm test` ejecuta la batería automatizada; los casos nuevos están en `tests/v03_features.test.mjs`. Consulta `docs/CAMBIOS_V03.md` para reglas, límites y garantías exactas.

Antes de abrir un cuaderno cifrado anterior, **descarga y guarda una copia `.cdoc` desde la versión antigua**. Las versiones anteriores no pueden abrir el esquema nuevo. No utilices información real del alumnado hasta superar pruebas de navegador, seguridad y revisión institucional.

---

## Historial de las versiones anteriores

# CuadernoDocente 0.2.2 — paleta predeterminada por asignatura

- Latín 4.º: **amarillo** (`#EAB308`); Latín I: **ámbar** (`#F59E0B`); Latín II: **naranja** (`#EA580C`).
- Griego I: **azul celeste** (`#0284C7`); Griego II: **azul intenso** (`#1D4ED8`).
- Los cinco colores siguen siendo editables individualmente.
- Los cuadernos v0.2.1 se migran automáticamente: cambian únicamente los valores iguales a los antiguos predeterminados; cualquier color diferente elegido previamente se conserva. Los datos y cálculos permanecen intactos.
- **Nota:** en v0.2.1 no se registraba si un color se había seleccionado manualmente cuando coincidía exactamente con el antiguo predeterminado; ese caso indistinguible adopta el nuevo color. Se puede volver a seleccionar cualquier tono.
- Cambio de esquema interno a v4; mantén una copia cifrada anterior antes de actualizar. No existe publicación ni sincronización OneDrive.

# CuadernoDocente 0.2.1 — actualización de cursos, materias y colores

- Tres cursos: 4.º ESO, 1.º Bachillerato y 2.º Bachillerato, con asignaturas filtradas (Latín 4.º, Latín I, Griego I, Latín II y Griego II).
- Selector encadenado **Curso → Asignatura → Grupo → Periodo**. Los grupos pertenecen a una combinación validada de nivel y materia.
- Cinco colores de acento independientes y editables desde la barra o Ajustes; guardados dentro del cuaderno local cifrado.
- Migración automática de cuadernos v0.1/v0.2 con grupos, notas e IDs conservados. Las materias no reconocidas se identifican como «Sin clasificar», sin reclasificación automática.
- Uso experimental exclusivamente con datos ficticios, sin publicación ni OneDrive.

# CuadernoDocente — prototipo v0.2

Cuaderno de calificaciones **offline-first** en castellano, sin conexión con OneDrive ni con otros servicios, preparado para ejecución local y pruebas con alumnado **exclusivamente ficticio**. Incluye modelo de datos versionado, almacenamiento cifrado, periodos personalizables, importación CSV y motor de evaluación configurable.

> **Estado:** prototipo experimental. **No utilizar con datos reales del alumnado**: falta auditoría de seguridad, autorización institucional y pruebas en dispositivos de destino (especialmente Safari/iPadOS).

## Iniciar la aplicación

Requisitos: Node.js **20 o superior**. Sin dependencias externas ni compilación.

```bash
npm start
```

Abrir `http://127.0.0.1:4173/` en el navegador del **mismo ordenador**. La primera apertura solicita crear una contraseña (mínimo 12 caracteres) e incorpora ocho alumnos ficticios. Se conservan los datos del navegador en IndexedDB, **cifrados**. La red deja de ser necesaria para los cálculos; los archivos de la PWA se almacenan para usos posteriores. **La apertura offline después de instalarla requiere comprobaciones en cada navegador y dispositivo**.

No abrir `index.html` directamente con `file://`. No exponer el servidor local en una red, no abrir puertos externos y no publicar la aplicación con datos reales.

## Mejoras de la versión 0.2

- **Perfiles por grupo y periodo:** pesos y reglas independientes de la configuración general. Permite copiar reglas de otro periodo del mismo grupo o volver a las predeterminadas.
- **Más métodos de cálculo por categoría:** media aritmética, media ponderada según pesos relativos de cada actividad, nota máxima, media de las N mejores, última evaluada y «última si es máxima; de lo contrario, media».
- **Recuperaciones enlazadas:** una recuperación por actividad, bien para conservar la mayor de las dos notas o bien para sustituir siempre. No se duplican las evidencias en la categoría, aunque ambas columnas son visibles.
- **Edición de columnas:** cambiar nombre, categoría, máximo o peso relativo; desplazar a izquierda/derecha; eliminar con confirmación expresa (eliminar también borra las notas de esa columna).
- **Mejora de entrada de notas:** casillas aceptan coma o punto decimal. Intro avanza a la fila siguiente de la misma actividad; Mayús+Intro a la anterior.
- **Desglose explicable:** nota por categoría, actividades consideradas, recuperaciones, regla aplicada y nota final.
- **Migración automática de cuadernos cifrados 0.1 a 0.2:** conserva identificadores, alumnos, notas y contraseña; se aplica también al restaurar copias cifradas de 0.1. Antes de actualizar, se recomienda **descargar una copia cifrada de la versión anterior**, porque no hay vuelta atrás automática.

## Más capacidades de la base 0.1

- Grupos, periodos personalizables, listado de alumnos fijo, tabla de notas desplazable, categorías y competencias.
- Incorporación manual e importación CSV de alumnos (cabecera `nombre` o `alumno`, separadores `;` o `,`).
- Cálculo por competencias vinculadas a categorías, independiente de la nota final.
- Casilla vacía distinta de nota cero; escala 0–10 interna con máximos de actividad configurables; redondeo solo al mostrar resultados.
- Copia cifrada `.cdoc` descargable y restaurable; contraseña no enviada al servidor.

## Reglas fundamentales

- Los porcentajes de cada **grupo y periodo** deben sumar 100; de lo contrario, se muestra `—` en la nota final.
- Una categoría sin evidencias se excluye temporalmente y su porcentaje se redistribuye proporcionalmente entre las evaluadas.
- Las recuperaciones sustituyen la evidencia original sin volver a contabilizarla; mantienen el orden lógico del examen de origen para las reglas «último».
- Las competencias usan los resultados de las categorías de ese periodo, ponderados por los vínculos de la competencia.
- Las notas originales no se redondean en los cálculos; el redondeo es de visualización.

## Pruebas

```bash
npm test
```

37 pruebas automatizadas: 24 heredadas y 13 añadidas; cubren migración, aislamiento por periodo/grupo, recuperaciones, ponderaciones, edición de actividades, coherencia del modelo y cifrado. Se ha comprobado también que un servidor local responde a los recursos; **Chromium con navegación local está bloqueado por una política del entorno de ejecución**, por lo que la prueba visual y la apertura sin conexión no están validadas. Requieren pruebas manuales antes de subir a 1.0.

Archivos de apoyo: `docs/MODELO_DATOS.md`, `docs/SEGURIDAD.md`, `docs/CAMBIOS_V02.md`.

## Siguientes prioridades

Auditoría de accesibilidad y respuesta en Safari/iPad; deshacer para borrados, historial de cambios, controles adicionales de integridad y recuperación; edición de categorías predeterminadas; vinculaciones competenciales por actividad, y fórmulas libres con parser seguro. La sincronización con OneDrive **no está implementada** y se mantiene para una fase posterior con el aval de la organización.


## v0.8 · Consulta curricular de solo lectura

La pestaña **Currículo** es accesible desde cualquier materia (incluso sin grupo creado). Organiza competencias específicas, criterios, saberes básicos y apartados complementarios como tarjetas. Se puede buscar por término y filtrar por competencia. En Latín II, se distinguen las versiones de 2022 (curso actual, fuente antigua aún pendiente de transcripción) y 2026 (curso siguiente). La fuente PDF de los demás currículos se incluye para cotejo sin conexión.

La sección es completamente independiente de las competencias configurables y de los pesos para calcular notas. No cambia esquema ni datos, ni convierte los criterios del decreto en pesos automáticos. **No se han importado datos de la programación de aula** del archivo Pages de Latín II. Leer `docs/CURRICULOS_FUENTES.md` para información de procedencia y límites.
