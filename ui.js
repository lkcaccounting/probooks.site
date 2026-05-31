// ============================================================
// ui.js — Shared UI helpers used across all pages
// ============================================================

function formatCurrency(amount, currency = "KES") {
  return `${currency} ${Number(amount || 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" });
}

function timeAgo(ts) {
  if (!ts) return "";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function showToast(msg, type = "success") {
  const t = document.createElement("div");
  t.style.cssText = `
    position:fixed; bottom:24px; right:24px; z-index:9999;
    background:${type === "success" ? "#10b981" : "#ef4444"};
    color:white; padding:12px 20px; border-radius:10px;
    font-size:13px; font-weight:600; box-shadow:0 4px 20px rgba(0,0,0,0.4);
    animation: fadeInUp 0.3s ease;
  `;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// Build sidebar HTML based on role
function buildSidebar(user) {
  const roleColor = { owner: "owner", manager: "manager", sales: "sales" }[user.role] || "sales";
  const initial = user.name.charAt(0).toUpperCase();

  let nav = "";

  if (user.role === "owner") {
    nav = `
      <div class="nav-section">Overview</div>
      <a class="nav-link" href="owner.html" data-page="dashboard"><span class="icon">🏠</span> Dashboard</a>
      <div class="nav-section">Finance</div>
      <a class="nav-link" href="income.html" data-page="income"><span class="icon">💰</span> Income</a>
      <a class="nav-link" href="expenses.html" data-page="expenses"><span class="icon">💸</span> Expenses</a>
      <a class="nav-link" href="pnl.html" data-page="pnl"><span class="icon">📊</span> Profit & Loss</a>
      <div class="nav-section">Operations</div>
      <a class="nav-link" href="stock.html" data-page="stock"><span class="icon">📦</span> Stock / Inventory</a>
      <a class="nav-link" href="invoices.html" data-page="invoices"><span class="icon">🧾</span> Invoices</a>
      <a class="nav-link" href="reports.html" data-page="reports"><span class="icon">📈</span> Reports</a>
      <div class="nav-section">Team</div>
      <a class="nav-link" href="users.html" data-page="users"><span class="icon">👥</span> Users</a>
      <a class="nav-link" href="notifications.html" data-page="notifications"><span class="icon">🔔</span> Notifications</a>
      <div class="nav-section">AI</div>
      <a class="nav-link" href="ai.html" data-page="ai"><span class="icon">🤖</span> AI Accountant</a>
      <div class="nav-section">Settings</div>
      <a class="nav-link" href="settings.html" data-page="settings"><span class="icon">⚙️</span> Settings</a>
    `;
  } else if (user.role === "manager") {
    nav = `
      <div class="nav-section">Overview</div>
      <a class="nav-link" href="manager.html" data-page="dashboard"><span class="icon">🏠</span> Dashboard</a>
      <div class="nav-section">Reports</div>
      <a class="nav-link" href="sales-report.html" data-page="sales-report"><span class="icon">📊</span> Sales Reports</a>
      <a class="nav-link" href="stock-report.html" data-page="stock-report"><span class="icon">📦</span> Stock Report</a>
      <a class="nav-link" href="invoice-report.html" data-page="invoice-report"><span class="icon">🧾</span> Invoice Report</a>
      <a class="nav-link" href="low-stock.html" data-page="low-stock"><span class="icon">⚠️</span> Low Stock Alerts</a>
    `;
  } else {
    // sales
    nav = `
      <div class="nav-section">Operations</div>
      <a class="nav-link" href="sales.html" data-page="dashboard"><span class="icon">🏠</span> Dashboard</a>
      <a class="nav-link" href="record-sale.html" data-page="record-sale"><span class="icon">💵</span> Record Sale</a>
      <a class="nav-link" href="restock.html" data-page="restock"><span class="icon">📥</span> Record Restock</a>
      <a class="nav-link" href="my-stock.html" data-page="my-stock"><span class="icon">📦</span> View Stock</a>
    `;
  }

  return `
    <div class="sidebar" id="sidebar">
      <div class="sidebar-logo">
        <h1>ProBooks</h1>
        <p>${user.businessName || "ProBooks"}</p>
      </div>
      <div class="sidebar-user">
        <div class="avatar ${roleColor}">${initial}</div>
        <div class="sidebar-user-info">
          <strong>${user.name}</strong>
          <span>${user.role}</span>
        </div>
      </div>
      <nav class="sidebar-nav">${nav}</nav>
      <div class="sidebar-footer">
        <button class="btn-logout" onclick="logout()">🔒 Sign Out</button>
      </div>
    </div>
  `;
}

function highlightCurrentPage() {
  const path = window.location.pathname.split("/").pop().replace(".html", "");
  document.querySelectorAll(".nav-link").forEach(link => {
    const page = link.dataset.page;
    if (page === path || link.href.endsWith(path + ".html")) {
      link.classList.add("active");
    }
  });
}

function logout() {
  clearSession();
  window.location.href = "../login.html";
}

// Notification badge loader
async function loadNotifBadge(bizId) {
  try {
    const unread = await getNotifications(bizId, true);
    const badge = document.getElementById("notif-badge");
    if (badge) {
      badge.textContent = unread.length;
      badge.style.display = unread.length > 0 ? "flex" : "none";
    }
  } catch (e) {}
}

// Toggle sidebar (mobile)
function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
}

// Close sidebar when clicking outside
document.addEventListener("click", e => {
  const sidebar = document.getElementById("sidebar");
  if (sidebar && !sidebar.contains(e.target) &&
      !e.target.classList.contains("hamburger")) {
    sidebar.classList.remove("open");
  }
});
