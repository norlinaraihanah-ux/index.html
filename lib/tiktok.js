// ============================================================
// TIKTOK API CLIENT
// ------------------------------------------------------------
// Wraps Lina's TREND SPOTTING app (App ID 7639294468662919169)
// against the TikTok Ads SANDBOX. Auth is a long-lived access
// token + advertiser ID supplied via env vars — no OAuth flow.
//
// Required env:
//   - TIKTOK_ACCESS_TOKEN   (sandbox token)
//   - TIKTOK_ADVERTISER_ID  (sandbox advertiser ID)
// ============================================================

// Trending hashtags — only HASHTAG is a valid discovery_type on this endpoint in sandbox
const DISCOVERY_TRENDING_URL = process.env.TIKTOK_DISCOVERY_TRENDING_URL
  || 'https://sandbox-ads.tiktok.com/open_api/v1.3/discovery/trending_list/';

// Music — Commercial Music Library trending tracks (separate endpoint, no discovery_type)
const MUSIC_TRENDING_URL = process.env.TIKTOK_MUSIC_TRENDING_URL
  || 'https://sandbox-ads.tiktok.com/open_api/v1.3/discovery/cml/trending_list/';

// Creatives — top videos from Commercial Music Library
const CREATIVE_TOP_ADS_URL = process.env.TIKTOK_CREATIVE_TOP_ADS_URL
  || 'https://sandbox-ads.tiktok.com/open_api/v1.3/discovery/cml/video_list/';

async function callTikTok(url, params = {}) {
  const token = process.env.TIKTOK_ACCESS_TOKEN;
  if (!token) {
    return { ok: false, error: 'Missing TIKTOK_ACCESS_TOKEN', data: null };
  }
  const qs = new URLSearchParams(params).toString();
  const fullUrl = qs ? `${url}?${qs}` : url;
  try {
    const res = await fetch(fullUrl, {
      method:  'GET',
      headers: {
        'Access-Token':  token,
        'Content-Type':  'application/json'
      }
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.warn(`[tiktok] ${url} failed (${res.status}):`, JSON.stringify(json).slice(0, 200));
      return { ok: false, error: json?.message || `HTTP ${res.status}`, data: null };
    }
    return { ok: true, data: json.data || json, raw: json };
  } catch (err) {
    console.warn(`[tiktok] ${url} threw:`, err.message);
    return { ok: false, error: err.message, data: null };
  }
}

// ------------------------------------------------------------
// Public methods
// ------------------------------------------------------------

export async function fetchTrendingHashtags({ region = 'MY', limit = 20 } = {}) {
  const params = {
    advertiser_id:  process.env.TIKTOK_ADVERTISER_ID,
    discovery_type: 'HASHTAG',
    country_code:   region,
    period:         7,
    page_size:      limit,
    industry_id:    '20000000'
  };
  const r = await callTikTok(DISCOVERY_TRENDING_URL, params);
  const debug = {
    url:           DISCOVERY_TRENDING_URL,
    params,
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

export async function fetchTrendingMusic({ region = 'MY', limit = 15 } = {}) {
  const params = {
    advertiser_id: process.env.TIKTOK_ADVERTISER_ID,
    country_code:  region,
    page_size:     limit,
    sort:          'popularity'
  };
  const r = await callTikTok(MUSIC_TRENDING_URL, params);
  const debug = {
    url:           MUSIC_TRENDING_URL,
    params,
    response_keys: r.raw ? Object.keys(r.raw) : null,
    raw_sample:    r.raw ? JSON.stringify(r.raw).slice(0, 300) : null,
  };
  if (!r.ok) return { rows: [], error: r.error || 'unknown', debug };
  const rows = r.data?.list || r.data?.items || r.data?.musics || [];
  return {
    rows: rows.map((row) => ({
      type:       'audio',
      label:      row.title || row.song_name || row.name || '(unnamed track)',
      artist:     row.artist || row.author || null,
      duration_s: row.duration || null,
      momentum:   momentumLabel(row.popularity_score || row.rank_diff),
      region,
      raw:        row
    })),
    error: rows.length === 0 ? 'response ok but list is empty' : null,
    debug
  };
}

export async function fetchTopCreatives({ region = 'MY', limit = 10 } = {}) {
  const params = {
    advertiser_id: process.env.TIKTOK_ADVERTISER_ID,
    country_code:  region,
    industry:      'gaming',
    period:        7,
    page_size:     limit
  };
  const r = await callTikTok(CREATIVE_TOP_ADS_URL, params);
  const debug = {
    url:           CREATIVE_TOP_ADS_URL,
    params,
    response_keys: r.raw ? Object.keys(r.raw) : null,
    raw_sample:    r.raw ? JSON.stringify(r.raw).slice(0, 300) : null,
  };
  if (!r.ok) return { rows: [], error: r.error || 'unknown', debug };
  const rows = r.data?.list || r.data?.items || [];
  return {
    rows: rows.map((row) => ({
      type:     'creative',
      label:    row.title || row.ad_title || row.brand || '(unnamed creative)',
      hook:     row.first_3s_hook || row.opening_hook || null,
      ctr:      row.ctr || null,
      momentum: momentumLabel(row.score || row.trend),
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
