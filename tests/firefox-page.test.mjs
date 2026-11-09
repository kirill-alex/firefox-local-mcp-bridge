import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {tools,validArgs} from '../tools.mjs';
const source=readFileSync('extension/page.js','utf8');
function page(){
 const dom=new JSDOM('<h1>Тест</h1><label>Имя<input id="name"></label><button id="button">Кнопка</button><input id="password" type="password"><input id="check" type="checkbox"><select id="select"><option value="a">A</option><option value="b">B</option></select><div id="editor" contenteditable="true"></div>',{url:'https://example.test/',runScripts:'outside-only'});
 const w=dom.window;w.HTMLElement.prototype.getClientRects=function(){return this.hidden?[]:[{x:0,y:0,width:20,height:20}];};w.HTMLElement.prototype.getBoundingClientRect=()=>({x:0,y:0,width:20,height:20});w.HTMLElement.prototype.scrollIntoView=()=>{};w.document.elementFromPoint=()=>null;w.eval(source);return {w,run:(op,a={})=>w.__codexFirefoxPageV2.run(op,a),close:()=>w.close()};
}
test('schema rejects malformed calls and identifies writes',()=>{
 assert.ok(tools.length>=27);assert.throws(()=>validArgs('firefox_fill',{tabId:1,text:33}));assert.throws(()=>validArgs('firefox_click',{tabId:1,unknown:true}));assert.throws(()=>validArgs('firefox_wait',{tabId:1,timeoutMs:30000}));assert.throws(()=>validArgs('firefox_read_tab',{tabId:1,maxChars:NaN}));
 validArgs('firefox_fill',{tabId:1,frameId:4294967297,text:'Тест'});
 assert.equal(tools.find(t=>t.name==='firefox_click').annotations.readOnlyHint,false);
 assert.equal(tools.find(t=>t.name==='firefox_evaluate').annotations.readOnlyHint,false);
});
test('snapshot refs reject stale snapshots and detached targets',async()=>{
 const p=page();try{const s=await p.run('snapshot');const button=s.elements.find(e=>e.tag==='button');await p.run('click',{ref:button.ref,snapshotId:s.snapshotId});await p.run('snapshot');await assert.rejects(p.run('click',{ref:button.ref,snapshotId:s.snapshotId}),/Stale/);const s2=await p.run('snapshot');const ref=s2.elements.find(e=>e.tag==='button').ref;p.w.document.querySelector('#button').remove();await assert.rejects(p.run('click',{ref,snapshotId:s2.snapshotId}),/detached/);}finally{p.close();}
});
test('fill events, cancellation, insertion, keyboard selection, readonly and passwords',async()=>{
 const p=page();try{const input=p.w.document.querySelector('#name');let changes=0;input.addEventListener('input',()=>changes++);await p.run('fill',{selector:'#name',text:'Привет'});input.setSelectionRange(6,6);await p.run('type',{selector:'#name',text:' мир'});assert.equal(input.value,'Привет мир');assert.equal(changes,2);await p.run('press_key',{selector:'#name',key:'a',ctrl:true});await p.run('type',{selector:'#name',text:'Замена'});assert.equal(input.value,'Замена');input.addEventListener('beforeinput',e=>e.preventDefault(),{once:true});await p.run('fill',{selector:'#name',text:'Отмена'});assert.equal(input.value,'Замена');input.readOnly=true;await assert.rejects(p.run('fill',{selector:'#name',text:'x'}),/read-only/);await assert.rejects(p.run('fill',{selector:'#password',text:'secret'}),/Password/);}finally{p.close();}
});
test('selectors must be unique; select options validated; checkbox state',async()=>{
 const p=page();try{await assert.rejects(p.run('click',{selector:'input'}),/exactly one/);await p.run('select',{selector:'#select',values:['b']});assert.equal(p.w.document.querySelector('#select').value,'b');await assert.rejects(p.run('select',{selector:'#select',values:['missing']}),/missing/);await p.run('check',{selector:'#check',checked:true});assert.equal(p.w.document.querySelector('#check').checked,true);}finally{p.close();}
});
test('open shadow DOM is inspectable and hidden elements excluded',async()=>{
 const p=page();try{const host=p.w.document.createElement('div');p.w.document.body.append(host);host.attachShadow({mode:'open'}).innerHTML='<button id="shadow">Shadow</button>';assert.equal((await p.run('query',{selector:'#shadow'})).count,1);p.w.document.querySelector('#button').hidden=true;assert.ok(!(await p.run('snapshot')).elements.some(e=>e.name==='Кнопка'));}finally{p.close();}
});
