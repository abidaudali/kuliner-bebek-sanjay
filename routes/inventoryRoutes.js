const express = require('express');
const router = express.Router();
const dbService = require('../services/mysqlDataService');
const { authMiddleware, requireRole } = require('../services/authService');

router.use(authMiddleware);

// Pemakaian Detail (OWNER)
router.get('/pemakaian-detail', requireRole(['OWNER']), async (req, res) => {
  try {
    const list = await dbService.getPemakaianDetail(req.query);
    res.json({ success: true, count: list.length, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Pemakaian Harian (OWNER)
router.get('/pemakaian-harian', requireRole(['OWNER']), async (req, res) => {
  try {
    const list = await dbService.getPemakaianHarian(req.query);
    res.json({ success: true, count: list.length, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Kartu Stok Harian (OWNER)
router.get('/kartu-stok', requireRole(['OWNER']), async (req, res) => {
  try {
    const list = await dbService.getKartuStok(req.query);
    res.json({ success: true, count: list.length, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Safety Stock & Reorder Point (OWNER)
router.get('/ss-rop', requireRole(['OWNER']), async (req, res) => {
  try {
    const list = await dbService.getSsRop(req.query);
    res.json({ success: true, count: list.length, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
