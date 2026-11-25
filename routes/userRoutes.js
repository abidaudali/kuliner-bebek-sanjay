const express = require('express');
const router = express.Router();
const authService = require('../services/authService');
const dbService = require('../services/mysqlDataService');
const { authMiddleware, requireRole } = require('../services/authService');

// All user management routes require OWNER role
router.use(authMiddleware, requireRole(['OWNER']));

router.get('/', async (req, res) => {
  try {
    const users = await authService.getUsers();
    res.json({ success: true, count: users.length, data: users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const user = await authService.createUser(req.body);
    await dbService.logAudit(null, req.user?.id, 'TAMBAH_USER', 'USERS', `Menambahkan pengguna: ${user.username} (${user.role})`);
    res.status(201).json({ success: true, message: 'Pengguna berhasil dibuat.', data: user });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const updated = await authService.updateUser(req.params.id, req.body);
    await dbService.logAudit(null, req.user?.id, 'UPDATE_USER', 'USERS', `Memperbarui pengguna ID ${req.params.id}`);
    res.json({ success: true, message: 'Data pengguna berhasil diperbarui.', data: updated });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await authService.deleteUser(req.params.id);
    await dbService.logAudit(null, req.user?.id, 'HAPUS_USER', 'USERS', `Menonaktifkan pengguna ID ${req.params.id}`);
    res.json({ success: true, message: 'Pengguna berhasil dihapus.' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
