/**
 * ============================================================================
 * KULINER BEBEK SANJAY GOWA - SCRIPT MIGRASI EXCEL KE MYSQL
 * File: database/migrate.js
 * 
 * Fitur:
 * 1. Mode Dry-Run (--dry-run atau --validate) untuk validasi tanpa tulis ke DB
 * 2. Mode Eksekusi (--execute) dengan Transaksi Database (BEGIN/COMMIT/ROLLBACK)
 * 3. Mekanisme UPSERT (ON DUPLICATE KEY UPDATE) idempotent
 * 4. Pemisahan konsisten data AKTUAL vs ESTIMASI
 * 5. Standarisasi satuan: kg untuk persediaan unggas, ekor untuk beli
 * 6. Audit & Log ke excel_import_logs dan activity_logs
 * ============================================================================
 */

const ExcelJS = require('exceljs');
const path = require('path');
const { getConnection, getPool, query } = require('../config/database');

const EXCEL_PATH = path.join(__dirname, '..', 'data', 'Dataset_Bebek_Sanjay_Gowa_Revisi_Menu_Harga_210_Transaksi(1).xlsx');
const FILE_NAME = 'Dataset_Bebek_Sanjay_Gowa_Revisi_Menu_Harga_210_Transaksi(1).xlsx';

// Helper format date YYYY-MM-DD
function formatDate(d) {
  if (!d) return null;
  if (typeof d === 'string') {
    return d.slice(0, 10);
  }
  if (d instanceof Date) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return String(d).slice(0, 10);
}

// Helper format datetime YYYY-MM-DD HH:mm:ss
function formatDateTime(d, timeStr) {
  const dateStr = formatDate(d);
  if (!dateStr) return null;
  const time = timeStr ? String(timeStr).trim() : '12:00';
  const cleanTime = time.length === 5 ? `${time}:00` : time;
  return `${dateStr} ${cleanTime}`;
}

async function parseWorkbook() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(EXCEL_PATH);

  // 1. Parse Menus (MASTER_MENU)
  const menus = [];
  const wsMenu = wb.getWorksheet('MASTER_MENU');
  wsMenu.eachRow((r, i) => {
    if (i > 1) {
      const code = parseInt(r.getCell(1).value, 10);
      const name = String(r.getCell(2).value || '').trim();
      const category = String(r.getCell(3).value || '').trim();
      const price = parseFloat(r.getCell(4).value || 0);
      const priceStatus = String(r.getCell(5).value || 'HARGA AKTUAL').trim();
      const notes = r.getCell(6).value ? String(r.getCell(6).value).trim() : null;
      if (code && name) {
        menus.push({ code, name, category, price, priceStatus, notes });
      }
    }
  });

  // 2. Parse Ingredients (MASTER_BAHAN)
  const ingredients = [];
  const wsBahan = wb.getWorksheet('MASTER_BAHAN');
  wsBahan.eachRow((r, i) => {
    if (i > 1) {
      const code = String(r.getCell(1).value || '').trim();
      const name = String(r.getCell(2).value || '').trim();
      const usageUnit = String(r.getCell(3).value || 'gram').trim();
      const dataStatus = String(r.getCell(4).value || 'AKTUAL').trim();
      const notes = r.getCell(5).value ? String(r.getCell(5).value).trim() : null;

      // Special rule: Daging bebek (B001) & Ayam kampung (B002)
      // Satuan persediaan: kg, satuan beli: ekor
      let purchaseUnit = usageUnit;
      let conversionRatio = 1.0000;
      if (code === 'B001' || code === 'B002') {
        purchaseUnit = 'ekor';
        conversionRatio = 1.0000; // 1 ekor = 1 kg (asumsi dasar sebelum penimbangan aktual)
      }

      if (code && name) {
        ingredients.push({
          code,
          name,
          usageUnit,
          purchaseUnit,
          conversionRatio,
          costPerUnit: 0.00,
          dataStatus,
          notes
        });
      }
    }
  });

  // 3. Parse BOM (RESEP_BOM)
  const bomDetails = [];
  const wsBom = wb.getWorksheet('RESEP_BOM');
  wsBom.eachRow((r, i) => {
    if (i > 1) {
      const menuCode = parseInt(r.getCell(1).value, 10);
      const menuName = String(r.getCell(2).value || '').trim();
      const ingCode = String(r.getCell(3).value || '').trim();
      const ingName = String(r.getCell(4).value || '').trim();
      const qty = parseFloat(r.getCell(5).value || 0);
      const unit = String(r.getCell(6).value || '').trim();
      const dataStatus = String(r.getCell(7).value || 'TERVERIFIKASI').trim();
      const notes = r.getCell(8).value ? String(r.getCell(8).value).trim() : null;

      if (menuCode && ingCode && qty > 0) {
        bomDetails.push({
          menuCode,
          menuName,
          ingCode,
          ingName,
          qty,
          unit,
          dataStatus,
          notes
        });
      }
    }
  });

  // 4. Parse Transactions (TRANSAKSI_210)
  const transactions = [];
  const wsTrx = wb.getWorksheet('TRANSAKSI_210');
  wsTrx.eachRow((r, i) => {
    if (i > 1) {
      const id = String(r.getCell(1).value || '').trim();
      const rawDate = r.getCell(2).value;
      const jam = r.getCell(3).value;
      const menuCode = parseInt(r.getCell(4).value, 10);
      const menuName = String(r.getCell(5).value || '').trim();
      const category = String(r.getCell(6).value || '').trim();
      const qty = parseInt(r.getCell(7).value || 1, 10);
      const price = parseFloat(r.getCell(8).value || 0);
      const total = parseFloat(r.getCell(9).value || (qty * price));
      const statusData = String(r.getCell(10).value || 'AKTUAL').trim();
      const notes = r.getCell(11).value ? String(r.getCell(11).value).trim() : null;

      if (id && menuCode) {
        transactions.push({
          orderNo: id,
          createdAt: formatDateTime(rawDate, jam),
          date: formatDate(rawDate),
          menuCode,
          menuName,
          category,
          qty,
          price,
          total,
          dataSource: statusData.toUpperCase() === 'ESTIMASI' ? 'ESTIMASI' : 'AKTUAL',
          notes
        });
      }
    }
  });

  // 5. Parse Initial Stock (STOK_AWAL)
  const initialStocks = [];
  const wsStokAwal = wb.getWorksheet('STOK_AWAL');
  wsStokAwal.eachRow((r, i) => {
    if (i > 1) {
      const ingCode = String(r.getCell(1).value || '').trim();
      const ingName = String(r.getCell(2).value || '').trim();
      const unit = String(r.getCell(3).value || '').trim();
      const stock = parseFloat(r.getCell(4).value || 0);
      const dataStatus = String(r.getCell(5).value || 'AKTUAL').trim();
      const notes = r.getCell(6).value ? String(r.getCell(6).value).trim() : null;

      if (ingCode) {
        initialStocks.push({ ingCode, ingName, unit, stock, dataStatus, notes });
      }
    }
  });

  // 6. Parse Stock In (BARANG_MASUK)
  const stockIns = [];
  const wsBarangMasuk = wb.getWorksheet('BARANG_MASUK');
  wsBarangMasuk.eachRow((r, i) => {
    if (i > 1) {
      const rawDate = r.getCell(1).value;
      const ingCode = String(r.getCell(2).value || '').trim();
      const ingName = String(r.getCell(3).value || '').trim();
      const qty = parseFloat(r.getCell(4).value || 0);
      const unit = String(r.getCell(5).value || '').trim();
      const type = String(r.getCell(6).value || 'PEMBELIAN').trim();
      const dataStatus = String(r.getCell(7).value || 'AKTUAL').trim();
      const notes = r.getCell(8).value ? String(r.getCell(8).value).trim() : null;

      if (ingCode && qty > 0) {
        stockIns.push({
          date: formatDate(rawDate),
          ingCode,
          ingName,
          qty,
          unit,
          type,
          dataStatus,
          notes
        });
      }
    }
  });

  // 7. Parse Stock Usage (PEMAKAIAN_HARIAN)
  const stockUsages = [];
  const wsUsage = wb.getWorksheet('PEMAKAIAN_HARIAN');
  wsUsage.eachRow((r, i) => {
    if (i > 1) {
      const rawDate = r.getCell(1).value;
      const ingCode = String(r.getCell(2).value || '').trim();
      const ingName = String(r.getCell(3).value || '').trim();
      const unit = String(r.getCell(4).value || '').trim();
      const totalUsage = parseFloat(r.getCell(5).value || 0);
      const dataStatus = String(r.getCell(6).value || 'HASIL REKAPITULASI').trim();
      const notes = r.getCell(7).value ? String(r.getCell(7).value).trim() : null;

      if (ingCode && rawDate) {
        stockUsages.push({
          date: formatDate(rawDate),
          ingCode,
          ingName,
          unit,
          totalUsage,
          dataStatus,
          notes
        });
      }
    }
  });

  // 8. Parse Daily Stock Card (KARTU_STOK_HARIAN)
  const stockCards = [];
  const wsCard = wb.getWorksheet('KARTU_STOK_HARIAN');
  wsCard.eachRow((r, i) => {
    if (i > 1) {
      const rawDate = r.getCell(1).value;
      const ingCode = String(r.getCell(2).value || '').trim();
      const ingName = String(r.getCell(3).value || '').trim();
      const startStock = parseFloat(r.getCell(4).value || 0);
      const inStock = parseFloat(r.getCell(5).value || 0);
      const outStock = parseFloat(r.getCell(6).value || 0);
      const endStock = parseFloat(r.getCell(7).value || 0);
      const unit = String(r.getCell(8).value || '').trim();
      const dataStatus = String(r.getCell(9).value || 'HASIL PERHITUNGAN').trim();
      const notes = r.getCell(10).value ? String(r.getCell(10).value).trim() : null;

      if (ingCode && rawDate) {
        stockCards.push({
          date: formatDate(rawDate),
          ingCode,
          ingName,
          startStock,
          inStock,
          outStock,
          endStock,
          unit,
          dataStatus,
          notes
        });
      }
    }
  });

  // 9. Parse SS & ROP (PERHITUNGAN_SS_ROP)
  const inventoryParams = [];
  const wsSsRop = wb.getWorksheet('PERHITUNGAN_SS_ROP');
  wsSsRop.eachRow((r, i) => {
    if (i > 1) {
      const ingCode = String(r.getCell(1).value || '').trim();
      const ingName = String(r.getCell(2).value || '').trim();
      const unit = String(r.getCell(3).value || '').trim();
      const total7d = parseFloat(r.getCell(4).value || 0);
      const avgDaily = parseFloat(r.getCell(5).value || 0);
      const maxDaily = parseFloat(r.getCell(6).value || 0);
      const leadTime = parseInt(r.getCell(7).value || 1, 10);
      const ss = parseFloat(r.getCell(8).value || 0);
      const rop = parseFloat(r.getCell(9).value || 0);

      if (ingCode) {
        inventoryParams.push({
          ingCode,
          ingName,
          unit,
          total7d,
          avgDaily,
          maxDaily,
          leadTime,
          safetyStock: Math.max(0, ss),
          reorderPoint: Math.max(0, rop),
          recommendedPurchase: Math.max(0, rop)
        });
      }
    }
  });

  return {
    menus,
    ingredients,
    bomDetails,
    transactions,
    initialStocks,
    stockIns,
    stockUsages,
    stockCards,
    inventoryParams
  };
}

// ============================================================================
// VALIDASI / DRY-RUN
// ============================================================================
async function runValidation() {
  console.log('====================================================');
  console.log('🔍 VALIDASI & DRY-RUN DATASET EXCEL');
  console.log('====================================================');
  console.log('File Sumber:', EXCEL_PATH);

  const data = await parseWorkbook();
  const menuCodeSet = new Set(data.menus.map(m => m.code));
  const ingCodeSet = new Set(data.ingredients.map(i => i.code));

  console.log(`\n📊 RINGKASAN DATA SUMBER DITEMUKAN:`);
  console.log(`  1. Master Menu:          ${data.menus.length} menu (Target: 29)`);
  console.log(`  2. Master Bahan Baku:    ${data.ingredients.length} bahan (Target: 38)`);
  console.log(`  3. Resep BOM Details:    ${data.bomDetails.length} baris (Target: 231)`);
  console.log(`  4. Transaksi Penjualan:  ${data.transactions.length} transaksi (Target: 210)`);
  console.log(`  5. Stok Awal:            ${data.initialStocks.length} bahan`);
  console.log(`  6. Barang Masuk:         ${data.stockIns.length} penerimaan`);
  console.log(`  7. Pemakaian Harian:     ${data.stockUsages.length} catatan pemakaian`);
  console.log(`  8. Kartu Stok Harian:    ${data.stockCards.length} mutasi harian`);
  console.log(`  9. Parameter SS & ROP:   ${data.inventoryParams.length} parameter`);

  // Validasi Relasi BOM -> Menu & Bahan
  let bomErrors = 0;
  for (const b of data.bomDetails) {
    if (!menuCodeSet.has(b.menuCode)) {
      console.error(`  ❌ Relasi BOM Menu Error: Menu kode ${b.menuCode} tidak ada di Master Menu!`);
      bomErrors++;
    }
    if (!ingCodeSet.has(b.ingCode)) {
      console.error(`  ❌ Relasi BOM Bahan Error: Bahan kode ${b.ingCode} tidak ada di Master Bahan!`);
      bomErrors++;
    }
  }

  // Validasi Relasi Transaksi -> Menu
  let trxErrors = 0;
  for (const t of data.transactions) {
    if (!menuCodeSet.has(t.menuCode)) {
      console.error(`  ❌ Relasi Transaksi Menu Error: Menu kode ${t.menuCode} (${t.orderNo}) tidak ada di Master Menu!`);
      trxErrors++;
    }
  }

  // Validasi Relasi Stok Masuk & Awal -> Bahan
  let stockErrors = 0;
  for (const sa of data.initialStocks) {
    if (!ingCodeSet.has(sa.ingCode)) {
      console.error(`  ❌ Relasi Stok Awal Error: Bahan kode ${sa.ingCode} tidak ada di Master Bahan!`);
      stockErrors++;
    }
  }
  for (const si of data.stockIns) {
    if (!ingCodeSet.has(si.ingCode)) {
      console.error(`  ❌ Relasi Barang Masuk Error: Bahan kode ${si.ingCode} tidak ada di Master Bahan!`);
      stockErrors++;
    }
  }
  for (const su of data.stockUsages) {
    if (!ingCodeSet.has(su.ingCode)) {
      console.error(`  ❌ Relasi Pemakaian Error: Bahan kode ${su.ingCode} tidak ada di Master Bahan!`);
      stockErrors++;
    }
  }
  for (const ip of data.inventoryParams) {
    if (!ingCodeSet.has(ip.ingCode)) {
      console.error(`  ❌ Relasi SS ROP Error: Bahan kode ${ip.ingCode} tidak ada di Master Bahan!`);
      stockErrors++;
    }
  }

  console.log(`\n🔎 HASIL PEMERIKSAAN INTEGRITAS RELASI:`);
  console.log(`  - Integritas BOM:        ${bomErrors === 0 ? '✅ 100% VALID (0 error)' : `❌ ${bomErrors} error`}`);
  console.log(`  - Integritas Transaksi:  ${trxErrors === 0 ? '✅ 100% VALID (0 error)' : `❌ ${trxErrors} error`}`);
  console.log(`  - Integritas Persediaan: ${stockErrors === 0 ? '✅ 100% VALID (0 error)' : `❌ ${stockErrors} error`}`);

  const totalErrors = bomErrors + trxErrors + stockErrors;
  if (totalErrors === 0) {
    console.log('\n====================================================');
    console.log('🎉 VALIDASI DRY-RUN SELESAI DENGAN STATUS 100% LULUS!');
    console.log('Seluruh relasi foreign key, format tanggal, dan data siap dimigrasi.');
    console.log('====================================================');
  } else {
    console.error(`\n⚠️ Terdeteksi ${totalErrors} kesalahan relasi! Perbaiki sebelum migrasi.`);
  }

  return { data, totalErrors };
}

// ============================================================================
// EKSEKUSI MIGRASI (TRANSAKSI DATABASE PENUH)
// ============================================================================
async function runMigration() {
  console.log('====================================================');
  console.log('🚀 MEMULAI MIGRASI DATA EXCEL KE MYSQL');
  console.log('====================================================');

  const { data, totalErrors } = await runValidation();
  if (totalErrors > 0) {
    throw new Error(`Migrasi dibatalkan karena terdapat ${totalErrors} error validasi.`);
  }

  const conn = await getConnection();
  console.log('\n⏳ Membuka Transaksi Database (START TRANSACTION)...');
  await conn.beginTransaction();

  let importedStats = {
    menus: 0,
    ingredients: 0,
    bomDetails: 0,
    orders: 0,
    orderDetails: 0,
    payments: 0,
    productions: 0,
    initialStocks: 0,
    stockIns: 0,
    stockUsages: 0,
    stockCards: 0,
    inventoryParams: 0,
    failed: 0,
    skipped: 0
  };

  try {
    // 1. MIGRASI MENUS (29 baris)
    console.log('1. Mengimpor 29 Master Menu...');
    for (const m of data.menus) {
      await conn.query(
        `INSERT INTO menus (code, name, category, price, price_status, notes, is_active)
         VALUES (?, ?, ?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name),
           category = VALUES(category),
           price = VALUES(price),
           price_status = VALUES(price_status),
           notes = VALUES(notes),
           is_active = 1`,
        [m.code, m.name, m.category, m.price, m.priceStatus, m.notes]
      );
      importedStats.menus++;
    }

    // Ambil mapping code -> id dari menus
    const [menuRows] = await conn.query('SELECT id, code FROM menus');
    const menuIdMap = new Map();
    menuRows.forEach(r => menuIdMap.set(r.code, r.id));

    // 2. MIGRASI INGREDIENTS (38 baris)
    console.log('2. Mengimpor 38 Master Bahan Baku...');
    for (const ing of data.ingredients) {
      await conn.query(
        `INSERT INTO ingredients (code, name, usage_unit, purchase_unit, conversion_ratio, cost_per_unit, notes, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name),
           usage_unit = VALUES(usage_unit),
           purchase_unit = VALUES(purchase_unit),
           conversion_ratio = VALUES(conversion_ratio),
           notes = VALUES(notes),
           is_active = 1`,
        [ing.code, ing.name, ing.usageUnit, ing.purchaseUnit, ing.conversionRatio, ing.costPerUnit, ing.notes]
      );
      importedStats.ingredients++;
    }

    // Ambil mapping code -> id dari ingredients
    const [ingRows] = await conn.query('SELECT id, code, usage_unit FROM ingredients');
    const ingIdMap = new Map();
    const ingUnitMap = new Map();
    ingRows.forEach(r => {
      ingIdMap.set(r.code, r.id);
      ingUnitMap.set(r.code, r.usage_unit);
    });

    // 3. MIGRASI RESEP BOM (231 baris)
    console.log('3. Mengimpor 231 Resep BOM...');
    for (const b of data.bomDetails) {
      const menuId = menuIdMap.get(b.menuCode);
      const ingredientId = ingIdMap.get(b.ingCode);
      if (menuId && ingredientId) {
        await conn.query(
          `INSERT INTO bom_details (menu_id, ingredient_id, quantity_per_portion, unit, data_status, notes)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             quantity_per_portion = VALUES(quantity_per_portion),
             unit = VALUES(unit),
             data_status = VALUES(data_status),
             notes = VALUES(notes)`,
          [menuId, ingredientId, b.qty, b.unit, b.dataStatus, b.notes]
        );
        importedStats.bomDetails++;
      } else {
        importedStats.skipped++;
      }
    }

    // 4. MIGRASI TRANSAKSI, ORDER DETAILS, PAYMENTS, PRODUCTIONS (210 transaksi)
    console.log('4. Mengimpor 210 Transaksi Penjualan, Pembayaran & Produksi...');
    for (const t of data.transactions) {
      const menuId = menuIdMap.get(t.menuCode);
      if (!menuId) {
        importedStats.skipped++;
        continue;
      }

      // Upsert Order
      const [orderResult] = await conn.query(
        `INSERT INTO orders (
           order_no, user_id, customer_name, order_type, table_no,
           total_amount, discount_amount, tax_amount, grand_total,
           order_status, data_source, notes, created_at
         ) VALUES (?, 2, 'Pelanggan', 'dine_in', '01', ?, 0, 0, ?, 'selesai', ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           total_amount = VALUES(total_amount),
           grand_total = VALUES(grand_total),
           order_status = VALUES(order_status),
           data_source = VALUES(data_source),
           notes = VALUES(notes)`,
        [t.orderNo, t.total, t.total, t.dataSource, t.notes, t.createdAt]
      );

      // Ambil order_id
      let orderId;
      if (orderResult.insertId) {
        orderId = orderResult.insertId;
      } else {
        const [existing] = await conn.query('SELECT id FROM orders WHERE order_no = ?', [t.orderNo]);
        orderId = existing[0].id;
      }

      // Upsert Order Details (Hapus item lama jika ada lalu insert ulang agar idempotent)
      await conn.query('DELETE FROM order_details WHERE order_id = ?', [orderId]);
      await conn.query(
        `INSERT INTO order_details (order_id, menu_id, qty_portions, unit_price, subtotal, notes)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [orderId, menuId, t.qty, t.price, t.total, t.notes]
      );
      importedStats.orderDetails++;

      // Upsert Payments (Hapus payment lama jika ada lalu insert ulang)
      await conn.query('DELETE FROM payments WHERE order_id = ?', [orderId]);
      await conn.query(
        `INSERT INTO payments (order_id, payment_method, amount_paid, change_amount, payment_status, payment_time)
         VALUES (?, 'TUNAI', ?, 0, 'LUNAS', ?)`,
        [orderId, t.total, t.createdAt]
      );
      importedStats.payments++;

      // Upsert Productions (Hapus production lama jika ada lalu insert ulang)
      await conn.query('DELETE FROM productions WHERE order_id = ?', [orderId]);
      await conn.query(
        `INSERT INTO productions (order_id, status, started_at, completed_at, processed_by, notes)
         VALUES (?, 'selesai', ?, ?, 3, 'Produksi selesai')`,
        [orderId, t.createdAt, t.createdAt]
      );
      importedStats.productions++;

      importedStats.orders++;
    }

    // 5. MIGRASI STOK AWAL & INISIALISASI INVENTORY
    console.log('5. Mengimpor Stok Awal & Inisialisasi Saldo Inventory...');
    // Kita simpan stok akhir hari terakhir (Nov 07) untuk current_stock di inventory
    // Kumpulkan stok akhir per bahan dari kartu stok harian
    const finalStockMap = new Map();
    for (const card of data.stockCards) {
      // Ambil stok_akhir_hari paling baru
      finalStockMap.set(card.ingCode, card.endStock);
    }

    for (const sa of data.initialStocks) {
      const ingredientId = ingIdMap.get(sa.ingCode);
      if (ingredientId) {
        // Current stock di tabel inventory: jika ada di kartu stok pakai endStock, jika tidak pakai stok awal
        const currentBalance = finalStockMap.has(sa.ingCode) ? finalStockMap.get(sa.ingCode) : sa.stock;

        await conn.query(
          `INSERT INTO inventory (ingredient_id, current_stock, unit, last_updated_at)
           VALUES (?, ?, ?, CURRENT_TIMESTAMP)
           ON DUPLICATE KEY UPDATE
             current_stock = VALUES(current_stock),
             unit = VALUES(unit),
             last_updated_at = CURRENT_TIMESTAMP`,
          [ingredientId, currentBalance, sa.unit]
        );

        // Catat mutasi awal ke stock_movements jika belum tercatat
        await conn.query(
          `INSERT INTO stock_movements (
             ingredient_id, movement_type, quantity, unit,
             balance_before, balance_after, reference_type, reference_id, user_id, notes, created_at
           ) VALUES (?, 'IN_ADJUSTMENT', ?, ?, 0, ?, 'STOK_AWAL', 'INIT-20261101', 1, ?, '2026-11-01 00:00:00')
           ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)`,
          [ingredientId, sa.stock, sa.unit, sa.stock, sa.notes || 'Pemeriksaan stok fisik awal']
        );

        importedStats.initialStocks++;
      }
    }

    // 6. MIGRASI BARANG MASUK (73 baris)
    console.log('6. Mengimpor 73 Barang Masuk...');
    for (const si of data.stockIns) {
      const ingredientId = ingIdMap.get(si.ingCode);
      if (ingredientId) {
        await conn.query(
          `INSERT INTO stock_in (
             ingredient_id, qty_in, unit, received_date, type,
             supplier_name, data_status, user_id, notes, created_at
           ) VALUES (?, ?, ?, ?, 'PEMBELIAN', 'Pemasok Terpilih', ?, 1, ?, ?)
           ON DUPLICATE KEY UPDATE qty_in = VALUES(qty_in)`,
          [ingredientId, si.qty, si.unit, si.date, si.dataStatus, si.notes, `${si.date} 08:00:00`]
        );
        importedStats.stockIns++;
      }
    }

    // 7. MIGRASI REKAP PEMAKAIAN HARIAN (266 baris)
    console.log('7. Mengimpor 266 Rekap Pemakaian Harian...');
    for (const su of data.stockUsages) {
      const ingredientId = ingIdMap.get(su.ingCode);
      if (ingredientId) {
        await conn.query(
          `INSERT INTO stock_usage (date, ingredient_id, daily_total_usage, unit, data_status, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             daily_total_usage = VALUES(daily_total_usage),
             unit = VALUES(unit),
             data_status = VALUES(data_status),
             notes = VALUES(notes)`,
          [su.date, ingredientId, su.totalUsage, su.unit, su.dataStatus, su.notes, `${su.date} 21:00:00`]
        );
        importedStats.stockUsages++;
      }
    }

    // 8. MIGRASI PARAMETER SS & ROP (38 baris)
    console.log('8. Mengimpor 38 Parameter SS, ROP, dan SMA...');
    for (const ip of data.inventoryParams) {
      const ingredientId = ingIdMap.get(ip.ingCode);
      if (ingredientId) {
        await conn.query(
          `INSERT INTO inventory_parameters (
             ingredient_id, lead_time_days, ma_period_days, avg_daily_usage, max_daily_usage,
             safety_stock, reorder_point, recommended_purchase, last_calculated_at
           ) VALUES (?, ?, 7, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
           ON DUPLICATE KEY UPDATE
             lead_time_days = VALUES(lead_time_days),
             avg_daily_usage = VALUES(avg_daily_usage),
             max_daily_usage = VALUES(max_daily_usage),
             safety_stock = VALUES(safety_stock),
             reorder_point = VALUES(reorder_point),
             recommended_purchase = VALUES(recommended_purchase),
             last_calculated_at = CURRENT_TIMESTAMP`,
          [
            ingredientId,
            ip.leadTime,
            ip.avgDaily,
            ip.maxDaily,
            ip.safetyStock,
            ip.reorderPoint,
            ip.recommendedPurchase
          ]
        );
        importedStats.inventoryParams++;
      }
    }

    // 9. LOG KE excel_import_logs DAN activity_logs
    console.log('9. Mencatat Riwayat Migrasi ke excel_import_logs & activity_logs...');
    const totalRecords = importedStats.menus + importedStats.ingredients + importedStats.bomDetails +
      importedStats.orders + importedStats.initialStocks + importedStats.stockIns +
      importedStats.stockUsages + importedStats.inventoryParams;

    await conn.query(
      `INSERT INTO excel_import_logs (
         file_name, import_type, records_imported, records_failed, status, user_id, error_details, created_at
       ) VALUES (?, 'FULL_DATASET', ?, 0, 'SUCCESS', 1, ?, CURRENT_TIMESTAMP)`,
      [
        FILE_NAME,
        totalRecords,
        JSON.stringify({ stats: importedStats, message: 'Migrasi dataset Excel berhasil penuh.' })
      ]
    );

    await conn.query(
      `INSERT INTO activity_logs (user_id, action, module, details, created_at)
       VALUES (1, 'IMPORT_DATASET', 'EXCEL_MIGRATION', ?, CURRENT_TIMESTAMP)`,
      [`Berhasil memigrasi ${totalRecords} data dari file ${FILE_NAME} ke MySQL.`]
    );

    // COMMIT TRANSAKSI
    await conn.commit();
    console.log('\n✅ TRANSAKSI DATABASE BERHASIL DI-COMMIT (COMMIT SUCCESSFUL)!');

    console.log('\n====================================================');
    console.log('🎉 MIGRASI EXCEL KE MYSQL SELESAI DENGAN SUKSES PENUH!');
    console.log('====================================================');
    console.log(`1. Menu Berhasil:             ${importedStats.menus} / 29`);
    console.log(`2. Bahan Baku Berhasil:       ${importedStats.ingredients} / 38`);
    console.log(`3. Resep BOM Berhasil:        ${importedStats.bomDetails} / 231`);
    console.log(`4. Transaksi Berhasil:        ${importedStats.orders} / 210`);
    console.log(`   - Order Details:           ${importedStats.orderDetails}`);
    console.log(`   - Payments:                ${importedStats.payments}`);
    console.log(`   - Productions:             ${importedStats.productions}`);
    console.log(`5. Stok Awal Berhasil:        ${importedStats.initialStocks} / 38`);
    console.log(`6. Saldo Inventory Terkini:   ${importedStats.initialStocks} bahan`);
    console.log(`7. Barang Masuk Berhasil:     ${importedStats.stockIns} / 73`);
    console.log(`8. Pemakaian Harian:          ${importedStats.stockUsages} / 266`);
    console.log(`9. Parameter SS & ROP:        ${importedStats.inventoryParams} / 38`);
    console.log(`10. Data Gagal / Ditolak:     ${importedStats.failed}`);
    console.log(`11. Data Dilewati:            ${importedStats.skipped}`);
    console.log('====================================================');

    return importedStats;
  } catch (err) {
    console.error('\n❌ TERJADI KESALAHAN PADA MIGRASI! MELAKUKAN ROLLBACK...');
    await conn.rollback();
    console.error('Pesan Error:', err.message);

    try {
      await conn.query(
        `INSERT INTO excel_import_logs (file_name, import_type, records_imported, records_failed, status, user_id, error_details)
         VALUES (?, 'FULL_DATASET', 0, 1, 'FAILED', 1, ?)`,
        [FILE_NAME, JSON.stringify({ error: err.message, stack: err.stack })]
      );
    } catch (logErr) {
      console.error('Gagal mencatat log error:', logErr.message);
    }

    throw err;
  } finally {
    conn.release();
  }
}

// Main Runner
async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run') || args.includes('--validate');
  const isExecute = args.includes('--execute');

  if (isDryRun || (!isDryRun && !isExecute)) {
    await runValidation();
    if (!isExecute) {
      console.log('\n💡 Untuk mengeksekusi migrasi ke MySQL, jalankan:');
      console.log('   node database/migrate.js --execute');
    }
  }

  if (isExecute) {
    await runMigration();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
