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
  // Wrap the entire body so we NEVER 500. Any thrown error becomes JSON.
  try {
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

    // Defensive picker — handles BOTH old lib shape (array) and new lib shape ({rows,error,debug})
    const pick = (label, settled) => {
      if (settled.status !== 'fulfilled') {
        errors.push({ bucket: label, msg: String(settled.reason).slice(0, 300) });
        return [];
      }
      const v = settled.value;
      // Old lib version: returns raw array
      if (Array.isArray(v)) {
        if (v.length === 0) errors.push({ bucket: label, msg: 'old lib version — push lib/tiktok.js update for diagnostics' });
        return v;
      }
      // New lib version: returns {rows, error, debug}
      if (v && typeof v === 'object') {
        if (v.error) errors.push({ bucket: label, msg: String(v.error).slice(0, 300) });
        if (v.debug) debugBlobs.push({ bucket: label, ...v.debug });
        return Array.isArray(v.rows) ? v.rows : [];
      }
      errors.push({ bucket: label, msg: 'unexpected return type: ' + typeof v });
      return [];
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
  } catch (err) {
    // Last-resort safety net — return JSON, not 500
    res.status(200).json({
      ok: false,
      error: err.message,
      stack: String(err.stack || '').slice(0, 800),
      counts: { hashtags: 0, audio: 0, creatives: 0, total: 0 },
      signals: [],
      by_type: { hashtags: [], audio: [], creatives: [] },
      meta: { errors: [{ bucket: 'handler', msg: err.message }], degraded: true }
    });
  }
}
