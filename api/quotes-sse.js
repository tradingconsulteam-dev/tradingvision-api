export default function handler(req, res) {
  const { symbols } = req.query;

  if (!symbols) {
    res.status(400).json({ error: "Missing symbols parameter" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const ws = new WebSocket(`wss://ws.finnhub.io?token=${process.env.FINNHUB}`);

  ws.onopen = () => {
    symbols.split(",").forEach(sym => {
      ws.send(JSON.stringify({ type: "subscribe", symbol: sym }));
    });
  };

  ws.onmessage = (event) => {
    res.write(`data: ${event.data}\n\n`);
  };

  req.on("close", () => {
    ws.close();
    res.end();
  });
}
