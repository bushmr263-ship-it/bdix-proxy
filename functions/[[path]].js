export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const streamUrl = url.searchParams.get('url');

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Credentials': 'true',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (url.pathname === '/' && !streamUrl) {
    return new Response('SHAWON TV Proxy Server cholshe! Byabohar korte ?url=YOUR_URL din.', {
      headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }

  if (!streamUrl) {
    return new Response('URL parameter paowa jayni!', { 
      status: 400, 
      headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }

  try {
    const forwardHeaders = new Headers(request.headers);
    forwardHeaders.delete('Host');
    forwardHeaders.delete('cf-connecting-ip');
    forwardHeaders.delete('cf-ipcountry');
    forwardHeaders.delete('cf-ray');
    forwardHeaders.delete('cf-visitor');

    forwardHeaders.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    forwardHeaders.set('Accept', '*/*');
    forwardHeaders.set('Accept-Language', 'en-US,en;q=0.9');

    const response = await fetch(streamUrl, {
      method: request.method,
      headers: forwardHeaders,
      redirect: 'follow',
    });

    const contentType = response.headers.get('content-type') || '';
    const responseHeaders = new Headers(response.headers);
    
    Object.entries(corsHeaders).forEach(([key, value]) => {
      responseHeaders.set(key, value);
    });

    // M3U8 Playlist handling (Vercel-er moto relative link proxy-te convert kora)
    if (contentType.includes('vnd.apple.mpegurl') || contentType.includes('x-mpegurl') || streamUrl.includes('.m3u8')) {
      let m3u8Content = await response.text();
      const targetBaseUrl = new URL('.', streamUrl).href;
      const proxyBaseUrl = `${url.origin}/?url=`;

      const lines = m3u8Content.split('\n');
      const rewrittenLines = lines.map(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
          return line;
        }
        let absoluteUrl;
        try {
          absoluteUrl = new URL(trimmed, targetBaseUrl).href;
        } catch (e) {
          absoluteUrl = trimmed;
        }
        return `${proxyBaseUrl}${encodeURIComponent(absoluteUrl)}`;
      });

      return new Response(rewrittenLines.join('\n'), {
        status: response.status,
        headers: responseHeaders,
      });
    }

    // Binaries / TS Segments / Streaming data
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });

  } catch (err) {
    return new Response('Proxy Error: ' + err.message, { 
      status: 500, 
      headers: corsHeaders 
    });
  }
}
