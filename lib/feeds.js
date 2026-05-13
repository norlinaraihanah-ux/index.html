// ============================================================
// FEEDS CONFIG — the 6 gaming-news domains we scrape daily.
// ------------------------------------------------------------
// To add or remove a source, edit this list. No other file
// needs to change. Each entry tells the crawler:
//   - url       : the index/listing page to scrape
//   - domain    : how the article is tagged in the database
//   - label     : human-readable name for logs + dashboard
//   - waitFor   : optional ms to wait for JS render (for SPAs)
// ============================================================

export const FEEDS = [
  {
    label: 'Steam News',
    domain: 'store.steampowered.com',
    url: 'https://store.steampowered.com/news/',
    waitFor: 2000  // JS-heavy listing, needs render time
  },
  {
    label: 'Eurogamer',
    domain: 'eurogamer.net',
    url: 'https://www.eurogamer.net/news'
    // swapped from IGN — Firecrawl blocks ign.com (403)
  },
  {
    label: 'GameSpot',
    domain: 'gamespot.com',
    url: 'https://www.gamespot.com/articles/',
    waitFor: 2500  // listing rendered by JS — without wait we got 3.8KB of nothing
  },
  {
    label: 'Game Rant',
    domain: 'gamerant.com',
    url: 'https://gamerant.com/'
  },
  {
    label: 'Kotaku',
    domain: 'kotaku.com',
    url: 'https://kotaku.com/'
  },
  {
    label: 'Polygon',
    domain: 'polygon.com',
    url: 'https://www.polygon.com/'
  }
];
