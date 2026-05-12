# Pipeline Flow App — Backend Add-On

This folder contains the backend code that turns your static `pipeline-flow-app` into a live Drop Watch + Trend Radar dashboard powered by Firecrawl + Claude + Supabase.

## What this adds

- **Daily crawl** of 6 gaming-news sites (Steam, IGN, GameSpot, Game Rant, Kotaku, Polygon)
- **Claude extraction** turning each page into structured article rows (title, summary, theme, momentum score)
- **Supabase storage** so your dashboard reads from a database, not from a fresh scrape every visit
- **Two read endpoints** your dashboard can fetch — `/api/drop-watch` and `/api/trend-radar`
- **One cron schedule** in `vercel.json` (daily at 07:00 UTC)

## How to drop this into your existing repo

1. On your laptop, open your `pipeline-flow-app` folder
2. Copy these files/folders from here into the root of your repo:

```
pipeline-flow-app/
├── index.html              ← (unchanged, keep your existing one)
├── package.json            ← (NEW — from this folder)
├── vercel.json             ← (REPLACE your existing one with this version)
├── api/                    ← (NEW folder)
│   ├── crawl/run.js
│   ├── drop-watch.js
│   └── trend-radar.js
└── lib/                    ← (NEW folder)
    ├── feeds.js
    ├── firecrawl.js
    ├── claude.js
    └── db.js
```

3. From the root of the repo, commit and push:

```bash
git add .
git commit -m "Add Firecrawl + Claude + Supabase crawl backend"
git push
```

4. Vercel will auto-deploy. First deploy will be slightly slower (~30s for npm install). Watch the deploy logs in Vercel — you want to see "Build Completed" with no red errors.

## Test it (before waiting for cron)

Open this URL in your browser, replacing with your real Vercel domain:

```
https://your-app.vercel.app/api/crawl/run
```

Wait 30–60 seconds. You should see a JSON response like:

```json
{
  "ok": true,
  "feeds_total": 6,
  "feeds_failed": 0,
  "articles_upserted": 47,
  "elapsed_ms": 38421,
  "by_feed": [
    { "feed": "Steam News", "ok": true, "articles_upserted": 8, ... },
    { "feed": "IGN", "ok": true, "articles_upserted": 12, ... },
    ...
  ]
}
```

Then verify in Supabase → Table Editor → `articles` table — you should see rows appearing.

## Test the read endpoints

```
https://your-app.vercel.app/api/drop-watch
https://your-app.vercel.app/api/trend-radar
```

Both return JSON with the relevant articles.

## How to connect your dashboard HTML

In `index.html`, add a fetch call wherever you want the Drop Watch or Trend Radar widget to render:

```html
<script>
  async function loadDropWatch() {
    const res = await fetch('/api/drop-watch');
    const data = await res.json();
    const list = document.getElementById('drop-watch-list');
    list.innerHTML = data.articles.map(a => `
      <div class="article-card">
        <h3>${a.title}</h3>
        <p>${a.summary || ''}</p>
        <small>${a.domain} • momentum ${a.momentum}</small>
        <a href="${a.url}" target="_blank">Read →</a>
      </div>
    `).join('');
  }
  loadDropWatch();
</script>
```

Same pattern for `/api/trend-radar`.

## Required env vars in Vercel (you already added these)

| Name | What it is |
|---|---|
| `SUPABASE_URL` | `https://aybszbzikjnrjelyyidt.supabase.co` |
| `SUPABASE_API_KEY` | the `sb_secret_...` service key |
| `FIRECRAWL_API_KEY` | (already set) |
| `ANTHROPIC_API_KEY` | (already set) |

## Cron schedule

Set in `vercel.json`:

```json
"crons": [
  { "path": "/api/crawl/run", "schedule": "0 7 * * *" }
]
```

That's **daily at 07:00 UTC = 15:00 Malaysia Time**. Edit the schedule string to change timing. Cron format: `minute hour day month weekday`.

## Adding or removing a source

Edit `lib/feeds.js`. Add a new entry like:

```js
{
  label: 'PC Gamer',
  domain: 'pcgamer.com',
  url: 'https://www.pcgamer.com/news/'
}
```

Commit, push, and the next cron run will include it. No other code change needed.

## Cost estimate (per month)

- **Firecrawl**: 6 scrapes/day × 30 days = 180 scrapes/month. Free tier covers 500/month, paid is $19/mo for 5,000. Comfortable on free.
- **Claude**: 6 extractions/day × 30 days × ~$0.01/extraction ≈ **$2/mo** at Sonnet 4.6 pricing.
- **Supabase**: free tier (500MB) covers this easily for years.
- **Vercel**: free tier covers 1 cron job + serverless function executions.

Total: roughly **$2/month** for the whole pipeline.

## Troubleshooting

**Deploy fails with "Cannot find module"**
→ Make sure `package.json` is in the repo root.

**Cron doesn't fire**
→ Vercel free tier allows ONE cron schedule per project. If you already have another cron in `vercel.json`, you'll need to keep just one or upgrade to Pro.

**Crawl times out at 60s**
→ Either upgrade Vercel to Pro (lifts the limit to 300s), or shrink the feed list temporarily.

**Claude returns invalid JSON**
→ Already handled — the code logs the failure and skips that feed, the rest still run.

**Supabase upsert fails**
→ Check that `SUPABASE_API_KEY` env var is the SECRET key (starts with `sb_secret_`), not the publishable one.
