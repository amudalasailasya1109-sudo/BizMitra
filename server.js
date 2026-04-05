// ============================================================
//  BizMitra Backend — server.js
//  Run with:  node server.js
//  Opens at:  http://localhost:3000
// ============================================================

const dotenv = require('dotenv');
dotenv.config({ path: __dirname + '/.env' });

const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const { connectDB, getDB } = require('./db');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── MIDDLEWARE ──────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── GENERATE UNIQUE ID ───────────────────────────────────────
function generateId() {
  return Date.now().toString();
}


// ============================================================
//  AUTH ROUTES
// ============================================================

// POST /api/login — Login user
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const db   = getDB();
    const user = await db.collection('users').findOne({ username, password });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }

    res.json({
      success:    true,
      firstLogin: user.firstLogin,
      shopName:   user.shopName,
      username:   user.username
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/register — Register shop (first time only)
app.post('/api/register', async (req, res) => {
  try {
    const { shopName, username, password } = req.body;
    const db       = getDB();
    const existing = await db.collection('users').countDocuments();

    if (existing > 0) {
      return res.status(400).json({ success: false, message: 'Shop already registered' });
    }

    const newUser = {
      id:         generateId(),
      shopName:   shopName,
      username:   username,
      password:   password,
      firstLogin: false
    };

    await db.collection('users').insertOne(newUser);
    res.json({ success: true, message: 'Registered successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// ============================================================
//  PRODUCTS / INVENTORY ROUTES
// ============================================================

// GET /api/products — Get all products
app.get('/api/products', async (req, res) => {
  try {
    const db       = getDB();
    const products = await db.collection('products').find().toArray();
    res.json(products);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/products — Add new product
app.post('/api/products', async (req, res) => {
  try {
    const { name, category, quantity, unit, expiryDate, buyPrice, sellPrice, supplierName } = req.body;
    const db = getDB();

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

    await db.collection('products').insertOne(newProduct);
    res.json({ success: true, product: newProduct });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/products/:id — Update product
app.put('/api/products/:id', async (req, res) => {
  try {
    const db     = getDB();
    const result = await db.collection('products').findOneAndUpdate(
      { id: req.params.id },
      { $set: req.body },
      { returnDocument: 'after' }
    );

    if (!result) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({ success: true, product: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/products/:id — Delete product
app.delete('/api/products/:id', async (req, res) => {
  try {
    const db     = getDB();
    const result = await db.collection('products').deleteOne({ id: req.params.id });

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({ success: true, message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// ============================================================
//  NOTIFICATIONS / ALERTS
// ============================================================

// GET /api/notifications — Get expiry & low stock alerts
app.get('/api/notifications', async (req, res) => {
  try {
    const db            = getDB();
    const products      = await db.collection('products').find().toArray();
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
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// ============================================================
//  SALES ROUTES
// ============================================================

// GET /api/sales — Get all sales
app.get('/api/sales', async (req, res) => {
  try {
    const db    = getDB();
    const sales = await db.collection('sales').find().toArray();
    res.json(sales);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/sales/daily — Today's sales summary
app.get('/api/sales/daily', async (req, res) => {
  try {
    const db       = getDB();
    const todayStr = new Date().toISOString().split('T')[0];

    const todaySales = await db.collection('sales').find({ date: { $regex: `^${todayStr}` } }).toArray();
    const total      = todaySales.reduce((sum, s) => sum + s.totalAmount, 0);

    res.json({ date: todayStr, totalAmount: total, billCount: todaySales.length, sales: todaySales });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/sales/monthly — This month's sales summary
app.get('/api/sales/monthly', async (req, res) => {
  try {
    const db          = getDB();
    const now         = new Date();
    const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const monthSales = await db.collection('sales').find({ date: { $regex: `^${monthPrefix}` } }).toArray();
    const total      = monthSales.reduce((sum, s) => sum + s.totalAmount, 0);

    res.json({ month: monthPrefix, totalAmount: total, billCount: monthSales.length, sales: monthSales });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/sales — Create a new sale (billing)
app.post('/api/sales', async (req, res) => {
  try {
    const { customerName, items, paymentMode, kathaId } = req.body;
    const db = getDB();

    let totalAmount = 0;
    const saleItems = [];

    for (const item of items) {
      const product = await db.collection('products').findOne({ id: item.productId });

      if (!product) {
        return res.status(404).json({ success: false, message: `Product ${item.name} not found` });
      }

      if (product.quantity < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Not enough stock for ${item.name}. Available: ${product.quantity}`
        });
      }

      // Deduct stock
      await db.collection('products').updateOne(
        { id: item.productId },
        { $inc: { quantity: -item.quantity } }
      );

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

    await db.collection('sales').insertOne(newSale);
    res.json({ success: true, sale: newSale });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// ============================================================
//  SUPPLIERS ROUTES
// ============================================================

// GET /api/suppliers — Get all suppliers
app.get('/api/suppliers', async (req, res) => {
  try {
    const db        = getDB();
    const suppliers = await db.collection('suppliers').find().toArray();
    res.json(suppliers);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/suppliers — Add new supplier
app.post('/api/suppliers', async (req, res) => {
  try {
    const { name, contactPerson, phone, address, productsSupplied } = req.body;
    const db = getDB();

    const newSupplier = {
      id:               generateId(),
      name:             name,
      contactPerson:    contactPerson    || '',
      phone:            phone            || '',
      address:          address          || '',
      productsSupplied: productsSupplied || '',
      addedOn:          new Date().toISOString()
    };

    await db.collection('suppliers').insertOne(newSupplier);
    res.json({ success: true, supplier: newSupplier });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/suppliers/:id — Update supplier
app.put('/api/suppliers/:id', async (req, res) => {
  try {
    const db     = getDB();
    const result = await db.collection('suppliers').findOneAndUpdate(
      { id: req.params.id },
      { $set: req.body },
      { returnDocument: 'after' }
    );

    if (!result) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    res.json({ success: true, supplier: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/suppliers/:id — Delete supplier
app.delete('/api/suppliers/:id', async (req, res) => {
  try {
    const db = getDB();
    await db.collection('suppliers').deleteOne({ id: req.params.id });
    res.json({ success: true, message: 'Supplier deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// ============================================================
//  KATHA BOOK ROUTES (Customer Credit Book)
// ============================================================

// GET /api/katha — Get all katha entries
app.get('/api/katha', async (req, res) => {
  try {
    const db    = getDB();
    const katha = await db.collection('katha').find().toArray();
    res.json(katha);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/katha — Add new customer to katha
app.post('/api/katha', async (req, res) => {
  try {
    const { customerName, phone, address } = req.body;
    const db = getDB();

    const newCustomer = {
      id:           generateId(),
      customerName: customerName,
      phone:        phone   || '',
      address:      address || '',
      totalDue:     0,
      transactions: [],
      addedOn:      new Date().toISOString()
    };

    await db.collection('katha').insertOne(newCustomer);
    res.json({ success: true, customer: newCustomer });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/katha/:id/transaction — Add credit or payment
app.post('/api/katha/:id/transaction', async (req, res) => {
  try {
    const { type, amount, note } = req.body;
    const db       = getDB();
    const customer = await db.collection('katha').findOne({ id: req.params.id });

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found in Katha' });
    }

    const transaction = {
      id:     generateId(),
      type:   type,
      amount: Number(amount),
      note:   note || '',
      date:   new Date().toISOString()
    };

    const due = type === 'credit'
      ? customer.totalDue + Number(amount)
      : customer.totalDue - Number(amount);

    await db.collection('katha').updateOne(
      { id: req.params.id },
      {
        $push: { transactions: transaction },
        $set:  { totalDue: due }
      }
    );

    res.json({ success: true, transaction: transaction, totalDue: due });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/katha/:id — Remove customer from katha
app.delete('/api/katha/:id', async (req, res) => {
  try {
    const db = getDB();
    await db.collection('katha').deleteOne({ id: req.params.id });
    res.json({ success: true, message: 'Customer removed from Katha' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// ============================================================
//  DASHBOARD SUMMARY ROUTE
// ============================================================

// GET /api/dashboard — All dashboard stats in one call
app.get('/api/dashboard', async (req, res) => {
  try {
    const db       = getDB();
    const products = await db.collection('products').find().toArray();
    const sales    = await db.collection('sales').find().toArray();
    const today    = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const totalItems = products.length;
    const newToday   = products.filter(p => p.addedOn && p.addedOn.startsWith(todayStr)).length;

    const expiringSoon = products.filter(p => {
      if (!p.expiryDate) return false;
      const diff = Math.ceil((new Date(p.expiryDate) - today) / (1000 * 60 * 60 * 24));
      return diff >= 0 && diff <= 7;
    });

    const urgentExpiry = expiringSoon.filter(p => {
      const diff = Math.ceil((new Date(p.expiryDate) - today) / (1000 * 60 * 60 * 24));
      return diff <= 3;
    });

    const lowStock     = products.filter(p => p.quantity <= 5);
    const todaySales   = sales.filter(s => s.date.startsWith(todayStr));
    const todayRevenue = todaySales.reduce((sum, s) => sum + s.totalAmount, 0);

    res.json({
      totalItems:     totalItems,
      newToday:       newToday,
      expiringSoon:   expiringSoon.slice(0, 4),
      expiringCount:  expiringSoon.length,
      urgentCount:    urgentExpiry.length,
      lowStock:       lowStock.slice(0, 4),
      lowStockCount:  lowStock.length,
      todayRevenue:   todayRevenue,
      todayBillCount: todaySales.length
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// ============================================================
//  START SERVER — only after DB connects
// ============================================================
connectDB().then(() => {
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
});
