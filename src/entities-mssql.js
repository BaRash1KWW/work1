'use strict';

const field = (name, label, kind = 'text', required = false, optionsSql = null, optional = false, options = null) => ({
  name, label, kind, required, optionsSql, optional, options
});
const choices = (items) => items.map(([value, label]) => ({ value, label }));

// Entity mappings for the SQL Server schema in database/sqlserver/AutoSalonDB_Create_And_Seed.sql.
// `id` is the display alias in listSql; idColumn is the actual primary key used for CRUD.
const entities = {
  brands: {
    title: 'Марки автомобилей', table: 'dbo.Brands', idColumn: 'BrandID', listPath: '/brands',
    columns: [{ key: 'id', label: 'ID' }, { key: 'name', label: 'Марка' }, { key: 'country', label: 'Страна' }],
    listSql: 'SELECT BrandID AS id, BrandName AS name, Country AS country FROM dbo.Brands ORDER BY BrandName',
    fields: [field('BrandName', 'Название марки', 'text', true), field('Country', 'Страна', 'text', true)]
  },
  models: {
    title: 'Модели автомобилей', table: 'dbo.Models', idColumn: 'ModelID', listPath: '/models',
    columns: [{ key: 'id', label: 'ID' }, { key: 'brand', label: 'Марка' }, { key: 'model', label: 'Модель' }, { key: 'body_type', label: 'Тип кузова' }],
    listSql: `SELECT m.ModelID AS id, b.BrandName AS brand, m.ModelName AS model, m.BodyType AS body_type
      FROM dbo.Models m JOIN dbo.Brands b ON b.BrandID=m.BrandID ORDER BY b.BrandName,m.ModelName`,
    fields: [
      field('BrandID', 'Марка', 'select', true, 'SELECT BrandID AS OptionValue, BrandName AS OptionLabel FROM dbo.Brands ORDER BY BrandName'),
      field('ModelName', 'Название модели', 'text', true), field('BodyType', 'Тип кузова', 'text', true)
    ]
  },
  positions: {
    title: 'Должности', table: 'dbo.Positions', idColumn: 'PositionID', listPath: '/positions',
    columns: [{ key: 'id', label: 'ID' }, { key: 'name', label: 'Должность' }, { key: 'salary', label: 'Оклад, ₽' }],
    listSql: 'SELECT PositionID AS id, PositionName AS name, Salary AS salary FROM dbo.Positions ORDER BY PositionName',
    fields: [field('PositionName', 'Название должности', 'text', true), field('Salary', 'Оклад, ₽', 'number', true)]
  },
  employees: {
    title: 'Сотрудники', table: 'dbo.Employees', idColumn: 'EmployeeID', listPath: '/employees',
    columns: [{ key: 'id', label: 'ID' }, { key: 'full_name', label: 'ФИО' }, { key: 'position', label: 'Должность' }, { key: 'phone', label: 'Телефон' }, { key: 'email', label: 'Email' }, { key: 'hire_date', label: 'Дата приёма' }],
    listSql: `SELECT e.EmployeeID AS id, CONCAT_WS(N' ',e.LastName,e.FirstName,e.MiddleName) AS full_name,
      p.PositionName AS position,e.Phone AS phone,e.Email AS email,e.HireDate AS hire_date
      FROM dbo.Employees e JOIN dbo.Positions p ON p.PositionID=e.PositionID ORDER BY e.EmployeeID DESC`,
    fields: [
      field('LastName', 'Фамилия', 'text', true), field('FirstName', 'Имя', 'text', true), field('MiddleName', 'Отчество'),
      field('Phone', 'Телефон'), field('Email', 'Email', 'email'),
      field('PositionID', 'Должность', 'select', true, 'SELECT PositionID AS OptionValue, PositionName AS OptionLabel FROM dbo.Positions ORDER BY PositionName'),
      field('HireDate', 'Дата приёма', 'date', true)
    ]
  },
  customers: {
    title: 'Клиенты', table: 'dbo.Customers', idColumn: 'CustomerID', listPath: '/customers',
    columns: [{ key: 'id', label: 'ID' }, { key: 'full_name', label: 'ФИО' }, { key: 'phone', label: 'Телефон' }, { key: 'email', label: 'Email' }, { key: 'created', label: 'Дата регистрации' }],
    listSql: `SELECT CustomerID AS id, CONCAT_WS(N' ',LastName,FirstName,MiddleName) AS full_name,
      Phone AS phone,Email AS email,CreatedAt AS created FROM dbo.Customers ORDER BY CustomerID DESC`,
    fields: [field('LastName', 'Фамилия', 'text', true), field('FirstName', 'Имя', 'text', true), field('MiddleName', 'Отчество'),
      field('Phone', 'Телефон', 'text', true), field('Email', 'Email', 'email')]
  },
  suppliers: {
    title: 'Поставщики', table: 'dbo.Suppliers', idColumn: 'SupplierID', listPath: '/suppliers',
    columns: [{ key: 'id', label: 'ID' }, { key: 'name', label: 'Поставщик' }, { key: 'contact', label: 'Контактное лицо' }, { key: 'phone', label: 'Телефон' }, { key: 'email', label: 'Email' }, { key: 'address', label: 'Адрес' }],
    listSql: `SELECT SupplierID AS id,SupplierName AS name,ContactPerson AS contact,Phone AS phone,Email AS email,Address AS address
      FROM dbo.Suppliers ORDER BY SupplierID DESC`,
    fields: [field('SupplierName', 'Название поставщика', 'text', true), field('ContactPerson', 'Контактное лицо'),
      field('Phone', 'Телефон'), field('Email', 'Email', 'email'), field('Address', 'Адрес')]
  },
  cars: {
    title: 'Автомобили', table: 'dbo.Cars', idColumn: 'CarID', listPath: '/cars',
    columns: [{ key: 'id', label: 'ID' }, { key: 'car_name', label: 'Автомобиль' }, { key: 'year', label: 'Год' }, { key: 'vin', label: 'VIN' }, { key: 'color', label: 'Цвет' }, { key: 'sale_price', label: 'Цена продажи' }, { key: 'status', label: 'Статус' }, { key: 'supplier', label: 'Поставщик' }],
    listSql: `SELECT c.CarID AS id,CONCAT(b.BrandName,N' ',m.ModelName) AS car_name,c.ManufactureYear AS year,c.VIN AS vin,
      c.Color AS color,c.SalePrice AS sale_price,c.Status AS status,COALESCE(s.SupplierName,N'—') AS supplier
      FROM dbo.Cars c JOIN dbo.Models m ON m.ModelID=c.ModelID JOIN dbo.Brands b ON b.BrandID=m.BrandID
      LEFT JOIN dbo.Suppliers s ON s.SupplierID=c.SupplierID ORDER BY c.CarID DESC`,
    fields: [
      field('ModelID', 'Марка и модель', 'select', true, `SELECT m.ModelID AS OptionValue,CONCAT(b.BrandName,N' ',m.ModelName) AS OptionLabel
        FROM dbo.Models m JOIN dbo.Brands b ON b.BrandID=m.BrandID ORDER BY b.BrandName,m.ModelName`),
      field('SupplierID', 'Поставщик', 'select', false, 'SELECT SupplierID AS OptionValue,SupplierName AS OptionLabel FROM dbo.Suppliers ORDER BY SupplierName', true),
      field('VIN', 'VIN (17 символов)', 'text', true), field('ManufactureYear', 'Год выпуска', 'number', true),
      field('Color', 'Цвет', 'text', true), field('Mileage', 'Пробег, км', 'number', true),
      field('PurchasePrice', 'Закупочная цена, ₽', 'number', true), field('SalePrice', 'Цена продажи, ₽', 'number', true),
      field('Status', 'Статус', 'select', true, null, false, choices([['В наличии','В наличии'],['Продан','Продан'],['На обслуживании','На обслуживании']]))
    ]
  },
  sales: {
    title: 'Продажи', table: 'dbo.Sales', idColumn: 'SaleID', listPath: '/sales', editable: false, deletable: false,
    columns: [{ key: 'id', label: '№' }, { key: 'date', label: 'Дата' }, { key: 'car_name', label: 'Автомобиль' }, { key: 'customer', label: 'Клиент' }, { key: 'employee', label: 'Сотрудник' }, { key: 'amount', label: 'Стоимость' }, { key: 'payment', label: 'Оплата' }],
    listSql: `SELECT s.SaleID AS id,s.SaleDate AS date,CONCAT(b.BrandName,N' ',m.ModelName) AS car_name,
      CONCAT_WS(N' ',cu.LastName,cu.FirstName,cu.MiddleName) AS customer,CONCAT_WS(N' ',e.LastName,e.FirstName,e.MiddleName) AS employee,
      s.SaleAmount AS amount,s.PaymentMethod AS payment FROM dbo.Sales s JOIN dbo.Customers cu ON cu.CustomerID=s.CustomerID
      JOIN dbo.Employees e ON e.EmployeeID=s.EmployeeID JOIN dbo.Cars c ON c.CarID=s.CarID
      JOIN dbo.Models m ON m.ModelID=c.ModelID JOIN dbo.Brands b ON b.BrandID=m.BrandID ORDER BY s.SaleID DESC`,
    fields: [
      field('CarID', 'Автомобиль', 'select', true, `SELECT c.CarID AS OptionValue,CONCAT(b.BrandName,N' ',m.ModelName,N' (',c.ManufactureYear,N', ',c.VIN,N')') AS OptionLabel
        FROM dbo.Cars c JOIN dbo.Models m ON m.ModelID=c.ModelID JOIN dbo.Brands b ON b.BrandID=m.BrandID
        WHERE c.Status=N'В наличии' AND NOT EXISTS(SELECT 1 FROM dbo.Sales s WHERE s.CarID=c.CarID) ORDER BY b.BrandName,m.ModelName`),
      field('CustomerID', 'Клиент', 'select', true, 'SELECT CustomerID AS OptionValue,CONCAT_WS(N\' \',LastName,FirstName,MiddleName) AS OptionLabel FROM dbo.Customers ORDER BY LastName,FirstName'),
      field('EmployeeID', 'Ответственный сотрудник', 'select', true, 'SELECT EmployeeID AS OptionValue,CONCAT_WS(N\' \',LastName,FirstName,MiddleName) AS OptionLabel FROM dbo.Employees ORDER BY LastName,FirstName'),
      field('SaleDate', 'Дата продажи', 'date', true), field('SaleAmount', 'Цена продажи, ₽', 'number', true),
      field('PaymentMethod', 'Способ оплаты', 'select', true, null, false, choices([['Наличные','Наличные'],['Банковский перевод','Банковский перевод'],['Кредит','Кредит']]))
    ]
  },
  'service-records': {
    title: 'Сервисные записи', table: 'dbo.ServiceRecords', idColumn: 'ServiceRecordID', listPath: '/service-records',
    columns: [{ key: 'id', label: 'ID' }, { key: 'car_name', label: 'Автомобиль' }, { key: 'date', label: 'Дата' }, { key: 'description', label: 'Работы' }, { key: 'cost', label: 'Стоимость' }, { key: 'status', label: 'Статус' }, { key: 'employee', label: 'Сотрудник' }],
    listSql: `SELECT r.ServiceRecordID AS id,CONCAT(b.BrandName,N' ',m.ModelName) AS car_name,r.ServiceDate AS date,
      r.Description AS description,r.Cost AS cost,r.Status AS status,COALESCE(CONCAT_WS(N' ',e.LastName,e.FirstName,e.MiddleName),N'—') AS employee
      FROM dbo.ServiceRecords r JOIN dbo.Cars c ON c.CarID=r.CarID JOIN dbo.Models m ON m.ModelID=c.ModelID
      JOIN dbo.Brands b ON b.BrandID=m.BrandID LEFT JOIN dbo.Employees e ON e.EmployeeID=r.EmployeeID ORDER BY r.ServiceRecordID DESC`,
    fields: [
      field('CarID', 'Автомобиль', 'select', true, `SELECT c.CarID AS OptionValue,CONCAT(b.BrandName,N' ',m.ModelName,N' (',c.VIN,N')') AS OptionLabel
        FROM dbo.Cars c JOIN dbo.Models m ON m.ModelID=c.ModelID JOIN dbo.Brands b ON b.BrandID=m.BrandID ORDER BY b.BrandName,m.ModelName`),
      field('ServiceDate', 'Дата обслуживания', 'date', true), field('Description', 'Описание работ', 'textarea', true),
      field('Cost', 'Стоимость, ₽', 'number', true),
      field('Status', 'Статус', 'select', true, null, false, choices([['Запланировано','Запланировано'],['В работе','В работе'],['Завершено','Завершено']])),
      field('EmployeeID', 'Ответственный сотрудник', 'select', false, 'SELECT EmployeeID AS OptionValue,CONCAT_WS(N\' \',LastName,FirstName,MiddleName) AS OptionLabel FROM dbo.Employees ORDER BY LastName,FirstName', true)
    ]
  },
  'purchase-orders': {
    title: 'Заказы поставщикам', table: 'dbo.PurchaseOrders', idColumn: 'PurchaseOrderID', listPath: '/purchase-orders',
    columns: [{ key: 'id', label: '№' }, { key: 'supplier', label: 'Поставщик' }, { key: 'order_date', label: 'Дата заказа' }, { key: 'expected_date', label: 'Ожидаемая дата' }, { key: 'status', label: 'Статус' }],
    listSql: `SELECT po.PurchaseOrderID AS id,s.SupplierName AS supplier,po.OrderDate AS order_date,po.ExpectedDate AS expected_date,po.Status AS status
      FROM dbo.PurchaseOrders po JOIN dbo.Suppliers s ON s.SupplierID=po.SupplierID ORDER BY po.PurchaseOrderID DESC`,
    fields: [
      field('SupplierID', 'Поставщик', 'select', true, 'SELECT SupplierID AS OptionValue,SupplierName AS OptionLabel FROM dbo.Suppliers ORDER BY SupplierName'),
      field('OrderDate', 'Дата заказа', 'date', true), field('ExpectedDate', 'Ожидаемая дата', 'date', false, null, true),
      field('Status', 'Статус', 'select', true, null, false, choices([['Создан','Создан'],['Отправлен','Отправлен'],['Получен','Получен'],['Отменён','Отменён']]))
    ]
  },
  'purchase-order-items': {
    title: 'Позиции заказов', table: 'dbo.PurchaseOrderItems', idColumn: 'PurchaseOrderItemID', listPath: '/purchase-order-items',
    columns: [{ key: 'id', label: 'ID' }, { key: 'order_id', label: 'Заказ №' }, { key: 'model', label: 'Модель' }, { key: 'quantity', label: 'Количество' }, { key: 'unit_price', label: 'Цена за единицу' }],
    listSql: `SELECT i.PurchaseOrderItemID AS id,i.PurchaseOrderID AS order_id,CONCAT(b.BrandName,N' ',m.ModelName) AS model,
      i.Quantity AS quantity,i.UnitPrice AS unit_price FROM dbo.PurchaseOrderItems i JOIN dbo.Models m ON m.ModelID=i.ModelID
      JOIN dbo.Brands b ON b.BrandID=m.BrandID ORDER BY i.PurchaseOrderItemID DESC`,
    fields: [
      field('PurchaseOrderID', 'Заказ', 'select', true, 'SELECT PurchaseOrderID AS OptionValue,CONCAT(N\'Заказ №\',PurchaseOrderID,N\' — \',Status) AS OptionLabel FROM dbo.PurchaseOrders ORDER BY PurchaseOrderID DESC'),
      field('ModelID', 'Модель автомобиля', 'select', true, `SELECT m.ModelID AS OptionValue,CONCAT(b.BrandName,N' ',m.ModelName) AS OptionLabel
        FROM dbo.Models m JOIN dbo.Brands b ON b.BrandID=m.BrandID ORDER BY b.BrandName,m.ModelName`),
      field('Quantity', 'Количество', 'number', true), field('UnitPrice', 'Цена за единицу, ₽', 'number', true)
    ]
  }
};

module.exports = { entities };
