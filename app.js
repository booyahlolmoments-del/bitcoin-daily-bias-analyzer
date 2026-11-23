const ASSETS = {
  BTCUSDT: { label: "BTC", name: "Bitcoin", decimals: 2 },
  ETHUSDT: { label: "ETH", name: "Ethereum", decimals: 2 },
  LINKUSDT: { label: "LINK", name: "Chainlink", decimals: 3 },
  SOLUSDT: { label: "SOL", name: "Solana", decimals: 2 }
};

let currentSymbol = "BTCUSDT";
let currentChartTf = "1d";
let cachedKlines = {};
let chart = null;
let candleSeries = null;

async function fetchKlines(symbol, interval, limit = 60) {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.map(k => ({
    time: Math.floor(k[0] / 1000),
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4])
  }));
}

function formatPrice(val, decimals) {
  if (val === null || val === undefined || isNaN(val)) return "--";
  return "$" + Number(val).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

function initChart() {
  const container = document.getElementById("chartContainer");
  container.innerHTML = "";
  chart = LightweightCharts.createChart(container, {
    layout: { background: { color: "#131a2a" }, textColor: "#94a3b8" },
    grid: { vertLines: { color: "#1e293b" }, horzLines: { color: "#1e293b" } },
    width: container.clientWidth,
    height: 300,
    timeScale: { timeVisible: true, secondsVisible: false }
  });

  candleSeries = chart.addCandlestickSeries({
    upColor: "#10b981",
    downColor: "#ef4444",
    borderVisible: false,
    wickUpColor: "#10b981",
    wickDownColor: "#ef4444"
  });

  window.addEventListener("resize", () => {
    if (chart) chart.applyOptions({ width: container.clientWidth });
  });
}

function renderChart(candles, pdh, pdl, decimals) {
  if (!chart) initChart();
  candleSeries.applyOptions({
    priceFormat: { type: "price", precision: decimals, minMove: Math.pow(10, -decimals) }
  });
  candleSeries.setData(candles);

  // Remove old price lines by recreating series cleanly
  chart.removeSeries(candleSeries);
  candleSeries = chart.addCandlestickSeries({
    upColor: "#10b981",
    downColor: "#ef4444",
    borderVisible: false,
    wickUpColor: "#10b981",
    wickDownColor: "#ef4444",
    priceFormat: { type: "price", precision: decimals, minMove: Math.pow(10, -decimals) }
  });
  candleSeries.setData(candles);

  if (pdh) {
    candleSeries.createPriceLine({
      price: pdh,
      color: "#3b82f6",
      lineWidth: 2,
      lineStyle: LightweightCharts.LineStyle.Dashed,
      axisLabelVisible: true,
      title: "PDH"
    });
  }
  if (pdl) {
    candleSeries.createPriceLine({
      price: pdl,
      color: "#f59e0b",
      lineWidth: 2,
      lineStyle: LightweightCharts.LineStyle.Dashed,
      axisLabelVisible: true,
      title: "PDL"
    });
  }
  chart.timeScale().fitContent();
}

async function loadAssetData(symbol) {
  const asset = ASSETS[symbol];
  const badge = document.getElementById("liveBadge");
  document.getElementById("pairTitle").textContent = `${asset.label} Daily Bias`;
  document.getElementById("pairSubtitle").textContent = `${asset.label} / USDT · ICT + SMC · Top-down`;
  document.getElementById("chartTitle").textContent = `${asset.name} chart`;
  document.getElementById("biasStatus").textContent = "ANALYZING...";
  document.getElementById("biasStatus").className = "bias-value neutral";

  try {
    const [mn, wk, d1, h4, h1] = await Promise.all([
      fetchKlines(symbol, "1M", 24),
      fetchKlines(symbol, "1w", 30),
      fetchKlines(symbol, "1d", 45),
      fetchKlines(symbol, "4h", 45),
      fetchKlines(symbol, "1h", 45)
    ]);

    cachedKlines = { "1d": d1, "4h": h4, "1h": h1 };
    const result = window.BiasEngine.calculateTopDownDailyBias({ mn, wk, d1, h4, h1 });
    const latestPrice = d1[d1.length - 1].close;

    badge.textContent = "Live data connected";
    badge.className = "badge live";

    const statusEl = document.getElementById("biasStatus");
    statusEl.textContent = result.dailyBias;
    statusEl.className = `bias-value ${result.dailyBias.toLowerCase()}`;

    document.getElementById("biasSummary").textContent = result.executionNote;
    document.getElementById("livePrice").textContent = formatPrice(latestPrice, asset.decimals);
    document.getElementById("lastUpdated").textContent = `Updated ${new Date().toLocaleTimeString()}`;

    document.getElementById("biasScore").textContent = result.confidenceScore;
    document.getElementById("evidencePct").textContent = `${result.evidenceStrength}% evidence strength`;
    document.getElementById("volatilityVal").textContent = `${result.volatilityPct}%`;

    const drawText = result.dailyBias === "BULLISH"
      ? `PDH ${formatPrice(result.pdh, asset.decimals)}`
      : result.dailyBias === "BEARISH"
        ? `PDL ${formatPrice(result.pdl, asset.decimals)}`
        : "No clear draw";
    document.getElementById("drawLiquidity").textContent = drawText;

    document.getElementById("executionRule").textContent = result.executionNote;
    document.getElementById("pdhVal").textContent = formatPrice(result.pdh, asset.decimals);
    document.getElementById("pdlVal").textContent = formatPrice(result.pdl, asset.decimals);

    renderChart(cachedKlines[currentChartTf], result.pdh, result.pdl, asset.decimals);

    const matrixList = document.getElementById("matrixList");
    matrixList.innerHTML = "";
    Object.entries(result.breakdown).forEach(([tf, info]) => {
      const tagClass = info.bias === "BULLISH" ? "tag-bull" : info.bias === "BEARISH" ? "tag-bear" : "tag-neut";
      const item = document.createElement("div");
      item.className = "matrix-item";
      item.innerHTML = `
        <div class="matrix-tf">${tf}</div>
        <div class="matrix-reason">${info.reason}</div>
        <div class="matrix-tag ${tagClass}">${info.bias} (${info.score})</div>
      `;
      matrixList.appendChild(item);
    });
  } catch (err) {
    badge.textContent = "API Error";
    badge.className = "badge err";
    document.getElementById("biasStatus").textContent = "OFFLINE";
    document.getElementById("biasSummary").textContent = "Failed to fetch Binance data: " + err.message;
  }
}

document.querySelectorAll(".coin-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".coin-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentSymbol = btn.dataset.symbol;
    loadAssetData(currentSymbol);
  });
});

document.querySelectorAll(".tf-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tf-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentChartTf = btn.dataset.tf;
    const asset = ASSETS[currentSymbol];
    if (cachedKlines[currentChartTf]) {
      const d1 = cachedKlines["1d"];
      const closedD1 = d1.slice(0, -1);
      const lastClosed = closedD1[closedD1.length - 1] || {};
      renderChart(cachedKlines[currentChartTf], lastClosed.high, lastClosed.low, asset.decimals);
    }
  });
});

document.getElementById("refreshBtn").addEventListener("click", () => loadAssetData(currentSymbol));

// Initial load
loadAssetData(currentSymbol);
