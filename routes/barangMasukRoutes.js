const express = require('express');
const router = express.Router();
const excelService = require('../services/excelService');
const { authMiddleware, requireRole } = require('../services/authService');

router.get('/', (req, res) => {
  try {
    const list = excelService.getBarangMasuk(req.query);
    res.json({ success: true, count: list.length, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', authMiddleware, requireRole(['OWNER']), async (req, res) => {
  try {
    const result = await excelService.addBarangMasuk(req.body, req.user);
    res.status(201).json({ success: true, message: 'Barang masuk berhasil dicatat.', data: result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
