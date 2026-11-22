# Auditoría previa a AppNotas v1.0 — 22 de noviembre de 2026

## Decisión

**Estado: candidata a pruebas de aceptación (release candidate), no apta todavía para declarar v1.0 estable destinada a datos reales del alumnado.**

El código actual está preparado para una **versión experimental con datos ficticios**. No hay evidencia suficiente para afirmar que la aplicación cumple los requisitos institucionales de protección de datos ni que su interfaz haya sido verificada de principio a fin en todos los navegadores reales de destino. No retirar los avisos de uso experimental por superar únicamente la CI.

Esta evaluación se aplica a la [PR #24](https://github.com/ArchaiosMagister/AppNotas/pull/24). La rama estable de producción en Cloudflare se conserva intacta hasta autorización posterior. No utilizar GitHub Pages.

## Alcance y resultados automatizados

La ejecución preliminar del 22/11/2026 validó el manifiesto de **219 archivos**, el conjunto de auditoría (6 pruebas), la suite de aplicación (529 pruebas) y las pruebas de alojamiento (10 pruebas): **545 pruebas superadas, cero fallos**. La versión final del HEAD debe verificarse de nuevo si recibe más commits.

| Área | Evidencia y alcance | Resultado |
|---|---|---|
| Cálculos | Suite de medias, porcentajes, ponderación, conversiones, redondeo, evaluación final, reglas individuales, NP/AJ, recuperaciones y rúbricas | Supera las pruebas automatizadas existentes |
| Datos académicos | Invariantes de modelo, claves referenciales, grupos y materias | Pruebas superadas |
| Catálogo ampliable | Cinco materias iniciales; alta, retirada sin grupos, colores y compatibilidad con cuadernos antiguos | Pruebas específicas nuevas superadas |
| Competencias | Competencias oficiales donde existen y propias sin atribuir normativa a materias nuevas | Comprobado por regresión; falta recorrido visual |
| Agenda | Nueve franjas; siete horas y dos patios; aula; grupos o materia manual; modificación de horas; sesiones antiguas; eventos vinculados; copia de curso | Pruebas específicas nuevas superadas |
| Persistencia | Escritura cifrada, integridad de sobres, importación, copia portátil, confirmación de conflictos y conservación de versiones | Pruebas existentes superadas |
| PWA y alojamiento | Compilación estática, manifiesto SHA-256, service worker, cabeceras HTTP, alojamiento exclusivo Cloudflare | CI superada; falta prueba real desconectada |
| Interfaz | Selector de materias, nuevo nombre del visor, acceso a guía, menús desplegables y contraste NP | Regresiones estáticas superadas; faltan pruebas visuales reales |

**Las pruebas estáticas no sustituyen la comprobación de que todos los botones funcionen mediante clic/toque en dispositivos reales.**

## Cambios funcionales revisados

- Nombre visible de «Modo alumno» sustituido por **«Modo sesión de evaluación»**. Se mantiene el identificador interno de pestaña `alumno` para no alterar el historial ni la navegación persistida.
- Cuadrícula semanal con nueve franjas predeterminadas y edición de tramos. Las sesiones, aulas y planes anteriores siguen disponibles; no se generan clases ficticias por asignar intervalos vacíos.
- Catálogo de materias versionado dentro del cuaderno cifrado, con valores predeterminados originales. Eliminar una materia con grupos está **bloqueado deliberadamente**: previamente hay que gestionar esos grupos para evitar pérdida de alumnos y calificaciones.
- Las materias nuevas admiten competencias personales. El programa no les atribuye por error competencias oficiales ni plantillas específicas de Latín II o Griego II.
- Portada con botón grande «¿Cómo funciona?» y explicaciones sobre cifrado local, contraseña, copia externa, verificación, recuperación, NP/AJ, agenda y uso sin conexión.
- Sin migración destructiva ni cambios en la fórmula de evaluación. El esquema de datos sigue siendo `8`; los nuevos campos de catálogo y franjas se validan de manera compatible con copias anteriores.

## Riesgos y condiciones de salida para v1.0 estable

1. **Comprobar manualmente en Safari de iPad/iPhone** y al menos un navegador de escritorio la apertura, bloqueo, teclado, navegación (incluido «Modo sesión de evaluación»), menús, gestión de materias, horario y diálogos. Probar modo claro, oscuro y OLED.
2. **Realizar una prueba completa de copia de seguridad con datos ficticios**: introducir calificaciones y rúbricas, cerrar/exportar, guardar fuera del navegador, comprobar archivo con contraseña, restaurar en otro perfil/dispositivo y cotejar las notas. Ensayar contraseña incorrecta y copia alterada.
3. **Comprobar offline de verdad**: visitar el dominio oficial de Cloudflare online, instalar/precargar la PWA, desconectar la red, volver a abrir, editar un dato ficticio, bloquear, recargar y verificar persistencia. Comprobar que la actualización del service worker no descarta datos.
4. **Verificar altas/bajas reales del catálogo**, con materias predeterminadas y personalizadas, sin grupos y con grupos. Confirmar que no se puede retirar una materia con alumnos/notas y que las competencias propias quedan disponibles sin catálogo oficial.
5. **Confirmar resolución y accesibilidad**: botones táctiles, foco visible, lectura de nombres largos, contraste de NP, horarios de ancho reducido y navegación por teclado/lector de pantalla.
6. **Revisar requisitos institucionales y normativos de protección de datos** antes de usar información personal real: autorización del centro/responsable, evaluación de riesgos adecuada, política de dispositivos y copias, y auditoría de seguridad independiente cuando proceda. El carácter local/cifrado no equivale a acreditación formal.

## Alcance de la conclusión

Se puede presentar la PR como **candidata experimental avanzada** y permitir pruebas con datos ficticios. **No corresponde fusionarla y anunciarla como v1.0 estable para uso escolar con datos reales todavía.**

Tras superar las pruebas manuales, la revisión institucional y una última CI limpia del commit definitivo, se puede aprobar la etiqueta v1.0 y publicar en **https://appnotas-docente.pages.dev/** mediante la integración Git de Cloudflare. Nunca volver a activar el despliegue de GitHub Pages sin una decisión nueva.
