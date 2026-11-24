/* Encrypted snapshot viewer. Passwords, ranked text and exports remain in memory. */
(()=>{
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const HOUR=3600000, DAY=24*HOUR, WINDOW=12*HOUR, MAX_AGE=DAY;
 const scheduleLabel='토·일 07:00 KST';
 const expiredMessage='수집 결과가 만료되었습니다. 재수집 실행으로 새 결과를 받아주세요.';
 const template=/보고\s*서\s*명\s*[:：]/u;
 const formatDate=value=>{
   const d=new Date(value);if(!Number.isFinite(d.getTime()))return '미제공';
   const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(d);
   const parts=Object.fromEntries(p.map(x=>[x.type,x.value]));
   return parts.year+'.'+parts.month+'.'+parts.day+' '+parts.hour+':'+parts.minute+':'+parts.second+' KST';
 };
 const panel=document.createElement('section');panel.id='telegram-page';panel.className='hidden card';
 panel.innerHTML='<div class="head"><h2>텔레그램</h2><div class="tools"><a class="button" href="https://github.com/dldmlwls581-prog/ujlee-invest/actions/workflows/telegram.yml" target="_blank" rel="noreferrer">재수집 실행 · GitHub ↗</a><button class="button" type="button" id="telegram-reload">새 결과 열기</button><button class="button hidden" type="button" id="telegram-copy">1~30위 전체 복사</button></div></div><p class="brief-source">자동 수집 '+scheduleLabel+' · 수동 수집은 GitHub에서 Run workflow. 완료 후 새 결과 열기를 누르고 비밀번호를 다시 입력하세요.</p><p>수집 시점 기준 최근 12시간 · 투자 이슈 최대 30개</p><form id="telegram-unlock"><label>비밀번호 <input type="password" id="telegram-password" autocomplete="off" required></label> <button class="button" type="submit">열기</button></form><p id="telegram-status" role="status"></p><p id="telegram-copy-status" class="brief-source" role="status" aria-live="polite"></p><textarea id="telegram-copy-fallback" aria-label="복사할 텔레그램 전체 내용" readonly hidden></textarea><button class="button hidden" id="telegram-lock" title="현재 화면의 내용을 지우고 비밀번호 입력 화면으로 돌아갑니다. 자동 수집은 계속됩니다.">화면 잠그기</button><p class="brief-source">화면 잠금은 현재 브라우저의 내용만 지웁니다. 자동 수집은 계속됩니다.</p><div id="telegram-results"></div>';
 document.getElementById('news-page').after(panel);
 const nav=document.getElementById('newsroom-nav');
 const link=document.createElement('a');link.href='#/telegram';link.className='nav-link';link.textContent='▤　텔레그램';nav.after(link);
 const mobile=document.querySelector('.mobile-nav');if(mobile)mobile.append(link.cloneNode(true));
 const status=document.getElementById('telegram-status'),results=document.getElementById('telegram-results'),form=document.getElementById('telegram-unlock'),lock=document.getElementById('telegram-lock'),copy=document.getElementById('telegram-copy'),copyStatus=document.getElementById('telegram-copy-status'),fallback=document.getElementById('telegram-copy-fallback');
 let epoch=0,expiryTimer,activePayload=null,ranked=[];
 function clear(){
   clearInterval(expiryTimer);epoch++;activePayload=null;ranked=[];
   results.replaceChildren();fallback.value='';fallback.hidden=true;copyStatus.textContent='';
   document.getElementById('telegram-password').value='';form.hidden=false;
   lock.classList.add('hidden');copy.classList.add('hidden');copy.disabled=true;status.textContent='';
 }
 function nextSlot(value){
   const ms=Date.parse(value),day=new Date(ms+9*HOUR).toISOString().slice(0,10);
   let slot=Date.parse(day+'T07:00:00+09:00');
   while(slot<=ms||![0,6].includes(new Date(slot+9*HOUR).getUTCDay()))slot+=DAY;
   return slot;
 }
 function describe(payload,withReminder=true){
   let text='수집 완료: '+formatDate(payload.updatedAt);
   if(payload.collectionStartedAt)text+=' · 시작: '+formatDate(payload.collectionStartedAt);
   text+='\n수집 구간: '+formatDate(payload.since)+' ~ '+formatDate(payload.until)+' (12시간)';
   text+='\n자동 수집: '+scheduleLabel;
   if(payload.scheduledFor)text+=' · 해당 예약: '+formatDate(payload.scheduledFor);
   else if(payload.trigger==='workflow_dispatch')text+=' · 이번 결과는 수동 수집';
   if(withReminder&&Date.now()>nextSlot(payload.updatedAt)+30*60000)text+='\n다음 예약 시간이 지났습니다. 새 결과 열기로 최신 수집 여부를 확인하세요.';
   return text;
 }
 function exportText(){
   if(!activePayload||!ranked.length)return '';
   const lines=['UJLEE INVEST | 텔레그램 투자 이슈 TOP '+ranked.length,describe(activePayload,false),''];
   ranked.forEach((x,i)=>{
     lines.push((i+1)+'. '+x.title,x.channelCount+'개 채널 · '+x.mentionCount+'회 언급');
     x.members.forEach((m,j)=>{lines.push('[관련 원문 '+(j+1)+'] '+(m.channel||'출처 미제공')+' · '+formatDate(m.date),String(m.text||''));const url=m.link||m.url;if(url)lines.push(String(url));lines.push('');});
     lines.push('────────────────────────','');
   });
   return lines.join('\n');
 }
 copy.onclick=async()=>{
   if(activePayload&&Date.now()>=Math.min(Date.parse(activePayload.expiresAt),Date.parse(activePayload.updatedAt)+MAX_AGE)){clear();status.textContent=expiredMessage;return;}
   const run=epoch,text=exportText();if(!text)return;
   copy.disabled=true;fallback.hidden=true;fallback.value='';copyStatus.textContent='';
   try{
     if(!navigator.clipboard?.writeText)throw Error('clipboard');
     await navigator.clipboard.writeText(text);
     if(run===epoch)copyStatus.textContent=ranked.length+'개 이슈의 전체 원문과 수집 날짜·시간을 복사했습니다.';
   }catch(error){
     if(run!==epoch)return;
     fallback.value=text;fallback.hidden=false;fallback.focus();fallback.select();
     copyStatus.textContent='브라우저에서 자동 복사를 허용하지 않았습니다. 선택된 전체 내용을 복사하세요 (⌘C / Ctrl+C).';
   }finally{if(run===epoch)copy.disabled=!ranked.length;}
 };
 lock.onclick=()=>{clear();status.textContent='화면을 잠갔습니다. 다시 보려면 비밀번호를 입력하세요.';};
 document.getElementById('telegram-reload').onclick=()=>{clear();status.textContent='비밀번호를 입력하면 최신 발행 결과를 가져옵니다.';document.getElementById('telegram-password').focus();};
 window.addEventListener('pagehide',clear);
 window.telegramRoute=()=>{
   const yes=location.hash==='#/telegram';panel.classList.toggle('hidden',!yes);link.classList.toggle('active',yes);
   if(!yes){clear();return false;}
   document.getElementById('market-page').classList.add('hidden');document.getElementById('news-page').classList.add('hidden');
   document.querySelectorAll('.nav-link').forEach(a=>a.classList.toggle('active',a.getAttribute('href')==='#/telegram'));
   const sub=document.getElementById('page-sub');if(sub)sub.textContent='수집 시점 기준 최근 12시간 · 투자 이슈 TOP 30';
   const h=document.getElementById('page-title');if(h)h.textContent='텔레그램';
   return true;
 };
 form.onsubmit=async e=>{
   e.preventDefault();let password=document.getElementById('telegram-password').value;clear();const run=epoch;
   status.textContent='암호화된 결과를 확인하고 있습니다.';
   try{
     const response=await fetch('data/telegram.enc.json',{cache:'no-store'});if(!response.ok)throw Error('missing');
     const data=await response.json();if(data.version!==1||data.iterations!==600000)throw Error('format');
     const bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
     const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);password='';
     const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:bytes(data.salt),iterations:data.iterations,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['decrypt']);
     const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(data.iv),additionalData:new TextEncoder().encode('ujlee-telegram-v1')},key,bytes(data.ciphertext));
     const payload=JSON.parse(new TextDecoder().decode(plain));if(run!==epoch)return;
     const now=Date.now(),updated=Date.parse(payload.updatedAt),expires=Math.min(Date.parse(payload.expiresAt),updated+MAX_AGE);
     if(!Number.isFinite(updated)||!Number.isFinite(expires)||updated>now+300000||now>=expires)throw Error('expired');
     const until=Date.parse(payload.until||payload.updatedAt),since=Date.parse(payload.since||new Date(until-WINDOW).toISOString());
     if(!Number.isFinite(since)||!Number.isFinite(until)||until>updated+1000||Math.abs(until-since-WINDOW)>1000||!Array.isArray(payload.items))throw Error('format');
     activePayload={...payload,since:new Date(since).toISOString(),until:new Date(until).toISOString()};
     ranked=payload.items.map(x=>{
       const members=(Array.isArray(x.members)?x.members:[]).filter(m=>!template.test(m.text||'')&&Number.isFinite(Date.parse(m.date))&&Date.parse(m.date)>=since&&Date.parse(m.date)<=until).sort((a,b)=>Date.parse(b.date)-Date.parse(a.date));
       return {...x,members,channelCount:new Set(members.map(m=>m.chatId)).size,mentionCount:members.length,excerpt:members[0]?.text.slice(0,450)||''};
     }).filter(x=>x.channelCount>=2&&!template.test(x.title||'')).sort((a,b)=>b.channelCount-a.channelCount||b.mentionCount-a.mentionCount).slice(0,30);
     results.innerHTML=ranked.map((x,i)=>'<article class="card"><h3>'+escape(i+1)+'. '+escape(x.title)+'</h3><p>'+escape(x.channelCount)+'개 채널 · '+escape(x.mentionCount)+'회 언급</p><p>'+escape(x.excerpt)+'</p><details><summary>관련 원문</summary>'+x.members.map(m=>'<p><strong>'+escape(m.channel)+'</strong> · '+escape(formatDate(m.date))+'</p><p>'+escape(m.text)+'</p>').join('')+'</details></article>').join('')||'<p>조건에 맞는 반복 이슈가 없습니다.</p>';
     status.textContent=describe(activePayload);status.style.whiteSpace='pre-line';
     expiryTimer=setInterval(()=>{if(Date.now()>=expires){clear();status.textContent=expiredMessage;}else if(activePayload){status.textContent=describe(activePayload);}},30000);
     form.hidden=true;lock.classList.remove('hidden');copy.disabled=!ranked.length;copy.textContent=ranked.length?'1~'+ranked.length+'위 전체 복사':'전체 복사';copy.classList.remove('hidden');
   }catch(error){if(run===epoch){clear();status.textContent=error.message==='expired'?expiredMessage:error.message==='missing'?'아직 서버 수집 결과가 게시되지 않았습니다.':'비밀번호가 맞지 않거나 데이터를 열 수 없습니다.';}}finally{password='';}
 };
 if(location.hash==='#/telegram')window.telegramRoute();
})();
