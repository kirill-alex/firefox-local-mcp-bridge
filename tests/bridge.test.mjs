import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtempSync,writeFileSync,unlinkSync,rmdirSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import readline from 'node:readline';
import vm from 'node:vm';
import {createBroker} from '../bridge.mjs';
import {tools} from '../tools.mjs';

test('authorized broker round trip and stdio MCP work without a user config',async()=>{
 const config={port:0,token:randomBytes(32).toString('hex')};
 const server=createBroker(config);await new Promise((r,j)=>server.once('error',j).listen(0,'127.0.0.1',r));config.port=server.address().port;
 const directory=mkdtempSync(join(tmpdir(),'firefox-bridge-test-')),configFile=join(directory,'config.json');writeFileSync(configFile,JSON.stringify(config));
 const base=`http://127.0.0.1:${config.port}`,headers={Authorization:`Bearer ${config.token}`,'Content-Type':'application/json'};
 const post=(path,data)=>fetch(base+path,{method:'POST',headers,body:JSON.stringify(data)});
 let child;
 try{
  assert.equal((await fetch(base+'/status')).status,401);
  assert.equal((await fetch(base+'/status',{headers:{...headers,Origin:'https://evil.example'}})).status,403);
  assert.equal((await post('/call',{name:'arbitrary_code',arguments:{}})).status,400);
  assert.equal((await post('/call',{name:'firefox_read_tab',arguments:{tabId:-1}})).status,400);
  assert.equal((await post('/call',{name:'firefox_list_tabs',arguments:{}})).status,503);
  const poll=fetch(base+'/poll',{headers}).then(r=>r.json());
  // Wait for the actual poll registration rather than a timing assumption.
  for(let i=0;i<100;i++){if((await(await fetch(base+'/status',{headers})).json()).connected)break;await new Promise(r=>setTimeout(r,10));}
  const response=post('/call',{name:'firefox_read_tab',arguments:{tabId:7}});const {command}=await poll;assert.equal(command.arguments.tabId,7);await post('/result',{id:command.id,result:{text:'Привет'}});assert.equal((await(await response).json()).result.text,'Привет');
  child=spawn(process.execPath,[fileURLToPath(new URL('../bridge.mjs',import.meta.url))],{stdio:['pipe','pipe','inherit'],windowsHide:true,env:{...process.env,FIREFOX_BRIDGE_CONFIG:configFile}});
  const messages=new Map(),waiters=new Map();const lines=readline.createInterface({input:child.stdout});lines.on('line',line=>{const m=JSON.parse(line);messages.set(m.id,m);waiters.get(m.id)?.(m);});
  async function rpc(id,method,params){child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');return new Promise((res,rej)=>{const timer=setTimeout(()=>rej(Error('MCP timeout')),5000);const done=m=>{clearTimeout(timer);res(m);};if(messages.has(id))done(messages.get(id));else waiters.set(id,done);});}
  assert.equal((await rpc(1,'initialize',{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'test',version:'1'}})).result.serverInfo.name,'firefox-bridge');
  assert.equal((await rpc(2,'tools/list')).result.tools.length,tools.length);
  assert.equal((await rpc(3,'tools/call',{name:'firefox_read_tab',arguments:{tabId:'x'}})).result.isError,true);
  assert.equal((await rpc(4,'unknown')).error.code,-32601);
  child.stdin.end();await new Promise(r=>child.once('exit',r));child=null;
 }finally{child?.kill();server.closeAllConnections();await new Promise(r=>server.close(r));unlinkSync(configFile);rmdirSync(directory);}
});
test('extension excludes private and unloaded tabs',async()=>{
 const source=readFileSync(new URL('../extension/background.js',import.meta.url),'utf8').split('browser.runtime.onMessage.addListener')[0];
 const browser={tabs:{get:async id=>({id,url:'https://example.com',incognito:id===99,discarded:id===88}),query:async()=>[{id:7,title:'Тест',url:'https://example.com'},{id:99,incognito:true}],executeScript:async(id,{code})=>[vm.runInNewContext(code,{document:{title:'Тест',body:{innerText:'Начало Привет мир'}},location:{href:'https://example.com'}})]}};
 const context=vm.createContext({browser,setTimeout});vm.runInContext(source,context);assert.equal((await vm.runInContext('listTabs()',context)).length,1);assert.equal((await vm.runInContext('readTab(7,7,6)',context)).text,'Привет');await assert.rejects(vm.runInContext('readTab(99)',context),/Private/);await assert.rejects(vm.runInContext('readTab(88)',context),/unloaded/);
});
