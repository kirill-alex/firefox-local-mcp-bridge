import {isAbsolute} from 'node:path';
import {statSync} from 'node:fs';

export const KEY={Backspace:'\uE003',Tab:'\uE004',Enter:'\uE007',Shift:'\uE008',Control:'\uE009',Alt:'\uE00A',Escape:'\uE00C',Space:' ',PageUp:'\uE00E',PageDown:'\uE00F',End:'\uE010',Home:'\uE011',ArrowLeft:'\uE012',ArrowUp:'\uE013',ArrowRight:'\uE014',ArrowDown:'\uE015',Insert:'\uE016',Delete:'\uE017',Meta:'\uE03D'};
export function keyActions(chord){const parts=chord.split('+');if(!parts.length||parts.some(p=>!p))throw Error('Invalid key chord');const keys=parts.map(p=>KEY[p]||(Array.from(p).length===1?p:null));if(keys.some(k=>k===null))throw Error('Unknown key name');return [...keys.map(value=>({type:'keyDown',value})),...keys.toReversed().map(value=>({type:'keyUp',value}))];}
function webURL(url){const parsed=new URL(url);if(!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password)throw Error('Only HTTP/HTTPS URLs without credentials allowed');return parsed.href;}
function scrollState(x,y,dx,dy,perform=false){
 const root=document.scrollingElement,ancestors=[];let e=document.elementFromPoint(x,y);
 while(e){ancestors.push(e);e=e.parentElement;}if(root&&!ancestors.includes(root))ancestors.push(root);
 const candidates=ancestors.filter(el=>{const s=getComputedStyle(el);return el===root||/(auto|scroll|overlay)/.test(s.overflowY+' '+s.overflowX);});
 const before=candidates.map(el=>({tag:el.localName,id:el.id,x:el.scrollLeft,y:el.scrollTop}));
 if(perform){const target=candidates.find(el=>(dy>0&&el.scrollTop<el.scrollHeight-el.clientHeight)||(dy<0&&el.scrollTop>0)||(dx>0&&el.scrollLeft<el.scrollWidth-el.clientWidth)||(dx<0&&el.scrollLeft>0));target?.scrollBy({left:dx,top:dy,behavior:'instant'});}
 const positions=candidates.map(el=>({tag:el.localName,id:el.id,x:el.scrollLeft,y:el.scrollTop}));
 return {positions,changed:JSON.stringify(before)!==JSON.stringify(positions),visibility:document.visibilityState};
}
export class FirefoxBiDi{
 constructor(endpoint='ws://127.0.0.1:9222/session'){
  const u=new URL(endpoint);if(u.protocol!=='ws:'||u.hostname!=='127.0.0.1'||u.pathname!=='/session'||u.username||u.password||u.search||u.hash)throw Error('BiDi must use ws://127.0.0.1:PORT/session');
  this.endpoint=u.href;this.ws=null;this.id=0;this.pending=new Map();this.connecting=null;this.paused=false;this.session=null;this.subscriptions=new Map();this.events=[];this.sequence=0;this.queue=Promise.resolve();this.topContexts=new Map();
 }
 async connect(){
  if(this.ws?.readyState===WebSocket.OPEN&&this.session)return;
  if(this.connecting)return this.connecting;
  this.connecting=(async()=>{
   const ws=new WebSocket(this.endpoint);this.ws=ws;
   ws.addEventListener('message',event=>{let m;try{m=JSON.parse(event.data);}catch{return;}
    if(m.id!==undefined){const p=this.pending.get(m.id);if(!p)return;clearTimeout(p.timer);this.pending.delete(m.id);if(m.type==='error')p.reject(Error(`${m.error}: ${m.message}`));else p.resolve(m.result);}
    else if(m.type==='event')this.record(m);
   });
   ws.addEventListener('close',()=>{if(this.ws===ws){this.session=null;this.subscriptions.clear();}for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(Error('BiDi disconnected; action outcome may be unknown. Do not blindly retry.'));}this.pending.clear();});
   try{
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{ws.close();reject(Error('Firefox BiDi port 9222 did not respond'));},4000);ws.addEventListener('open',()=>{clearTimeout(timer);resolve();},{once:true});ws.addEventListener('error',()=>{clearTimeout(timer);reject(Error('Cannot connect to Firefox BiDi. Completely close Firefox, then launch with --remote-debugging-port 9222'));},{once:true});});
    this.session=await this.rpc('session.new',{capabilities:{alwaysMatch:{acceptInsecureCerts:false,unhandledPromptBehavior:{default:'ignore'}}}});
   }catch(e){ws.close();throw e;}
  })();
  try{await this.connecting;}finally{this.connecting=null;}
 }
 rpc(method,params={},timeout=20000){
  if(this.ws?.readyState!==WebSocket.OPEN)return Promise.reject(Error('BiDi is not connected'));
  const id=++this.id;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(Error(`${method} timed out; the action may have completed. Inspect state before retrying.`));},timeout);this.pending.set(id,{resolve,reject,timer});try{this.ws.send(JSON.stringify({id,method,params}));}catch(e){clearTimeout(timer);this.pending.delete(id);reject(e);}});
 }
 record(message){
  const p=message.params,context=p.source?.context||p.context;
  if(!context||!this.subscriptions.has(context))return;
  const entry={sequence:++this.sequence,method:message.method,context,timestamp:p.timestamp};
  if(message.method==='log.entryAdded'){entry.level=p.level;entry.text=String(p.text??'').slice(0,4000);entry.type=p.type;}
  else{entry.requestId=p.request?.request;entry.url=p.request?.url;entry.httpMethod=p.request?.method;entry.status=p.response?.status;entry.error=p.errorText;}
  this.events.push(entry);if(this.events.length>500)this.events.shift();
 }
 async evaluate(contextId,expression){
  const r=await this.rpc('script.evaluate',{expression:`(async()=>{const v=await (${expression}\n);return v===undefined?'null':JSON.stringify(v);})()`,target:{context:contextId},awaitPromise:true,resultOwnership:'none'});
  if(r.type==='exception')throw Error('Page JavaScript: '+r.exceptionDetails.text);
  if(r.result.type!=='string')throw Error('Expression must return JSON-serializable data');return JSON.parse(r.result.value);
 }
 async ensureContext(contextId,allowBlank=false){
  const tree=await this.rpc('browsingContext.getTree',{});let found;const walk=(nodes,top)=>{for(const c of nodes){this.topContexts.set(c.context,top||c.context);if(c.context===contextId)found=c;walk(c.children||[],top||c.context);}};walk(tree.contexts);
  if(!found)throw Error('Context no longer exists. Refresh firefox_bidi_contexts.');
  if(!/^https?:\/\//i.test(found.url)&&!(allowBlank&&found.url==='about:blank'))throw Error('Only HTTP/HTTPS page contexts are supported');return found;
 }
 async point(contextId,a){
  if(a.selector)return this.evaluate(contextId,`(()=>{const nodes=document.querySelectorAll(${JSON.stringify(a.selector)});if(nodes.length!==1)throw Error('Selector must match exactly one element; found '+nodes.length);const e=nodes[0];if(e.disabled)throw Error('Element disabled');e.scrollIntoView({block:'center',inline:'center',behavior:'instant'});const r=e.getBoundingClientRect();if(!r.width||!r.height)throw Error('Element hidden');const x=r.x+r.width/2,y=r.y+r.height/2,top=document.elementFromPoint(x,y);if(top!==e&&!e.contains(top))throw Error('Element covered');return {x:Math.round(x),y:Math.round(y)};})()`);
  if(!Number.isFinite(a.x)||!Number.isFinite(a.y))throw Error('Provide a unique selector or viewport x/y');return {x:Math.round(a.x),y:Math.round(a.y)};
 }
 async input(contextId,actions){if(this.paused)throw Error('BiDi is paused');if(Date.now()>this.deadline)throw Error('Queued BiDi action expired');try{return await this.rpc('input.performActions',{context:contextId,actions});}finally{await this.rpc('input.releaseActions',{context:contextId}).catch(()=>{});}}
 pointer(actions){return {type:'pointer',id:'firefox-mouse',parameters:{pointerType:'mouse'},actions};}
 async focus(contextId,selector){
  return this.evaluate(contextId,`(()=>{const nodes=${selector?`document.querySelectorAll(${JSON.stringify(selector)})`:'[document.activeElement]'};if(nodes.length!==1||!nodes[0])throw Error('Select one editable element');const e=nodes[0];if(e.type==='password')throw Error('Password fields excluded');if(e.disabled||e.readOnly)throw Error('Disabled or readonly');if(!e.isContentEditable&&!['INPUT','TEXTAREA'].includes(e.tagName))throw Error('Target is not editable');e.focus();return true;})()`);
 }
 async run(name,args={}){
  const op=name.replace(/^firefox_bidi_/,'');
  if(op==='disconnect'){await this.close();return {disconnected:true};}
  if(op==='pause'){this.paused=args.paused;return {paused:this.paused};}
  if(op==='events'){const all=this.events.filter(e=>e.sequence>(args.after??0)&&(!args.contextId||e.context===args.contextId));const events=all.slice(0,args.limit??100);return {events,nextCursor:events.at(-1)?.sequence??args.after??0,newestCursor:this.sequence,oldestAvailable:this.events[0]?.sequence??null,untrustedContent:true};}
  if(this.paused&&op!=='status')throw Error('BiDi is paused');
  // A page script may be waiting for a dialog; its handler must bypass that queue.
  if(op==='handle_prompt'){await this.connect();return this.execute(op,args);}
  const deadline=Date.now()+30000;
  const operation=async()=>{if(Date.now()>deadline)throw Error('Queued BiDi command expired');if(this.paused&&op!=='status')throw Error('BiDi is paused');this.deadline=deadline;await this.connect();return this.execute(op,args);};
  const result=this.queue.then(operation);this.queue=result.catch(()=>{});return result;
 }
 async execute(op,a){
  if(op==='status')return {connected:true,paused:this.paused,browser:this.session.capabilities.browserName,version:this.session.capabilities.browserVersion,endpoint:this.endpoint,monitoredContexts:[...this.subscriptions.keys()]};
  if(op==='contexts')return {...await this.rpc('browsingContext.getTree',{}),untrustedContent:true};
  if(op==='open'){const url=webURL(a.url);const created=await this.rpc('browsingContext.create',{type:'tab',background:true});await this.rpc('browsingContext.navigate',{context:created.context,url,wait:'interactive'});return {contextId:created.context,url};}
  await this.ensureContext(a.contextId,['navigate','close'].includes(op));
  if(op==='syncshare_read'){const {inspectSyncShare}=await import('./syncshare.mjs');return inspectSyncShare(this,a.contextId);}
  if(op==='navigate')return this.rpc('browsingContext.navigate',{context:a.contextId,url:webURL(a.url),wait:'interactive'});
  if(op==='activate'){
   try{await this.rpc('browsingContext.activate',{context:this.topContexts.get(a.contextId)||a.contextId},1500);return {confirmed:true};}
   catch(e){if(!e.message.includes('timed out'))throw e;return {confirmed:false,outcome:'unknown',message:'Firefox did not confirm OS focus within 1.5 seconds. Tab selection may have changed. Native page input can continue without waiting for OS focus.'};}
  }
  if(op==='close'){await this.stopMonitoring(a.contextId);return this.rpc('browsingContext.close',{context:a.contextId,promptUnload:true});}
  if(op==='evaluate')return {value:await this.evaluate(a.contextId,a.expression),untrustedContent:true};
  if(op==='snapshot')return {snapshot:await this.evaluate(a.contextId,`(()=>{const selector=e=>{if(e.id&&document.querySelectorAll('#'+CSS.escape(e.id)).length===1)return '#'+CSS.escape(e.id);const parts=[];while(e&&e.nodeType===1){let s=e.localName;const same=[...e.parentElement?.children||[]].filter(n=>n.localName===e.localName);if(same.length>1)s+=':nth-of-type('+(same.indexOf(e)+1)+')';parts.unshift(s);e=e.parentElement;}return parts.join(' > ');};const elements=[...document.querySelectorAll('a,button,input,textarea,select,[contenteditable="true"],[role],[tabindex]')].filter(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden').slice(0,500).map(e=>{const r=e.getBoundingClientRect();return {selector:selector(e),tag:e.localName,role:e.getAttribute('role'),name:(e.getAttribute('aria-label')||[...e.labels||[]].map(l=>l.innerText).join(' ')||e.innerText||e.getAttribute('placeholder')||'').slice(0,300),value:e.type==='password'?undefined:e.value,disabled:!!e.disabled,checked:e.checked,rect:{x:r.x,y:r.y,width:r.width,height:r.height}};});return {url:location.href,title:document.title,text:(document.body?.innerText||'').slice(0,${a.maxChars??20000}),elements,viewport:{width:innerWidth,height:innerHeight,scrollX,scrollY}};})()`),untrustedContent:true};
  if(op==='click'||op==='hover'){
   const p=await this.point(a.contextId,a);const actions=[{type:'pointerMove',x:p.x,y:p.y,duration:100,origin:'viewport'}];
   if(op==='click'){const button={left:0,middle:1,right:2}[a.button??'left'];actions.push({type:'pointerDown',button},{type:'pointerUp',button});if(a.double)actions.push({type:'pause',duration:50},{type:'pointerDown',button},{type:'pointerUp',button});}
   await this.input(a.contextId,[this.pointer(actions)]);return {completed:true,trustedInput:true};
  }
  if(op==='type'){
   await this.focus(a.contextId,a.selector);const actions=a.replace?keyActions('Control+a'):[];
   for(const value of a.text)actions.push({type:'keyDown',value},{type:'keyUp',value});
   if(!a.text&&a.replace)actions.push(...keyActions('Backspace'));
   if(actions.length)await this.input(a.contextId,[{type:'key',id:'firefox-keyboard',actions}]);return {completed:true,trustedInput:true};
  }
  if(op==='key'){
   if(a.selector)await this.evaluate(a.contextId,`(()=>{const n=document.querySelectorAll(${JSON.stringify(a.selector)});if(n.length!==1)throw Error('Selector must be unique');n[0].focus();return true;})()`);
   await this.input(a.contextId,[{type:'key',id:'firefox-keyboard',actions:keyActions(a.key)}]);return {completed:true,trustedInput:true};
  }
  if(op==='drag'){
   const moves=[];const steps=10;for(let i=1;i<=steps;i++)moves.push({type:'pointerMove',x:Math.round(a.fromX+(a.toX-a.fromX)*i/steps),y:Math.round(a.fromY+(a.toY-a.fromY)*i/steps),duration:Math.round((a.durationMs??500)/steps),origin:'viewport'});
   await this.input(a.contextId,[this.pointer([{type:'pointerMove',x:Math.round(a.fromX),y:Math.round(a.fromY),origin:'viewport'},{type:'pointerDown',button:0},...moves,{type:'pointerUp',button:0}])]);return {completed:true,trustedInput:true};
  }
  if(op==='scroll'){
   const mode=a.mode??'auto';const probe=perform=>this.evaluate(a.contextId,`(${scrollState.toString()})(${JSON.stringify(a.x)},${JSON.stringify(a.y)},${JSON.stringify(a.deltaX??0)},${JSON.stringify(a.deltaY)},${perform})`);
   if(mode==='dom'){const result=await probe(true);return {completed:true,moved:result.changed,mode:'dom',trustedInput:false};}
   const before=await probe(false);await this.input(a.contextId,[{type:'wheel',id:'firefox-wheel',actions:[{type:'scroll',x:Math.round(a.x),y:Math.round(a.y),deltaX:a.deltaX??0,deltaY:a.deltaY,duration:200,origin:'viewport'}]}]);
   await new Promise(r=>setTimeout(r,250));const after=await probe(false);const moved=JSON.stringify(before.positions)!==JSON.stringify(after.positions);
   if(!moved&&mode==='auto'&&after.visibility==='hidden'){if(this.paused)throw Error('BiDi is paused');const fallback=await probe(true);return {completed:true,moved:fallback.changed,mode:'dom-fallback',trustedWheelDispatched:true, trustedInput:false};}
   return {completed:true,moved,mode:'native',trustedInput:true};
  }
  if(op==='screenshot'){const image=await this.rpc('browsingContext.captureScreenshot',{context:a.contextId,origin:a.fullPage?'document':'viewport',format:{type:'image/png'}});return {image:{mimeType:'image/png',data:image.data}};}
  if(op==='upload'){
   for(const path of a.paths){if(!isAbsolute(path)||!statSync(path).isFile())throw Error('All paths must be absolute regular files');}
   const r=await this.rpc('script.evaluate',{expression:`(()=>{const n=document.querySelectorAll(${JSON.stringify(a.selector)});if(n.length!==1||n[0].type!=='file')throw Error('Select exactly one file input');return n[0];})()`,target:{context:a.contextId},awaitPromise:false,resultOwnership:'none'});
   if(r.type==='exception'||!r.result.sharedId)throw Error('File input not found');return this.rpc('input.setFiles',{context:a.contextId,element:{sharedId:r.result.sharedId},files:a.paths});
  }
  if(op==='monitor'){
   if(!a.enabled){await this.stopMonitoring(a.contextId);return {monitoring:false};}
   if(!this.subscriptions.has(a.contextId)){const r=await this.rpc('session.subscribe',{events:['log.entryAdded','network.beforeRequestSent','network.responseCompleted','network.fetchError'],contexts:[a.contextId]});this.subscriptions.set(a.contextId,r.subscription);}
   return {monitoring:true,contextId:a.contextId,cursor:this.sequence};
  }
  if(op==='handle_prompt')return this.rpc('browsingContext.handleUserPrompt',{context:a.contextId,accept:a.accept,...(a.text===undefined?{}:{userText:a.text})});
  throw Error('Unknown BiDi command');
 }
 async stopMonitoring(context){const subscription=this.subscriptions.get(context);if(subscription){await this.rpc('session.unsubscribe',{subscriptions:[subscription]});this.subscriptions.delete(context);}}
 async close(){if(this.ws?.readyState===WebSocket.OPEN&&this.session)await this.rpc('session.end',{},3000).catch(()=>{});this.ws?.close();this.session=null;}
}
