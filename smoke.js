import {analyzeMarket} from "../engine.js";
function candles(n,step=3600,start=1000000000,base=50000,drift=10){
  const a=[];let p=base;
  for(let i=0;i<n;i++){const o=p,c=p+drift+(i%7-3),h=Math.max(o,c)+20,l=Math.min(o,c)-20;a.push({time:start+i*step,open:o,high:h,low:l,close:c,volume:1});p=c;}
  return a;
}
const r=analyzeMarket({m1:candles(60,2592000,1000000000,30000,50),w1:candles(80,604800,1000000000,40000,30),d1:candles(100,86400,1000000000,50000,20),h4:candles(100,14400,1000000000,50000,10),h1:candles(100,3600,1000000000,50000,3)});
if(!["bullish","bearish","neutral"].includes(r.bias))throw new Error("Invalid bias");
if(r.bias==="bullish"&&r.levels.sl>=r.price)throw new Error("Bullish SL must be below price");
if(r.bias==="bearish"&&r.levels.sl<=r.price)throw new Error("Bearish SL must be above price");
console.log("Smoke test passed",r.bias,r.score);
