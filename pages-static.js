/* Public client: generated snapshots only. No collector or credential is shipped. */
const pagesDataCache=new Map();
let pagesManifestPromise,pagesManifestTime=0;
const pagesClone=value=>JSON.parse(JSON.stringify(value));
function pagesFileUrl(file){
 if(!file||file.split('/').some(p=>!p||p==='.'||p==='..'))throw Error('잘못된 데이터 경로입니다.');
 return new URL('data/'+file.split('/').map(encodeURIComponent).join('/'),document.baseURI);
}
async function pagesManifest(force=false){
 if(force||!pagesManifestPromise||Date.now()-pagesManifestTime>60000){
  pagesManifestTime=Date.now();
  pagesManifestPromise=fetch(pagesFileUrl('manifest.json'),{cache:'no-store',signal:AbortSignal.timeout(15000)}).then(async r=>{if(!r.ok)throw Error('정기 수집 상태를 불러오지 못했습니다. 잠시 후 다시 읽어 주세요.');return r.json();}).then(d=>{pagesRenderStatus(d);return d;}).catch(e=>{pagesManifestPromise=null;throw e;});
 }
 return pagesManifestPromise;
}
function pagesRenderStatus(m){
 const root=document.getElementById('pages-data-status');if(!root)return;
 const d=new Date(m.generatedAt),valid=Number.isFinite(d.getTime());
 const time=valid?new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(d)+' KST':'수집 시각 확인 필요';
 const stale=valid&&Date.now()-d.getTime()>48*3600000,files=m.files||{};
 const core=['markets.json','stocks.json','kr-indices.json','breadth-global.json','breadth-kr.json'];
 const oldCore=core.filter(file=>{const t=new Date(files[file]?.updatedAt).getTime();return !Number.isFinite(t)||Date.now()-t>48*3600000;}).length;
 const staleFiles=Object.values(files).filter(x=>x.status==='stale'||x.status==='missing').length;
 root.classList.toggle('snapshot-stale',stale||oldCore>0||staleFiles>0);
 root.textContent='정기 수집 데이터 · 마지막 작업 '+time+(stale?' · 작업 시각이 48시간 이상 지났습니다.':'')+(oldCore?' · 주요 시장 데이터 '+oldCore+'개는 수집이 48시간 이상 지났거나 아직 준비되지 않았습니다.':'')+(staleFiles?' · '+staleFiles+'개 항목의 수집이 지연되어 마지막 정상값 또는 미제공 상태를 표시합니다.':m.errors?.length?' · 일부 항목의 수집이 지연됐습니다.':'')+' 각 카드의 기준일을 함께 확인하세요.';
}
async function pagesRead(file){
 const manifest=await pagesManifest(),entry=manifest.files?.[file],version=entry?.updatedAt||manifest.generatedAt||'',key=file+'@'+version;
 if(!pagesDataCache.has(key)){
  const url=pagesFileUrl(file);if(version)url.searchParams.set('v',version);
  const task=fetch(url,{cache:'no-store',signal:AbortSignal.timeout(20000)}).then(async r=>{if(!r.ok)throw Error('현재 정기 수집 대상에 없는 데이터이거나 수집이 완료되지 않았습니다. 제공처 상세 차트에서 확인해 주세요.');const data=await r.json();if(data.error&&!data.quotes&&!data.rows)throw Error(data.message||data.error);return data;}).catch(e=>{pagesDataCache.delete(key);throw e;});
  pagesDataCache.set(key,task);
 }
 return pagesClone(await pagesDataCache.get(key));
}
async function pagesApi(file,params={}){
 if(location.protocol==='file:')throw Error('미리보기 서버 또는 GitHub Pages 주소에서 열어 주세요.');
 let data;
 if(file==='markets'){
  if(!params.symbol)return pagesRead(params.group==='stocks'?'stocks.json':'markets.json');
  const all=await pagesRead('stocks.json'),quote=all.quotes?.find(q=>q.symbol===params.symbol);
  if(!quote)throw Error('이 종목은 현재 정기 수집 목록에 없습니다. 제공처 상세 차트에서 확인해 주세요.');
  return{quotes:[quote],source:quote.source||all.source,retrievedAt:quote.retrievedAt||all.retrievedAt};
 }
 if(file==='kr-market'){
  if(params.kind==='indices')return pagesRead('kr-indices.json');
  if(!/^[A-Z0-9]{6}$/.test(params.code||''))throw Error('종목 코드를 확인해 주세요.');
  const all=await pagesRead('stocks.json'),quote=all.quotes?.find(q=>q.symbol==='KRX:'+params.code);
  if(!quote)throw Error('이 종목은 현재 정기 수집 목록에 없습니다. 제공처 상세 차트에서 확인해 주세요.');
  return{quotes:[quote],history:quote.history||[],source:quote.source||all.source,retrievedAt:quote.retrievedAt||all.retrievedAt};
 }
 if(file==='price-chart'){
  if(!/^[A-Z]+:[A-Z0-9._-]+$/.test(params.symbol||''))throw Error('차트 종목을 확인해 주세요.');
  const chart=await pagesRead('charts/'+encodeURIComponent(params.symbol)+'.json'),period=chart.periods?.[params.period||'1mo'];
  if(!period)throw Error('이 종목의 선택한 기간은 현재 정기 수집 대상에 없습니다. 다른 기간이나 제공처 상세 차트를 확인해 주세요.');
  return period;
 }
 if(file==='sectors'){
  if(!params.id)return pagesRead('sectors.json');
  if(!/^[a-z0-9_-]+$/i.test(params.id))throw Error('테마를 확인해 주세요.');
  return pagesRead('sectors-'+params.id+'-'+(params.benchmark==='SOXX'?'SOXX':'QQQ')+'.json');
 }
 if(file==='news'){
  const topic=['global','us','kr','tw','cn','jp','tech','ai'].includes(params.topic)?params.topic:'global';
  data=await pagesRead('news-'+topic+'.json');
  if(data.items&&typeof localizeBrowser==='function')await localizeBrowser(data.items);
  return data;
 }
 if(file==='breadth')return pagesRead('breadth-'+(params.market==='kr'?'kr':'global')+'.json');
 if(file==='rates')return pagesRead('rates.json');
 if(file==='kr-map'||file==='heatmap')return pagesRead('kr-map.json');
 throw Error('지원하지 않는 데이터입니다.');
}
function pagesInit(){
 pagesManifest().catch(e=>{const root=document.getElementById('pages-data-status');if(root)root.textContent=e.message;});
 const refresh=document.getElementById('refresh');if(refresh)refresh.addEventListener('click',()=>{pagesDataCache.clear();pagesManifest(true).catch(()=>{});},true);
 const news=document.getElementById('news-refresh');if(news)news.addEventListener('click',()=>{pagesDataCache.clear();pagesManifest(true).catch(()=>{});},true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',pagesInit);else pagesInit();
