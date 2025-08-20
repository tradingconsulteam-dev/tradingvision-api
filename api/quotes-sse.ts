import type { VercelRequest, VercelResponse } from '@vercel/node';

const fetchJson = (url: string) => fetch(url).then(r => r.json());

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = process.env.FINNHUB!;
  if (!token) {
    res.status(500).send('Missing FINNHUB env var');
    return;
  }

  // Simboli richiesti via query: ?symbols=AAPL,MSFT,OANDA:EUR_USD,BINANCE:BTCUSDT
  const symbols = String(req.query.symbols || 'AAPL,MSFT,OANDA:EUR_USD,BINANCE:BTCUSDT')
    .split(',').map(s => s.trim()).slice(0, 10);

  // Header SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');

  let active = true;
  req.on('close', () => { active = false; });

  async function loop() {
    while (active) {
      try {
        const quotes = await Promise.all(symbols.map(async (s) => {
          const q = await fetchJson(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(s)}&token=${token}`);
          return { symbol: s, last: q.c, high: q.h, low: q.l, prevClose: q.pc, ts: Date.now() };
        }));
        res.write(`data: ${JSON.stringify({ type: 'quotes', payload: quotes })}\n\n`);
      } catch (e) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'fetch-failed' })}\n\n`);
      }
      // intervallo 3s per evitare rate limit sul free tier
      await new Promise(r => setTimeout(r, 3000));
    }
    res.end();
  }

  loop();
}
