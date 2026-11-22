const express = require('express');
const router = express.Router();
const excelService = require('../services/excelService');
const { authMiddleware, requireRole } = require('../services/authService');

router.get('/', authMiddleware, requireRole(['OWNER']), (req, res) => {
  try {
    const logs = excelService.getAuditLogs();
    res.json({ success: true, count: logs.length, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
