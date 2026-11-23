# Test plan before live use

- [ ] Monthly/weekly/daily/4H/1H candles load and timestamps are UTC.
- [ ] The currently forming candle is never treated as a confirmed close.
- [ ] PDH/PDL use the previous completed UTC daily candle.
- [ ] A low sweep only counts when low < PDL and close > PDL.
- [ ] A high sweep only counts when high > PDH and close < PDH.
- [ ] Mixed higher-timeframe evidence returns Neutral rather than forcing a direction.
- [ ] Bullish SL is below reference price; bearish SL is above reference price.
- [ ] Bullish targets are above price; bearish targets are below price.
- [ ] Neutral bias shows no SL/TP.
- [ ] Dashboard continues to refresh without duplicate overlapping requests.
- [ ] Compare signals against manually labelled historical BTC periods.
- [ ] Walk-forward test with fees, slippage, funding (if using futures), and realistic execution.
- [ ] Track precision, recall, false-bias rate, max adverse excursion, drawdown and expectancy.
