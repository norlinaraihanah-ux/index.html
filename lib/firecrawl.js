// ============================================================
// FIRECRAWL WRAPPER
// ------------------------------------------------------------
// Thin wrapper around Firecrawl's scrapeUrl. Returns clean
// markdown of the main content only (strips ads/nav/footer).
// ============================================================

import FirecrawlApp from '@mendable/firecrawl-js';

const firecrawl = new FirecrawlApp({
  apiKey: process.env.FIRECRAWL_API_KEY
});

/**
 * Scrape a URL and return its main content as markdown.
 *
 * @param {string} url - the page to scrape
 * @param {object} options
 * @param {number} options.waitFor - ms to wait for JS render (default 0)
 * @returns {Promise<string>} markdown content
 */
export async function scrapeMarkdown(url, options = {}) {
  const result = await firecrawl.scrapeUrl(url, {
    formats: ['markdown'],
    onlyMainContent: true,
    waitFor: options.waitFor || 0,
    timeout: 30000
  });

  if (!result || result.success === false) {
    const reason = result?.error || 'unknown firecrawl error';
    throw new Error(`Firecrawl failed for ${url}: ${reason}`);
  }

  // The SDK may put markdown at result.markdown OR result.data.markdown
  // depending on version. Handle both.
  const markdown = result.markdown || result.data?.markdown || '';

  if (!markdown) {
    throw new Error(`Firecrawl returned empty markdown for ${url}`);
  }

  return markdown;
}
