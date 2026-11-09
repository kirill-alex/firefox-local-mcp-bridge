const tokenInput=document.getElementById('token');
(async()=>{const {bridgeToken}=await browser.storage.local.get('bridgeToken');tokenInput.value=bridgeToken||'';})();
document.getElementById('settings').addEventListener('submit',async e=>{
 e.preventDefault();const token=tokenInput.value.trim();const status=document.getElementById('status');
 if(!/^[a-f0-9]{64}$/.test(token)){status.textContent='Нужен токен из 64 строчных шестнадцатеричных символов.';return;}
 try{await browser.storage.local.set({bridgeToken:token});await browser.runtime.sendMessage({type:'connection_changed'});status.textContent='Сохранено. Соединение будет установлено автоматически.';}catch(error){status.textContent=error.message;}
});
