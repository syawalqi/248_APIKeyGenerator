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
  user: 'root',        // ubah sesuai user MySQL kamu
  password: 'Gms041204#',        // ubah sesuai password MySQL kamu
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

// ======== 1️⃣ CREATE API KEY ========
app.post('/create', (req, res) => {
  const { appName } = req.body;
  if (!appName) {
    return res.status(400).json({ error: 'Nama aplikasi diperlukan.' });
  }

  const randomBytes = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now().toString(36);
  const apiKey = `API-${appName.toUpperCase()}-${randomBytes}-${timestamp}`;

  // Simpan ke database
  const query = 'INSERT INTO api_keys (app_name, api_key) VALUES (?, ?)';
  db.query(query, [appName, apiKey], (err, result) => {
    if (err) {
      console.error('Error menyimpan API key:', err);
      return res.status(500).json({ error: 'Gagal menyimpan API key ke database.' });
    }
    res.json({
      message: 'API Key berhasil dibuat dan disimpan!',
      appName,
      apiKey
    });
  });
});

// ======== 2️⃣ VALIDASI API KEY ========
app.post('/validate', (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey) {
    return res.status(400).json({ error: 'API key diperlukan.' });
  }

  const query = 'SELECT * FROM api_keys WHERE api_key = ?';
  db.query(query, [apiKey], (err, results) => {
    if (err) {
      console.error('Error validasi:', err);
      return res.status(500).json({ error: 'Terjadi kesalahan server.' });
    }

    if (results.length === 0) {
      return res.status(401).json({ valid: false, message: 'API Key tidak valid.' });
    }

    res.json({ valid: true, message: 'API Key valid.', data: results[0] });
  });
});

// Jalankan server
app.listen(port, () => {
  console.log(`🚀 Server berjalan di http://localhost:${port}`);
});
