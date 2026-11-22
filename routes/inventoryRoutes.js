const express = require('express');
const router = express.Router();
const excelService = require('../services/excelService');

// Pemakaian Detail
router.get('/pemakaian-detail', (req, res) => {
  try {
    const list = excelService.getPemakaianDetail(req.query);
    res.json({ success: true, count: list.length, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Pemakaian Harian
router.get('/pemakaian-harian', (req, res) => {
  try {
    const list = excelService.getPemakaianHarian(req.query);
    res.json({ success: true, count: list.length, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Kartu Stok Harian
router.get('/kartu-stok', (req, res) => {
  try {
    const list = excelService.getKartuStok(req.query);
    res.json({ success: true, count: list.length, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Safety Stock & Reorder Point
router.get('/ss-rop', (req, res) => {
  try {
    const list = excelService.getSsRop(req.query);
    res.json({ success: true, count: list.length, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
