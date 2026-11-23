/**
 * ICT & SMC Top-Down Daily Bias Engine (Pure Bias & Liquidity Target - No Entry Model)
 * Multi-Asset Ready: BTCUSDT, ETHUSDT, LINKUSDT, SOLUSDT
 */

function analyzeCandleBias(prev, curr) {
  if (!prev || !curr) return { bias: "NEUTRAL", score: 0, reason: "Insufficient data", target: null };

  const prevRange = prev.high - prev.low;
  if (prevRange === 0) return { bias: "NEUTRAL", score: 0, reason: "Zero range candle", target: null };

  // 1. Inside Candle Check (Neutral Rule)
  const isInsideBar = curr.high <= prev.high && curr.low >= prev.low;
  if (isInsideBar) {
    return {
      bias: "NEUTRAL",
      score: 0,
      reason: "Inside Candle (Range bound - No fresh sweep or breakout)",
      target: null
    };
  }

  // 2. Reversal Pattern: Liquidity Sweep & Reject
  const sweptLow = curr.low < prev.low && curr.close > prev.low;
  const sweptHigh = curr.high > prev.high && curr.close < prev.high;

  if (sweptLow && sweptHigh) {
    const closeInUpperHalf = curr.close > (curr.high + curr.low) / 2;
    return {
      bias: closeInUpperHalf ? "BULLISH" : "BEARISH",
      score: closeInUpperHalf ? 1.5 : -1.5,
      reason: "Outside Sweep (Both High & Low swept; closed in " + (closeInUpperHalf ? "upper" : "lower") + " half)",
      target: closeInUpperHalf ? curr.high : curr.low
    };
  }

  if (sweptLow) {
    return {
      bias: "BULLISH",
      score: 2.5,
      reason: "Bullish Reversal: Previous Low Swept & Rejected",
      target: curr.high
    };
  }

  if (sweptHigh) {
    return {
      bias: "BEARISH",
      score: -2.5,
      reason: "Bearish Reversal: Previous High Swept & Rejected",
      target: curr.low
    };
  }

  // 3. Continuation Pattern: Close Beyond Previous High/Low
  const closedAboveHigh = curr.close > prev.high;
  const closedBelowLow = curr.close < prev.low;

  const currRange = curr.high - curr.low || 1;
  const upperWickRatio = (curr.high - Math.max(curr.open, curr.close)) / currRange;
  const lowerWickRatio = (Math.min(curr.open, curr.close) - curr.low) / currRange;

  if (closedAboveHigh) {
    if (upperWickRatio > 0.45) {
      return {
        bias: "BULLISH",
        score: 1.0,
        reason: "Bullish Continuation (Heavy upper wick rejection - expect dip first)",
        target: curr.high
      };
    }
    return {
      bias: "BULLISH",
      score: 2.0,
      reason: "Bullish Continuation: Strong Body Close Beyond Previous High",
      target: curr.high
    };
  }

  if (closedBelowLow) {
    if (lowerWickRatio > 0.45) {
      return {
        bias: "BEARISH",
        score: -1.0,
        reason: "Bearish Continuation (Heavy lower wick rejection - expect pullback first)",
        target: curr.low
      };
    }
    return {
      bias: "BEARISH",
      score: -2.0,
      reason: "Bearish Continuation: Strong Body Close Beyond Previous Low",
      target: curr.low
    };
  }

  return { bias: "NEUTRAL", score: 0, reason: "Consolidating inside previous range", target: null };
}

function checkExhaustion(candles) {
  if (!candles || candles.length < 4) return 0;
  const last4 = candles.slice(-4);
  const allBull = last4.every(c => c.close > c.open);
  const allBear = last4.every(c => c.close < c.open);

  if (allBull) return -0.75;
  if (allBear) return 0.75;
  return 0;
}

function analyzeIntradayStructure(candles) {
  if (!candles || candles.length < 6) return { bias: "NEUTRAL", score: 0, reason: "Insufficient intraday candles" };

  const prev = candles[candles.length - 2];
  const curr = candles[candles.length - 1];
  const swingHigh = Math.max(...candles.slice(-6, -1).map(c => c.high));
  const swingLow = Math.min(...candles.slice(-6, -1).map(c => c.low));

  if (curr.low < swingLow && curr.close > swingLow) {
    return { bias: "BULLISH", score: 1.5, reason: "Intraday Swing Low Sweep & Reclaim" };
  }
  if (curr.high > swingHigh && curr.close < swingHigh) {
    return { bias: "BEARISH", score: -1.5, reason: "Intraday Swing High Sweep & Reject" };
  }
  if (curr.close > prev.high) {
    return { bias: "BULLISH", score: 1.0, reason: "Intraday Bullish BOS" };
  }
  if (curr.close < prev.low) {
    return { bias: "BEARISH", score: -1.0, reason: "Intraday Bearish BOS" };
  }

  return { bias: "NEUTRAL", score: 0, reason: "Mixed intraday swing structure" };
}

function calculateATR(candles, period = 14) {
  if (!candles || candles.length < period + 1) return 0;
  let sum = 0;
  for (let i = candles.length - period; i < candles.length; i++) {
    const c = candles[i];
    const p = candles[i - 1];
    const tr = Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close));
    sum += tr;
  }
  return sum / period;
}

function calculateTopDownDailyBias({ mn = [], wk = [], d1 = [], h4 = [], h1 = [] }) {
  // Use last 2 CLOSED candles (exclude currently open candle at index length - 1)
  const closedMn = mn.slice(0, -1);
  const closedWk = wk.slice(0, -1);
  const closedD1 = d1.slice(0, -1);
  const closedH4 = h4.slice(0, -1);
  const closedH1 = h1.slice(0, -1);

  const mnAnalysis = closedMn.length >= 2 ? analyzeCandleBias(closedMn[closedMn.length - 2], closedMn[closedMn.length - 1]) : { bias: "NEUTRAL", score: 0, reason: "N/A" };
  const wkAnalysis = closedWk.length >= 2 ? analyzeCandleBias(closedWk[closedWk.length - 2], closedWk[closedWk.length - 1]) : { bias: "NEUTRAL", score: 0, reason: "N/A" };
  const d1Analysis = closedD1.length >= 2 ? analyzeCandleBias(closedD1[closedD1.length - 2], closedD1[closedD1.length - 1]) : { bias: "NEUTRAL", score: 0, reason: "N/A" };

  const h4Analysis = analyzeIntradayStructure(closedH4);
  const h1Analysis = analyzeIntradayStructure(closedH1);
  const d1Exhaustion = checkExhaustion(closedD1);

  const totalScore =
    (mnAnalysis.score * 0.8) +
    (wkAnalysis.score * 1.2) +
    (d1Analysis.score * 1.8) +
    (h4Analysis.score * 0.7) +
    (h1Analysis.score * 0.5) +
    d1Exhaustion;

  let finalBias = "NEUTRAL";
  if (totalScore >= 1.2) finalBias = "BULLISH";
  else if (totalScore <= -1.2) finalBias = "BEARISH";

  const lastClosedDay = closedD1[closedD1.length - 1] || {};
  const pdh = lastClosedDay.high || null;
  const pdl = lastClosedDay.low || null;

  const liveCandle = d1[d1.length - 1] || lastClosedDay;
  const atr = calculateATR(closedD1, 14);
  const volatilityPct = liveCandle.close ? ((atr / liveCandle.close) * 100).toFixed(2) : "0.00";
  const evidenceStrength = Math.min(100, Math.round((Math.abs(totalScore) / 6.5) * 100));

  let drawOnLiquidity = "No clear draw";
  let executionNote = "Higher-timeframe evidence is mixed or inside range. Wait for clear sweep/BOS.";

  if (finalBias === "BULLISH") {
    drawOnLiquidity = pdh ? `PDH $${pdh}` : "PDH";
    executionNote = "Opening Price Rule: Look for buys BELOW Daily Open (discount/POI) targeting PDH.";
  } else if (finalBias === "BEARISH") {
    drawOnLiquidity = pdl ? `PDL $${pdl}` : "PDL";
    executionNote = "Opening Price Rule: Look for sells ABOVE Daily Open (premium/POI) targeting PDL.";
  }

  return {
    dailyBias: finalBias,
    confidenceScore: Number(totalScore.toFixed(2)),
    evidenceStrength,
    volatilityPct,
    drawOnLiquidity,
    pdh,
    pdl,
    executionNote,
    breakdown: {
      Monthly: mnAnalysis,
      Weekly: wkAnalysis,
      Daily: d1Analysis,
      "4H": h4Analysis,
      "1H": h1Analysis
    }
  };
}

if (typeof window !== "undefined") {
  window.BiasEngine = { calculateTopDownDailyBias };
}
