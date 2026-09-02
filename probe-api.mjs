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

const CONC = Number(process.argv[2]) || 4;

const first = JSON.parse((await get(listUrl('size=100&page=1'), H)).body);
const totalPages = first.pagination.total;
console.log(`FULL WALK: ${totalPages} pages, ${first.pagination.items} items, concurrency=${CONC}`);

const queue = Array.from({ length: totalPages }, (_, i) => i + 1);
const statuses = new Map();
let vehicles = 0;
let bytes = 0;
const t0 = Date.now();

await Promise.all(Array.from({ length: CONC }, async () => {
  while (queue.length) {
    const p = queue.shift();
    const r = await get(listUrl(`size=100&page=${p}`), H);
    statuses.set(r.status, (statuses.get(r.status) || 0) + 1);
    bytes += r.body.length;
    if (r.status === 200) {
      try { vehicles += (JSON.parse(r.body).results || []).length; } catch { /* ignore */ }
    }
  }
}));

const secs = (Date.now() - t0) / 1000;
console.log(`done in ${secs.toFixed(1)}s`);
console.log('status counts:', JSON.stringify(Object.fromEntries(statuses)));
console.log(`vehicles fetched: ${vehicles}`);
console.log(`raw JSON transferred: ${(bytes / 1024 / 1024).toFixed(1)} MB`);
