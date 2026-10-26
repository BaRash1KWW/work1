'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { createApplication } = require('../server');

async function withServer(run) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autosalon-node-test-'));
  const databasePath = path.join(tempDir, 'autosalon.db');
  const { handler, database } = createApplication({ databasePath });
  const server = http.createServer(handler);
  server.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    await run({ baseUrl, database });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    database.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

test('главная страница отображает стартовые показатели', async () => {
  await withServer(async ({ baseUrl }) => {
    const response = await fetch(`${baseUrl}/`);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /Добро пожаловать/);
    assert.match(html, /Node\.js/);
    assert.match(html, /Автомобили/);
    assert.match(html, /ДП-2025-001/);
  });
});

test('health endpoint сообщает о Node.js-сервисе', async () => {
  await withServer(async ({ baseUrl }) => {
    const response = await fetch(`${baseUrl}/api/health`);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.status, 'ok');
    assert.equal(body.runtime, 'node.js');
  });
});

test('cars API возвращает автомобили с маркой, моделью и статусом', async () => {
  await withServer(async ({ baseUrl }) => {
    const response = await fetch(`${baseUrl}/api/cars`);
    const cars = await response.json();
    assert.equal(response.status, 200);
    assert.equal(cars.length, 4);
    assert.ok(cars.some((car) => car.brand === 'Toyota' && car.model === 'Camry'));
    assert.ok(cars.some((car) => ['В наличии', 'Продан'].includes(car.status)));
  });
});

test('новую марку можно создать через веб-форму', async () => {
  await withServer(async ({ baseUrl, database }) => {
    const response = await fetch(`${baseUrl}/brands/new`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ name: 'Test Motors', country: 'Тестовая страна' }),
      redirect: 'manual'
    });
    assert.equal(response.status, 303);
    assert.match(response.headers.get('location'), /^\/brands\?notice=/);
    assert.equal(database.get('SELECT country FROM brands WHERE name=?', ['Test Motors']).country, 'Тестовая страна');
  });
});

test('продажа меняет статус автомобиля и не допускает повторной продажи', async () => {
  await withServer(async ({ baseUrl, database }) => {
    const first = await fetch(`${baseUrl}/sales/new`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        car_id: '1', customer_id: '2', employee_id: '1', sale_date: '2026-10-13',
        sale_price: '1750000', payment_method: 'Наличные', contract_number: 'NODE-TEST-001', notes: 'Тест'
      }),
      redirect: 'manual'
    });
    assert.equal(first.status, 303);
    assert.equal(database.get("SELECT st.name FROM cars c JOIN car_statuses st ON st.id=c.status_id WHERE c.id=1").name, 'Продан');
    assert.equal(database.get('SELECT COUNT(*) AS total FROM sales').total, 2);

    const second = await fetch(`${baseUrl}/sales/new`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        car_id: '1', customer_id: '3', employee_id: '1', sale_date: '2026-10-13',
        sale_price: '1700000', payment_method: 'Наличные', contract_number: 'NODE-TEST-002', notes: 'Повторная продажа'
      }),
      redirect: 'manual'
    });
    assert.equal(second.status, 400);
    assert.match(await second.text(), /уже существует|связанные данные|удалить связанные|выберите корректное значение/i);
    assert.equal(database.get('SELECT COUNT(*) AS total FROM sales').total, 2);
  });
});

test('ограничения SQLite не позволяют удалить марку со связанной моделью', async () => {
  await withServer(async ({ baseUrl, database }) => {
    const response = await fetch(`${baseUrl}/brands/1/delete`, { method: 'POST', redirect: 'manual' });
    assert.equal(response.status, 303);
    assert.match(response.headers.get('location'), /^\/brands\?error=/);
    assert.ok(database.get('SELECT id FROM brands WHERE id=1'));
    assert.equal(database.get('PRAGMA foreign_keys').foreign_keys, 1);
  });
});

test('неизвестный адрес возвращает страницу 404', async () => {
  await withServer(async ({ baseUrl }) => {
    const response = await fetch(`${baseUrl}/does-not-exist`);
    const html = await response.text();
    assert.equal(response.status, 404);
    assert.match(html, /Страница не найдена/);
  });
});

test('robots.txt и sitemap.xml доступны по корневым URL', async () => {
  await withServer(async ({ baseUrl }) => {
    const robots = await fetch(`${baseUrl}/robots.txt`);
    const robotsText = await robots.text();
    assert.equal(robots.status, 200);
    assert.match(robots.headers.get('content-type'), /text\/plain/);
    assert.match(robotsText, /Allow: \/\n/);
    assert.doesNotMatch(robotsText, /Disallow: \/(cars|sales|customers|api)\//);
    assert.match(robotsText, /Sitemap: https:\/\/example\.com\/sitemap\.xml/);

    const sitemap = await fetch(`${baseUrl}/sitemap.xml`);
    const sitemapText = await sitemap.text();
    assert.equal(sitemap.status, 200);
    assert.match(sitemap.headers.get('content-type'), /application\/xml/);
    assert.match(sitemapText, /<loc>https:\/\/example\.com\/<\/loc>/);
  });
});

test('главная страница содержит SEO-метатеги и разрешает индексацию', async () => {
  await withServer(async ({ baseUrl }) => {
    const response = await fetch(`${baseUrl}/`);
    const html = await response.text();
    assert.match(html, /<html lang="ru">/);
    assert.match(html, /<meta name="description" content="[^"]+">/);
    assert.match(html, /<meta name="robots" content="index, follow">/);
    assert.match(html, /<h1>/);
  });
});

test('служебные страницы остаются закрытыми от индексации', async () => {
  await withServer(async ({ baseUrl }) => {
    const response = await fetch(`${baseUrl}/cars`);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
  });
});

test('API-ответы содержат X-Robots-Tag', async () => {
  await withServer(async ({ baseUrl }) => {
    const response = await fetch(`${baseUrl}/api/cars`);
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
    assert.equal(response.headers.get('x-powered-by'), 'Express');
  });
});


test('security headers are present on pages, API and 404 responses', async () => {
  await withServer(async ({ baseUrl }) => {
    for (const route of ['/', '/cars', '/api/cars', '/api/not-found', '/does-not-exist']) {
      const response = await fetch(`${baseUrl}${route}`);
      assert.equal(response.headers.get('x-powered-by'), 'Express', `${route}: X-Powered-By`);
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff', `${route}: nosniff`);
      assert.equal(response.headers.get('x-xss-protection'), '0', `${route}: XSS header`);
      if (route.startsWith('/api/')) {
        assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow', `${route}: API noindex`);
      }
      if (route === '/cars' || route === '/does-not-exist') {
        assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow', `${route}: page noindex header`);
      }
    }
  });
});

test('X-Robots-Tag отдаётся на HEAD-запросах к API (curl -I)', async () => {
  await withServer(async ({ baseUrl }) => {
    for (const route of ['/api/health', '/api/cars']) {
      const response = await fetch(`${baseUrl}${route}`, { method: 'HEAD' });
      assert.equal(response.status, 200, `${route}: HEAD status`);
      assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow', `${route}: HEAD X-Robots-Tag`);
    }
  });
});

test('некорректный URL не роняет сервер и получает X-Robots-Tag', async () => {
  await withServer(async ({ baseUrl }) => {
    const bad = await fetch(`${baseUrl}/api/%zz`);
    assert.equal(bad.status, 400);
    assert.equal(bad.headers.get('x-robots-tag'), 'noindex, nofollow');
    const alive = await fetch(`${baseUrl}/api/health`);
    assert.equal(alive.status, 200);
    assert.equal(alive.headers.get('x-robots-tag'), 'noindex, nofollow');
  });
});
