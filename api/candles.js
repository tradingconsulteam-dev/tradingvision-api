// /api/candles.js
module.exports = async (req, res) => {
  try {
    const token = process.env.FINNHUB;
    const symbol = String(req.query.symbol || "").trim();
    const resolution = String(req.query.resolution || "60"); // 1,5,15,30,60,D,W,M
    const now = Math.floor(Date.now() / 1000);
    const from = Number(req.query.from || (now - 7 * 24 * 3600));
    const to = Number(req.query.to || now);
    if (!symbol) return res.status(400).json({ error: "Missing symbol" });

    // Scegli endpoint in base all'asset
    let endpoint = "stock/candle";
    if (symbol.includes(":")) {
      endpoint = symbol.startsWith("OANDA:") ? "forex/candle" : "crypto/candle";
    }

    const url = `https://finnhub.io/api/v1/${endpoint}?symbol=${encodeURIComponent(symbol)}&resolution=${resolution}&from=${from}&to=${to}&token=${token}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error("fetch failed");
    const data = await r.json(); // {s:'ok'|'no_data', t:[], o:[], h:[], l:[], c:[]}

    res.setHeader("Cache-Control","s-maxage=30");
    res.status(200).json({ symbol, resolution, ...data });
  } catch (e) {
    res.status(500).json({ error: "candles-failed" });
  }
};
