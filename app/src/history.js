/** Historial exclusivamente en memoria. Nunca se almacena en IndexedDB ni en las copias. */
export const HISTORY_LIMIT = 30;
export const emptyHistory = () => ({past:[],future:[]});
export function recordChange(history,before,after,label='Cambio'){
  if(JSON.stringify(before)===JSON.stringify(after))return history;
  return {
    past:[...history.past,{doc:structuredClone(before),label}].slice(-HISTORY_LIMIT),
    future:[]
  };
}
export function stepHistory(history,current,direction){
  if(direction!=='undo'&&direction!=='redo')throw new Error('Dirección de historial desconocida.');
  const from=direction==='undo'?'past':'future';
  const to=direction==='undo'?'future':'past';
  if(!history[from].length)return null;
  const item=history[from].at(-1);
  return {
    doc:structuredClone(item.doc),
    label:item.label,
    history:{
      ...history,
      [from]:history[from].slice(0,-1),
      [to]:[...history[to],{doc:structuredClone(current),label:item.label}].slice(-HISTORY_LIMIT)
    }
  };
}
