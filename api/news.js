export default async function handler(req, res) {
  const { symbol } = req.query;

  if (!symbol) {
    return res.status(400).json({ error: "Missing symbol parameter" });
  }

  try {
    const response = await fetch(
      `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=2023-01-01&to=2025-12-31&token=${process.env.FINNHUB}`
    );
    const data = await response.json();

    res.status(200).json({ items: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch news" });
  }
}

