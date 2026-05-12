// ============================================================
// SUPABASE DB CLIENT + helpers
// ------------------------------------------------------------
// Uses SUPABASE_SERVICE_KEY (the secret one) — bypasses RLS.
// Never expose this client to the browser.
// ============================================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_API_KEY;  // matches your env var name in Vercel

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_API_KEY env var.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

/**
 * Upsert a batch of articles. Duplicates by `url` (primary key)
 * are merged, not duplicated.
 *
 * @param {Array} articles - rows matching the `articles` table schema
 * @returns {Promise<{count: number}>}
 */
export async function upsertArticles(articles) {
  if (!articles || articles.length === 0) {
    return { count: 0 };
  }

  const { data, error } = await supabase
    .from('articles')
    .upsert(articles, { onConflict: 'url', ignoreDuplicates: false })
    .select('url');

  if (error) {
    throw new Error(`Supabase upsert failed: ${error.message}`);
  }

  return { count: data?.length ?? 0 };
}

/**
 * Fetch articles by theme(s), within a recent time window,
 * ordered by momentum desc.
 *
 * @param {string[]} themes - e.g. ["game-drop", "patch"]
 * @param {number} days - look-back window in days (default 7)
 * @param {number} limit - max rows to return (default 50)
 */
export async function getArticlesByTheme(themes, days = 7, limit = 50) {
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const { data, error } = await supabase
    .from('articles')
    .select('url,domain,title,summary,published_at,theme,momentum,scraped_at')
    .in('theme', themes)
    .gte('scraped_at', since)
    .order('momentum', { ascending: false })
    .order('scraped_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Supabase select failed: ${error.message}`);
  }

  return data || [];
}
