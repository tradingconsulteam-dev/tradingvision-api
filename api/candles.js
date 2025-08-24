// /api/candles.js
module.exports = async (req, res) => {
  try {
    const finnhub = process.env.FINNHUB;
    const twelvedata = process.env.TWELVEDATA || "";
    const symbol = String(req.query.symbol || "").trim();       // AAPL | OANDA:EUR_USD | BINANCE:BTCUSDT
    let resolution = String(req.query.resolution || "60").toUpperCase(); // 1,5,15,30,60,D,W,M
    if (!symbol) return res.status(400).json({ error: "Missing symbol" });

    const intraday = ["1","5","15","30","60"].includes(resolution);
    const now = Math.floor(Date.now()/1000);
    const fromDefault = intraday ? (now - 10*24*3600) : (now - 500*24*3600);
    const from = Number(req.query.from || fromDefault);
    const to   = Number(req.query.to   || now);

    // Helpers
    const mapTdInterval = (r) => ({ "1":"1min","5":"5min","15":"15min","30":"30min","60":"1h","D":"1day","W":"1week","M":"1month" }[r] || "1h");
    const mapBinanceInterval = (r) => ({ "1":"1m","5":"5m","15":"15m","30":"30m","60":"1h","D":"1d","W":"1w","M":"1M" }[r] || "1h");
    const ok = (arr) => Array.isArray(arr) && arr.length;

    const send = (payload) => {
      res.setHeader("Cache-Control","s-maxage=30");
      res.status(200).json({ symbol, resolution, ...payload });
    };

    // STOCKS (default) via Finnhub
    async function candlesStock(sym){
      const url = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(sym)}&resolution=${resolution}&from=${from}&to=${to}&token=${finnhub}`;
      const r = await fetch(url);
      const txt = await r.text();
      if (!r.ok) throw new Error(`finnhub-stock ${r.status} ${txt.slice(0,200)}`);
      const data = JSON.parse(txt);
      return data; // { s, t, o, h, l, c }
    }

    // FOREX via Twelve Data (fallback)
    async function candlesForex(sym){
      if (!twelvedata) throw new Error("twelvedata-missing");
      // OANDA:EUR_USD -> EUR/USD
      const base = sym.split(":")[1]?.replace("_","/") || sym.replace("_","/");
      const interval = mapTdInterval(resolution);
      const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(base)}&interval=${interval}&outputsize=500&apikey=${twelvedata}`;
      const r = await fetch(url);
      const j = await r.json();
      if (j.status === "error" || !j.values) throw new Error(`twelvedata ${j.message || "bad response"}`);
      // TD restituisce array decrescente per datetime
      const vals = j.values.slice().reverse();
      const t = [], o=[], h=[], l=[], c=[];
      for (const v of vals) {
        t.push(Math.floor(new Date(v.datetime).getTime()/1000));
        o.push(parseFloat(v.open)); h.push(parseFloat(v.high)); l.push(parseFloat(v.low)); c.push(parseFloat(v.close));
      }
      return { s: ok(t) ? "ok":"no_data", t, o, h, l, c };
    }

    // CRYPTO via Binance (fallback)
    async function candlesCrypto(sym){
      // BINANCE:BTCUSDT -> BTCUSDT
      const base = sym.split(":")[1] || sym;
      const interval = mapBinanceInterval(resolution);
      // Binance limita outputsize max 1000; prendiamo 500
      const url = `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(base)}&interval=${interval}&limit=500`;
      const r = await fetch(url);
      if (!r.ok) throw new Error(`binance ${r.status}`);
      const rows = await r.json(); // [[openTime,open,high,low,close,volume,closeTime,...], ...]
      const t=[], o=[], h=[], l=[], c=[];
      rows.forEach(k=>{
        t.push(Math.floor(k[0]/1000));
        o.push(parseFloat(k[1]));
        h.push(parseFloat(k[2]));
        l.push(parseFloat(k[3]));
        c.push(parseFloat(k[4]));
      });
      return { s: ok(t) ? "ok":"no_data", t, o, h, l, c };
    }

    // Router per asset
    let out;
    if (symbol.includes(":")) {
      if (symbol.startsWith("OANDA:")) {
        // FOREX
        try { out = await candlesForex(symbol); }
        catch (e) { return res.status(502).json({ error:"forex-fallback-failed", details: e.message }); }
      } else if (symbol.startsWith("BINANCE:")) {
        // CRYPTO
        try { out = await candlesCrypto(symbol); }
        catch (e) { return res.status(502).json({ error:"crypto-fallback-failed", details: e.message }); }
      } else {
        // altro broker → prova crypto fallback
        try { out = await candlesCrypto(symbol); }
        catch (e) { return res.status(502).json({ error:"unknown-broker", details: e.message }); }
      }
    } else {
      // STOCK
      try { out = await candlesStock(symbol); }
      catch (e) { return res.status(502).json({ error:"stock-upstream", details: e.message }); }
    }

    return send(out);

  } catch (e) {
    return res.status(500).json({ error: "candles-failed", details: e?.message || "unknown" });
  }
};
