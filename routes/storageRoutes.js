const express = require('express');
const router = express.Router();
const path = require('path');
const storageService = require('../services/storageService');
const excelService = require('../services/excelService');
const { authMiddleware, requireRole } = require('../services/authService');

// Storage status (OWNER only)
router.get('/status', authMiddleware, requireRole(['OWNER']), async (req, res) => {
  try {
    const status = await storageService.getStorageStatus();
    res.json({ success: true, data: status });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// List backups (OWNER only)
router.get('/backups', authMiddleware, requireRole(['OWNER']), async (req, res) => {
  try {
    const backups = await storageService.listBackups();
    res.json({ success: true, count: backups.length, data: backups });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Create manual backup (OWNER only)
router.post('/backups', authMiddleware, requireRole(['OWNER']), async (req, res) => {
  try {
    const result = await storageService.createBackup('manual');
    excelService.logAudit(req.user, 'CREATE_BACKUP', 'STORAGE', `Membuat backup manual: ${result.filename}`);
    res.json({ success: true, message: 'Backup manual berhasil dibuat.', data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Restore backup (OWNER only)
router.post('/restore', authMiddleware, requireRole(['OWNER']), async (req, res) => {
  try {
    const { filename } = req.body;
    if (!filename) return res.status(400).json({ success: false, message: 'Nama file backup diperlukan.' });

    await storageService.restoreBackup(filename);
    await excelService.loadWorkbook(); // Reload parsed data from restored workbook

    excelService.logAudit(req.user, 'RESTORE_BACKUP', 'STORAGE', `Merestore workbook dari backup: ${filename}`);
    res.json({ success: true, message: `Workbook berhasil dipulihkan dari ${filename}.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Export / download current workbook
router.get('/download', authMiddleware, requireRole(['OWNER']), (req, res) => {
  const filePath = storageService.getWorkbookPath();
  res.download(filePath, 'Dataset_Bebek_Sanjay_Gowa_Aktual.xlsx');
});

// Sync to cloud
router.post('/sync', authMiddleware, requireRole(['OWNER']), async (req, res) => {
  try {
    const result = await storageService.syncToCloud();
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
