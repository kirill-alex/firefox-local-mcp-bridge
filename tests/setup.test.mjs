import {test} from 'node:test';
import assert from 'node:assert/strict';
import {copyFileSync,mkdtempSync,mkdirSync,readFileSync,unlinkSync,rmdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {JSDOM} from 'jsdom';

test('setup generates a local secret, preserves it on rerun and does not print it',()=>{
 const dir=mkdtempSync(join(tmpdir(),'firefox-setup-test-'));const scripts=join(dir,'scripts');mkdirSync(scripts);const script=join(scripts,'setup.mjs');copyFileSync(new URL('../scripts/setup.mjs',import.meta.url),script);
 try{
  const first=spawnSync(process.execPath,[script],{encoding:'utf8',windowsHide:true});assert.equal(first.status,0,first.stderr);
  const config=JSON.parse(readFileSync(join(dir,'config.json')));assert.match(config.token,/^[a-f0-9]{64}$/);assert.ok(!first.stdout.includes(config.token));assert.ok(readFileSync(join(dir,'.local/pairing.html'),'utf8').includes(config.token));
  const second=spawnSync(process.execPath,[script],{encoding:'utf8',windowsHide:true});assert.equal(second.status,0,second.stderr);assert.equal(JSON.parse(readFileSync(join(dir,'config.json'))).token,config.token);
 }finally{for(const file of ['config.json','.local/pairing.html','scripts/setup.mjs'])unlinkSync(join(dir,file));rmdirSync(join(dir,'.local'));rmdirSync(scripts);rmdirSync(dir);}
});
test('extension options store the token locally without embedding one in the package',async()=>{
 const html=readFileSync(new URL('../extension/options.html',import.meta.url),'utf8');const source=readFileSync(new URL('../extension/options.js',import.meta.url),'utf8');const dom=new JSDOM(html,{runScripts:'outside-only'});const {window:w}=dom;let saved=null,notified=false;
 w.browser={storage:{local:{get:async()=>({}),set:async data=>{saved=data;}}},runtime:{sendMessage:async()=>{notified=true;}}};
 try{
  w.eval(source);await new Promise(r=>setTimeout(r,0));const token='ab'.repeat(32);w.document.getElementById('token').value=token;w.document.getElementById('settings').dispatchEvent(new w.Event('submit',{cancelable:true}));await new Promise(r=>setTimeout(r,0));assert.equal(saved.bridgeToken,token);assert.ok(notified);assert.ok(w.document.getElementById('status').textContent.includes('Сохранено'));
  saved=null;w.document.getElementById('token').value='invalid';w.document.getElementById('settings').dispatchEvent(new w.Event('submit',{cancelable:true}));await new Promise(r=>setTimeout(r,0));assert.equal(saved,null);
 }finally{w.close();}
});
