// ============================================================
// TREND RADAR ENDPOINT
// ------------------------------------------------------------
// Endpoint:  GET /api/trend-radar
// Returns:   the last 14 days of trends, features, and
//            industry moves — sorted by momentum.
//
// Trends move slower than drops, so the window is wider (14d).
// ============================================================

import { getArticlesByTheme } from '../lib/db.js';

const TREND_THEMES = ['trend', 'feature', 'industry'];
const WINDOW_DAYS = 14;
const MAX_ROWS = 30;

export default async function handler(req, res) {
  try {
    const articles = await getArticlesByTheme(TREND_THEMES, WINDOW_DAYS, MAX_ROWS);

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

    res.status(200).json({
      ok: true,
      window_days: WINDOW_DAYS,
      count: articles.length,
      articles
    });
  } catch (err) {
    console.error('[trend-radar] error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
}
