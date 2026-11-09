/* Injected only into the requested frame. Isolated world, no network access. */
if(!globalThis.__codexFirefoxPageV2){
 globalThis.__codexFirefoxPageV2=(()=>{
  let snapshotId='',refs=new Map();
  const visible=e=>{const s=getComputedStyle(e);return s.visibility!=='hidden'&&s.display!=='none'&&e.getClientRects().length>0;};
  function all(selector,root=document){const found=[...root.querySelectorAll(selector)];for(const e of root.querySelectorAll('*'))if(e.shadowRoot)found.push(...all(selector,e.shadowRoot));return found;}
  const label=e=>(e.getAttribute('aria-label')||[...(e.labels||[])].map(l=>l.innerText).join(' ')||e.getAttribute('alt')||e.getAttribute('title')||e.innerText||e.getAttribute('placeholder')||'').trim().slice(0,300);
  function info(e){const r=e.getBoundingClientRect();return {tag:e.localName,role:e.getAttribute('role'),name:label(e),type:e.getAttribute('type'),disabled:!!e.disabled,checked:typeof e.checked==='boolean'?e.checked:undefined,value:e.type==='password'?undefined:('value'in e?String(e.value).slice(0,500):undefined),href:e.href,visible:visible(e),rect:{x:r.x,y:r.y,width:r.width,height:r.height}};}
  function target(a){
   let e;
   if(a.ref){if(!a.snapshotId||a.snapshotId!==snapshotId)throw Error('Stale snapshot. Take a new snapshot and use its snapshotId.');e=refs.get(a.ref);if(!e?.isConnected)throw Error('Element detached. Take a new snapshot.');}
   else if(a.selector){const matches=all(a.selector);if(matches.length!==1)throw Error(`Selector must match exactly one element; found ${matches.length}`);e=matches[0];}
   else if(Number.isFinite(a.x)&&Number.isFinite(a.y)){e=document.elementFromPoint(a.x,a.y);if(!e)throw Error('No element at these viewport coordinates');}
   else throw Error('Provide ref + snapshotId, a unique selector, or x/y coordinates');
   return e;
  }
  function editable(e){if(e.type==='password')throw Error('Password fields are excluded');if(e.disabled||e.readOnly)throw Error('Element is disabled or read-only');if(!(e instanceof HTMLTextAreaElement)&&!(e instanceof HTMLInputElement)&&!e.isContentEditable)throw Error('Element is not editable');if(e instanceof HTMLInputElement&&!['text','email','search','tel','url','number'].includes(e.type))throw Error('Unsupported input type');}
  function changeText(e,text,insert=false){editable(e);e.focus();
   const before=new InputEvent('beforeinput',{bubbles:true,cancelable:true,inputType:insert?'insertText':'insertReplacementText',data:text});if(!e.dispatchEvent(before))return {cancelled:true};
   if(e.isContentEditable){if(insert){const sel=getSelection();if(!sel.rangeCount||!e.contains(sel.anchorNode))throw Error('Place caret in this editable element before inserting');const range=sel.getRangeAt(0);range.deleteContents();const n=document.createTextNode(text);range.insertNode(n);range.setStartAfter(n);range.collapse(true);sel.removeAllRanges();sel.addRange(range);}else e.textContent=text;}
   else{let value=text;if(insert){if(e.selectionStart===null)throw Error('Input does not support caret insertion');value=e.value.slice(0,e.selectionStart)+text+e.value.slice(e.selectionEnd);}
    const start=e.selectionStart??0;Object.getOwnPropertyDescriptor(e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(e,value);
    if(insert)e.setSelectionRange(start+text.length,start+text.length);}
   e.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:text}));e.dispatchEvent(new Event('change',{bubbles:true}));return {value:e.isContentEditable?e.textContent:e.value};
  }
  async function run(op,a){
   if(op==='snapshot'){
    snapshotId=crypto.randomUUID();refs=new Map();const candidates=all('a,button,input,textarea,select,[contenteditable="true"],[role],[tabindex],summary,h1,h2,h3,h4,label').filter(visible);const elements=candidates.slice(0,a.maxElements??300).map((e,i)=>{const ref='e'+(i+1);refs.set(ref,e);return {ref,...info(e)};});
    return {snapshotId,url:location.href,title:document.title,text:(document.body?.innerText||'').slice(0,a.maxChars??20000),elements,truncatedElements:candidates.length>elements.length,viewport:{width:innerWidth,height:innerHeight,scrollX,scrollY}};
   }
   if(op==='query'){const matches=all(a.selector);return {count:matches.length,elements:matches.slice(0,100).map(info)};}
   if(op==='wait'){
    const end=Date.now()+(a.timeoutMs??10000);for(;;){const matches=a.selector?all(a.selector):[];const state=a.state??'visible';const ok=a.selector?(state==='attached'?matches.length>0:state==='detached'?matches.length===0:state==='hidden'?!matches.some(visible):matches.some(visible)):true;const textOk=a.text===undefined||(document.body?.innerText||'').includes(a.text);if(ok&&textOk)return {matched:true,url:location.href};if(Date.now()>=end)throw Error('Wait timed out');await new Promise(r=>setTimeout(r,100));}
   }
   if(op==='scroll'){const e=a.ref||a.selector?target(a):window;e.scrollBy({left:a.x??0,top:a.y,behavior:'instant'});return {scrolled:true};}
   if(op==='drag'){
    const source=target({selector:a.source}),dest=target({selector:a.destination});const dataTransfer=new DataTransfer();source.dispatchEvent(new DragEvent('dragstart',{bubbles:true,cancelable:true,dataTransfer}));dest.dispatchEvent(new DragEvent('dragenter',{bubbles:true,cancelable:true,dataTransfer}));dest.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer}));dest.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer}));source.dispatchEvent(new DragEvent('dragend',{bubbles:true,dataTransfer}));return {dispatched:true,synthetic:true};
   }
   const e=op==='press_key'&&!a.ref&&!a.selector?document.activeElement:target(a);
   if(!e||(op!=='upload_file'&&!visible(e))||e.disabled)throw Error('Target is hidden, missing or disabled');
   if(op==='fill'||op==='type')return changeText(e,a.text,op==='type');
   if(op==='upload_file'){
    if(!(e instanceof HTMLInputElement)||e.type!=='file')throw Error('Target is not a file input');const bytes=Uint8Array.from(atob(a.file.base64),c=>c.charCodeAt(0));const dt=new DataTransfer();dt.items.add(new File([bytes],a.file.name,{type:a.file.mimeType}));e.files=dt.files;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return {attached:e.files.length,name:a.file.name};
   }
   if(op==='select'){
    if(!(e instanceof HTMLSelectElement))throw Error('Target is not a select');if(!e.multiple&&a.values.length!==1)throw Error('Select supports one value');for(const v of a.values)if(![...e.options].some(o=>o.value===v&&!o.disabled))throw Error('Option missing or disabled: '+v);for(const o of e.options)o.selected=a.values.includes(o.value);e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return {values:[...e.selectedOptions].map(o=>o.value)};
   }
   if(op==='check'){if(!(e instanceof HTMLInputElement)||!['checkbox','radio'].includes(e.type))throw Error('Target is not a checkbox/radio');if(e.type==='radio'&&!a.checked)throw Error('Cannot uncheck a radio directly');if(e.checked!==a.checked)e.click();return {checked:e.checked};}
   if(op==='hover'||op==='click'){
    e.scrollIntoView({block:'center',inline:'center',behavior:'instant'});const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;const top=e.getRootNode().elementFromPoint?.(x,y)||document.elementFromPoint(x,y);if(top&&top!==e&&!e.contains(top)&&!top.contains(e))throw Error('Element is covered by another element');const options={bubbles:true,cancelable:true,clientX:x,clientY:y,button:a.button==='right'?2:0};
    if(op==='hover'){for(const name of ['pointerover','pointerenter'])e.dispatchEvent(new PointerEvent(name,options));for(const name of ['mouseover','mouseenter','mousemove'])e.dispatchEvent(new MouseEvent(name,options));}
    else if(a.button==='right')e.dispatchEvent(new MouseEvent('contextmenu',options));
    else{e.focus();e.dispatchEvent(new PointerEvent('pointerdown',options));e.dispatchEvent(new MouseEvent('mousedown',options));e.dispatchEvent(new PointerEvent('pointerup',options));e.dispatchEvent(new MouseEvent('mouseup',options));e.click();if(a.double){e.click();e.dispatchEvent(new MouseEvent('dblclick',{...options,detail:2}));}}
    return {dispatched:true,synthetic:true,target:info(e)};
   }
   if(op==='press_key'){
    e.focus();const opts={key:a.key,bubbles:true,cancelable:true,ctrlKey:!!a.ctrl,altKey:!!a.alt,shiftKey:!!a.shift,metaKey:!!a.meta};const allowed=e.dispatchEvent(new KeyboardEvent('keydown',opts));let emulated=false;
    if(allowed&&!a.alt&&!a.meta){
     if(a.ctrl&&a.key.toLowerCase()==='a'&&typeof e.select==='function'){e.select();emulated=true;}
     else if(!a.ctrl&&a.key==='Tab'){const focusable=all('a[href],button,input,textarea,select,[tabindex]').filter(x=>visible(x)&&!x.disabled&&x.tabIndex>=0);const i=focusable.indexOf(e);focusable[(i+(a.shift?-1:1)+focusable.length)%focusable.length]?.focus();emulated=true;}
     else if(!a.ctrl&&a.key==='Enter'&&(e instanceof HTMLButtonElement||e.localName==='a')){e.click();emulated=true;}
     else if(!a.ctrl&&a.key==='Enter'&&e instanceof HTMLInputElement&&e.form){e.form.requestSubmit();emulated=true;}
     else if(!a.ctrl&&a.key===' '&&((e instanceof HTMLButtonElement)||['checkbox','radio'].includes(e.type))){e.click();emulated=true;}
     else if(!a.ctrl&&['Backspace','Delete'].includes(a.key)&&typeof e.selectionStart==='number'){editable(e);let s=e.selectionStart,t=e.selectionEnd;if(s===t){if(a.key==='Backspace')s=Math.max(0,s-1);else t=Math.min(e.value.length,t+1);}e.setSelectionRange(s,t);changeText(e,'',true);emulated=true;}
    }
    e.dispatchEvent(new KeyboardEvent('keyup',opts));return {dispatched:true,synthetic:true,defaultEmulated:emulated};
   }
   throw Error('Unknown page operation');
  }
  return {run};
 })();
}
