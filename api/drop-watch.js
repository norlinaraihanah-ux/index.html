// ============================================================
// DROP WATCH ENDPOINT
// ------------------------------------------------------------
// Endpoint:  GET /api/drop-watch
// Returns:   the last 7 days of game drops, patches, and news,
//            sorted by momentum (hottest first).
//
// Your dashboard fetches from this URL and renders the results.
// ============================================================

import { getArticlesByTheme } from '../lib/db.js';

const DROP_THEMES = ['game-drop', 'patch', 'news'];
const WINDOW_DAYS = 7;
const MAX_ROWS = 30;

export default async function handler(req, res) {
  try {
    const articles = await getArticlesByTheme(DROP_THEMES, WINDOW_DAYS, MAX_ROWS);

    // Cache at the edge for 5 minutes — same response served fast,
    // but auto-revalidates so cron writes show up quickly.
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

    res.status(200).json({
      ok: true,
      window_days: WINDOW_DAYS,
      count: articles.length,
      articles
    });
  } catch (err) {
    console.error('[drop-watch] error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
}
