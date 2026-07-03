/**
 * Project Chanakya 2040 — NSE Live Data Proxy (Cloudflare Worker)
 * ------------------------------------------------------------
 * यह Worker NSE India की website से live quote data लाकर आपके
 * HTML app को CORS-free तरीके से देता है।
 *
 * DEPLOY कैसे करें (एक बार, 5 मिनट):
 * 1. https://dash.cloudflare.com पर free account बनाएं (अगर नहीं है)
 * 2. बाईं तरफ "Workers & Pages" > "Create" > "Create Worker"
 * 3. एक नाम दें जैसे: chanakya-nse-proxy
 * 4. "Edit Code" खोलें, यहाँ की पूरी फाइल का content copy-paste करें
 *    (मौजूदा default code को पूरा हटाकर)
 * 5. "Deploy" दबाएं
 * 6. आपको एक URL मिलेगा जैसे:
 *    https://chanakya-nse-proxy.<your-subdomain>.workers.dev
 * 7. यही URL Chanakya App की "Settings" में डालना है (एक बार)
 *
 * USE कैसे करें:
 *   GET  <your-worker-url>/?symbol=RELIANCE
 *   GET  <your-worker-url>/?symbol=TCS
 * (Symbol वही डालें जो NSE पर होता है, जैसे: TCS, INFY, BSPHCL listed नहीं है
 *  तो केवल NSE/BSE-listed companies के लिए काम करेगा)
 *
 * ⚠️ ईमानदार चेतावनी:
 * - NSE अपनी website की सुरक्षा (anti-bot) समय-समय पर बदलता रहता है,
 *   इसलिए यह Worker कभी-कभी अस्थायी रूप से काम करना बंद कर सकता है।
 *   ऐसा होने पर कुछ घंटे बाद दोबारा कोशिश करें।
 * - यह unofficial तरीका है (NSE की कोई paid/official API यहाँ इस्तेमाल
 *   नहीं हो रही) — भारी/commercial इस्तेमाल के लिए Kite Connect या
 *   किसी licensed data vendor का इस्तेमाल करें।
 * - डेटा में कभी-कभी देरी (15-min delay या उससे ज़्यादा) हो सकती है।
 */

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function corsHeaders() {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Cache-Control": "no-store"
  };
}

async function getNseCookies() {
  const res = await fetch("https://www.nseindia.com/get-quotes/equity", {
    headers: {
      "User-Agent": UA,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9"
    }
  });
  const setCookie = res.headers.get("set-cookie") || "";
  return setCookie;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    const symbol = (url.searchParams.get("symbol") || "").trim().toUpperCase();
    if (!symbol) {
      return new Response(JSON.stringify({ error: "Missing ?symbol= parameter. Example: ?symbol=TCS" }),
        { status: 400, headers: corsHeaders() });
    }

    try {
      const cookies = await getNseCookies();

      const apiRes = await fetch(
        "https://www.nseindia.com/api/quote-equity?symbol=" + encodeURIComponent(symbol),
        {
          headers: {
            "User-Agent": UA,
            "Accept": "application/json",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://www.nseindia.com/get-quotes/equity?symbol=" + encodeURIComponent(symbol),
            "Cookie": cookies
          }
        }
      );

      if (!apiRes.ok) {
        return new Response(JSON.stringify({
          error: "NSE responded with status " + apiRes.status + ". NSE may be rate-limiting or blocking — try again in a few minutes.",
          symbol: symbol
        }), { status: 502, headers: corsHeaders() });
      }

      const raw = await apiRes.json();

      // Extract only the fields Chanakya app needs, with safe fallbacks
      const priceInfo = raw && raw.priceInfo ? raw.priceInfo : {};
      const metadata = raw && raw.metadata ? raw.metadata : {};
      const info = raw && raw.info ? raw.info : {};
      const weekHL = priceInfo.weekHighLow || {};

      const clean = {
        symbol: symbol,
        companyName: info.companyName || null,
        cmp: (priceInfo.lastPrice !== undefined) ? priceInfo.lastPrice : null,
        change: (priceInfo.change !== undefined) ? priceInfo.change : null,
        pChange: (priceInfo.pChange !== undefined) ? priceInfo.pChange : null,
        dayHigh: (priceInfo.intraDayHighLow && priceInfo.intraDayHighLow.max !== undefined) ? priceInfo.intraDayHighLow.max : null,
        dayLow: (priceInfo.intraDayHighLow && priceInfo.intraDayHighLow.min !== undefined) ? priceInfo.intraDayHighLow.min : null,
        week52High: (weekHL.max !== undefined) ? weekHL.max : null,
        week52Low: (weekHL.min !== undefined) ? weekHL.min : null,
        sectorPE: (metadata.pdSectorPe !== undefined) ? metadata.pdSectorPe : null,
        symbolPE: (metadata.pdSymbolPe !== undefined) ? metadata.pdSymbolPe : null,
        industry: metadata.industry || null,
        lastUpdateTime: metadata.lastUpdateTime || null,
        fetchedAt: new Date().toISOString()
      };

      return new Response(JSON.stringify(clean), { headers: corsHeaders() });

    } catch (err) {
      return new Response(JSON.stringify({
        error: "Fetch failed: " + err.message,
        symbol: symbol
      }), { status: 500, headers: corsHeaders() });
    }
  }
};
