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

  let posts = [];
  let columns = [];
  try {
    const text = raw.result.content[0].text;
    const parsed = JSON.parse(text);
    columns = parsed.columns || [];
    posts = parsed.rows || [];
  } catch(e) {
    return res.status(200).json({ error: "parse_failed", raw });
  }

  // Find column indexes dynamically
  const idx = (name) => columns.indexOf(name);
  const iImp  = idx("impressions");
  const iEng  = idx("engagement");
  const iNet  = idx("network");
  const iPgid = idx("profile_gid");

  // Aggregate by profile_gid
  const stats = {};
  for (const post of posts) {
    const pgid = post[iPgid];
    const net  = post[iNet];
    if (!stats[pgid]) stats[pgid] = { impressions: 0, engagement: 0, posts: 0, network: net };
    stats[pgid].impressions += Number(post[iImp]) || 0;
    stats[pgid].engagement  += Number(post[iEng]) || 0;
    stats[pgid].posts       += 1;
  }

  res.status(200).json({ date_from, date_to, columns, stats, G2G_PROFILES, OFFGAMERS_PROFILES });
}
