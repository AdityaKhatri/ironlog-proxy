const err = (msg, status, origin = '') => new Response(
  JSON.stringify({ error: msg }),
  { status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': origin } }
);

export default {
  async fetch(request, env) {

    const allowedOrigins = env.ENVIRONMENT === 'development'
      ? ['http://localhost', 'http://127.0.0.1']
      : [env.ALLOWED_ORIGIN];

    const origin = request.headers.get('Origin') || '';
    const originAllowed = allowedOrigins.some(o => origin.startsWith(o));

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      if (!originAllowed) return err('Forbidden', 403);
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      });
    }

    // Reject unknown origins
    if (!originAllowed) return err('Forbidden', 403);

    // Only accept POST
    if (request.method !== 'POST') return err('Method Not Allowed', 405, origin);

    // Parse body — client sends { prompt: string }
    let body;
    try {
      body = await request.json();
    } catch {
      return err('Bad Request: invalid JSON', 400, origin);
    }

    const { prompt } = body;
    if (!prompt || typeof prompt !== 'string') {
      return err('Bad Request: prompt required', 400, origin);
    }

    // Enforce rate limit: 20 requests per hour per IP
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const { success } = await env.RATE_LIMITER.limit({ key: ip });
    if (!success) return err('Too many requests. Please wait a moment before trying again.', 429, origin);

    // Forward to Gemini — no modification to prompt, no business logic
    let geminiRes, data;
    try {
      geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        }
      );
      data = await geminiRes.json();
    } catch (e) {
      console.error('Gemini fetch failed:', e);
      return err('Bad Gateway: could not reach Gemini', 502, origin);
    }

    if (!geminiRes.ok) {
      console.error('Gemini error:', geminiRes.status, JSON.stringify(data));
      if (data?.error?.status === 'RESOURCE_EXHAUSTED') {
        return err('AI quota exceeded. Please try again tomorrow.', 503, origin);
      }
    }

    // Return Gemini's raw response — client is responsible for parsing
    return new Response(JSON.stringify(data), {
      status: geminiRes.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': origin,
      }
    });
  }
};
