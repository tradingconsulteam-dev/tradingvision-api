// /api/quotes-sse.js
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = async (req, res) => {
  const token = process.env.FINNHUB;
  const symbols = String(req.query.symbols || "AAPL,MSFT,OANDA:EUR_USD,BINANCE:BTCUSDT")
    .split(",").map(s => s.trim()).slice(0, 8);

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders && res.flushHeaders();

  let active = true;
  req.on("close", () => { active = false; });

  const fetchJson = async (url) => {
    const r = await fetch(url);
    if (!r.ok) throw new Error("fetch failed");
    return r.json();
  };

  async function getLast(symbol) {
    try {
      // Forex / Crypto: prendi l'ultima candle (1m) come last
      if (symbol.includes(":")) {
        const now = Math.floor(Date.now() / 1000);
        const from = now - 60 * 60; // 1h di margine
        const endpoint = symbol.startsWith("OANDA:") ? "forex/candle" : "crypto/candle";
        const url = `https://finnhub.io/api/v1/${endpoint}?symbol=${encodeURIComponent(symbol)}&resolution=1&from=${from}&to=${now}&token=${token}`;
        const j = await fetchJson(url);
        if (j && j.s === "ok" && Array.isArray(j.c) && j.c.length) {
          const idx = j.c.length - 1;
          return { symbol, last: j.c[idx], ts: (j.t && j.t[idx] ? j.t[idx]*1000 : Date.now()) };
        }
        // fallback
        return { symbol, last: null, ts: Date.now() };
      }

      // Stocks: usa /quote
      const q = await fetchJson(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${token}`);
      return {
        symbol,
        last: q.c ?? null,
        high: q.h ?? null,
        low: q.l ?? null,
        prevClose: q.pc ?? null,
        ts: Date.now()
      };
    } catch {
      return { symbol, last: null, ts: Date.now() };
    }
  }

  while (active) {
    try {
      const quotes = await Promise.all(symbols.map(getLast));
      res.write(`data: ${JSON.stringify({ type: "quotes", payload: quotes })}\n\n`);
    } catch {
      res.write(`data: ${JSON.stringify({ type: "error", message: "fetch-failed" })}\n\n`);
    }
    await sleep(3000); // rispetta rate-limit free
  }
  res.end();
};
