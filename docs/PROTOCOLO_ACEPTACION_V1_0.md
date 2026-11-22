# Protocolo de aceptación de AppNotas v1.0

**Ámbito:** prueba de usuario con **datos estrictamente ficticios** sobre la vista previa de Cloudflare asociada a la PR de integración v1.0. La versión estable y los cuadernos reales no deben modificarse durante la validación.

**Autorización de almacenamiento:** el usuario comunica autorización de su centro para guardar cuadernos y copias **exclusivamente en local**, sin servicios de almacenamiento en nube. Cloudflare Pages distribuye código, no guarda notas ni copias. El sistema operativo puede ofrecer destinos sincronizados: **seleccionar solo «En mi iPad», «En mi iPhone», carpeta local de ordenador o USB sin sincronización**.

## 1. Portada y sesión de evaluación — iPad / Safari

1. Abrir la **URL de vista previa de la PR de integración v1.0**, no la de producción. **No importar un cuaderno con datos reales.**
2. Pulsar **«¿Cómo funciona?»**, desplazarse hasta el final, cerrar el diálogo y comprobar que permite volver al inicio.
3. Crear un cuaderno de **demostración** con una contraseña de prueba de al menos 12 caracteres. Anotarla solo para la prueba.
4. Comprobar que existen los cinco botones predeterminados y que la elección de una materia y grupo no altera otra.
5. Abrir el **Modo sesión de evaluación**, seleccionar un alumno ficticio y revisar la legibilidad, todas las notas y la navegación anterior/siguiente. Comprobar que en el visor individual **no aparecen los datos de otros alumnos**.
6. En el cuaderno, cambiar una nota ficticia; marcar y desmarcar **NP** y comprobar que puede sustituirse de nuevo por un número. Probar «Herramientas», «Materias y grupos» y «Más acciones», verificando que ningún menú queda tapado.
7. Repetir visualmente en **Claro**, **Oscuro** y **OLED**, incluido iPad en vertical y horizontal.

**Aceptar si:** todos los controles responden al toque, ningún texto o botón queda recortado y el visor muestra solo el alumno elegido.

## 2. Catálogo de materias y horario — iPad / Safari

1. Abrir «Materias y grupos» → **«Gestionar materias»**.
2. Añadir **Historia** en 1.º Bachillerato. Elegir un color, crearle un grupo y comprobar que las demás materias originales continúan.
3. Intentar retirar Historia **mientras tiene grupo**: debe impedirlo y conservar sus datos. Añadir una segunda materia sin grupos y retirarla: debe desaparecer sin afectar a Historia.
4. En **Agenda → Horario**, revisar las siete horas y los patios, especialmente 10:45–11:15 y 14:00–14:20.
5. Tocar la casilla de una hora de clase, seleccionar el grupo Historia e indicar **Aula 2.15**. En otra casilla escribir manualmente **Atención Educativa** y su aula.
6. Editar una franja horaria sin solaparla con la anterior o siguiente. Volver a la agenda y comprobar que las sesiones vinculadas siguen en su sitio y conservan su aula.

**Aceptar si:** no desaparece ningún grupo, aula, materia ni calificación y los límites del horario se respetan.

## 3. Copia cifrada y restauración — sin nube

1. Con el cuaderno ficticio anterior, utilizar **«Cerrar cuaderno» → «Guardar archivo cifrado»**.
2. En el selector, elegir **exclusivamente almacenamiento local no sincronizado**. En iPad, verificar que la ubicación no es «iCloud Drive» sino «En mi iPad» o una unidad externa local.
3. Localizar el archivo `.cuaderno` en **Archivos** y guardar una segunda copia en otra ubicación física local. No asumir que pulsar «Guardar» equivale a una exportación comprobada.
4. Volver a AppNotas y utilizar **«Verificar copia»**, eligiendo el archivo que realmente se guardó e introduciendo la contraseña.
5. En **otro navegador/perfil o dispositivo de prueba** (no en el cuaderno original), abrir la misma aplicación y restaurar la copia local. Comprobar asignaturas, grupos, aulas, notas, rúbricas, horarios y resultados.
6. Intentar abrir el archivo con una contraseña equivocada: debe rechazarlo sin alterar la copia existente. Evitar borrados y reinicios del cuaderno original durante la prueba.

**Aceptar si:** el archivo se verifica correctamente, la restauración produce los mismos datos y las operaciones fallidas no sobrescriben registros.

## 4. Funcionamiento sin conexión — iPad / PWA instalada

1. Con la conexión activa, abrir la vista previa y permitir que se prepare el cache PWA. Instalar la aplicación si se quiere verificar el acceso desde icono.
2. Apagar **Wi-Fi y datos móviles**, sin usar simulaciones de conexión.
3. Cerrar la ventana, abrirla otra vez, desbloquear el cuaderno ficticio y consultar el horario y las notas.
4. Modificar una nota ficticia, comprobar el estado «Guardado cifrado», bloquear y volver a abrir **sin conexión** para verificar que el cambio persiste.
5. Recuperar la conexión. No deben desaparecer calificaciones ni restaurarse valores antiguos por la actualización de la aplicación.

**Aceptar si:** se puede consultar y editar sin red y la última nota permanece después de un cierre/apertura real.

## 5. Comprobaciones finales

- Probar al menos una vez un navegador de escritorio para descartar errores de ratón/teclado no reproducidos en iPad.
- Navegar con Tab/Intro/Espacio cuando sea posible; los botones y campos deben permitir foco visible.
- Comprobar el nuevo texto «Modo sesión de evaluación» en pantalla reducida.
- Confirmar la configuración local del destino de descargas de Safari, que puede variar según el dispositivo.
- No llevar cuadernos reales a **previews**, dominios diferentes, navegadores no autorizados o servicios cloud.

## Resultado

Si las cuatro pruebas funcionales se superan y el centro mantiene la autorización comunicada, se puede proceder a una **última CI limpia del commit de release**, cambiar los avisos «experimental/datos ficticios» por advertencias de uso local responsable, etiquetar el repositorio como **v1.0.0** y fusionar/publicar exclusivamente en **Cloudflare Pages**. No eliminar advertencias antes de esas comprobaciones.

Si falla una prueba, documentar el caso, corregirlo en la PR y repetirla antes de publicar.

## Aceptación docente comunicada (22/11/2026)

El usuario completó las **nueve verificaciones de la lista final** sobre la vista previa de Cloudflare de la PR #27 con datos de demostración. Confirmó la navegación, la seguridad de las vistas individuales, las materias, las siete horas y dos patios, el ajuste de franjas y aulas, la escala de adquisición (1 = alta; 4 = no adquirida), el almacenamiento local del archivo `.cuaderno`, su verificación y restauración en otro navegador o dispositivo de prueba, y el funcionamiento sin red tras cerrar y reabrir; también verificó los tres temas y las orientaciones de pantalla. **Incidencias comunicadas: ninguna.** No se ha aportado un informe independiente de seguridad y no se considera suplido por esta aceptación funcional.

La publicación de la rama de producción debe realizarse exclusivamente a través del despliegue conectado de Cloudflare Pages, verificando primero la CI del código definitivo. No hay migración automática de cuadernos entre orígenes.
