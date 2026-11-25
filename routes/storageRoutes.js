const express = require('express');
const router = express.Router();
const storageService = require('../services/storageService');
const dbService = require('../services/mysqlDataService');
const { generateExcelWorkbook } = require('../services/excelExportService');
const { authMiddleware, requireRole } = require('../services/authService');

// Storage status (OWNER only)
router.get('/status', authMiddleware, requireRole(['OWNER']), async (req, res) => {
  try {
    const status = await storageService.getStorageStatus();
    res.json({ success: true, data: { ...status, primaryDatabase: 'MySQL (InnoDB)' } });
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
    await dbService.logAudit(null, req.user?.id, 'CREATE_BACKUP', 'STORAGE', `Membuat backup manual: ${result.filename}`);
    res.json({ success: true, message: 'Backup manual berhasil dibuat.', data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Export dynamic Excel workbook generated directly from MySQL
router.get('/download', authMiddleware, requireRole(['OWNER']), async (req, res) => {
  try {
    const wb = await generateExcelWorkbook();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Dataset_Bebek_Sanjay_Gowa_Export_MySQL.xlsx"');
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Error generating export:', err);
    res.status(500).json({ success: false, message: 'Gagal mengekspor data: ' + err.message });
  }
});

module.exports = router;
