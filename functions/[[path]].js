export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const streamUrl = url.searchParams.get('url');

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (url.pathname === '/' && !streamUrl) {
    return new Response('SHAWON TV Proxy Server চলছে! ব্যবহার করতে ?url=YOUR_URL দিন।', {
      headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }

  if (!streamUrl) {
    return new Response('URL প্যারামিটার পাওয়া যায়নি!', { 
      status: 400, 
      headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }

  try {
    const modifiedHeaders = new Headers(request.headers);
    modifiedHeaders.delete('Host');
    
    modifiedHeaders.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    modifiedHeaders.set('Accept', '*/*');

    const response = await fetch(streamUrl, {
      method: request.method,
      headers: modifiedHeaders,
      redirect: 'follow',
    });

    const responseHeaders = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      responseHeaders.set(key, value);
    });

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
