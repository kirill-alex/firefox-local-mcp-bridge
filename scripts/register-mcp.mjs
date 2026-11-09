import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const result=spawnSync(process.platform==='win32'?'codex.exe':'codex',['mcp','add','firefox-bridge','--',process.execPath,fileURLToPath(new URL('../bridge.mjs',import.meta.url))],{stdio:'inherit',windowsHide:true});
if(result.error)throw result.error;
process.exitCode=result.status??1;
