import {readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {root} from './public-files.mjs';
import {checkPublic} from './check-public.mjs';
import {zip} from './zip.mjs';
const files=checkPublic();const output=resolve(process.argv[2]||join(root,'dist/firefox-bridge-source.zip'));
if(files.some(f=>resolve(root,f)===output))throw Error('Source output must not overwrite a project file');
writeFileSync(output,zip(files.map(name=>({name:'firefox-bridge/'+name,data:readFileSync(join(root,name))}))));
console.log('Public source archive: '+output);
