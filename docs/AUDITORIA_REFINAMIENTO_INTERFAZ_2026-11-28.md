# Auditoría inicial: refinamiento de interfaz y preferencias de evaluación

Base inspeccionada: 2aeafe01ca0292f20c3e516853ad277a65ec8f47 (main). PR #68 pendiente: modifica app.js, styles.css, sw.js, manifiesto y prueba visual; eleva el mínimo de las celdas de 88 a 122 px. Coordinar esa corrección antes de ajustar densidad; no fusionar aquí sin autorización.

## Fuente y validación

- app/app.js genera la cabecera, navegación, selectores, períodos y tabla; app/styles.css acumula reglas y breakpoints. app/src/planner-ui.js genera la agenda.
- scripts/build-static-site.mjs publica un inventario explícito de fuentes y precaché. No editar artefactos históricos. scripts/source_manifest.py --check exige el manifiesto actualizado.
- Los workflows de Cloudflare, WebKit/móvil, cabecera, rediseño y Dropbox ofrecen validación. No activar GitHub Pages.
- Capturas y mediciones pendientes: el entorno de trabajo no permite clonar por red ni ejecutar navegador local contra las fuentes completas. Usar CI con datos ficticios; no sustituir las capturas por maquetas.

## Hallazgos visuales

- El bloque final de cabecera (styles.css, alrededor de 4150) redefine reglas anteriores. En <=650 px se asignan tres columnas a cierre/historial/bloqueo, sin posición explícita para Dropbox, incorporado después. El texto de estado de Dropbox varía de longitud.
- La navegación usa caracteres Unicode y una familia de tamaños; conserva controladores data-tab y aria-current. Usar SVG locales en línea.
- El cierre directo tiene una prueba histórica explícita (v136_quick_close_group_toggle); actualizar sólo esa expectativa si se traslada al menú, conservar el controlador y todas las confirmaciones.
- El selector de densidad cambia padding, pero la estructura de nota tiene mínimo de 88 px fijo en main. La PR #68 propone 122 px. Medir tras reconciliar ambas intervenciones, preservando menú, notas originales e indicadores.
- La tabla ya contiene menús y acciones con IDs y controladores; reorganizar sin duplicar acciones. La configuración de actitud de Ítaca debe compartir el mismo controlador.

## Hallazgos de persistencia

- STATE.periodId es global; chooseInitial y render recurren al primer período ordenado. Vista alumno también usa studentPeriodId. Revisar todos los puntos de entrada, incluida creación de período y adopción de cuaderno remoto.
- cuaderno.js compara por ID, cabeza y ascendencia; si coincide la cabeza exige igualdad JSON completa. No es seguro introducir preferencias en doc con misma cabeza, ni crear revisiones académicas por navegación.
- Dropbox usa instantáneas AES-GCM autenticadas, actualización condicional por rev y protección de divergencias; dropbox-local.js aplica sólo versiones acreditadas como posteriores mediante CAS de IndexedDB y cola de mutaciones. No debilitar estas garantías.
- Propuesta a validar: registro cifrado independiente de preferencias por ID de cuaderno, grupo y período (incluido curso si el identificador de grupo se reutiliza); almacenamiento local separado de historial académico y sincronización por registro, con versión/revisión condicional y fusión determinista por grupo. Reutilizar cifrado, sesión, scheduler y comprobaciones de identidad; definir claramente el ciclo de vida de importación/restauración y el comportamiento de clientes antiguos. No guardar tokens ni preferencias académicas sin cifrar. No cambiar compareBookVersions ni decisiones de conflicto académico.
- Evaluación final no escribe la selección ordinaria; referencias inválidas vuelven al primer período ordenado sin restaurar grupos eliminados.

## Aceptación pendiente

Ejecutar todas las pruebas existentes; ampliar matriz a 320, 390, 430, 768, 820, 1024, 1180, 1366 y 1920 px en claro/oscuro/OLED, con Chromium y WebKit, más horizontal de iPhone y ventanas reducidas. Medir cabecera/tabla y filas visibles con la misma muestra ficticia. Verificar menús, foco y todas las acciones; pruebas de preferencias independientes, migración, CAS, offline, concurrencia y ausencia de mutaciones académicas. Prueba real iPad + segundo dispositivo con Dropbox queda pendiente hasta contar con ambos dispositivos y un cuaderno ficticio autorizado. La publicación permanece bloqueada hasta validación y autorización expresa.
