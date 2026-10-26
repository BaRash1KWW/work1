'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createMssqlApplication } = require('../src/server-mssql');

async function withMockServer(run) {
  const database = {
    async all() { return []; },
    async get() { return { value: 0 }; },
    async run() { return { changes: 1 }; },
    async transaction(work) { return work(this); },
    async checkConnection() { return { database_name: 'AutoSalonDB', login_name: 'test_login' }; },
    async close() {}
  };
  const app = createMssqlApplication({ database });
  const server = http.createServer(app.handler);
  server.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try { await run(baseUrl); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

test('SQL Server health endpoint reports database name', async () => {
  await withMockServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`);
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.status, 'ok');
    assert.equal(payload.databaseName, 'AutoSalonDB');
    assert.equal(payload.database, 'Microsoft SQL Server');
  });
});

test('SQL Server mode renders table routes and vehicle API', async () => {
  await withMockServer(async (baseUrl) => {
    const list = await fetch(`${baseUrl}/cars`);
    assert.equal(list.status, 200);
    assert.match(await list.text(), /Автомобили/);
    const api = await fetch(`${baseUrl}/api/cars`);
    assert.equal(api.status, 200);
    assert.deepEqual(await api.json(), []);
  });
});

test('SQL Server mode applies X-Robots-Tag to API and serves SEO files', async () => {
  await withMockServer(async (baseUrl) => {
    const api = await fetch(`${baseUrl}/api/cars`);
    assert.equal(api.headers.get('x-robots-tag'), 'noindex, nofollow');
    assert.equal(api.headers.get('x-powered-by'), 'Express');
    assert.equal(api.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(api.headers.get('x-xss-protection'), '0');

    const robots = await fetch(`${baseUrl}/robots.txt`);
    assert.equal(robots.status, 200);
    assert.match(await robots.text(), /Sitemap:/);

    const sitemap = await fetch(`${baseUrl}/sitemap.xml`);
    assert.equal(sitemap.status, 200);
    assert.match(sitemap.headers.get('content-type'), /application\/xml/);
    assert.match(await sitemap.text(), /<urlset/);
  });
});


test('SQL Server mode applies security headers and noindex to internal pages', async () => {
  await withMockServer(async (baseUrl) => {
    for (const route of ['/', '/cars', '/api/cars', '/api/unknown']) {
      const response = await fetch(`${baseUrl}${route}`);
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff', `${route}: nosniff`);
      assert.equal(response.headers.get('x-xss-protection'), '0', `${route}: XSS header`);
      if (route.startsWith('/api/')) assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
      if (route === '/cars') assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
    }
  });
});

test('SQL Server mode: HEAD и некорректный URL сохраняют X-Robots-Tag и не роняют сервер', async () => {
  await withMockServer(async (baseUrl) => {
    const head = await fetch(`${baseUrl}/api/health`, { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(head.headers.get('x-robots-tag'), 'noindex, nofollow');
    const bad = await fetch(`${baseUrl}/api/%zz`);
    assert.equal(bad.status, 400);
    assert.equal(bad.headers.get('x-robots-tag'), 'noindex, nofollow');
    const alive = await fetch(`${baseUrl}/api/cars`);
    assert.equal(alive.headers.get('x-robots-tag'), 'noindex, nofollow');
  });
});
