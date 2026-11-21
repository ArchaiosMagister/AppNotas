# Registro de cambios — v0.2 (21 de noviembre de 2026)

## Incorporado

1. Perfiles de evaluación por combinación de grupo/periodo con reglas y porcentajes independientes, copiado de reglas y reinicio a valores predeterminados.
2. Tres nuevas modalidades de cálculo: media ponderada por actividad, media de mejores N y última evidencia evaluada. Se mantienen media, nota máxima y última-si-mejor.
3. Recuperaciones enlazadas a una actividad original. Dos políticas: conservar la nota mayor o sustituir obligatoriamente, con una sola evidencia a efectos de cálculo.
4. Controles de columna para editar, mover y eliminar, con comprobación del máximo respecto de notas ya guardadas.
5. Introducción de notas con coma decimal, navegación con Intro/Mayús+Intro y desglose de evidencia por categoría.
6. Esquema 2 y migración desde esquema 1, también para respaldos cifrados antiguos. El caché estático PWA pasa a v2.

## Estado de verificación

- Todas las pruebas unitarias antiguas siguen superándose.
- Se añadieron 13 pruebas: validación de migración y preservación de datos, separación de parámetros por periodo/grupo, copia/restablecimiento, ponderación, mejores N, recuperaciones, edición, integridad y prueba de cifrado tras migrar.
- Chromium se puede iniciar en el entorno, pero la navegación se encuentra bloqueada por política (`net::ERR_BLOCKED_BY_ADMINISTRATOR`), incluso con rutas interceptadas. La prueba visual/UI y la desconexión real **no pueden darse por verificadas**.
- No hay despliegue, repositorio remoto ni servicios externos conectados.

## Pendientes para uso real

Pruebas funcionales con navegador e iPad, auditoría de privacidad y seguridad, control de acceso y pérdidas, protocolo de copias de seguridad, evaluación de requisitos institucionales y autorización correspondiente. Hasta ese momento no utilizar nombres ni calificaciones reales.
