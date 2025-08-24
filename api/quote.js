module.exports = async (req, res) => {
  try {
    const symbol = String(req.query.symbol || "");
    if (!symbol) return res.status(400).json({ error: "Missing symbol" });
    const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${process.env.FINNHUB}`);
    const q = await r.json();
    res.setHeader("Cache-Control","s-maxage=2");
    res.status(200).json({ symbol, ...q, ts: Date.now() });
  } catch { res.status(500).json({ error: "quote-failed" }); }
};
