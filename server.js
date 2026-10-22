const express = require('express');
const request = require('request');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

// CORS এনাবল করা হচ্ছে যেন প্লেয়ারে প্লে হয়
app.use(cors());

app.get('/', (req, res) => {
    res.send('BDIX Proxy Server চলছে! প্রক্সি লিংক ব্যবহার করতে /proxy?url=YOUR_URL দিন।');
});

// /proxy রাউট হ্যান্ডলার
app.get('/proxy', (req, res) => {
    const streamUrl = req.query.url;
    
    if (!streamUrl) {
        return res.status(400).send('URL প্যারামিটার পাওয়া যায়নি!');
    }

    req.pipe(request(streamUrl)).pipe(res);
});

app.listen(PORT, () => {
    console.log(`Proxy running on port ${PORT}`);
});
