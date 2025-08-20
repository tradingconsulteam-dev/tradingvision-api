import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = process.env.FINNHUB!;
  if (!token) return res.status(500).json({ error: 'Missing FINNHUB env var' });

  const symbol = String(req.query.symbol || 'AAPL').toUpperCase();
  const to = new Date();
  const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000); // ultimi 7 giorni
  const fmt = (d: Date) => d.toISOString().slice(0,10);

  const url = `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${fmt(from)}&to=${fmt(to)}&token=${token}`;

  try {
    const r = await fetch(url);
    const rows = await r.json();
    const items = (rows || []).slice(0, 25).map((n: any) => ({
      source: n.source,
      title: n.headline,
      url: n.url,
      ts: (n.datetime || 0) * 1000,
      summary: n.summary
    }));
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    res.status(200).json({ symbol, items });
  } catch (e) {
    res.status(500).json({ error: 'news-fetch-failed' });
  }
}
