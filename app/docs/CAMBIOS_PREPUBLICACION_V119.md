# AppNotas · CuadernoDocente v1.19 (prepublicación)

## Cambios

- **PWA instalable** con botones «Instalar aplicación» y «Buscar actualizaciones», icono SVG/PNG y recurso de icono Apple; instalación guiada cuando Safari no muestra un evento instalable.
- **Actualizaciones manuales y seguras**: detección vía `ServiceWorkerRegistration.update()`; consentimiento explícito para activar y recargar; espera al fin del guardado; nunca sustituye una copia local o un archivo de cuaderno.
- **Nota Ítaca** junto a «Nota final» en cada evaluación, sin modificar `overallGrade`, `categoryGrade` ni `finalGrade`: redondeo a entero a partir de fracción 0,5, a partir de 0,7 o conservar media sin redondeo entero. El modo sin redondear muestra dos decimales; el cálculo real sigue siendo exacto.
- **Regla general por grupo** y excepciones editables por alumno y trimestre, con opción «Aplicar norma general». No se afectan otros periodos ni otros alumnos.
- **Colores por categoría** configurables en «Cálculos»; un tono tenue cubre cabecera y celdas de todas sus actividades. En modo OLED no se colorea el fondo negro: los bordes y la franja de cabecera usan el color escogido.
- Todos los cambios de configuración se integran en el modelo que ya guarda IndexedDB y en las copias cifradas `.cuaderno`. Compatibilidad conservada con documentos anteriores sin los nuevos campos; no se ha alterado el número de esquema (8) ya que son propiedades opcionales.

## Pruebas

- **362/362 automatizadas superadas** (incluidas las existentes y pruebas de Ítaca, umbrales numéricos, ausencia de calificación, excepciones individuales, regresión de medias y evaluación final, validación de colores, cifrado exportar/importar con igualdad exacta).
- `node --check` de JavaScript y HTML autónomo generado con hashes CSP comprobados.
- Recurso local de la PWA y manifiesto de iconos completos.
- **Pendiente:** ejecución visual real en Chromium, Safari macOS, Safari iPhone y Safari iPad. El navegador automatizado disponible devuelve `ERR_BLOCKED_BY_ADMINISTRATOR` para http://localhost, file:// y data:, por lo que no se ha podido declarar una prueba interactiva de navegador exitosa.

## Cautelas

- No hay sincronización automática ni importación destructiva: cada dispositivo conserva su propio almacén. La operación «Cerrar cuaderno» debe exportar una copia cifrada antes de cambiar de dispositivo.
- No se han enviado datos de alumnado a GitHub, OneDrive ni ningún servidor; el ZIP conserva ejemplos ficticios. Requiere validación adicional del centro para calificaciones reales.
- Esta versión **no está publicada ni fusionada en GitHub**. La URL de GitHub Pages permanece con la versión anterior hasta autorización y nuevas comprobaciones.

## Prueba manual recomendada

En una instalación publicada por HTTPS: crear un grupo ficticio, variar la regla general de Ítaca, establecer una excepción para un alumno y una evaluación, asignar un color a cada categoría desde «Cálculos», activar OLED y comprobar encabezados y bordes. «Cerrar cuaderno» exporta el archivo; abrirlo en otro dispositivo, verificar la misma regla y las mismas medias. Pulsar «Buscar actualizaciones» y confirmar explícitamente únicamente cuando el cuaderno esté guardado. En iPhone/iPad, usar «Compartir → Añadir a pantalla de inicio». Nunca usar datos reales en esta prueba.
