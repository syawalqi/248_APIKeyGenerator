const express = require('express');
const path = require('path');
const crypto = require('crypto'); // import crypto
const app = express();
const port = 3000;

// Middleware untuk parsing JSON
app.use(express.json());

// Menjadikan folder "public" sebagai static folder
app.use(express.static(path.join(__dirname, 'public')));

// Routing default ke index.html di folder public
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API POST /create untuk generate API key
app.post('/create', (req, res) => {
  const { appName } = req.body; // Ambil nama aplikasi dari body

  if (!appName) {
    return res.status(400).json({ error: 'Nama aplikasi diperlukan.' });
  }

  // Buat API key unik menggunakan crypto
  const randomBytes = crypto.randomBytes(16).toString('hex'); // random 32 karakter
  const timestamp = Date.now().toString(36);
  const apiKey = `API-${appName.toUpperCase()}-${randomBytes}-${timestamp}`;

  // (opsional) Simpan ke database kalau kamu punya, sekarang cuma kirim balik
  res.json({
    message: 'API Key berhasil dibuat!',
    appName,
    apiKey
  });
});

// Jalankan server
app.listen(port, () => {
  console.log(`Server berjalan di http://localhost:${port}`);
});
