const express = require('express');
const router = express.Router();
const dbService = require('../services/mysqlDataService');
const { authMiddleware, requireRole } = require('../services/authService');

router.get('/', async (req, res) => {
  try {
    const list = await dbService.getBahan(req.query);
    res.json({ success: true, count: list.length, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', authMiddleware, requireRole(['OWNER']), async (req, res) => {
  try {
    const result = await dbService.addBahan(req.body, req.user);
    res.status(201).json({ success: true, message: 'Bahan baku berhasil ditambahkan.', data: result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.put('/:kode', authMiddleware, requireRole(['OWNER']), async (req, res) => {
  try {
    const result = await dbService.updateBahan(req.params.kode, req.body, req.user);
    res.json({ success: true, message: 'Bahan baku berhasil diperbarui.', data: result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
