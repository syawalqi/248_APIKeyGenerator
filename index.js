const express = require('express');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2');
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

// Routing default ke index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ===================================================
// 1️⃣ CREATE USER + API KEY (UPDATED)
// ===================================================
app.post('/create', (req, res) => {
  const { firstname, lastname, email, appName } = req.body;

  if (!firstname || !lastname || !email || !appName) {
    return res.status(400).json({ error: 'Semua field wajib diisi.' });
  }

  // Langkah 1: Insert user dulu
  const insertUserQuery =
    'INSERT INTO user (firstname, lastname, email) VALUES (?, ?, ?)';

  db.query(insertUserQuery, [firstname, lastname, email], (err, userResult) => {
    if (err) {
      console.error('❌ Gagal insert user:', err);
      return res.status(500).json({ error: 'Gagal menyimpan data user.' });
    }

    const iduser = userResult.insertId; // ambil iduser baru

    // Langkah 2: generate API key
    const randomBytes = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now().toString(36);
    const apiKey = `API-${appName.toUpperCase()}-${randomBytes}-${timestamp}`;

    // Langkah 3: simpan API key ke tabel api_keys
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
// 2️⃣ VALIDATION ROUTE (Tetap sama)
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
app.listen(port, () => {
  console.log(`🚀 Server berjalan di http://localhost:${port}`);
});
