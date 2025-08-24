// /api/quotes-sse.js
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

module.exports = async (req, res) => {
  const finnhub = process.env.FINNHUB;
  const twelvedata = process.env.TWELVEDATA || "";

  const symbols = String(req.query.symbols || "AAPL,MSFT,OANDA:EUR_USD,BINANCE:BTCUSDT")
    .split(",").map(s => s.trim()).slice(0, 8);

  res.setHeader("Content-Type","text/event-stream");
  res.setHeader("Cache-Control","no-cache, no-transform");
  res.setHeader("Connection","keep-alive");
  res.flushHeaders && res.flushHeaders();

  let active = true;
  req.on("close", ()=> { active = false; });

  const fetchJson = async (url) => {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`fetch ${r.status}`);
    return r.json();
  };

  async function lastStock(sym){
    const q = await fetchJson(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${finnhub}`);
    return { symbol: sym, last: q.c ?? null, ts: Date.now() };
  }
  async function lastCrypto(sym){
    const base = sym.split(":")[1] || sym;
    const r = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(base)}`);
    if (!r.ok) throw new Error("binance");
    const j = await r.json();
    return { symbol: sym, last: parseFloat(j.price), ts: Date.now() };
  }
  async function lastForex(sym){
    if (!twelvedata) throw new Error("twelvedata-missing");
    const base = sym.split(":")[1]?.replace("_","/") || sym.replace("_","/");
    // usa time_series con 1 ultimo punto (1min)
    const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(base)}&interval=1min&outputsize=1&apikey=${twelvedata}`;
    const j = await fetchJson(url);
    const v = (j.values && j.values[0]) ? parseFloat(j.values[0].close) : null;
    return { symbol: sym, last: v, ts: Date.now() };
  }

  async function getLast(sym){
    try {
      if (!sym.includes(":")) return await lastStock(sym);
      if (sym.startsWith("OANDA:")) return await lastForex(sym);
      if (sym.startsWith("BINANCE:")) return await lastCrypto(sym);
      // fallback generico → crypto
      return await lastCrypto(sym);
    } catch {
      return { symbol: sym, last: null, ts: Date.now() };
    }
  }

  while (active) {
    try {
      const payload = await Promise.all(symbols.map(getLast));
      res.write(`data: ${JSON.stringify({ type: "quotes", payload })}\n\n`);
    } catch {
      res.write(`data: ${JSON.stringify({ type: "error", message: "fetch-failed" })}\n\n`);
    }
    await sleep(3000);
  }
  res.end();
};
