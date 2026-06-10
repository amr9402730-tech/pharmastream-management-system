let currentUser = null;
let cart = [];
let cartTotal = 0;
let allInvoicesCache = []; // كاش محلي للفواتير لفلترتها ديناميكياً بدون استعلامات معقدة
const API_BASE = 'https://pharmastream-management-system-production.up.railway.app/api';

// ==========================================
// 1. نظام تسجيل الدخول والتحقق
// ==========================================
async function handleLogin() {
    const user = document.getElementById('loginUser').value.trim();
    const pass = document.getElementById('loginPass').value.trim();
    const errorMsg = document.getElementById('loginError');

    if (!user || !pass) {
        errorMsg.textContent = "Please enter both username and password.";
        errorMsg.style.display = "block";
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, password: pass })
        });

        const data = await response.json();

        if (data.success) {
            currentUser = data.user;
            document.getElementById('loginOverlay').style.display = 'none';
            document.getElementById('mainHeader').style.display = 'flex';
            document.getElementById('app').style.display = 'block';
            
            const role = currentUser.role_name.toLowerCase();
            showModule(role);

            if (role === 'admin') {
                loadRolesDropdown();
                loadUsersTable();
                loadAdminReports();
            } else if (role === 'pharmacist') {
                loadInventoryTable();
                runStockReport();
            } else if (role === 'cashier') {
                cart = [];
                updateCartUI();
            }
        } else {
            errorMsg.textContent = data.message || "Invalid credentials.";
            errorMsg.style.display = "block";
        }
    } catch (error) {
        errorMsg.textContent = "Server Connection Error. Ensure Backend is running.";
        errorMsg.style.display = "block";
    }
}

function logout() {
    location.reload();
}

function showModule(moduleId) {
    document.querySelectorAll('.module').forEach(m => m.classList.remove('active'));
    document.querySelectorAll('nav button').forEach(b => b.style.display = 'none');
    
    const targetModule = document.getElementById(moduleId);
    const targetBtn = document.getElementById(`btn-${moduleId}`);
    
    if(targetModule) targetModule.classList.add('active');
    if(targetBtn) {
        targetBtn.style.display = 'inline-block';
        targetBtn.classList.add('active-nav');
    }
    document.querySelector('.logout-btn').style.display = 'inline-block';
}

// ==========================================
// 2. إدارة المستخدمين (Admin)
// ==========================================
async function loadRolesDropdown() {
    try {
        const response = await fetch(`${API_BASE}/roles`);
        const data = await response.json();
        if (data.success) {
            const select = document.getElementById('userRoleSelect');
            select.innerHTML = '<option value="" disabled selected>Select Role</option>';
            data.roles.forEach(role => {
                select.innerHTML += `<option value="${role.role_id}">${role.role_name} (${role.description})</option>`;
            });
        }
    } catch (err) { console.error("Error loading roles", err); }
}

async function loadUsersTable() {
    try {
        const response = await fetch(`${API_BASE}/users`);
        const data = await response.json();
        if (data.success) {
            const tbody = document.getElementById('userTableBody');
            tbody.innerHTML = '';
            document.getElementById('staffCount').innerText = data.users.length;
            
            data.users.forEach(user => {
                tbody.innerHTML += `
                    <tr>
                        <td>${user.user_id}</td>
                        <td><strong>${user.username}</strong></td>
                        <td>${user.full_name}</td>
                        <td><span class="status-pill status-Active">${user.role_name}</span></td>
                    </tr>`;
            });
        }
    } catch (err) { console.error("Error loading users", err); }
}

async function adminCreateUser() {
    const fullName = document.getElementById('userFullName').value.trim();
    const username = document.getElementById('userName').value.trim();
    const pass = document.getElementById('userPass').value.trim();
    const roleId = document.getElementById('userRoleSelect').value;

    if (!fullName || !username || !pass || !roleId) return alert("Please fill all fields");

    try {
        const response = await fetch(`${API_BASE}/users`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-user-role-id': currentUser.role_id 
            },
            body: JSON.stringify({ username: username, password: pass, full_name: fullName, role_id: parseInt(roleId) })
        });
        const data = await response.json();
        alert(data.message);
        
        if (data.success) {
            document.getElementById('userFullName').value = '';
            document.getElementById('userName').value = '';
            document.getElementById('userPass').value = '';
            document.getElementById('userRoleSelect').value = '';
            loadUsersTable();
        }
    } catch (err) { alert("Server connection error."); }
}

// ==========================================
// 3. تقارير المبيعات التفصيلية والذكية (Admin)
// ==========================================
async function loadAdminReports() {
    try {
        const response = await fetch(`${API_BASE}/reports`);
        const data = await response.json();
        if (data.success) {
            allInvoicesCache = data.invoices;
            renderAdminReports(allInvoicesCache);
        }
    } catch (err) { console.error("Error loading reports", err); }
}

function renderAdminReports(invoices) {
    const tbody = document.getElementById('invoicesBody');
    const tfoot = document.getElementById('invoicesFoot');
    if(!tbody || !tfoot) return;

    tbody.innerHTML = '';
    tfoot.innerHTML = '';

    let totalRev = 0;
    document.getElementById('invoiceCount').innerText = invoices.length;

    if (invoices.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No invoices found.</td></tr>';
        document.getElementById('totalSalesText').innerText = `0.00 EGP`;
        return;
    }

    invoices.forEach(inv => {
        const price = parseFloat(inv.total_price);
        totalRev += price;
        const d = new Date(inv.created_at);
        tbody.innerHTML += `
            <tr>
                <td><strong>${inv.invoice_number}</strong></td>
                <td>👤 ${inv.cashier_name}</td>
                <td>🕒 ${d.toLocaleDateString()} ${d.toLocaleTimeString()}</td>
                <td style="color: var(--success); font-weight: bold;">${price.toFixed(2)} EGP</td>
            </tr>
        `;
    });

    document.getElementById('totalSalesText').innerText = `${totalRev.toFixed(2)} EGP`;

    tfoot.innerHTML = `
        <tr style="background-color: #f8f9fa; font-weight: bold; border-top: 2px solid var(--primary);">
            <td colspan="3" style="text-align: right; padding: 12px;">Grand Total:</td>
            <td style="color: var(--danger); font-size: 1.1rem; padding: 12px;">${totalRev.toFixed(2)} EGP</td>
        </tr>
    `;
}

function filterAdminReportsByDate() {
    const selectedDate = document.getElementById('adminReportDate').value;
    if (!selectedDate) return alert("Please select a date first.");
    
    // فلترة الكاش المحلي ديناميكياً بالتاريخ المحدد لضمان السرعة والامتثال للقواعد
    const filtered = allInvoicesCache.filter(inv => {
        const invDate = new Date(inv.created_at).toISOString().split('T')[0];
        return invDate === selectedDate;
    });
    renderAdminReports(filtered);
}

// ==========================================
// 4. تكويد الأدوية وتعديلها (Admin)
// ==========================================
function toggleAdminMedForm() {
    const action = document.getElementById('adminMedAction').value;
    const searchGroup = document.getElementById('adminMedSearchGroup');
    const submitBtn = document.getElementById('adminMedSubmitBtn');
    const codeInput = document.getElementById('adminMedCode');

    if (action === 'edit') {
        searchGroup.style.display = 'block';
        submitBtn.innerText = 'Update Medicine (تعديل الدواء)';
        codeInput.disabled = true; // الباركود أساسي ولا يمكن تعديله لعدم تلف العلاقات
    } else {
        searchGroup.style.display = 'none';
        submitBtn.innerText = 'Save Medicine (حفظ الدواء الجديد)';
        codeInput.disabled = false;
        clearAdminMedForm();
    }
}

function clearAdminMedForm() {
    document.getElementById('adminSearchCode').value = '';
    document.getElementById('adminMedCode').value = '';
    document.getElementById('adminMedName').value = '';
    document.getElementById('adminMedPrice').value = '';
    document.getElementById('adminMedQty').value = '';
    document.getElementById('adminMedMinQty').value = '10';
    document.getElementById('adminMedExpiry').value = '';
}

async function adminSearchMedicineToEdit() {
    const code = document.getElementById('adminSearchCode').value.trim();
    if(!code) return alert("Please enter a barcode to fetch.");

    try {
        const response = await fetch(`${API_BASE}/medicines`);
        const data = await response.json();
        const list = data.success ? data.medicines : data;

        const med = list.find(m => m.code === code);
        if (med) {
            document.getElementById('adminMedCode').value = med.code;
            document.getElementById('adminMedName').value = med.name;
            document.getElementById('adminMedPrice').value = med.price;
            document.getElementById('adminMedQty').value = med.qty;
            document.getElementById('adminMedMinQty').value = med.min_qty || 10;
            if(med.expiry_date) {
                document.getElementById('adminMedExpiry').value = new Date(med.expiry_date).toISOString().split('T')[0];
            }
        } else {
            alert("Medicine not found in database.");
        }
    } catch (err) {
        alert("Error fetching medicine details.");
    }
}

async function adminSubmitMedicine() {
    const action = document.getElementById('adminMedAction').value;
    const code = document.getElementById('adminMedCode').value.trim();
    const name = document.getElementById('adminMedName').value.trim();
    const price = parseFloat(document.getElementById('adminMedPrice').value);
    const qty = parseInt(document.getElementById('adminMedQty').value);
    const minQty = parseInt(document.getElementById('adminMedMinQty').value) || 10;
    const expiry = document.getElementById('adminMedExpiry').value;

    if (!code || !name || isNaN(price) || isNaN(qty)) {
        return alert("Please fill all fields correctly.");
    }

    try {
        if (action === 'add') {
            const response = await fetch(`${API_BASE}/medicines`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-user-role-id': currentUser.role_id 
                },
                body: JSON.stringify({ code, name, price, qty, min_qty: minQty, expiry_date: expiry })
            });
            const data = await response.json();
            alert(data.message);
            if (data.success) clearAdminMedForm();
        } else {
            // تحديث كامل لبيانات الدواء (سعر، كمية، اسم، تاريخ صلاحية)
            const response = await fetch(`${API_BASE}/medicines`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-user-role-id': currentUser.role_id 
                },
                body: JSON.stringify({ 
                    code: code, 
                    name: name,
                    price: price,
                    new_qty: qty, 
                    min_qty: minQty,
                    expiry_date: expiry
                })
            });
            const data = await response.json();
            alert(data.message || "Medicine updated successfully!");
            if (data.success) clearAdminMedForm();
        }
    } catch (err) {
        alert("Error submitting medicine information.");
    }
}

// ==========================================
// 5. إدارة الصيدلي (Pharmacist Control)
// ==========================================
async function pharmacistAddMedicine() {
    const code = document.getElementById('medCode').value.trim();
    const name = document.getElementById('medName').value.trim();
    const price = document.getElementById('medPrice').value;
    const qty = document.getElementById('medQty').value;

    if (!code || !name || !price || !qty) return alert("Please fill all medicine fields.");

    try {
        const response = await fetch(`${API_BASE}/medicines`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-user-role-id': currentUser.role_id 
            },
            body: JSON.stringify({ code: code, name: name, price: parseFloat(price), qty: parseInt(qty) })
        });
        const data = await response.json();
        alert(data.message);
        
        if (data.success) {
            document.getElementById('medCode').value = '';
            document.getElementById('medName').value = '';
            document.getElementById('medPrice').value = '';
            document.getElementById('medQty').value = '';
            loadInventoryTable();
            runStockReport();
        }
    } catch (err) { alert("Server connection error."); }
}

async function loadInventoryTable() {
    try {
        const response = await fetch(`${API_BASE}/medicines`);
        const data = await response.json();
        
        const list = data.success ? data.medicines : data; 
        const tbody = document.getElementById('inventoryTableBody');
        tbody.innerHTML = '';
        
        if(list && list.length > 0) {
            list.forEach(med => {
                const stockStyle = med.qty <= med.min_qty ? 'color: var(--danger); font-weight: bold;' : 'color: var(--success);';
                tbody.innerHTML += `
                    <tr>
                        <td>${med.code}</td>
                        <td><strong>${med.name}</strong></td>
                        <td>${med.price} EGP</td>
                        <td style="${stockStyle}">${med.qty} Units</td>
                    </tr>`;
            });
        }
    } catch (err) { console.error("Error loading inventory", err); }
}

async function runStockReport() {
    try {
        const response = await fetch(`${API_BASE}/medicines`);
        const data = await response.json();
        const list = data.success ? data.medicines : data;
        
        const reportList = document.getElementById('expiryList');
        reportList.innerHTML = '';
        
        let alertsFound = false;

        list.forEach(med => {
            if(med.qty <= 0) {
                reportList.innerHTML += `<li class="alert-item"><span><strong>${med.name}</strong> (Code: ${med.code})</span><span style="color:var(--danger)">OUT OF STOCK</span></li>`;
                alertsFound = true;
            } else if (med.qty <= med.min_qty) {
                reportList.innerHTML += `<li class="alert-item alert-warning"><span><strong>${med.name}</strong> (Code: ${med.code})</span><span style="color:#d35400">LOW STOCK (${med.qty})</span></li>`;
                alertsFound = true;
            }
        });

        if(!alertsFound) {
            reportList.innerHTML = '<li style="color:var(--success); padding: 10px;">All stock levels are optimal.</li>';
        }
    } catch (err) { console.error("Error running report", err); }
}

// ==========================================
// 6. مبيعات الكاشير وسلة التسوق (Cashier POS)
// ==========================================
async function searchAndAddToCart() {
    const code = document.getElementById('searchMedCode').value.trim();
    if(!code) return alert("Please enter a barcode.");

    try {
        const response = await fetch(`${API_BASE}/medicines`);
        const medicines = await response.json();
        const list = medicines.success ? medicines.medicines : medicines;
        
        const med = list.find(m => m.code === code);
        
        if(med) {
            if(med.qty <= 0) return alert("Item is Out of Stock!");
            
            const existing = cart.find(item => item.code === med.code);
            if(existing) {
                if(existing.qty + 1 > med.qty) return alert("Not enough stock available.");
                existing.qty += 1;
            } else {
                cart.push({ code: med.code, name: med.name, price: med.price, qty: 1 });
            }
            
            updateCartUI();
            document.getElementById('searchMedCode').value = '';
            document.getElementById('searchMedCode').focus();
        } else {
            alert("Medicine not found!");
        }
    } catch (err) { alert("Error connecting to server."); }
}

function updateCartUI() {
    const tbody = document.getElementById('cartItemsBody');
    tbody.innerHTML = '';
    cartTotal = 0;

    cart.forEach((item, index) => {
        const lineTotal = item.price * item.qty;
        cartTotal += lineTotal;
        tbody.innerHTML += `
            <tr>
                <td><strong>${item.name}</strong><br><small>${item.code}</small></td>
                <td>
                    <button class="toggle-btn" style="padding: 2px 6px;" onclick="changeQty(${index}, -1)">-</button>
                    ${item.qty}
                    <button class="toggle-btn" style="padding: 2px 6px;" onclick="changeQty(${index}, 1)">+</button>
                </td>
                <td>${item.price} EGP</td>
                <td><strong>${lineTotal.toFixed(2)} EGP</strong></td>
                <td><button class="remove-btn" onclick="removeItem(${index})">X</button></td>
            </tr>
        `;
    });

    document.getElementById('cartTotalText').innerText = `${cartTotal.toFixed(2)} EGP`;
}

function changeQty(index, amount) {
    if(cart[index].qty + amount > 0) {
        cart[index].qty += amount;
        updateCartUI();
    }
}

function removeItem(index) {
    cart.splice(index, 1);
    updateCartUI();
}

async function processPayment() {
    if(cart.length === 0) return alert("Cart is empty.");
    
    alert(`Payment Successful!\nTotal Deducted: ${cartTotal.toFixed(2)} EGP\nPrinting Receipt...`);
    
    cart = [];
    updateCartUI();
}
