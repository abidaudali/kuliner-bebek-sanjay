const express = require('express');
const router = express.Router();
const dbService = require('../services/mysqlDataService');
const { authMiddleware, requireRole } = require('../services/authService');

router.get('/', authMiddleware, requireRole(['OWNER']), async (req, res) => {
  try {
    const logs = await dbService.getAuditLogs();
    res.json({ success: true, count: logs.length, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
