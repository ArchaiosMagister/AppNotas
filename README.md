# AppNotas · CuadernoDocente v1.19 (pruebas)

**Repositorio público de código y PWA de prueba.** No contiene cuadernos personales ni calificaciones reales. Utilizar solo datos ficticios mientras se realizan pruebas en Safari, iPhone e iPad y se valida el uso institucional.

## Acceso a la PWA

https://archaiosmagister.github.io/AppNotas/

La v1.19 ofrece instalación PWA con iconos para móvil y escritorio, búsqueda manual de actualizaciones con confirmación, columna **Nota Ítaca** por trimestre con tres reglas de redondeo (0,5, 0,7 o sin redondear) y excepciones por alumno, y colores de categoría personalizables visibles incluso en modo OLED.

Las notas se guardan localmente en IndexedDB y los ficheros exportados se cifran con AES-256-GCM antes de guardarlos en el dispositivo. No hay almacenamiento automático ni sincronización de datos personales en GitHub, OneDrive u otros servicios.

## Correcciones de agenda posteriores a la auditoría

La PWA publicada desde `main` se construye a partir del ZIP original v1.19, que permanece inalterado y verificable. Durante la compilación, `scripts/apply_v119_audit.py` corrige el módulo de agenda y sincroniza la caché offline de `sw.js` y `app.js`. El script aborta si el código original no coincide con el esperado y recalcula el manifiesto de la distribución reparada.

Correcciones incluidas: día inicial de sesiones nuevas en fin de semana; creación de curso siguiente con nombres personalizados; conservación de horas manuales en exámenes y eventos; exportación iCalendar con normalización de saltos de línea y plegado de líneas a 75 octetos UTF-8. **No se cambian los cálculos de notas ni los archivos personales.**

El despliegue exige pasar las **362 pruebas originales y 6 pruebas nuevas** sobre estos casos, además de la comprobación del manifiesto. Tras la compilación correcta, GitHub Actions genera un ZIP auditado como artefacto de la ejecución; el HTML autónomo histórico incluido en el paquete fuente no sustituye a esta PWA corregida.

## Paquete fuente y pruebas

Se conservan versiones anteriores en `payload/` y `releases/v1.17/`. El ZIP completo v1.19 está fragmentado sin alterar en `releases/v1.19/part_*.b64` para su transporte y reconstrucción.

SHA-256: `85189a3b59a7e6829664d6b89fcb48b624761f963b023eb560fc0575861e8f29`.

```bash
cat releases/v1.19/part_*.b64 | base64 --decode > CuadernoDocente_v1.19.zip
echo '85189a3b59a7e6829664d6b89fcb48b624761f963b023eb560fc0575861e8f29  CuadernoDocente_v1.19.zip' | sha256sum --check
unzip CuadernoDocente_v1.19.zip
cd CuadernoDocente_v1.19-prepublicacion
sha256sum -c MANIFEST_SHA256.txt
npm test
```

El flujo `.github/workflows/pages.yml` reconstruye y valida el ZIP, ejecuta **368 pruebas automatizadas (362 originales y 6 nuevas)**, prepara los archivos estáticos y los publica en GitHub Pages tras éxito. Las copias `.cuaderno`, archivos de bases de datos y credenciales no se despliegan.

## Pruebas reales recomendadas

1. Instalar desde «Instalar aplicación»; en Safari iOS, utilizar Compartir → Añadir a pantalla de inicio.
2. Crear un curso con alumnos ficticios, configurar Nota Ítaca general y excepciones por trimestre y revisar las medias.
3. Elegir colores por categoría y comprobarlos en modo OLED.
4. Exportar el cuaderno cifrado con «Cerrar cuaderno»; importarlo en otro dispositivo con «Abrir cuaderno».
5. Comprobar que notas, cálculos, excepciones y colores se conservan y que una copia antigua o contraseña errónea no sobrescribe datos.
6. Pulsar «Buscar actualizaciones»; nunca actualizar sin confirmar antes que los cambios pendientes están guardados.
7. Comprobar instalación, modo offline y exportación desde Safari de macOS, iPhone y iPad.

**Limitación:** las pruebas interactivas en navegadores Apple reales están pendientes; las 362 pruebas automatizadas no sustituyen a la verificación física. No usar notas reales sin revisión de seguridad y autorización del centro o Generalitat.
