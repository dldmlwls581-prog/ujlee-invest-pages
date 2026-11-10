/* Encrypted snapshot viewer. No password or decrypted data is persisted. */
(()=>{
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const panel=document.createElement('section');panel.id='telegram-page';panel.className='hidden card';
 panel.innerHTML='<div class="head"><h2>텔레그램</h2><div class="tools"><a class="button" href="https://github.com/dldmlwls581-prog/ujlee-invest/actions/workflows/telegram.yml" target="_blank" rel="noreferrer">재수집 실행 · GitHub ↗</a><button class="button" type="button" id="telegram-reload">새 결과 열기</button></div></div><p class="brief-source">재수집 실행 → GitHub의 Run workflow → Run workflow. 완료 후 새 결과 열기를 누르고 비밀번호를 다시 입력하세요.</p><p>최근 24시간 · 반복적으로 다뤄진 투자 이슈 최대 30개</p><form id="telegram-unlock"><label>비밀번호 <input type="password" id="telegram-password" autocomplete="off" required></label> <button class="button" type="submit">열기</button></form><p id="telegram-status" role="status"></p><button class="button hidden" id="telegram-lock" title="현재 화면의 내용을 지우고 비밀번호 입력 화면으로 돌아갑니다. 자동 수집은 계속됩니다.">화면 잠그기</button><p class="brief-source">화면 잠금은 현재 브라우저의 내용만 지웁니다. 자동 수집은 계속됩니다.</p><div id="telegram-results"></div>';
 document.getElementById('news-page').after(panel);
 const nav=document.getElementById('newsroom-nav');
 const link=document.createElement('a');link.href='#/telegram';link.className='nav-link';link.textContent='▤　텔레그램';nav.after(link);
 const mobile=document.querySelector('.mobile-nav');if(mobile)mobile.append(link.cloneNode(true));
 const status=document.getElementById('telegram-status'),results=document.getElementById('telegram-results'),form=document.getElementById('telegram-unlock'),lock=document.getElementById('telegram-lock');
 let epoch=0,expiryTimer;
 function clear(){clearInterval(expiryTimer);epoch++;results.replaceChildren();document.getElementById('telegram-password').value='';form.hidden=false;lock.classList.add('hidden');status.textContent='';}
 lock.onclick=()=>{clear();status.textContent='화면을 잠갔습니다. 다시 보려면 비밀번호를 입력하세요.';};document.getElementById('telegram-reload').onclick=()=>{clear();status.textContent='비밀번호를 입력하면 최신 발행 결과를 가져옵니다.';document.getElementById('telegram-password').focus();};window.addEventListener('pagehide',clear);
 window.telegramRoute=()=>{
   const yes=location.hash==='#/telegram';panel.classList.toggle('hidden',!yes);link.classList.toggle('active',yes);
   if(!yes){clear();return false;}
   document.getElementById('market-page').classList.add('hidden');document.getElementById('news-page').classList.add('hidden');
   document.querySelectorAll('.nav-link').forEach(a=>a.classList.toggle('active',a.getAttribute('href')==='#/telegram'));
   const sub=document.getElementById('page-sub');if(sub)sub.textContent='최근 24시간 · 투자 이슈 TOP 30';
   const h=document.getElementById('page-title');if(h)h.textContent='텔레그램';
   return true;
 };
 form.onsubmit=async e=>{
   e.preventDefault();const run=++epoch;let password=document.getElementById('telegram-password').value;document.getElementById('telegram-password').value='';
   status.textContent='암호화된 결과를 확인하고 있습니다.';
   try{
     const response=await fetch('data/telegram.enc.json',{cache:'no-store'});if(!response.ok)throw Error('missing');
     const data=await response.json();if(data.version!==1||data.iterations!==600000)throw Error('format');
     const bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
     const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);password='';
     const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:bytes(data.salt),iterations:data.iterations,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['decrypt']);
     const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(data.iv),additionalData:new TextEncoder().encode('ujlee-telegram-v1')},key,bytes(data.ciphertext));
     const payload=JSON.parse(new TextDecoder().decode(plain));if(run!==epoch)return;
     const now=Date.now(),updated=Date.parse(payload.updatedAt),expires=Math.min(Date.parse(payload.expiresAt),updated+13*3600000);
     if(!Number.isFinite(updated)||!Number.isFinite(expires)||updated>now+300000||now>=expires)throw Error('expired');
     function renderResults(){const now=Date.now();const eligible=payload.items.map(x=>{
       const members=x.members.filter(m=>! /보고\s*서\s*명\s*[:：]/u.test(m.text||'')&&Date.parse(m.date)>=now-24*3600000&&Date.parse(m.date)<=now).sort((a,b)=>Date.parse(b.date)-Date.parse(a.date));
       return {...x,members,channelCount:new Set(members.map(m=>m.chatId)).size,mentionCount:members.length,excerpt:members[0]?.text.slice(0,450)||''};
     }).filter(x=>x.channelCount>=2&&! /보고\s*서\s*명\s*[:：]/u.test(x.title||'')).sort((a,b)=>b.channelCount-a.channelCount||b.mentionCount-a.mentionCount);
     results.innerHTML=eligible.slice(0,30).map((x,i)=>'<article class="card"><h3>'+escape(i+1)+'. '+escape(x.title)+'</h3><p>'+escape(x.channelCount)+'개 채널 · '+escape(x.mentionCount)+'회 언급</p><p>'+escape(x.excerpt)+'</p><details><summary>관련 원문</summary>'+x.members.map(m=>'<p><strong>'+escape(m.channel)+'</strong> · '+escape(m.date)+'</p><p>'+escape(m.text)+'</p>').join('')+'</details></article>').join('')||'<p>조건에 맞는 반복 이슈가 없습니다.</p>';
     }
     renderResults();expiryTimer=setInterval(()=>{if(Date.now()>=expires){clear();status.textContent='수집 결과가 만료되었습니다. 다음 갱신 뒤 다시 열어주세요.';}else{renderResults();}},30000);
     status.textContent='수집 시각: '+new Date(payload.updatedAt).toLocaleString('ko-KR')+' · 정기 갱신 07:00 / 21:00 KST';
     form.hidden=true;lock.classList.remove('hidden');
   }catch(error){if(run===epoch)status.textContent=error.message==='expired'?'수집 결과가 만료되었습니다. 다음 갱신 뒤 다시 열어주세요.':error.message==='missing'?'아직 서버 수집 결과가 게시되지 않았습니다.':'비밀번호가 맞지 않거나 데이터를 열 수 없습니다.';}finally{password='';}
 };
 if(location.hash==='#/telegram')window.telegramRoute();
})();