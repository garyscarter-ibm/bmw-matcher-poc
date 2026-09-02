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

const root = await get(`${ORIGIN}/`, { Accept: 'text/html' });
const token = /(?:^|;\s*)csrftoken=([^;]+)/.exec(
  (root.headers['set-cookie'] || []).find((c) => c.includes('csrftoken')) || '',
)?.[1];
if (!token) throw new Error('no csrftoken');
const H = {
  Accept: 'application/json', Cookie: `csrftoken=${token}`, 'X-CSRFToken': token, Referer: `${ORIGIN}/`,
};

const listUrl = (q) => `${ORIGIN}/vehicle/api/list/?${q}`;

// 1. Baseline: what does an unfiltered page-1 envelope look like?
const base = await get(listUrl('size=1&page=1'), H);
const env = JSON.parse(base.body);
console.log('=== envelope top-level keys ===');
console.log(Object.keys(env));
console.log('pagination:', JSON.stringify(env.pagination));
if (env.facets) console.log('facets keys:', Object.keys(env.facets).slice(0, 60));
if (env.filters) console.log('filters:', JSON.stringify(env.filters).slice(0, 2000));
if (env.aggregations) console.log('aggregations keys:', Object.keys(env.aggregations).slice(0, 60));

// 2. Does a bigger page size work?
console.log('\n=== page size ceiling ===');
for (const size of [100, 200, 500, 1000]) {
  const r = await get(listUrl(`size=${size}&page=1`), H);
  let n = null;
  let total = null;
  try {
    const e = JSON.parse(r.body);
    n = (e.results || []).length;
    total = e.pagination?.total;
  } catch { /* non-JSON */ }
  console.log(`size=${size} → HTTP ${r.status}, results=${n}, pagination.total=${total}`);
}

// 3. Candidate server-side filter params — does pagination.total move?
console.log('\n=== filter params (baseline total below) ===');
const unfiltered = JSON.parse((await get(listUrl('size=100&page=1'), H)).body);
console.log('unfiltered: total pages =', unfiltered.pagination?.total,
  ' count =', unfiltered.pagination?.count ?? unfiltered.count ?? 'n/a');

const candidates = [
  'fuel_type=Diesel', 'fuel=Diesel', 'fuel_types=Diesel',
  'body_style=SUV', 'body_type=SUV', 'bodystyle=SUV',
  'price_from=20000&price_to=30000', 'min_price=20000&max_price=30000',
  'cash_price_from=20000&cash_price_to=30000',
  'model=X3', 'model_range=X3', 'series=X3',
  'transmission=Automatic', 'max_mileage=20000', 'mileage_to=20000',
  'year_from=2022', 'registration_year_from=2022',
];
for (const c of candidates) {
  const r = await get(listUrl(`size=100&page=1&${c}`), H);
  let total = null;
  let count = null;
  try {
    const e = JSON.parse(r.body);
    total = e.pagination?.total;
    count = e.pagination?.count ?? e.count;
  } catch { /* ignore */ }
  console.log(`${c.padEnd(45)} → HTTP ${r.status}, pages=${total}, count=${count}`);
}
