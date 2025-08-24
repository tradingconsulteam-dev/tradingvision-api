module.exports = async (req, res) => {
  try {
    const symbol = String(req.query.symbol || "").trim();
    if (!symbol) return res.status(400).json({ error: "Missing symbol" });

    const token = process.env.FINNHUB;
    const [profileR, metricsR, peersR] = await Promise.all([
      fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${token}`),
      fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all&token=${token}`),
      fetch(`https://finnhub.io/api/v1/stock/peers?symbol=${encodeURIComponent(symbol)}&token=${token}`)
    ]);

    const profile = await profileR.json();
    const metrics = await metricsR.json();
    const peers   = await peersR.json();

    const m = metrics.metric || {};
    const out = {
      symbol,
      name: profile.name, exchange: profile.exchange, currency: profile.currency, country: profile.country,
      marketCap: m.marketCapitalization, peRatio: m.peTTM, eps: m.epsTTM, divYield: m.dividendYieldIndicatedAnnual,
      fiftyTwoWeekHigh: m['52WeekHigh'], fiftyTwoWeekLow: m['52WeekLow'],
      beta: m.beta, revenueTTM: m.revenueTTM, netProfitMarginTTM: m.netProfitMarginTTM,
      peers: Array.isArray(peers) ? peers.slice(0,10) : []
    };
    res.setHeader("Cache-Control","s-maxage=3600, stale-while-revalidate=7200");
    res.status(200).json(out);
  } catch { res.status(500).json({ error: "fundamentals-failed" }); }
};
