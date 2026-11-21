/* Analizador CSV con comillas dobles, comas, punto y coma, BOM y saltos CRLF. */
export function parseCsv(text){
  if(typeof text!=='string'||text.length>2_000_000)throw new Error('El CSV supera el tamaño admitido (2 MB).');
  text=text.replace(/^\uFEFF/,'');
  // Detectar delimitadores fuera de comillas; los campos citados pueden
  // contener signos de puntuación e incluso saltos de línea.
  let semicolons=0,commas=0,quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"'){
      if(quoted&&text[i+1]==='"'){i++;continue;}
      quoted=!quoted;
    }else if(!quoted&&(c==='\n'||c==='\r'))break;
    else if(!quoted&&c===';')semicolons++;
    else if(!quoted&&c===',')commas++;
  }
  const delimiter=semicolons>commas?';':',';
  const rows=[];let row=[],field='',quotes=false,closedQuote=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quotes){
      if(c==='"'&&text[i+1]==='"'){field+='"';i++;}
      else if(c==='"'){quotes=false;closedQuote=true;}
      else field+=c;
    }else{
      if(closedQuote&&c!==delimiter&&c!=='\n'&&c!=='\r'&&c!==' '&&c!=='\t')
        throw new Error('CSV mal formado: caracteres inesperados después de cerrar comillas.');
      if(c==='"'){
        if(field.length||closedQuote)throw new Error('CSV mal formado: comillas dentro de un campo.');
        quotes=true;
      }else if(c===delimiter){row.push(field);field='';closedQuote=false;}
      else if(c==='\n'||c==='\r'){
        if(c==='\r'&&text[i+1]==='\n')i++;
        row.push(field);field='';closedQuote=false;
        if(row.some(x=>x.trim()))rows.push(row);
        row=[];
      }else if(!closedQuote)field+=c;
    }
  }
  if(quotes)throw new Error('CSV mal formado: comillas sin cerrar.');
  row.push(field);if(row.some(x=>x.trim()))rows.push(row);
  if(rows.length>1001)throw new Error('Máximo 1000 filas de alumnos por importación.');
  if(!rows.length)throw new Error('CSV vacío.');
  return rows;
}
export function namesFromCsv(text){
  const rows=parseCsv(text);
  const headers=rows[0].map(x=>x.trim().toLocaleLowerCase('es'));
  const idx=headers.findIndex(x=>['nombre','alumno','alumna','estudiante','name'].includes(x));
  if(idx<0)throw new Error('Se necesita una cabecera llamada «nombre» o «alumno».');
  // parseCsv ya omite filas vacías. Nunca omitir silenciosamente
  // un registro que contiene datos pero carece de nombre.
  const names=rows.slice(1).map((r,i)=>{
    const name=(r[idx]||'').trim();
    if(!name)throw new Error(`La fila ${i+2} contiene datos sin nombre de alumno. La importación se ha rechazado.`);
    return name;
  });
  if(!names.length)throw new Error('No se han encontrado alumnos.');
  if(names.some(n=>n.length>150))throw new Error('Uno de los nombres supera 150 caracteres.');
  return names;
}


/** CSV optativo: «apellidos;nombre;grupo» para registros completos.
 * CSV anterior «nombre» se importa como etiqueta histórica sin adivinar apellidos. */
export function studentsFromCsv(text){
  const rows=parseCsv(text);
  const headers=rows[0].map(x=>x.trim().toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' '));
  const locate=names=>headers.findIndex(h=>names.includes(h));
  const given=locate(['nombre','alumno','alumna','estudiante','name']);
  const surname=locate(['apellidos','apellido','surname','last name','last_name']);
  const origin=locate(['grupo','grupo de procedencia','grupo origen','clase','grupo tutor','tutoria','grupo_tutoria','origin group']);
  if(given<0)throw new Error('El CSV necesita una columna «nombre». Puedes añadir «apellidos» y «grupo».');
  const entries=rows.slice(1).map((row,i)=>{
    const firstName=(row[given]||'').trim(),lastName=surname<0?'':(row[surname]||'').trim();
    const originGroup=origin<0?'':(row[origin]||'').trim();
    if(!firstName||(surname>=0&&!lastName))throw new Error(`La fila ${i+2} necesita nombre y apellidos. No se ha importado ningún alumno.`);
    if(firstName.length>150||lastName.length>100||originGroup.length>60||
       (surname>=0&&`${lastName}, ${firstName}`.length>150))
      throw new Error(`La fila ${i+2} excede la longitud permitida. No se ha importado ningún alumno.`);
    return surname>=0?{firstName,lastName,originGroup}:{name:firstName,originGroup};
  });
  if(!entries.length)throw new Error('No se han encontrado alumnos.');
  return entries;
}
