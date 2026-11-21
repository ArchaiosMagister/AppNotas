# Alojamiento exclusivo y migración segura de AppNotas

## Objetivo

Conservar el [repositorio público](https://github.com/ArchaiosMagister/AppNotas) y la instalación anterior de GitHub Pages, publicando una PWA idéntica en un **hostname HTTPS independiente**. Las distintas rutas de archaiosmagister.github.io comparten origen e IndexedDB; una ruta nueva no basta para separar la información.

**Estado:** el nuevo dominio no existe hasta que se conecte una cuenta de alojamiento y el proveedor confirme el despliegue. No inventar direcciones ni declarar una migración completa antes de probarla.

## Opción A: Cloudflare Pages (plan gratuito)

1. Entrar en https://dash.cloudflare.com/ y abrir Workers & Pages → Create application → Pages → Connect to Git.
2. Autorizar GitHub y seleccionar únicamente el repositorio ArchaiosMagister/AppNotas.
3. Configurar rama de producción: main. Directorio raíz: raíz del repositorio (vacío o /).
4. Configurar Build command: **node scripts/build-static-site.mjs**. Build output directory: **dist**.
5. Crear el proyecto y consultar en el panel la dirección permanente de producción asignada, de formato https://NOMBRE_CONFIRMADO.pages.dev/.
6. Comprobar que el servidor aplica las cabeceras de seguridad definidas en el archivo dist/_headers.

## Opción B: Vercel

1. Conectar Vercel al repositorio público mediante la integración o https://vercel.com/new.
2. Seleccionar Framework: Other; directorio raíz: raíz del repositorio; Production branch: main.
3. El archivo vercel.json configura Build command: node scripts/build-static-site.mjs, salida dist y cabeceras HTTP de seguridad.
4. Publicar y conservar la **dirección permanente de producción** asignada por Vercel, no la URL de cada preview. Formato: https://NOMBRE_CONFIRMADO.vercel.app/.

**Importante:** las URL de previews con distintos hostnames son orígenes independientes y no comparten IndexedDB. No utilizarlas para trabajar con notas que deban persistir en un único cuaderno.

## Comprobaciones reproducibles

Ejecutar desde la raíz del repositorio:

    python3 scripts/source_manifest.py --check
    (cd app && npm test)
    CUADERNO_ROOT=app node --test scripts/audit-v119.test.mjs
    node scripts/build-static-site.mjs
    node --test scripts/dedicated-hosting.test.mjs scripts/backup-origin-migration.test.mjs

El generador copia únicamente los recursos necesarios de la PWA, sin incluir ZIPs, archivos de notas, pruebas, servidor de desarrollo o HTML autónomo antiguo. Cloudflare aplica las cabeceras de dist/_headers y Vercel las de vercel.json, incluyendo prohibición de iframe, CSP y caché prudente del service worker. GitHub Pages no puede proporcionar estas mismas cabeceras HTTP personalizadas.

## Protocolo de migración sin pérdida

**Utilizar únicamente datos ficticios durante la validación.**

1. Abrir la [AppNotas original](https://archaiosmagister.github.io/AppNotas/) y preparar un cuaderno de prueba con grupos, evaluaciones, calificaciones, rúbrica, evaluación final y agenda. Tomar nota de ejemplos concretos.
2. Elegir Cerrar cuaderno → Guardar archivo cifrado para exportar un archivo con extensión .cuaderno.
3. **Comprobar que el archivo existe** en Archivos o Descargas. La función Compartir o Descargar no puede confirmar por sí sola un guardado externo o sincronización de iCloud/OneDrive.
4. En Ajustes y copias → Verificar copia, seleccionar el archivo y escribir su contraseña para comprobar autenticidad sin modificar el cuaderno. Conservar una segunda copia externa si los datos importan.
5. Abrir **el hostname de producción confirmado**, no una preview. Es normal encontrar IndexedDB vacío: cambiar de origen **no traslada** los datos.
6. En la pantalla inicial, pulsar Restaurar una copia cifrada, seleccionar el archivo y escribir la misma contraseña. Revisar la descripción antes de confirmar.
7. Comparar el contenido restaurado con el cuaderno original: grupos, alumnos ficticios, notas, rúbricas, reglas y excepciones, final de curso y agenda.
8. Probar bloqueo/desbloqueo, guardado tras recarga, cierre y apertura del navegador; solicitar persistencia si el navegador la ofrece, e intentar una apertura real sin conexión.
9. Confirmar mediante herramientas de desarrollo que el dominio HTTPS es distinto de archaiosmagister.github.io y que se envían cabeceras Content-Security-Policy y X-Frame-Options.
10. **No desinstalar ni borrar la instalación anterior** hasta haber verificado la migración en el nuevo origen y disponer de una copia externa.

En iOS, una PWA instalada puede utilizar un contexto de almacenamiento distinto de Safari. El traslado debe hacerse siempre con exportación/importación explícita.

## Qué demuestra y qué no demuestra la prueba automatizada

La prueba de migración **simula** dos almacenes de origen aislado, cifra y exporta un cuaderno ficticio, lo importa y verifica que se conserva toda la información. Comprueba también que credenciales erróneas o un archivo manipulado no sustituyen el destino. **No equivale** a una prueba interactiva en dispositivos, a una verificación de la dirección externa ni a una confirmación de que los archivos fueron guardados por el sistema operativo.

Antes de utilizar nombres y calificaciones reales: origen independiente funcionando, aprobación institucional correspondiente y copia cifrada externa verificada. El código público nunca debe contener notas personales.
