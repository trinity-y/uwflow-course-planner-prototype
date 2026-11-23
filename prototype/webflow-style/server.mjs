import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';

const port = Number(process.env.PORT || 5173);
const offline = process.env.PLANNER_OFFLINE === '1';
const upstream = 'https://uwflow.com';
const files = new Map([
  ['/', ['index.html', 'text/html']],
  ['/index.html', ['index.html', 'text/html']],
  ['/styles.css', ['styles.css', 'text/css']],
  ...['app', 'calendar', 'model', 'graph', 'degree', 'degree-view'].map((name) => [
    `/${name}.mjs`, [`${name}.mjs`, 'text/javascript'],
  ]),
  ...['degree-requirements', 'calendar-courses'].map((name) => [
    `/${name}.json`, [`${name}.json`, 'application/json'],
  ]),
]);

const catalogTtl = 10 * 60 * 1000;
let catalog;
let catalogExpiry = 0;

async function fetchJson(path, options) {
  const response = await fetch(new URL(path, upstream), {
    ...options,
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`UW Flow returned ${response.status}`);
  return response.json();
}

async function getCatalog() {
  if (!catalog || catalogExpiry < Date.now()) {
    catalogExpiry = Date.now() + catalogTtl;
    catalog = fetchJson('/api/data/search').then(({ courses }) =>
      courses.map(({ code, name, aliases }) => ({ code, name, aliases })),
    ).catch((error) => {
      catalog = undefined;
      throw error;
    });
  }
  return catalog;
}

async function getPrerequisites(codes) {
  const query = `query PlannerRequisites($codes: [String!]!) {
    course(where: { code: { _in: $codes } }) { code name prereqs }
  }`;
  const { data, errors } = await fetchJson('/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { codes } }),
  });
  if (errors?.length || !Array.isArray(data?.course)) throw new Error('Course lookup failed');
  return data.course;
}

function json(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method !== 'GET') {
    res.writeHead(405, { Allow: 'GET' }).end();
    return;
  }
  try {
    if (url.pathname === '/api/catalog' || url.pathname === '/api/prerequisites') {
      if (offline) {
        json(res, 503, { error: 'Sample mode' });
      } else if (url.pathname === '/api/catalog') {
        json(res, 200, await getCatalog());
      } else {
        const codes = [...new Set(url.searchParams.getAll('code'))];
        if (!codes.length || codes.length > 50 || codes.some((code) => !/^[a-z]{2,12}\d{1,4}[a-z]?$/.test(code))) {
          json(res, 400, { error: 'Invalid course codes' });
        } else {
          json(res, 200, await getPrerequisites(codes));
        }
      }
      return;
    }

    const file = files.get(url.pathname);
    if (!file) {
      res.writeHead(404).end();
      return;
    }
    const [name, type] = file;
    const body = await readFile(new URL(name, import.meta.url));
    res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-cache' });
    res.end(body);
  } catch {
    json(res, 502, { error: 'Unable to load data' });
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Course planner: http://127.0.0.1:${server.address().port}`);
});
