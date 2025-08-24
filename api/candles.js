module.exports = async (req, res) => {
  try {
    const symbol = String(req.query.symbol || "");
    const resolution = String(req.query.resolution || "60"); // 1,5,15,30,60,D,W,M
    const now = Math.floor(Date.now()/1000);
    const from = Number(req.query.from || (now - 7*24*3600));
    const to   = Number(req.query.to   || now);
    if (!symbol) return res.status(400).json({ error: "Missing symbol" });
    const url = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=${resolution}&from=${from}&to=${to}&token=${process.env.FINNHUB}`;
    const r = await fetch(url); const data = await r.json();
    res.setHeader("Cache-Control","s-maxage=30");
    res.status(200).json({ symbol, resolution, ...data });
  } catch { res.status(500).json({ error: "candles-failed" }); }
};
