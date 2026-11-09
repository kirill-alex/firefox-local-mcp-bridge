import {readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
export const root=fileURLToPath(new URL('../',import.meta.url));
export const excluded=new Set(['.git','node_modules','.local','dist','config.json','extension/config.js']);
export function publicFiles(dir=root,prefix=''){
 const files=[];for(const entry of readdirSync(dir,{withFileTypes:true})){const name=prefix+entry.name;if(excluded.has(name)||excluded.has(entry.name)||entry.name.endsWith('.log'))continue;if(entry.isSymbolicLink())throw Error('Symlinks are not supported in release archives: '+name);if(entry.isDirectory())files.push(...publicFiles(join(dir,entry.name),name+'/'));else if(entry.isFile())files.push(name);}return files.sort();
}
