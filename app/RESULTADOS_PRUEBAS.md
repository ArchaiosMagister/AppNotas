# Verificaciones v1.12 · Tabularium

**300/300 pruebas Node superadas** (cero fallidas), con seis pruebas de regresión del rediseño. Recorrido visual del HTML autónomo en Chromium con cinco contextos de pantalla, ocho rutas de navegación, temas, formularios y comprobaciones de invariantes en el documento ficticio. Los 16 módulos funcionales anteriores permanecen byte a byte iguales. Persistencia Safari real no comprobada.

---

# Pruebas finales — CuadernoDocente v1.10

- **277/277 pruebas automatizadas superadas**, cero fallidas (`npm test`, Node 22).
- **10 casos nuevos** de protección del modelo e importación de rúbricas, además de los 4.200 casos aleatorios independientes de versiones anteriores que siguen integrados.
- **Chromium simulado:** arranque autónomo, estadísticas, importación del archivo Excel auténtico y JSON con niveles, sin errores JavaScript.
- **ZIP y HTML autónomo:** control de integridad por SHA-256 y comprobación de equivalencia de los archivos.
- **Limitación:** no se ha comprobado persistencia IndexedDB real o Safari; usar solo alumnado ficticio hasta validación.
- **GitHub intacto.** Versión únicamente local.

Consulta [la tercera auditoría](RESULTADOS_PREPUBLICACION_V110.md).

---

# Pruebas finales — v1.9 (auditoría intensiva de cálculos e integridad)

- **267/267 pruebas automatizadas correctas**, sin fallos (`npm test` en Node 22).
- **3.000 escenarios de evaluación trimestral** y **1.200 de evaluación anual** generados y comparados con dos implementaciones de cálculo independientes. Escalas, categorías, pesos, recuperaciones, faltas y sustituciones manuales incluidas.
- **Pruebas de no interferencia:** categorías compartidas entre grupos, vínculos de competencias, configuraciones inválidas, copia desde evaluación inexistente, cambios de nombre y tema, planificador, notas idénticas y ausencia de notas.
- **Cobertura del motor:** `src/calculations.js` 98,88 % de líneas (94,19 % de ramas), `src/model.js` 98,58 % (85,52 % de ramas), estadísticas 100 % (98,04 % de ramas).
- **Error adicional corregido:** el HTML autónomo de v1.8 no incorporaba `src/statistics.js`, lo que podía impedir el arranque. La v1.9 incluye el módulo; se ha probado el arranque, las estadísticas y el modo alumno en Chromium simulado, sin errores JavaScript. Tres nuevas pruebas verifican las dependencias internas, los hashes CSP y los recursos integrados.
- **Limitación:** las pruebas de navegador usan persistencia simulada. IndexedDB real y Safari Mac/iPhone/iPad siguen pendientes; NO utilizar todavía datos académicos reales. Mantener copias cifradas `.cdoc`.
- **Repositorio privado de GitHub no modificado.** La versión es una candidata local de validación.

Informe detallado: [RESULTADOS_PREPUBLICACION_V19.md](RESULTADOS_PREPUBLICACION_V19.md).

---

# Pruebas finales — v1.8 (estadísticas docentes)

- **245/245 pruebas automatizadas correctas** (`npm test`, Node 22), incluidas doce nuevas sobre estadísticas por elemento.
- Ratón y teclado: cabeceras y finales con tarjeta, cierre mediante Escape y ocultación en modo alumno (Chromium simulado).
- Tacto en tamaños iPhone e iPad: apertura, cierre al tocar de nuevo o fuera, actualización al editar una nota. Sin errores JavaScript (Chromium simulado, no Safari real).
- `src/statistics.js`: medias por alumno con nota, aprobado sobre la mitad de la escala, porcentaje principal sobre el total del grupo, porcentaje entre evaluados y valores nunca redondeados antes de comparar.
- Service worker y comprobador offline usan **27 recursos precargados** e incluyen el módulo nuevo.
- HTML sin instalación generado con CSS y dos scripts protegidos por hashes SHA-256 en CSP. Integridad manifest verificada durante el empaquetado.
- **Sin publicar** en GitHub. Safari macOS/iOS reales y persistencia al abrir desde `file://` siguen pendientes.

Más información en [RESULTADOS_PREPUBLICACION_V18.md](RESULTADOS_PREPUBLICACION_V18.md).

---

# Pruebas finales — v1.7 (segunda auditoría)

- **233/233 aprobadas, 0 fallidas** (`npm test`, Node 22).
- **13 pruebas nuevas**: cinco comprobaciones del traslado de clases, fechas académicas, protección ante consultas cruzadas de grupo, dos decimales y recalculación tras editar una nota.
- **7 fallos comprobados en la candidata anterior** antes de corregirlos.
- **Recorrido visual Chromium simulado:** cuaderno, planificador, tres temas, tamaño móvil e importación del Excel real de actitud, sin errores JavaScript.
- **Comparativa de rendimiento:** 158 alumnos, 76 actividades, 12 040 notas sintéticas; v1.6 60,59 ms y v1.7 31,22 ms en la cuarta ejecución, resultados idénticos (×1,94 en esta operación).
- **No equivale a pruebas reales de Safari ni a certificación de seguridad:** persisten pruebas de `file://`, IndexedDB, copias cifradas y operación en dispositivos Apple.
- **GitHub no modificado.** Solo se entrega la versión local de validación con alumnado ficticio.

Para incidencias, metodología y limitaciones consulta [RESULTADOS_PREPUBLICACION_V17.md](RESULTADOS_PREPUBLICACION_V17.md).

---

# Estado de pruebas — v1.5

La candidata v1.5 pasó **200/200 pruebas automatizadas** el 21/11/2026 (`npm test`) y la prueba visual de editor de faltas en Chromium (sin errores JavaScript). El informe detallado está en [RESULTADOS_PREPUBLICACION_V15.md](RESULTADOS_PREPUBLICACION_V15.md).

Las pruebas Safari/iOS reales siguen pendientes. No se debe introducir información real del alumnado.

---

# Pruebas ejecutadas en CuadernoDocente v1.0-rc1

## Batería original

Comprobación del ZIP y de su manifiesto SHA-256 satisfactoria. Batería Node de v0.9, 129 aprobadas y 0 fallidas. La prueba visual heredada en Python se intentó ejecutar y se detuvo al importar Playwright, ausente en este entorno. Las pruebas con Brave que figuran a continuación utilizan la aplicación y el almacenamiento reales.

## Cálculos, cifrado y regresiones

Comando `node --test tests/*.test.mjs`. Resultado de la candidata, 133 aprobadas y 0 fallidas. Se mantuvieron los 720 casos de reglas contrastados con un cálculo independiente y se añadieron 4.096 escenarios con resultados esperados racionales en `BigInt`. Hay pruebas de pesos subnormales, persistencia de notas, migraciones, error transaccional simulado, cifrado, contraseña incorrecta y manipulación del sobre. IndexedDB y service worker se simulan en parte de la batería Node.

## Brave y almacenamiento real

macOS 27.2.1, Brave 158.1.100.58, Node 24.22.3. Se usó un perfil independiente con alumnado ficticio, IndexedDB, Web Crypto y service worker reales. La prueba confirmó:

- Guardado de cero con aislamiento de otras notas, edición decimal, reapertura, rechazo de contraseña incorrecta y conflicto de escritura entre dos pestañas.
- Descarga de `.cdoc` cifrada, restauración y dos intercambios del cuaderno con el rescate.
- Recarga y desbloqueo con red desactivada. Borrado persistente de una nota, fichas de ambas versiones de Latín II, grupo y alumna ficticia nuevos, actividad sobre cinco, rúbrica de tres criterios, vista individual y nota anual manual y automática.
- Capturas en claro a 1320, 820 y 390 px y en oscuro a 390 px. El indicador de guardado se muestra en los tres anchos y la página no desborda horizontalmente. La tabla conserva su propio desplazamiento. Sin excepciones JavaScript no capturadas durante ese flujo.
- Actualización real desde el ZIP original servido en el mismo origen. Tras instalar la nueva caché y retirar la anterior, se recuperó una nota de v0.9 y se volvió a abrir el cuaderno con el servidor detenido. El diagnóstico Chromium de instalación devolvió una lista vacía de incidencias. La instalación en una ventana independiente no se realizó.

## Repetir en local

Usa Node 22 o posterior para las pruebas de Brave. Abre Brave con un perfil temporal nuevo y un puerto CDP local, por ejemplo:

```sh
"/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" --headless --disable-gpu --remote-debugging-port=47652 --user-data-dir="$(mktemp -d)" about:blank
```

Desde el ZIP descomprimido, arranca `PORT=4175 node server.mjs` y ejecuta `node qa/brave-real.mjs`. Para repetir la actualización ejecuta `node qa/brave-actualizacion.mjs '/ruta/a/CuadernoDocente_v0.9'` con el puerto 4176 libre. Las pruebas necesitan un origen vacío en el perfil desechable. Los registros exactos están en `qa/evidencia`.

## Safari y dispositivos

Se abrió la candidata en Safari 27.2 de macOS y se comprobó la pantalla de creación del cuaderno. WebDriver rechazó la sesión automatizada porque «Allow remote automation» estaba desactivado. No había un iPhone o iPad real disponible. Las validaciones en Safari, Chrome de marca, otros motores y dispositivos reales se detallan en el [protocolo manual](qa/PROTOCOLO_SAFARI.md). Brave es la verificación ejecutada con Chromium.
