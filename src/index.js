/**
 * Project Chanakya 2040 — Live Data Proxy (Cloudflare Worker)
 * ------------------------------------------------------------
 * v2: Yahoo Finance ka istemaal karta hai (NSE India ne Cloudflare
 * Workers ke IP addresses ko block kar diya tha — 403 error — isliye
 * ab yeh zyada reliable source use kar rahe hain).
 *
 * USE:
 *   GET <your-worker-url>/?symbol=TCS
 *   GET <your-worker-url>/?symbol=RELIANCE
 *   GET <your-worker-url>/?symbol=INFY
 *
 * Symbol wahi likhein jo NSE par listed hai, bina .NS ke — worker
 * khud .NS jod deta hai.
 *
 * NOTE: P/E ratio Yahoo ke is free endpoint mein reliably nahi
 * milta, isliye woh field abhi bhi manually bharni hogi (Valuation
 * tab mein). CMP, din ka high/low, aur 52-week high/low automatic
 * aa jayenge.
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

    const yahooSymbol = symbol + ".NS";

    try {
      const apiRes = await fetch(
        "https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(yahooSymbol),
        {
          headers: {
            "User-Agent": UA,
            "Accept": "application/json"
          }
        }
      );

      if (!apiRes.ok) {
        return new Response(JSON.stringify({
          error: "Data source responded with status " + apiRes.status + ". Symbol galat ho sakta hai, ya kuch der baad try karein.",
          symbol: symbol
        }), { status: 502, headers: corsHeaders() });
      }

      const raw = await apiRes.json();

      const result = (raw && raw.chart && raw.chart.result && raw.chart.result[0]) ? raw.chart.result[0] : null;
      if (!result || !result.meta) {
        const err = (raw && raw.chart && raw.chart.error && raw.chart.error.description) ? raw.chart.error.description : "Symbol not found";
        return new Response(JSON.stringify({ error: err, symbol: symbol }), { status: 404, headers: corsHeaders() });
      }

      const meta = result.meta;
      const clean = {
        symbol: symbol,
        companyName: meta.longName || meta.shortName || null,
        cmp: (meta.regularMarketPrice !== undefined) ? meta.regularMarketPrice : null,
        previousClose: (meta.previousClose !== undefined) ? meta.previousClose :
                       (meta.chartPreviousClose !== undefined ? meta.chartPreviousClose : null),
        dayHigh: (meta.regularMarketDayHigh !== undefined) ? meta.regularMarketDayHigh : null,
        dayLow: (meta.regularMarketDayLow !== undefined) ? meta.regularMarketDayLow : null,
        week52High: (meta.fiftyTwoWeekHigh !== undefined) ? meta.fiftyTwoWeekHigh : null,
        week52Low: (meta.fiftyTwoWeekLow !== undefined) ? meta.fiftyTwoWeekLow : null,
        currency: meta.currency || "INR",
        exchangeTimezone: meta.exchangeTimezoneName || null,
        fetchedAt: new Date().toISOString(),
        note: "P/E is not available from this source — please enter manually in the Valuation tab."
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
