// ============================================================
// TIKTOK API CLIENT — PRODUCTION
// ------------------------------------------------------------
// Uses the long-lived access_token + advertiser_id obtained
// from the TREND SPOTTING app's authorization flow
// (App ID 7639294468662919169). Token + advertiser_id are
// stored in Vercel env vars after the user authorizes the app
// via /api/tiktok/callback.
//
// Endpoint surface = production Business API:
//   https://business-api.tiktok.com/open_api/v1.3/...
//
// All three buckets use the same unified /discovery/trending_list/
// endpoint, differing only by discovery_type:
//   - HASHTAG  → trending hashtags
//   - SONG     → trending songs (Commercial Music Library)
//   - INDUSTRY → trending industries / verticals
//
// Each public function returns { rows, error, debug } so the
// /api/tiktok/trends endpoint can render per-bucket health
// without ever failing the whole request.
// ============================================================

const ACCESS_TOKEN   = process.env.TIKTOK_ACCESS_TOKEN;
const ADVERTISER_ID  = process.env.TIKTOK_ADVERTISER_ID;

const DISCOVERY_TRENDING_URL = process.env.TIKTOK_DISCOVERY_TRENDING_URL
  || 'https://business-api.tiktok.com/open_api/v1.3/discovery/trending_list/';

/**
 * Internal — call a TikTok Business API endpoint with the
 * long-lived access_token from env. Returns parsed JSON or an
 * error envelope. Never throws upward.
 */
async function callTikTok(url, params = {}) {
  if (!ACCESS_TOKEN) {
    return { ok: false, error: 'Missing TIKTOK_ACCESS_TOKEN env var.', data: null, raw: null };
  }
  if (!ADVERTISER_ID) {
    return { ok: false, error: 'Missing TIKTOK_ADVERTISER_ID env var.', data: null, raw: null };
  }

  // advertiser_id is required for every Business API call
  const fullParams = { advertiser_id: ADVERTISER_ID, ...params };

  // Build query string — TikTok Business API uses GET with params in URL
  const qs = new URLSearchParams(
    Object.entries(fullParams).reduce((acc, [k, v]) => {
      acc[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
      return acc;
    }, {})
  ).toString();
  const fullUrl = qs ? `${url}?${qs}` : url;

  try {
    const res = await fetch(fullUrl, {
      method:  'GET',
      headers: {
        'Access-Token':  ACCESS_TOKEN,
        'Content-Type':  'application/json'
      }
    });

    const json = await res.json().catch(() => ({}));

    // TikTok's Business API returns code !== 0 even on HTTP 200
    if (!res.ok || (json.code !== undefined && json.code !== 0)) {
      const msg = json?.message || `HTTP ${res.status}`;
      console.warn(`[tiktok] ${url} failed:`, JSON.stringify(json).slice(0, 200));
      return { ok: false, error: msg, data: null, raw: json, status: res.status };
    }
    return { ok: true, data: json.data || json, raw: json, status: res.status };
  } catch (err) {
    console.warn(`[tiktok] ${url} threw:`, err.message);
    return { ok: false, error: err.message, data: null, raw: null };
  }
}

// ------------------------------------------------------------
// Public methods — each returns a normalized array of `signal`
// objects shaped for the dashboard's Trend Radar widget.
// ------------------------------------------------------------

/**
 * Trending hashtags via /discovery/trending_list/ (discovery_type: HASHTAG).
 */
export async function fetchTrendingHashtags({ region = 'MY', limit = 20 } = {}) {
  const params = {
    country_code:   region,
    period:         7,
    page_size:      limit,
    discovery_type: 'HASHTAG'
  };
  const r = await callTikTok(DISCOVERY_TRENDING_URL, params);

  const debug = {
    url:           DISCOVERY_TRENDING_URL,
    params,
    status:        r.status ?? null,
    response_keys: r.raw ? Object.keys(r.raw) : null,
    raw_sample:    r.raw ? JSON.stringify(r.raw).slice(0, 300) : null,
  };

  if (!r.ok) return { rows: [], error: r.error || 'unknown', debug };

  const rows = r.data?.list || r.data?.items || [];
  return {
    rows: rows.map((row) => ({
      type:     'hashtag',
      label:    `#${row.hashtag_name || row.name || ''}`,
      rank:     row.rank ?? null,
      momentum: momentumLabel(row.trend || row.publish_cnt_growth_rate),
      region,
      raw:      row
    })),
    error: rows.length === 0 ? 'response ok but list is empty' : null,
    debug
  };
}

/**
 * Trending songs via /discovery/trending_list/ (discovery_type: SONG).
 * Replaces the old /commercial_music/list/ guess. Production-only —
 * was rejected on sandbox.
 */
export async function fetchTrendingMusic({ region = 'MY', limit = 15 } = {}) {
  const params = {
    country_code:   region,
    period:         7,
    page_size:      limit,
    discovery_type: 'SONG'
  };
  const r = await callTikTok(DISCOVERY_TRENDING_URL, params);

  const debug = {
    url:           DISCOVERY_TRENDING_URL,
    params,
    status:        r.status ?? null,
    response_keys: r.raw ? Object.keys(r.raw) : null,
    raw_sample:    r.raw ? JSON.stringify(r.raw).slice(0, 300) : null,
  };

  if (!r.ok) return { rows: [], error: r.error || 'unknown', debug };

  const rows = r.data?.list || r.data?.items || r.data?.musics || [];
  return {
    rows: rows.map((row) => ({
      type:       'audio',
      label:      row.song_title || row.title || row.song_name || row.name || '(unnamed track)',
      artist:     row.artist || row.author || row.singer || null,
      duration_s: row.duration || null,
      momentum:   momentumLabel(row.trend || row.popularity_score || row.rank_diff),
      region,
      raw:        row
    })),
    error: rows.length === 0 ? 'response ok but list is empty' : null,
    debug
  };
}

/**
 * Trending industries via /discovery/trending_list/ (discovery_type: INDUSTRY).
 * Replaces the old /creative/recommend/ guess. Returns trending verticals
 * in TikTok ads — useful as "what categories are hot" signal.
 */
export async function fetchTopCreatives({ region = 'MY', limit = 10 } = {}) {
  const params = {
    country_code:   region,
    period:         7,
    page_size:      limit,
    discovery_type: 'INDUSTRY'
  };
  const r = await callTikTok(DISCOVERY_TRENDING_URL, params);

  const debug = {
    url:           DISCOVERY_TRENDING_URL,
    params,
    status:        r.status ?? null,
    response_keys: r.raw ? Object.keys(r.raw) : null,
    raw_sample:    r.raw ? JSON.stringify(r.raw).slice(0, 300) : null,
  };

  if (!r.ok) return { rows: [], error: r.error || 'unknown', debug };

  const rows = r.data?.list || r.data?.items || [];
  return {
    rows: rows.map((row) => ({
      type:     'creative',
      label:    row.industry_name || row.title || row.name || '(unnamed industry)',
      hook:     row.first_3s_hook || row.opening_hook || null,
      ctr:      row.ctr || null,
      momentum: momentumLabel(row.trend || row.score),
      region,
      raw:      row
    })),
    error: rows.length === 0 ? 'response ok but list is empty' : null,
    debug
  };
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

function momentumLabel(score) {
  if (score == null) return 'unknown';
  const n = Number(score);
  if (Number.isNaN(n)) {
    const s = String(score).toLowerCase();
    if (s.includes('rising'))  return 'rising';
    if (s.includes('peak'))    return 'peak';
    if (s.includes('fading'))  return 'fading';
    return 'watch';
  }
  if (n >= 0.5)  return 'peak';
  if (n >= 0.1)  return 'rising';
  if (n <= -0.1) return 'fading';
  return 'watch';
}
