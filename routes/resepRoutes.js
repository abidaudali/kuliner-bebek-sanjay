const express = require('express');
const router = express.Router();
const dbService = require('../services/mysqlDataService');
const { authMiddleware, requireRole } = require('../services/authService');

router.get('/', async (req, res) => {
  try {
    const list = await dbService.getResep(req.query);
    res.json({ success: true, count: list.length, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', authMiddleware, requireRole(['OWNER']), async (req, res) => {
  try {
    const result = await dbService.addResep(req.body, req.user);
    res.status(201).json({ success: true, message: 'BOM resep berhasil ditambahkan.', data: result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.delete('/:kode_menu/:kode_bahan', authMiddleware, requireRole(['OWNER']), async (req, res) => {
  try {
    await dbService.deleteResep(req.params.kode_menu, req.params.kode_bahan, req.user);
    res.json({ success: true, message: 'BOM resep berhasil dihapus.' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
