import {test} from 'node:test';
import assert from 'node:assert/strict';
import {zip,crc32} from '../scripts/zip.mjs';
test('ZIP stores UTF-8 names, byte lengths and CRC32; rejects traversal',()=>{
 const data=Buffer.from('Привет');const result=zip([{name:'тест.txt',data}]);assert.equal(result.readUInt32LE(0),0x04034b50);assert.equal(result.readUInt32LE(18),data.length);assert.equal(result.readUInt32LE(14),crc32(data));const length=result.readUInt16LE(26);assert.equal(result.subarray(30,30+length).toString(),'тест.txt');assert.deepEqual(result.subarray(30+length,30+length+data.length),data);assert.equal(result.readUInt32LE(result.length-22),0x06054b50);assert.equal(crc32(Buffer.from('123456789')),0xcbf43926);assert.throws(()=>zip([{name:'../secret',data}]),/Unsafe/);
});
