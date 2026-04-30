export default async function handler(req, res) {
  const apiKey = process.env.VISTA_SOCIAL_API_KEY;

  const today = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(today.getDate() - 7);
  const date_to = today.toISOString().split('T')[0];
  const date_from = sevenDaysAgo.toISOString().split('T')[0];

  const allProfiles = [668259, 668291, 674522, 674523, 668258, 668292, 674087, 674524];

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
          arguments: { date_from, date_to, profile_ids: allProfiles }
        },
        id: 1
      })
    }
  );

  const data = await response.json();
  res.status(200).json(data);
}
