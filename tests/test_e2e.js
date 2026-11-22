/**
 * End-to-End Automated Integration Test Suite
 * Kuliner Bebek Sanjay Gowa
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const authService = require('../services/authService');
const excelService = require('../services/excelService');
const storageService = require('../services/storageService');
const inventoryService = require('../services/inventoryService');

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING KULINER BEBEK SANJAY GOWA INTEGRATION TEST');
  console.log('====================================================\n');

  // Ensure pristine workbook is loaded for tests
  const pristinePath = path.join(__dirname, '..', 'Dataset_Bebek_Sanjay_Gowa_Revisi_Menu_Harga_210_Transaksi(1).xlsx');
  const targetPath = storageService.getWorkbookPath();
  if (fs.existsSync(pristinePath)) {
    fs.copyFileSync(pristinePath, targetPath);
    await excelService.loadWorkbook();
  }

  let passedCount = 0;
  let testCount = 0;

  function test(name, fn) {
    testCount++;
    try {
      fn();
      console.log(`✅ [PASS] Test ${testCount}: ${name}`);
      passedCount++;
    } catch (err) {
      console.error(`❌ [FAIL] Test ${testCount}: ${name}`);
      console.error('   Error:', err.message);
    }
  }

  async function asyncTest(name, fn) {
    testCount++;
    try {
      await fn();
      console.log(`✅ [PASS] Test ${testCount}: ${name}`);
      passedCount++;
    } catch (err) {
      console.error(`❌ [FAIL] Test ${testCount}: ${name}`);
      console.error('   Error:', err.message);
    }
  }

  // 1. Initial Workbook Load
  await asyncTest('Excel Workbook must load 10 sheets accurately', async () => {
    await excelService.loadPromise;
    assert.strictEqual(excelService.isLoaded, true, 'ExcelService should be loaded');
    assert.strictEqual(excelService.cache.menu.length, 29, 'Must contain 29 menu items');
    assert.strictEqual(excelService.cache.bahan.length, 38, 'Must contain 38 raw materials');
    assert.strictEqual(excelService.cache.transaksi.length, 210, 'Must contain 210 transactions');
    assert.strictEqual(excelService.cache.ssRop.length, 38, 'Must contain 38 SS/ROP calculations');
  });

  // 2. Authentication & Roles
  test('Authentication: Login with owner, kasir, dapur', () => {
    const owner = authService.authenticate('owner', 'password');
    assert(owner && owner.token, 'Owner login must succeed');
    assert.strictEqual(owner.user.role, 'OWNER', 'Owner role must be OWNER');

    const kasir = authService.authenticate('kasir', 'password');
    assert(kasir && kasir.user.role === 'KASIR', 'Kasir login must succeed');

    const dapur = authService.authenticate('dapur', 'password');
    assert(dapur && dapur.user.role === 'DAPUR', 'Dapur login must succeed');

    const invalid = authService.authenticate('owner', 'wrong_pass');
    assert.strictEqual(invalid, null, 'Invalid login must return null');
  });

  test('Role Authorization: Enforce strict boundaries for OWNER, KASIR, and DAPUR', () => {
    const ownerReq = { user: { role: 'OWNER' } };
    const kasirReq = { user: { role: 'KASIR' } };
    const dapurReq = { user: { role: 'DAPUR' } };

    let ownerPassed = false;
    authService.requireRole(['OWNER'])(ownerReq, {}, () => { ownerPassed = true; });
    assert.strictEqual(ownerPassed, true, 'Owner should pass requireRole OWNER');

    let kasirBlocked = false;
    const mockRes = {
      status: (code) => {
        if (code === 403) kasirBlocked = true;
        return { json: () => {} };
      }
    };
    authService.requireRole(['OWNER'])(kasirReq, mockRes, () => {});
    assert.strictEqual(kasirBlocked, true, 'Kasir must be blocked from OWNER routes with 403');

    let dapurPassed = false;
    authService.requireRole(['DAPUR', 'OWNER'])(dapurReq, {}, () => { dapurPassed = true; });
    assert.strictEqual(dapurPassed, true, 'Dapur should pass kitchen routes');

    let dapurBlockedFromPOS = false;
    authService.requireRole(['OWNER', 'KASIR'])(dapurReq, { status: (c) => ({ json: () => { dapurBlockedFromPOS = (c === 403); } }) }, () => {});
    assert.strictEqual(dapurBlockedFromPOS, true, 'Dapur must be blocked from POS checkout with 403');
  });

  // 3. BOM & Inventory Formula Test
  test('BOM Formula: Kebutuhan = porsi * qty_per_menu', () => {
    const sampleItems = [{ kode_menu: 1, qty_porsi: 2 }]; // Bebek Besar Tanpa Nasi
    const bomReqs = inventoryService.calculateBomRequirements(sampleItems, excelService.cache.resep);
    
    assert(bomReqs.length > 0, 'Should find BOM recipes for menu 1');
    const daging = bomReqs.find(b => b.kode_bahan === 'B001');
    assert(daging, 'Must include Daging bebek B001');
    assert.strictEqual(daging.total_pemakaian_bahan, 500, '2 porsi * 250 gram = 500 gram');
  });

  test('Safety Stock & ROP Formulas: SS = (Max - Avg) * LT; ROP = (Avg * LT) + SS', () => {
    const maxDaily = 3830;
    const avgDaily = 2615.714;
    const leadTime = 1;

    const ss = inventoryService.calculateSafetyStock(maxDaily, avgDaily, leadTime);
    assert.strictEqual(Math.round(ss), 1214, 'SS should be ~1214');

    const rop = inventoryService.calculateReorderPoint(avgDaily, leadTime, ss);
    assert.strictEqual(Math.round(rop), 3830, 'ROP should be 3830');

    const status1 = inventoryService.determineStockStatus(500, ss, rop);
    assert.strictEqual(status1, 'Harus Restock', 'Stock 500 <= SS 1214 must be Harus Restock');

    const status2 = inventoryService.determineStockStatus(2500, ss, rop);
    assert.strictEqual(status2, 'Perlu Perhatian', 'Stock 2500 <= ROP 3830 must be Perlu Perhatian');

    const status3 = inventoryService.determineStockStatus(5000, ss, rop);
    assert.strictEqual(status3, 'Stok Aman', 'Stock 5000 > ROP 3830 must be Stok Aman');
  });

  // 4. End-to-End POS Transaction & Excel Persistence
  const testIdemKey = `E2E-IDEM-${Date.now()}`;
  await asyncTest('POS Checkout -> Workbook Excel Write & Auto Recalculate', async () => {
    const initialTrxCount = excelService.cache.transaksi.length;
    const initialDetailCount = excelService.cache.pemakaianDetail.length;

    const testUser = { username: 'kasir_test', role: 'KASIR', name: 'Tester Kasir' };
    const result = await excelService.processNewTransaction({
      items: [
        { kode_menu: 1, qty_porsi: 1, harga_satuan_rp: 28000 },
        { kode_menu: 24, qty_porsi: 1, harga_satuan_rp: 4000 }
      ],
      paymentMethod: 'TUNAI',
      notes: 'Uji E2E Kasir',
      idempotencyKey: testIdemKey
    }, testUser);

    assert(result.id_transaksi, 'Transaction ID must be returned');
    assert.strictEqual(result.total_penjualan_rp, 32000, 'Total should be 32,000');
    assert.strictEqual(excelService.cache.transaksi.length, initialTrxCount + 2, 'Transactions row count increased by 2');
    assert(excelService.cache.pemakaianDetail.length > initialDetailCount, 'PEMAKAIAN_DETAIL rows added');

    // Verify backup created
    const backups = await storageService.listBackups();
    assert(backups.length > 0, 'Backup file must exist in data/backups/');

    // Verify audit log recorded
    const auditLogs = excelService.getAuditLogs();
    assert(auditLogs.length > 0, 'Audit log must have recorded the transaction');
    assert.strictEqual(auditLogs[0].action, 'TRANSAKSI_PENJUALAN', 'Latest action must be TRANSAKSI_PENJUALAN');
  });

  // 5. Idempotency Check (Prevent duplicate transaction on double click)
  await asyncTest('Idempotency: Reject duplicate transaction submission', async () => {
    let duplicateRejected = false;
    try {
      await excelService.processNewTransaction({
        items: [{ kode_menu: 24, qty_porsi: 1, harga_satuan_rp: 4000 }],
        paymentMethod: 'TUNAI',
        idempotencyKey: testIdemKey // Same key as above
      }, { username: 'kasir', role: 'KASIR' });
    } catch (e) {
      duplicateRejected = true;
    }
    assert.strictEqual(duplicateRejected, true, 'Duplicate transaction with same idempotency key must be rejected');
  });

  // 6. Incoming Goods (BARANG_MASUK)
  await asyncTest('Barang Masuk -> Updates KARTU_STOK_HARIAN in Excel', async () => {
    const initialMasukCount = excelService.cache.barangMasuk.length;
    const testUser = { username: 'owner', role: 'OWNER' };

    const newMasuk = await excelService.addBarangMasuk({
      tanggal: '2026-11-22',
      kode_bahan: 'B001',
      qty_masuk: 500,
      jenis: 'PEMBELIAN',
      catatan: 'Uji pengadaan bahan daging bebek'
    }, testUser);

    assert(newMasuk, 'New masuk record created');
    assert.strictEqual(excelService.cache.barangMasuk.length, initialMasukCount + 1, 'Barang masuk count +1');

    // Check kartu stok for 2026-11-22 B001
    const kartu = excelService.cache.kartuStok.find(k => k.tanggal === '2026-11-22' && k.kode_bahan === 'B001');
    assert(kartu, 'Kartu stok must contain entry for 2026-11-22 B001');
    assert(kartu.barang_masuk >= 500, 'Kartu stok barang_masuk updated');
  });

  // 7. Dashboard Stats Generation
  test('Dashboard KPIs & Chart.js Datasets', () => {
    const stats = excelService.getDashboardStats();
    assert(stats.cards.totalPenjualan > 0, 'Total penjualan > 0');
    assert(stats.cards.totalTransaksi >= 210, 'Total transaksi >= 210');
    assert(stats.charts.salesChart.labels.length > 0, 'Sales chart has labels');
    assert(stats.charts.topMenuChart.labels.length > 0, 'Top menu chart has labels');
    assert(stats.charts.materialUsageChart.labels.length > 0, 'Material usage chart has labels');
    assert(stats.charts.stockVsRop.length > 0, 'Stock vs ROP has items');
  });

  console.log('\n====================================================');
  console.log(`🏁 TEST SUMMARY: ${passedCount} / ${testCount} Passed`);
  console.log('====================================================\n');

  if (passedCount === testCount) {
    // Restore pristine file and clean test backups
    if (fs.existsSync(pristinePath)) {
      fs.copyFileSync(pristinePath, targetPath);
    }
    const backupsDir = path.join(__dirname, '..', 'data', 'backups');
    if (fs.existsSync(backupsDir)) {
      const files = fs.readdirSync(backupsDir);
      for (const f of files) fs.unlinkSync(path.join(backupsDir, f));
    }
    const auditFile = path.join(__dirname, '..', 'data', 'audit_log.json');
    if (fs.existsSync(auditFile)) {
      fs.writeFileSync(auditFile, JSON.stringify([{
        id: 'LOG-INIT-001',
        timestamp: '2026-11-22T08:00:00.000Z',
        tanggal: '2026-11-22',
        jam: '16:00:00',
        username: 'system',
        role: 'SYSTEM',
        action: 'INISIALISASI_SISTEM',
        sheet: 'ALL',
        details: 'Inisialisasi sistem Kuliner Bebek Sanjay Gowa dan sinkronisasi workbook Excel 210 Transaksi.',
        before: null,
        after: { status: 'READY', sheets: 10 }
      }], null, 2), 'utf8');
    }

    console.log('🎉 ALL INTEGRATION TESTS PASSED PERFECTLY!\n');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal Test Suite Error:', err);
  process.exit(1);
});
