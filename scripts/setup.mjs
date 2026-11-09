import {randomBytes} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url),configPath=new URL('config.json',root),local=new URL('.local/',root);
mkdirSync(local,{recursive:true,mode:0o700});
let config;
if(existsSync(configPath)){
 config=JSON.parse(readFileSync(configPath));
 if(config.port!==17893||! /^[a-f0-9]{64}$/.test(config.token||''))throw Error('Existing config is invalid or uses a different port. Keep a backup before replacing it.');
}else{
 config={port:17893,token:randomBytes(32).toString('hex'),bidiEndpoint:'ws://127.0.0.1:9222/session'};
 writeFileSync(configPath,JSON.stringify(config,null,2)+'\n',{flag:'wx',mode:0o600});
}
writeFileSync(new URL('pairing.html',local),`<!doctype html><meta charset="utf-8"><title>Local Firefox Bridge pairing</title><style>body{font:18px system-ui;max-width:800px;margin:60px auto;padding:20px}code{overflow-wrap:anywhere}p{line-height:1.6}</style><h1>Локальный токен Firefox Bridge</h1><p>Скопируйте в настройки расширения:</p><p><code>${config.token}</code></p><p>Адрес: <code>http://127.0.0.1:17893</code></p><p>Этот файл содержит секрет. Он исключён из Git. Не публикуйте его.</p>`,{mode:0o600});
console.log('Configuration ready. Secret was not printed.');
console.log('Open locally: '+fileURLToPath(new URL('pairing.html',local)));
console.log('Next: npm start, then paste the pairing token into the extension options.');
