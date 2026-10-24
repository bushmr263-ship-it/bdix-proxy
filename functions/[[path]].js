export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const streamUrl = url.searchParams.get('url');

  // CORS Headers (সব প্লেয়ার সাপোর্ট পাওয়ার জন্য)
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Credentials': 'true',
  };

  // Preflight Request Handle
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Home Route
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
    // অরিজিনাল হেডারগুলো থেকে ক্লাউডফ্লেয়ারের নিজস্ব ব্লক হেডার রিমুভ
    const forwardHeaders = new Headers(request.headers);
    forwardHeaders.delete('Host');
    forwardHeaders.delete('cf-connecting-ip');
    forwardHeaders.delete('cf-ipcountry');
    forwardHeaders.delete('cf-ray');
    forwardHeaders.delete('cf-visitor');

    // Real Browser Spoofing
    forwardHeaders.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    forwardHeaders.set('Accept', '*/*');
    forwardHeaders.set('Accept-Language', 'en-US,en;q=0.9');

    // টার্গেট সার্ভার থেকে ডাটা ফেচ
    const response = await fetch(streamUrl, {
      method: request.method,
      headers: forwardHeaders,
      redirect: 'follow',
    });

    const responseHeaders = new Headers(response.headers);
    
    // ক্লাউডফ্লেয়ার যেন রেসপন্স ব্লক বা ক্যাশ না করে
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
