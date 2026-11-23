/**
 * ICT & SMC Top-Down Daily Bias Engine (No Entry Model - Pure Bias & Target)
 * Based on: Sweep & Reject (Reversal), Close Beyond (Continuation),
 * Inside Bar Neutrality, Candle Anatomy, and 4H/1H Alignment.
 */

function analyzeCandleBias(prev, curr, prev2 = null) {
  if (!prev || !curr) return { bias: "NEUTRAL", score: 0, reason: "Insufficient data", target: null };

  const prevRange = prev.high - prev.low;
  if (prevRange === 0) return { bias: "NEUTRAL", score: 0, reason: "Zero range candle", target: null };

  // 1. Inside Candle Check (Neutral Rule from Video)
  const isInsideBar = curr.high <= prev.high && curr.low >= prev.low;
  if (isInsideBar) {
    return {
      bias: "NEUTRAL",
      score: 0,
      reason: "Inside Candle (Range bound - No fresh breakout/sweep)",
      target: null
    };
  }

  // 2. Reversal Pattern: Liquidity Sweep & Reject
  const sweptLow = curr.low < prev.low && curr.close > prev.low;
  const sweptHigh = curr.high > prev.high && curr.close < prev.high;

  // Outside Bar (Both sides swept)
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
      reason: "Bullish Reversal: Previous Low Swept & Rejected (Closed above prev low)",
      target: curr.high
    };
  }

  if (sweptHigh) {
    return {
      bias: "BEARISH",
      score: -2.5,
      reason: "Bearish Reversal: Previous High Swept & Rejected (Closed below prev high)",
      target: curr.low
    };
  }

  // 3. Continuation Pattern: Close Beyond Previous High/Low
  const closedAboveHigh = curr.close > prev.high;
  const closedBelowLow = curr.close < prev.low;

  // Candle Anatomy Check (Upper/Lower Wick Rejection)
  const currRange = curr.high - curr.low || 1;
  const upperWickRatio = (curr.high - Math.max(curr.open, curr.close)) / currRange;
  const lowerWickRatio = (Math.min(curr.open, curr.close) - curr.low) / currRange;

  if (closedAboveHigh) {
    // If massive upper wick rejection (>45%), warn about exhaustion/pullback
    if (upperWickRatio > 0.45) {
      return {
        bias: "BULLISH",
        score: 1.0,
        reason: "Bullish Continuation (Closed above High, but heavy top wick rejection - expect dip first)",
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
        reason: "Bearish Continuation (Closed below Low, but heavy bottom wick rejection - expect pullback first)",
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

  return { bias: "NEUTRAL", score: 0, reason: "No clear sweep or close beyond", target: null };
}

// Check 4-Candle Exhaustion Rule (from Video TST Concept)
function checkExhaustion(candles) {
  if (!candles || candles.length < 4) return 0;
  const last4 = candles.slice(-4);
  const allBull = last4.every(c => c.close > c.open);
  const allBear = last4.every(c => c.close < c.open);

  if (allBull) return -0.75; // 4 consecutive green candles -> pullback/reversal risk
  if (allBear) return 0.75;  // 4 consecutive red candles -> bounce/reversal risk
  return 0;
}

// Check 4H / 1H Intraday Alignment & Structure
function analyzeIntradayStructure(candles) {
  if (!candles || candles.length < 5) return { bias: "NEUTRAL", score: 0, reason: "Insufficient intraday candles" };

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

  return { bias: "NEUTRAL", score: 0, reason: "Intraday Consolidating" };
}

/**
 * Main Top-Down Daily Bias Calculator
 * Pass closed candles arrays for: monthly (mn), weekly (wk), daily (d1), 4H (h4), 1H (h1)
 */
function calculateTopDownDailyBias({ mn = [], wk = [], d1 = [], h4 = [], h1 = [] }) {
  // Use last 2 CLOSED candles for HTF to avoid developing candle repainting
  const mnAnalysis = mn.length >= 2 ? analyzeCandleBias(mn[mn.length - 2], mn[mn.length - 1]) : { bias: "NEUTRAL", score: 0, reason: "N/A" };
  const wkAnalysis = wk.length >= 2 ? analyzeCandleBias(wk[wk.length - 2], wk[wk.length - 1]) : { bias: "NEUTRAL", score: 0, reason: "N/A" };
  const d1Analysis = d1.length >= 2 ? analyzeCandleBias(d1[d1.length - 2], d1[d1.length - 1]) : { bias: "NEUTRAL", score: 0, reason: "N/A" };

  const h4Analysis = analyzeIntradayStructure(h4);
  const h1Analysis = analyzeIntradayStructure(h1);
  const d1Exhaustion = checkExhaustion(d1);

  // Top-Down Weighted Scoring (Daily & Weekly hold primary weight for Next-Day Bias)
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

  // Previous Day High / Low (Strictly from last closed daily candle)
  const lastClosedDay = d1[d1.length - 1] || {};
  const pdh = lastClosedDay.high || null;
  const pdl = lastClosedDay.low || null;

  // Determine Primary Liquidity Target & Opening Price Rule
  let drawOnLiquidity = null;
  let executionNote = "Wait for clear HTF sweep or close beyond.";

  if (finalBias === "BULLISH") {
    drawOnLiquidity = pdh;
    executionNote = "Opening Price Rule: Look for buys BELOW Daily Open (in discount/POI) targeting PDH.";
  } else if (finalBias === "BEARISH") {
    drawOnLiquidity = pdl;
    executionNote = "Opening Price Rule: Look for sells ABOVE Daily Open (in premium/POI) targeting PDL.";
  }

  return {
    dailyBias: finalBias,
    confidenceScore: Number(totalScore.toFixed(2)),
    drawOnLiquidity,
    pdh,
    pdl,
    executionNote,
    breakdown: {
      monthly: mnAnalysis,
      weekly: wkAnalysis,
      daily: d1Analysis,
      h4: h4Analysis,
      h1: h1Analysis,
      exhaustionAdjustment: d1Exhaustion
    }
  };
}

// Export for module or browser global usage
if (typeof module !== "undefined" && module.exports) {
  module.exports = { calculateTopDownDailyBias, analyzeCandleBias };
}
