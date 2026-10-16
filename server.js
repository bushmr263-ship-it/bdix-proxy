const express = require('express');
const fetch = require('node-fetch');
const app = express();

// Railway automatic port or fallback to 8080
const PORT = process.env.PORT || 8080;

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "*");
    res.header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

app.get('/', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send("No URL provided");

    try {
        const response = await fetch(targetUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept": "*/*"
            }
        });

        const contentType = response.headers.get("content-type") || "";

        if (targetUrl.includes(".m3u8") || contentType.includes("mpegurl")) {
            let text = await response.text();
            const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
            const host = req.protocol + '://' + req.get('host');

            const modifiedText = text.split('\n').map(line => {
                line = line.trim();
                if (line && !line.startsWith('#')) {
                    let absoluteUrl = line.startsWith('http') ? line : baseUrl + line;
                    return `${host}/?url=${encodeURIComponent(absoluteUrl)}`;
                }
                return line;
            }).join('\n');

            res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
            return res.send(modifiedText);
        }

        res.status(response.status);
        response.body.pipe(res);

    } catch (e) {
        res.status(500).send("Error: " + e.message);
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Proxy running on port ${PORT}`);
});
