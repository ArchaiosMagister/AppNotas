# Auditoría de seguridad y conservación de datos · AppNotas

**21 de noviembre de 2026 · v1.19.** Revisión estática del código de la PWA publicada: almacenamiento, cifrado, copias, restauración, actualización PWA y exposición pública. No es una prueba de penetración independiente ni una autorización de tratamiento de datos personales.

## 1. Riesgo prioritario: origen compartido (alto)

AppNotas se publica en https://archaiosmagister.github.io/AppNotas/. Esta URL comparte origen HTTPS con otros proyectos publicados bajo https://archaiosmagister.github.io/OTRO_REPOSITORIO/. IndexedDB aísla por origen (protocolo, hostname y puerto), no por ruta. Código de otra aplicación del mismo origen podría leer o borrar los sobres cifrados de AppNotas, aunque el cifrado sigue impidiendo leer las notas sin conocer la contraseña si no se compromete también la sesión. No hay evidencias de que se haya producido un acceso: es un riesgo de arquitectura.

**Condición antes de datos reales:** alojar AppNotas en un origen HTTPS exclusivo (dominio/subdominio propio o plataforma que proporcione un subdominio exclusivo por proyecto), sin otras aplicaciones bajo el mismo origen. El repositorio puede seguir siendo público. Un cambio de origen no transfiere IndexedDB: exportar y verificar previamente una copia cifrada, restaurarla en el sitio nuevo con datos ficticios y no borrar la app anterior hasta comprobar los resultados.

Referencias: [MDN, política de origen de IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Basic_Terminology); [GitHub Docs, ubicaciones de sitios de proyecto](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).

## 2. Conservación local y copias (medio)

IndexedDB depende de la política de retención del navegador. Se añade en Ajustes y copias la comprobación de StorageManager.persisted() y una solicitud voluntaria mediante StorageManager.persist(). No todos los navegadores lo conceden. **No es una copia de seguridad ni garantiza protección frente a eliminación manual, daños o pérdida del dispositivo.**

Las descargas automáticas y Compartir no acreditan por sí solas que el archivo esté finalmente almacenado o sincronizado. Verificar que hay una copia cifrada externa restaurable; la aplicación mantiene el cuaderno local tras exportar o cancelar.

Referencia: [MDN, StorageManager.persist()](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist).

## 3. Controles comprobados en el código

- Cifrado local AES-256-GCM con IV aleatorio de 96 bits, sal aleatoria de 128 bits y PBKDF2-SHA-256 (310.000 iteraciones).
- Copia portátil cifrada autenticada con datos asociados (AAD), compatibilidad histórica con copias .cdoc y validación del modelo antes de importarlo.
- Límite de 25 MB por archivo de cuaderno e inspección del formato.
- Transacciones IndexedDB con comparación de versión anterior para evitar sobrescrituras entre pestañas.
- Restauración transaccional con un punto de rescate cifrado, que se reemplaza en la siguiente restauración.
- La PWA despliega código y recursos estáticos; no sube las notas a servidores. El despliegue excluye copias .cuaderno/.cdoc y archivos de bases de datos.
- Importación local de CSV, JSON y XLSX con validación y límites de tamaño, incluidos límites de descompresión de XML.
- El CSV de ejemplo inspeccionado contiene nombres ficticios. No se han inspeccionado visualmente todas las capturas históricas del repositorio.

## 4. Riesgos y limitaciones pendientes

1. **El alojamiento en un mismo origen requiere separación antes de almacenar datos reales.** Cambiar de ruta o nombre de base de datos no resuelve el riesgo.
2. Una contraseña de 12 caracteres previsible podría sufrir ataques offline si alguien obtiene el archivo cifrado: emplear frase de paso robusta y única.
3. La directiva frame-ancestors en una etiqueta meta HTML no protege frente a enmarcado: debe establecerse mediante cabeceras HTTP del alojamiento.
4. Pendiente validación real en Safari de Mac, iPhone e iPad, con datos ficticios, de cierre/reapertura, persistencia, cuota, modo offline y recuperación.
5. El código revisado no implica cumplimiento automático de requisitos del centro o administración educativa.

## 5. Pruebas añadidas

Cuatro pruebas automáticas: persistencia concedida/denegada/no disponible, petición solo mediante acción explícita, advertencia visible de origen compartido, y coherencia de versión de caché PWA. Se preserva la suite anterior de cálculos, cifrado, guardado, restauración y regresiones.

**Conclusión:** los controles locales de cifrado y restauración son favorables, pero no procede declarar apta para notas reales la configuración de alojamiento compartido actual.
