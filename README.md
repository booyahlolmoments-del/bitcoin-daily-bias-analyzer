# Multi-Coin Daily Bias Analyzer (ICT + SMC)

Supports **BTCUSDT**, **ETHUSDT**, **LINKUSDT**, and **SOLUSDT** with Top-Down Daily Bias analysis (Monthly → Weekly → Daily → 4H → 1H).

## Files Included
- `index.html` — UI with BTC, ETH, LINK, SOL selector tabs & TradingView Lightweight Chart
- `styles.css` — Dark minimalist mobile-first styling
- `engine.js` — Pure ICT/SMC Daily Bias Engine (Sweep & Reject, Close Beyond, Inside Bar Neutrality, Candle Anatomy, 4-Candle Exhaustion)
- `app.js` — Binance live klines fetcher & multi-coin dashboard controller
