-- PharmaStream Database
-- MariaDB / MySQL
-- Database: pharmacydb

CREATE DATABASE IF NOT EXISTS pharmacydb;
USE pharmacydb;

-- Table: Customers
DROP TABLE IF EXISTS Customers;
CREATE TABLE Customers (
  customerid int(11) NOT NULL AUTO_INCREMENT,
  name varchar(100) DEFAULT NULL,
  contactnumber varchar(20) DEFAULT NULL,
  PRIMARY KEY (customerid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table: Roles
DROP TABLE IF EXISTS Roles;
CREATE TABLE Roles (
  roleid int(11) NOT NULL AUTO_INCREMENT,
  rolename varchar(50) NOT NULL,
  description varchar(255) DEFAULT NULL,
  PRIMARY KEY (roleid),
  UNIQUE KEY rolename (rolename)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO Roles VALUES
(1,'admin','System Administrator'),
(2,'cashier','Sales Cashier'),
(3,'pharmacist','Head Pharmacist');

-- Table: Users
DROP TABLE IF EXISTS Users;
CREATE TABLE Users (
  userid int(11) NOT NULL AUTO_INCREMENT,
  username varchar(50) NOT NULL,
  password varchar(255) NOT NULL,
  fullname varchar(100) NOT NULL,
  roleid int(11) NOT NULL,
  createdat timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (userid),
  UNIQUE KEY username (username),
  CONSTRAINT Users_ibfk_1 FOREIGN KEY (roleid) REFERENCES Roles (roleid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO Users VALUES
(1,'admin','123456','System Admin',1,'2026-05-29 16:15:21');

-- Table: Permissions
DROP TABLE IF EXISTS Permissions;
CREATE TABLE Permissions (
  id int(11) NOT NULL AUTO_INCREMENT,
  roleid int(11) NOT NULL,
  action varchar(100) NOT NULL,
  isallowed tinyint(1) DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY roleid (roleid, action),
  CONSTRAINT Permissions_ibfk_1 FOREIGN KEY (roleid) REFERENCES Roles (roleid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO Permissions VALUES
(1,1,'createuser',1),
(2,1,'viewusers',1),
(3,1,'updateuser',1),
(4,1,'deleteuser',1),
(5,1,'manageroles',1),
(6,1,'viewinventory',1),
(7,1,'addmedicine',1),
(8,1,'updatestock',1),
(9,1,'deletemedicine',1),
(10,1,'viewreports',1),
(11,1,'viewallinvoices',1),
(12,1,'refundinvoice',1),
(13,2,'issueinvoice',1),
(14,2,'viewowninvoices',1),
(15,2,'viewinventory',1),
(16,2,'viewpendingprescriptions',1),
(17,3,'createprescription',1),
(18,3,'cancelprescription',1),
(19,3,'viewownprescriptions',1),
(20,3,'viewinventory',1);

-- Table: Suppliers
DROP TABLE IF EXISTS Suppliers;
CREATE TABLE Suppliers (
  supplierid int(11) NOT NULL AUTO_INCREMENT,
  name varchar(100) NOT NULL,
  contactnumber varchar(20) DEFAULT NULL,
  PRIMARY KEY (supplierid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO Suppliers VALUES
(1,'PharmaCorp Egypt','01011122233'),
(2,'MediSupply Global','01122233344');

-- Table: Medicines
DROP TABLE IF EXISTS Medicines;
CREATE TABLE Medicines (
  medicineid int(11) NOT NULL AUTO_INCREMENT,
  code varchar(50) NOT NULL,
  name varchar(100) NOT NULL,
  description text DEFAULT NULL,
  category varchar(50) DEFAULT NULL,
  price decimal(10,2) NOT NULL,
  qty int(11) DEFAULT 0,
  minqty int(11) DEFAULT 10,
  expirydate date NOT NULL,
  supplierid int(11) DEFAULT NULL,
  PRIMARY KEY (medicineid),
  UNIQUE KEY code (code),
  CONSTRAINT Medicines_ibfk_1 FOREIGN KEY (supplierid) REFERENCES Suppliers (supplierid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO Medicines VALUES
(1,'MED-1001','Panadol Extra','Paracetamol 500mg + Caffeine 65mg','Pain Relief',35.00,114,30,'2026-10-15',1),
(2,'MED-1002','Augmentin 1g','Amoxicillin and Clavulanate Potassium','Antibiotics',98.50,45,15,'2025-08-20',2),
(3,'MED-1003','Vitamin C 1000mg','Effervescent tablets for immunity','Vitamins',45.00,198,50,'2027-01-10',1),
(4,'MED-1004','Zyrtec 10mg','Cetirizine antihistamine','Allergy',55.00,80,20,'2026-05-01',2),
(5,'MED-1005','Brufen 400mg','Ibuprofen anti-inflammatory','Pain Relief',40.00,150,40,'2026-12-01',1),
(6,'MED-1006','Concor 5mg','Bisoprolol for heart and blood pressure','Cardiovascular',65.00,60,20,'2025-11-15',2),
(7,'MED-1007','Omega 3 Fish Oil','1000mg EPA+DHA dietary supplement','Vitamins',120.00,90,25,'2026-09-30',1),
(8,'MED-1008','Gaviscon Advance','Antacid liquid for heartburn relief','Digestive',85.00,39,10,'2025-06-25',2),
(9,'MED-1009','Cataflam 50mg','Diclofenac potassium for severe pain','Pain Relief',42.00,110,30,'2026-03-10',1),
(10,'MED-1010','Amaryl 2mg','Glimepiride for type 2 diabetes','Diabetes',50.00,75,20,'2027-02-28',2),
(16,'102','pandol',NULL,'General',125.00,6,10,'2027-01-01',NULL),
(17,'110','vigra',NULL,'General',114.00,1000,10,'2027-01-01',NULL),
(18,'6221060461623','Panadol Extra 500mg',NULL,'Pain Relief',35.00,100,20,'2026-10-15',NULL),
(19,'6221060461616','Panadol Advance 500mg',NULL,'Pain Relief',25.00,150,30,'2027-01-10',NULL),
(20,'6221102140024','Congestal Tablets',NULL,'Cold & Flu',40.00,80,15,'2026-05-20',NULL),
(39,'6221011240115','Osteocare Tablets',NULL,'Vitamins',55.00,43,10,'2027-08-20',NULL),
(40,'6221013100340','Neuroton Ampoules',NULL,'Vitamins',32.00,89,15,'2025-09-30',NULL),
(41,'6221081016253','Depovit B12 Ampoules',NULL,'Vitamins',25.00,79,10,'2026-03-25',NULL),
(45,'6221016140022','Colona Tablets',NULL,'Digestive',35.00,84,20,'2027-07-10',NULL),
(48,'112','pandol extra',NULL,'General',120.00,10500,10,'2027-01-01',NULL),
(49,'120','pandol',NULL,'General',120.00,50,10,'2027-01-01',NULL),
(50,'554','osama',NULL,'General',200.00,100,10,'2027-01-01',NULL),
(51,'114','test',NULL,'General',125.00,12,10,'2027-01-01',NULL);

-- Table: Invoices
DROP TABLE IF EXISTS Invoices;
CREATE TABLE Invoices (
  invoiceid int(11) NOT NULL AUTO_INCREMENT,
  invoicenumber varchar(50) NOT NULL,
  createdat timestamp NULL DEFAULT current_timestamp(),
  totalprice decimal(10,2) NOT NULL,
  cashierid int(11) DEFAULT NULL,
  customerid int(11) DEFAULT NULL,
  PRIMARY KEY (invoiceid),
  UNIQUE KEY invoicenumber (invoicenumber),
  CONSTRAINT Invoices_ibfk_1 FOREIGN KEY (cashierid) REFERENCES Users (userid),
  CONSTRAINT Invoices_ibfk_2 FOREIGN KEY (customerid) REFERENCES Customers (customerid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table: InvoiceItems
DROP TABLE IF EXISTS InvoiceItems;
CREATE TABLE InvoiceItems (
  itemid int(11) NOT NULL AUTO_INCREMENT,
  invoiceid int(11) DEFAULT NULL,
  medicineid int(11) DEFAULT NULL,
  quantity int(11) NOT NULL,
  unitprice decimal(10,2) NOT NULL,
  PRIMARY KEY (itemid),
  CONSTRAINT InvoiceItems_ibfk_1 FOREIGN KEY (invoiceid) REFERENCES Invoices (invoiceid) ON DELETE CASCADE,
  CONSTRAINT InvoiceItems_ibfk_2 FOREIGN KEY (medicineid) REFERENCES Medicines (medicineid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table: Payments
DROP TABLE IF EXISTS Payments;
CREATE TABLE Payments (
  transactionid int(11) NOT NULL AUTO_INCREMENT,
  invoiceid int(11) DEFAULT NULL,
  amount decimal(10,2) NOT NULL,
  method varchar(20) DEFAULT NULL CHECK (method in ('cash','creditcard','debitcard')),
  status varchar(20) DEFAULT 'Completed',
  PRIMARY KEY (transactionid),
  CONSTRAINT Payments_ibfk_1 FOREIGN KEY (invoiceid) REFERENCES Invoices (invoiceid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table: Prescriptions
DROP TABLE IF EXISTS Prescriptions;
CREATE TABLE Prescriptions (
  prescriptionid int(11) NOT NULL AUTO_INCREMENT,
  pharmacistid int(11) DEFAULT NULL,
  createdat timestamp NULL DEFAULT current_timestamp(),
  status varchar(20) DEFAULT 'Pending',
  PRIMARY KEY (prescriptionid),
  CONSTRAINT Prescriptions_ibfk_1 FOREIGN KEY (pharmacistid) REFERENCES Users (userid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table: PrescriptionItems
DROP TABLE IF EXISTS PrescriptionItems;
CREATE TABLE PrescriptionItems (
  itemid int(11) NOT NULL AUTO_INCREMENT,
  prescriptionid int(11) DEFAULT NULL,
  medicineid int(11) DEFAULT NULL,
  quantity int(11) NOT NULL,
  PRIMARY KEY (itemid),
  CONSTRAINT PrescriptionItems_ibfk_1 FOREIGN KEY (prescriptionid) REFERENCES Prescriptions (prescriptionid) ON DELETE CASCADE,
  CONSTRAINT PrescriptionItems_ibfk_2 FOREIGN KEY (medicineid) REFERENCES Medicines (medicineid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
