import {CURRICULA} from './curriculum-data.js';
/** Catálogo oficial, consultable por grupo sin modificar notas ni inventar ponderaciones. */
export function curriculumForGroup(group,version='auto'){
  if(!group)return null;
  const bySubject={'Latín 4.º':CURRICULA.lat4,'Latín I':CURRICULA.lat1,'Griego I':CURRICULA.gr1,'Griego II':CURRICULA.gr2};
  if(group.subject==='Latín II'){
    const firstYear=Number.parseInt(group.course?.slice(0,4),10);
    const selected=version==='auto'?(firstYear>=2027?'2026':'2022'):version;
    if(!['2022','2026'].includes(selected))throw new Error('Versión curricular no disponible.');
    const data=selected==='2022'?CURRICULA['lat2-2022']:CURRICULA.lat2;
    return {data,version:selected,warning:selected==='2026'&&(!Number.isFinite(firstYear)||firstYear<2027)?'La versión 2026 corresponde a 2.º de Bachillerato a partir de 2027–2028. Se presenta como referencia futura.':''};
  }
  const data=bySubject[group.subject];
  if(!data)return null;
  const firstYear=Number.parseInt(group.course?.slice(0,4),10);
  const warning=group.subject==='Griego II'&&(!Number.isFinite(firstYear)||firstYear<2027)
    ?'La fuente aportada de Griego II es la versión 2026, aplicable a partir de 2027–2028. No se ha aportado el currículo de 2022 para 2026–2027; consulta este repertorio como referencia futura.':'';
  return {data,version:data.version,warning};
}
export function officialCompetenciesForGroup(group,version='auto'){
  const cfg=curriculumForGroup(group,version);
  if(!cfg)return null;
  const competencias=cfg.data.competencias.map(c=>({
    code:'CE'+c.id, name:'CE'+c.id, enunciado:c.enunciado,
    key:cfg.data.id+':CE'+c.id, source:cfg.data.norma,
    page:c.page, sourcePdf:cfg.data.fuente_pdf
  }));
  return {...cfg,competencias};
}
export function groupCompetencies(doc,groupId){
  // Las competencias previas sin groupId pertenecen al primer grupo del cuaderno.
  const originalGroupId=doc.groups[0]?.id;
  return doc.competencies.filter(c=>c.groupId===groupId||(!c.groupId&&groupId===originalGroupId));
}
export function linkedOfficialCompetency(doc,groupId,key){
  return groupCompetencies(doc,groupId).find(c=>c.curriculumKey===key)||null;
}

/** Consulta pura: agrupa criterios por competencia específica de su propia versión curricular. */
export function curriculumCompetenciesWithCriteria(data,{competence='all',query=''}={}){
  if(!Array.isArray(data?.competencias)||!Array.isArray(data?.criterios))return [];
  const selected=String(competence),term=String(query??'').trim().toLocaleLowerCase('es');
  return data.competencias.flatMap(ce=>{
    if(selected!=='all'&&selected!==String(ce.id))return [];
    const own=data.criterios.filter(cr=>String(cr.competencia)===String(ce.id));
    const heading=`CE ${ce.id} CE${ce.id} ${ce.enunciado??''} ${ce.descripcion??''} ${(ce.claves??[]).join(' ')}`.toLocaleLowerCase('es');
    const matches=!term||heading.includes(term);
    const criterios=matches?own:own.filter(cr=>`${cr.codigo??''} ${cr.texto??''}`.toLocaleLowerCase('es').includes(term));
    return matches||criterios.length?[{competencia:ce,criterios}]:[];
  });
}
