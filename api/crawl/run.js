// ============================================================
// CRAWL ORCHESTRATOR
// ------------------------------------------------------------
// Endpoint:  GET /api/crawl/run
// Called by: Vercel Cron daily at 07:00 UTC (15:00 MYT)
// Job:       for each feed -> scrape with Firecrawl ->
//            extract with Claude -> upsert to Supabase.
//
// Runs feeds in parallel via Promise.allSettled so one
// flaky source doesn't crash the whole run.
// ============================================================

import { FEEDS } from '../../lib/feeds.js';
import { scrapeMarkdown } from '../../lib/firecrawl.js';
import { extractArticles } from '../../lib/claude.js';
import { upsertArticles } from '../../lib/db.js';

// Max execution time (seconds). 60 is the Hobby-plan ceiling.
// Bump to 300 if you're on Pro and want more headroom.
export const config = { maxDuration: 60 };

/**
 * Process one feed end-to-end.
 * Returns a result object — never throws.
 */
async function processFeed(feed) {
  const t0 = Date.now();
  try {
    const markdown = await scrapeMarkdown(feed.url, { waitFor: feed.waitFor });
    const articles = await extractArticles(markdown, feed.domain);

    const rows = articles
      .filter(a => a && a.url && a.title)
      .map(a => ({
        url: a.url,
        domain: feed.domain,
        title: String(a.title).slice(0, 500),
        summary: a.summary ? String(a.summary).slice(0, 2000) : null,
        published_at: isValidIso(a.published_at) ? a.published_at : null,
        theme: ALLOWED_THEMES.has(a.theme) ? a.theme : 'news',
        momentum: clampInt(a.momentum, 1, 100, 50),
        raw_md: null  // we don't store raw markdown per article — too big
      }));

    const { count } = await upsertArticles(rows);

    return {
      feed: feed.label,
      domain: feed.domain,
      ok: true,
      scraped_bytes: markdown.length,
      articles_extracted: rows.length,
      articles_upserted: count,
      elapsed_ms: Date.now() - t0
    };
  } catch (err) {
    return {
      feed: feed.label,
      domain: feed.domain,
      ok: false,
      error: err.message,
      elapsed_ms: Date.now() - t0
    };
  }
}

const ALLOWED_THEMES = new Set([
  'game-drop', 'review', 'news', 'feature', 'trend', 'patch', 'industry'
]);

function isValidIso(s) {
  if (!s || typeof s !== 'string') return false;
  const d = new Date(s);
  return !isNaN(d.getTime());
}

function clampInt(n, lo, hi, fallback) {
  const i = parseInt(n, 10);
  if (isNaN(i)) return fallback;
  return Math.max(lo, Math.min(hi, i));
}

export default async function handler(req, res) {
  // Basic protection: Vercel Cron sends a special header.
  // Optional manual trigger from your browser will also work — comment out
  // the check below if you want to lock it down later.
  // if (req.headers['x-vercel-cron'] !== '1' && req.query.key !== process.env.CRON_SECRET) {
  //   return res.status(401).json({ ok: false, error: 'unauthorized' });
  // }

  const t0 = Date.now();
  console.log(`[crawl] starting run for ${FEEDS.length} feeds...`);

  const results = await Promise.allSettled(FEEDS.map(processFeed));
  const flat = results.map(r => r.status === 'fulfilled' ? r.value : { ok: false, error: String(r.reason) });

  const total_upserted = flat.reduce((sum, r) => sum + (r.articles_upserted || 0), 0);
  const failed = flat.filter(r => !r.ok).length;

  const summary = {
    ok: true,
    feeds_total: FEEDS.length,
    feeds_failed: failed,
    articles_upserted: total_upserted,
    elapsed_ms: Date.now() - t0,
    by_feed: flat
  };

  console.log(`[crawl] done in ${summary.elapsed_ms}ms — ${total_upserted} articles, ${failed} failed feeds`);

  res.status(200).json(summary);
}
