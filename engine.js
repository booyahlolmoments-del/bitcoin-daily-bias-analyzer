// Deterministic, explainable ICT/SMC-inspired analysis. No moving-average indicators.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:0;
const round=(x,n=2)=>Number.isFinite(x)?Number(x.toFixed(n)):null;
const body=c=>Math.abs(c.close-c.open);
const range=c=>Math.max(c.high-c.low,1e-9);
const upperWick=c=>c.high-Math.max(c.open,c.close);
const lowerWick=c=>Math.min(c.open,c.close)-c.low;

export function atr(candles, period=14){
  const trs=[];
  for(let i=1;i<candles.length;i++){const c=candles[i],p=candles[i-1];trs.push(Math.max(c.high-c.low,Math.abs(c.high-p.close),Math.abs(c.low-p.close)));}
  return mean(trs.slice(-period));
}
export function pivots(candles,left=2,right=2){
  const highs=[],lows=[];
  for(let i=left;i<candles.length-right;i++){
    const c=candles[i];let hi=true,lo=true;
    for(let j=i-left;j<=i+right;j++){if(j===i)continue;if(candles[j].high>=c.high)hi=false;if(candles[j].low<=c.low)lo=false;}
    if(hi)highs.push({price:c.high,time:c.time,index:i});
    if(lo)lows.push({price:c.low,time:c.time,index:i});
  }
  return {highs,lows};
}
function structure(candles){
  const p=pivots(candles);const h=p.highs.slice(-2),l=p.lows.slice(-2);
  if(h.length<2||l.length<2)return {bias:"neutral",detail:"Not enough confirmed swing points",pivots:p};
  const up=h[1].price>h[0].price&&l[1].price>l[0].price;
  const down=h[1].price<h[0].price&&l[1].price<l[0].price;
  return {bias:up?"bullish":down?"bearish":"neutral",detail:up?"Higher highs and higher lows":down?"Lower highs and lower lows":"Mixed swing structure",pivots:p};
}
function fvg(c){
  const out=[];
  for(let i=2;i<c.length;i++){
    if(c[i].low>c[i-2].high)out.push({side:"bullish",low:c[i-2].high,high:c[i].low,time:c[i].time});
    if(c[i].high<c[i-2].low)out.push({side:"bearish",low:c[i].high,high:c[i-2].low,time:c[i].time});
  }
  return out.slice(-12);
}
function sweep(c,level,side){
  const x=c[c.length-1];if(!x||!Number.isFinite(level))return false;
  return side==="low"?x.low<level&&x.close>level:x.high>level&&x.close<level;
}
function tfAnalysis(candles){
  const c=candles.slice(0,-1); // use closed candles for higher-timeframe confirmation
  const s=structure(c),a=atr(c);
  const last=c[c.length-1],prev=c[c.length-2];
  if(!last||!prev)return {bias:"neutral",detail:"Insufficient candles",score:0,atr:a,pivots:{highs:[],lows:[]}};
  let score=s.bias==="bullish"?2:s.bias==="bearish"?-2:0;
  const impulse=(last.close-last.open)/(a||1);
  if(impulse>0.7)score+=1;if(impulse<-.7)score-=1;
  return {bias:score>=1?"bullish":score<=-1?"bearish":"neutral",detail:s.detail,score,atr:a,pivots:s.pivots,last,prev,fvgs:fvg(c)};
}
function nearest(values,price,side){
  const xs=values.filter(x=>side==="above"?x>price:x<price).sort((a,b)=>side==="above"?a-b:b-a);
  return xs.slice(0,3);
}
function levelSet(bias,price,a4,day,week){
  if(bias==="neutral"||!a4)return {entry:null,sl:null,tp:[]};
  const p=a4.pivots||{highs:[],lows:[]},atr4=a4.atr||price*.01;
  const lows=p.lows.map(x=>x.price),highs=p.highs.map(x=>x.price);
  const pad=Math.max(atr4*.12,price*.0005);
  let sl,targets=[];
  if(bias==="bullish"){
    const support=nearest(lows,price,"below")[0];
    sl=Math.min(support??price-atr4*1.3,price-atr4*.65)-pad;
    const pool=[...highs,day?.high,week?.high].filter(Number.isFinite);
    targets=nearest(pool,price,"above");
    for(const m of [1,1.8,2.6]){const fallback=price+atr4*m;if(targets.length<3&&!targets.some(x=>Math.abs(x-fallback)<atr4*.2))targets.push(fallback);}
  }else{
    const resistance=nearest(highs,price,"above")[0];
    sl=Math.max(resistance??price+atr4*1.3,price+atr4*.65)+pad;
    const pool=[...lows,day?.low,week?.low].filter(Number.isFinite);
    targets=nearest(pool,price,"below");
    for(const m of [1,1.8,2.6]){const fallback=price-atr4*m;if(targets.length<3&&!targets.some(x=>Math.abs(x-fallback)<atr4*.2))targets.push(fallback);}
  }
  targets=targets.sort((a,b)=>bias==="bullish"?a-b:b-a);
  return {entry:price,sl:round(sl,2),tp:targets.slice(0,3).map(x=>round(x,2))};
}
export function analyzeMarket(data){
  const {m1,w1,d1,h4,h1}=data;
  const m=tfAnalysis(m1),w=tfAnalysis(w1),d=tfAnalysis(d1),h=tfAnalysis(h4),one=tfAnalysis(h1);
  const dailyClosed=d1.slice(-2,-1)[0],previousDay=d1.slice(-3,-2)[0];
  const currentDay=d1[d1.length-1],price=h1[h1.length-1]?.close;
  const dayPiv=pivots(d1.slice(0,-1)),lastDay=previousDay||dailyClosed;
  const pdh=lastDay?.high,pdl=lastDay?.low;
  let score=m.score*.8+w.score*1.2+d.score*2+h.score*1.5+one.score*.5;
  const last4=h4[h4.length-2],a4=h.atr||atr(h4);
  const bullSweep=last4&&Number.isFinite(pdl)&&last4.low<pdl&&last4.close>pdl;
  const bearSweep=last4&&Number.isFinite(pdh)&&last4.high>pdh&&last4.close<pdh;
  if(bullSweep)score+=2;if(bearSweep)score-=2;
  const dayRange=currentDay?currentDay.high-currentDay.low:0;
  const dayMid=currentDay?(currentDay.high+currentDay.low)/2:null;
  const discount=dayMid!==null&&price<dayMid,premium=dayMid!==null&&price>dayMid;
  if(discount)score+=.4;if(premium)score-=.4;
  const lastH=h1[h1.length-2],h1Impulse=lastH&&a4?((lastH.close-lastH.open)/a4):0;
  if(h1Impulse>.55)score+=.35;if(h1Impulse<-.55)score-=.35;
  // Neutral unless evidence is sufficiently directional and at least Daily or 4H agrees.
  const direction=score>=3&&(["bullish"].includes(d.bias)||h.bias==="bullish")?"bullish":
    score<=-3&&(d.bias==="bearish"||h.bias==="bearish")?"bearish":"neutral";
  const evidence=[
    ["Monthly structure",m.detail,m.bias],
    ["Weekly structure",w.detail,w.bias],
    ["Daily structure",d.detail,d.bias],
    ["4H structure",h.detail,h.bias],
    ["1H structure",one.detail,one.bias],
    ["PDL sell-side sweep and reclaim",bullSweep?"Detected":"Not detected",bullSweep?"bullish":"neutral"],
    ["PDH buy-side sweep and rejection",bearSweep?"Detected":"Not detected",bearSweep?"bearish":"neutral"],
    ["Current price vs daily range midpoint",discount?"Discount":premium?"Premium":"At midpoint",discount?"bullish":premium?"bearish":"neutral"],
    ["1H displacement",h1Impulse>.55?"Bullish impulse":h1Impulse<-.55?"Bearish impulse":"No strong impulse",h1Impulse>.55?"bullish":h1Impulse<-.55?"bearish":"neutral"]
  ];
  const confidence=Math.round(clamp(Math.abs(score)/8*100,0,96));
  const lastWeek=w1[w1.length-2];
  const levels=levelSet(direction,price,h,currentDay,lastWeek);
  const highs=[...h.pivots.highs.map(x=>x.price),pdh].filter(Number.isFinite);
  const lows=[...h.pivots.lows.map(x=>x.price),pdl].filter(Number.isFinite);
  const dol=direction==="bullish"?"Buy-side liquidity":direction==="bearish"?"Sell-side liquidity":"No clear draw";
  return {
    bias:direction,score:round(score,2),confidence,price,levels,evidence,dol,
    volatility:price?round((a4/price)*100,2):null,
    timeframes:{Monthly:m,Weekly:w,Daily:d,"4H":h,"1H":one},
    keyLevels:{PDH:round(pdh),PDL:round(pdl),dayHigh:round(currentDay?.high),dayLow:round(currentDay?.low),
      nearestBSL:round(nearest(highs,price,"above")[0]),nearestSSL:round(nearest(lows,price,"below")[0])},
    dailyOpenTime:currentDay?.time,
    dailyClosedAtUTC:"00:00 UTC / 05:30 Asia-Kolkata",
    status:"provisional"
  };
}
