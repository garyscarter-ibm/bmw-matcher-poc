/*
 * Proof: fetch the Motorrad deck fully cold — no human-captured cURL, no browser.
 *
 * The feed's GMB-SID session is not minted by JS; the server embeds a fresh one
 * in the results landing page as a hidden field <input id="hfSID" value="…">
 * (UTF-16LE base64 of "<caller-ip>;<fresh-guid>"). So the entire live chain is:
 *   1. GET the landing page, scrape #hfSID
 *   2. send it as the GMB-SID header, loop POST ShowResults by selectedPage
 * This script does step 1 and one page of step 2, to prove a server can
 * self-issue the session. It is a probe, not the adapter.
 */

const BASE = 'https://approvedused.bmw-motorrad.co.uk';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';

async function mintSid() {
  const res = await fetch(`${BASE}/UK/ergebnisse.cshtml`, { headers: { 'User-Agent': UA } });
  const html = await res.text();
  const sid = (html.match(/id="hfSID"[^>]*value="([^"]*)"/) || [])[1];
  if (!sid) throw new Error('no #hfSID in landing page');
  const decoded = Buffer.from(sid, 'base64').toString('utf16le');
  return { sid, decoded };
}

const { sid, decoded } = await mintSid();
console.log('minted GMB-SID (self-issued, no browser):');
console.log('  decoded:', decoded);

const body = {
  InitFilter: false, IsFirstCall: false, MarktId: '2', BuNo: '', Culture: 'en-gb',
  Segment: [], FuelType: [], Marke: 10, Modell: [], Fahrzeugart: 0, Antrieb: 0,
  EZV: 0, EZB: 0, PreisVon: '', PreisBis: '', KMVon: '', KMBis: '', KWVon: '', KWBis: '',
  PowerUnit: 'HP', Farbe1Auswahl: [], Merkmale: '', Umkreis: 1, UmkreisPLZ: '',
  AngebotsNo: '', DetailAngebotsNo: '', Sonderausstattung: '', isSondermodell: false,
  Pakete: '', FilterHMFAChanged: false, FilterEZChanged: 0, FilterColorChanged: false,
  ResOverviewData: {
    pagingSize: 20, currResultCountToShow: 20, selectedPage: 1, totalItemCount: 963,
    tableSortColumn: 16, tableSortDirection: 0, pageItemsToShow: 9,
  },
  DetailData: { RowNumber: 0 }, currRequest: 1,
};

const res = await fetch(`${BASE}/api/ResultOverview/ShowResults`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/plain, */*',
    'GMB-SID': sid,
    Origin: BASE,
    Referer: `${BASE}/UK/ergebnisse.cshtml`,
    'User-Agent': UA,
  },
  body: JSON.stringify(body),
});
const env = await res.json();
const rows = (String(env?.ResTable || '').match(/ergebnissColor/g) || []).length;
console.log(`ShowResults page 1: HTTP ${res.status}, total=${env?.ResOverviewData?.totalItemCount}, rows=${rows}`);
console.log(rows > 0 ? 'LIVE CHAIN WORKS COLD.' : 'null envelope — session not accepted.');
