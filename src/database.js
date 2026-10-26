'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

function seedDatabase(raw) {
  if (raw.prepare('SELECT COUNT(*) AS total FROM positions').get().total > 0) return;
  raw.exec('BEGIN');
  try {
    const insert = (sql, params) => raw.prepare(sql).run(...params).lastInsertRowid;
    const positions = [
      ['Менеджер по продажам', 65000, 2.5, 'Консультация клиентов и оформление сделок'],
      ['Механик', 60000, 0, 'Диагностика и обслуживание автомобилей'],
      ['Администратор', 55000, 0, 'Административная работа автосалона']
    ];
    for (const row of positions) insert('INSERT INTO positions(name, base_salary, commission_percent, description) VALUES (?, ?, ?, ?)', row);
    for (const row of [
      ['В наличии', 'Автомобиль доступен для продажи'], ['Зарезервирован', 'Автомобиль зарезервирован клиентом'],
      ['Продан', 'Сделка оформлена'], ['На обслуживании', 'Автомобиль находится в сервисе']
    ]) insert('INSERT INTO car_statuses(name, description) VALUES (?, ?)', row);

    const brandIds = {};
    for (const row of [['Toyota', 'Япония'], ['Kia', 'Южная Корея'], ['Lada', 'Россия'], ['Hyundai', 'Южная Корея']]) {
      brandIds[row[0]] = insert('INSERT INTO brands(name, country) VALUES (?, ?)', row);
    }
    const modelIds = {};
    for (const [brand, name, body, fuel, transmission, engine] of [
      ['Toyota', 'Camry', 'Седан', 'Бензин', 'Автоматическая', 2.5],
      ['Kia', 'Rio', 'Седан', 'Бензин', 'Автоматическая', 1.6],
      ['Lada', 'Vesta', 'Седан', 'Бензин', 'Механическая', 1.6],
      ['Hyundai', 'Creta', 'Кроссовер', 'Бензин', 'Автоматическая', 2.0]
    ]) {
      modelIds[`${brand}:${name}`] = insert(
        'INSERT INTO models(brand_id, name, body_type, fuel_type, transmission, engine_volume) VALUES (?, ?, ?, ?, ?, ?)',
        [brandIds[brand], name, body, fuel, transmission, engine]
      );
    }
    const supplierIds = {};
    for (const row of [
      ['АвтоИмпорт', 'Алексей Смирнов', '+7 900 111-22-33', 'sales@autoimport.example', 'Новосибирск'],
      ['МоторСнаб', 'Мария Кузнецова', '+7 900 444-55-66', 'info@motorsnab.example', 'Бердск']
    ]) supplierIds[row[0]] = insert('INSERT INTO suppliers(name, contact_person, phone, email, address) VALUES (?, ?, ?, ?, ?)', row);

    insert('INSERT INTO employees(full_name, position_id, phone, email, hire_date, address) VALUES (?, ?, ?, ?, ?, ?)', ['Иван Петров', 1, '+7 913 100-20-30', 'i.petrov@example.com', '2023-04-10', 'Новосибирск']);
    insert('INSERT INTO employees(full_name, position_id, phone, email, hire_date, address) VALUES (?, ?, ?, ?, ?, ?)', ['Анна Соколова', 2, '+7 913 200-30-40', 'a.sokolova@example.com', '2022-08-15', 'Новосибирск']);
    for (const row of [
      ['Сергей Иванов', '+7 913 300-40-50', 's.ivanov@example.com', 'Новосибирск'],
      ['Елена Смирнова', '+7 913 400-50-60', 'e.smirnova@example.com', 'Бердск'],
      ['Дмитрий Орлов', '+7 913 500-60-70', 'd.orlov@example.com', 'Новосибирск']
    ]) insert('INSERT INTO customers(full_name, phone, email, address) VALUES (?, ?, ?, ?)', row);

    const statusId = (name) => raw.prepare('SELECT id FROM car_statuses WHERE name=?').get(name).id;
    for (const [model, supplier, year, vin, color, mileage, price, status, warranty] of [
      ['Toyota:Camry', 'АвтоИмпорт', 2024, 'JTNB11HK5R3001001', 'Белый', 12000, 3850000, 'В наличии', 36],
      ['Kia:Rio', 'АвтоИмпорт', 2023, 'Z94C241BBPR001002', 'Серебристый', 22000, 1750000, 'В наличии', 24],
      ['Lada:Vesta', 'МоторСнаб', 2025, 'XTAGFL110SY001003', 'Синий', 2500, 1690000, 'В наличии', 36],
      ['Hyundai:Creta', 'АвтоИмпорт', 2022, 'Z94K2812NPR001004', 'Серый', 36000, 2450000, 'Продан', 12]
    ]) {
      insert('INSERT INTO cars(model_id, supplier_id, year, vin, color, mileage, list_price, status_id, warranty_months) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [modelIds[model], supplierIds[supplier], year, vin, color, mileage, price, statusId(status), warranty]);
    }
    insert('INSERT INTO sales(car_id, customer_id, employee_id, sale_date, sale_price, payment_method, contract_number, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [4, 1, 1, '2025-11-14', 2390000, 'Банковский перевод', 'ДП-2025-001', 'Демонстрационная продажа']);
    for (const row of [
      [1, 2, '2026-01-18', 'Плановое ТО', 12500, 10000, 'Замена масла и фильтров'],
      [2, 2, '2026-02-02', 'Диагностика', 3500, 20000, 'Компьютерная диагностика']
    ]) insert('INSERT INTO service_records(car_id, employee_id, service_date, service_type, cost, mileage, description) VALUES (?, ?, ?, ?, ?, ?, ?)', row);
    for (const row of [
      [supplierIds['МоторСнаб'], modelIds['Lada:Vesta'], 3, 1420000, '2026-02-10', '2026-03-01', 'Доставлен'],
      [supplierIds['АвтоИмпорт'], modelIds['Toyota:Camry'], 2, 3200000, '2026-03-10', null, 'В пути']
    ]) insert('INSERT INTO supplier_orders(supplier_id, model_id, quantity, purchase_price, order_date, delivery_date, status) VALUES (?, ?, ?, ?, ?, ?, ?)', row);
    raw.exec('COMMIT');
  } catch (error) {
    raw.exec('ROLLBACK');
    throw error;
  }
}

function createDatabase(databasePath, options = {}) {
  if (databasePath !== ':memory:') fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const raw = new DatabaseSync(databasePath);
  raw.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  raw.exec(fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8'));
  if (options.seed !== false) seedDatabase(raw);
  return {
    raw,
    all(sql, params = []) { return raw.prepare(sql).all(...params); },
    get(sql, params = []) { return raw.prepare(sql).get(...params) || null; },
    run(sql, params = []) { return raw.prepare(sql).run(...params); },
    persist() {},
    close() { raw.close(); }
  };
}

module.exports = { createDatabase, seedDatabase };
