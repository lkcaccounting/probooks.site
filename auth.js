/* ═══════════════════════════════════════════
   ProBooks — Authentication
═══════════════════════════════════════════ */

let CURRENT_USER = null; // { id, name, role, bizId, password }

/* Simple hash — good enough for localStorage app */
function hashPass(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(36);
}

/* ── Boot: decide which screen to show ── */
function boot() {
  const admin = DB.getAdmin();
  if (!admin) {
    showScreen('admin-setup');
    return;
  }
  showScreen('login');
}

/* ── Admin First-Time Setup ── */
function adminSetup() {
  const name = document.getElementById('admin-name-setup').value.trim();
  const pass = document.getElementById('admin-pass-setup').value;
  const confirm = document.getElementById('admin-pass-confirm').value;
  const err = document.getElementById('admin-setup-error');

  if (!name) return showError(err, 'Please enter your name.');
  if (pass.length < 6) return showError(err, 'Password must be at least 6 characters.');
  if (pass !== confirm) return showError(err, 'Passwords do not match.');

  DB.setAdmin({ name, password: hashPass(pass) });
  err.classList.add('hidden');
  showScreen('login');
  showToast('System activated. Please sign in.', 'success');
}

/* ── Login ── */
function login() {
  const name = document.getElementById('login-name').value.trim();
  const pass = document.getElementById('login-pass').value;
  const err = document.getElementById('login-error');

  if (!name || !pass) return showError(err, 'Please enter your name and password.');

  const hashed = hashPass(pass);

  // Check if admin
  const admin = DB.getAdmin();
  if (admin && admin.name.toLowerCase() === name.toLowerCase() && admin.password === hashed) {
    CURRENT_USER = { id: 'admin', name: admin.name, role: 'admin', bizId: null };
    err.classList.add('hidden');
    loadAdminDashboard();
    return;
  }

  // Check business owners
  const businesses = DB.getBusinesses();
  const ownerBiz = businesses.find(b =>
    b.ownerName.toLowerCase() === name.toLowerCase() && b.ownerPassword === hashed
  );
  if (ownerBiz) {
    CURRENT_USER = { id: `owner_${ownerBiz.id}`, name: ownerBiz.ownerName, role: 'owner', bizId: ownerBiz.id };
    err.classList.add('hidden');
    loadOwnerDashboard();
    return;
  }

  // Check managers and sales persons
  const users = DB.getAllUsers();
  const user = users.find(u =>
    u.name.toLowerCase() === name.toLowerCase() && u.password === hashed
  );
  if (user) {
    CURRENT_USER = { ...user };
    err.classList.add('hidden');
    if (user.role === 'manager') {
      loadManagerDashboard();
    } else if (user.role === 'salesperson') {
      loadSalesDashboard();
    }
    return;
  }

  showError(err, 'Incorrect name or password.');
}

/* ── Logout ── */
function logout() {
  CURRENT_USER = null;
  document.getElementById('login-name').value = '';
  document.getElementById('login-pass').value = '';
  showScreen('login');
}

/* ── Change own password (owner / manager / salesperson) ── */
function changeOwnPassword(role) {
  const currEl = document.getElementById(`${role}-curr-pass`);
  const newEl = document.getElementById(`${role}-new-pass`);
  const new2El = document.getElementById(`${role}-new-pass2`);
  const msgEl = document.getElementById(`${role}-pass-msg`);

  const curr = currEl.value;
  const nw = newEl.value;
  const nw2 = new2El.value;

  if (!curr || !nw || !nw2) return showMsg(msgEl, 'Fill all fields.', 'error');
  if (nw.length < 6) return showMsg(msgEl, 'New password must be at least 6 characters.', 'error');
  if (nw !== nw2) return showMsg(msgEl, 'New passwords do not match.', 'error');

  const hashed = hashPass(curr);

  if (CURRENT_USER.role === 'owner') {
    const biz = DB.getBusiness(CURRENT_USER.bizId);
    if (!biz || biz.ownerPassword !== hashed) return showMsg(msgEl, 'Current password is incorrect.', 'error');
    DB.updateBusiness(CURRENT_USER.bizId, { ownerPassword: hashPass(nw) });
  } else {
    if (CURRENT_USER.password !== hashed) return showMsg(msgEl, 'Current password is incorrect.', 'error');
    DB.updateUser(CURRENT_USER.id, { password: hashPass(nw) });
    CURRENT_USER.password = hashPass(nw);
  }

  currEl.value = ''; newEl.value = ''; new2El.value = '';
  showMsg(msgEl, 'Password updated successfully!', 'success');
}

/* ── Change Admin Password ── */
function changeAdminPassword() {
  const curr = document.getElementById('admin-curr-pass').value;
  const nw = document.getElementById('admin-new-pass').value;
  const nw2 = document.getElementById('admin-new-pass2').value;
  const msgEl = document.getElementById('admin-pass-msg');

  const admin = DB.getAdmin();
  if (hashPass(curr) !== admin.password) return showMsg(msgEl, 'Current password is wrong.', 'error');
  if (nw.length < 6) return showMsg(msgEl, 'Password must be at least 6 chars.', 'error');
  if (nw !== nw2) return showMsg(msgEl, 'Passwords do not match.', 'error');

  DB.setAdmin({ ...admin, password: hashPass(nw) });
  document.getElementById('admin-curr-pass').value = '';
  document.getElementById('admin-new-pass').value = '';
  document.getElementById('admin-new-pass2').value = '';
  showMsg(msgEl, 'Password updated!', 'success');
}

/* ── UI helpers ── */
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(`screen-${name}`).classList.remove('hidden');
}

function showError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
}

function showMsg(el, msg, type) {
  el.textContent = msg;
  el.className = `msg-box ${type}`;
  el.classList.remove('hidden');
}

function showToast(msg, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3500);
}

/* ── Enter key on login ── */
document.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    if (!document.getElementById('screen-login').classList.contains('hidden')) login();
    if (!document.getElementById('screen-admin-setup').classList.contains('hidden')) adminSetup();
  }
});

/* ── Boot on load ── */
window.addEventListener('load', boot);
