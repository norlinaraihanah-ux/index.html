// api/tiktok/callback.js
// Handles TikTok Business OAuth callback after the user authorizes the app.
// TikTok redirects here with ?auth_code=XXX. This exchanges it for an
// access_token + advertiser_id list and renders them in plain HTML so
// you can copy them straight into Vercel env vars.

export default async function handler(req, res) {
  const { auth_code, code, state, error: oauth_error, error_description } = req.query;

  // TikTok occasionally swaps `code` <-> `auth_code` between portal versions.
  const authCode = auth_code || code;

  const sendHTML = (status, title, bodyHTML) => {
    res.status(status).setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; max-width: 820px; margin: 40px auto; padding: 0 20px; color: #1a1a1a; }
  h1 { font-size: 24px; }
  h2 { font-size: 18px; margin-top: 28px; }
  .ok { color: #0a7c2f; }
  .err { color: #b00020; }
  pre { background: #f5f5f7; padding: 14px 16px; border-radius: 8px; overflow-x: auto; font-size: 13px; line-height: 1.5; }
  .copy { background: #eef6ff; padding: 12px 16px; border-radius: 8px; border: 1px solid #cfe2ff; font-family: ui-monospace, Menlo, monospace; font-size: 13px; word-break: break-all; margin: 6px 0; }
  .label { font-size: 12px; text-transform: uppercase; color: #666; letter-spacing: 0.5px; margin-bottom: 4px; }
  .step { margin: 18px 0; padding: 14px 16px; border-left: 3px solid #0066ff; background: #f9fbff; }
  code { background: #f0f0f3; padding: 2px 5px; border-radius: 4px; font-size: 13px; }
</style>
</head>
<body>
${bodyHTML}
</body>
</html>`);
  };

  // Case A: OAuth itself errored before reaching us.
  if (oauth_error) {
    return sendHTML(400, 'TikTok auth failed',
      `<h1 class="err">TikTok OAuth returned an error</h1>
       <p><b>error:</b> ${oauth_error}</p>
       <p><b>description:</b> ${error_description || '(none)'}</p>
       <p>Try the auth URL again, or screenshot this page to Claude.</p>`);
  }

  // Case B: no auth_code in query — user hit this URL directly.
  if (!authCode) {
    return sendHTML(400, 'No auth code',
      `<h1 class="err">No auth_code in URL</h1>
       <p>This page is the redirect target of TikTok's OAuth flow — it only works when TikTok sends you here with <code>?auth_code=…</code> attached.</p>
       <p>Visit the authorization URL from your TikTok app portal first; TikTok will redirect you back here with the code.</p>`);
  }

  // Case C: missing env vars.
  const appId = process.env.TIKTOK_APP_ID;
  const appSecret = process.env.TIKTOK_APP_SECRET;
  if (!appId || !appSecret) {
    return sendHTML(500, 'Missing env vars',
      `<h1 class="err">Server missing TIKTOK_APP_ID or TIKTOK_APP_SECRET</h1>
       <p>Set both in Vercel env, redeploy, then retry the auth URL.</p>`);
  }

  // Case D: exchange the auth_code for an access_token.
  try {
    const tokenRes = await fetch('https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: appId,
        secret: appSecret,
        auth_code: authCode,
      }),
    });

    const json = await tokenRes.json();

    if (json.code !== 0) {
      return sendHTML(400, 'Token exchange failed',
        `<h1 class="err">TikTok rejected the auth_code</h1>
         <p>Full response:</p>
         <pre>${JSON.stringify(json, null, 2)}</pre>
         <p>Most common cause: the redirect_uri in your authorization URL did not exactly match what is registered in the TikTok app config. Screenshot this to Claude.</p>`);
    }

    const accessToken = json.data?.access_token;
    const advertiserIds = json.data?.advertiser_ids || [];
    const scope = json.data?.scope || [];

    return sendHTML(200, 'TikTok auth success',
      `<h1 class="ok">✓ Auth successful — copy these into Vercel env</h1>

       <div class="step">
         <div class="label">Copy this as TIKTOK_ACCESS_TOKEN</div>
         <div class="copy">${accessToken || '(missing — something went wrong)'}</div>
       </div>

       <div class="step">
         <div class="label">Pick the G2G advertiser_id and copy as TIKTOK_ADVERTISER_ID</div>
         ${advertiserIds.length === 0
           ? '<p class="err">No advertiser_ids returned. The account you authorized with might not own any ad accounts.</p>'
           : advertiserIds.map(id => `<div class="copy">${id}</div>`).join('')}
         ${advertiserIds.length > 1
           ? '<p style="font-size:13px;color:#666;margin-top:8px;">Multiple ad accounts visible — paste all IDs to Claude if you are not sure which is the G2G one.</p>'
           : ''}
       </div>

       <h2>Authorized scopes</h2>
       <pre>${JSON.stringify(scope, null, 2)}</pre>

       <h2>What to do next</h2>
       <ol>
         <li>Open Vercel → your project → Settings → Environment Variables.</li>
         <li>Edit <code>TIKTOK_ACCESS_TOKEN</code> → paste the token above. Save.</li>
         <li>Edit <code>TIKTOK_ADVERTISER_ID</code> → paste the G2G advertiser_id. Save.</li>
         <li>Trigger a redeploy (push any commit, or hit "Redeploy" in Vercel).</li>
         <li>Tell Claude "env vars updated" — Claude will then patch <code>lib/tiktok.js</code> to swap the sandbox host for production.</li>
       </ol>

       <h2>Full raw response (for debugging)</h2>
       <pre>${JSON.stringify(json, null, 2)}</pre>`);
  } catch (err) {
    return sendHTML(500, 'Server error',
      `<h1 class="err">Server crash during token exchange</h1>
       <pre>${err.stack || err.message}</pre>`);
  }
}
