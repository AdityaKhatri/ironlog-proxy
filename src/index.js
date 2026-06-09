export default {
  async fetch(request, env) {

    const allowedOrigins = env.ENVIRONMENT === 'development'
      ? ['http://localhost', 'http://127.0.0.1']
      : [env.ALLOWED_ORIGIN];

    const origin = request.headers.get('Origin') || '';
    const originAllowed = allowedOrigins.some(o => origin.startsWith(o));

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      if (!originAllowed) return new Response('Forbidden', { status: 403 });
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      });
    }

    // Reject unknown origins
    if (!originAllowed) return new Response('Forbidden', { status: 403 });

    // Only accept POST
    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

    // Parse body — client sends { prompt: string }
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response('Bad Request', { status: 400 });
    }

    const { prompt } = body;
    if (!prompt || typeof prompt !== 'string') {
      return new Response('Bad Request: prompt required', { status: 400 });
    }

    // Forward to Gemini — no modification to prompt, no business logic
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    const data = await geminiRes.json();
    if (!geminiRes.ok) console.error('Gemini error:', geminiRes.status, JSON.stringify(data));

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
