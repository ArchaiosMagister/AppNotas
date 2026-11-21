# CuadernoDocente v0.9 — auditoría de rescate (21/11/2026)

| Comprobación | Resultado |
| --- | --- |
| `npm test` completo | **129/129**, sin fallos |
| Casos matemáticos anteriores | **720 + 1.600**, conservados sin cambios del motor |
| Restauración cifrada transaccional | **9 pruebas nuevas**: éxito, intercambio reversible, conflicto, fallo de segundo `put`, obsolescencia, contraseña, origen vacío |
| Igualdad de motores | `model.js`, `calculations.js`, `vault.js`, `curriculum-data.js` idénticos a la v0.8 |
| UI Chromium con almacenamiento simulado | Aprobado en escritorio y a 390 px; sección de rescate visible en ajustes y desbloqueo |
| Service Worker real, IndexedDB real, reinicio Safari/macOS/iPadOS | **Pendientes** |
| Validación institucional y uso de datos reales | **No autorizados** |

Se incluye la guía de verificación de Safari ampliada (`qa/PROTOCOLO_SAFARI.md`) y los criterios concretos para denominar una futura versión estable 1.0 (`docs/CRITERIOS_V10.md`). El punto de rescate no sustituye una copia externa. No ha habido publicación.

---

# CuadernoDocente v0.7 — resultados de pruebas

| Prueba | Resultado |
| --- | --- |
| Suite completa `npm test` | **111/111**, 0 fallos |
| Oráculo matemático de v0.5 | **720 escenarios**, conservados |
| Contraste nuevo de medias con escalas heterogéneas | **1.600 combinaciones deterministas**, superadas |
| Descifrado y comprobación de modelo después de serializar el sobre | **Aprobado en Node**, sin navegador real |
| Diagnóstico de recarga: coincidencia/cambio/ausencia/caducidad | **Aprobado a nivel de funciones** |
| Interfaz simulada escritorio/móvil | **Aprobada**, sin errores JavaScript |
| Navegación real por `localhost` en Chromium | **Bloqueada** por política del entorno |
| IndexedDB, Service Worker y reinicio real en Safari/macOS/iPadOS | **Pendientes** |
| Auditoría institucional de privacidad/seguridad | **Pendiente** |

No confundir pruebas de Node o simulación con validación de un navegador desconectado. Consultar `qa/PROTOCOLO_SAFARI.md` para los pasos pendientes.

---

# CuadernoDocente v0.6 — resultados de pruebas

| Comprobación | Resultado |
| --- | --- |
| Pruebas unitarias/regresión `npm test` | **103/103**, cero fallos |
| Oráculo matemático heredado | **720 escenarios deterministas**, incluidos en la batería |
| Comparación de versiones transaccional y conflicto simulado entre pestañas | **Aprobada** en simulador IndexedDB, sin pérdidas |
| Cifrado y descifrado de sobre real (WebCrypto de Node) | **Aprobado** |
| Instalación de SW y lectura offline de precache | **Aprobada en simulador** (14 recursos) |
| UI escritorio/móvil con lógica real y persistencia simulada | **Aprobada** sin errores JS |
| Navegación de Chromium sobre localhost u otro origen | **Bloqueada** por política del entorno |
| IndexedDB y Service Worker reales en navegador | **No verificados** |
| Safari macOS, iPadOS e iOS con desconexión real | **Pendientes** |
| Auditoría externa de privacidad y seguridad | **Pendiente** |

El simulador de IndexedDB serializa transacciones para comprobar el contrato de compare-and-swap; **no reproduce por completo el motor de IndexedDB de un navegador**. La caché offline se ensayó con un Service Worker en entorno simulado, no con el navegador desconectado. **No afirmar que la aplicación esté validada offline en todos los dispositivos.**

Se conservan íntegramente las pruebas anteriores de escalas, rúbricas, competencias, recuperación, medias, pesos, notas cero/vacías y cierre de curso. Ver `docs/CAMBIOS_V05.md` para la auditoría matemática previa y `docs/CAMBIOS_V06.md` para el endurecimiento actual.

---

# CuadernoDocente v0.5 — informe de pruebas

**Estado:** prototipo experimental, solo datos ficticios. **Sin publicación ni sincronización.**

## Verificaciones superadas

- `npm test`: **96/96 pruebas**, 0 fallos, 0 omitidas.
- Un test de contraste ejecuta **720 escenarios deterministas** adicionales sobre las reglas `mean`, `weighted_mean`, `highest`, `best_n`, `last` y `latest_if_highest`. Compara cada resultado con un oráculo de cálculo independiente del motor.
- Casos críticos: conversión opcional 0–5/0–3/0–10, nota bruta superior a 10, bloqueo frente a cálculos /10 inválidos, notas cero y vacías, recuperaciones, actividad posterior pendiente, rúbricas por criterios con coma decimal, redondeo únicamente de presentación, periodos con nota manual, categorías y competencias, pesos cero, grupos distintos y orden real de periodos.
- Integridad: conservación de calificaciones al renombrar/reordenar alumnos, modificación segura de grupo, eliminación controlada de alumno y preservación de notas del resto; `assertModel` para errores de referencia o escala.
- `qa/browser_simulado.py` (Chromium + almacenamiento y cifrado **simulados**): entrada de nota, deshacer/rehacer, edición/creación/duplicación de rúbrica, entrada decimal con coma y guardado, renombrar grupo/periodo, renombrar/reordenar/eliminar alumno y deshacer, visor de alumno, pantalla de 390 px, sin errores JavaScript. Capturas en `qa/vista_escritorio_simulada.png` y `qa/vista_movil_simulada.png`.
- Servidor de desarrollo (localhost): HTTP 200 para `/`, `src/model.js`, `src/calculations.js`, `sw.js`; HTTP 404 para `/tests`, `/docs` y `/.gitignore`.
- Precache actualizado a `cuaderno-docente-static-v05`, recursos incluidos en el ZIP; los tests verifican existencia de recursos.

## Pruebas pendientes / límites

- Navegación real del navegador desde `http://127.0.0.1`: Chromium devuelve `ERR_BLOCKED_BY_ADMINISTRATOR` en este entorno, por lo que **NO** se verificaron persistencia IndexedDB real, cifrado WebCrypto integrado, instalación y funcionamiento offline del Service Worker.
- No realizadas pruebas táctiles y de accesibilidad manual con Safari de iPhone/iPad, ni apagado y restauración de copias en dispositivos finales.
- No realizada auditoría independiente de protección de datos ni evaluación institucional para usar datos reales de alumnos.

La comprobación de matemáticas superó la batería automatizada, pero no equivale a garantía absoluta de ausencia de fallos. Continuar pruebas con datos ficticios antes de considerar v1.0.

---

## v0.8 · Consulta curricular de solo lectura (21/11/2026)

**Resultado:** 120/120 pruebas automatizadas superadas (`npm test`), incluidos 9 nuevos casos de integridad y catálogo curricular; se mantienen las 720 combinaciones anteriores y las 1600 combinaciones matemáticas adicionales (2320 casos matemáticos documentados). La interfaz Chromium con almacenamiento **simulado** supera el guion de pruebas anterior y el nuevo recorrido curricular para Latín II/Griego II/Latín 4.º, búsqueda, filtros y cambio de normativa. Sin excepciones JavaScript ni desbordamiento horizontal a 390 px.

### Cobertura curricular instalada

| Materia | Fuente | CE | Criterios | Saberes desglosados |
| --- | --- | ---: | ---: | ---: |
| Griego I | DOGV 2026 aportado | 5 | 18 | 51 |
| Griego II | DOGV 2026 aportado | 5 | 18 | 48 |
| Latín I | DOGV 2026 aportado | 5 | 19 | 54 |
| Latín II (2026) | DOGV 2026 aportado | 5 | 19 | 51 |
| Latín 4.º ESO | DOGV 2022 aportado | 5 | 21 | 29 |
| Latín II (2022) | Referencia al DOGV 108/2022; el archivo Pages es una programación docente | pendiente | pendiente | pendiente |

No se ha importado ni reutilizado la programación de aula del archivo `.pages`. La pestaña 2022 de Latín II existe y enlaza a la fuente, pero no atribuye al decreto textos que procedan de adaptaciones docentes. Falta disponer del extracto curricular original de 2022 para transcribir la versión antigua. La bibliografía y las advertencias constan en `docs/CURRICULOS_FUENTES.md`.

### Integridad del cuaderno

Los módulos `src/model.js`, `src/calculations.js`, `src/vault.js`, `src/storage.js`, `src/diagnostics.js`, `src/history.js` y `src/rubric-ui.js` son idénticos byte a byte a la v0.7. No se cambia el esquema ni se añaden relaciones evaluativas automáticas ni se toca la fórmula de las notas. Precache PWA ampliada a 19 archivos, incluidos 3 PDF de fuentes y el módulo de consulta; servidor local comprobado con HTTP 200 y MIME `application/pdf` en las tres fuentes.

### Límites

La prueba visual es sintética y utiliza persistencia simulada. La validación real en Safari, el funcionamiento offline con pérdida completa de conexión y la persistencia a largo plazo de IndexedDB siguen pendientes. **No se debe publicar ni utilizar con datos reales del alumnado.** El contenido textual largo debe cotejarse con los PDF antes de su empleo formal.
