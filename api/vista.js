async function fetchVistaData() {
  try {
    const res = await fetch('/api/vista');
    const data = await res.json();
    if (!data.stats) return;

    const { stats, G2G_PROFILES, OFFGAMERS_PROFILES } = data;
    const er = (eng, imp) => imp > 0 ? ((eng / imp) * 100).toFixed(1) : 0;

    // Update G2G platforms
    _PLATFORMS_G2G.forEach(p => {
      const name = p.p.toLowerCase();
      const id = String(G2G_PROFILES[name]);  // convert to string
      const s = stats[id];
      if (!s) return;
      p.impressions = s.impressions;
      p.engagement  = s.engagement;
      p.posts       = s.posts;
      p.er          = parseFloat(er(s.engagement, s.impressions));
    });

    // Update OffGamers platforms
    _PLATFORMS_OG.forEach(p => {
      const name = p.p.toLowerCase();
      const id = String(OFFGAMERS_PROFILES[name]);  // convert to string
      const s = stats[id];
      if (!s) return;
      p.impressions = s.impressions;
      p.engagement  = s.engagement;
      p.posts       = s.posts;
      p.er          = parseFloat(er(s.engagement, s.impressions));
    });

    PLATFORMS = CURRENT_BRAND === 'g2g' ? _PLATFORMS_G2G : _PLATFORMS_OG;
    renderMain();
    console.log('✅ Dashboard updated with live Vista Social data!');
  } catch (err) {
    console.warn('Vista Social fetch failed, using mock data:', err);
  }
}
fetchVistaData();
