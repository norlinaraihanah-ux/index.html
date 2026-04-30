export default async function handler(req, res) {
  const apiKey = process.env.VISTA_SOCIAL_API_KEY;

  const today = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(today.getDate() - 7);
  const date_to = today.toISOString().split('T')[0];
  const date_from = sevenDaysAgo.toISOString().split('T')[0];

  const G2G_PROFILES =       { facebook: 668259, instagram: 668291, linkedin: 674522, tiktok: 674523 };
  const OFFGAMERS_PROFILES = { facebook: 668258, instagram: 668292, tiktok: 674087,  linkedin: 674524 };
  const allProfiles = [...Object.values(G2G_PROFILES), ...Object.values(OFFGAMERS_PROFILES)];

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

  const raw = await response.json();

  // Parse the text content into JSON
  let posts = [];
  try {
    const text = raw.result.content[0].text;
    const parsed = JSON.parse(text);
    posts = parsed.rows || [];
  } catch(e) {
    return res.status(200).json({ error: "parse_failed", raw });
  }

  // Aggregate by profile
  const stats = {};
  for (const post of posts) {
    const [impressions, engagement, , , , , , source, , , , profile_gid, network] = post;
    if (!stats[profile_gid]) stats[profile_gid] = { impressions: 0, engagement: 0, posts: 0, network };
    stats[profile_gid].impressions += impressions || 0;
    stats[profile_gid].engagement  += engagement  || 0;
    stats[profile_gid].posts       += 1;
  }

  res.status(200).json({ date_from, date_to, stats, G2G_PROFILES, OFFGAMERS_PROFILES });
}
