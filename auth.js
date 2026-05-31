// ============================================================
// auth.js — Authentication & Session Management
// ============================================================

const ADMIN_PASSWORD_KEY = "pb_admin_pwd_hash";
const SESSION_KEY = "pb_session";

// Simple hash (not cryptographic — for obfuscation only)
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash.toString();
}

// ---- Admin Setup ----
function isAdminSetup() {
  return !!localStorage.getItem(ADMIN_PASSWORD_KEY);
}

function setAdminPassword(password) {
  localStorage.setItem(ADMIN_PASSWORD_KEY, hashString(password));
}

function verifyAdminPassword(password) {
  return localStorage.getItem(ADMIN_PASSWORD_KEY) === hashString(password);
}

// ---- Session ----
function setSession(user) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

function getSession() {
  const s = sessionStorage.getItem(SESSION_KEY);
  return s ? JSON.parse(s) : null;
}

function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

function requireAuth(allowedRoles) {
  const user = getSession();
  if (!user) {
    window.location.href = "/login.html";
    return null;
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    window.location.href = "/login.html";
    return null;
  }
  return user;
}

// ---- User login against Firestore ----
async function loginUser(businessId, name, password) {
  try {
    const snap = await db.collection("businesses").doc(businessId)
      .collection("users")
      .where("name", "==", name.trim())
      .where("passwordHash", "==", hashString(password))
      .get();

    if (snap.empty) return { success: false, error: "Invalid name or password." };

    const userData = snap.docs[0].data();
    const user = {
      id: snap.docs[0].id,
      name: userData.name,
      role: userData.role,
      businessId: businessId,
      businessName: userData.businessName || ""
    };
    setSession(user);
    return { success: true, user };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ---- Get all businesses (for login dropdown) ----
async function getBusinesses() {
  try {
    const snap = await db.collection("businesses").get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    return [];
  }
}

// ---- Create user ----
async function createUser(businessId, name, password, role) {
  const existing = await db.collection("businesses").doc(businessId)
    .collection("users")
    .where("name", "==", name.trim()).get();
  if (!existing.empty) throw new Error("A user with that name already exists.");

  await db.collection("businesses").doc(businessId).collection("users").add({
    name: name.trim(),
    passwordHash: hashString(password),
    role: role,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

// ---- Delete user ----
async function deleteUser(businessId, userId) {
  await db.collection("businesses").doc(businessId).collection("users").doc(userId).delete();
}

// ---- Fetch users for a business ----
async function getUsers(businessId) {
  const snap = await db.collection("businesses").doc(businessId).collection("users").get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
