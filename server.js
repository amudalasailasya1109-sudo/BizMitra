// ============================================================
//  BizMitra Backend — server.js
//  Run with:  node server.js
//  Opens at:  http://localhost:3000
// ============================================================

const express = require('express');
const cors    = require('cors');
const fs      = require('fs');
const path    = require('path');

const app  = express();
const PORT = 3000;

// ── MIDDLEWARE ──────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});
// ── HELPER: Read & Write JSON files ─────────────────────────
function readJSON(filename) {
  const filepath = path.join(__dirname, 'data', filename);
  if (!fs.existsSync(filepath)) return [];
  const raw = fs.readFileSync(filepath, 'utf8');
  return JSON.parse(raw);
}

function writeJSON(filename, data) {
  const filepath = path.join(__dirname, 'data', filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
}

// ── GENERATE UNIQUE ID ───────────────────────────────────────
function generateId() {
  return Date.now().toString();
}


// ============================================================
//  AUTH ROUTES
// ============================================================

// POST /api/login — Login user
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const users = readJSON('users.json');
  const user  = users.find(u => u.username === username && u.password === password);

  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid username or password' });
  }

  res.json({
    success:    true,
    firstLogin: user.firstLogin,
    shopName:   user.shopName,
    username:   user.username
  });
});

// POST /api/register — Register shop (first time only)
app.post('/api/register', (req, res) => {
  const { shopName, username, password } = req.body;
  const users = readJSON('users.json');

  if (users.length > 0) {
    return res.status(400).json({ success: false, message: 'Shop already registered' });
  }

  const newUser = {
    id:         generateId(),
    shopName:   shopName,
    username:   username,
    password:   password,
    firstLogin: false
  };

  users.push(newUser);
  writeJSON('users.json', users);

  res.json({ success: true, message: 'Registered successfully' });
});


// ============================================================
//  PRODUCTS / INVENTORY ROUTES
// ============================================================

// GET /api/products — Get all products
app.get('/api/products', (req, res) => {
  const products = readJSON('products.json');
  res.json(products);
});

// POST /api/products — Add new product
app.post('/api/products', (req, res) => {
  const { name, category, quantity, unit, expiryDate, buyPrice, sellPrice, supplierName } = req.body;
  const products = readJSON('products.json');

  const newProduct = {
    id:           generateId(),
    name:         name,
    category:     category     || 'General',
    quantity:     Number(quantity),
    unit:         unit         || 'pcs',
    expiryDate:   expiryDate   || null,
    buyPrice:     Number(buyPrice)  || 0,
    sellPrice:    Number(sellPrice) || 0,
    supplierName: supplierName || '',
    addedOn:      new Date().toISOString()
  };

  products.push(newProduct);
  writeJSON('products.json', products);
  res.json({ success: true, product: newProduct });
});

// PUT /api/products/:id — Update product
app.put('/api/products/:id', (req, res) => {
  const products = readJSON('products.json');
  const index    = products.findIndex(p => p.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  products[index] = { ...products[index], ...req.body };
  writeJSON('products.json', products);
  res.json({ success: true, product: products[index] });
});

// DELETE /api/products/:id — Delete product
app.delete('/api/products/:id', (req, res) => {
  let products = readJSON('products.json');
  const before = products.length;
  products     = products.filter(p => p.id !== req.params.id);

  if (products.length === before) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  writeJSON('products.json', products);
  res.json({ success: true, message: 'Product deleted' });
});


// ============================================================
//  NOTIFICATIONS / ALERTS
// ============================================================

// GET /api/notifications — Get expiry & low stock alerts
app.get('/api/notifications', (req, res) => {
  const products      = readJSON('products.json');
  const today         = new Date();
  const notifications = [];

  products.forEach(product => {
    // Expiry alerts — within 7 days
    if (product.expiryDate) {
      const expiry   = new Date(product.expiryDate);
      const diffTime = expiry - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 7 && diffDays >= 0) {
        notifications.push({
          type:      'expiry',
          productId: product.id,
          name:      product.name,
          message:   `${product.name} expires in ${diffDays} day(s)`,
          daysLeft:  diffDays,
          urgent:    diffDays <= 3
        });
      }

      if (diffDays < 0) {
        notifications.push({
          type:      'expired',
          productId: product.id,
          name:      product.name,
          message:   `${product.name} has EXPIRED`,
          daysLeft:  diffDays,
          urgent:    true
        });
      }
    }

    // Low stock alerts — below 5 units
    if (product.quantity <= 5) {
      notifications.push({
        type:      'lowstock',
        productId: product.id,
        name:      product.name,
        message:   `${product.name} is low on stock (${product.quantity} left)`,
        quantity:  product.quantity,
        urgent:    product.quantity <= 2
      });
    }
  });

  res.json(notifications);
});


// ============================================================
//  SALES ROUTES
// ============================================================

// GET /api/sales — Get all sales
app.get('/api/sales', (req, res) => {
  const sales = readJSON('sales.json');
  res.json(sales);
});

// GET /api/sales/daily — Today's sales summary
app.get('/api/sales/daily', (req, res) => {
  const sales    = readJSON('sales.json');
  const todayStr = new Date().toISOString().split('T')[0];

  const todaySales = sales.filter(s => s.date.startsWith(todayStr));
  const total      = todaySales.reduce((sum, s) => sum + s.totalAmount, 0);
  const count      = todaySales.length;

  res.json({ date: todayStr, totalAmount: total, billCount: count, sales: todaySales });
});

// GET /api/sales/monthly — This month's sales summary
app.get('/api/sales/monthly', (req, res) => {
  const sales       = readJSON('sales.json');
  const now         = new Date();
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const monthSales = sales.filter(s => s.date.startsWith(monthPrefix));
  const total      = monthSales.reduce((sum, s) => sum + s.totalAmount, 0);
  const count      = monthSales.length;

  res.json({ month: monthPrefix, totalAmount: total, billCount: count, sales: monthSales });
});

// POST /api/sales — Create a new sale (billing)
app.post('/api/sales', (req, res) => {
  const { customerName, items, paymentMode, kathaId } = req.body;
  // items = [{ productId, name, quantity, sellPrice }]

  const sales    = readJSON('sales.json');
  const products = readJSON('products.json');

  let totalAmount = 0;
  const saleItems = [];

  for (const item of items) {
    const productIndex = products.findIndex(p => p.id === item.productId);

    if (productIndex === -1) {
      return res.status(404).json({ success: false, message: `Product ${item.name} not found` });
    }

    if (products[productIndex].quantity < item.quantity) {
      return res.status(400).json({
        success: false,
        message: `Not enough stock for ${item.name}. Available: ${products[productIndex].quantity}`
      });
    }

    // Deduct stock
    products[productIndex].quantity -= item.quantity;

    const lineTotal = item.quantity * item.sellPrice;
    totalAmount    += lineTotal;

    saleItems.push({
      productId:  item.productId,
      name:       item.name,
      quantity:   item.quantity,
      sellPrice:  item.sellPrice,
      lineTotal:  lineTotal
    });
  }

  const newSale = {
    id:           generateId(),
    customerName: customerName || 'Walk-in Customer',
    items:        saleItems,
    totalAmount:  totalAmount,
    paymentMode:  paymentMode  || 'cash',
    kathaId:      kathaId      || null,
    date:         new Date().toISOString()
  };

  // Save updated stock
  writeJSON('products.json', products);

  // Save sale record
  sales.push(newSale);
  writeJSON('sales.json', sales);

  res.json({ success: true, sale: newSale });
});


// ============================================================
//  SUPPLIERS ROUTES
// ============================================================

// GET /api/suppliers — Get all suppliers
app.get('/api/suppliers', (req, res) => {
  const suppliers = readJSON('suppliers.json');
  res.json(suppliers);
});

// POST /api/suppliers — Add new supplier
app.post('/api/suppliers', (req, res) => {
  const { name, contactPerson, phone, address, productsSupplied } = req.body;
  const suppliers = readJSON('suppliers.json');

  const newSupplier = {
    id:               generateId(),
    name:             name,
    contactPerson:    contactPerson    || '',
    phone:            phone            || '',
    address:          address          || '',
    productsSupplied: productsSupplied || '',
    addedOn:          new Date().toISOString()
  };

  suppliers.push(newSupplier);
  writeJSON('suppliers.json', suppliers);
  res.json({ success: true, supplier: newSupplier });
});

// PUT /api/suppliers/:id — Update supplier
app.put('/api/suppliers/:id', (req, res) => {
  const suppliers = readJSON('suppliers.json');
  const index     = suppliers.findIndex(s => s.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Supplier not found' });
  }

  suppliers[index] = { ...suppliers[index], ...req.body };
  writeJSON('suppliers.json', suppliers);
  res.json({ success: true, supplier: suppliers[index] });
});

// DELETE /api/suppliers/:id — Delete supplier
app.delete('/api/suppliers/:id', (req, res) => {
  let suppliers = readJSON('suppliers.json');
  suppliers     = suppliers.filter(s => s.id !== req.params.id);
  writeJSON('suppliers.json', suppliers);
  res.json({ success: true, message: 'Supplier deleted' });
});


// ============================================================
//  KATHA BOOK ROUTES (Customer Credit Book)
// ============================================================

// GET /api/katha — Get all katha entries
app.get('/api/katha', (req, res) => {
  const katha = readJSON('katha.json');
  res.json(katha);
});

// POST /api/katha — Add new customer to katha
app.post('/api/katha', (req, res) => {
  const { customerName, phone, address } = req.body;
  const katha = readJSON('katha.json');

  const newCustomer = {
    id:           generateId(),
    customerName: customerName,
    phone:        phone   || '',
    address:      address || '',
    totalDue:     0,
    transactions: [],
    addedOn:      new Date().toISOString()
  };

  katha.push(newCustomer);
  writeJSON('katha.json', katha);
  res.json({ success: true, customer: newCustomer });
});

// POST /api/katha/:id/transaction — Add credit or payment
app.post('/api/katha/:id/transaction', (req, res) => {
  const { type, amount, note } = req.body;
  // type = "credit" (customer owes) or "payment" (customer paid)

  const katha = readJSON('katha.json');
  const index = katha.findIndex(c => c.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Customer not found in Katha' });
  }

  const transaction = {
    id:     generateId(),
    type:   type,
    amount: Number(amount),
    note:   note || '',
    date:   new Date().toISOString()
  };

  katha[index].transactions.push(transaction);

  // Update total due
  if (type === 'credit') {
    katha[index].totalDue += Number(amount);
  } else if (type === 'payment') {
    katha[index].totalDue -= Number(amount);
  }

  writeJSON('katha.json', katha);
  res.json({ success: true, transaction: transaction, totalDue: katha[index].totalDue });
});

// DELETE /api/katha/:id — Remove customer from katha
app.delete('/api/katha/:id', (req, res) => {
  let katha = readJSON('katha.json');
  katha     = katha.filter(c => c.id !== req.params.id);
  writeJSON('katha.json', katha);
  res.json({ success: true, message: 'Customer removed from Katha' });
});


// ============================================================
//  DASHBOARD SUMMARY ROUTE
// ============================================================

// GET /api/dashboard — All dashboard stats in one call
app.get('/api/dashboard', (req, res) => {
  const products  = readJSON('products.json');
  const sales     = readJSON('sales.json');
  const katha     = readJSON('katha.json');
  const today     = new Date();
  const todayStr  = today.toISOString().split('T')[0];

  // Total items
  const totalItems = products.length;

  // New items added today
  const newToday = products.filter(p => p.addedOn && p.addedOn.startsWith(todayStr)).length;

  // Expiring soon (within 7 days)
  const expiringSoon = products.filter(p => {
    if (!p.expiryDate) return false;
    const diff = Math.ceil((new Date(p.expiryDate) - today) / (1000 * 60 * 60 * 24));
    return diff >= 0 && diff <= 7;
  });

  const urgentExpiry = expiringSoon.filter(p => {
    const diff = Math.ceil((new Date(p.expiryDate) - today) / (1000 * 60 * 60 * 24));
    return diff <= 3;
  });

  // Low stock (5 or below)
  const lowStock = products.filter(p => p.quantity <= 5);

  // Today's sales
  const todaySales    = sales.filter(s => s.date.startsWith(todayStr));
  const todayRevenue  = todaySales.reduce((sum, s) => sum + s.totalAmount, 0);

  res.json({
    totalItems:       totalItems,
    newToday:         newToday,
    expiringSoon:     expiringSoon.slice(0, 4),   // top 4 for dashboard
    expiringCount:    expiringSoon.length,
    urgentCount:      urgentExpiry.length,
    lowStock:         lowStock.slice(0, 4),       // top 4 for dashboard
    lowStockCount:    lowStock.length,
    todayRevenue:     todayRevenue,
    todayBillCount:   todaySales.length
  });
});


// ============================================================
//  START SERVER
// ============================================================
app.listen(PORT, () => {
  console.log('');
  console.log('✅  BizMitra server is running!');
  console.log(`🌐  Open in browser: http://localhost:${PORT}`);
  console.log('');
  console.log('📦  API Endpoints ready:');
  console.log('    POST   /api/login');
  console.log('    POST   /api/register');
  console.log('    GET    /api/dashboard');
  console.log('    GET    /api/products');
  console.log('    POST   /api/products');
  console.log('    PUT    /api/products/:id');
  console.log('    DELETE /api/products/:id');
  console.log('    GET    /api/notifications');
  console.log('    GET    /api/sales');
  console.log('    GET    /api/sales/daily');
  console.log('    GET    /api/sales/monthly');
  console.log('    POST   /api/sales');
  console.log('    GET    /api/suppliers');
  console.log('    POST   /api/suppliers');
  console.log('    PUT    /api/suppliers/:id');
  console.log('    DELETE /api/suppliers/:id');
  console.log('    GET    /api/katha');
  console.log('    POST   /api/katha');
  console.log('    POST   /api/katha/:id/transaction');
  console.log('    DELETE /api/katha/:id');
  console.log('');
});