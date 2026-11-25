const express = require('express');
const router = express.Router();
const dbService = require('../services/mysqlDataService');
const { authMiddleware, requireRole } = require('../services/authService');

// GET active kitchen queue (DAPUR / OWNER / KASIR)
router.get('/queue', authMiddleware, requireRole(['DAPUR', 'OWNER', 'KASIR']), async (req, res) => {
  try {
    const active = await dbService.getKitchenQueue();
    res.json({ success: true, count: active.length, data: active });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT update status pesanan (DAPUR / OWNER)
// Status flow: menunggu_proses -> diproses -> siap -> selesai
router.put('/status/:id_transaksi', authMiddleware, requireRole(['DAPUR', 'OWNER']), async (req, res) => {
  try {
    const { status_pesanan } = req.body;
    if (!status_pesanan) {
      return res.status(400).json({ success: false, message: 'Status pesanan wajib diisi.' });
    }

    const updated = await dbService.updateKitchenStatus(req.params.id_transaksi, status_pesanan, req.user);
    res.json({
      success: true,
      message: `Status pesanan ${req.params.id_transaksi} diperbarui menjadi ${status_pesanan}.`,
      data: updated
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
