const express = require('express');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// ⭐ ADDED: Token blacklist for logout
let tokenBlacklist = new Set();

const app = express();
const port = 3000;

// Middleware untuk parsing JSON
app.use(express.json());

// Static folder
app.use(express.static(path.join(__dirname, 'public')));

// Koneksi ke database
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'Gms041204#',
  database: 'apikey_db',
  port: 3309
});

// Cek koneksi database
db.connect(err => {
  if (err) {
    console.error('Gagal konek ke database:', err);
  } else {
    console.log('✅ Terhubung ke database MySQL');
  }
});


// ===================================================
// ⭐ MODIFIED: Middleware untuk verifikasi token admin + blacklist
// ===================================================
function verifyAdminToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token)
    return res.status(401).json({ error: "Token diperlukan." });

  // ⭐ ADDED: check blacklist
  if (tokenBlacklist.has(token)) {
    return res.status(403).json({ error: "Token telah logout/di-blacklist." });
  }

  jwt.verify(token, "SECRET_ADMIN", (err, admin) => {
    if (err)
      return res.status(403).json({ error: "Token tidak valid." });

    req.admin = admin;
    req.token = token; // ⭐ ADDED: save token for logout
    next();
  });
}


// Routing default ke index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ===================================================
// 1️⃣ CREATE USER + API KEY
// ===================================================
app.post('/create', (req, res) => {
  const { firstname, lastname, email, appName } = req.body;

  if (!firstname || !lastname || !email || !appName) {
    return res.status(400).json({ error: 'Semua field wajib diisi.' });
  }

  const insertUserQuery =
    'INSERT INTO user (firstname, lastname, email) VALUES (?, ?, ?)';

  db.query(insertUserQuery, [firstname, lastname, email], (err, userResult) => {
    if (err) {
      console.error('❌ Gagal insert user:', err);
      return res.status(500).json({ error: 'Gagal menyimpan data user.' });
    }
//test
    const iduser = userResult.insertId;

    const randomBytes = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now().toString(36);
    const apiKey = `API-${appName.toUpperCase()}-${randomBytes}-${timestamp}`;

    const insertApiQuery =
      'INSERT INTO api_keys (app_name, api_key, iduser, status) VALUES (?, ?, ?, ?)';

    db.query(insertApiQuery, [appName, apiKey, iduser, 'active'], (err2, apiResult) => {
      if (err2) {
        console.error('❌ Gagal insert API key:', err2);
        return res.status(500).json({ error: 'Gagal menyimpan API key.' });
      }

      res.json({
        message: 'API Key berhasil dibuat!',
        apiKey,
        user: { iduser, firstname, lastname, email }
      });
    });
  });
});

// ===================================================
// 2️⃣ VALIDATION ROUTE
// ===================================================
app.post('/validate', (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey) return res.status(400).json({ error: 'API key diperlukan.' });

  const query = 'SELECT * FROM api_keys WHERE api_key = ?';
  db.query(query, [apiKey], (err, results) => {
    if (err) return res.status(500).json({ error: 'Kesalahan server.' });
    if (results.length === 0) return res.status(401).json({ valid: false, message: 'API Key tidak valid.' });

    res.json({ valid: true, message: '✅ API Key valid.', data: results[0] });
  });
});


// ===================================================
// 3️⃣ REGISTER ADMIN
// ===================================================
app.post("/registeradmin", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: "Email dan password wajib diisi." });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const query = "INSERT INTO admin (email, password) VALUES (?, ?)";
    db.query(query, [email, hashedPassword], (err, result) => {
      if (err) {
        if (err.code === "ER_DUP_ENTRY") {
          return res.status(400).json({ error: "Email sudah terdaftar." });
        }
        return res.status(500).json({ error: "Kesalahan server." });
      }

      res.json({ message: "Admin berhasil dibuat!" });
    });
  } catch (err) {
    res.status(500).json({ error: "Kesalahan server." });
  }
});


// ===================================================
// 4️⃣ LOGIN ADMIN
// ===================================================
app.post("/loginadmin", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: "Email dan password wajib diisi." });

  const query = "SELECT * FROM admin WHERE email = ?";
  db.query(query, [email], async (err, results) => {
    if (err) return res.status(500).json({ error: "Kesalahan server." });

    if (results.length === 0)
      return res.status(401).json({ error: "Email tidak ditemukan." });

    const admin = results[0];
    const match = await bcrypt.compare(password, admin.password);

    if (!match)
      return res.status(401).json({ error: "Password salah." });

    const token = jwt.sign(
      { idadmin: admin.idadmin, email: admin.email },
      "SECRET_ADMIN",
      { expiresIn: "3h" }
    );

    res.json({
      message: "Login berhasil!",
      token,
      dashboard: "/admin/dashboard" // ⭐ ADDED
    });
  });
});


// ===================================================
// 5️⃣ ADMIN CHECK TOKEN
// ===================================================
app.get("/admin/me", verifyAdminToken, (req, res) => {
  res.json({
    message: "Token valid.",
    admin: req.admin
  });
});


// ===============================
// 6️⃣ ADMIN DASHBOARD PAGE (NEW)
// ===============================
app.get("/admin/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});


// ===============================================
// 7️⃣ GET ALL USERS + THEIR API KEYS (PROTECTED)
// ===============================================
app.get("/admin/users", verifyAdminToken, (req, res) => {
  const query = `
    SELECT 
      user.iduser, user.firstname, user.lastname, user.email,
      api_keys.api_key, api_keys.app_name, api_keys.created_at, api_keys.status
    FROM user
    LEFT JOIN api_keys ON api_keys.iduser = user.iduser
    ORDER BY user.iduser DESC
  `;

  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: "Kesalahan server." });

    res.json({ users: results });
  });
});


// ===================================================
// ⭐ NEW: 8️⃣ ADMIN LOGOUT (Blacklist Token)
// ===================================================
app.post("/admin/logout", verifyAdminToken, (req, res) => {
  tokenBlacklist.add(req.token); // add token to blacklist

  res.json({ message: "Logout berhasil. Token di-blacklist." });
});


// ===================================================
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Server berjalan di http://localhost:${port}`);
});
