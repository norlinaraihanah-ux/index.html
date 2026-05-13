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
//
// Failure mode: NEVER 500s. If a bucket fails, the bucket is
// empty in the response and `meta.errors` lists what broke.
// The dashboard treats empty buckets as "no fresh signal yet"
// and falls back to the manual curator scan + Day-1 baseline.
// ============================================================

import {
  fetchTrendingHashtags,
  fetchTrendingMusic,
  fetchTopCreatives
} from '../../lib/tiktok.js';

export default async function handler(req, res) {
  const region = String(req.query.region || 'MY').toUpperCase().slice(0, 2);
  const limit  = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 50);

  // Cache 10 min at the edge, serve stale for 30 min while revalidating.
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1800');

  const errors = [];
  const buckets = await Promise.allSettled([
    fetchTrendingHashtags({ region, limit }),
    fetchTrendingMusic({ region, limit: Math.min(limit, 15) }),
    fetchTopCreatives({ region, limit: Math.min(limit, 10) })
  ]);

  const [hashtagsR, musicR, creativesR] = buckets;

  const hashtags  = hashtagsR.status  === 'fulfilled' ? hashtagsR.value  : (errors.push({ bucket: 'hashtags',  msg: String(hashtagsR.reason)  }), []);
  const audio     = musicR.status     === 'fulfilled' ? musicR.value     : (errors.push({ bucket: 'audio',     msg: String(musicR.reason)     }), []);
  const creatives = creativesR.status === 'fulfilled' ? creativesR.value : (errors.push({ bucket: 'creatives', msg: String(creativesR.reason) }), []);

  // Flat ranked list — what the dashboard widget actually renders.
  // Order: peak → rising → watch → fading, then by rank.
  const order = { peak: 0, rising: 1, watch: 2, unknown: 3, fading: 4 };
  const flat = [...hashtags, ...audio, ...creatives]
    .sort((a, b) => (order[a.momentum] ?? 9) - (order[b.momentum] ?? 9));

  res.status(200).json({
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
      window_days: 7
    }
  });
}
