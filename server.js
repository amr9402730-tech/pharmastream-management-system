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

// 4. Server Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
