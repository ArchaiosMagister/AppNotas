# Informe de auditoría exhaustiva — CuadernoDocente v1.9

**Estado:** candidata local, **no publicada en GitHub**. Base: ZIP original de v1.8. Fecha: 21 de noviembre de 2026.

## Alcance

Se revisaron el motor de cálculo y sus seis reglas de categoría; ponderaciones relativas, categorías vacías, normalización de escalas, rúbricas, recuperaciones, penalizaciones por faltas, notas manuales, competencia y evaluación final. Se auditaron los cambios sobre el cuaderno, la separación entre grupos, las reglas por trimestre, los enlaces competenciales, la copia de estructuras y el bloqueo optimista de almacenamiento. Se inspeccionó el funcionamiento de la versión autónoma y los recursos offline.

## Hallazgos corregidos (con regresiones)

1. **Retirar una categoría compartida sin actividades podía eliminarla globalmente** y con ella las ponderaciones personalizadas de otros grupos. Ahora una categoría compartida se oculta solo en el grupo solicitado; una categoría de propiedad exclusiva puede eliminarse si está libre de dependencias.
2. **El borrado global de una categoría podía eliminar silenciosamente vínculos de competencias.** Ahora se bloquea hasta desvincularlas, sin alterar calificaciones o enlaces ajenos.
3. **Un peso de competencia inválido borraba antes el enlace existente en la operación en memoria.** La validación precede a la modificación.
4. **Una configuración final inválida podía crear un registro de configuración vacío.** Ahora se valida antes de insertar el registro.
5. **Parámetros de configuración de categoría no previstos podían modificar el ID o propietario**, o copiar una regla hacia otra categoría. Se aplica una lista explícita de campos editables.
6. **Copiar los porcentajes desde un periodo inexistente** podía aplicar los pesos predeterminados a la evaluación destino. Ahora la existencia de grupo, origen y destino se comprueba antes de cambiar nada.
7. **Competencia vinculada a una categoría oculta o perteneciente a otro grupo:** se impide crear esa relación; se permite retirar vínculos históricos al limpiar datos anteriores.
8. **Volver a guardar una nota idéntica (numérica, rúbrica, faltas)** o borrar otra ya vacía podía introducir cambios artificiales de marca temporal e historial. Se evita la escritura sin cambio real. La misma protección se aplica a anulaciones finales manuales.

9. **El HTML autónomo tenía un problema de empaquetado:** la v1.8 no incorporaba el módulo `src/statistics.js`, importado por la interfaz. Al abrir la versión sin instalar podía quedarse en «Preparando el cuaderno», aunque las pruebas de Node pasaran. La v1.9 incluye los 17 módulos necesarios y una prueba de dependencias completas y de hashes CSP; el recorrido de apertura y de estadísticas ya se ejecuta en Chromium sin errores JavaScript.

Los cambios afectan a validación, protección, idempotencia y empaquetado; **no se modifican fórmulas, calificaciones guardadas, pesos del usuario ni el esquema cifrado**, que sigue siendo v6.

## Verificación matemática

- **3.000 cuadernos generados** con 6 reglas de categoría, escalas /3, /5, /10 y /20, pesos relativos, registros vacíos, notas cero, ortografía y recuperaciones; contraste numérico con un segundo algoritmo independiente (15.000 comparaciones de categorías más 3.000 de resultados trimestrales y 3.000 de grupo alterno).
- **1.200 escenarios de evaluación anual** con reglas aritmética, ponderada y última si es la mayor; periodos sin nota, pesos cero, exclusiones y sustituciones manuales; contraste con un segundo algoritmo independiente.
- Se verificó que la consulta de cálculos no muta el documento, y que operaciones cosméticas no afectan a notas, identificadores ni resultados del grupo.
- Las antiguas pruebas de decimales, redondeos, escalas, rúbricas, descuentos y estadísticas permanecen incluidas.

## Pruebas y cobertura

- **267/267 pruebas automáticas correctas** (`npm test`, Node 22), cero fallidas. 22 pruebas nuevas respecto a v1.8 (245); incluyen 3 de integridad del HTML autónomo y su política de seguridad.
- **Cobertura de líneas:** `src/calculations.js` 98,88 %, `src/model.js` 98,58 %, `src/statistics.js` 100 %; ramas: 94,19 %, 85,52 % y 98,04 %, respectivamente. El conjunto del código alcanzó 98,15 % de líneas y 90,93 % de ramas. La cobertura elevada no demuestra ausencia de errores.
- **Prueba visual:** `qa/smoke_stats_v18.py` ejecutada sobre el HTML autónomo **de v1.9** en Chromium con persistencia simulada: arranque correcto, estadísticas de actividad, evaluación, evaluación final, categorías y privacidad en modo alumno; sin errores de JavaScript.
- **Código y paquete:** `node --check` en los módulos y CSP SHA-256 de cada script/estilo, comprobación de las dependencias internas y de cuatro PDF incorporados.
- **Integridad del ZIP:** manifiesto SHA-256 generado para todos los archivos entregados y cotejo del HTML autónomo independiente con el incluido en ZIP.

## Limitaciones y riesgos residuales

- Ninguna batería finita puede demostrar ausencia absoluta de fallos. Los cálculos han sido contrastados exhaustivamente por las familias de casos examinadas, pero pueden existir casos no representados.
- **No se ha validado IndexedDB real desde Chromium en este entorno:** el navegador automatizado bloquea el acceso a `localhost` (`ERR_BLOCKED_BY_ADMINISTRATOR`). Las pruebas de transacciones utilizan las interfaces simuladas existentes; no equivalen a una prueba de persistencia real.
- Safari Mac, iPhone y iPad reales siguen pendientes. El almacenamiento con `file://` puede variar o separar los datos según la ubicación del archivo. Conservar copias cifradas `.cdoc` antes de cambiar versión.
- El importador XLSX alcanza solo un 42,11 % de cobertura de líneas: es la principal brecha identificada, por debajo de la del motor de cálculo. Sigue siendo necesario validar importaciones con archivos reales y casos especiales antes de uso productivo.
- La v1.9 **no debe utilizarse todavía con datos personales reales**; faltan las pruebas de aceptación y los requisitos de protección de datos del centro.
- Los porcentajes de aprobados se evalúan sobre valores internos sin redondeo previo; una cifra presentada redondeada a 5,00 puede tener valor exacto inferior a 5. Este criterio debe decidirse pedagógicamente antes del uso real.

## Decisión

Apta para **prueba local supervisada con datos ficticios**, no para publicación definitiva ni datos académicos reales. Publicación condicionada a validación del profesor.
