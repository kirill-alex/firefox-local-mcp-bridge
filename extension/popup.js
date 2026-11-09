async function refresh(){const s=await browser.runtime.sendMessage({type:'status'});document.getElementById('status').textContent=s.paused?'Доступ приостановлен':s.connected?'Локальный сервер подключён':`Ожидание локального сервера. ${s.lastError}`;document.getElementById('toggle').textContent=s.paused?'Возобновить':'Пауза';}
document.getElementById('toggle').addEventListener('click',async()=>{await browser.runtime.sendMessage({type:'toggle'});await refresh();});
document.getElementById('options').addEventListener('click',()=>browser.runtime.openOptionsPage());
refresh();setInterval(refresh,1500);
