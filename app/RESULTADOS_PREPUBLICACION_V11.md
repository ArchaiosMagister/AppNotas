# Validación de CuadernoDocente v1.1 — prepublicación

Fecha: 21 de noviembre de 2026. Versión local de pruebas, **no publicada en GitHub**.

## Resultados

- **143 de 143** pruebas automatizadas de Node superadas, sin fallos, incluidas 10 de las nuevas funciones de categorías, evaluación, grupos, rúbricas y copia de trimestres.
- Se verificó que el archivo HTML autónomo incluye JSZip, el motor completo, CSS y los cuatro PDF curriculares. Los hashes SHA-256 de los scripts y del CSS coinciden con la política de seguridad (CSP) incrustada en el propio archivo.
- El importador Excel se probó con el archivo de rúbrica entregado. Recuperó cinco criterios ponderados al 20 %, niveles Bien=2, Regular=1 y Mal=0; «Uso del móvil» permite únicamente Bien y Mal, porque Regular es «–» en la fuente.
- Se ejecutó una prueba de interfaz con Chromium en un navegador simulado sin servidor: creación de alumno y actividades, elección de nivel de rúbrica, conversión de notas, importación de la rúbrica .xlsx desde «+ Actividad», rúbrica nueva, copiar actividades a otra evaluación, gestión de categorías, acceso a Evaluación final y anchura móvil a 390 px. No se observaron errores JavaScript en ese recorrido.
- Se generó el HTML autónomo sin dependencias de instalación. Archivo adjunto por separado: `CuadernoDocente_v1.1_prepublicacion_sin_instalar.html`.

## Limitaciones conocidas

- Las pruebas visuales se realizaron **con un navegador simulado/instrumentado**; no prueban la persistencia, cifrado o restauración reales. La batería automatizada cubre las rutinas de cifrado y las funciones del modelo, pero no su integración real con el IndexedDB de Safari.
- **No se han realizado pruebas físicas en Safari Mac, iPad ni iPhone.** Antes de usar notas de alumnado real, comprobar en Safari Mac el guardado, cierre/reapertura, exportación y restauración cifrada `.cdoc`, la importación Excel y las notas de la Evaluación final.
- El almacenamiento de archivos `file://` puede depender de la versión y perfil del navegador; abrir otra copia del HTML puede mostrar un almacén separado. Exportar siempre la copia `.cdoc` antes de cambiar de edición.
- La versión HTML única no se instala como PWA; en iPhone/iPad los archivos locales pueden abrirse en un visor limitado. Las pruebas PWA requieren un entorno HTTP local apropiado o HTTPS.
- Pesos iniciales de 2.º Bachillerato: 60 % exámenes, 30 % literatura/cultura y 10 % actitud. Son una **propuesta inicial editable**, no un criterio definitivo confirmado por el usuario o el centro. Los grupos existentes no se modifican.
- Una categoría que tenga actividades asociadas no se puede eliminar hasta reasignar o retirar esas actividades, para evitar pérdidas de información.

## Prueba de aceptación recomendada

1. Crear en Safari un grupo de **Latín II** y otro de **Griego II**. Verificar las cuatro columnas predeterminadas, sus nombres y la rúbrica de Actitud.
2. Introducir alumnos ficticios y notas de parcial, final, literatura/cultura y niveles de rúbrica. Revisar las conversiones a 10 y pesos de cada categoría, modificándolos en **Cálculos**.
3. Añadir una nueva actividad importando el modelo Excel y confirmar que se leen los descriptores y que el nivel Regular no aparece para «Uso del móvil».
4. Copiar las actividades de la primera a la segunda y tercera evaluación; confirmar que las notas se quedan vacías y que no se sobreescribe un periodo que ya contenga actividades.
5. Cerrar y reabrir Safari. Confirmar que se conservan los datos. Descargar, **verificar** y restaurar una copia cifrada `.cdoc` con datos ficticios. Revisar las tres evaluaciones y la final.

## Archivos

- `CuadernoDocente_sin_instalar.html`: edición autónoma incluida en el ZIP.
- `examples/Rubrica_Actitud_2bach.xlsx`: fichero de ejemplo de importación.
- `docs/CAMBIOS_PREPUBLICACION_V11.md`: detalle de cambios.
- `tests/prepublicacion_features.test.mjs`: diez nuevas pruebas.
- `MANIFEST_SHA256.txt`: hashes de los archivos de este ZIP, excepto el propio manifiesto.
