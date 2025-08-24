// /api/candles.js
module.exports = async (req, res) => {
  try {
    const token = process.env.FINNHUB;
    const symbol = String(req.query.symbol || "").trim();
    let resolution = String(req.query.resolution || "60").toUpperCase(); // 1,5,15,30,60,D,W,M

    if (!symbol) return res.status(400).json({ error: "Missing symbol" });

    // Normalizza alcuni alias comuni
    const intraday = ["1","5","15","30","60"].includes(resolution);
    if (resolution === "1M") resolution = "M"; // nel dubbio

    // Scegli endpoint in base all'asset
    let endpoint = "stock/candle"; // default azioni/indici/ETF
    if (symbol.includes(":")) {
      // Formati tipici: OANDA:EUR_USD (forex), BINANCE:BTCUSDT (crypto)
      endpoint = symbol.startsWith("OANDA:") ? "forex/candle" : "crypto/candle";
    }

    // Finestra temporale: più ampia per daily/weekly/monthly
    const now = Math.floor(Date.now() / 1000);
    let from;
    if (intraday) {
      // 10 giorni di storia per avere dati anche se mercato chiuso
      from = now - 10 * 24 * 3600;
    } else {
      // 500 giorni per D/W/M
      from = now - 500 * 24 * 3600;
    }
    const to = now;

    const url = `https://finnhub.io/api/v1/${endpoint}?symbol=${encodeURIComponent(symbol)}&resolution=${resolution}&from=${from}&to=${to}&token=${token}`;

    const r = await fetch(url);
    const text = await r.text();
    if (!r.ok) {
      // Mostra il motivo (senza esporre token)
      return res.status(502).json({
        error: "candles-upstream",
        status: r.status,
        endpoint,
        message: text.slice(0, 400)
      });
    }

    // Finnhub risponde comunque 200 con { s: "ok" | "no_data", ... }
    let data;
    try { data = JSON.parse(text); } catch {
      return res.status(502).json({ error: "candles-parse", endpoint, message: text.slice(0, 400) });
    }

    // Passa tutto al client (così vedi t,o,h,l,c e s)
    res.setHeader("Cache-Control", "s-maxage=30");
    return res.status(200).json({ symbol, resolution, endpoint, ...data });

  } catch (e) {
    return res.status(500).json({ error: "candles-failed", details: e?.message || "unknown" });
  }
};

