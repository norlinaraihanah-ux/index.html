// ============================================================
// CLAUDE EXTRACTION
// ------------------------------------------------------------
// Takes raw markdown from a gaming-news index page and asks
// Claude to return a structured JSON array of articles.
//
// Each article gets a theme + momentum score so the dashboard
// can split content into Drop Watch vs Trend Radar views.
// ============================================================

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const MODEL = 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `You extract structured article data from gaming-news listing pages for two gaming-marketplace brands:
- G2G (g2g.com)         — game keys, accounts, boosting, top-ups for AAA/PC/console gamers
- OffGamers (offgamers.com) — top-ups, gift cards, vouchers, gacha/mobile-game currency

You return ONLY a JSON array — no prose, no markdown code fences, no explanation, no preamble.

Each article in the array MUST have these fields:
- url               string, absolute URL of the article
- title             string, the article headline
- summary           string, 1-2 sentences in your own words (not copied)
- published_at      ISO 8601 timestamp string, or null if you can't tell
- theme             one of: "game-drop" | "review" | "news" | "feature" | "trend" | "patch" | "industry"
- momentum          integer 1-100, how hot/relevant for a gaming-marketplace audience
- brand_fit         one of: "G2G" | "OFFGAMERS" | "BOTH"
- suggested_action  short string (max 90 chars), what the social team should DO about this drop

Rules:
- Only real articles. Skip ads, nav links, promo banners, podcast episodes unrelated to gaming.
- Limit to top 15 articles ranked by momentum.
- If url is relative (starts with /), construct the absolute URL using the source_domain.
- For theme:
  - "game-drop"  = new game release, launch, or major DLC drop
  - "review"     = game/hardware review
  - "patch"      = patch notes, balance changes, server updates
  - "trend"      = cultural moments, memes, community trends
  - "industry"   = business news, layoffs, acquisitions
  - "feature"    = long-form editorial, opinion, retrospective
  - "news"       = generic news that doesn't fit above
- For momentum, think: would gaming-marketplace buyers care? Higher = more likely to drive engagement on social.
- For brand_fit:
  - "G2G"        = AAA/PC/console keys, account-driven games, boosting demand (e.g., new Steam launch, MMO patch, console exclusives)
  - "OFFGAMERS"  = gacha/mobile-game banners, gift cards, top-up moments (e.g., Genshin/HSR banner, Roblox event, App Store top-ups)
  - "BOTH"       = applies to both brands (e.g., platform-wide outage, cross-platform launch, payment-method news)
- For suggested_action, write an imperative action like:
  - "Amend WED brief — ride the May the 4th angle"
  - "Pin support post — clarify alternative top-up paths"
  - "Bump to next week — leak still unconfirmed"
  - "Watch only — no immediate angle"
  Keep it concrete, action-first, and tied to the drop. No generic "monitor closely" filler.`;

/**
 * Extract structured articles from a markdown index page.
 *
 * @param {string} markdown - raw markdown from Firecrawl
 * @param {string} sourceDomain - e.g. "ign.com"
 * @returns {Promise<Array>} array of article objects
 */
export async function extractArticles(markdown, sourceDomain) {
  const today = new Date().toISOString().slice(0, 10);

  // Cap markdown to ~60k chars so we don't blow up the context for very long pages
  const trimmed = markdown.length > 60000 ? markdown.slice(0, 60000) : markdown;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Source domain: ${sourceDomain}
Today's date: ${today}

Extract the articles from this page and return the JSON array.

--- BEGIN MARKDOWN ---
${trimmed}
--- END MARKDOWN ---`
    }]
  });

  const text = (response.content?.[0]?.text || '').trim();

  // Defensive: strip code fences if the model added them despite instructions
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) {
      throw new Error('expected JSON array, got something else');
    }
    return parsed;
  } catch (err) {
    console.error(`[claude] failed to parse for ${sourceDomain}:`, err.message);
    console.error(`[claude] raw output (first 500 chars):`, cleaned.slice(0, 500));
    return [];
  }
}
