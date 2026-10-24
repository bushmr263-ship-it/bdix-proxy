// ===================================================
// Secret Code
// ===================================================
const EXPIRE_CODE = "48436844"; 

// Update kora M3U Playlist URL
const PLAYLIST_URL = 'https://raw.githubusercontent.com/bushmr263-ship-it/online-tv/refs/heads/main/playlist.m3u';
// ===================================================

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  // CORS Headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const host = request.headers.get('host');
  const protocol = request.headers.get('x-forwarded-proto') || 'https';
  const requestUrl = request.url || '';
  const targetUrl = url.searchParams.get('url');

  // ---------------------------------------------------------
  // 1. M3U Playlist Request (/playlist-expire=48436844.m3u)
  // ---------------------------------------------------------
  if (!targetUrl && (requestUrl.includes('.m3u') || requestUrl.includes('playlist-expire'))) {
    
    // Security verification
    if (EXPIRE_CODE && !requestUrl.includes(EXPIRE_CODE)) {
      return new Response(JSON.stringify({ error: 'Access Denied: Invalid or Expired ID' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    try {
      const response = await fetch(PLAYLIST_URL, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
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
  // 2. Stream Fetching
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

    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Origin': targetOrigin,
        'Referer': targetOrigin + '/',
        'Accept': '*/*'
      }
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: `Stream failed (${response.status})` }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const contentType = response.headers.get('content-type') || '';
    const finalUrl = response.url; 

    const isPlaylist = targetUrl.includes('.m3u') || 
                       contentType.includes('mpegurl') || 
                       contentType.includes('m3u') || 
                       contentType.includes('text/plain');

    if (isPlaylist) {
      const text = await response.text();

      if (text.trim().startsWith('#EXTM3U') || targetUrl.includes('.m3u8')) {
        const lines = text.split('\n');
        const rewrittenLines = lines.map(line => {
          const trimmed = line.trim();
          if (!trimmed) return line;

          // AES Key (#EXT-X-KEY) rewrite
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

          // TS segment rewrite
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
    const responseHeaders = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      responseHeaders.set(key, value);
    });
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
