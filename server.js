const EXPIRE_CODE = "48436844"; 
const PLAYLIST_URL = 'https://raw.githubusercontent.com/bushmr263-ship-it/online-tv/refs/heads/main/playlist.m3u';

Deno.serve(async (req) => {
  const url = new URL(req.url);

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Expose-Headers': '*',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const host = url.host;
  const protocol = url.protocol;
  const requestUrl = req.url;
  const targetUrl = url.searchParams.get('url');

  // M3U Playlist Request
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
            return `${protocol}//${host}/?url=${encodeURIComponent(absUrl)}`;
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

  // Stream Proxying
  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'No URL provided' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const parsedTarget = new URL(targetUrl);
    const targetOrigin = parsedTarget.origin;

    const forwardHeaders = new Headers();
    forwardHeaders.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
    forwardHeaders.set('Accept', '*/*');
    forwardHeaders.set('Accept-Language', 'en-US,en;q=0.9');
    forwardHeaders.set('Origin', targetOrigin);
    forwardHeaders.set('Referer', targetOrigin + '/');

    const response = await fetch(targetUrl, {
      method: req.method,
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
                  return `URI="${protocol}//${host}/?url=${encodeURIComponent(abs)}"`;
                } catch (e) {
                  return match;
                }
              });
            }
            return line;
          }

          try {
            const abs = new URL(trimmed, finalUrl).href;
            return `${protocol}//${host}/?url=${encodeURIComponent(abs)}`;
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

    // TS Segments
    const responseHeaders = new Headers();
    Object.entries(corsHeaders).forEach(([k, v]) => responseHeaders.set(k, v));
    responseHeaders.set('Content-Type', response.headers.get('content-type') || 'video/mp2t');

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
});
