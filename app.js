/* ═══════════════════════════════════════════
   ProBooks — Main Application Logic
═══════════════════════════════════════════ */

let _deleteTarget = null; // { type, bizId, id }
let _activeSaleItemId = null;
let _invoiceLineCount = 0;

/* ══════════════════════════════════════════
   MODAL UTILITIES
══════════════════════════════════════════ */
function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
  // Pre-fill today's date in any date fields inside
  const today = DB.today();
  const modal = document.getElementById(id);
  modal.querySelectorAll('input[type=date]').forEach(el => { if (!el.value) el.value = today; });
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

/* ══════════════════════════════════════════
   ADMIN DASHBOARD
══════════════════════════════════════════ */
function loadAdminDashboard() {
  showScreen('admin');
  adminTab('admin-businesses', document.querySelector('[data-tab="admin-businesses"]'));
  renderBusinesses();
  renderAdminUsers();
}

function adminTab(tabId, el) {
  document.querySelectorAll('#admin-sidebar .nav-item').forEach(n => n.classList.remove('active'));
  if (el) el.classList.add('active');
  document.querySelectorAll('#screen-admin .tab-panel').forEach(p => {
    p.classList.remove('active'); p.classList.add('hidden');
  });
  const panel = document.getElementById(`tab-${tabId}`);
  if (panel) { panel.classList.remove('hidden'); panel.classList.add('active'); }
  if (tabId === 'admin-businesses') renderBusinesses();
  if (tabId === 'admin-users') renderAdminUsers();
}

function renderBusinesses() {
  const container = document.getElementById('businesses-list');
  const businesses = DB.getBusinesses();
  if (!businesses.length) {
    container.innerHTML = `<div class="card" style="text-align:center;color:var(--text-muted);padding:40px">
      No businesses registered yet. Click "+ Add Business" to register the first one.</div>`;
    return;
  }
  container.innerHTML = businesses.map(b => `
    <div class="biz-card">
      <h3>🏢 ${esc(b.name)}</h3>
      <div class="biz-meta">Type: ${esc(b.type)} &nbsp;|&nbsp; Currency: ${esc(b.currency)}</div>
      <div class="biz-meta">Owner: ${esc(b.ownerName)}</div>
      <div class="biz-meta">Members: ${DB.getUsersByBiz(b.id).length} staff registered</div>
      <div class="biz-actions">
        <button class="btn-outline small" onclick="deleteBusiness('${b.id}')">🗑 Remove</button>
      </div>
    </div>
  `).join('');
}

function renderAdminUsers() {
  const tbody = document.getElementById('admin-users-body');
  const businesses = DB.getBusinesses();
  const users = DB.getAllUsers();

  // Include owners
  const rows = [];
  businesses.forEach(b => {
    rows.push({ name: b.ownerName, role: 'Owner', biz: b.name });
  });
  users.forEach(u => {
    const biz = DB.getBusiness(u.bizId);
    rows.push({ name: u.name, role: u.role === 'manager' ? 'Manager' : 'Sales Person', biz: biz ? biz.name : '—', id: u.id });
  });

  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>${esc(r.name)}</td>
      <td><span class="pill pill-ok">${esc(r.role)}</span></td>
      <td>${esc(r.biz)}</td>
      <td>${r.id ? `<button class="btn-icon danger" onclick="adminDeleteUser('${r.id}')">🗑 Remove</button>` : '—'}</td>
    </tr>
  `).join('');
}

function addBusiness() {
  const name = document.getElementById('new-biz-name').value.trim();
  const type = document.getElementById('new-biz-type').value;
  const currency = document.getElementById('new-biz-currency').value;
  const ownerName = document.getElementById('new-owner-name').value.trim();
  const ownerPass = document.getElementById('new-owner-pass').value;

  if (!name || !ownerName || !ownerPass) return showToast('Fill all required fields.', 'error');
  if (ownerPass.length < 6) return showToast('Owner password must be at least 6 characters.', 'error');

  const id = DB.uid();
  DB.addBusiness({
    id, name, type, currency,
    ownerName, ownerPassword: hashPass(ownerPass),
    threshold: 5,
    address: '', contact: '',
    createdAt: DB.now()
  });

  closeModal('modal-add-business');
  document.getElementById('new-biz-name').value = '';
  document.getElementById('new-owner-name').value = '';
  document.getElementById('new-owner-pass').value = '';
  renderBusinesses();
  renderAdminUsers();
  showToast(`Business "${name}" created!`, 'success');
}

function deleteBusiness(bizId) {
  const biz = DB.getBusiness(bizId);
  if (!biz) return;
  if (!confirm(`Delete "${biz.name}" and ALL its data? This cannot be undone.`)) return;
  const businesses = DB.getBusinesses().filter(b => b.id !== bizId);
  DB.setBusinesses(businesses);
  const users = DB.getAllUsers().filter(u => u.bizId !== bizId);
  DB.setAllUsers(users);
  // Clean all data keys for this biz
  ['income','expenses','stock','sales','restocks','invoices','notifs'].forEach(col => {
    localStorage.removeItem(`pb_${bizId}_${col}`);
  });
  renderBusinesses();
  renderAdminUsers();
  showToast('Business removed.', 'success');
}

function adminDeleteUser(userId) {
  if (!confirm('Remove this user?')) return;
  DB.deleteUser(userId);
  renderAdminUsers();
  showToast('User removed.', 'success');
}

/* ══════════════════════════════════════════
   OWNER DASHBOARD
══════════════════════════════════════════ */
function loadOwnerDashboard() {
  showScreen('owner');
  const biz = DB.getBusiness(CURRENT_USER.bizId);
  document.getElementById('owner-biz-name').textContent = biz ? biz.name : '';
  document.getElementById('owner-greeting').textContent = `Welcome, ${CURRENT_USER.name}`;

  // Load settings fields
  if (biz) {
    document.getElementById('settings-biz-name').value = biz.name || '';
    document.getElementById('settings-biz-type').value = biz.type || 'Retail';
    document.getElementById('settings-currency').value = biz.currency || 'KES';
    document.getElementById('settings-contact').value = biz.contact || '';
    document.getElementById('settings-address').value = biz.address || '';
    document.getElementById('settings-threshold').value = biz.threshold || 5;
  }

  ownerTab('owner-dashboard', document.querySelector('[data-tab="owner-dashboard"]'));
  renderOwnerStats();
  renderOwnerActivity();
  renderOwnerLowStock();
  updateNotifBadge();
}

function ownerTab(tabId, el) {
  document.querySelectorAll('#owner-sidebar .nav-item').forEach(n => n.classList.remove('active'));
  if (el) el.classList.add('active');
  document.querySelectorAll('#screen-owner .tab-panel').forEach(p => {
    p.classList.remove('active'); p.classList.add('hidden');
  });
  const panel = document.getElementById(`tab-${tabId}`);
  if (panel) { panel.classList.remove('hidden'); panel.classList.add('active'); }

  const bizId = CURRENT_USER.bizId;
  switch (tabId) {
    case 'owner-dashboard': renderOwnerStats(); renderOwnerActivity(); renderOwnerLowStock(); break;
    case 'owner-income': renderIncomeTable(); break;
    case 'owner-expenses': renderExpenseTable(); break;
    case 'owner-sales': renderOwnerSalesTable(); break;
    case 'owner-stock': renderStockTable(); break;
    case 'owner-invoices': renderInvoiceTable(); break;
    case 'owner-team': renderTeamTable(); break;
    case 'owner-notifications': renderNotifications(); break;
    case 'owner-reports': break;
  }
}

function getCurrency() {
  const biz = DB.getBusiness(CURRENT_USER.bizId);
  return biz ? (biz.currency || 'KES') : 'KES';
}

function renderOwnerStats() {
  const bizId = CURRENT_USER.bizId;
  const currency = getCurrency();
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

  const income = DB.getIncome(bizId).filter(r => r.date && r.date.startsWith(thisMonth));
  const expenses = DB.getExpenses(bizId).filter(r => r.date && r.date.startsWith(thisMonth));
  const sales = DB.getSales(bizId).filter(r => r.date && r.date.startsWith(thisMonth));
  const stock = DB.getStock(bizId);
  const biz = DB.getBusiness(bizId);
  const threshold = biz ? (biz.threshold || 5) : 5;

  const totalIncome = income.reduce((s, r) => s + Number(r.amount || 0), 0);
  const totalExpenses = expenses.reduce((s, r) => s + Number(r.amount || 0), 0);
  const totalSales = sales.reduce((s, r) => s + Number(r.total || 0), 0);
  const profit = totalIncome - totalExpenses;
  const lowStockCount = stock.filter(s => Number(s.qty) <= Number(s.reorderLevel || threshold)).length;

  document.getElementById('owner-stats').innerHTML = `
    <div class="stat-card">
      <div class="stat-label">Income (This Month)</div>
      <div class="stat-value">${DB.fmtMoney(totalIncome, currency)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Expenses (This Month)</div>
      <div class="stat-value">${DB.fmtMoney(totalExpenses, currency)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Sales Revenue</div>
      <div class="stat-value">${DB.fmtMoney(totalSales, currency)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Net Profit</div>
      <div class="stat-value" style="color:${profit>=0?'var(--success)':'var(--danger)'}">
        ${DB.fmtMoney(profit, currency)}
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Low Stock Items</div>
      <div class="stat-value" style="color:${lowStockCount?'var(--danger)':'var(--success)'}">
        ${lowStockCount}
      </div>
      <div class="stat-sub">items need reorder</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Total Stock Items</div>
      <div class="stat-value">${stock.length}</div>
    </div>
  `;
}

function renderOwnerActivity() {
  const bizId = CURRENT_USER.bizId;
  const sales = DB.getSales(bizId).slice(0, 8);
  const feed = document.getElementById('owner-recent-activity');
  if (!sales.length) {
    feed.innerHTML = '<div style="color:var(--text-muted);font-size:13px">No recent sales.</div>';
    return;
  }
  feed.innerHTML = sales.map(s => `
    <div class="activity-item">
      <div class="activity-dot"></div>
      <div>
        <div>${esc(s.recordedBy)} sold ${s.qty} × ${esc(s.itemName)}</div>
        <div class="activity-meta">${DB.fmtTime(s.createdAt)} &nbsp;|&nbsp; ${esc(s.payment)}</div>
      </div>
    </div>
  `).join('');
}

function renderOwnerLowStock() {
  const bizId = CURRENT_USER.bizId;
  const biz = DB.getBusiness(bizId);
  const threshold = biz ? (biz.threshold || 5) : 5;
  const stock = DB.getStock(bizId).filter(s => Number(s.qty) <= Number(s.reorderLevel || threshold));
  const feed = document.getElementById('owner-low-stock');
  if (!stock.length) {
    feed.innerHTML = '<div style="color:var(--success);font-size:13px">✅ All stock levels are OK.</div>';
    return;
  }
  feed.innerHTML = stock.map(s => `
    <div class="alert-item">⚠️ <strong>${esc(s.name)}</strong> — only ${s.qty} ${esc(s.unit)} left</div>
  `).join('');
}

/* ── Income ── */
function addIncome() {
  const bizId = CURRENT_USER.bizId;
  const date = document.getElementById('income-date').value;
  const amount = document.getElementById('income-amount').value;
  const cat = document.getElementById('income-cat').value;
  const payment = document.getElementById('income-payment').value;
  const desc = document.getElementById('income-desc').value.trim();
  const ref = document.getElementById('income-ref').value.trim();

  if (!date || !amount) return showToast('Date and amount are required.', 'error');

  DB.addIncome(bizId, {
    id: DB.uid(), date, amount: Number(amount), category: cat,
    payment, description: desc, reference: ref, createdAt: DB.now()
  });

  closeModal('modal-add-income');
  document.getElementById('income-amount').value = '';
  document.getElementById('income-desc').value = '';
  document.getElementById('income-ref').value = '';
  renderIncomeTable();
  showToast('Income recorded!', 'success');
}

function renderIncomeTable() {
  const bizId = CURRENT_USER.bizId;
  const currency = getCurrency();
  const records = DB.getIncome(bizId);
  const tbody = document.getElementById('income-table-body');
  if (!records.length) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">No income records.</td></tr>'; return; }
  tbody.innerHTML = records.map(r => `
    <tr>
      <td>${DB.fmt(r.date)}</td>
      <td><strong>${DB.fmtMoney(r.amount, currency)}</strong></td>
      <td>${esc(r.category)}</td>
      <td>${esc(r.payment)}</td>
      <td>${esc(r.description || '—')}</td>
      <td>
        <button class="btn-icon danger" onclick="deleteRecord('income','${r.id}')">🗑</button>
      </td>
    </tr>
  `).join('');
}

/* ── Expenses ── */
function addExpense() {
  const bizId = CURRENT_USER.bizId;
  const date = document.getElementById('expense-date').value;
  const amount = document.getElementById('expense-amount').value;
  const cat = document.getElementById('expense-cat').value;
  const payment = document.getElementById('expense-payment').value;
  const desc = document.getElementById('expense-desc').value.trim();
  const vendor = document.getElementById('expense-vendor').value.trim();

  if (!date || !amount) return showToast('Date and amount are required.', 'error');

  DB.addExpense(bizId, {
    id: DB.uid(), date, amount: Number(amount), category: cat,
    payment, description: desc, vendor, createdAt: DB.now()
  });

  closeModal('modal-add-expense');
  document.getElementById('expense-amount').value = '';
  document.getElementById('expense-desc').value = '';
  document.getElementById('expense-vendor').value = '';
  renderExpenseTable();
  showToast('Expense recorded!', 'success');
}

function renderExpenseTable() {
  const bizId = CURRENT_USER.bizId;
  const currency = getCurrency();
  const records = DB.getExpenses(bizId);
  const tbody = document.getElementById('expense-table-body');
  if (!records.length) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">No expense records.</td></tr>'; return; }
  tbody.innerHTML = records.map(r => `
    <tr>
      <td>${DB.fmt(r.date)}</td>
      <td><strong>${DB.fmtMoney(r.amount, currency)}</strong></td>
      <td>${esc(r.category)}</td>
      <td>${esc(r.payment)}</td>
      <td>${esc(r.description || r.vendor || '—')}</td>
      <td>
        <button class="btn-icon danger" onclick="deleteRecord('expense','${r.id}')">🗑</button>
      </td>
    </tr>
  `).join('');
}

/* ── Sales (Owner View — all staff) ── */
function renderOwnerSalesTable() {
  const bizId = CURRENT_USER.bizId;
  const currency = getCurrency();
  const records = DB.getSales(bizId);
  const tbody = document.getElementById('owner-sales-table-body');
  if (!records.length) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted)">No sales yet.</td></tr>'; return; }
  tbody.innerHTML = records.map(r => `
    <tr>
      <td>${DB.fmt(r.date)}</td>
      <td>${esc(r.itemName)}</td>
      <td>${r.qty}</td>
      <td>${DB.fmtMoney(r.unitPrice, currency)}</td>
      <td><strong>${DB.fmtMoney(r.total, currency)}</strong></td>
      <td>${esc(r.payment)}</td>
      <td><span class="pill pill-ok">${esc(r.recordedBy)}</span></td>
      <td><button class="btn-icon danger" onclick="deleteRecord('sale','${r.id}')">🗑</button></td>
    </tr>
  `).join('');
}

/* ── Stock (Owner) ── */
function addStockItem() {
  const bizId = CURRENT_USER.bizId;
  const name = document.getElementById('stock-name').value.trim();
  const sku = document.getElementById('stock-sku').value.trim();
  const cat = document.getElementById('stock-cat').value.trim();
  const unit = document.getElementById('stock-unit').value;
  const qty = document.getElementById('stock-qty').value;
  const reorderLevel = document.getElementById('stock-reorder').value;
  const costPrice = document.getElementById('stock-cost').value;
  const sellPrice = document.getElementById('stock-sell').value;

  if (!name) return showToast('Item name is required.', 'error');

  DB.addStockItem(bizId, {
    id: DB.uid(), name, sku, category: cat, unit,
    qty: Number(qty || 0),
    reorderLevel: Number(reorderLevel || 5),
    costPrice: Number(costPrice || 0),
    sellPrice: Number(sellPrice || 0),
    createdAt: DB.now()
  });

  closeModal('modal-add-stock');
  ['stock-name','stock-sku','stock-cat','stock-qty','stock-reorder','stock-cost','stock-sell'].forEach(id => {
    document.getElementById(id).value = '';
  });
  renderStockTable();
  showToast('Stock item added!', 'success');
}

function renderStockTable() {
  const bizId = CURRENT_USER.bizId;
  const currency = getCurrency();
  const biz = DB.getBusiness(bizId);
  const threshold = biz ? (biz.threshold || 5) : 5;
  const stock = DB.getStock(bizId);
  const tbody = document.getElementById('stock-table-body');
  if (!stock.length) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted)">No stock items yet.</td></tr>'; return; }
  tbody.innerHTML = stock.map(s => {
    const low = Number(s.qty) <= Number(s.reorderLevel || threshold);
    return `
    <tr>
      <td><strong>${esc(s.name)}</strong></td>
      <td style="color:var(--text-muted)">${esc(s.sku || '—')}</td>
      <td>${esc(s.category || '—')}</td>
      <td>
        <span class="pill ${low ? 'pill-low' : 'pill-ok'}">${s.qty} ${esc(s.unit)}</span>
      </td>
      <td>${DB.fmtMoney(s.costPrice, currency)}</td>
      <td>${DB.fmtMoney(s.sellPrice, currency)}</td>
      <td>${s.reorderLevel || threshold}</td>
      <td><button class="btn-icon danger" onclick="deleteRecord('stock','${s.id}')">🗑</button></td>
    </tr>`;
  }).join('');
}

/* ── Invoices ── */
let _invoiceLines = [];

function addInvoiceLine() {
  _invoiceLineCount++;
  const lineId = `inv-line-${_invoiceLineCount}`;
  const container = document.getElementById('invoice-lines');
  const div = document.createElement('div');
  div.className = 'invoice-line';
  div.id = lineId;
  div.innerHTML = `
    <input type="text" class="field-input" placeholder="Description" oninput="calcInvoiceTotal()" data-inv="desc" />
    <input type="number" class="field-input" placeholder="Qty" min="1" value="1" oninput="calcInvoiceTotal()" data-inv="qty" />
    <input type="number" class="field-input" placeholder="Unit Price" step="0.01" oninput="calcInvoiceTotal()" data-inv="price" />
    <button class="btn-icon danger" onclick="document.getElementById('${lineId}').remove();calcInvoiceTotal()">✕</button>
  `;
  container.appendChild(div);
}

function calcInvoiceTotal() {
  const lines = document.querySelectorAll('.invoice-line');
  let subtotal = 0;
  lines.forEach(line => {
    const qty = Number(line.querySelector('[data-inv="qty"]')?.value || 0);
    const price = Number(line.querySelector('[data-inv="price"]')?.value || 0);
    subtotal += qty * price;
  });
  const tax = Number(document.getElementById('inv-tax')?.value || 0);
  const discount = Number(document.getElementById('inv-discount')?.value || 0);
  const total = subtotal * (1 + tax/100) * (1 - discount/100);
  const currency = getCurrency();
  const el = document.getElementById('inv-total-display');
  if (el) el.textContent = `Invoice Total: ${DB.fmtMoney(total, currency)}`;
  return { subtotal, total, tax, discount };
}

function saveInvoice() {
  const bizId = CURRENT_USER.bizId;
  const client = document.getElementById('inv-client').value.trim();
  const email = document.getElementById('inv-email').value.trim();
  const date = document.getElementById('inv-date').value;
  const due = document.getElementById('inv-due').value;
  const notes = document.getElementById('inv-notes').value.trim();
  const status = document.getElementById('inv-status').value;

  if (!client || !date) return showToast('Client name and date required.', 'error');

  const lines = [];
  document.querySelectorAll('.invoice-line').forEach(line => {
    const desc = line.querySelector('[data-inv="desc"]')?.value.trim();
    const qty = Number(line.querySelector('[data-inv="qty"]')?.value || 0);
    const price = Number(line.querySelector('[data-inv="price"]')?.value || 0);
    if (desc) lines.push({ desc, qty, price, total: qty * price });
  });

  if (!lines.length) return showToast('Add at least one line item.', 'error');

  const { total, tax, discount } = calcInvoiceTotal();
  const invoices = DB.getInvoices(bizId);
  const invNo = `INV-${String(invoices.length + 1).padStart(4, '0')}`;

  DB.addInvoice(bizId, {
    id: DB.uid(), invoiceNo: invNo, client, email, date, due, notes, status,
    lines, tax, discount, total, createdAt: DB.now()
  });

  closeModal('modal-add-invoice');
  document.getElementById('invoice-lines').innerHTML = '';
  document.getElementById('inv-client').value = '';
  document.getElementById('inv-email').value = '';
  document.getElementById('inv-notes').value = '';
  document.getElementById('inv-tax').value = '';
  document.getElementById('inv-discount').value = '';
  _invoiceLineCount = 0;
  renderInvoiceTable();
  showToast('Invoice saved!', 'success');
}

function renderInvoiceTable() {
  const bizId = CURRENT_USER.bizId;
  const currency = getCurrency();
  const records = DB.getInvoices(bizId);
  const tbody = document.getElementById('invoice-table-body');
  if (!records.length) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">No invoices yet.</td></tr>'; return; }
  tbody.innerHTML = records.map(r => `
    <tr>
      <td><code>${esc(r.invoiceNo)}</code></td>
      <td>${esc(r.client)}</td>
      <td>${DB.fmt(r.date)}</td>
      <td>${DB.fmt(r.due)}</td>
      <td><strong>${DB.fmtMoney(r.total, currency)}</strong></td>
      <td>
        <span class="pill ${r.status === 'Paid' ? 'pill-paid' : 'pill-unpaid'}">${esc(r.status)}</span>
        ${r.status === 'Unpaid' ? `<button class="btn-icon" onclick="markInvoicePaid('${r.id}')" title="Mark Paid">✓</button>` : ''}
      </td>
      <td><button class="btn-icon danger" onclick="deleteRecord('invoice','${r.id}')">🗑</button></td>
    </tr>
  `).join('');
}

function markInvoicePaid(id) {
  DB.updateInvoice(CURRENT_USER.bizId, id, { status: 'Paid' });
  renderInvoiceTable();
  showToast('Invoice marked as paid.', 'success');
}

/* ── Team ── */
function addTeamMember() {
  const bizId = CURRENT_USER.bizId;
  const name = document.getElementById('new-user-name').value.trim();
  const role = document.getElementById('new-user-role').value;
  const pass = document.getElementById('new-user-pass').value;

  if (!name || !pass) return showToast('Name and password are required.', 'error');
  if (pass.length < 6) return showToast('Password must be at least 6 characters.', 'error');

  // Check duplicate name in same business
  const existing = DB.getAllUsers().find(u =>
    u.name.toLowerCase() === name.toLowerCase() && u.bizId === bizId
  );
  if (existing) return showToast('A user with that name already exists in this business.', 'error');

  DB.addUser({
    id: DB.uid(), name, role, bizId,
    password: hashPass(pass), createdAt: DB.now()
  });

  closeModal('modal-add-user');
  document.getElementById('new-user-name').value = '';
  document.getElementById('new-user-pass').value = '';
  renderTeamTable();
  showToast(`${role === 'manager' ? 'Manager' : 'Sales Person'} "${name}" added!`, 'success');
}

function renderTeamTable() {
  const bizId = CURRENT_USER.bizId;
  const users = DB.getUsersByBiz(bizId);
  const tbody = document.getElementById('team-table-body');
  if (!users.length) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text-muted)">No team members yet.</td></tr>';
    return;
  }
  tbody.innerHTML = users.map(u => `
    <tr>
      <td>${esc(u.name)}</td>
      <td><span class="pill ${u.role === 'manager' ? 'pill-ok' : 'pill-warn'}">${u.role === 'manager' ? 'Manager' : 'Sales Person'}</span></td>
      <td><button class="btn-icon danger" onclick="removeTeamMember('${u.id}')">🗑 Remove</button></td>
    </tr>
  `).join('');
}

function removeTeamMember(userId) {
  if (!confirm('Remove this team member? They will no longer be able to log in.')) return;
  DB.deleteUser(userId);
  renderTeamTable();
  showToast('Team member removed.', 'success');
}

/* ── Notifications ── */
function renderNotifications() {
  const bizId = CURRENT_USER.bizId;
  const notifs = DB.getNotifications(bizId);
  DB.markNotifsRead(bizId);
  updateNotifBadge();

  const feed = document.getElementById('notifications-feed');
  if (!notifs.length) {
    feed.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:40px">No notifications yet.</div>';
    return;
  }
  feed.innerHTML = notifs.map(n => `
    <div class="notif-item ${n.read ? '' : 'unread'}">
      <div class="notif-icon">${n.icon || '🔔'}</div>
      <div class="notif-body">
        <div class="notif-text">${esc(n.message)}</div>
        <div class="notif-time">${DB.fmtTime(n.createdAt)}</div>
      </div>
    </div>
  `).join('');
}

function updateNotifBadge() {
  if (!CURRENT_USER || CURRENT_USER.role !== 'owner') return;
  const notifs = DB.getNotifications(CURRENT_USER.bizId);
  const unread = notifs.filter(n => !n.read).length;
  const badge = document.getElementById('notif-badge');
  if (badge) {
    badge.textContent = unread;
    unread > 0 ? badge.classList.remove('hidden') : badge.classList.add('hidden');
  }
}

function clearNotifications() {
  DB.clearNotifications(CURRENT_USER.bizId);
  renderNotifications();
  showToast('Notifications cleared.', 'success');
}

/* ── Business Settings ── */
function saveBusinessSettings() {
  const bizId = CURRENT_USER.bizId;
  const name = document.getElementById('settings-biz-name').value.trim();
  const type = document.getElementById('settings-biz-type').value;
  const currency = document.getElementById('settings-currency').value;
  const contact = document.getElementById('settings-contact').value.trim();
  const address = document.getElementById('settings-address').value.trim();
  const threshold = Number(document.getElementById('settings-threshold').value || 5);
  const msgEl = document.getElementById('settings-msg');

  if (!name) return showMsg(msgEl, 'Business name is required.', 'error');

  DB.updateBusiness(bizId, { name, type, currency, contact, address, threshold });
  document.getElementById('owner-biz-name').textContent = name;
  showMsg(msgEl, 'Settings saved!', 'success');
}

/* ── Delete (Owner only) ── */
function deleteRecord(type, id) {
  _deleteTarget = { type, id, bizId: CURRENT_USER.bizId };
  openModal('modal-delete');
}

function confirmDelete() {
  if (!_deleteTarget) return;
  const { type, id, bizId } = _deleteTarget;
  if (type === 'income') { DB.deleteIncome(bizId, id); renderIncomeTable(); }
  if (type === 'expense') { DB.deleteExpense(bizId, id); renderExpenseTable(); }
  if (type === 'sale') { DB.deleteSale(bizId, id); renderOwnerSalesTable(); }
  if (type === 'stock') { DB.deleteStockItem(bizId, id); renderStockTable(); }
  if (type === 'invoice') { DB.deleteInvoice(bizId, id); renderInvoiceTable(); }
  closeModal('modal-delete');
  _deleteTarget = null;
  showToast('Record deleted.', 'success');
}

/* ══════════════════════════════════════════
   MANAGER DASHBOARD
══════════════════════════════════════════ */
function loadManagerDashboard() {
  showScreen('manager');
  const biz = DB.getBusiness(CURRENT_USER.bizId);
  document.getElementById('mgr-biz-name').textContent = biz ? biz.name : '';
  mgrTab('mgr-sales', document.querySelector('[data-tab="mgr-sales"]'));
}

function mgrTab(tabId, el) {
  document.querySelectorAll('#screen-manager .nav-item').forEach(n => n.classList.remove('active'));
  if (el) el.classList.add('active');
  document.querySelectorAll('#screen-manager .tab-panel').forEach(p => {
    p.classList.remove('active'); p.classList.add('hidden');
  });
  const panel = document.getElementById(`tab-${tabId}`);
  if (panel) { panel.classList.remove('hidden'); panel.classList.add('active'); }

  if (tabId === 'mgr-sales') renderMgrSales();
  if (tabId === 'mgr-stock') renderMgrStock();
  if (tabId === 'mgr-invoices') renderMgrInvoices();
  if (tabId === 'mgr-alerts') renderMgrAlerts();
}

function renderMgrSales() {
  const bizId = CURRENT_USER.bizId;
  const currency = getCurrencyFor(bizId);
  const sales = DB.getSales(bizId);
  const tbody = document.getElementById('mgr-sales-body');
  if (!sales.length) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted)">No sales yet.</td></tr>'; return; }
  tbody.innerHTML = sales.map(r => `
    <tr>
      <td>${DB.fmt(r.date)}</td>
      <td>${esc(r.itemName)}</td>
      <td>${r.qty}</td>
      <td>${DB.fmtMoney(r.unitPrice, currency)}</td>
      <td><strong>${DB.fmtMoney(r.total, currency)}</strong></td>
      <td>${esc(r.payment)}</td>
      <td><span class="pill pill-ok">${esc(r.recordedBy)}</span></td>
    </tr>
  `).join('');
}

function renderMgrStock() {
  const bizId = CURRENT_USER.bizId;
  const currency = getCurrencyFor(bizId);
  const biz = DB.getBusiness(bizId);
  const threshold = biz ? (biz.threshold || 5) : 5;
  const stock = DB.getStock(bizId);
  const tbody = document.getElementById('mgr-stock-body');
  if (!stock.length) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">No stock items.</td></tr>'; return; }
  tbody.innerHTML = stock.map(s => {
    const low = Number(s.qty) <= Number(s.reorderLevel || threshold);
    return `<tr>
      <td><strong>${esc(s.name)}</strong></td>
      <td>${esc(s.sku || '—')}</td>
      <td>${s.qty} ${esc(s.unit)}</td>
      <td>${DB.fmtMoney(s.sellPrice, currency)}</td>
      <td>${s.reorderLevel || threshold}</td>
      <td><span class="pill ${low ? 'pill-low' : 'pill-ok'}">${low ? 'Low Stock' : 'OK'}</span></td>
    </tr>`;
  }).join('');
}

function renderMgrInvoices() {
  const bizId = CURRENT_USER.bizId;
  const currency = getCurrencyFor(bizId);
  const invoices = DB.getInvoices(bizId);
  const tbody = document.getElementById('mgr-invoices-body');
  if (!invoices.length) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">No invoices.</td></tr>'; return; }
  tbody.innerHTML = invoices.map(r => `
    <tr>
      <td><code>${esc(r.invoiceNo)}</code></td>
      <td>${esc(r.client)}</td>
      <td>${DB.fmt(r.date)}</td>
      <td><strong>${DB.fmtMoney(r.total, currency)}</strong></td>
      <td><span class="pill ${r.status === 'Paid' ? 'pill-paid' : 'pill-unpaid'}">${esc(r.status)}</span></td>
    </tr>
  `).join('');
}

function renderMgrAlerts() {
  const bizId = CURRENT_USER.bizId;
  const biz = DB.getBusiness(bizId);
  const threshold = biz ? (biz.threshold || 5) : 5;
  const stock = DB.getStock(bizId).filter(s => Number(s.qty) <= Number(s.reorderLevel || threshold));
  const feed = document.getElementById('mgr-alerts-feed');
  if (!stock.length) {
    feed.innerHTML = '<div style="color:var(--success)">✅ All stock levels are OK.</div>';
    return;
  }
  feed.innerHTML = stock.map(s => `
    <div class="alert-item">⚠️ <strong>${esc(s.name)}</strong> — only ${s.qty} ${esc(s.unit)} left (reorder at ${s.reorderLevel || threshold})</div>
  `).join('');
}

/* ══════════════════════════════════════════
   SALES PERSON DASHBOARD
══════════════════════════════════════════ */
function loadSalesDashboard() {
  showScreen('sales');
  const biz = DB.getBusiness(CURRENT_USER.bizId);
  document.getElementById('sales-biz-name').textContent = biz ? biz.name : '';
  document.getElementById('sp-user-info').textContent = `Logged in as ${CURRENT_USER.name}`;
  spTab('sp-stock', document.querySelector('[data-tab="sp-stock"]'));
}

function spTab(tabId, el) {
  document.querySelectorAll('#screen-sales .nav-item').forEach(n => n.classList.remove('active'));
  if (el) el.classList.add('active');
  document.querySelectorAll('#screen-sales .tab-panel').forEach(p => {
    p.classList.remove('active'); p.classList.add('hidden');
  });
  const panel = document.getElementById(`tab-${tabId}`);
  if (panel) { panel.classList.remove('hidden'); panel.classList.add('active'); }

  if (tabId === 'sp-stock') renderSpStock();
  if (tabId === 'sp-mysales') renderSpMySales();
}

function renderSpStock() {
  const bizId = CURRENT_USER.bizId;
  const currency = getCurrencyFor(bizId);
  const stock = DB.getStock(bizId);
  const tbody = document.getElementById('sp-stock-body');
  if (!stock.length) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">No stock items available.</td></tr>'; return; }
  tbody.innerHTML = stock.map(s => `
    <tr>
      <td><strong>${esc(s.name)}</strong></td>
      <td>${esc(s.category || '—')}</td>
      <td><span class="pill ${Number(s.qty) > 0 ? 'pill-ok' : 'pill-low'}">${s.qty} ${esc(s.unit)}</span></td>
      <td>${DB.fmtMoney(s.sellPrice, currency)}</td>
      <td>
        ${Number(s.qty) > 0
          ? `<button class="btn-primary small" onclick="openSaleModal('${s.id}')">Record Sale</button>`
          : `<span style="color:var(--danger);font-size:12px">Out of Stock</span>`
        }
      </td>
    </tr>
  `).join('');
}

function openSaleModal(itemId) {
  const bizId = CURRENT_USER.bizId;
  const item = DB.getStockItem(bizId, itemId);
  if (!item) return;

  _activeSaleItemId = itemId;
  document.getElementById('sale-item-info').innerHTML =
    `<strong>${esc(item.name)}</strong> &nbsp;|&nbsp; In Stock: ${item.qty} ${esc(item.unit)} &nbsp;|&nbsp; Default Price: ${DB.fmtMoney(item.sellPrice, getCurrencyFor(bizId))}`;
  document.getElementById('sale-qty').value = '';
  document.getElementById('sale-unit-price').value = item.sellPrice || '';
  document.getElementById('sale-total-display').textContent = 'Total: —';
  openModal('modal-record-sale');
}

function updateSaleTotal() {
  const qty = Number(document.getElementById('sale-qty').value || 0);
  const price = Number(document.getElementById('sale-unit-price').value || 0);
  const total = qty * price;
  const bizId = CURRENT_USER.bizId;
  document.getElementById('sale-total-display').textContent =
    total > 0 ? `Total: ${DB.fmtMoney(total, getCurrencyFor(bizId))}` : 'Total: —';
}

function recordSale() {
  const bizId = CURRENT_USER.bizId;
  const item = DB.getStockItem(bizId, _activeSaleItemId);
  if (!item) return;

  const qty = Number(document.getElementById('sale-qty').value);
  const unitPrice = Number(document.getElementById('sale-unit-price').value);
  const payment = document.getElementById('sale-payment').value;

  if (!qty || qty <= 0) return showToast('Enter a valid quantity.', 'error');
  if (!unitPrice || unitPrice <= 0) return showToast('Enter a valid price.', 'error');
  if (qty > Number(item.qty)) return showToast(`Only ${item.qty} ${item.unit} in stock.`, 'error');

  const total = qty * unitPrice;
  const saleRecord = {
    id: DB.uid(),
    itemId: item.id,
    itemName: item.name,
    qty, unitPrice, total, payment,
    recordedBy: CURRENT_USER.name,
    date: DB.today(),
    createdAt: DB.now()
  };

  DB.addSale(bizId, saleRecord);

  // Update stock
  DB.updateStockItem(bizId, item.id, { qty: Number(item.qty) - qty });

  // Notify owner
  DB.addNotification(bizId, {
    id: DB.uid(),
    icon: '🛒',
    message: `${CURRENT_USER.name} sold ${qty} × ${item.name} for ${DB.fmtMoney(total, getCurrencyFor(bizId))} (${payment})`,
    createdAt: DB.now(),
    read: false
  });

  closeModal('modal-record-sale');
  _activeSaleItemId = null;
  renderSpStock();
  showToast('Sale recorded!', 'success');
}

/* ── Restock (Sales Person) ── */
function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
  const today = DB.today();
  const modal = document.getElementById(id);
  modal.querySelectorAll('input[type=date]').forEach(el => { if (!el.value) el.value = today; });

  // Populate restock dropdown
  if (id === 'modal-restock') {
    const bizId = CURRENT_USER.bizId;
    const stock = DB.getStock(bizId);
    const sel = document.getElementById('restock-item-select');
    sel.innerHTML = stock.map(s => `<option value="${s.id}">${esc(s.name)} (${s.qty} ${esc(s.unit)})</option>`).join('');
  }
}

function recordRestock() {
  const bizId = CURRENT_USER.bizId;
  const itemId = document.getElementById('restock-item-select').value;
  const qty = Number(document.getElementById('restock-qty').value);
  const notes = document.getElementById('restock-notes').value.trim();

  if (!itemId) return showToast('Select an item.', 'error');
  if (!qty || qty <= 0) return showToast('Enter a valid quantity.', 'error');

  const item = DB.getStockItem(bizId, itemId);
  if (!item) return;

  const newQty = Number(item.qty) + qty;
  DB.updateStockItem(bizId, itemId, { qty: newQty });

  DB.addRestock(bizId, {
    id: DB.uid(), itemId, itemName: item.name, qty,
    notes, recordedBy: CURRENT_USER.name, createdAt: DB.now()
  });

  // Notify owner
  DB.addNotification(bizId, {
    id: DB.uid(),
    icon: '📦',
    message: `${CURRENT_USER.name} restocked ${qty} × ${item.name}. New total: ${newQty} ${item.unit}`,
    createdAt: DB.now(),
    read: false
  });

  closeModal('modal-restock');
  document.getElementById('restock-qty').value = '';
  document.getElementById('restock-notes').value = '';
  renderSpStock();
  showToast('Restock recorded!', 'success');
}

function renderSpMySales() {
  const bizId = CURRENT_USER.bizId;
  const currency = getCurrencyFor(bizId);
  const mySales = DB.getSales(bizId).filter(s => s.recordedBy === CURRENT_USER.name);
  const tbody = document.getElementById('sp-sales-body');
  if (!mySales.length) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">No sales recorded yet.</td></tr>'; return; }
  tbody.innerHTML = mySales.map(r => `
    <tr>
      <td>${DB.fmt(r.date)}</td>
      <td>${esc(r.itemName)}</td>
      <td>${r.qty}</td>
      <td>${DB.fmtMoney(r.unitPrice, currency)}</td>
      <td><strong>${DB.fmtMoney(r.total, currency)}</strong></td>
      <td>${esc(r.payment)}</td>
    </tr>
  `).join('');
}

/* ── Helpers ── */
function getCurrencyFor(bizId) {
  const biz = DB.getBusiness(bizId);
  return biz ? (biz.currency || 'KES') : 'KES';
}

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Poll for new notifications every 30s (while owner is logged in)
setInterval(() => {
  if (CURRENT_USER && CURRENT_USER.role === 'owner') updateNotifBadge();
}, 30000);
