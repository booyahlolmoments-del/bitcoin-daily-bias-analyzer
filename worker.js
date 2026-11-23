// Optional Cloudflare Worker: market-data proxy + health endpoint.
// No exchange trading permissions, API keys, or order routes are used.
const ALLOWED_ORIGINS = ["*"];
function cors(origin="*"){return {"Access-Control-Allow-Origin":ALLOWED_ORIGINS.includes("*")?"*":origin,"Access-Control-Allow-Methods":"GET, OPTIONS","Access-Control-Allow-Headers":"Content-Type","Cache-Control":"no-store"};}
export default {
  async fetch(request, env, ctx) {
    const url=new URL(request.url), headers=cors(request.headers.get("Origin")||"*");
    if(request.method==="OPTIONS")return new Response(null,{headers});
    if(url.pathname==="/api/health")return Response.json({ok:true,service:"btc-daily-bias-data-proxy",symbol:"BTCUSDT",serverTime:new Date().toISOString()},{headers});
    if(url.pathname==="/api/klines"){
      const interval=url.searchParams.get("interval")||"1d";
      const allowed=["1h","4h","1d","1w","1M"];
      if(!allowed.includes(interval))return Response.json({error:"Unsupported interval"},{status:400,headers});
      const limit=Math.min(1000,Math.max(50,Number(url.searchParams.get("limit")||500)));
      const upstream=`https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT&interval=${interval}&limit=${limit}`;
      try{
        const r=await fetch(upstream,{headers:{"Accept":"application/json"}});
        const body=await r.text();
        return new Response(body,{status:r.status,headers:{...headers,"Content-Type":"application/json","Cache-Control":"public, max-age=20"}});
      }catch(e){return Response.json({error:"Upstream market-data request failed"},{status:502,headers});}
    }
    return Response.json({error:"Not found"},{status:404,headers});
  }
};
