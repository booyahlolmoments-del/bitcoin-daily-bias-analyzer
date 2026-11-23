import {analyzeMarket} from "./engine.js";
const $=id=>document.getElementById(id);
const API="https://data-api.binance.vision/api/v3/klines";
const PROXY=localStorage.getItem("BTC_BIAS_API_BASE")||"";
const LIMIT=500;
let chart,series,currentTf="1d",lastResult=null,refreshing=false,priceLines=[];
const fmt=n=>Number.isFinite(Number(n))?Number(n).toLocaleString("en-US",{maximumFractionDigits:2}):"—";
const timeFmt=t=>new Date(t*1000).toLocaleString("en-IN",{timeZone:"Asia/Kolkata",hour12:true});
function toast(s){const el=$("toast");el.textContent=s;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2400);}
function setStatus(s,ok=true){$("connection").textContent=s;$("connection").style.color=ok?"#26c281":"#f06470";}
async function fetchKlines(interval,limit=LIMIT){
  const url=`${API}?symbol=BTCUSDT&interval=${interval}&limit=${limit}`;
  let res;
  if(PROXY){try{res=await fetch(`${PROXY.replace(/\/$/,"")}/api/klines?interval=${interval}&limit=${limit}`);if(res.ok)return parse(await res.json());}catch(e){}}
  res=await fetch(url,{cache:"no-store"});
  if(!res.ok)throw new Error(`Market data HTTP ${res.status}`);
  return parse(await res.json());
}
function parse(rows){return rows.map(r=>({time:Math.floor(r[0]/1000),open:+r[1],high:+r[2],low:+r[3],close:+r[4],volume:+r[5],closeTime:r[6]}));}
function initChart(){
  const el=$("chart");
  chart=LightweightCharts.createChart(el,{width:el.clientWidth,height:el.clientHeight,layout:{background:{type:"solid",color:"#111c2e"},textColor:"#aab9ce"},grid:{vertLines:{color:"#1d2a40"},horzLines:{color:"#1d2a40"}},rightPriceScale:{borderColor:"#30425d"},timeScale:{borderColor:"#30425d",timeVisible:true},crosshair:{mode:0},attributionLogo:true});
  series=chart.addSeries(LightweightCharts.CandlestickSeries,{upColor:"#26c281",downColor:"#f06470",borderVisible:false,wickUpColor:"#26c281",wickDownColor:"#f06470"});
  new ResizeObserver(()=>chart.applyOptions({width:el.clientWidth,height:el.clientHeight})).observe(el);
}
async function loadChart(tf=currentTf){
  currentTf=tf;document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.tf===tf));
  const rows=await fetchKlines(tf==="1d"?"1d":tf);
  series.setData(rows.map(x=>({time:x.time,open:x.open,high:x.high,low:x.low,close:x.close})));
  chart.timeScale().fitContent();
  if(lastResult)drawLines(lastResult);
}
function drawLines(r){
  for(const line of priceLines){try{series.removePriceLine(line);}catch(e){}}
  priceLines=[];
  const lines=[];
  const add=(price,title,color,style=2)=>{if(Number.isFinite(price))priceLines.push(series.createPriceLine({price,title,color,lineWidth:1,lineStyle:style,axisLabelVisible:true}));};
  add(r.price,"Reference","#6da9ff",0);
  add(r.levels.sl,"Potential SL","#f06470",2);
  (r.levels.tp||[]).forEach((p,i)=>add(p,`TP${i+1}`,"#26c281",2));
  add(r.keyLevels.PDH,"PDH","#d9a84e",1);add(r.keyLevels.PDL,"PDL","#d9a84e",1);
}
function stabilizeDailyBias(r){
  // Daily bias is sticky within one UTC day. Opposite bias needs strong,
  // corroborated HTF evidence; neutral/noisy intraday readings do not flip it.
  const dayKey=new Date().toISOString().slice(0,10);
  const key=`BTC_BIAS_STATE_${dayKey}`;
  let prior=null;try{prior=JSON.parse(localStorage.getItem(key)||"null");}catch(e){}
  const daily=r.timeframes.Daily?.bias, fourH=r.timeframes["4H"]?.bias;
  if(!prior||!['bullish','bearish'].includes(prior.bias)){
    if(r.bias!=='neutral')localStorage.setItem(key,JSON.stringify({bias:r.bias,at:Date.now()}));
    return r;
  }
  const opposite=prior.bias==='bullish'?'bearish':'bullish';
  const confirmedOpposite=daily===opposite&&fourH===opposite&&Math.abs(r.score)>=4.5;
  const higherTimeframeInvalidated=daily===opposite&&fourH===opposite;
  if(r.bias===opposite&&confirmedOpposite){
    localStorage.setItem(key,JSON.stringify({bias:opposite,at:Date.now()}));
    r.bias=opposite;r.biasChange="Confirmed HTF reversal";
  }else if(r.bias===opposite){
    r.bias="neutral";r.levels={entry:null,sl:null,tp:[]};
    r.biasChange="Opposite signal not yet confirmed by both Daily and 4H; waiting rather than flipping";
  }else if(r.bias==='neutral'){
    r.levels={entry:null,sl:null,tp:[]};
    r.biasChange=higherTimeframeInvalidated?"Previous bias invalidated; waiting for new direction":"Mixed evidence; no directional levels published";
  }else{
    r.biasChange="Daily bias remains aligned with the current HTF direction";
  }
  return r;
}
function render(r){
  r=stabilizeDailyBias(r);
  lastResult=r;
  $("biasValue").textContent=r.bias.toUpperCase();
  $("biasValue").className=`bias ${r.bias}`;
  $("biasReason").textContent=r.bias==="neutral"?"Higher-timeframe evidence is mixed or insufficient. Wait for clearer structure.":`Directional evidence favours ${r.bias}. ${r.biasChange||"Review the evidence and invalidation level before acting."}`;
  $("price").textContent=`$${fmt(r.price)}`;
  $("priceChange").textContent=`BTC/USDT · ${r.status==="provisional"?"Live developing-day analysis":"Confirmed"}`;
  $("updatedAt").textContent=`Updated ${timeFmt(Math.floor(Date.now()/1000))}`;
  $("score").textContent=r.score;$("scoreLabel").textContent=`${r.confidence}% evidence strength (not win probability)`;
  $("volatility").textContent=r.volatility===null?"—":`${r.volatility}%`;
  $("dol").textContent=r.dol;$("dailyState").textContent="Live / provisional";
  $("confidence").textContent=`Evidence strength ${r.confidence}%`;
  $("levels").innerHTML=r.bias==="neutral"?`<div class="muted">No SL/TP published: bias is Neutral. This avoids forcing levels when direction is unclear.</div>`:
    `<div class="level-row"><span>Reference price</span><b>$${fmt(r.levels.entry)}</b></div><div class="level-row stop"><span>Potential SL · 4H invalidation</span><b>$${fmt(r.levels.sl)}</b></div>`+
    (r.levels.tp||[]).map((x,i)=>`<div class="level-row target"><span>Potential TP${i+1}</span><b>$${fmt(x)}</b></div>`).join("");
  $("timeframes").innerHTML=Object.entries(r.timeframes).map(([k,v])=>`<div class="tf-row"><div class="tf-name">${k}</div><div><div>${v.detail}</div><div class="tf-detail">Score ${v.score??0}</div></div><div class="tag ${v.bias}">${v.bias.toUpperCase()}</div></div>`).join("");
  $("evidence").innerHTML=r.evidence.map(([a,b,c])=>`<div class="evidence"><span><b>${a}</b><br><small class="muted">${b}</small></span><span class="tag ${c}">${c.toUpperCase()}</span></div>`).join("");
  $("keyLevels").innerHTML=Object.entries(r.keyLevels).map(([k,v])=>`<div class="key"><small>${k}</small><b>${v===null?"—":"$"+fmt(v)}</b></div>`).join("");
  if(currentTf==="1d")drawLines(r);
}
async function refresh(){
  if(refreshing)return;refreshing=true;
  try{
    setStatus("Updating…");
    const [m1,w1,d1,h4,h1]=await Promise.all([
      fetchKlines("1M",120),fetchKlines("1w",160),fetchKlines("1d",220),fetchKlines("4h",260),fetchKlines("1h",260)
    ]);
    if([m1,w1,d1,h4,h1].some(x=>x.length<35))throw new Error("Not enough historical candles returned.");
    const r=analyzeMarket({m1,w1,d1,h4,h1});render(r);setStatus("Live data connected");
    $("dailyClock").textContent=`Daily boundary: 05:30 IST · ${new Date().toLocaleString("en-IN",{timeZone:"Asia/Kolkata"})}`;
  }catch(e){setStatus("Data unavailable",false);toast(e.message||"Could not refresh market data.");console.error(e);}
  finally{refreshing=false;}
}
$("refreshBtn").addEventListener("click",refresh);
$("timeframeTabs").addEventListener("click",async e=>{const b=e.target.closest("[data-tf]");if(!b)return;try{await loadChart(b.dataset.tf);}catch(err){toast("Chart load failed: "+err.message);}});
(async()=>{try{initChart();await loadChart("1d");await refresh();setInterval(refresh,60_000);setInterval(()=>loadChart(currentTf).catch(()=>{}),180_000);}catch(e){setStatus("Chart unavailable",false);toast(e.message);}})();
