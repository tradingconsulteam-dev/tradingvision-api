module.exports = async (req, res) => {
  try {
    const token = process.env.FINNHUB;
    const symbol   = (req.query.symbol || "").toString().trim(); // AAPL, MSFT, BINANCE:BTCUSDT...
    const category = (req.query.category || "").toString().trim(); // general | forex | crypto | ...
    const to = new Date(); const from = new Date(to.getTime() - 7*24*60*60*1000);
    const fmt = d => d.toISOString().slice(0,10);

    let url;
    if (symbol) {
      url = `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${fmt(from)}&to=${fmt(to)}&token=${token}`;
    } else {
      const cat = category || "general";
      url = `https://finnhub.io/api/v1/news?category=${encodeURIComponent(cat)}&token=${token}`;
    }

    const r = await fetch(url); const rows = await r.json();
    const items = (rows || []).slice(0,40).map(n => ({
      source: n.source, title: n.headline || n.title, url: n.url,
      ts: (n.datetime||n.datetime_ts||0)*1000 || Date.now(),
      summary: n.summary || "", related: n.related || ""
    }));
    res.setHeader("Cache-Control","s-maxage=120, stale-while-revalidate=300");
    res.status(200).json({ symbol: symbol || null, category: category || "general", items });
  } catch { res.status(500).json({ error: "news-failed" }); }
};
