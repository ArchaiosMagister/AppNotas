const debug='http://127.0.0.1:'+ (process.env.CUADERNO_QA_PORT||47652);

export async function tab(base,password){
  const target=await fetch(debug+'/json/new?about:blank',{method:'PUT'}).then(r=>r.json());
  const socket=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((ok,fail)=>{socket.onopen=ok;socket.onerror=fail;});
  let sequence=0, dialog;
  const requests=new Map(),errors=[];
  socket.onmessage=event=>{
    const packet=JSON.parse(event.data);
    if(packet.id){
      const request=requests.get(packet.id);
      requests.delete(packet.id);
      packet.error?request.reject(new Error(JSON.stringify(packet.error))):request.resolve(packet.result);
    }
    if(packet.method==='Runtime.exceptionThrown')errors.push(packet.params);
    if(packet.method==='Page.javascriptDialogOpening')dialog=send('Page.handleJavaScriptDialog',{accept:true});
  };
  const send=(method,params={})=>new Promise((resolve,reject)=>{
    const id=++sequence;
    requests.set(id,{resolve,reject});
    socket.send(JSON.stringify({id,method,params}));
  });
  const run=async expression=>{
    const value=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
    if(value.exceptionDetails)throw new Error(value.exceptionDetails.exception?.description||expression);
    return value.result.value;
  };
  const wait=async expression=>{
    for(let n=0;n<120;n++){
      if(await run(expression))return;
      await new Promise(ok=>setTimeout(ok,100));
    }
    throw new Error('Tiempo agotado: '+expression);
  };
  const press=selector=>run(`document.querySelector(${JSON.stringify(selector)}).click();true`);
  const edit=async(selector,value)=>{
    await run(`(()=>{const input=document.querySelector(${JSON.stringify(selector)});input.value=${JSON.stringify(value)};input.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);
  };
  const open=async()=>{await send('Page.navigate',{url:base});await wait("!!document.querySelector('#unlock-form')");};
  const unlock=async(secret=password,create=false)=>{
    await run(`(()=>{document.querySelector('#password').value=${JSON.stringify(secret)};
      const repeat=document.querySelector('#confirm-password');if(repeat)repeat.value=${JSON.stringify(secret)};
      document.querySelector('#unlock-form').requestSubmit();return true;})()`);
    await wait(create||secret===password?"!!document.querySelector('#lock')":"!!document.querySelector('#unlock-error').textContent");
  };
  await send('Runtime.enable');await send('Page.enable');
  const upload=async(id,path)=>{
    const {root}=await send('DOM.getDocument');
    const {nodeId}=await send('DOM.querySelector',{nodeId:root.nodeId,selector:id});
    await send('DOM.setFileInputFiles',{nodeId,files:[path]});
  };
  const restorePassword=async()=>{
    await wait("!!document.querySelector('dialog[open] #backup-password')");
    await run(`(()=>{const input=document.querySelector('#backup-password');input.value=${JSON.stringify(password)};input.form.requestSubmit();return true;})()`);
  };
  return {upload,restorePassword,send,run,wait,press,edit,open,unlock,errors,close:()=>socket.close(),dialog:()=>dialog};
}

