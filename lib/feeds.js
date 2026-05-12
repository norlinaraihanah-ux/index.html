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
    label: 'IGN',
    domain: 'ign.com',
    url: 'https://www.ign.com/articles'
  },
  {
    label: 'GameSpot',
    domain: 'gamespot.com',
    url: 'https://www.gamespot.com/articles/'
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
