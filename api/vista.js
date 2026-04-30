export default async function handler(req, res) {
  const apiKey = process.env.VISTA_SOCIAL_API_KEY;

  // Auto-calculate last 7 days — updates every day automatically
  const today = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(today.getDate() - 7);

  const date_to = today.toISOString().split('T')[0];
  const date_from = sevenDaysAgo.toISOString().split('T')[0];

  const response = await fetch(
    `https://vistasocial.com/api/integration/mcp?api_key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: "getPublishedPostPerformance",
          arguments: { date_from, date_to }
        },
        id: 1
      })
    }
  );

  const data = await response.json();
  res.status(200).json(data);
}
