import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {root,publicFiles} from './public-files.mjs';
export function checkPublic(){
 const files=publicFiles();const staged=spawnSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8',windowsHide:true});if(staged.status===0)for(const file of staged.stdout.split('\0').filter(Boolean))if(!files.includes(file))throw Error('Ignored/local file is tracked by Git: '+file);
 for(const file of files){
  if(/(^|\/)(config(?:\..*)?\.json|\.env(?:\..*)?|extensions\.json|prefs\.js|cookies\.sqlite|logins\.json)$/.test(file)||/\.(xpi|sqlite|pem|key|log|zip)$/i.test(file))throw Error('Private or generated file in source: '+file);
  const text=readFileSync(join(root,file),'utf8');
  if(/\b[a-f0-9]{64}\b/i.test(text))throw Error('Possible embedded 256-bit secret in '+file);
  if(/C:[\\/]+Users[\\/]+[a-z0-9]/i.test(text)||/\/Users\/[a-z0-9]/i.test(text))throw Error('Personal absolute path in '+file);
 }
 const manifest=JSON.parse(readFileSync(join(root,'extension/manifest.json')));
 if(manifest.background.scripts.includes('config.js'))throw Error('Extension must not load a generated secret file');
 console.log(`Public-source check passed (${files.length} files).`);return files;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))checkPublic();
