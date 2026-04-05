// ============================================================
//  BizMitra — script.js
// ============================================================

const API = '/api';

// ── SIDEBAR ─────────────────────────────────────────────────
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('overlay').classList.toggle('show');
}
window.addEventListener('resize', () => {
  if (window.innerWidth > 768) {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('overlay').classList.remove('show');
  }
});

// ── PAGE SWITCHER ────────────────────────────────────────────
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
  document.getElementById(`page-${name}`).style.display = 'block';

  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const navMap = { dashboard:'Dashboard', inventory:'Inventory', additem:'Add Item', billing:'Billing', sales:'Sales Records', katha:'Katha Book', suppliers:'Suppliers', notifications:'Notifications' };
  document.querySelectorAll('.nav-item').forEach(el => {
    if (el.textContent.trim().startsWith(navMap[name] || '')) el.classList.add('active');
  });

  if (window.innerWidth <= 768) {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('overlay').classList.remove('show');
  }

  if (name === 'dashboard')     loadDashboard();
  if (name === 'inventory')     loadInventory();
  if (name === 'suppliers')     loadSuppliers();
  if (name === 'katha')         loadKatha();
  if (name === 'sales')         loadSalesRecords();
  if (name === 'notifications') loadNotificationsPage();
  if (name === 'billing')       loadBillingProducts();
}

// ── TOAST ────────────────────────────────────────────────────
function showToast(message, type = 'success') {
  const e = document.getElementById('toast');
  if (e) e.remove();
  const t = document.createElement('div');
  t.id = 'toast';
  t.textContent = message;
  t.style.cssText = `position:fixed;bottom:24px;right:24px;background:${type==='success'?'#0d9488':'#ef4444'};color:white;padding:12px 20px;border-radius:8px;font-size:13.5px;font-family:Inter,sans-serif;font-weight:500;box-shadow:0 4px 12px rgba(0,0,0,0.15);z-index:9999;`;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// ── MODAL ────────────────────────────────────────────────────
function openModal(id) {
  document.getElementById(id).classList.add('show');
  document.getElementById('modal-backdrop').classList.add('show');
}
function closeModal() {
  document.querySelectorAll('.modal').forEach(m => m.classList.remove('show'));
  document.getElementById('modal-backdrop').classList.remove('show');
}

// ── DASHBOARD ────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const res  = await fetch(`${API}/dashboard`);
    const data = await res.json();

    document.getElementById('total-items').textContent    = data.totalItems;
    document.getElementById('new-today').textContent      = `+${data.newToday} new`;
    document.getElementById('expiring-count').textContent = data.expiringCount;
    document.getElementById('urgent-count').textContent   = `${data.urgentCount} urgent`;
    document.getElementById('lowstock-count').textContent = data.lowStockCount;

    const expiryList = document.getElementById('expiry-list');
    expiryList.innerHTML = '';
    if (!data.expiringSoon.length) {
      expiryList.innerHTML = '<p style="color:#9ca3af;font-size:13px;">No items expiring soon 🎉</p>';
    } else {
      data.expiringSoon.forEach(p => {
        const diff  = Math.ceil((new Date(p.expiryDate) - new Date()) / 86400000);
        const color = diff <= 3 ? 'red' : 'orange';
        expiryList.innerHTML += `<div class="expiry-item"><div class="expiry-item-left"><div class="dot ${color}"></div><span class="expiry-name">${p.name}</span></div><span class="expiry-days ${color}">${diff}d</span></div>`;
      });
    }

    const stockList = document.getElementById('stock-list');
    stockList.innerHTML = '';
    if (!data.lowStock.length) {
      stockList.innerHTML = '<p style="color:#9ca3af;font-size:13px;">All items well stocked 🎉</p>';
    } else {
      data.lowStock.forEach(p => {
        const pct   = Math.min(Math.round((p.quantity / 10) * 100), 100);
        const color = p.quantity <= 2 ? '#ef4444' : p.quantity <= 4 ? '#f59e0b' : '#22c55e';
        const cls   = p.quantity <= 2 ? 'red' : p.quantity <= 4 ? 'orange' : 'green';
        stockList.innerHTML += `<div class="stock-item"><div class="stock-item-row"><span class="stock-name">${p.name}</span><span class="stock-left ${cls}">${p.quantity} left</span></div><div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${color};"></div></div></div>`;
      });
    }

    loadNotificationsBadge();
  } catch (err) {
    showToast('Cannot connect to server. Is node server.js running?', 'error');
  }
}

async function loadNotificationsBadge() {
  try {
    const res   = await fetch(`${API}/notifications`);
    const data  = await res.json();
    const count = data.length;
    ['notif-badge','notif-badge-2'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = count;
    });
    const bell = document.getElementById('bell-badge');
    if (bell) { bell.textContent = count; bell.style.display = count > 0 ? 'flex' : 'none'; }
  } catch {}
}

// ── INVENTORY ────────────────────────────────────────────────
async function loadInventory() {
  try {
    const products = await fetch(`${API}/products`).then(r => r.json());
    const tbody    = document.getElementById('inventory-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!products.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:#9ca3af;">No items yet. Go to Add Item.</td></tr>`;
      return;
    }
    products.forEach(p => {
      const diff = p.expiryDate ? Math.ceil((new Date(p.expiryDate) - new Date()) / 86400000) : null;
      const exp  = diff === null ? '—' : diff < 0 ? `<span style="color:#ef4444;">Expired</span>` : diff <= 3 ? `<span style="color:#ef4444;">${diff}d</span>` : diff <= 7 ? `<span style="color:#f59e0b;">${diff}d</span>` : p.expiryDate;
      const qc   = p.quantity <= 2 ? '#ef4444' : p.quantity <= 5 ? '#f59e0b' : '#1a1a2e';
      tbody.innerHTML += `<tr><td>${p.name}</td><td>${p.category||'—'}</td><td style="color:${qc};font-weight:600;">${p.quantity} ${p.unit}</td><td>${exp}</td><td>₹${p.sellPrice}</td><td>${p.supplierName||'—'}</td><td><button onclick="deleteProduct('${p.id}','${p.name}')" class="btn-delete">Delete</button></td></tr>`;
    });
  } catch (err) { console.error(err); }
}

async function addProduct(e) {
  e.preventDefault();
  const f = e.target;
  const body = { name:f.name.value.trim(), category:f.category.value.trim(), quantity:f.quantity.value, unit:f.unit.value, expiryDate:f.expiryDate.value||null, buyPrice:f.buyPrice.value||0, sellPrice:f.sellPrice.value||0, supplierName:f.supplierName.value||'' };
  try {
    const data = await fetch(`${API}/products`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(r=>r.json());
    if (data.success) { showToast(`✅ ${body.name} added!`); f.reset(); loadDashboard(); }
    else showToast(data.message||'Failed','error');
  } catch { showToast('Server error','error'); }
}

async function deleteProduct(id, name) {
  if (!confirm(`Delete "${name}"?`)) return;
  try {
    const data = await fetch(`${API}/products/${id}`,{method:'DELETE'}).then(r=>r.json());
    if (data.success) { showToast(`🗑️ ${name} deleted`); loadInventory(); loadDashboard(); }
  } catch { showToast('Server error','error'); }
}

// ── BILLING ──────────────────────────────────────────────────
let billItems = [];

async function loadBillingProducts() {
  try {
    const products = await fetch(`${API}/products`).then(r => r.json());
    const sel      = document.getElementById('bill-product-select');
    if (!sel) return;
    sel.innerHTML  = '<option value="">— Choose product —</option>';
    products.forEach(p => {
      if (p.quantity > 0) {
        sel.innerHTML += `<option value="${p.id}" data-name="${p.name}" data-price="${p.sellPrice}" data-qty="${p.quantity}">
          ${p.name} (₹${p.sellPrice}) — ${p.quantity} ${p.unit} left
        </option>`;
      }
    });
  } catch { showToast('Could not load products','error'); }
}

function addItemToBill() {
  const sel   = document.getElementById('bill-product-select');
  const qtyEl = document.getElementById('bill-qty');
  const opt   = sel.options[sel.selectedIndex];

  if (!sel.value) { showToast('Please select a product','error'); return; }

  const qty      = parseInt(qtyEl.value) || 1;
  const maxQty   = parseInt(opt.dataset.qty);
  const price    = parseFloat(opt.dataset.price);
  const name     = opt.dataset.name;
  const id       = sel.value;

  if (qty < 1) { showToast('Quantity must be at least 1','error'); return; }
  if (qty > maxQty) { showToast(`Only ${maxQty} in stock!`, 'error'); return; }

  // Check if already in bill
  const existing = billItems.find(i => i.productId === id);
  if (existing) {
    if (existing.quantity + qty > maxQty) { showToast(`Only ${maxQty} available!`,'error'); return; }
    existing.quantity += qty;
    existing.lineTotal = existing.quantity * existing.sellPrice;
  } else {
    billItems.push({ productId:id, name, quantity:qty, sellPrice:price, lineTotal:qty*price, maxQty });
  }

  renderBillItems();
  sel.value   = '';
  qtyEl.value = 1;
}

function removeBillItem(productId) {
  billItems = billItems.filter(i => i.productId !== productId);
  renderBillItems();
}

function renderBillItems() {
  const tbody = document.getElementById('bill-items-tbody');
  const total = billItems.reduce((s, i) => s + i.lineTotal, 0);
  document.getElementById('bill-grand-total').textContent = `₹${total.toFixed(2)}`;

  if (!billItems.length) {
    tbody.innerHTML = `<tr id="bill-empty-row"><td colspan="5" style="text-align:center;padding:20px;color:#9ca3af;font-size:13px;">No items added yet</td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  billItems.forEach(item => {
    tbody.innerHTML += `
      <tr>
        <td>${item.name}</td>
        <td>${item.quantity}</td>
        <td>₹${item.sellPrice.toFixed(2)}</td>
        <td>₹${item.lineTotal.toFixed(2)}</td>
        <td><button onclick="removeBillItem('${item.productId}')" class="btn-delete" style="padding:3px 8px;font-size:11px;">✕</button></td>
      </tr>`;
  });
}

async function generateBill() {
  if (!billItems.length) { showToast('Add at least one item to the bill','error'); return; }

  const customer = document.getElementById('bill-customer').value.trim() || 'Walk-in Customer';
  const payment  = document.getElementById('bill-payment').value;

  const body = {
    customerName: customer,
    items:        billItems.map(i => ({ productId:i.productId, name:i.name, quantity:i.quantity, sellPrice:i.sellPrice })),
    paymentMode:  payment
  };

  try {
    const data = await fetch(`${API}/sales`, {
      method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)
    }).then(r => r.json());

    if (data.success) {
      showToast('✅ Bill generated successfully!');
      showBillPreview(data.sale);
      billItems = [];
      renderBillItems();
      document.getElementById('bill-customer').value = '';
      document.getElementById('bill-payment').value  = 'cash';
      loadBillingProducts(); // refresh stock counts
    } else {
      showToast(data.message || 'Failed to generate bill', 'error');
    }
  } catch { showToast('Server error','error'); }
}

function showBillPreview(sale) {
  const preview  = document.getElementById('bill-preview');
  const printBtn = document.getElementById('print-btn');
  const date     = new Date(sale.date).toLocaleString('en-IN');

  let rows = '';
  sale.items.forEach(item => {
    rows += `<tr><td>${item.name}</td><td>${item.quantity}</td><td>₹${item.sellPrice.toFixed(2)}</td><td>₹${item.lineTotal.toFixed(2)}</td></tr>`;
  });

  preview.innerHTML = `
    <div class="bill-preview-header">
      <h2>BizMitra</h2>
      <p>Stock Smart — Shop Bill</p>
    </div>
    <div class="bill-preview-meta">
      <span><strong>Customer:</strong> ${sale.customerName}</span>
      <span><strong>Bill #:</strong> ${sale.id}</span>
    </div>
    <div class="bill-preview-meta">
      <span><strong>Date:</strong> ${date}</span>
      <span><strong>Payment:</strong> ${sale.paymentMode.toUpperCase()}</span>
    </div>
    <table class="bill-preview-table">
      <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="bill-preview-total">Total: <span>₹${sale.totalAmount.toFixed(2)}</span></div>
    <div class="bill-preview-footer">Thank you for shopping! — BizMitra</div>
  `;

  printBtn.style.display = 'inline-flex';

  // Store for printing
  document.getElementById('print-area').innerHTML = `
    <div style="font-family:Inter,sans-serif;max-width:400px;margin:0 auto;padding:20px;">
      <h2 style="text-align:center;color:#0d9488;">BizMitra</h2>
      <p style="text-align:center;color:#9ca3af;font-size:12px;">Stock Smart — Shop Bill</p>
      <hr style="margin:12px 0;border:1px dashed #d1d5db;"/>
      <p><strong>Customer:</strong> ${sale.customerName}</p>
      <p><strong>Bill #:</strong> ${sale.id}</p>
      <p><strong>Date:</strong> ${date}</p>
      <p><strong>Payment:</strong> ${sale.paymentMode.toUpperCase()}</p>
      <hr style="margin:12px 0;border:1px dashed #d1d5db;"/>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr style="background:#f9fafb;"><th style="text-align:left;padding:6px;">Item</th><th style="padding:6px;">Qty</th><th style="padding:6px;">Price</th><th style="text-align:right;padding:6px;">Total</th></tr></thead>
        <tbody>${sale.items.map(i=>`<tr><td style="padding:6px;">${i.name}</td><td style="padding:6px;text-align:center;">${i.quantity}</td><td style="padding:6px;text-align:center;">₹${i.sellPrice.toFixed(2)}</td><td style="padding:6px;text-align:right;">₹${i.lineTotal.toFixed(2)}</td></tr>`).join('')}</tbody>
      </table>
      <hr style="margin:12px 0;border:2px solid #e5e7eb;"/>
      <p style="text-align:right;font-size:16px;font-weight:700;">Total: <span style="color:#0d9488;">₹${sale.totalAmount.toFixed(2)}</span></p>
      <p style="text-align:center;font-size:11px;color:#9ca3af;margin-top:16px;">Thank you for shopping! — BizMitra</p>
    </div>`;
}

function printBill() {
  window.print();
}

// ── SALES RECORDS ─────────────────────────────────────────────
async function loadSalesRecords() {
  try {
    const [daily, monthly, allSales] = await Promise.all([
      fetch(`${API}/sales/daily`).then(r=>r.json()),
      fetch(`${API}/sales/monthly`).then(r=>r.json()),
      fetch(`${API}/sales`).then(r=>r.json())
    ]);

    document.getElementById('daily-total').textContent  = `₹${daily.totalAmount.toFixed(2)}`;
    document.getElementById('daily-count').textContent  = `${daily.billCount} bills today`;
    document.getElementById('monthly-total').textContent = `₹${monthly.totalAmount.toFixed(2)}`;

    const tbody = document.getElementById('sales-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const sorted = [...allSales].reverse();
    if (!sorted.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:#9ca3af;">No bills yet</td></tr>`;
      return;
    }
    sorted.forEach(s => {
      const date  = new Date(s.date).toLocaleDateString('en-IN');
      const items = s.items.length + ' item(s)';
      tbody.innerHTML += `<tr><td style="font-size:11px;color:#9ca3af;">${s.id.slice(-6)}</td><td>${s.customerName}</td><td>${items}</td><td style="font-weight:600;color:#0d9488;">₹${s.totalAmount.toFixed(2)}</td><td><span style="background:#f0fdf4;color:#0d9488;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:600;">${s.paymentMode.toUpperCase()}</span></td><td style="color:#9ca3af;font-size:12px;">${date}</td></tr>`;
    });
  } catch (err) { console.error(err); }
}

// ── SUPPLIERS ────────────────────────────────────────────────
async function loadSuppliers() {
  try {
    const suppliers = await fetch(`${API}/suppliers`).then(r=>r.json());
    const tbody     = document.getElementById('suppliers-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!suppliers.length) { tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;color:#9ca3af;">No suppliers yet</td></tr>`; return; }
    suppliers.forEach(s => {
      tbody.innerHTML += `<tr><td>${s.name}</td><td>${s.contactPerson||'—'}</td><td>${s.phone||'—'}</td><td>${s.address||'—'}</td><td><button onclick="deleteSupplier('${s.id}','${s.name}')" class="btn-delete">Delete</button></td></tr>`;
    });
  } catch {}
}

async function addSupplier(e) {
  e.preventDefault();
  const f = e.target;
  const body = { name:f.supName.value.trim(), contactPerson:f.contactPerson.value.trim(), phone:f.phone.value.trim(), address:f.address.value.trim(), productsSupplied:f.productsSupplied.value.trim() };
  try {
    const data = await fetch(`${API}/suppliers`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(r=>r.json());
    if (data.success) { showToast(`✅ ${body.name} added!`); f.reset(); loadSuppliers(); }
    else showToast(data.message||'Failed','error');
  } catch { showToast('Server error','error'); }
}

async function deleteSupplier(id, name) {
  if (!confirm(`Remove "${name}"?`)) return;
  await fetch(`${API}/suppliers/${id}`,{method:'DELETE'});
  showToast(`🗑️ ${name} removed`);
  loadSuppliers();
}

// ── KATHA BOOK ───────────────────────────────────────────────
async function loadKatha() {
  try {
    const customers = await fetch(`${API}/katha`).then(r=>r.json());
    const tbody     = document.getElementById('katha-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!customers.length) { tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;color:#9ca3af;">No customers yet</td></tr>`; return; }
    customers.forEach(c => {
      const dueColor = c.totalDue > 0 ? '#ef4444' : '#22c55e';
      tbody.innerHTML += `
        <tr>
          <td>${c.customerName}</td>
          <td>${c.phone||'—'}</td>
          <td>${c.address||'—'}</td>
          <td style="color:${dueColor};font-weight:700;">₹${c.totalDue.toFixed(2)}</td>
          <td>
            <button onclick="openKathaModal('${c.id}','${c.customerName}','credit')" class="btn-delete" style="background:#fef2f2;color:#ef4444;margin-right:4px;">+ Credit</button>
            <button onclick="openKathaModal('${c.id}','${c.customerName}','payment')" class="btn-action" style="margin-right:4px;">+ Payment</button>
            <button onclick="viewKathaHistory('${c.id}','${c.customerName}')" class="btn-orange">History</button>
          </td>
        </tr>`;
    });
  } catch {}
}

async function addKathaCustomer(e) {
  e.preventDefault();
  const f    = e.target;
  const body = { customerName:f.customerName.value.trim(), phone:f.phone.value.trim(), address:f.address.value.trim() };
  try {
    const data = await fetch(`${API}/katha`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(r=>r.json());
    if (data.success) { showToast(`✅ ${body.customerName} added!`); f.reset(); loadKatha(); }
    else showToast(data.message||'Failed','error');
  } catch { showToast('Server error','error'); }
}

// Open modal with correct type pre-selected
function openKathaModal(id, name, type) {
  document.getElementById('katha-txn-id').value   = id;
  document.getElementById('katha-modal-title').textContent = `Add Entry — ${name}`;
  document.getElementById('katha-amount').value   = '';
  document.getElementById('katha-note').value     = '';
  document.querySelectorAll('input[name="txnType"]').forEach(r => { r.checked = r.value === type; });
  openModal('katha-modal');
}

async function submitKathaTransaction(e) {
  e.preventDefault();
  const id     = document.getElementById('katha-txn-id').value;
  const type   = document.querySelector('input[name="txnType"]:checked').value;
  const amount = document.getElementById('katha-amount').value;
  const note   = document.getElementById('katha-note').value;

  if (!amount || isNaN(amount) || Number(amount) <= 0) { showToast('Enter a valid amount','error'); return; }

  try {
    const data = await fetch(`${API}/katha/${id}/transaction`,{
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ type, amount:Number(amount), note })
    }).then(r=>r.json());

    if (data.success) {
      showToast(`✅ Entry saved. Due: ₹${data.totalDue.toFixed(2)}`);
      closeModal();
      loadKatha();
    } else {
      showToast(data.message||'Failed','error');
    }
  } catch { showToast('Server error','error'); }
}

async function viewKathaHistory(id, name) {
  try {
    const customers = await fetch(`${API}/katha`).then(r=>r.json());
    const customer  = customers.find(c => c.id === id);
    if (!customer) return;

    const panel = document.getElementById('katha-history-panel');
    const tbody = document.getElementById('katha-history-tbody');
    document.getElementById('katha-history-title').textContent = `History — ${name}`;
    panel.style.display = 'block';

    tbody.innerHTML = '';
    if (!customer.transactions.length) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:16px;color:#9ca3af;">No transactions yet</td></tr>`;
      panel.scrollIntoView({ behavior:'smooth' });
      return;
    }

    [...customer.transactions].reverse().forEach(t => {
      const color = t.type === 'credit' ? '#ef4444' : '#22c55e';
      const label = t.type === 'credit' ? '+ Credit' : '- Payment';
      const date  = new Date(t.date).toLocaleDateString('en-IN');
      tbody.innerHTML += `<tr><td style="color:${color};font-weight:600;">${label}</td><td style="font-weight:600;">₹${t.amount.toFixed(2)}</td><td>${t.note||'—'}</td><td style="color:#9ca3af;font-size:12px;">${date}</td></tr>`;
    });

    panel.scrollIntoView({ behavior:'smooth' });
  } catch {}
}

async function deleteKatha(id, name) {
  if (!confirm(`Remove "${name}" from Katha?`)) return;
  await fetch(`${API}/katha/${id}`,{method:'DELETE'});
  showToast(`🗑️ ${name} removed`);
  loadKatha();
}

// ── NOTIFICATIONS PAGE ────────────────────────────────────────
async function loadNotificationsPage() {
  try {
    const items = await fetch(`${API}/notifications`).then(r=>r.json());
    const list  = document.getElementById('notifications-list');
    if (!list) return;
    if (!items.length) { list.innerHTML = '<p style="color:#9ca3af;font-size:13px;padding:8px 0;">No alerts 🎉</p>'; return; }
    list.innerHTML = items.map(n => {
      const isRed = n.urgent;
      const icon  = n.type === 'lowstock'
        ? `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"/></svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6l4 2"/></svg>`;
      return `<div class="notif-item"><div class="notif-icon ${isRed?'red':'orange'}">${icon}</div><div><div class="notif-text">${n.message}</div><div class="notif-sub">${n.type==='lowstock'?'Stock Alert':'Expiry Alert'}${n.urgent?' · Urgent':''}</div></div></div>`;
    }).join('');
  } catch {}
}

// ── INIT ─────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  const dateEl = document.getElementById('today-date');
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'});
  loadDashboard();
  setInterval(loadDashboard, 60000);
});
