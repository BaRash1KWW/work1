'use strict';

const field = (name, label, kind = 'text', required = false, options = null, optional = false) => ({
  name, label, kind, required, optionsSql: typeof options === 'string' ? options : null,
  options: Array.isArray(options) ? options : null, optional
});

const selectChoices = (pairs) => pairs.map(([value, label]) => ({ value, label }));

const entities = {
  brands: {
    title: 'Марки автомобилей', table: 'brands', listPath: '/brands',
    columns: [{ key: 'id', label: 'ID' }, { key: 'name', label: 'Марка' }, { key: 'country', label: 'Страна' }],
    listSql: 'SELECT id, name, country FROM brands ORDER BY name',
    fields: [field('name', 'Название марки', 'text', true), field('country', 'Страна')]
  },
  models: {
    title: 'Модели автомобилей', table: 'models', listPath: '/models',
    columns: [
      { key: 'id', label: 'ID' }, { key: 'brand', label: 'Марка' }, { key: 'name', label: 'Модель' },
      { key: 'body_type', label: 'Тип кузова' }, { key: 'fuel_type', label: 'Топливо' },
      { key: 'transmission', label: 'Коробка передач' }, { key: 'engine_volume', label: 'Объём двигателя' }
    ],
    listSql: `SELECT m.id, b.name AS brand, m.name, m.body_type, m.fuel_type, m.transmission, m.engine_volume
              FROM models m JOIN brands b ON b.id=m.brand_id ORDER BY b.name, m.name`,
    fields: [
      field('brand_id', 'Марка', 'select', true, 'SELECT id, name FROM brands ORDER BY name'),
      field('name', 'Название модели', 'text', true), field('body_type', 'Тип кузова'),
      field('fuel_type', 'Тип топлива', 'select', false, selectChoices([['Бензин', 'Бензин'], ['Дизель', 'Дизель'], ['Гибрид', 'Гибрид'], ['Электричество', 'Электричество']])),
      field('transmission', 'Коробка передач', 'select', false, selectChoices([['Автоматическая', 'Автоматическая'], ['Механическая', 'Механическая'], ['Вариатор', 'Вариатор'], ['Робот', 'Робот']])),
      field('engine_volume', 'Объём двигателя, л', 'number', false, null, true)
    ]
  },
  positions: {
    title: 'Должности', table: 'positions', listPath: '/positions',
    columns: [{ key: 'id', label: 'ID' }, { key: 'name', label: 'Должность' }, { key: 'base_salary', label: 'Оклад, ₽' }, { key: 'commission_percent', label: 'Комиссия, %' }, { key: 'description', label: 'Описание' }],
    listSql: 'SELECT id, name, base_salary, commission_percent, description FROM positions ORDER BY name',
    fields: [field('name', 'Название должности', 'text', true), field('base_salary', 'Оклад, ₽', 'number', true), field('commission_percent', 'Комиссия, %', 'number', true), field('description', 'Описание', 'textarea')]
  },
  'car-statuses': {
    title: 'Статусы автомобилей', table: 'car_statuses', listPath: '/car-statuses',
    columns: [{ key: 'id', label: 'ID' }, { key: 'name', label: 'Статус' }, { key: 'description', label: 'Описание' }],
    listSql: 'SELECT id, name, description FROM car_statuses ORDER BY id',
    fields: [field('name', 'Название статуса', 'text', true), field('description', 'Описание', 'textarea')]
  },
  customers: {
    title: 'Клиенты', table: 'customers', listPath: '/customers',
    columns: [{ key: 'id', label: 'ID' }, { key: 'full_name', label: 'ФИО' }, { key: 'phone', label: 'Телефон' }, { key: 'email', label: 'Email' }, { key: 'address', label: 'Адрес' }],
    listSql: 'SELECT id, full_name, phone, email, address FROM customers ORDER BY id DESC',
    fields: [field('full_name', 'ФИО', 'text', true), field('phone', 'Телефон'), field('email', 'Email', 'email'), field('address', 'Адрес'), field('passport_series', 'Серия паспорта'), field('passport_number', 'Номер паспорта'), field('driver_license', 'Водительское удостоверение'), field('driver_license_date', 'Дата выдачи прав', 'date')]
  },
  employees: {
    title: 'Сотрудники', table: 'employees', listPath: '/employees',
    columns: [{ key: 'id', label: 'ID' }, { key: 'full_name', label: 'ФИО' }, { key: 'position', label: 'Должность' }, { key: 'phone', label: 'Телефон' }, { key: 'email', label: 'Email' }, { key: 'hire_date', label: 'Дата приёма' }],
    listSql: `SELECT e.id, e.full_name, COALESCE(p.name, 'Не назначена') AS position, e.phone, e.email, e.hire_date
              FROM employees e LEFT JOIN positions p ON p.id=e.position_id ORDER BY e.id DESC`,
    fields: [field('full_name', 'ФИО', 'text', true), field('position_id', 'Должность', 'select', true, 'SELECT id, name FROM positions ORDER BY name'), field('phone', 'Телефон'), field('email', 'Email', 'email'), field('hire_date', 'Дата приёма', 'date', true), field('termination_date', 'Дата увольнения', 'date'), field('passport_series', 'Серия паспорта'), field('passport_number', 'Номер паспорта'), field('address', 'Адрес')]
  },
  cars: {
    title: 'Автомобили', table: 'cars', listPath: '/cars',
    columns: [{ key: 'id', label: 'ID' }, { key: 'car_name', label: 'Автомобиль' }, { key: 'year', label: 'Год' }, { key: 'vin', label: 'VIN' }, { key: 'color', label: 'Цвет' }, { key: 'list_price', label: 'Цена' }, { key: 'status', label: 'Статус' }, { key: 'supplier', label: 'Поставщик' }],
    listSql: `SELECT c.id, b.name || ' ' || m.name AS car_name, c.year, c.vin, c.color, c.list_price,
              st.name AS status, COALESCE(s.name, '—') AS supplier
              FROM cars c JOIN models m ON m.id=c.model_id JOIN brands b ON b.id=m.brand_id
              JOIN car_statuses st ON st.id=c.status_id LEFT JOIN suppliers s ON s.id=c.supplier_id ORDER BY c.id DESC`,
    fields: [
      field('model_id', 'Марка и модель', 'select', true, "SELECT m.id, b.name || ' ' || m.name FROM models m JOIN brands b ON b.id=m.brand_id ORDER BY b.name, m.name"),
      field('supplier_id', 'Поставщик', 'select', false, 'SELECT id, name FROM suppliers ORDER BY name', true),
      field('year', 'Год выпуска', 'number', true), field('vin', 'VIN', 'text', true), field('color', 'Цвет'),
      field('mileage', 'Пробег, км', 'number'), field('list_price', 'Цена, ₽', 'number', true),
      field('status_id', 'Статус', 'select', true, 'SELECT id, name FROM car_statuses ORDER BY id'),
      field('warranty_months', 'Гарантия, месяцев', 'number')
    ]
  },
  sales: {
    title: 'Продажи', table: 'sales', listPath: '/sales', editable: false, deletable: false,
    columns: [{ key: 'id', label: 'ID' }, { key: 'contract_number', label: 'Договор' }, { key: 'sale_date', label: 'Дата' }, { key: 'car_name', label: 'Автомобиль' }, { key: 'customer', label: 'Клиент' }, { key: 'employee', label: 'Сотрудник' }, { key: 'sale_price', label: 'Стоимость' }, { key: 'payment_method', label: 'Оплата' }],
    listSql: `SELECT s.id, s.contract_number, s.sale_date, b.name || ' ' || m.name AS car_name,
              c.full_name AS customer, e.full_name AS employee, s.sale_price, s.payment_method
              FROM sales s JOIN customers c ON c.id=s.customer_id JOIN employees e ON e.id=s.employee_id
              JOIN cars car ON car.id=s.car_id JOIN models m ON m.id=car.model_id JOIN brands b ON b.id=m.brand_id ORDER BY s.id DESC`,
    fields: [
      field('car_id', 'Автомобиль', 'select', true, "SELECT c.id, b.name || ' ' || m.name || ' (' || c.year || ', ' || c.vin || ')' FROM cars c JOIN models m ON m.id=c.model_id JOIN brands b ON b.id=m.brand_id JOIN car_statuses st ON st.id=c.status_id WHERE st.name='В наличии' AND NOT EXISTS (SELECT 1 FROM sales s WHERE s.car_id=c.id) ORDER BY b.name, m.name"),
      field('customer_id', 'Клиент', 'select', true, 'SELECT id, full_name FROM customers ORDER BY full_name'),
      field('employee_id', 'Ответственный сотрудник', 'select', true, 'SELECT id, full_name FROM employees WHERE termination_date IS NULL ORDER BY full_name'),
      field('sale_date', 'Дата продажи', 'date', true), field('sale_price', 'Цена продажи, ₽', 'number', true),
      field('payment_method', 'Способ оплаты', 'select', true, selectChoices([['Наличные', 'Наличные'], ['Банковский перевод', 'Банковский перевод'], ['Кредит', 'Кредит']])),
      field('contract_number', 'Номер договора', 'text', true), field('notes', 'Комментарий', 'textarea')
    ]
  },
  'service-records': {
    title: 'Сервисные записи', table: 'service_records', listPath: '/service-records',
    columns: [{ key: 'id', label: 'ID' }, { key: 'car_name', label: 'Автомобиль' }, { key: 'service_date', label: 'Дата' }, { key: 'service_type', label: 'Работы' }, { key: 'cost', label: 'Стоимость' }, { key: 'mileage', label: 'Пробег, км' }, { key: 'employee', label: 'Сотрудник' }, { key: 'description', label: 'Описание' }],
    listSql: `SELECT r.id, b.name || ' ' || m.name AS car_name, r.service_date, r.service_type, r.cost, r.mileage,
              COALESCE(e.full_name, '—') AS employee, r.description FROM service_records r
              JOIN cars c ON c.id=r.car_id JOIN models m ON m.id=c.model_id JOIN brands b ON b.id=m.brand_id
              LEFT JOIN employees e ON e.id=r.employee_id ORDER BY r.id DESC`,
    fields: [
      field('car_id', 'Автомобиль', 'select', true, "SELECT c.id, b.name || ' ' || m.name || ' (' || c.vin || ')' FROM cars c JOIN models m ON m.id=c.model_id JOIN brands b ON b.id=m.brand_id ORDER BY b.name, m.name"),
      field('employee_id', 'Механик / сотрудник', 'select', false, 'SELECT id, full_name FROM employees ORDER BY full_name', true),
      field('service_date', 'Дата обслуживания', 'date', true), field('service_type', 'Тип работ', 'text', true),
      field('cost', 'Стоимость, ₽', 'number', true), field('mileage', 'Пробег, км', 'number'),
      field('description', 'Описание', 'textarea'), field('warranty_until', 'Гарантия до', 'date')
    ]
  },
  suppliers: {
    title: 'Поставщики', table: 'suppliers', listPath: '/suppliers',
    columns: [{ key: 'id', label: 'ID' }, { key: 'name', label: 'Название' }, { key: 'contact_person', label: 'Контактное лицо' }, { key: 'phone', label: 'Телефон' }, { key: 'email', label: 'Email' }, { key: 'address', label: 'Адрес' }],
    listSql: 'SELECT id, name, contact_person, phone, email, address FROM suppliers ORDER BY id DESC',
    fields: [field('name', 'Название поставщика', 'text', true), field('contact_person', 'Контактное лицо'), field('phone', 'Телефон'), field('email', 'Email', 'email'), field('address', 'Адрес')]
  },
  'supplier-orders': {
    title: 'Заказы поставщикам', table: 'supplier_orders', listPath: '/supplier-orders',
    columns: [{ key: 'id', label: 'ID' }, { key: 'supplier', label: 'Поставщик' }, { key: 'model', label: 'Модель автомобиля' }, { key: 'quantity', label: 'Количество' }, { key: 'purchase_price', label: 'Цена за ед.' }, { key: 'order_date', label: 'Дата заказа' }, { key: 'delivery_date', label: 'Дата поставки' }, { key: 'status', label: 'Статус' }],
    listSql: `SELECT o.id, s.name AS supplier, b.name || ' ' || m.name AS model, o.quantity, o.purchase_price,
              o.order_date, o.delivery_date, o.status FROM supplier_orders o JOIN suppliers s ON s.id=o.supplier_id
              JOIN models m ON m.id=o.model_id JOIN brands b ON b.id=m.brand_id ORDER BY o.id DESC`,
    fields: [field('supplier_id', 'Поставщик', 'select', true, 'SELECT id, name FROM suppliers ORDER BY name'),
      field('model_id', 'Модель автомобиля', 'select', true, "SELECT m.id, b.name || ' ' || m.name FROM models m JOIN brands b ON b.id=m.brand_id ORDER BY b.name, m.name"),
      field('quantity', 'Количество', 'number', true), field('purchase_price', 'Закупочная цена за единицу, ₽', 'number', true),
      field('order_date', 'Дата заказа', 'date', true), field('delivery_date', 'Дата поставки', 'date'),
      field('status', 'Статус заказа', 'select', true, selectChoices([['Новый', 'Новый'], ['В пути', 'В пути'], ['Доставлен', 'Доставлен'], ['Отменён', 'Отменён']]))]
  }
};

module.exports = { entities, field };
