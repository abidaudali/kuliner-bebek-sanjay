const express = require('express');
const router = express.Router();
const authService = require('../services/authService');
const excelService = require('../services/excelService');
const { authMiddleware, requireRole } = require('../services/authService');

// All user management routes require OWNER role
router.use(authMiddleware, requireRole(['OWNER']));

router.get('/', (req, res) => {
  try {
    const users = authService.getUsers().map(u => ({
      id: u.id,
      username: u.username,
      name: u.name,
      role: u.role,
      createdAt: u.createdAt
    }));
    res.json({ success: true, count: users.length, data: users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const user = authService.createUser(req.body);
    excelService.logAudit(req.user, 'TAMBAH_USER', 'USERS', `Menambahkan pengguna: ${user.username} (${user.role})`, null, user);
    res.status(201).json({ success: true, message: 'Pengguna berhasil dibuat.', data: user });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const updated = authService.updateUser(req.params.id, req.body);
    excelService.logAudit(req.user, 'UPDATE_USER', 'USERS', `Memperbarui pengguna ID ${req.params.id}`, null, updated);
    res.json({ success: true, message: 'Data pengguna berhasil diperbarui.', data: updated });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    authService.deleteUser(req.params.id);
    excelService.logAudit(req.user, 'HAPUS_USER', 'USERS', `Menghapus pengguna ID ${req.params.id}`);
    res.json({ success: true, message: 'Pengguna berhasil dihapus.' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
