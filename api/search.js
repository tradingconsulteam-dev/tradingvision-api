module.exports = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) return res.status(400).json({ error: "Missing q" });
    const r = await fetch(`https://finnhub.io/api/v1/search?q=${encodeURIComponent(q)}&token=${process.env.FINNHUB}`);
    const data = await r.json();
    const items = (data.result || []).map(x => ({
      symbol: x.symbol, description: x.description, type: x.type, mic: x.mic, currency: x.currency
    }));
    res.setHeader("Cache-Control","s-maxage=300, stale-while-revalidate=600");
    res.status(200).json({ q, items });
  } catch { res.status(500).json({ error: "search-failed" }); }
};
