PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    base_salary NUMERIC NOT NULL DEFAULT 0 CHECK (base_salary >= 0),
    commission_percent NUMERIC NOT NULL DEFAULT 0 CHECK (commission_percent BETWEEN 0 AND 100),
    description TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    position_id INTEGER REFERENCES positions(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    phone TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    hire_date TEXT NOT NULL DEFAULT (date('now')),
    termination_date TEXT,
    passport_series TEXT NOT NULL DEFAULT '',
    passport_number TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    passport_series TEXT NOT NULL DEFAULT '',
    passport_number TEXT NOT NULL DEFAULT '',
    driver_license TEXT NOT NULL DEFAULT '',
    driver_license_date TEXT,
    registered_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS brands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    country TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS models (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand_id INTEGER NOT NULL REFERENCES brands(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    name TEXT NOT NULL,
    body_type TEXT NOT NULL DEFAULT '',
    fuel_type TEXT NOT NULL DEFAULT 'Бензин',
    transmission TEXT NOT NULL DEFAULT 'Автоматическая',
    engine_volume NUMERIC CHECK (engine_volume IS NULL OR engine_volume > 0),
    UNIQUE (brand_id, name)
);

CREATE TABLE IF NOT EXISTS car_statuses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    contact_person TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS cars (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_id INTEGER NOT NULL REFERENCES models(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    supplier_id INTEGER REFERENCES suppliers(id) ON UPDATE CASCADE ON DELETE SET NULL,
    year INTEGER NOT NULL CHECK (year BETWEEN 1950 AND 2100),
    vin TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '',
    mileage INTEGER NOT NULL DEFAULT 0 CHECK (mileage >= 0),
    list_price NUMERIC NOT NULL CHECK (list_price >= 0),
    status_id INTEGER NOT NULL REFERENCES car_statuses(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    warranty_months INTEGER NOT NULL DEFAULT 12 CHECK (warranty_months >= 0),
    added_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    car_id INTEGER NOT NULL UNIQUE REFERENCES cars(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    sale_date TEXT NOT NULL DEFAULT (date('now')),
    sale_price NUMERIC NOT NULL CHECK (sale_price >= 0),
    payment_method TEXT NOT NULL DEFAULT 'Банковский перевод',
    contract_number TEXT NOT NULL UNIQUE,
    notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS service_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    car_id INTEGER NOT NULL REFERENCES cars(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    employee_id INTEGER REFERENCES employees(id) ON UPDATE CASCADE ON DELETE SET NULL,
    service_date TEXT NOT NULL DEFAULT (date('now')),
    service_type TEXT NOT NULL,
    cost NUMERIC NOT NULL DEFAULT 0 CHECK (cost >= 0),
    mileage INTEGER NOT NULL DEFAULT 0 CHECK (mileage >= 0),
    description TEXT NOT NULL DEFAULT '',
    warranty_until TEXT
);

CREATE TABLE IF NOT EXISTS supplier_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    model_id INTEGER NOT NULL REFERENCES models(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    purchase_price NUMERIC NOT NULL CHECK (purchase_price >= 0),
    order_date TEXT NOT NULL DEFAULT (date('now')),
    delivery_date TEXT,
    status TEXT NOT NULL DEFAULT 'Новый'
);

CREATE INDEX IF NOT EXISTS idx_cars_status ON cars(status_id);
CREATE INDEX IF NOT EXISTS idx_cars_model ON cars(model_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_service_records_car ON service_records(car_id);
CREATE INDEX IF NOT EXISTS idx_supplier_orders_supplier ON supplier_orders(supplier_id);
