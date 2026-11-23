# BTC Daily Bias Analyzer

Personal BTC/USDT daily-bias research dashboard. It does **not** place trades.

## Included
- Monthly, weekly, daily, 4H and 1H top-down context.
- ICT/SMC-inspired swing structure, PDH/PDL, BSL/SSL sweep/reclaim, FVG, premium/discount and displacement checks.
- Evidence score with visible reasons.
- Potential 4H-structure/ATR invalidation (SL) and up to three liquidity/ATR reference targets.
- 1-minute refresh; UTC daily boundary is 00:00, which is 05:30 Asia/Kolkata.
- Optional Cloudflare Worker proxy.
- TradingView Lightweight Charts with required attribution.

## Important limitations
1. This is a **research prototype**, not a validated profitable strategy. The score is not a probability or win rate.
2. The current-day daily candle and latest 4H/1H candles are developing. The dashboard labels the result provisional. Higher-timeframe structural confirmation uses closed candles where possible.
3. SL/TP are potential reference levels, not personalized risk advice or guaranteed targets. In Neutral conditions, the app intentionally withholds levels.
4. Equal highs/lows, order blocks and FVGs are simplified rule-based detections. They require further validation and backtesting before relying on them.
5. Binance public data availability may vary by network/region. No API key is embedded.
6. No entry model, order placement, leverage, or account connection is included.

## Run locally
- Serve this folder using a static web server (not `file://`).
- Example with Python: `python -m http.server 8000`
- Open `http://localhost:8000`.
- Internet is required for the chart library and Binance market data.

## GitHub Pages
1. Create a new GitHub repository.
2. Upload `index.html`, `styles.css`, `app.js`, `engine.js`, `manifest.webmanifest`.
3. Open repository **Settings → Pages**.
4. Choose **Deploy from a branch**, select `main` and `/ (root)`, then Save.
5. Open the generated Pages URL.

## Optional Cloudflare Worker
The static frontend can query Binance directly. The Worker is optional and is included as a proxy/fallback.
1. Create a Cloudflare account and install Node.js + Wrangler on a computer, or use Cloudflare's dashboard editor.
2. Deploy `worker.js` with `wrangler.toml` using `npx wrangler deploy`.
3. Copy the Worker URL.
4. In the app's browser console, set:
   `localStorage.setItem("BTC_BIAS_API_BASE","https://YOUR-WORKER.workers.dev")`
   then reload.
5. The Worker has only public market-data GET routes; it cannot access or trade on an exchange account.

## Daily timing
Binance UTC daily candles roll at 00:00 UTC = 05:30 IST. The app refreshes continuously and recalculates the live developing-day context after the new UTC daily candle begins. It does not require a scheduled job to open the app. A background server schedule is not included in this first build; the dashboard refreshes while open.

## Validation
Open browser devtools and check Network/Console. Confirm the five intervals load and the status says “Live data connected”. If the Binance endpoint is unavailable in your region, deploy the optional Worker proxy.

## Next engineering milestones
- Unit tests for swing detection, sweep logic, bias state transitions and target ordering.
- Historical walk-forward backtest including fees/slippage.
- More rigorous order-block and equal-high/low clustering.
- Bias persistence / invalidation state machine.
- Cache and server-side scheduled snapshots if background monitoring is required.
