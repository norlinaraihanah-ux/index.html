// config/feeds.js
// ─────────────────────────────────────────────────────────────────────────────
// RSS feed registry for Drop Watch (Layer 0e — Rule 7 daily fresh-drop scan).
// Public RSS URLs only — no API keys, no auth. Anything that needs a key lives
// in env vars instead (see .env.example).
//
// Used by:  api/drops.js  (future endpoint)
// Imported as:  import { RSS_FEEDS } from '../config/feeds.js';
//
// To add a feed: drop it under the right category, run a smoke-test fetch.
// To kill a feed temporarily: comment out the line; redeploy.
// ─────────────────────────────────────────────────────────────────────────────

export const RSS_FEEDS = {
  // ── Gaming news outlets — broad AAA + indie + console + mobile coverage ──
  news: [
    { name: "Polygon",          url: "https://www.polygon.com/rss/index.xml" },
    { name: "Eurogamer",        url: "https://www.eurogamer.net/?format=rss" },
    { name: "Push Square",      url: "https://www.pushsquare.com/feeds/latest" },
    { name: "Nintendo Life",    url: "https://www.nintendolife.com/feeds/latest" },
    { name: "Gematsu",          url: "https://www.gematsu.com/feed" },
    { name: "VG247",            url: "https://www.vg247.com/feed" },
    { name: "Kotaku",           url: "https://kotaku.com/rss" },
    { name: "PC Gamer",         url: "https://www.pcgamer.com/rss/" },
    { name: "IGN",              url: "https://feeds.ign.com/ign/games-all" },
    { name: "GameSpot",         url: "https://www.gamespot.com/feeds/news/" },
    { name: "Rock Paper Shotgun", url: "https://www.rockpapershotgun.com/feed" },
  ],

  // ── Platform / network status feeds — outage signal for G2G + OffGamers ──
  // NOTE: tech team to confirm exact paths — these vary per region/account state.
  status: [
    { name: "PSN status",       url: "https://status.playstation.com/en-us/feed.xml" }, // TODO verify
    { name: "Xbox status",      url: "https://support.xbox.com/api/feed/" },             // TODO verify
    { name: "Nintendo status",  url: "https://en-americas-support.nintendo.com/app/answers/list/p/430/c/2495.rss" }, // TODO verify
  ],

  // ── Publisher RSS — banner schedules, patch notes, gacha drop calendars ──
  // NOTE: these tend to be unstable; tech team to scrape if RSS unavailable.
  publishers: [
    { name: "HoYoLab news",     url: "https://www.hoyolab.com/feed/" },                 // TODO verify
    { name: "Kuro Games",       url: "https://wutheringwaves.kurogames.com/news/rss" }, // TODO scrape fallback
    { name: "Riot newsroom",    url: "https://www.riotgames.com/feed.xml" },
    { name: "Square Enix",      url: "https://na.finalfantasyxiv.com/lodestone/news/news.xml" },
  ],

  // ── Reddit — sourced via Reddit API (needs OAuth), included here for ──
  //    reference; actual fetcher uses snoowrap / praw with REDDIT_CLIENT_ID
  reddit: [
    { name: "/r/Games",                  subreddit: "Games" },
    { name: "/r/GamingLeaksAndRumours",  subreddit: "GamingLeaksAndRumours" },
    { name: "/r/MobileGaming",           subreddit: "MobileGaming" },
    { name: "/r/Genshin_Impact",         subreddit: "Genshin_Impact" },
    { name: "/r/Steam",                  subreddit: "Steam" },
  ],
};

// ── Fetch policy ────────────────────────────────────────────────────────────
export const FEED_POLICY = {
  cronTime:        "0 8 * * 1-5",  // 08:00 SGT every weekday
  windowHours:     24,             // dedupe + filter to last-24h window
  timeoutMs:       8000,           // per-feed timeout
  maxConcurrent:   6,              // parallel fetches
  userAgent:       "G2G-OG-DropWatch/2.7 (+ops@g2g.com)",
};
