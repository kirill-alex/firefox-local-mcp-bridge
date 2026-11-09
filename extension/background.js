let paused=false, connected=false, lastError='', controller;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function api(path,data,signal){const {bridgeToken}=await browser.storage.local.get('bridgeToken');if(typeof bridgeToken!=='string'||!/^[a-f0-9]{64}$/.test(bridgeToken))throw Error('Откройте настройки расширения и добавьте токен локального сервера');const res=await fetch('http://127.0.0.1:17893'+path,{method:data===undefined?'GET':'POST',headers:{Authorization:`Bearer ${bridgeToken}`,'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data),signal});if(!res.ok)throw Error(`Bridge HTTP ${res.status}`);return res.json();}
function extractPage(offset,maxChars){
  const text=document.body?.innerText||'';
  return {title:document.title,url:location.href,text:text.slice(offset,offset+maxChars),offset,totalChars:text.length,nextOffset:offset+maxChars<text.length?offset+maxChars:null};
}
async function getWebTab(tabId){
  let tab=await browser.tabs.get(tabId);
  if(tab.incognito)throw Error('Private tabs are excluded');
  for(let i=0;i<30&&tab.status==='loading'&&!/^https?:\/\//i.test(tab.url||'');i++){await delay(100);tab=await browser.tabs.get(tabId);if(tab.incognito)throw Error('Private tabs are excluded');}
  if(!/^https?:\/\//i.test(tab.url||''))throw Error('Only HTTP/HTTPS web pages can be read');
  return tab;
}
async function readTab(tabId,offset=0,maxChars=30000,frameId=0){
  const tab=await getWebTab(tabId);
  if(tab.discarded)throw Error('Tab is unloaded. Use firefox_reload or open it in Firefox.');
  const result=await browser.tabs.executeScript(tabId,{code:`(${extractPage.toString()})(${JSON.stringify(offset)},${JSON.stringify(maxChars)})`,frameId,runAt:'document_idle'});
  return {tabId,...result[0],untrustedContent:true};
}
async function listTabs(){return (await browser.tabs.query({})).filter(t=>!t.incognito).map(t=>({tabId:t.id,windowId:t.windowId,title:t.title,url:t.url,active:t.active,discarded:t.discarded,readable:/^https?:\/\//i.test(t.url||'')&&!t.discarded}));}
async function execute(command){const a=command.arguments||{};
  if(paused)throw Error('Access is paused');
  if(command.deadline&&Date.now()>command.deadline)throw Error('Command expired before execution');
  const op=command.name.replace(/^firefox_/,'');
  if(command.name==='firefox_list_tabs')return {tabs:await listTabs(),untrustedContent:true};
  if(command.name==='firefox_read_tab')return readTab(a.tabId,a.offset??0,a.maxChars??30000,a.frameId??0);
  if(command.name==='firefox_search_tabs'){
    if(typeof a.query!=='string'||!a.query.trim())throw Error('Empty query');
    const all=await listTabs();const ids=a.tabIds??all.filter(t=>t.readable).map(t=>t.tabId);const selected=ids.slice(0,50);const matches=[],errors=[];let cursor=0;
    await Promise.all(Array.from({length:Math.min(4,selected.length)},async()=>{while(cursor<selected.length){const id=selected[cursor++];try{const p=await readTab(id,0,1000000);const index=p.text.toLocaleLowerCase().indexOf(a.query.toLocaleLowerCase());if(index>=0)matches.push({tabId:id,title:p.title,url:p.url,offset:index,excerpt:p.text.slice(Math.max(0,index-160),index+a.query.length+240)});if(p.nextOffset!==null)errors.push({tabId:id,error:'Only the first 1,000,000 characters were searched'});}catch(e){errors.push({tabId:id,error:e.message});}}}));
    return {query:a.query,matches,errors,searchedTabs:selected.length,skippedTabs:Math.max(0,ids.length-50),untrustedContent:true};
  }
  function webURL(url){const parsed=new URL(url);if(!['http:','https:'].includes(parsed.protocol))throw Error('Only HTTP/HTTPS URLs allowed');if(parsed.username||parsed.password)throw Error('Credentials in URLs are excluded');return parsed.href;}
  if(op==='open_tab'){const t=await browser.tabs.create({url:webURL(a.url),active:a.active??false});return {tabId:t.id,url:t.url};}
  if(op==='download')return {downloadId:await browser.downloads.download({url:webURL(a.url),...(a.filename?{filename:a.filename}:{}),conflictAction:'uniquify'})};
  if(op==='downloads')return {downloads:(await browser.downloads.search({limit:20,orderBy:['-startTime']})).filter(d=>!d.incognito).map(d=>({id:d.id,url:d.url,filename:d.filename,state:d.state,bytesReceived:d.bytesReceived,totalBytes:d.totalBytes,error:d.error})),untrustedContent:true};
  if(op==='wait'){
    const end=Date.now()+(a.timeoutMs??10000);let last;
    do{
      if(paused)throw Error('Access is paused');
      try{await getWebTab(a.tabId);const frameId=a.frameId??0;await browser.tabs.executeScript(a.tabId,{file:'page.js',frameId,runAt:'document_start'});const values=await browser.tabs.executeScript(a.tabId,{code:`globalThis.__codexFirefoxPageV2.run('wait',${JSON.stringify({...a,timeoutMs:0})})`,frameId,runAt:'document_start'});return {tabId:a.tabId,frameId,result:values[0],untrustedContent:true};}catch(e){last=e;}
      await delay(100);
    }while(Date.now()<end);
    throw Error('Wait timed out: '+last?.message);
  }
  if(!['select_tab','close_tab','navigate','reload','history','frames','snapshot','query','click','fill','type','select','check','hover','press_key','scroll','wait','screenshot','evaluate','drag','upload_file'].includes(op))throw Error('Unknown command');
  const rawTab=await browser.tabs.get(a.tabId);if(rawTab.incognito)throw Error('Private tabs are excluded');
  const tab=['select_tab','close_tab','navigate','reload','history'].includes(op)?rawTab:await getWebTab(a.tabId);
  if(op==='select_tab'){await browser.tabs.update(a.tabId,{active:true});await browser.windows.update(tab.windowId,{focused:true});return {selected:true,tabId:a.tabId};}
  if(op==='close_tab'){await browser.tabs.remove(a.tabId);return {closed:true,tabId:a.tabId};}
  if(op==='navigate'){await browser.tabs.update(a.tabId,{url:webURL(a.url)});return {navigating:true,tabId:a.tabId};}
  if(op==='reload'){await browser.tabs.reload(a.tabId,{bypassCache:a.bypassCache??false});return {reloading:true};}
  if(op==='history'){await browser.tabs[a.direction==='back'?'goBack':'goForward'](a.tabId);return {navigating:true};}
  if(tab.discarded)throw Error('Tab is unloaded. Use firefox_reload first.');
  if(op==='frames')return {frames:await browser.webNavigation.getAllFrames({tabId:a.tabId}),untrustedContent:true};
  if(op==='screenshot'){const dataURL=await browser.tabs.captureTab(a.tabId,{format:'png'});return {tabId:a.tabId,image:{mimeType:'image/png',data:dataURL.split(',')[1]}};}
  const frameId=a.frameId??0;
  if(op==='evaluate'){
    const code=`(async()=>{const value=await (${a.expression}\n);return value===undefined?null:JSON.parse(JSON.stringify(value));})()`;
    const result=await browser.tabs.executeScript(a.tabId,{code,frameId,runAt:'document_idle'});return {value:result[0],untrustedContent:true};
  }
  await browser.tabs.executeScript(a.tabId,{file:'page.js',frameId,runAt:'document_idle'});
  if(paused)throw Error('Access is paused');
  const result=await browser.tabs.executeScript(a.tabId,{code:`globalThis.__codexFirefoxPageV2.run(${JSON.stringify(op)},${JSON.stringify(a)})`,frameId,runAt:'document_idle'});
  return {tabId:a.tabId,frameId,result:result[0],untrustedContent:true};
}
browser.runtime.onMessage.addListener(async message=>{
  if(message.type==='connection_changed'){connected=false;controller?.abort();return {ok:true};}
  if(message.type==='status')return {paused,connected,lastError};
  if(message.type==='toggle'){paused=!paused;await browser.storage.local.set({paused});await api('/control',{paused}).catch(()=>{});controller?.abort();return {paused};}
});
(async()=>{
  paused=!!(await browser.storage.local.get('paused')).paused;
  for(;;){
    if(paused){connected=false;await browser.browserAction.setBadgeText({text:'OFF'});await delay(500);continue;}
    try{controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),25000);let data;try{data=await api('/poll',undefined,controller.signal);}finally{clearTimeout(timeout);}
      connected=true;lastError='';await browser.browserAction.setBadgeText({text:'ON'});
      if(data.command&&!paused){let result;try{result={id:data.command.id,result:await execute(data.command)};}catch(e){result={id:data.command.id,error:e.message};}await api('/result',result);}
    }catch(e){connected=false;lastError=e.message;await browser.browserAction.setBadgeText({text:'!'});await delay(1500);}
  }
})();
