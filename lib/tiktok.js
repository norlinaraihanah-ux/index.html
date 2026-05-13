// ============================================================
// TIKTOK API CLIENT
// ------------------------------------------------------------
// Wraps Lina's TREND SPOTTING app (App ID 7639294468662919169)
// using the 3 approved scopes:
//   - research.data.basic         (Discovery)
//   - research.video.query        (Discovery)
//   - business.creator.insights   (Creative Recommendation)
//   - business.music.read         (Music management)
//
// NOTE: TikTok splits its surface across two base hosts:
//   - open.tiktokapis.com       → developer / research endpoints
//   - business-api.tiktok.com   → ads / business endpoints
//
// We try the developer host first (client_credentials grant),
// then fall back to a safe baseline payload if any call fails so
// the dashboard never breaks. Each path is overridable via env
// in case TikTok bumps the version.
// ============================================================

const APP_ID     = process.env.TIKTOK_APP_ID;
const APP_SECRET = process.env.TIKTOK_APP_SECRET;

const TOKEN_URL = process.env.TIKTOK_TOKEN_URL
  || 'https://open.tiktokapis.com/v2/oauth/token/';

// Discovery — trending hashtags (Business API path; v1.3 confirmed)
const DISCOVERY_TRENDING_URL = process.env.TIKTOK_DISCOVERY_TRENDING_URL
  || 'https://business-api.tiktok.com/open_api/v1.3/discovery/trending_list/';

// Music — Commercial Music Library trending tracks
const MUSIC_TRENDING_URL = process.env.TIKTOK_MUSIC_TRENDING_URL
  || 'https://business-api.tiktok.com/open_api/v1.3/commercial_music/list/';

// Creative Recommendation — top creatives in the gaming vertical
const CREATIVE_TOP_ADS_URL = process.env.TIKTOK_CREATIVE_TOP_ADS_URL
  || 'https://business-api.tiktok.com/open_api/v1.3/creative/recommend/';

// In-process token cache (Vercel warm-instances share this).
let _tokenCache = { token: null, expires_at: 0 };

/**
 * Fetch (or reuse) a TikTok app access token.
 * Uses client_credentials grant — no user consent needed because
 * the scopes Lina was approved for are server-to-server.
 */
async function getAccessToken() {
  if (!APP_ID || !APP_SECRET) {
    throw new Error('Missing TIKTOK_APP_ID or TIKTOK_APP_SECRET env var.');
  }

  // Reuse if cached and >60s of life left.
  if (_tokenCache.token && Date.now() + 60_000 < _tokenCache.expires_at) {
    return _tokenCache.token;
  }

  const body = new URLSearchParams({
    client_key:    APP_ID,
    client_secret: APP_SECRET,
    grant_type:    'client_credentials'
  }).toString();

  const res = await fetch(TOKEN_URL, {
    method:  'POST',
    headers: {
      'Content-Type':   'application/x-www-form-urlencoded',
      'Cache-Control':  'no-cache'
    },
    body
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`TikTok token request failed (${res.status}): ${txt.slice(0, 200)}`);
  }

  const json = await res.json();
  const token = json.access_token || json.data?.access_token;
  const expiresIn = json.expires_in || json.data?.expires_in || 7200;

  if (!token) {
    throw new Error(`TikTok token response missing access_token: ${JSON.stringify(json).slice(0, 200)}`);
  }

  _tokenCache = {
    token,
    expires_at: Date.now() + (expiresIn * 1000)
  };

  return token;
}

/**
 * Internal — call a TikTok endpoint with the cached token.
 * Returns parsed JSON or null on failure (we never throw upward;
 * the dashboard prefers degraded data over a 500).
 */
async function callTikTok(url, params = {}) {
  let token;
  try {
    token = await getAccessToken();
  } catch (err) {
    console.warn('[tiktok] token failure:', err.message);
    return { ok: false, error: err.message, data: null };
  }

  const qs = new URLSearchParams(params).toString();
  const fullUrl = qs ? `${url}?${qs}` : url;

  try {
    const res = await fetch(fullUrl, {
      method:  'GET',
      headers: {
        'Access-Token': token,
        'Authorization': `Bearer ${token}`,  // both header styles, TikTok varies
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
// Public methods — each returns a normalized array of `signal`
// objects shaped for the dashboard's Trend Radar widget.
// ------------------------------------------------------------

/**
 * Trending hashtags for the gaming vertical.
 * @param {object} opts
 * @param {string} opts.region - ISO country, default "MY"
 * @param {number} opts.limit  - max rows, default 20
 */
export async function fetchTrendingHashtags({ region = 'MY', limit = 20 } = {}) {
  const r = await callTikTok(DISCOVERY_TRENDING_URL, {
    country_code: region,
    period:       7,
    page_size:    limit,
    industry_id:  '20000000'   // Gaming — TikTok industry taxonomy
  });

  if (!r.ok) return [];

  const rows = r.data?.list || r.data?.items || [];
  return rows.map((row) => ({
    type:        'hashtag',
    label:       `#${row.hashtag_name || row.name || ''}`,
    rank:        row.rank ?? null,
    momentum:    momentumLabel(row.trend || row.publish_cnt_growth_rate),
    region,
    raw:         row
  }));
}

/**
 * Trending Commercial Music Library tracks.
 * Music management scope = read-only access to the CML.
 */
export async function fetchTrendingMusic({ region = 'MY', limit = 15 } = {}) {
  const r = await callTikTok(MUSIC_TRENDING_URL, {
    country_code: region,
    page_size:    limit,
    sort:         'popularity'
  });

  if (!r.ok) return [];

  const rows = r.data?.list || r.data?.items || r.data?.musics || [];
  return rows.map((row) => ({
    type:        'audio',
    label:       row.title || row.song_name || row.name || '(unnamed track)',
    artist:      row.artist || row.author || null,
    duration_s:  row.duration || null,
    momentum:    momentumLabel(row.popularity_score || row.rank_diff),
    region,
    raw:         row
  }));
}

/**
 * Creative Recommendation — top-performing ad creatives in gaming.
 * Used as a signal for "what format/hook is winning right now".
 */
export async function fetchTopCreatives({ region = 'MY', limit = 10 } = {}) {
  const r = await callTikTok(CREATIVE_TOP_ADS_URL, {
    country_code: region,
    industry:     'gaming',
    period:       7,
    page_size:    limit
  });

  if (!r.ok) return [];

  const rows = r.data?.list || r.data?.items || [];
  return rows.map((row) => ({
    type:        'creative',
    label:       row.title || row.ad_title || row.brand || '(unnamed creative)',
    hook:        row.first_3s_hook || row.opening_hook || null,
    ctr:         row.ctr || null,
    momentum:    momentumLabel(row.score || row.trend),
    region,
    raw:         row
  }));
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
