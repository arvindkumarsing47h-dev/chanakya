# Chanakya NSE Proxy

Yeh Cloudflare Worker "Project Chanakya 2040" HTML app ke liye NSE India ka
live stock data CORS-free tareeke se fetch karta hai.

## Deploy kaise karein (GitHub se, bina coding ke)

1. Is repository ko GitHub par upload karein (files: `wrangler.toml`,
   `package.json`, `src/index.js`).
2. Cloudflare dashboard me jayein: Workers & Pages → Create → "Import a repository".
3. Apna GitHub account connect karein, aur yahi repository select karein.
4. Cloudflare khud `wrangler.toml` aur `src/index.js` ko pehchaan kar deploy
   kar dega — koi extra setting nahi badalni.
5. Deploy hone ke baad jo URL milega (jaise
   `https://chanakya-nse-proxy.<yourname>.workers.dev`), use "Project
   Chanakya 2040" app ke Settings tab me paste kar dein.

## Use kaise karein

```
GET https://<your-worker-url>/?symbol=TCS
GET https://<your-worker-url>/?symbol=RELIANCE
```

Symbol wahi likhein jo NSE par listed hai (jaise TCS, INFY, RELIANCE).
