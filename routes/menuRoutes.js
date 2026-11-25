const express = require('express');
const router = express.Router();
const dbService = require('../services/mysqlDataService');
const { authMiddleware, requireRole } = require('../services/authService');

// GET all menu items
router.get('/', async (req, res) => {
  try {
    const list = await dbService.getMenu(req.query);
    res.json({ success: true, count: list.length, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST new menu (OWNER only)
router.post('/', authMiddleware, requireRole(['OWNER']), async (req, res) => {
  try {
    const result = await dbService.addMenu(req.body, req.user);
    res.status(201).json({ success: true, message: 'Menu berhasil ditambahkan.', data: result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// PUT update menu (OWNER only)
router.put('/:kode', authMiddleware, requireRole(['OWNER']), async (req, res) => {
  try {
    const result = await dbService.updateMenu(req.params.kode, req.body, req.user);
    res.json({ success: true, message: 'Menu berhasil diperbarui.', data: result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// DELETE menu (OWNER only)
router.delete('/:kode', authMiddleware, requireRole(['OWNER']), async (req, res) => {
  try {
    await dbService.deleteMenu(req.params.kode, req.user);
    res.json({ success: true, message: 'Menu berhasil dihapus.' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
