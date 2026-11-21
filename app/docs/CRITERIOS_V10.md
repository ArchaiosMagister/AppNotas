# Puerta de entrada a CuadernoDocente 1.0

El salto de la versión 0.9 a **1.0 estable** está condicionado a que se completen los puntos siguientes. No deben anunciarse como realizados hasta haberlos ejecutado en el entorno indicado.

## 1. Integridad de calificaciones (obligatorio)

- [x] Pruebas deterministas de reglas `mean`, `weighted_mean`, `highest`, `best_n`, `last`, `latest_if_highest`.
- [x] Compatibilidad /10, /5 y /3, conversión desactivada, cero frente a ausencia, recuperaciones y rúbricas.
- [x] Promedios ponderados por categoría y evaluación final, opción de última si es superior, notas manuales y periodos excluidos.
- [x] Si una media es inválida, se muestra como no disponible y no se sustituye por una media silenciosamente incorrecta.
- [ ] Revisión manual de un cuaderno completo de casos ficticios en Safari: cotejar cada fórmula y justificación de notas.

## 2. Datos y recuperación (obligatorio)

- [x] Cifrado local AES-GCM con PBKDF2, contraseña no guardada en el navegador.
- [x] Rechazo transaccional de sobrescrituras entre pestañas en pruebas simuladas.
- [x] Restauración reversible con un rescate cifrado, probado en simulador.
- [ ] Validación de `IndexedDB` REAL: guardado, cierre completo, reapertura y nueva introducción de notas.
- [ ] Validación de conflicto REAL: dos pestañas, restauración concurrente y recuperación tras recarga.
- [ ] Ensayar exportación `.cdoc`, verificación, restauración y rescate real en Mac Safari y, si se usa, iPad/iPhone.
- [ ] Comprobar límites y comportamiento cuando el almacenamiento se llena o Safari limpia datos del sitio.

## 3. Aplicación web y accesibilidad

- [x] Recorrido de interfaz y escritorio/móvil simulados de todas las secciones principales.
- [x] Cache de recursos estáticos en entorno simulado.
- [ ] Prueba offline REAL: apagar servidor / red, recargar, desbloquear, editar y sincronizar por guardado local.
- [ ] Pruebas manuales con teclado, VoiceOver y alto contraste; corrección de incidencias.
- [ ] Probar Safari macOS y Safari iPadOS con datos ficticios y exportación compatible con cada plataforma.

## 4. Biblioteca curricular

- [x] Tarjetas de competencias, criterios y saberes para Latín 4.º, Latín I/II 2026 y Griego I/II.
- [x] Módulo curricular de solo lectura, ajeno al motor de cálculo; PDFs aportados incluidos offline.
- [ ] Cotejo editorial completo de textos largos y tablas contra las fuentes originales.
- [ ] Completar currículo **antiguo de Latín II (2022)** desde el anexo oficial, sin usar la programación de aula aportada.

## 5. Publicación y privacidad

- [ ] Validación institucional, legal y de protección de datos antes de uso con alumnado real.
- [ ] Decidir estrategia de instalación y origen seguro para Mac/iPad/iPhone; el `localhost` del Mac no sirve directamente en iOS.
- [ ] Solo tras los puntos anteriores, congelar versión, ejecutar nuevamente toda la batería y **pedir autorización de publicación en el repositorio privado**.

No se ha publicado ni creado ningún commit en GitHub desde esta entrega. El artefacto actual sigue siendo el ZIP autónomo.
