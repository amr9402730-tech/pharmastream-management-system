const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
app.use(cors());
app.use(express.json());

// 1. Database Connection
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'pharmacydb',
  port: process.env.DB_PORT || 3306
};

const db = mysql.createPool(dbConfig);
console.log('Connected to Pharmacy Database - MySQL Pool created');

// 2. RBAC Middleware
const checkPermission = (requestedAction) => {
  return async (req, res, next) => {
    const roleId = req.headers['x-user-role-id'];
    if (!roleId) return res.status(401).json({ success: false, message: 'Unauthorized: Missing Role ID' });
    try {
      const [rows] = await db.query(
        'SELECT isallowed FROM Permissions WHERE roleid = ? AND action = ?',
        [roleId, requestedAction]
      );
      if (rows.length > 0 && rows[0].isallowed === 1) {
        next();
      } else {
        res.status(403).json({ success: false, message: 'Access Denied!' });
      }
    } catch (error) {
      console.error('DB Permission Error:', error);
      res.status(500).json({ success: false, message: 'System Error' });
    }
  };
};

// 3. API Routes

// Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const query = `SELECT u.userid, u.username, u.fullname, u.roleid, r.rolename
                   FROM Users u
                   JOIN Roles r ON u.roleid = r.roleid
                   WHERE u.username = ? AND u.password = ?`;
    const [users] = await db.query(query, [username, password]);
    if (users.length > 0) {
      res.json({ success: true, user: users[0] });
    } else {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get Roles
app.get('/api/roles', async (req, res) => {
  try {
    const [roles] = await db.query('SELECT roleid, rolename, description FROM Roles');
    res.json({ success: true, roles });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create User
app.post('/api/users', checkPermission('createuser'), async (req, res) => {
  const { username, password, fullname, roleid } = req.body;
  try {
    await db.query(
      'INSERT INTO Users (username, password, fullname, roleid) VALUES (?, ?, ?, ?)',
      [username, password, fullname, roleid]
    );
    res.json({ success: true, message: 'User created successfully!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error creating user' });
  }
});

// Get Users
app.get('/api/users', async (req, res) => {
  try {
    const [users] = await db.query(
      'SELECT u.userid, u.username, u.fullname, r.rolename FROM Users u JOIN Roles r ON u.roleid = r.roleid'
    );
    res.json({ success: true, users });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get Medicines
app.get('/api/medicines', async (req, res) => {
  try {
    const [medicines] = await db.query('SELECT * FROM Medicines');
    res.json({ success: true, medicines });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Add/Update Medicine
app.post('/api/medicines', checkPermission('addmedicine'), async (req, res) => {
  const { code, name, price, qty } = req.body;
  try {
    const [existing] = await db.query('SELECT medicineid FROM Medicines WHERE code = ?', [code]);
    if (existing.length > 0) {
      await db.query('UPDATE Medicines SET name = ?, price = ?, qty = ? WHERE code = ?', [name, price, qty, code]);
      res.json({ success: true, message: 'Medicine updated successfully!' });
    } else {
      await db.query(
        'INSERT INTO Medicines (code, name, price, qty, expirydate) VALUES (?, ?, ?, ?, ?)',
        [code, name, price, qty, '2027-01-01']
      );
      res.json({ success: true, message: 'Medicine added successfully!' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error saving medicine' });
  }
});

// Get Reports
app.get('/api/reports', async (req, res) => {
  try {
    const [invoices] = await db.query('SELECT * FROM Invoices ORDER BY createdat DESC');
    res.json({ success: true, invoices });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Process Invoice
app.post('/api/invoices', async (req, res) => {
  const { items, total, cashierid } = req.body;
  const invoiceNumber = 'INV-' + Date.now();
  try {
    const [result] = await db.query(
      'INSERT INTO Invoices (invoicenumber, totalprice, cashierid) VALUES (?, ?, ?)',
      [invoiceNumber, total, cashierid]
    );
    const invoiceId = result.insertId;
    for (const item of items) {
      const [med] = await db.query('SELECT medicineid FROM Medicines WHERE code = ?', [item.code]);
      if (med.length > 0) {
        await db.query(
          'INSERT INTO InvoiceItems (invoiceid, medicineid, quantity, unitprice) VALUES (?, ?, ?, ?)',
          [invoiceId, med[0].medicineid, item.qty, item.price]
        );
        await db.query('UPDATE Medicines SET qty = qty - ? WHERE code = ?', [item.qty, item.code]);
      }
    }
    await db.query(
      'INSERT INTO Payments (invoiceid, amount, method, status) VALUES (?, ?, ?, ?)',
      [invoiceId, total, 'cash', 'Completed']
    );
    res.json({ success: true, message: 'Invoice created: ' + invoiceNumber });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error processing payment' });
  }
});

// 4. Initialize Database & Create Default Users
async function initDB() {
  try {
    // Create tables if not exist
    await db.query(`CREATE TABLE IF NOT EXISTS Roles (
      roleid INT AUTO_INCREMENT PRIMARY KEY,
      rolename VARCHAR(50) NOT NULL UNIQUE,
      description VARCHAR(255)
    )`);

    await db.query(`CREATE TABLE IF NOT EXISTS Users (
      userid INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      fullname VARCHAR(100) NOT NULL,
      roleid INT NOT NULL,
      createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (roleid) REFERENCES Roles(roleid)
    )`);

    await db.query(`CREATE TABLE IF NOT EXISTS Permissions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      roleid INT NOT NULL,
      action VARCHAR(100) NOT NULL,
      isallowed TINYINT(1) DEFAULT 1,
      UNIQUE KEY roleid_action (roleid, action),
      FOREIGN KEY (roleid) REFERENCES Roles(roleid) ON DELETE CASCADE
    )`);

    await db.query(`CREATE TABLE IF NOT EXISTS Customers (
      customerid INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100),
      contactnumber VARCHAR(20)
    )`);

    await db.query(`CREATE TABLE IF NOT EXISTS Suppliers (
      supplierid INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      contactnumber VARCHAR(20)
    )`);

    await db.query(`CREATE TABLE IF NOT EXISTS Medicines (
      medicineid INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(50) NOT NULL UNIQUE,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      category VARCHAR(50),
      price DECIMAL(10,2) NOT NULL,
      qty INT DEFAULT 0,
      minqty INT DEFAULT 10,
      expirydate DATE NOT NULL,
      supplierid INT,
      FOREIGN KEY (supplierid) REFERENCES Suppliers(supplierid)
    )`);

    await db.query(`CREATE TABLE IF NOT EXISTS Invoices (
      invoiceid INT AUTO_INCREMENT PRIMARY KEY,
      invoicenumber VARCHAR(50) NOT NULL UNIQUE,
      createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      totalprice DECIMAL(10,2) NOT NULL,
      cashierid INT,
      customerid INT,
      FOREIGN KEY (cashierid) REFERENCES Users(userid),
      FOREIGN KEY (customerid) REFERENCES Customers(customerid)
    )`);

    await db.query(`CREATE TABLE IF NOT EXISTS InvoiceItems (
      itemid INT AUTO_INCREMENT PRIMARY KEY,
      invoiceid INT,
      medicineid INT,
      quantity INT NOT NULL,
      unitprice DECIMAL(10,2) NOT NULL,
      FOREIGN KEY (invoiceid) REFERENCES Invoices(invoiceid) ON DELETE CASCADE,
      FOREIGN KEY (medicineid) REFERENCES Medicines(medicineid)
    )`);

    await db.query(`CREATE TABLE IF NOT EXISTS Payments (
      transactionid INT AUTO_INCREMENT PRIMARY KEY,
      invoiceid INT,
      amount DECIMAL(10,2) NOT NULL,
      method VARCHAR(20),
      status VARCHAR(20) DEFAULT 'Completed',
      FOREIGN KEY (invoiceid) REFERENCES Invoices(invoiceid)
    )`);

    // Insert default roles
    await db.query(`INSERT IGNORE INTO Roles (roleid, rolename, description) VALUES
      (1, 'admin', 'System Administrator'),
      (2, 'cashier', 'Sales Cashier'),
      (3, 'pharmacist', 'Head Pharmacist')`);

    // Insert default permissions
    await db.query(`INSERT IGNORE INTO Permissions (roleid, action) VALUES
      (1,'createuser'),(1,'viewusers'),(1,'updateuser'),(1,'deleteuser'),
      (1,'manageroles'),(1,'viewinventory'),(1,'addmedicine'),(1,'updatestock'),
      (1,'deletemedicine'),(1,'viewreports'),(1,'viewallinvoices'),(1,'refundinvoice'),
      (2,'issueinvoice'),(2,'viewowninvoices'),(2,'viewinventory'),(2,'viewpendingprescriptions'),
      (3,'createprescription'),(3,'cancelprescription'),(3,'viewownprescriptions'),(3,'viewinventory')`);

    // Insert default admin user
    await db.query(`INSERT IGNORE INTO Users (userid, username, password, fullname, roleid) VALUES
      (1, 'admin', '123456', 'System Admin', 1)`);

    console.log('Database initialized with default data!');
  } catch (err) {
    console.error('DB Init Error:', err);
  }
}


// 4. Server Start


// 5. Start Server & Init DB
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  await initDB();
});
