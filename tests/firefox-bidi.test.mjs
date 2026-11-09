import {test} from 'node:test';
import assert from 'node:assert/strict';
import {FirefoxBiDi,keyActions} from '../bidi.mjs';
class MockBiDi extends FirefoxBiDi{
 constructor(){super();this.calls=[];this.session={capabilities:{browserName:'firefox',browserVersion:'test'}};}
 async connect(){}
 async ensureContext(){}
 async evaluate(context,expression){this.calls.push({method:'evaluate',context,expression});if(expression.includes('scrollIntoView'))return {x:10,y:20};return true;}
 async rpc(method,params){this.calls.push({method,params});if(method==='session.subscribe')return {subscription:'s1'};if(method==='browsingContext.create')return {context:'c1'};return {};}
}
test('loopback endpoint and key chords are validated',()=>{
 assert.throws(()=>new FirefoxBiDi('ws://example.com:9222/session'),/127/);
 assert.throws(()=>new FirefoxBiDi('ws://127.0.0.1:9222/other'),/127/);
 assert.throws(()=>keyActions('Control+NotAKey'),/Unknown/);
 const k=keyActions('Control+a');assert.equal(k.length,4);assert.equal(k[0].value,'\uE009');assert.equal(k[3].type,'keyUp');
});
test('native pointer and keyboard calls release pressed inputs',async()=>{
 const b=new MockBiDi();await b.run('firefox_bidi_click',{contextId:'c',selector:'#x'});
 const input=b.calls.find(c=>c.method==='input.performActions');assert.equal(input.params.actions[0].type,'pointer');assert.deepEqual(input.params.actions[0].actions.map(a=>a.type),['pointerMove','pointerDown','pointerUp']);assert.equal(b.calls.at(-1).method,'input.releaseActions');
 assert.ok(!b.calls.some(c=>c.method==='browsingContext.activate'));
 b.calls=[];await b.run('firefox_bidi_type',{contextId:'c',text:'А😀',replace:true});const keys=b.calls.find(c=>c.method==='input.performActions').params.actions[0].actions;assert.ok(keys.some(k=>k.value==='😀'));assert.ok(keys.some(k=>k.value==='\uE009'));
});
test('unconfirmed activation returns bounded status and does not poison queue',async()=>{
 const b=new MockBiDi();const rpc=b.rpc.bind(b);b.rpc=async(method,params,timeout)=>{if(method==='browsingContext.activate'){assert.equal(timeout,1500);throw Error('browsingContext.activate timed out');}return rpc(method,params);};
 assert.equal((await b.run('firefox_bidi_activate',{contextId:'c'})).confirmed,false);
 assert.equal((await b.run('firefox_bidi_click',{contextId:'c',x:1,y:2})).completed,true);
});
test('hidden-page scroll fallback is explicit; native and visible pages do not fall back',async()=>{
 for(const [mode,visibility,expected]of [['auto','hidden','dom-fallback'],['native','hidden','native'],['auto','visible','native'],['dom','hidden','dom']]){
  const b=new MockBiDi();let fallbackCalls=0;b.evaluate=async(_context,expression)=>{const perform=/,true\)$/.test(expression);if(perform)fallbackCalls++;return {positions:[],visibility,changed:perform};};
  const r=await b.run('firefox_bidi_scroll',{contextId:'c',x:1,y:1,deltaY:50,mode});assert.equal(r.mode,expected);assert.equal(fallbackCalls,expected==='native'?0:1);assert.equal(r.moved,expected!=='native');
 }
});
test('pause blocks commands and monitors redact cookies/bodies',async()=>{
 const b=new MockBiDi();await b.run('firefox_bidi_pause',{paused:true});await assert.rejects(b.run('firefox_bidi_click',{contextId:'c',x:1,y:2}),/paused/);await b.run('firefox_bidi_pause',{paused:false});
 await b.run('firefox_bidi_monitor',{contextId:'c',enabled:true});
 b.record({method:'network.responseCompleted',params:{context:'c',request:{request:'r',url:'https://example.com',method:'GET',cookies:['secret']},response:{status:200,headers:['secret'],body:'secret'}}});
 b.record({method:'log.entryAdded',params:{source:{context:'other'},text:'Unmonitored'}});
 const result=await b.run('firefox_bidi_events');assert.equal(result.events.length,1);assert.equal(result.events[0].status,200);assert.ok(!JSON.stringify(result).includes('secret'));assert.ok(!JSON.stringify(result).includes('Unmonitored'));
 await b.run('firefox_bidi_monitor',{contextId:'c',enabled:false});assert.equal(b.calls.at(-1).method,'session.unsubscribe');
});
test('open tab uses background create and rejects javascript navigation',async()=>{
 const b=new MockBiDi();const result=await b.run('firefox_bidi_open',{url:'https://example.com'});assert.equal(result.contextId,'c1');assert.equal(b.calls[0].params.background,true);await assert.rejects(b.run('firefox_bidi_navigate',{contextId:'c',url:'javascript:alert(1)'}),/HTTP/);
});
test('prompt handling bypasses a script blocked by a JavaScript dialog',async()=>{
 const b=new MockBiDi();b.queue=new Promise(()=>{});await b.run('firefox_bidi_handle_prompt',{contextId:'c',accept:false});assert.equal(b.calls.at(-1).method,'browsingContext.handleUserPrompt');assert.equal(b.calls.at(-1).params.accept,false);
});
