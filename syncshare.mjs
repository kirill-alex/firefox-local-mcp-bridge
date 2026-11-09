import {randomUUID} from 'node:crypto';
export function flattenNodes(remote,questionId=null,result=[],seen=new Set()){
 if(!remote||typeof remote!=='object')return result;
 if(remote.type==='array'){for(const child of remote.value||[])flattenNodes(child,questionId,result,seen);return result;}
 if(remote.type!=='node')return result;
 if(remote.sharedId&&seen.has(remote.sharedId))return result;
 if(remote.sharedId)seen.add(remote.sharedId);
 const v=remote.value||{},attrs=v.attributes||{};
 if(attrs.id?.startsWith('question-'))questionId=attrs.id;
 result.push({node:remote,questionId});
 for(const child of v.children||[])flattenNodes(child,questionId,result,seen);
 if(v.shadowRoot)flattenNodes(v.shadowRoot,questionId,result,seen);
 return result;
}
function classes(node){return (node.value?.attributes?.class||'').split(/\s+/);}
function text(node){const v=node.value||{};if(v.nodeType===3)return v.nodeValue||'';return (v.children||[]).map(text).join('');}
export async function inspectSyncShare(bidi,contextId){
 const context=await bidi.ensureContext(contextId);const url=new URL(context.url);
 if(url.origin!=='https://online.mospolytech.ru'||!/^\/mod\/quiz\/(attempt|review)\.php$/.test(url.pathname))throw Error('SyncShare adapter is restricted to Moodle tests at online.mospolytech.ru');
 const questions=await bidi.evaluate(contextId,`Array.from(document.querySelectorAll('.que')).map(q=>({id:q.id,text:q.querySelector('.qtext')?.innerText||'',type:q.classList[1]}))`);
 const r=await bidi.rpc('script.evaluate',{expression:"Array.from(document.querySelectorAll('.que')).concat([document.body])",target:{context:contextId},awaitPromise:false,resultOwnership:'none',serializationOptions:{includeShadowTree:'all',maxDomDepth:9,maxObjectDepth:1}});
 if(r.type==='exception')throw Error('Cannot inspect SyncShare DOM: '+r.exceptionDetails.text);
 const flat=flattenNodes(r.result);const snapshotId=randomUUID();const refs=new Map();let counter=0;
 const keep=(node,kind,questionId)=>{const ref='ss'+(++counter);refs.set(ref,{sharedId:node.sharedId,kind,questionId});return ref;};
 const widgets=flat.filter(({node,questionId})=>questionId&&classes(node).includes('icon')&&node.sharedId).map(({node,questionId})=>({ref:keep(node,'widget',questionId),questionId,label:node.value.attributes?.title||node.value.attributes?.['aria-label']||text(node).trim(),svg:text(node).trim()}));
 const menus=flat.filter(({node})=>classes(node).includes('syncshare-cm')).map(({node})=>({ref:keep(node,'menu',null),items:flattenNodes(node).filter(({node})=>classes(node).includes('menu-item')).map(({node})=>({ref:keep(node,'item',null),label:text(node).trim().slice(0,2000)})),hidden:Object.hasOwn(node.value?.attributes||{},'hidden')}));
 bidi.syncshareSnapshot={snapshotId,contextId,url:context.url,refs,questions};
 const noAnswers=menus.length>0&&menus.every(m=>m.items.some(i=>/^(Пока нет ответов|No answers yet)$/i.test(i.label)));
 return {snapshotId,questions,widgets,menus,available:widgets.length>0||menus.length>0,status:noAnswers?'no_answers':menus.length?'unclassified_hints':'not_found',association:questions.length===1?'single_question_page':'menus_not_automatically_paired_to_questions',source:'installed SyncShare DOM',untrustedContent:true};
}
