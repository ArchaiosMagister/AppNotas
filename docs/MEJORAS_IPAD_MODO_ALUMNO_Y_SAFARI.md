# Mejoras de iPad: modo alumno, faltas y navegación PWA

La aplicación principal continúa en https://appnotas-docente.pages.dev/. Los datos del cuaderno permanecen cifrados **en el navegador del iPad** y no se envían a Cloudflare.

## Modo alumno

En **Modo alumno → selecciona alumno** las **tres evaluaciones** aparecen como secciones plegables. La primera se presenta inicialmente abierta y las demás cerradas; pueden abrirse o cerrarse de forma independiente.

Dentro de cada evaluación hay un selector **Orden de las actividades** con cuatro alternativas:
- **Por categoría** (predeterminado): Exámenes, Trabajos y Actitud, con medias por categoría y las actividades dentro de ellas.
- **Orden del cuaderno**: muestra todas las actividades en el orden de columnas que maneja el profesor, indicando junto a cada actividad su categoría.
- **Nombre de actividad (A–Z)**: orden alfabético.
- **Últimas actividades primero**: orden inverso de las columnas.

La elección se hace **por evaluación** y se recuerda en el navegador, sin modificar notas, datos del alumnado, pesos ni el orden de las columnas de la vista docente.

Cuando una actividad tiene una rúbrica y se ha calificado, la fila contiene **Desglose de rúbrica**. Al desplegarlo, cada criterio tiene un segundo desplegable con su **puntuación / máximo**, peso relativo y, si la rúbrica incluye niveles, nombre y descripción del nivel aplicado. La consulta es de solo lectura. No se muestra el desglose si la actividad no está calificada o consta como NP/AJ pendiente.

## Devolución por faltas en un curso concreto

Abrir el grupo académico de una asignatura y pulsar **⋯ Grupo → Devolución de faltas**. Elegir **Sí** o **No**.

Este ajuste se aplica a **todos los exámenes ya existentes con penalización ortográfica activa en ese grupo** y a las nuevas actividades que adopten las preferencias por defecto. La penalización de otros grupos queda intacta. No habilita la penalización en exámenes que la tuvieran desactivada.

Una devolución ya realizada (casilla «Entregadas») **no puede retirarse indirectamente** cambiando la preferencia del grupo: si existe una, la operación se cancela sin alterar ninguna nota. El docente debe revisar primero las notas implicadas. Sigue siendo posible personalizar una actividad desde el editor individual.

## Enter al introducir notas

La tabla y la página recuerdan la posición de desplazamiento al guardar una nota. Al pulsar **Enter**, el foco pasa a la siguiente fila (o la anterior con Mayús+Enter), procurando **no desplazar automáticamente la página hasta arriba**. El cálculo, el guardado cifrado y la posibilidad de deshacer siguen siendo los mismos.

## Error de Safari: «Response served by service worker has redirections»

Este aviso es de la **carga offline de la PWA**, no una indicación de pérdida de datos de IndexedDB. Lo he confirmado mediante una petición HTTPS real al alojamiento: **Cloudflare responde a /index.html con una redirección hacia /**. En el service worker anterior, la respuesta almacenada para esa portada podía conservar los metadatos de dicha redirección. WebKit rechaza que se utilice directamente como respuesta de navegación. La actualización conserva recursos y caché, pero entrega una respuesta reconstruida **solo para redirecciones a la portada dentro del origen y ámbito de la PWA**, evitando el metadato de redirección.

Si el icono instalado no abre, **no borres los datos del sitio ni desinstales la PWA** sin disponer primero de una copia cifrada verificada. Cuando puedas abrirla con conexión, pulsa **Buscar actualizaciones**, permite su activación y comprueba la vista sin conexión. Si el error persiste, documenta si ocurre al abrir desde pantalla de inicio, al recargar o estando sin conexión, y qué dirección estaba utilizando.

Las pruebas automatizadas simulan redirecciones de navegación y comprueban que la respuesta reconstruida no se marque como redirigida; eso **no sustituye la prueba real en Safari/iPadOS**.
