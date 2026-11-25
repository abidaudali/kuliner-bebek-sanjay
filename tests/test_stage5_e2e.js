/**
 * ============================================================================
 * TEST SUITE: TAHAP 5 - E2E MYSQL API & MODULE VERIFICATION
 * File: tests/test_stage5_e2e.js
 * 
 * Pengujian 10 Poin Wajib Sesuai Instruksi User:
 * 1. Login tiga role (Owner, Kasir, Dapur)
 * 2. Transaksi kasir
 * 3. Pembayaran
 * 4. Antrean dapur
 * 5. Perubahan stok
 * 6. Perhitungan BOM
 * 7. SMA, SS, dan ROP
 * 8. Riwayat aktivitas (audit trail)
 * 9. Refresh / Idempotensi transaksi
 * 10. Konsistensi database (210 transaksi & omset Rp 4.841.000 tidak terganggu)
 * ============================================================================
 */

const { query } = require('../config/database');
const authService = require('../services/authService');
const dbService = require('../services/mysqlDataService');

async function runE2ETests() {
  console.log('====================================================');
  console.log('🧪 PENGUJIAN LENGKAP TAHAP 5: BACKEND MYSQL QUERIES');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      failed++;
    }
  }

  // --------------------------------------------------------------------------
  // POIN 1: Login 3 Role (Owner, Kasir, Dapur)
  // --------------------------------------------------------------------------
  console.log('--- 1. PENGUJIAN LOGIN TIGA ROLE ---');
  const ownerAuth = await authService.authenticate('owner', 'password');
  assert(ownerAuth && ownerAuth.token && ownerAuth.user.role === 'OWNER', 'Login Owner berhasil dan mendapatkan token JWT role OWNER');

  const kasirAuth = await authService.authenticate('kasir', 'password');
  assert(kasirAuth && kasirAuth.token && kasirAuth.user.role === 'KASIR', 'Login Kasir berhasil dan mendapatkan token JWT role KASIR');

  const dapurAuth = await authService.authenticate('dapur', 'password');
  assert(dapurAuth && dapurAuth.token && dapurAuth.user.role === 'DAPUR', 'Login Dapur berhasil dan mendapatkan token JWT role DAPUR');

  const invalidAuth = await authService.authenticate('owner', 'passwordsalah');
  assert(invalidAuth === null, 'Login dengan password salah ditolak dengan aman');

  // --------------------------------------------------------------------------
  // POIN 2 & 3: Transaksi Kasir & Pembayaran (ACID Transaction)
  // --------------------------------------------------------------------------
  console.log('\n--- 2 & 3. PENGUJIAN TRANSAKSI KASIR & PEMBAYARAN ---');
  // Cek saldo stok daging bebek (B001) sebelum transaksi baru
  const [b001Before] = await query(`
    SELECT inv.current_stock 
    FROM inventory inv JOIN ingredients i ON i.id = inv.ingredient_id 
    WHERE i.code = 'B001'
  `);
  const stockBeforeB001 = parseFloat(b001Before.current_stock);

  // Buat transaksi baru: 1 porsi "Bebek Besar Tanpa Nasi" (Kode 1, Harga 28000, BOM: 250 gram bebek)
  const newTxPayload = {
    items: [
      { kode_menu: 1, nama_menu: 'Bebek Besar Tanpa Nasi', qty_porsi: 1, harga_satuan_rp: 28000 }
    ],
    total_penjualan_rp: 28000,
    paymentMethod: 'TUNAI',
    paid: 50000,
    change: 22000,
    customer_name: 'Uji Kasir POS',
    table_no: '09',
    catatan: 'Pengujian otomatis transaksi kasir'
  };

  const txResult = await dbService.processNewTransaction(newTxPayload, kasirAuth.user);
  assert(txResult && txResult.id_transaksi && txResult.id_transaksi.startsWith('TRX-BSG-'), `Transaksi kasir berhasil dibuat: ${txResult.id_transaksi}`);
  assert(txResult.total_penjualan_rp === 28000, 'Total penjualan transaksi sesuai (Rp 28.000)');

  // Verifikasi pembayaran di tabel payments
  const [payRow] = await query(`
    SELECT p.payment_method, p.amount_paid, p.change_amount, p.payment_status
    FROM payments p JOIN orders o ON o.id = p.order_id
    WHERE o.order_no = ?
  `, [txResult.id_transaksi]);
  assert(payRow && payRow.payment_method === 'TUNAI' && parseFloat(payRow.amount_paid) === 50000 && payRow.payment_status === 'LUNAS', 'Pembayaran tersimpan lunas di tabel payments');

  // --------------------------------------------------------------------------
  // POIN 4: Antrean Dapur & Sinkronisasi Status
  // --------------------------------------------------------------------------
  console.log('\n--- 4. PENGUJIAN ANTREAN PRODUKSI DAPUR ---');
  const kitchenQueue = await dbService.getKitchenQueue();
  const queuedOrder = kitchenQueue.find(q => q.id_transaksi === txResult.id_transaksi);
  assert(queuedOrder !== undefined, `Pesanan baru ${txResult.id_transaksi} otomatis masuk ke antrean dapur`);
  assert(queuedOrder && queuedOrder.status_pesanan === 'menunggu_proses', 'Status awal di dapur: "menunggu_proses"');

  // Dapur mulai memproses pesanan
  const updateToDiproses = await dbService.updateKitchenStatus(txResult.id_transaksi, 'diproses', dapurAuth.user);
  assert(updateToDiproses.status_pesanan === 'diproses', 'Dapur berhasil mengubah status menjadi "diproses"');

  // Dapur menyelesaikan pesanan
  const updateToSelesai = await dbService.updateKitchenStatus(txResult.id_transaksi, 'selesai', dapurAuth.user);
  assert(updateToSelesai.status_pesanan === 'selesai', 'Dapur berhasil mengubah status menjadi "selesai"');

  // Pastikan status di tabel orders ikut tersinkronisasi
  const [orderSync] = await query('SELECT order_status FROM orders WHERE order_no = ?', [txResult.id_transaksi]);
  assert(orderSync && orderSync.order_status === 'selesai', 'Status di tabel orders tersinkronisasi menjadi "selesai"');

  // --------------------------------------------------------------------------
  // POIN 5 & 6: Pemotongan Stok & Perhitungan Resep BOM
  // --------------------------------------------------------------------------
  console.log('\n--- 5 & 6. PENGUJIAN RESEP BOM & PEMOTONGAN STOK ---');
  const [b001After] = await query(`
    SELECT inv.current_stock 
    FROM inventory inv JOIN ingredients i ON i.id = inv.ingredient_id 
    WHERE i.code = 'B001'
  `);
  const stockAfterB001 = parseFloat(b001After.current_stock);
  // BOM Bebek Besar Tanpa Nasi membutuhkan 250 gram bebek = 0.25 kg
  const expectedStock = stockBeforeB001 - 0.25;
  const diff = Math.abs(stockAfterB001 - expectedStock);
  assert(diff < 0.001, `Stok B001 berkurang tepat 0.25 kg (Sebelum: ${stockBeforeB001}, Sesudah: ${stockAfterB001})`);

  // Cek mutasi tercatat di stock_movements
  const [smRow] = await query(`
    SELECT sm.movement_type, sm.quantity, sm.unit, sm.reference_type, sm.reference_id
    FROM stock_movements sm
    JOIN ingredients i ON i.id = sm.ingredient_id
    WHERE i.code = 'B001' AND sm.reference_id = ?
  `, [txResult.id_transaksi]);
  assert(smRow && smRow.movement_type === 'OUT_SALE' && parseFloat(smRow.quantity) === 0.25, 'Buku besar stock_movements mencatat pemakaian OUT_SALE 0.25 kg');

  // --------------------------------------------------------------------------
  // POIN 7: SMA (7 Hari), Safety Stock (SS), dan Reorder Point (ROP)
  // --------------------------------------------------------------------------
  console.log('\n--- 7. PENGUJIAN SMA, SAFETY STOCK, DAN REORDER POINT ---');
  const ssRopList = await dbService.getSsRop();
  assert(ssRopList.length === 38, 'Tabel parameter persediaan lengkap untuk 38 bahan');

  const b001Params = ssRopList.find(b => b.kode_bahan === 'B001');
  assert(b001Params && b001Params.rata_rata_per_hari > 0, `SMA 7-hari terhitung: ${b001Params.rata_rata_per_hari} kg/hari`);
  assert(b001Params.safety_stock > 0, `Safety Stock terhitung: ${b001Params.safety_stock} kg`);
  assert(b001Params.reorder_point > 0, `Reorder Point terhitung: ${b001Params.reorder_point} kg`);
  assert(b001Params.status_stok !== undefined, `Status stok otomatis teridentifikasi: "${b001Params.status_stok}"`);

  // --------------------------------------------------------------------------
  // POIN 8: Audit Trail (activity_logs)
  // --------------------------------------------------------------------------
  console.log('\n--- 8. PENGUJIAN AUDIT TRAIL ACTIVITY LOGS ---');
  const logs = await dbService.getAuditLogs();
  assert(logs.length > 0, `Audit trail mencatat riwayat aktivitas (${logs.length} log terdaftar)`);
  const recentTxLog = logs.find(l => l.action === 'TRANSAKSI_KASIR' && l.details.includes(txResult.id_transaksi));
  assert(recentTxLog !== undefined, `Aktivitas transaksi kasir ${txResult.id_transaksi} tercatat di audit log`);

  // --------------------------------------------------------------------------
  // POIN 9: Idempotensi & Anti-Duplikasi Tombol
  // --------------------------------------------------------------------------
  console.log('\n--- 9. PENGUJIAN ANTI-DUPLIKASI (IDEMPOTENCY) ---');
  let duplicateCaught = false;
  try {
    // Coba kirim transaksi identik secara langsung dalam hitungan milidetik
    await dbService.processNewTransaction(newTxPayload, kasirAuth.user);
  } catch (err) {
    if (err.message.includes('duplikat')) {
      duplicateCaught = true;
    }
  }
  assert(duplicateCaught, 'Mekanisme anti-duplikasi berhasil mencegah transaksi ganda saat diklik berulang kali');

  // Bersihkan transaksi uji agar transaksi historis tetap murni
  await query('DELETE FROM productions WHERE order_id IN (SELECT id FROM orders WHERE order_no = ?)', [txResult.id_transaksi]);
  await query('DELETE FROM payments WHERE order_id IN (SELECT id FROM orders WHERE order_no = ?)', [txResult.id_transaksi]);
  await query('DELETE FROM order_details WHERE order_id IN (SELECT id FROM orders WHERE order_no = ?)', [txResult.id_transaksi]);
  await query('DELETE FROM stock_movements WHERE reference_id = ?', [txResult.id_transaksi]);
  await query('DELETE FROM orders WHERE order_no = ?', [txResult.id_transaksi]);
  // Kembalikan saldo B001 ke saldo awal sebelum uji
  await query(`
    UPDATE inventory inv JOIN ingredients i ON i.id = inv.ingredient_id 
    SET inv.current_stock = ? WHERE i.code = 'B001'
  `, [stockBeforeB001]);

  // --------------------------------------------------------------------------
  // POIN 10: Konsistensi Database & Transaksi Historis 210 Baris
  // --------------------------------------------------------------------------
  console.log('\n--- 10. PENGUJIAN KONSISTENSI DATASET HISTORIS ---');
  const [histCheck] = await query(`
    SELECT 
      COUNT(*) as total_orders,
      COUNT(DISTINCT order_no) as unique_orders,
      SUM(grand_total) as total_omset
    FROM orders
  `);
  assert(histCheck.total_orders === 210, `Jumlah transaksi historis tepat 210 (Aktual: ${histCheck.total_orders})`);
  assert(histCheck.unique_orders === 210, `Tidak ada nomor pesanan duplikat (Aktual: ${histCheck.unique_orders})`);
  assert(Number(histCheck.total_omset) === 4841000, `Total omset historis tetap persis Rp 4.841.000 (Aktual: ${histCheck.total_omset})`);

  // Cek dashboard stats endpoint
  const stats = await dbService.getDashboardStats();
  assert(stats.cards.totalPenjualan === 4841000, 'KPI Card Total Penjualan Dashboard tepat Rp 4.841.000');
  assert(stats.cards.totalTransaksi === 210, 'KPI Card Total Transaksi Dashboard tepat 210');
  assert(stats.cards.totalMenu === 29, 'KPI Card Total Menu Dashboard tepat 29');
  assert(stats.cards.totalBahan === 38, 'KPI Card Total Bahan Dashboard tepat 38');
  assert(stats.charts.salesChart.labels.length > 0, 'Data grafik penjualan harian berhasil dibaca dari MySQL');
  assert(stats.charts.topMenuChart.labels.length > 0, 'Data grafik menu terlaris berhasil dibaca dari MySQL');

  console.log('\n====================================================');
  console.log(`🎉 HASIL PENGUJIAN E2E: ${passed} PASS, ${failed} FAIL`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runE2ETests().catch(err => {
  console.error('Fatal E2E error:', err);
  process.exit(1);
});
