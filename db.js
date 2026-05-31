/* ═══════════════════════════════════════════
   ProBooks — Database Layer (localStorage)
   All data is stored per-business.
   Key naming: pb_{bizId}_{collection}
═══════════════════════════════════════════ */

const DB = {

  /* ── Core read/write ── */
  get(key) {
    try { return JSON.parse(localStorage.getItem(key)) || null; } catch { return null; }
  },
  set(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  },

  /* ══════════════════════════════════════
     SYSTEM (Admin-level, not per-business)
  ══════════════════════════════════════ */

  getAdmin() { return this.get('pb_admin'); },
  setAdmin(data) { this.set('pb_admin', data); },

  getBusinesses() { return this.get('pb_businesses') || []; },
  setBusinesses(list) { this.set('pb_businesses', list); },

  addBusiness(biz) {
    const list = this.getBusinesses();
    list.push(biz);
    this.setBusinesses(list);
  },

  getBusiness(bizId) {
    return this.getBusinesses().find(b => b.id === bizId) || null;
  },

  updateBusiness(bizId, updates) {
    const list = this.getBusinesses().map(b => b.id === bizId ? { ...b, ...updates } : b);
    this.setBusinesses(list);
  },

  /* All users across the system */
  getAllUsers() { return this.get('pb_users') || []; },
  setAllUsers(users) { this.set('pb_users', users); },

  addUser(user) {
    const users = this.getAllUsers();
    users.push(user);
    this.setAllUsers(users);
  },

  getUserByNameAndBiz(name, bizId) {
    return this.getAllUsers().find(u =>
      u.name.toLowerCase() === name.toLowerCase() && u.bizId === bizId
    ) || null;
  },

  getUsersByBiz(bizId) {
    return this.getAllUsers().filter(u => u.bizId === bizId);
  },

  updateUser(userId, updates) {
    const users = this.getAllUsers().map(u => u.id === userId ? { ...u, ...updates } : u);
    this.setAllUsers(users);
  },

  deleteUser(userId) {
    const users = this.getAllUsers().filter(u => u.id !== userId);
    this.setAllUsers(users);
  },

  /* ══════════════════════════════════════
     PER-BUSINESS DATA
  ══════════════════════════════════════ */

  /* — Income — */
  getIncome(bizId) { return this.get(`pb_${bizId}_income`) || []; },
  addIncome(bizId, record) {
    const list = this.getIncome(bizId);
    list.unshift(record);
    this.set(`pb_${bizId}_income`, list);
  },
  deleteIncome(bizId, id) {
    const list = this.getIncome(bizId).filter(r => r.id !== id);
    this.set(`pb_${bizId}_income`, list);
  },

  /* — Expenses — */
  getExpenses(bizId) { return this.get(`pb_${bizId}_expenses`) || []; },
  addExpense(bizId, record) {
    const list = this.getExpenses(bizId);
    list.unshift(record);
    this.set(`pb_${bizId}_expenses`, list);
  },
  deleteExpense(bizId, id) {
    const list = this.getExpenses(bizId).filter(r => r.id !== id);
    this.set(`pb_${bizId}_expenses`, list);
  },

  /* — Stock — */
  getStock(bizId) { return this.get(`pb_${bizId}_stock`) || []; },
  setStock(bizId, list) { this.set(`pb_${bizId}_stock`, list); },
  addStockItem(bizId, item) {
    const list = this.getStock(bizId);
    list.push(item);
    this.setStock(bizId, list);
  },
  getStockItem(bizId, itemId) {
    return this.getStock(bizId).find(s => s.id === itemId) || null;
  },
  updateStockItem(bizId, itemId, updates) {
    const list = this.getStock(bizId).map(s => s.id === itemId ? { ...s, ...updates } : s);
    this.setStock(bizId, list);
  },
  deleteStockItem(bizId, itemId) {
    const list = this.getStock(bizId).filter(s => s.id !== itemId);
    this.setStock(bizId, list);
  },

  /* — Sales — */
  getSales(bizId) { return this.get(`pb_${bizId}_sales`) || []; },
  addSale(bizId, record) {
    const list = this.getSales(bizId);
    list.unshift(record);
    this.set(`pb_${bizId}_sales`, list);
  },
  deleteSale(bizId, id) {
    const list = this.getSales(bizId).filter(r => r.id !== id);
    this.set(`pb_${bizId}_sales`, list);
  },

  /* — Restocks — */
  getRestocks(bizId) { return this.get(`pb_${bizId}_restocks`) || []; },
  addRestock(bizId, record) {
    const list = this.getRestocks(bizId);
    list.unshift(record);
    this.set(`pb_${bizId}_restocks`, list);
  },

  /* — Invoices — */
  getInvoices(bizId) { return this.get(`pb_${bizId}_invoices`) || []; },
  addInvoice(bizId, record) {
    const list = this.getInvoices(bizId);
    list.unshift(record);
    this.set(`pb_${bizId}_invoices`, list);
  },
  deleteInvoice(bizId, id) {
    const list = this.getInvoices(bizId).filter(r => r.id !== id);
    this.set(`pb_${bizId}_invoices`, list);
  },
  updateInvoice(bizId, id, updates) {
    const list = this.getInvoices(bizId).map(r => r.id === id ? { ...r, ...updates } : r);
    this.set(`pb_${bizId}_invoices`, list);
  },

  /* — Notifications (per biz, shown to owner) — */
  getNotifications(bizId) { return this.get(`pb_${bizId}_notifs`) || []; },
  addNotification(bizId, notif) {
    const list = this.getNotifications(bizId);
    list.unshift(notif);
    // Keep max 100
    if (list.length > 100) list.pop();
    this.set(`pb_${bizId}_notifs`, list);
  },
  markNotifsRead(bizId) {
    const list = this.getNotifications(bizId).map(n => ({ ...n, read: true }));
    this.set(`pb_${bizId}_notifs`, list);
  },
  clearNotifications(bizId) {
    this.set(`pb_${bizId}_notifs`, []);
  },

  /* — Business Settings — */
  getBizSettings(bizId) {
    const biz = this.getBusiness(bizId);
    return biz || {};
  },

  /* ── Helpers ── */
  uid() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  },

  today() {
    return new Date().toISOString().split('T')[0];
  },

  now() {
    return new Date().toISOString();
  },

  fmt(dateStr) {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-KE', {
        day: '2-digit', month: 'short', year: 'numeric'
      });
    } catch { return dateStr; }
  },

  fmtMoney(amount, currency) {
    const sym = { KES:'KES', USD:'$', UGX:'UGX', TZS:'TZS', ZAR:'R', GBP:'£', EUR:'€', NGN:'₦' };
    const s = sym[currency] || currency || 'KES';
    return `${s} ${Number(amount || 0).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  },

  fmtTime(isoStr) {
    if (!isoStr) return '';
    try {
      return new Date(isoStr).toLocaleString('en-KE', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch { return isoStr; }
  }
};
