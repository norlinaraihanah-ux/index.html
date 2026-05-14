// ============================================================
// TIKTOK TRENDS ENDPOINT
// ------------------------------------------------------------
// Endpoint:  GET /api/tiktok/trends
// Returns:   normalized trend signals (hashtags + audio + creatives)
//            from Lina's approved TREND SPOTTING app, region MY.
//
// Query params (all optional):
//   ?region=MY|SG|US|GB|...   default MY
//   ?limit=20                  per-bucket cap, default 20
//   ?debug=1                   include raw TikTok responses for diagnosis
//
// Failure mode: NEVER 500s. If a bucket fails OR returns empty,
// meta.errors lists what happened so we can fix the URL/params.
// ============================================================

import {
  fetchTrendingHashtags,
  fetchTrendingMusic,
  fetchTopCreatives
} from '../../lib/tiktok.js';

export default async function handler(req, res) {
  const region = String(req.query.region || 'MY').toUpperCase().slice(0, 2);
  const limit  = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 50);
  const debug  = req.query.debug === '1' || req.query.debug === 'true';

  // Cache 10 min at the edge, serve stale for 30 min while revalidating.
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1800');

  const buckets = await Promise.allSettled([
    fetchTrendingHashtags({ region, limit }),
    fetchTrendingMusic({ region, limit: Math.min(limit, 15) }),
    fetchTopCreatives({ region, limit: Math.min(limit, 10) })
  ]);

  const errors = [];
  const debugBlobs = [];

  const pick = (label, settled) => {
    if (settled.status !== 'fulfilled') {
      errors.push({ bucket: label, msg: String(settled.reason) });
      return [];
    }
    const { rows, error, debug: dbg } = settled.value;
    if (error) errors.push({ bucket: label, msg: error });
    if (dbg)   debugBlobs.push({ bucket: label, ...dbg });
    return rows;
  };

  const hashtags  = pick('hashtags',  buckets[0]);
  const audio     = pick('audio',     buckets[1]);
  const creatives = pick('creatives', buckets[2]);

  const order = { peak: 0, rising: 1, watch: 2, unknown: 3, fading: 4 };
  const flat = [...hashtags, ...audio, ...creatives]
    .sort((a, b) => (order[a.momentum] ?? 9) - (order[b.momentum] ?? 9));

  const payload = {
    ok: true,
    source: 'tiktok-app-' + (process.env.TIKTOK_APP_ID || 'unknown'),
    region,
    fetched_at: new Date().toISOString(),
    counts: {
      hashtags:  hashtags.length,
      audio:     audio.length,
      creatives: creatives.length,
      total:     flat.length
    },
    signals: flat,
    by_type: { hashtags, audio, creatives },
    meta: {
      errors,
      degraded: errors.length > 0,
      window_days: 7,
      app_id_set:      !!process.env.TIKTOK_APP_ID,
      app_secret_set:  !!process.env.TIKTOK_APP_SECRET,
    }
  };

  if (debug) payload.meta.debug = debugBlobs;

  res.status(200).json(payload);
}
