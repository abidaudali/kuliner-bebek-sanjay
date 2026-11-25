const express = require('express');
const router = express.Router();
const authService = require('../services/authService');

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username dan password wajib diisi.' });
    }

    const result = await authService.authenticate(username, password);
    if (!result) {
      return res.status(401).json({ success: false, message: 'Username atau password salah.' });
    }

    res.json({
      success: true,
      message: 'Login berhasil.',
      token: result.token,
      user: result.user
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/me', authService.authMiddleware, (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

module.exports = router;
