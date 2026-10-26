'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');
const { createMssqlDatabase } = require('./database-mssql');
const { entities } = require('./entities-mssql');
const { escapeHtml, formatMoney, messageFromDbError } = require('../server');

const NAV_ITEMS = [
  ['/', '▦', 'Обзор'], ['/cars', '◈', 'Автомобили'], ['/sales', '↗', 'Продажи'],
  ['/customers', '♙', 'Клиенты'], ['/employees', '♧', 'Сотрудники'], ['/service-records', '⚙', 'Сервис'],
  ['/suppliers', '▤', 'Поставщики'], ['/purchase-orders', '☷', 'Заказы поставщикам'],
  ['/purchase-order-items', '☰', 'Позиции заказов'], ['/brands', '◇', 'Марки'], ['/models', '▧', 'Модели'], ['/positions', '♧', 'Должности']
];

function seoDescription(title) {
  const descriptions = {
    'Обзор': 'Рабочая панель AutoSalon для учебного управления автосалоном, автомобилями, продажами и сервисными операциями.',
    'Страница не найдена': 'Запрошенная страница AutoSalon не найдена. Вернитесь к панели управления автосалоном.',
    'Ошибка сервера': 'В AutoSalon произошла ошибка при обработке запроса. Проверьте настройки приложения и журнал сервера.'
  };
  return descriptions[title] || `${title}. Раздел внутренней учебной системы управления автосалоном AutoSalon.`;
}

function renderLayout({ title, breadcrumb, activePath, body, notice = null, error = null }) {
  const navigation = NAV_ITEMS.map(([href, icon, label]) => {
    const active = href === '/' ? activePath === '/' : activePath.startsWith(href);
    return `<a href="${href}" class="nav-link${active ? ' active' : ''}"><span class="nav-icon">${icon}</span>${label}</a>`;
  }).join('\n');
  const messages = `${notice ? `<div class="flash-stack"><div class="flash flash-success">${escapeHtml(notice)}</div></div>` : ''}${error ? `<div class="flash-stack"><div class="flash flash-error">${escapeHtml(error)}</div></div>` : ''}`;
  const templatePath = path.join(__dirname, '..', 'index.html');
  const template = fs.readFileSync(templatePath, 'utf8');
  const robots = activePath === '/' && title === 'Обзор' ? 'index, follow' : 'noindex, nofollow';
  const replacements = {
    '@@DESCRIPTION@@': escapeHtml(seoDescription(title)),
    '@@ROBOTS@@': robots,
    '@@TITLE@@': escapeHtml(title),
    '@@NAVIGATION@@': navigation,
    '@@DATABASE_LABEL@@': 'Microsoft SQL Server',
    '@@BREADCRUMB@@': escapeHtml(breadcrumb),
    '@@MESSAGES@@': messages,
    '@@BODY@@': body,
    '@@FOOTER_LABEL@@': 'Microsoft SQL Server'
  };
  return template.replace(/@@DESCRIPTION@@|@@ROBOTS@@|@@TITLE@@|@@NAVIGATION@@|@@DATABASE_LABEL@@|@@BREADCRUMB@@|@@MESSAGES@@|@@BODY@@|@@FOOTER_LABEL@@/g, (token) => replacements[token]);
}

function pageResponse(res, status, html) {
  res.writeHead(status, { 'content-type': 'text/html; charset=utf-8', 'x-content-type-options': 'nosniff' });
  res.end(html);
}
function redirect(res, location) {
  res.writeHead(303, { location, 'cache-control': 'no-store' });
  res.end();
}
async function readForm(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 32768) throw Object.assign(new Error('Тело запроса слишком большое.'), { statusCode: 413 });
  }
  return Object.fromEntries(new URLSearchParams(body));
}
function getEntity(slug) { return entities[slug] || null; }
function parseDateValue(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
  if (value === null || value === undefined || value === '') return '';
  const text = String(value);
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : text;
}
function cellValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (value instanceof Date) return escapeHtml(parseDateValue(value));
  return escapeHtml(value);
}
function collectFormData(fields, body) {
  const data = {};
  for (const item of fields) {
    const raw = String(body[item.name] ?? '').trim();
    if (item.required && !raw) return { error: `Заполните обязательное поле «${item.label}».` };
    if (!raw) {
      data[item.name] = item.kind === 'date' || item.kind === 'select' || (item.kind === 'number' && item.optional)
        ? null : (item.kind === 'number' ? 0 : '');
      continue;
    }
    if (item.kind === 'number') {
      const value = Number(raw);
      if (!Number.isFinite(value)) return { error: `Поле «${item.label}» должно быть числом.` };
      if (value < 0) return { error: `Поле «${item.label}» не может быть отрицательным.` };
      data[item.name] = value;
    } else if (item.kind === 'select') {
      if (!item.choices.some((choice) => String(choice.value) === raw)) return { error: `Выберите значение для поля «${item.label}».` };
      data[item.name] = item.optionsSql ? Number(raw) : raw;
    } else if (item.kind === 'date') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return { error: `Поле «${item.label}» должно содержать корректную дату.` };
      data[item.name] = raw;
    } else {
      data[item.name] = raw;
    }
  }
  return { data };
}
async function buildFields(database, config) {
  const fields = [];
  for (const source of config.fields) {
    const item = { ...source };
    if (item.optionsSql) {
      item.choices = (await database.all(item.optionsSql)).map((row) => {
        const values = Object.values(row);
        return { value: String(values[0]), label: String(values[1]) };
      });
    } else item.choices = item.options || [];
    fields.push(item);
  }
  return fields;
}

function renderList(config, rows, query) {
  const headers = config.columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('');
  const tableRows = rows.length ? rows.map((row) => {
    const cells = config.columns.map((column) => {
      const value = row[column.key];
      const isMoney = /price|amount|salary|cost|unit_price/i.test(column.key);
      return `<td>${isMoney && value !== null && value !== undefined ? formatMoney(value) : cellValue(value)}</td>`;
    }).join('');
    const id = encodeURIComponent(row.id);
    const edit = config.editable === false ? '' : `<a class="table-action" href="${config.listPath}/${id}/edit" aria-label="Редактировать">✎</a>`;
    const del = config.deletable === false ? '' : `<form method="post" action="${config.listPath}/${id}/delete" class="inline-form" onsubmit="return confirm('Удалить запись?')"><button class="table-action" type="submit" aria-label="Удалить">×</button></form>`;
    return `<tr>${cells}<td class="action-cell">${edit}${del}</td></tr>`;
  }).join('') : `<tr><td colspan="${config.columns.length + 1}" class="empty-state">Записей пока нет.</td></tr>`;
  const createLink = config.createable === false ? '' : `<a href="${config.listPath}/new" class="button button-primary"><span>＋</span> Добавить запись</a>`;
  const body = `<div class="page-heading"><div><div class="eyebrow">УПРАВЛЕНИЕ ДАННЫМИ</div><h1>${escapeHtml(config.title)}</h1><p>Данные загружаются из Microsoft SQL Server.</p></div>${createLink}</div>
  <section class="panel"><div class="panel-heading"><div><h2>${escapeHtml(config.title)}</h2><p>Записей: ${rows.length}</p></div><input id="tableFilter" class="table-search" type="search" placeholder="Поиск в таблице…" aria-label="Поиск"></div>
  <div class="table-wrap"><table id="dataTable"><thead><tr>${headers}<th>Действия</th></tr></thead><tbody>${tableRows}</tbody></table></div></section>
  <script>const filter=document.getElementById('tableFilter');filter.addEventListener('input',()=>{const q=filter.value.toLocaleLowerCase('ru');document.querySelectorAll('#dataTable tbody tr').forEach(row=>{row.hidden=!row.innerText.toLocaleLowerCase('ru').includes(q);});});</script>`;
  return renderLayout({ title: config.title, breadcrumb: config.title, activePath: config.listPath, body, notice: query.get('notice'), error: query.get('error') });
}
async function renderForm(database, config, values, recordId, error = null) {
  const fields = await buildFields(database, config);
  const inputs = fields.map((item) => {
    const id = item.name;
    const raw = values[item.name] instanceof Date ? parseDateValue(values[item.name]) : String(values[item.name] ?? '');
    const required = item.required ? ' required' : '';
    let input;
    if (item.kind === 'select') {
      const options = item.choices.map((choice) => `<option value="${escapeHtml(choice.value)}"${String(choice.value) === raw ? ' selected' : ''}>${escapeHtml(choice.label)}</option>`).join('');
      input = `<select id="${escapeHtml(id)}" name="${escapeHtml(id)}"${required}><option value="">Выберите значение</option>${options}</select>${item.choices.length ? '' : '<small class="field-help">Сначала добавьте соответствующие справочные данные.</small>'}`;
    } else if (item.kind === 'textarea') {
      input = `<textarea id="${escapeHtml(id)}" name="${escapeHtml(id)}" rows="3"${required}>${escapeHtml(raw)}</textarea>`;
    } else {
      const constraints = item.kind === 'number' ? ' min="0" step="any"' : '';
      const autocomplete = item.kind === 'email' ? ' autocomplete="email"' : '';
      input = `<input id="${escapeHtml(id)}" name="${escapeHtml(id)}" type="${escapeHtml(item.kind)}" value="${escapeHtml(raw)}"${required}${constraints}${autocomplete}>`;
    }
    return `<div class="form-field${item.kind === 'textarea' ? ' field-wide' : ''}"><label for="${escapeHtml(id)}">${escapeHtml(item.label)}${item.required ? '<span class="required-star">*</span>' : ''}</label>${input}</div>`;
  }).join('');
  const formAction = `${config.listPath}${recordId ? `/${recordId}/edit` : '/new'}`;
  const body = `<div class="page-heading"><div><div class="eyebrow">УПРАВЛЕНИЕ ДАННЫМИ</div><h1>${recordId ? 'Редактирование записи' : 'Новая запись'}</h1><p>${escapeHtml(config.title)} · заполните поля и сохраните данные.</p></div><a href="${config.listPath}" class="button button-secondary">← Назад к списку</a></div>
  <section class="panel form-panel"><div class="form-intro"><span class="form-intro-icon">✎</span><div><h2>${escapeHtml(config.title)}</h2><p>Поля со звёздочкой обязательны для заполнения.</p></div></div>
  <form method="post" action="${formAction}" class="data-form">${inputs}<div class="form-actions"><a href="${config.listPath}" class="button button-secondary">Отмена</a><button class="button button-primary" type="submit">${recordId ? 'Сохранить изменения' : 'Сохранить запись'} <span>→</span></button></div></form></section>`;
  return renderLayout({ title: `${recordId ? 'Редактирование' : 'Новая запись'} · ${config.title}`, breadcrumb: `${config.title} / ${recordId ? 'Редактирование' : 'Новая запись'}`, activePath: config.listPath, body, error });
}
function renderNotFound(pathname) {
  const body = '<section class="panel error-panel"><div class="error-code">404</div><h1>Страница не найдена</h1><p>Возможно, запись была удалена или ссылка устарела.</p><a class="button button-primary" href="/">Вернуться на главную</a></section>';
  return renderLayout({ title: 'Страница не найдена', breadcrumb: 'Ошибка 404', activePath: pathname, body });
}
async function dashboard(database, query) {
  const [carsRow, availableRow, customersRow, salesRow, revenueRow, recent] = await Promise.all([
    database.get('SELECT COUNT(*) AS value FROM dbo.Cars'),
    database.get("SELECT COUNT(*) AS value FROM dbo.Cars WHERE Status=N'В наличии'"),
    database.get('SELECT COUNT(*) AS value FROM dbo.Customers'),
    database.get('SELECT COUNT(*) AS value FROM dbo.Sales'),
    database.get('SELECT COALESCE(SUM(SaleAmount),0) AS value FROM dbo.Sales'),
    database.all(`SELECT TOP 5 s.SaleID AS id,s.SaleDate AS sale_date,s.SaleAmount AS sale_amount,
      CONCAT(b.BrandName,N' ',m.ModelName) AS car_name,CONCAT_WS(N' ',cu.LastName,cu.FirstName,cu.MiddleName) AS customer_name
      FROM dbo.Sales s JOIN dbo.Cars c ON c.CarID=s.CarID JOIN dbo.Models m ON m.ModelID=c.ModelID
      JOIN dbo.Brands b ON b.BrandID=m.BrandID JOIN dbo.Customers cu ON cu.CustomerID=s.CustomerID ORDER BY s.SaleID DESC`)
  ]);
  const recentRows = recent.length ? recent.map((sale) => `<tr><td><span class="contract-tag">№ ${escapeHtml(sale.id)}</span></td><td><strong>${escapeHtml(sale.car_name)}</strong><small class="table-sub">${escapeHtml(sale.customer_name)}</small></td><td>${cellValue(sale.sale_date)}</td><td class="amount">${formatMoney(sale.sale_amount)}</td></tr>`).join('') : '<tr><td colspan="4" class="empty-state">Продаж пока нет. Оформите первую сделку.</td></tr>';
  const body = `<div class="page-heading"><div><div class="eyebrow">ПАНЕЛЬ УПРАВЛЕНИЯ</div><h1>Добро пожаловать</h1><p>Показатели и последние операции из базы AutoSalonDB в Microsoft SQL Server.</p></div><a href="/sales/new" class="button button-primary"><span>＋</span> Оформить продажу</a></div>
  <div class="metric-grid"><article class="metric-card"><div class="metric-top"><span>Автомобили</span><span class="metric-icon icon-blue">◈</span></div><div class="metric-value">${carsRow.value}</div><div class="metric-note">Всего в системе</div></article>
  <article class="metric-card"><div class="metric-top"><span>В наличии</span><span class="metric-icon icon-green">✓</span></div><div class="metric-value">${availableRow.value}</div><div class="metric-note">Доступны к продаже</div></article>
  <article class="metric-card"><div class="metric-top"><span>Клиенты</span><span class="metric-icon icon-purple">♙</span></div><div class="metric-value">${customersRow.value}</div><div class="metric-note">Зарегистрировано</div></article>
  <article class="metric-card"><div class="metric-top"><span>Сделки</span><span class="metric-icon icon-orange">↗</span></div><div class="metric-value">${salesRow.value}</div><div class="metric-note">Сумма продаж: ${formatMoney(revenueRow.value)}</div></article></div>
  <div class="dashboard-columns"><section class="panel recent-panel"><div class="panel-heading"><div><h2>Последние продажи</h2><p>Недавно оформленные сделки</p></div><a class="text-link" href="/sales">Все продажи <span>→</span></a></div>
  <div class="table-wrap"><table><thead><tr><th>Продажа</th><th>Автомобиль / клиент</th><th>Дата</th><th>Сумма</th></tr></thead><tbody>${recentRows}</tbody></table></div></section>
  <section class="panel quick-panel"><div class="panel-heading"><div><h2>Быстрый доступ</h2><p>Основные действия</p></div></div>
  <a href="/cars/new" class="quick-action"><span class="quick-symbol symbol-blue">＋</span><span><strong>Добавить автомобиль</strong><small>Новая позиция в каталоге</small></span><b>→</b></a>
  <a href="/customers/new" class="quick-action"><span class="quick-symbol symbol-purple">♙</span><span><strong>Новый клиент</strong><small>Создать карточку клиента</small></span><b>→</b></a>
  <a href="/service-records/new" class="quick-action"><span class="quick-symbol symbol-orange">⚙</span><span><strong>Записать обслуживание</strong><small>Учёт сервисных работ</small></span><b>→</b></a></section></div>`;
  return renderLayout({ title: 'Обзор', breadcrumb: 'Обзор', activePath: '/', body, notice: query.get('notice'), error: query.get('error') });
}

function createMssqlApplication(options = {}) {
  const database = options.database || createMssqlDatabase(options.env || process.env);
  const handler = async (req, res) => {
    // HEAD обрабатывается как GET (Node сам не отправляет тело), чтобы `curl -I` и
    // health-проверки видели те же заголовки, что и обычный GET.
    const method = req.method === 'HEAD' ? 'GET' : req.method;
    let url;
    let pathname;
    try {
      url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      pathname = decodeURIComponent(url.pathname);
    } catch {
      // Некорректный адрес (например, /api/%zz): раньше исключение не перехватывалось и роняло процесс.
      res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8', 'x-robots-tag': 'noindex, nofollow', 'x-content-type-options': 'nosniff' });
      return res.end('Bad Request');
    }

    // Headers required by the SEO practical assignment. Apply before routing so they
    // are present on successful responses, redirects, errors and unknown routes.
    res.setHeader('X-Powered-By', 'Express');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '0');
    if (pathname.startsWith('/api/')) {
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    } else if (pathname !== '/' && pathname !== '/robots.txt' && pathname !== '/sitemap.xml' && !pathname.startsWith('/static/')) {
      // Let crawlers fetch private/internal pages so they can see this directive; robots.txt must not block them.
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    }
    try {
      if (method === 'GET' && (pathname === '/robots.txt' || pathname === '/sitemap.xml')) {
        const filename = pathname === '/robots.txt' ? 'robots.txt' : 'sitemap.xml';
        const contentType = pathname === '/robots.txt' ? 'text/plain; charset=utf-8' : 'application/xml; charset=utf-8';
        const content = fs.readFileSync(path.join(__dirname, '..', 'static', filename));
        res.writeHead(200, { 'content-type': contentType, 'x-content-type-options': 'nosniff', 'cache-control': 'public, max-age=3600' });
        return res.end(content);
      }
      if (method === 'GET' && pathname === '/static/styles.css') {
        const css = fs.readFileSync(path.join(__dirname, '..', 'static', 'styles.css'));
        res.writeHead(200, { 'content-type': 'text/css; charset=utf-8', 'cache-control': 'public, max-age=3600', 'x-content-type-options': 'nosniff' });
        return res.end(css);
      }
      if (method === 'GET' && pathname === '/api/health') {
        const connection = await database.checkConnection();
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'x-content-type-options': 'nosniff', 'x-robots-tag': 'noindex, nofollow' });
        return res.end(JSON.stringify({ status: 'ok', service: 'autosalon-web', runtime: 'node.js', database: 'Microsoft SQL Server', databaseName: connection.database_name }));
      }
      if (method === 'GET' && pathname === '/api/cars') {
        const cars = await database.all(`SELECT c.CarID AS id,b.BrandName AS brand,m.ModelName AS model,c.ManufactureYear AS year,
          c.VIN AS vin,c.SalePrice AS sale_price,c.Status AS status FROM dbo.Cars c JOIN dbo.Models m ON m.ModelID=c.ModelID
          JOIN dbo.Brands b ON b.BrandID=m.BrandID ORDER BY c.CarID`);
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'x-content-type-options': 'nosniff', 'x-robots-tag': 'noindex, nofollow' });
        return res.end(JSON.stringify(cars));
      }
      if (method === 'GET' && pathname === '/') return pageResponse(res, 200, await dashboard(database, url.searchParams));

      const directEntity = Object.entries(entities).find(([, config]) => config.listPath === pathname);
      if (method === 'GET' && directEntity) {
        const [, config] = directEntity;
        return pageResponse(res, 200, renderList(config, await database.all(config.listSql), url.searchParams));
      }

      const newRoute = pathname.match(/^(.+)\/new$/);
      if (newRoute) {
        const config = getEntity(newRoute[1].slice(1));
        if (!config || config.createable === false) return pageResponse(res, 404, renderNotFound(pathname));
        if (method === 'GET') return pageResponse(res, 200, await renderForm(database, config, {}, null, url.searchParams.get('error')));
        if (method === 'POST') {
          const body = await readForm(req);
          const fields = await buildFields(database, config);
          const result = collectFormData(fields, body);
          if (result.error) return pageResponse(res, 400, await renderForm(database, config, body, null, result.error));
          const data = result.data;
          const names = Object.keys(data);
          try {
            if (newRoute[1].slice(1) === 'sales') {
              await database.transaction(async (tx) => {
                const changed = await tx.run('UPDATE dbo.Cars SET Status=N\'Продан\' WHERE CarID=? AND Status=N\'В наличии\'', [data.CarID]);
                if (!changed.changes) throw new Error('Автомобиль больше не доступен для продажи. Обновите страницу и выберите другой автомобиль.');
                await tx.run(`INSERT INTO ${config.table} (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')})`, names.map((name) => data[name]));
              });
            } else {
              await database.run(`INSERT INTO ${config.table} (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')})`, names.map((name) => data[name]));
            }
            return redirect(res, `${config.listPath}?notice=${encodeURIComponent('Запись успешно добавлена.')}`);
          } catch (error) {
            return pageResponse(res, 400, await renderForm(database, config, body, null, /unavailable|доступен/i.test(error.message) ? error.message : messageFromDbError(error)));
          }
        }
      }

      const editRoute = pathname.match(/^(.+)\/(\d+)\/edit$/);
      if (editRoute) {
        const config = getEntity(editRoute[1].slice(1));
        const recordId = Number(editRoute[2]);
        if (!config || config.editable === false) return pageResponse(res, 404, renderNotFound(pathname));
        const current = await database.get(`SELECT * FROM ${config.table} WHERE ${config.idColumn}=?`, [recordId]);
        if (!current) return pageResponse(res, 404, renderNotFound(pathname));
        if (method === 'GET') return pageResponse(res, 200, await renderForm(database, config, current, recordId));
        if (method === 'POST') {
          const body = await readForm(req);
          const fields = await buildFields(database, config);
          const result = collectFormData(fields, body);
          if (result.error) return pageResponse(res, 400, await renderForm(database, config, body, recordId, result.error));
          const data = result.data;
          const names = Object.keys(data);
          try {
            await database.run(`UPDATE ${config.table} SET ${names.map((name) => `${name}=?`).join(', ')} WHERE ${config.idColumn}=?`, [...names.map((name) => data[name]), recordId]);
            return redirect(res, `${config.listPath}?notice=${encodeURIComponent('Изменения сохранены.')}`);
          } catch (error) {
            return pageResponse(res, 400, await renderForm(database, config, body, recordId, messageFromDbError(error)));
          }
        }
      }

      const deleteRoute = pathname.match(/^(.+)\/(\d+)\/delete$/);
      if (method === 'POST' && deleteRoute) {
        const config = getEntity(deleteRoute[1].slice(1));
        if (!config || config.deletable === false) return pageResponse(res, 404, renderNotFound(pathname));
        const recordId = Number(deleteRoute[2]);
        try {
          const result = await database.run(`DELETE FROM ${config.table} WHERE ${config.idColumn}=?`, [recordId]);
          const notice = result.changes ? 'Запись удалена.' : 'Запись не найдена.';
          return redirect(res, `${config.listPath}?notice=${encodeURIComponent(notice)}`);
        } catch (error) {
          return redirect(res, `${config.listPath}?error=${encodeURIComponent(messageFromDbError(error))}`);
        }
      }

      return pageResponse(res, 404, renderNotFound(pathname));
    } catch (error) {
      console.error('[AutoSalon SQL Server]', error);
      const status = error.statusCode || 500;
      const explanation = status === 413 ? 'Слишком большой запрос.' : (pathname === '/api/health' ? 'Не удалось подключиться к SQL Server. Проверьте параметры подключения и журнал приложения.' : 'Проверьте подключение к SQL Server и журналы приложения.');
      if (pathname.startsWith('/api/')) {
        res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'x-robots-tag': 'noindex, nofollow', 'x-content-type-options': 'nosniff' });
        return res.end(JSON.stringify({ status: 'error', message: explanation }));
      }
      return pageResponse(res, status, renderLayout({ title: 'Ошибка сервера', breadcrumb: 'Ошибка', activePath: '', body: `<section class="panel error-panel"><h1>Не удалось обработать запрос</h1><p>${escapeHtml(explanation)}</p><a class="button button-primary" href="/">Вернуться на главную</a></section>` }));
    }
  };
  return { handler, database };
}

async function start() {
  let application;
  try {
    application = createMssqlApplication();
    const port = Number(process.env.PORT || 5000);
    const host = process.env.HOST || '0.0.0.0';
    const server = http.createServer(application.handler);
    server.listen(port, host, () => console.log(`AutoSalon Node.js + Microsoft SQL Server: http://${host}:${port}`));
    const shutdown = () => server.close(async () => { await application.database.close(); process.exit(0); });
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    console.error('Не удалось запустить AutoSalon:', error.message);
    if (application?.database) await application.database.close();
    process.exitCode = 1;
  }
}

module.exports = { createMssqlApplication, start, renderList, renderForm };
