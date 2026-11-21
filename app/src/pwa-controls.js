/** Helpers puros; sin almacenamiento ni acceso a notas. */
export function installInstructions(ua='',platform=''){
  if(/iPad|iPhone|iPod/i.test(ua)||(/Mac/i.test(platform)&&/Mobile/i.test(ua)))
    return 'En Safari de iPhone o iPad, pulsa Compartir y elige «Añadir a pantalla de inicio» (o «Añadir al Dock», según la versión). Confirma «Añadir». Si usas otro navegador, abre esta página en Safari.';
  if(/Macintosh|Mac OS X/i.test(ua)&&/Safari/i.test(ua)&&!/Chrome|Chromium|Edg/i.test(ua))
    return 'En Safari de Mac, abre el menú Archivo y elige «Añadir al Dock», si tu versión de macOS lo permite.';
  return 'En Chrome o Edge, busca «Instalar aplicación» en el menú del navegador o en la barra de direcciones. Si no aparece, abre la página HTTPS con un navegador compatible.';
}
export function mayReloadForUpdate(state){
  return !state.saveError&&!state.pending&&!state.saving&&!state.updateReloading;
}

/** Consulta del almacenamiento del origen: nunca reemplaza una copia cifrada externa. */
export async function storagePersistence(storage,request=false){
  const method=request?'persist':'persisted';
  if(!storage||typeof storage[method]!=='function')return 'unsupported';
  try{
    const granted=await storage[method]();
    return granted===true?'persistent':granted===false?'best-effort':'unavailable';
  }catch{return 'unavailable';}
}
