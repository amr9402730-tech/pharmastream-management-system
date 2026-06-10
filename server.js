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

// 2. Database Initialization Function
async function initDB() {
  try {
    // Create roles table
    await db.query(`
      CREATE TABLE IF NOT EXISTS roles (
        role_id INT AUTO_INCREMENT PRIMARY KEY,
        role_name VARCHAR(50) UNIQUE NOT NULL,
        description TEXT
      )
    `);

    // Create users table
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        full_name VARCHAR(100),
        email VARCHAR(100),
        role_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (role_id) REFERENCES roles(role_id)
      )
    `);

    // Create medicines table
    await db.query(`
      CREATE TABLE IF NOT EXISTS medicines (
        medicine_id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        category VARCHAR(50),
        price DECIMAL(10,2),
        stock_quantity INT DEFAULT 0,
        expiry_date DATE,
        supplier VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create permissions table
    await db.query(`
      CREATE TABLE IF NOT EXISTS permissions (
        permission_id INT AUTO_INCREMENT PRIMARY KEY,
        permission_name VARCHAR(50) UNIQUE NOT NULL,
        description TEXT
      )
    `);

    // Create role_permissions table
    await db.query(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        role_id INT,
        permission_id INT,
        PRIMARY KEY (role_id, permission_id),
        FOREIGN KEY (role_id) REFERENCES roles(role_id),
        FOREIGN KEY (permission_id) REFERENCES permissions(permission_id)
      )
    `);

    // Insert default roles
    await db.query(`
      INSERT IGNORE INTO roles (role_name, description) VALUES
      ('Admin', 'Full system access'),
      ('Pharmacist', 'Manage medicines and prescriptions'),
      ('Cashier', 'Process sales and transactions')
    `);

    // Insert default permissions
    await db.query(`
      INSERT IGNORE INTO permissions (permission_name, description) VALUES
      ('manage_users', 'Create, edit, delete users'),
      ('manage_medicines', 'Add, edit, delete medicines'),
      ('view_medicines', 'View medicine inventory'),
      ('process_sales', 'Process sales transactions'),
      ('view_reports', 'View system reports')
    `);

    // Get role IDs
    const [roles] = await db.query('SELECT role_id, role_name FROM roles');
    const adminRoleId = roles.find(r => r.role_name === 'Admin')?.role_id;
    const pharmacistRoleId = roles.find(r => r.role_name === 'Pharmacist')?.role_id;
    const cashierRoleId = roles.find(r => r.role_name === 'Cashier')?.role_id;

    // Get permission IDs
    const [permissions] = await db.query('SELECT permission_id, permission_name FROM permissions');
    const permMap = {};
    permissions.forEach(p => permMap[p.permission_name] = p.permission_id);

    // Assign permissions to roles
    await db.query(`
      INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES
      (${adminRoleId}, ${permMap['manage_users']}),
      (${adminRoleId}, ${permMap['manage_medicines']}),
      (${adminRoleId}, ${permMap['view_medicines']}),
      (${adminRoleId}, ${permMap['process_sales']}),
      (${adminRoleId}, ${permMap['view_reports']}),
      (${pharmacistRoleId}, ${permMap['manage_medicines']}),
      (${pharmacistRoleId}, ${permMap['view_medicines']}),
      (${pharmacistRoleId}, ${permMap['view_reports']}),
      (${cashierRoleId}, ${permMap['view_medicines']}),
      (${cashierRoleId}, ${permMap['process_sales']})
    `);

    // Insert default users
    await db.query(`
      INSERT IGNORE INTO users (username, password, full_name, email, role_id) VALUES
      ('admin', '123456', 'System Administrator', 'admin@pharmastream.com', ${adminRoleId}),
      ('pharmacist', '123456', 'John Pharmacist', 'pharmacist@pharmastream.com', ${pharmacistRoleId}),
      ('cashier', '123456', 'Jane Cashier', 'cashier@pharmastream.com', ${cashierRoleId})
    `);

    // Insert default medicines
    await db.query(`
      INSERT IGNORE INTO medicines (name, category, price, stock_quantity, expiry_date, supplier) VALUES
      ('Paracetamol 500mg', 'Pain Relief', 5.00, 500, '2027-12-31', 'PharmaCorp'),
      ('Ibuprofen 400mg', 'Pain Relief', 8.50, 300, '2027-10-15', 'MediSupply'),
      ('Amoxicillin 250mg', 'Antibiotic', 15.00, 200, '2027-08-20', 'PharmaCorp'),
      ('Aspirin 100mg', 'Cardiovascular', 4.00, 400, '2028-01-10', 'HealthPlus'),
      ('Omeprazole 20mg', 'Gastrointestinal', 12.00, 150, '2027-11-30', 'MediSupply'),
      ('Metformin 500mg', 'Diabetes', 10.00, 250, '2027-09-25', 'PharmaCorp'),
      ('Cetirizine 10mg', 'Antihistamine', 6.50, 350, '2027-12-15', 'HealthPlus'),
      ('Cough Syrup', 'Respiratory', 9.00, 180, '2027-07-30', 'MediSupply'),
      ('Vitamin D3 1000IU', 'Supplement', 18.00, 220, '2028-03-20', 'HealthPlus'),
      ('Insulin Glargine', 'Diabetes', 85.00, 50, '2027-06-15', 'PharmaCorp')
    `);

    console.log('✅ Database initialized successfully with default data');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
  }
}

// Initialize database on startup
initDB();

// 3. Helper function for DB queries
const query = async (sql, params) => {
  return await db.query(sql, params);
};

// Middleware to check permissions
const checkPermission = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      const userId = req.body.user_id || req.query.user_id;
      if (!userId) return res.status(403).json({ error: 'User ID required' });

      const [results] = await query(`
        SELECT p.permission_name 
        FROM users u
        JOIN roles r ON u.role_id = r.role_id
        JOIN role_permissions rp ON r.role_id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.permission_id
        WHERE u.user_id = ?
      `, [userId]);

      const hasPermission = results.some(row => row.permission_name === requiredPermission);
      if (!hasPermission) {
        return res.status(403).json({ error: 'Permission denied' });
      }
      next();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };
};

// ========== API ENDPOINTS ==========

// Login endpoint
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const [users] = await query(
      'SELECT u.*, r.role_name FROM users u JOIN roles r ON u.role_id = r.role_id WHERE username = ? AND password = ?',
      [username, password]
    );

    if (users.length > 0) {
      const user = users[0];
      // Get user permissions
      const [permissions] = await query(`
        SELECT p.permission_name
        FROM role_permissions rp
        JOIN permissions p ON rp.permission_id = p.permission_id
        WHERE rp.role_id = ?
      `, [user.role_id]);

      res.json({
        success: true,
        user: {
          user_id: user.user_id,
          username: user.username,
          full_name: user.full_name,
          role: user.role_name,
          permissions: permissions.map(p => p.permission_name)
        }
      });
    } else {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all medicines
app.get('/api/medicines', async (req, res) => {
  try {
    const [medicines] = await query('SELECT * FROM medicines ORDER BY name');
    res.json(medicines);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get medicine by ID
app.get('/api/medicines/:id', async (req, res) => {
  try {
    const [medicines] = await query('SELECT * FROM medicines WHERE medicine_id = ?', [req.params.id]);
    if (medicines.length > 0) {
      res.json(medicines[0]);
    } else {
      res.status(404).json({ error: 'Medicine not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add new medicine
app.post('/api/medicines', async (req, res) => {
  try {
    const { name, category, price, stock_quantity, expiry_date, supplier } = req.body;
    const [result] = await query(
      'INSERT INTO medicines (name, category, price, stock_quantity, expiry_date, supplier) VALUES (?, ?, ?, ?, ?, ?)',
      [name, category, price, stock_quantity, expiry_date, supplier]
    );
    res.json({ success: true, medicine_id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update medicine
app.put('/api/medicines/:id', async (req, res) => {
  try {
    const { name, category, price, stock_quantity, expiry_date, supplier } = req.body;
    await query(
      'UPDATE medicines SET name=?, category=?, price=?, stock_quantity=?, expiry_date=?, supplier=? WHERE medicine_id=?',
      [name, category, price, stock_quantity, expiry_date, supplier, req.params.id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete medicine
app.delete('/api/medicines/:id', async (req, res) => {
  try {
    await query('DELETE FROM medicines WHERE medicine_id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all users
app.get('/api/users', async (req, res) => {
  try {
    const [users] = await query(
      'SELECT u.user_id, u.username, u.full_name, u.email, r.role_name FROM users u JOIN roles r ON u.role_id = r.role_id'
    );
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all roles
app.get('/api/roles', async (req, res) => {
  try {
    const [roles] = await query('SELECT * FROM roles');
    res.json(roles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user permissions
app.get('/api/users/:id/permissions', async (req, res) => {
  try {
    const [permissions] = await query(`
      SELECT p.permission_name, p.description
      FROM users u
      JOIN role_permissions rp ON u.role_id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.permission_id
      WHERE u.user_id = ?
    `, [req.params.id]);
    res.json(permissions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search medicines
app.get('/api/medicines/search/:query', async (req, res) => {
  try {
    const searchQuery = `%${req.params.query}%`;
    const [medicines] = await query(
      'SELECT * FROM medicines WHERE name LIKE ? OR category LIKE ? ORDER BY name',
      [searchQuery, searchQuery]
    );
    res.json(medicines);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'PharmaStream API is running' });
});

// Start server
const PORT = process.env.PORT || 3306;
app.listen(PORT, () => {
  console.log(`🚀 PharmaStream API Server running on port ${PORT}`);
});
