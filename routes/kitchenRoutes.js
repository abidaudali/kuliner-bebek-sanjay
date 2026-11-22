const express = require('express');
const router = express.Router();
const excelService = require('../services/excelService');
const { authMiddleware, requireRole } = require('../services/authService');

// In-memory kitchen order status tracker linked to transactions
// Status flow: menunggu_proses -> diproses -> siap -> selesai
let kitchenOrders = [];

// Initialize kitchenOrders from recent transactions
function syncKitchenOrders() {
  const transactions = excelService.cache.transaksi || [];
  // Group by id_transaksi
  const grouped = {};
  for (const t of transactions) {
    if (!grouped[t.id_transaksi]) {
      grouped[t.id_transaksi] = {
        id_transaksi: t.id_transaksi,
        tanggal: t.tanggal,
        jam: t.jam,
        status_pesanan: 'menunggu_proses',
        items: [],
        total_porsi: 0,
        catatan: t.catatan
      };
    }
    grouped[t.id_transaksi].items.push({
      kode_menu: t.kode_menu,
      nama_menu: t.nama_menu,
      qty_porsi: t.qty_porsi
    });
    grouped[t.id_transaksi].total_porsi += t.qty_porsi;
  }

  // Preserve existing statuses
  const existingMap = new Map(kitchenOrders.map(o => [o.id_transaksi, o.status_pesanan]));
  kitchenOrders = Object.values(grouped).map(order => ({
    ...order,
    status_pesanan: existingMap.get(order.id_transaksi) || 'selesai'
  }));
}

// GET active kitchen queue (DAPUR / OWNER / KASIR)
router.get('/queue', authMiddleware, requireRole(['DAPUR', 'OWNER', 'KASIR']), (req, res) => {
  try {
    if (kitchenOrders.length === 0) syncKitchenOrders();
    const active = kitchenOrders
      .filter(o => o.status_pesanan !== 'selesai')
      .sort((a, b) => b.id_transaksi.localeCompare(a.id_transaksi));
    res.json({ success: true, count: active.length, data: active });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT update order status (DAPUR / OWNER)
router.put('/status/:id', authMiddleware, requireRole(['DAPUR', 'OWNER']), (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['menunggu_proses', 'diproses', 'siap', 'selesai'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Status tidak valid.' });
    }

    const order = kitchenOrders.find(o => o.id_transaksi === req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan di antrean.' });
    }

    const before = order.status_pesanan;
    order.status_pesanan = status;

    excelService.logAudit(
      req.user,
      'STATUS_DAPUR',
      'KITCHEN_QUEUE',
      `Pesanan ${order.id_transaksi} diubah status menjadi: ${status}`,
      { status: before },
      { status }
    );

    res.json({ success: true, message: `Status pesanan diubah menjadi: ${status}`, data: order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
