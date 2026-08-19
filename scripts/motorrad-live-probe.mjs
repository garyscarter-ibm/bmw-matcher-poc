/*
 * Proof that the Motorrad deck can be fetched fully cold: the GMB-SID session isn't minted by JS but embedded in the landing page's hidden #hfSID field, so a server can self-issue it (GET landing, scrape #hfSID, POST ShowResults with it as a header).
 * This does one page of that chain to prove it works cold — a probe, not the adapter.
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
