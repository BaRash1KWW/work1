/* AutoSalonDB: создание и заполнение базы Microsoft SQL Server.
   Откройте в SSMS и выполните F5. Повторный запуск пересоздаёт таблицы проекта. */
IF DB_ID(N'AutoSalonDB') IS NULL CREATE DATABASE AutoSalonDB;
GO
USE AutoSalonDB;
GO
DROP TABLE IF EXISTS dbo.ServiceRecords;
DROP TABLE IF EXISTS dbo.Sales;
DROP TABLE IF EXISTS dbo.PurchaseOrderItems;
DROP TABLE IF EXISTS dbo.PurchaseOrders;
DROP TABLE IF EXISTS dbo.Cars;
DROP TABLE IF EXISTS dbo.Customers;
DROP TABLE IF EXISTS dbo.Employees;
DROP TABLE IF EXISTS dbo.Suppliers;
DROP TABLE IF EXISTS dbo.Models;
DROP TABLE IF EXISTS dbo.Brands;
DROP TABLE IF EXISTS dbo.Positions;
GO
CREATE TABLE dbo.Brands(
 BrandID INT IDENTITY PRIMARY KEY, BrandName NVARCHAR(100) NOT NULL UNIQUE, Country NVARCHAR(100) NOT NULL);
CREATE TABLE dbo.Models(
 ModelID INT IDENTITY PRIMARY KEY, BrandID INT NOT NULL, ModelName NVARCHAR(100) NOT NULL, BodyType NVARCHAR(50) NOT NULL,
 CONSTRAINT FK_Models_Brands FOREIGN KEY(BrandID) REFERENCES dbo.Brands(BrandID), CONSTRAINT UQ_Model UNIQUE(BrandID,ModelName));
CREATE TABLE dbo.Positions(
 PositionID INT IDENTITY PRIMARY KEY, PositionName NVARCHAR(100) NOT NULL UNIQUE, Salary DECIMAL(12,2) NOT NULL CHECK(Salary>=0));
CREATE TABLE dbo.Employees(
 EmployeeID INT IDENTITY PRIMARY KEY, LastName NVARCHAR(100) NOT NULL, FirstName NVARCHAR(100) NOT NULL,
 MiddleName NVARCHAR(100), Phone NVARCHAR(30), Email NVARCHAR(255), PositionID INT NOT NULL, HireDate DATE NOT NULL,
 CONSTRAINT FK_Employees_Positions FOREIGN KEY(PositionID) REFERENCES dbo.Positions(PositionID));
CREATE TABLE dbo.Customers(
 CustomerID INT IDENTITY PRIMARY KEY, LastName NVARCHAR(100) NOT NULL, FirstName NVARCHAR(100) NOT NULL,
 MiddleName NVARCHAR(100), Phone NVARCHAR(30) NOT NULL, Email NVARCHAR(255), CreatedAt DATE NOT NULL DEFAULT(CONVERT(date,GETDATE())));
CREATE TABLE dbo.Suppliers(
 SupplierID INT IDENTITY PRIMARY KEY, SupplierName NVARCHAR(200) NOT NULL, ContactPerson NVARCHAR(200),
 Phone NVARCHAR(30), Email NVARCHAR(255), Address NVARCHAR(300));
CREATE TABLE dbo.Cars(
 CarID INT IDENTITY PRIMARY KEY, ModelID INT NOT NULL, VIN CHAR(17) NOT NULL UNIQUE,
 ManufactureYear SMALLINT NOT NULL CHECK(ManufactureYear BETWEEN 1980 AND 2035), Color NVARCHAR(50) NOT NULL,
 Mileage INT NOT NULL DEFAULT(0) CHECK(Mileage>=0), PurchasePrice DECIMAL(12,2) NOT NULL CHECK(PurchasePrice>=0),
 SalePrice DECIMAL(12,2) NOT NULL CHECK(SalePrice>=0),
 Status NVARCHAR(20) NOT NULL CHECK(Status IN(N'В наличии',N'Продан',N'На обслуживании')), SupplierID INT,
 CONSTRAINT FK_Cars_Models FOREIGN KEY(ModelID) REFERENCES dbo.Models(ModelID),
 CONSTRAINT FK_Cars_Suppliers FOREIGN KEY(SupplierID) REFERENCES dbo.Suppliers(SupplierID));
CREATE TABLE dbo.Sales(
 SaleID INT IDENTITY PRIMARY KEY, CarID INT NOT NULL UNIQUE, CustomerID INT NOT NULL, EmployeeID INT NOT NULL,
 SaleDate DATE NOT NULL, SaleAmount DECIMAL(12,2) NOT NULL CHECK(SaleAmount>=0), PaymentMethod NVARCHAR(50) NOT NULL,
 CONSTRAINT FK_Sales_Cars FOREIGN KEY(CarID) REFERENCES dbo.Cars(CarID),
 CONSTRAINT FK_Sales_Customers FOREIGN KEY(CustomerID) REFERENCES dbo.Customers(CustomerID),
 CONSTRAINT FK_Sales_Employees FOREIGN KEY(EmployeeID) REFERENCES dbo.Employees(EmployeeID));
CREATE TABLE dbo.ServiceRecords(
 ServiceRecordID INT IDENTITY PRIMARY KEY, CarID INT NOT NULL, ServiceDate DATE NOT NULL,
 Description NVARCHAR(500) NOT NULL, Cost DECIMAL(12,2) NOT NULL CHECK(Cost>=0),
 Status NVARCHAR(30) NOT NULL CHECK(Status IN(N'Запланировано',N'В работе',N'Завершено')), EmployeeID INT,
 CONSTRAINT FK_Service_Cars FOREIGN KEY(CarID) REFERENCES dbo.Cars(CarID),
 CONSTRAINT FK_Service_Employees FOREIGN KEY(EmployeeID) REFERENCES dbo.Employees(EmployeeID));
CREATE TABLE dbo.PurchaseOrders(
 PurchaseOrderID INT IDENTITY PRIMARY KEY, SupplierID INT NOT NULL, OrderDate DATE NOT NULL, ExpectedDate DATE,
 Status NVARCHAR(30) NOT NULL CHECK(Status IN(N'Создан',N'Отправлен',N'Получен',N'Отменён')),
 CONSTRAINT FK_Orders_Suppliers FOREIGN KEY(SupplierID) REFERENCES dbo.Suppliers(SupplierID));
CREATE TABLE dbo.PurchaseOrderItems(
 PurchaseOrderItemID INT IDENTITY PRIMARY KEY, PurchaseOrderID INT NOT NULL, ModelID INT NOT NULL,
 Quantity INT NOT NULL CHECK(Quantity>0), UnitPrice DECIMAL(12,2) NOT NULL CHECK(UnitPrice>=0),
 CONSTRAINT FK_Items_Orders FOREIGN KEY(PurchaseOrderID) REFERENCES dbo.PurchaseOrders(PurchaseOrderID),
 CONSTRAINT FK_Items_Models FOREIGN KEY(ModelID) REFERENCES dbo.Models(ModelID));
GO
INSERT dbo.Brands(BrandName,Country) VALUES
(N'Toyota',N'Япония'),(N'Kia',N'Южная Корея'),(N'Hyundai',N'Южная Корея'),
(N'BMW',N'Германия'),(N'Volkswagen',N'Германия'),(N'Lada',N'Россия');
INSERT dbo.Models(BrandID,ModelName,BodyType)
SELECT b.BrandID,v.ModelName,v.BodyType FROM (VALUES
(N'Toyota',N'Camry',N'Седан'),(N'Toyota',N'RAV4',N'Кроссовер'),(N'Kia',N'Rio',N'Седан'),
(N'Kia',N'Sportage',N'Кроссовер'),(N'Hyundai',N'Solaris',N'Седан'),(N'BMW',N'3 Series',N'Седан'),
(N'Volkswagen',N'Tiguan',N'Кроссовер'),(N'Lada',N'Vesta',N'Седан')) v(BrandName,ModelName,BodyType)
JOIN dbo.Brands b ON b.BrandName=v.BrandName;
INSERT dbo.Positions(PositionName,Salary) VALUES
(N'Менеджер по продажам',85000),(N'Механик',75000),(N'Администратор',70000),(N'Старший менеджер',100000);
INSERT dbo.Employees(LastName,FirstName,MiddleName,Phone,Email,PositionID,HireDate)
SELECT v.LastName,v.FirstName,v.MiddleName,v.Phone,v.Email,p.PositionID,v.HireDate FROM (VALUES
(N'Иванов',N'Алексей',N'Сергеевич',N'+7-900-100-10-01',N'alexey@example.com',N'Менеджер по продажам',CONVERT(date,'2023-03-15')),
(N'Петрова',N'Мария',N'Игоревна',N'+7-900-100-10-02',N'maria@example.com',N'Механик',CONVERT(date,'2022-08-01')),
(N'Сидоров',N'Дмитрий',N'Олегович',N'+7-900-100-10-03',N'dmitry@example.com',N'Администратор',CONVERT(date,'2024-01-10')),
(N'Кузнецова',N'Анна',N'Павловна',N'+7-900-100-10-04',N'anna@example.com',N'Старший менеджер',CONVERT(date,'2021-11-20'))
) v(LastName,FirstName,MiddleName,Phone,Email,PositionName,HireDate)
JOIN dbo.Positions p ON p.PositionName=v.PositionName;
INSERT dbo.Customers(LastName,FirstName,MiddleName,Phone,Email,CreatedAt) VALUES
(N'Смирнов',N'Илья',N'Андреевич',N'+7-911-200-20-01',N'ilya@example.com','2025-01-12'),
(N'Волкова',N'Екатерина',N'Дмитриевна',N'+7-911-200-20-02',N'ekaterina@example.com','2025-02-04'),
(N'Морозов',N'Павел',N'Иванович',N'+7-911-200-20-03',N'pavel@example.com','2025-02-18'),
(N'Фёдорова',N'Ольга',N'Романовна',N'+7-911-200-20-04',N'olga@example.com','2025-03-02'),
(N'Новиков',N'Максим',N'Евгеньевич',N'+7-911-200-20-05',N'maxim@example.com','2025-03-21');
INSERT dbo.Suppliers(SupplierName,ContactPerson,Phone,Email,Address) VALUES
(N'АвтоИмпорт',N'Сергей Павлов',N'+7-383-200-30-01',N'info@autoimport.example',N'Новосибирск, ул. Складская, 10'),
(N'СибирьАвто',N'Елена Орлова',N'+7-383-200-30-02',N'sales@sibauto.example',N'Новосибирск, ул. Станционная, 15'),
(N'Восток-Моторс',N'Игорь Беляев',N'+7-383-200-30-03',N'orders@vostok.example',N'Новосибирск, ул. Большевистская, 25');
INSERT dbo.Cars(ModelID,VIN,ManufactureYear,Color,Mileage,PurchasePrice,SalePrice,Status,SupplierID)
SELECT m.ModelID,v.VIN,v.Yr,v.Color,v.Mileage,v.BuyPrice,v.SellPrice,v.Status,s.SupplierID
FROM (VALUES
(N'Toyota',N'Camry','JTNB11HK0J3000001',2022,N'Белый',24000,2800000,3150000,N'Продан',N'АвтоИмпорт'),
(N'Toyota',N'RAV4','JTMBRREV0ND000002',2023,N'Серебристый',12000,3400000,3790000,N'В наличии',N'АвтоИмпорт'),
(N'Kia',N'Rio','Z94C241BBMR000003',2021,N'Синий',38000,1350000,1590000,N'Продан',N'СибирьАвто'),
(N'Kia',N'Sportage','XWEPC81AAM0000004',2024,N'Чёрный',5000,2900000,3290000,N'В наличии',N'СибирьАвто'),
(N'Hyundai',N'Solaris','Z94K241CBMR000005',2022,N'Красный',22000,1450000,1690000,N'На обслуживании',N'Восток-Моторс'),
(N'BMW',N'3 Series','WBA8E9G50GNU00006',2021,N'Серый',41000,3100000,3490000,N'В наличии',N'АвтоИмпорт'),
(N'Volkswagen',N'Tiguan','WVGZZZ5NZMW000007',2020,N'Зелёный',52000,2400000,2790000,N'Продан',N'Восток-Моторс'),
(N'Lada',N'Vesta','XTAGFL110MY000008',2023,N'Белый',9000,1150000,1320000,N'В наличии',N'СибирьАвто')
) v(BrandName,ModelName,VIN,Yr,Color,Mileage,BuyPrice,SellPrice,Status,SupplierName)
JOIN dbo.Brands b ON b.BrandName=v.BrandName
JOIN dbo.Models m ON m.BrandID=b.BrandID AND m.ModelName=v.ModelName
LEFT JOIN dbo.Suppliers s ON s.SupplierName=v.SupplierName;
INSERT dbo.Sales(CarID,CustomerID,EmployeeID,SaleDate,SaleAmount,PaymentMethod)
SELECT c.CarID,v.CustomerID,e.EmployeeID,v.SaleDate,v.Amount,v.Method FROM (VALUES
('JTNB11HK0J3000001',1,N'Иванов',CONVERT(date,'2025-02-10'),3150000,N'Банковский перевод'),
('Z94C241BBMR000003',2,N'Кузнецова',CONVERT(date,'2025-03-15'),1590000,N'Кредит'),
('WVGZZZ5NZMW000007',3,N'Иванов',CONVERT(date,'2025-04-08'),2790000,N'Наличные')
) v(VIN,CustomerID,LastName,SaleDate,Amount,Method)
JOIN dbo.Cars c ON c.VIN=v.VIN JOIN dbo.Employees e ON e.LastName=v.LastName;
INSERT dbo.ServiceRecords(CarID,ServiceDate,Description,Cost,Status,EmployeeID)
SELECT c.CarID,v.ServiceDate,v.Description,v.Cost,v.Status,e.EmployeeID FROM (VALUES
('Z94K241CBMR000005',CONVERT(date,'2025-05-10'),N'Диагностика двигателя',12500,N'В работе',2),
('JTMBRREV0ND000002',CONVERT(date,'2025-05-14'),N'Плановое техническое обслуживание',18000,N'Запланировано',2),
('JTNB11HK0J3000001',CONVERT(date,'2025-02-01'),N'Замена масла и фильтров',9500,N'Завершено',2)
) v(VIN,ServiceDate,Description,Cost,Status,EmployeeID) JOIN dbo.Cars c ON c.VIN=v.VIN
LEFT JOIN dbo.Employees e ON e.EmployeeID=v.EmployeeID;
INSERT dbo.PurchaseOrders(SupplierID,OrderDate,ExpectedDate,Status)
SELECT s.SupplierID,v.OrderDate,v.ExpectedDate,v.Status FROM (VALUES
(N'АвтоИмпорт',CONVERT(date,'2025-05-01'),CONVERT(date,'2025-06-01'),N'Отправлен'),
(N'СибирьАвто',CONVERT(date,'2025-05-05'),CONVERT(date,'2025-05-25'),N'Получен'),
(N'Восток-Моторс',CONVERT(date,'2025-05-12'),CONVERT(date,'2025-06-10'),N'Создан')
) v(SupplierName,OrderDate,ExpectedDate,Status) JOIN dbo.Suppliers s ON s.SupplierName=v.SupplierName;
INSERT dbo.PurchaseOrderItems(PurchaseOrderID,ModelID,Quantity,UnitPrice)
SELECT po.PurchaseOrderID,m.ModelID,v.Quantity,v.UnitPrice FROM (VALUES
(1,N'Toyota',N'RAV4',2,3400000),(1,N'BMW',N'3 Series',1,3100000),
(2,N'Kia',N'Sportage',3,2900000),(3,N'Volkswagen',N'Tiguan',2,2400000)
) v(OrderID,BrandName,ModelName,Quantity,UnitPrice)
JOIN dbo.PurchaseOrders po ON po.PurchaseOrderID=v.OrderID
JOIN dbo.Brands b ON b.BrandName=v.BrandName JOIN dbo.Models m ON m.BrandID=b.BrandID AND m.ModelName=v.ModelName;
GO
/* Контроль результата */
SELECT N'Brands' TableName,COUNT(*) RowsCount FROM dbo.Brands
UNION ALL SELECT N'Models',COUNT(*) FROM dbo.Models
UNION ALL SELECT N'Cars',COUNT(*) FROM dbo.Cars
UNION ALL SELECT N'Customers',COUNT(*) FROM dbo.Customers
UNION ALL SELECT N'Employees',COUNT(*) FROM dbo.Employees
UNION ALL SELECT N'Sales',COUNT(*) FROM dbo.Sales
UNION ALL SELECT N'ServiceRecords',COUNT(*) FROM dbo.ServiceRecords
UNION ALL SELECT N'Suppliers',COUNT(*) FROM dbo.Suppliers
UNION ALL SELECT N'PurchaseOrders',COUNT(*) FROM dbo.PurchaseOrders
UNION ALL SELECT N'PurchaseOrderItems',COUNT(*) FROM dbo.PurchaseOrderItems;
SELECT c.CarID,b.BrandName,m.ModelName,c.ManufactureYear,c.Color,c.Status,c.SalePrice
FROM dbo.Cars c JOIN dbo.Models m ON m.ModelID=c.ModelID JOIN dbo.Brands b ON b.BrandID=m.BrandID ORDER BY c.CarID;
GO
