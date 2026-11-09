import {test} from 'node:test';
import assert from 'node:assert/strict';
import {flattenNodes,inspectSyncShare} from '../syncshare.mjs';
const t=value=>({type:'node',value:{nodeType:3,nodeValue:value}});
const n=(id,tag,attrs,children=[],shadowRoot)=>({type:'node',sharedId:id,value:{nodeType:1,localName:tag,attributes:attrs,children,shadowRoot}});
const menu=n('menu','ul',{class:'syncshare-cm',hidden:''},[n('item','li',{class:'menu-item'},[t('Пока нет ответов')]),n('docs','li',{class:'menu-item'},[t('Документация')])]);
const question=n('question','div',{id:'question-1-1'},[],{type:'node',sharedId:'shadow1',value:{nodeType:11,mode:'closed',children:[n('widget','span',{class:'icon'})]}});
const body=n('body','body',{},[question],{type:'node',sharedId:'shadow2',value:{nodeType:11,mode:'closed',children:[menu]}});
function mock(url='https://online.mospolytech.ru/mod/quiz/attempt.php?attempt=1'){return {ensureContext:async()=>({url}),evaluate:async()=>[{id:'question-1-1',text:'Test question'}],rpc:async(method,p)=>{assert.equal(p.serializationOptions.includeShadowTree,'all');return {type:'success',result:{type:'array',value:[question,body]}};}};}
test('closed Shadow DOM and duplicate serialized nodes are traversed correctly',()=>{
 const records=flattenNodes({type:'array',value:[question,body]});assert.equal(records.filter(e=>e.node.sharedId==='widget').length,1);assert.equal(records.find(e=>e.node.sharedId==='widget').questionId,'question-1-1');assert.ok(records.some(e=>e.node.sharedId==='menu'));
});
test('SyncShare read reports missing answers without applying anything',async()=>{
 const b=mock();const result=await inspectSyncShare(b,'context');assert.equal(result.status,'no_answers');assert.equal(result.questions[0].text,'Test question');assert.equal(result.widgets.length,1);assert.equal(result.menus[0].items[0].label,'Пока нет ответов');assert.equal(result.menus[0].hidden,true);assert.ok(result.untrustedContent);
});
test('SyncShare integration is scoped to the requested Moodle test pages',async()=>{
 for(const url of ['https://example.com/mod/quiz/attempt.php','https://online.mospolytech.ru/course/view.php','http://online.mospolytech.ru/mod/quiz/attempt.php'])await assert.rejects(inspectSyncShare(mock(url),'c'),/restricted/);
});
