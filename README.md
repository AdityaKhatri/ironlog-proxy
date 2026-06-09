# ironlog-proxy

A thin Cloudflare Worker that proxies requests from the Iron Log PWA to the Gemini Flash API. Keeps the Gemini API key out of client-side code.

The Worker is intentionally dumb — it forwards `{ prompt: string }` to Gemini and returns the raw response. All prompt construction and response parsing live in the Iron Log client.

## One-time setup

1. **Install wrangler:**
   ```bash
   npm install -g wrangler
   ```

2. **Login to Cloudflare:**
   ```bash
   wrangler login
   ```

3. **Configure local secrets:**
   ```bash
   cp .dev.vars.example .dev.vars
   # Edit .dev.vars and add your Gemini API key
   ```

4. **Set production secrets:**
   ```bash
   wrangler secret put GEMINI_API_KEY
   # When prompted, paste your Gemini API key

   wrangler secret put ENVIRONMENT
   # When prompted, enter: production

   wrangler secret put ALLOWED_ORIGIN
   # When prompted, enter your GitHub Pages URL, e.g. https://yourusername.github.io
   ```

6. **Deploy:**
   ```bash
   wrangler deploy
   ```

7. **Note your Worker URL** (printed after deploy) and add it to Iron Log's config as `PROXY_URL`.

## Local development

```bash
wrangler dev
# Worker available at http://localhost:8787

# Test with curl:
curl -X POST http://localhost:8787 \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost" \
  -d '{"prompt": "Estimate calories for: 2 eggs, 2 rotis. Reply as JSON { kcal: number } only."}'
```

## Rate limiting

Configure in the Cloudflare dashboard under **Workers → ironlog-proxy → Rate Limiting**.

Recommended for personal use: **30 requests/hour per IP**.

## When to redeploy

Only redeploy if you change:
- The allowed GitHub Pages origin
- The Gemini model URL
- The rate limit configuration

Never redeploy just to change prompt wording — that lives in Iron Log's client code.
