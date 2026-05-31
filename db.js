// ============================================================
// db.js — All Firestore database operations
// ============================================================

// ---- TRANSACTIONS (Income / Expense / Sale) ----

async function addTransaction(businessId, data) {
  const docRef = await db.collection("businesses").doc(businessId)
    .collection("transactions").add({
      ...data,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

  // Notify owner if it's a sale by staff
  if (data.type === "sale" && data.recordedBy && data.recordedByRole !== "owner") {
    await addNotification(businessId, {
      message: `${data.recordedBy} recorded a ${data.currency || "KES"} ${Number(data.amount).toLocaleString()} sale via ${data.paymentMethod}.`,
      type: "sale",
      read: false
    });
  }

  return docRef.id;
}

async function getTransactions(businessId, filters = {}) {
  let query = db.collection("businesses").doc(businessId).collection("transactions");
  if (filters.type) query = query.where("type", "==", filters.type);
  if (filters.startDate) query = query.where("date", ">=", filters.startDate);
  if (filters.endDate) query = query.where("date", "<=", filters.endDate);
  query = query.orderBy("date", "desc");
  const snap = await query.get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function deleteTransaction(businessId, transactionId) {
  await db.collection("businesses").doc(businessId)
    .collection("transactions").doc(transactionId).delete();
}

async function updateTransaction(businessId, transactionId, data) {
  await db.collection("businesses").doc(businessId)
    .collection("transactions").doc(transactionId).update(data);
}

// ---- STOCK ----

async function addStockItem(businessId, item) {
  return await db.collection("businesses").doc(businessId)
    .collection("stock").add({
      ...item,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}

async function getStockItems(businessId) {
  const snap = await db.collection("businesses").doc(businessId)
    .collection("stock").orderBy("name").get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function updateStockItem(businessId, itemId, data) {
  await db.collection("businesses").doc(businessId)
    .collection("stock").doc(itemId).update(data);
}

async function deleteStockItem(businessId, itemId) {
  await db.collection("businesses").doc(businessId)
    .collection("stock").doc(itemId).delete();
}

async function recordSale(businessId, itemId, quantitySold, salePrice, paymentMethod, recordedBy, recordedByRole, currency) {
  const itemRef = db.collection("businesses").doc(businessId).collection("stock").doc(itemId);
  const item = (await itemRef.get()).data();
  if (!item) throw new Error("Item not found.");
  if (item.quantity < quantitySold) throw new Error("Not enough stock.");

  const totalAmount = quantitySold * salePrice;
  const today = new Date().toISOString().split("T")[0];

  await itemRef.update({ quantity: firebase.firestore.FieldValue.increment(-quantitySold) });

  await addTransaction(businessId, {
    type: "sale",
    itemName: item.name,
    itemId,
    quantity: quantitySold,
    salePrice,
    amount: totalAmount,
    paymentMethod,
    date: today,
    recordedBy,
    recordedByRole,
    currency: currency || "KES"
  });

  // Low stock alert
  const updatedItem = (await itemRef.get()).data();
  if (updatedItem.quantity <= (item.reorderLevel || 5)) {
    await addNotification(businessId, {
      message: `Low stock alert: ${item.name} has only ${updatedItem.quantity} units left.`,
      type: "lowstock",
      read: false
    });
  }
}

async function recordRestock(businessId, itemId, quantity, cost, paymentMethod, recordedBy, currency) {
  const itemRef = db.collection("businesses").doc(businessId).collection("stock").doc(itemId);
  const item = (await itemRef.get()).data();
  if (!item) throw new Error("Item not found.");

  const today = new Date().toISOString().split("T")[0];
  await itemRef.update({ quantity: firebase.firestore.FieldValue.increment(quantity) });

  await addTransaction(businessId, {
    type: "restock",
    itemName: item.name,
    itemId,
    quantity,
    amount: cost,
    paymentMethod,
    date: today,
    recordedBy,
    currency: currency || "KES"
  });
}

// ---- INVOICES ----

async function addInvoice(businessId, invoice) {
  return await db.collection("businesses").doc(businessId)
    .collection("invoices").add({
      ...invoice,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}

async function getInvoices(businessId) {
  const snap = await db.collection("businesses").doc(businessId)
    .collection("invoices").orderBy("createdAt", "desc").get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function updateInvoice(businessId, invoiceId, data) {
  await db.collection("businesses").doc(businessId)
    .collection("invoices").doc(invoiceId).update(data);
}

async function deleteInvoice(businessId, invoiceId) {
  await db.collection("businesses").doc(businessId)
    .collection("invoices").doc(invoiceId).delete();
}

// ---- NOTIFICATIONS ----

async function addNotification(businessId, notif) {
  await db.collection("businesses").doc(businessId)
    .collection("notifications").add({
      ...notif,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}

async function getNotifications(businessId, unreadOnly = false) {
  let query = db.collection("businesses").doc(businessId)
    .collection("notifications").orderBy("createdAt", "desc").limit(50);
  if (unreadOnly) query = query.where("read", "==", false);
  const snap = await query.get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function markNotificationRead(businessId, notifId) {
  await db.collection("businesses").doc(businessId)
    .collection("notifications").doc(notifId).update({ read: true });
}

async function markAllNotificationsRead(businessId) {
  const snap = await db.collection("businesses").doc(businessId)
    .collection("notifications").where("read", "==", false).get();
  const batch = db.batch();
  snap.docs.forEach(d => batch.update(d.ref, { read: true }));
  await batch.commit();
}

// ---- BUSINESS SETTINGS ----

async function getBusinessSettings(businessId) {
  const doc = await db.collection("businesses").doc(businessId).get();
  return doc.exists ? doc.data() : null;
}

async function updateBusinessSettings(businessId, data) {
  await db.collection("businesses").doc(businessId).update(data);
}

// ---- SUMMARY HELPERS ----

async function getSummary(businessId, period = "month") {
  const now = new Date();
  let startDate;
  if (period === "month") {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  } else if (period === "year") {
    startDate = new Date(now.getFullYear(), 0, 1).toISOString().split("T")[0];
  } else {
    startDate = "2000-01-01";
  }

  const transactions = await getTransactions(businessId, { startDate });
  let income = 0, expenses = 0, salesCount = 0;

  transactions.forEach(t => {
    if (t.type === "sale") { income += Number(t.amount || 0); salesCount++; }
    else if (t.type === "expense" || t.type === "restock") { expenses += Number(t.amount || 0); }
    else if (t.type === "income") { income += Number(t.amount || 0); }
  });

  return { income, expenses, profit: income - expenses, salesCount, transactions };
}
