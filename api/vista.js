export default async function handler(req, res) {
  const apiKey = process.env.VISTA_SOCIAL_API_KEY;

  const today = new Date();
  
  // Current 7 days
  const curr_to = new Date(today);
  const curr_from = new Date(today);
  curr_from.setDate(today.getDate() - 7);

  // Previous 7 days (days 8-14)
  const prev_to = new Date(curr_from);
  const prev_from = new Date(curr_from);
  prev_from.setDate(prev_from.getDate() - 7);

  const fmt = d => d.toISOString().split('T')[0];

  const G2G_PROFILES =       { facebook: 668259, instagram: 668291, linkedin: 674522, tiktok: 674523 };
  const OFFGAMERS_PROFILES = { facebook: 668258, instagram: 668292, tiktok: 674087,  linkedin: 674524 };
  const allProfiles = [...Object.values(G2G_PROFILES), ...Object.values(OFFGAMERS_PROFILES)];

  async function fetchPeriod(date_from, date_to) {
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
    let posts = [], columns = [];
    try {
      const text = raw.result.content[0].text;
      const parsed = JSON.parse(text);
      columns = parsed.columns || [];
      posts = parsed.rows || [];
    } catch(e) { return {}; }

    const idx = (name) => columns.indexOf(name);
    const iImp  = idx("impressions");
    const iEng  = idx("engagement");
    const iNet  = idx("network");
    const iPgid = idx("profile_gid");

    const stats = {};
    for (const post of posts) {
      const pgid = post[iPgid];
      const net  = post[iNet];
      if (!stats[pgid]) stats[pgid] = { impressions: 0, engagement: 0, posts: 0, network: net };
      stats[pgid].impressions += Number(post[iImp]) || 0;
      stats[pgid].engagement  += Number(post[iEng]) || 0;
      stats[pgid].posts       += 1;
    }
    return stats;
  }

  // Fetch both periods in parallel
  const [currStats, prevStats] = await Promise.all([
    fetchPeriod(fmt(curr_from), fmt(curr_to)),
    fetchPeriod(fmt(prev_from), fmt(prev_to))
  ]);

  // Calculate WoW % change
  const wow = (curr, prev) => {
    if (!prev || prev === 0) return 0;
    return Math.round(((curr - prev) / prev) * 100);
  };

  const wowStats = {};
  for (const id of Object.keys(currStats)) {
    const c = currStats[id];
    const p = prevStats[id] || { impressions: 0, engagement: 0, posts: 0 };
    wowStats[id] = {
      ...c,
      wow_impressions: wow(c.impressions, p.impressions),
      wow_engagement:  wow(c.engagement,  p.engagement),
      wow_posts:       wow(c.posts,        p.posts),
    };
  }

  res.status(200).json({
    date_from: fmt(curr_from), date_to: fmt(curr_to),
    stats: wowStats, G2G_PROFILES, OFFGAMERS_PROFILES
  });
}
