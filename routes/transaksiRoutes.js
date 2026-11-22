const express = require('express');
const router = express.Router();
const excelService = require('../services/excelService');
const { authMiddleware, requireRole } = require('../services/authService');

// GET transactions history
router.get('/', (req, res) => {
  try {
    const list = excelService.getTransaksi(req.query);
    res.json({ success: true, count: list.length, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST new transaction (Kasir / Owner POS checkout)
router.post('/', authMiddleware, requireRole(['OWNER', 'KASIR']), async (req, res) => {
  try {
    const result = await excelService.processNewTransaction(req.body, req.user);
    res.status(201).json({
      success: true,
      message: 'Transaksi berhasil disimpan dan diintegrasikan ke workbook Excel.',
      data: result
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
