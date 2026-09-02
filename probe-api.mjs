import { request } from 'node:https';

const ORIGIN = 'https://usedcars.bmw.co.uk';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

function get(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = request(url, { method: 'GET', headers: { 'User-Agent': UA, ...headers } }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({
        status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8'),
      }));
    });
    req.on('error', reject);
    req.setTimeout(20000, () => req.destroy(new Error('timeout')));
    req.end();
  });
}
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

const root = await get(`${ORIGIN}/`, { Accept: 'text/html' });
const token = /(?:^|;\s*)csrftoken=([^;]+)/.exec(
  (root.headers['set-cookie'] || []).find((c) => c.includes('csrftoken')) || '',
)?.[1];
const H = {
  Accept: 'application/json', Cookie: `csrftoken=${token}`, 'X-CSRFToken': token, Referer: `${ORIGIN}/`,
};
const listUrl = (q) => `${ORIGIN}/vehicle/api/list/?${q}`;

// 1. What does a 429 actually tell us? Burst until we get one, inspect headers.
console.log('=== 429 shape: burst until limited ===');
let firstLimitAt = null;
for (let p = 1; p <= 60; p += 1) {
  const r = await get(listUrl(`size=100&page=${p}`), H);
  if (r.status === 429) {
    firstLimitAt = p;
    console.log(`first 429 on request #${p}`);
    console.log('retry-after:', r.headers['retry-after']);
    const rateHeaders = Object.entries(r.headers)
      .filter(([k]) => /rate|limit|retry|reset/i.test(k));
    console.log('rate-ish headers:', JSON.stringify(rateHeaders));
    console.log('body (first 300):', r.body.slice(0, 300));
    break;
  }
}
if (!firstLimitAt) console.log('no 429 within 60 sequential no-delay requests');

// 2. How long until it lets us back in?
console.log('\n=== recovery: poll every 5s until a 200 ===');
for (let i = 1; i <= 24; i += 1) {
  await sleep(5000);
  const r = await get(listUrl('size=100&page=1'), H);
  if (r.status === 200) { console.log(`recovered after ~${i * 5}s`); break; }
  if (i === 24) console.log('still limited after 120s');
}

// 3. Sustainable rate: 40 pages at a given delay, count 429s.
console.log('\n=== sustainable delay (40 pages each) ===');
for (const delay of [400, 1000]) {
  await sleep(20000); // let the bucket refill between trials
  let ok = 0;
  let limited = 0;
  const t0 = Date.now();
  for (let p = 1; p <= 40; p += 1) {
    const r = await get(listUrl(`size=100&page=${p}`), H);
    if (r.status === 200) ok += 1; else if (r.status === 429) limited += 1;
    await sleep(delay);
  }
  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  console.log(`delay=${delay}ms → ${ok} ok, ${limited} rate-limited, in ${secs}s`
    + ` → est. 120 pages ≈ ${((secs / 40) * 120).toFixed(0)}s (if clean)`);
}
