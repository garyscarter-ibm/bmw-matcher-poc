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

const pages = async (q) => {
  const r = await get(listUrl(`size=100&page=1&${q}`), H);
  try {
    const e = JSON.parse(r.body);
    return { pages: e.pagination?.total, items: e.pagination?.items, status: r.status };
  } catch { return { status: r.status, pages: null, items: null }; }
};

console.log('=== price param hunt (baseline items should be ~11934) ===');
const priceCandidates = [
  'price__gte=20000&price__lte=30000',
  'price_gte=20000&price_lte=30000',
  'price_min=20000&price_max=30000',
  'from_price=20000&to_price=30000',
  'price-from=20000&price-to=30000',
  'cash_price_min=20000&cash_price_max=30000',
  'cash_from=20000&cash_to=30000',
  'budget_from=20000&budget_to=30000',
  'monthly_from=200&monthly_to=400',
  'price=20000-30000',
  'price_range=20000-30000',
  'max_price=30000',
  'price_to=30000',
  'payment_type=cash&price_from=20000&price_to=30000',
  'payment_type=cash&cash_price_from=20000&cash_price_to=30000',
  'payment_type=cash&min=20000&max=30000',
];
for (const c of priceCandidates) {
  const r = await pages(c);
  console.log(`${c.padEnd(52)} → HTTP ${r.status}, pages=${r.pages}, items=${r.items}`);
}

console.log('\n=== confirm working filters + valid values ===');
for (const c of [
  '', 'fuel_type=Diesel', 'fuel_type=Petrol', 'fuel_type=Electric',
  'fuel_type=Petrol%20Hybrid', 'fuel_type=Electric&body_type=SUV',
  'body_type=SUV', 'body_type=Hatchback', 'body_type=Saloon', 'body_type=Estate',
  'max_mileage=20000', 'min_mileage=1000',
  'fuel_type=Diesel&body_type=Estate&max_mileage=30000',
]) {
  const r = await pages(c);
  console.log(`${(c || '(unfiltered)').padEnd(52)} → pages=${r.pages}, items=${r.items}`);
}

console.log('\n=== concurrency: how fast can we walk N pages? ===');
for (const conc of [1, 4, 8]) {
  const nums = Array.from({ length: 16 }, (_, i) => i + 1);
  const t0 = Date.now();
  let bad = 0;
  const queue = [...nums];
  const workers = Array.from({ length: conc }, async () => {
    while (queue.length) {
      const p = queue.shift();
      const r = await get(listUrl(`size=100&page=${p}`), H);
      if (r.status !== 200) bad += 1;
    }
  });
  await Promise.all(workers);
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`concurrency=${conc}: 16 pages in ${secs}s, non-200s=${bad}`
    + ` → est. 120 pages ≈ ${((secs / 16) * 120).toFixed(0)}s`);
}
