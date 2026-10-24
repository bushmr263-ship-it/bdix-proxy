// ===================================================
// Secret Code & Playlist Configuration
// ===================================================
const EXPIRE_CODE = "48436844"; 
const PLAYLIST_URL = 'https://raw.githubusercontent.com/bushmr263-ship-it/online-tv/refs/heads/main/playlist.m3u';
// ===================================================

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Expose-Headers': '*',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const host = request.headers.get('host');
  const protocol = request.headers.get('x-forwarded-proto') || 'https';
  const requestUrl = request.url || '';
  const targetUrl = url.searchParams.get('url');

  // ---------------------------------------------------------
  // ১. M3U Playlist Request
  // ---------------------------------------------------------
  if (!targetUrl && (requestUrl.includes('.m3u') || requestUrl.includes('playlist-expire'))) {
    if (EXPIRE_CODE && !requestUrl.includes(EXPIRE_CODE)) {
      return new Response(JSON.stringify({ error: 'Access Denied: Invalid or Expired ID' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    try {
      const response = await fetch(PLAYLIST_URL, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        }
      });

      if (!response.ok) {
        return new Response(JSON.stringify({ error: 'Failed to fetch playlist' }), {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const content = await response.text();
      const baseUrl = response.url; 

      const lines = content.split('\n');
      const rewrittenLines = lines.map(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          try {
            const absUrl = new URL(trimmed, baseUrl).href;
            return `${protocol}://${host}/?url=${encodeURIComponent(absUrl)}`;
          } catch (e) {
            return line;
          }
        }
        return line;
      });

      return new Response(rewrittenLines.join('\n'), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8'
        }
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // ---------------------------------------------------------
  // ২. Stream & Segment Fetching (Advanced Browser Spoofing)
  // ---------------------------------------------------------
  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'No URL provided' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const parsedTarget = new URL(targetUrl);
    const targetOrigin = parsedTarget.origin;

    // ব্রাউজারের মতো করে সম্পূর্ণ ফেক হেডার্স তৈরি করা
    const forwardHeaders = new Headers();
    forwardHeaders.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
    forwardHeaders.set('Accept', '*/*');
    forwardHeaders.set('Accept-Language', 'en-US,en;q=0.9');
    forwardHeaders.set('Origin', targetOrigin);
    forwardHeaders.set('Referer', targetOrigin + '/');
    forwardHeaders.set('Sec-Ch-Ua', '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"');
    forwardHeaders.set('Sec-Ch-Ua-Mobile', '?0');
    forwardHeaders.set('Sec-Ch-Ua-Platform', '"Windows"');
    forwardHeaders.set('Sec-Fetch-Dest', 'empty');
    forwardHeaders.set('Sec-Fetch-Mode', 'cors');
    forwardHeaders.set('Sec-Fetch-Site', 'cross-site');
    forwardHeaders.set('Connection', 'keep-alive');

    const response = await fetch(targetUrl, {
      method: request.method,
      headers: forwardHeaders,
      redirect: 'follow'
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: `Stream blocked or failed (${response.status})` }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const contentType = response.headers.get('content-type') || '';
    const finalUrl = response.url; 

    const isM3U8 = targetUrl.includes('.m3u8') || 
                   targetUrl.includes('.m3u') || 
                   contentType.includes('mpegurl') || 
                   contentType.includes('m3u') || 
                   contentType.includes('text/plain');

    if (isM3U8) {
      const text = await response.text();

      if (text.includes('#EXTM3U') || text.includes('#EXT-X-STREAM-INF') || text.includes('#EXTINF')) {
        const lines = text.split('\n');
        const rewrittenLines = lines.map(line => {
          const trimmed = line.trim();
          if (!trimmed) return line;

          if (trimmed.startsWith('#')) {
            if (trimmed.includes('URI=')) {
              return trimmed.replace(/URI=["']([^"']+)["']/g, (match, uri) => {
                try {
                  const abs = new URL(uri, finalUrl).href;
                  return `URI="${protocol}://${host}/?url=${encodeURIComponent(abs)}"`;
                } catch (e) {
                  return match;
                }
              });
            }
            return line;
          }

          try {
            const abs = new URL(trimmed, finalUrl).href;
            return `${protocol}://${host}/?url=${encodeURIComponent(abs)}`;
          } catch (e) {
            return line;
          }
        });

        return new Response(rewrittenLines.join('\n'), {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8'
          }
        });
      }

      return new Response(text, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': contentType || 'text/plain'
        }
      });
    }

    // Binary TS Segments
    const responseHeaders = new Headers();
    Object.entries(corsHeaders).forEach(([key, value]) => {
      responseHeaders.set(key, value);
    });

    const targetType = response.headers.get('content-type');
    responseHeaders.set('Content-Type', targetType || 'video/mp2t');
    responseHeaders.set('Cache-Control', 'public, max-age=3600');

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
