# Aceptación pendiente en dispositivos Apple reales — v1.17

Únicamente con datos **ficticios** y una copia adicional de seguridad ya descargada:

- [ ] Safari en Mac: abrir la PWA instalada, crear cuaderno, cambiar una nota, recargar y confirmar guardado cifrado tras contraseña.
- [ ] Safari Mac: **Cerrar cuaderno** y guardar `.cuaderno` desde selector; comprobar manualmente que existe en carpeta elegida y abrirlo después en otro perfil.
- [ ] Safari iPhone: PWA instalada y archivo desde «Archivos»; comprobar la hoja de compartir o Descargas. Cancelar sin perder datos.
- [ ] Safari iPad: apertura desde Files/iCloud Drive/OneDrive y confirmación de importación.
- [ ] Contraseña equivocada, fichero truncado y extensión incorrecta: ninguna nota se modifica.
- [ ] Modificar en el primer dispositivo, exportar y abrir en el segundo: copia posterior. Modificar en ambos por separado: aviso de divergencia.
- [ ] Restaurar, comprobar rescate local y recuperar notas previas. Confirmar que una segunda restauración reemplaza el único rescate.
- [ ] Activar modo avión, cerrar y abrir PWA, guardar una nota localmente y recuperar después.
- [ ] No confundir compartir con guardado en OneDrive: confirmar manualmente existencia del fichero y sincronización.
- [ ] Probar almacenamiento Safari en pestaña normal, PWA instalada y, si se desea, HTML autónomo `file://`. No dar por equivalente la persistencia entre esos orígenes.

Las pruebas automatizadas de pantalla en Chromium fueron **simuladas** (sin Web Crypto/IndexedDB reales) porque la política del entorno impidió navegar a `http://localhost`, `https://...` y `file://`. Sí se realizaron pruebas criptográficas reales mediante Web Crypto de Node y pruebas transaccionales con IndexedDB simulado. **No se ha validado el guardado real ni la navegación en Safari, iPhone o iPad.**
