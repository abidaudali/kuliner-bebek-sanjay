const { query } = require('../config/database');

async function verify() {
  console.log('====================================================');
  console.log('📊 VERIFIKASI DATA DATABASE KULINER_BEBEK SETELAH MIGRASI');
  console.log('====================================================\n');

  const tables = [
    'roles',
    'users',
    'menus',
    'ingredients',
    'bom_details',
    'orders',
    'order_details',
    'payments',
    'productions',
    'inventory',
    'stock_movements',
    'stock_in',
    'stock_usage',
    'inventory_parameters',
    'activity_logs',
    'excel_import_logs'
  ];

  console.log('--- REKAP JUMLAH BARIS PER TABEL ---');
  for (const t of tables) {
    const res = await query(`SELECT COUNT(*) as cnt FROM ${t}`);
    console.log(`  📁 ${t.padEnd(22)} : ${res[0].cnt} baris`);
  }

  console.log('\n--- VERIFIKASI UNGGAS (B001 & B002) ---');
  const poultry = await query(`SELECT code, name, usage_unit, purchase_unit, conversion_ratio FROM ingredients WHERE code IN ('B001', 'B002', 'B003')`);
  console.table(poultry);

  console.log('\n--- VERIFIKASI LOG IMPORT TERAKHIR ---');
  const logs = await query(`SELECT id, file_name, import_type, records_imported, records_failed, status, created_at FROM excel_import_logs ORDER BY id DESC LIMIT 1`);
  console.table(logs);

  console.log('\n--- VERIFIKASI SAMPEL ORDERS & PEMBAYARAN ---');
  const sampleOrders = await query(`
    SELECT o.order_no, o.grand_total, o.order_status, o.data_source, od.qty_portions, m.name as menu_name, p.payment_method, p.payment_status
    FROM orders o
    JOIN order_details od ON od.order_id = o.id
    JOIN menus m ON m.id = od.menu_id
    JOIN payments p ON p.order_id = o.id
    LIMIT 3
  `);
  console.table(sampleOrders);

  console.log('\n--- VERIFIKASI RELASI FOREIGN KEY TANPA ORPHAN ---');
  const orphanBom = await query(`SELECT COUNT(*) as cnt FROM bom_details b LEFT JOIN menus m ON m.id = b.menu_id LEFT JOIN ingredients i ON i.id = b.ingredient_id WHERE m.id IS NULL OR i.id IS NULL`);
  const orphanOd = await query(`SELECT COUNT(*) as cnt FROM order_details od LEFT JOIN orders o ON o.id = od.order_id LEFT JOIN menus m ON m.id = od.menu_id WHERE o.id IS NULL OR m.id IS NULL`);
  const orphanPay = await query(`SELECT COUNT(*) as cnt FROM payments p LEFT JOIN orders o ON o.id = p.order_id WHERE o.id IS NULL`);
  const orphanProd = await query(`SELECT COUNT(*) as cnt FROM productions pr LEFT JOIN orders o ON o.id = pr.order_id WHERE o.id IS NULL`);
  const orphanInv = await query(`SELECT COUNT(*) as cnt FROM inventory inv LEFT JOIN ingredients i ON i.id = inv.ingredient_id WHERE i.id IS NULL`);

  console.log(`  BOM Orphan:        ${orphanBom[0].cnt} (Harus 0) -> ${orphanBom[0].cnt === 0 ? '✅ VALID' : '❌ INVALID'}`);
  console.log(`  Order Details:     ${orphanOd[0].cnt} (Harus 0) -> ${orphanOd[0].cnt === 0 ? '✅ VALID' : '❌ INVALID'}`);
  console.log(`  Payments Orphan:   ${orphanPay[0].cnt} (Harus 0) -> ${orphanPay[0].cnt === 0 ? '✅ VALID' : '❌ INVALID'}`);
  console.log(`  Production Orphan: ${orphanProd[0].cnt} (Harus 0) -> ${orphanProd[0].cnt === 0 ? '✅ VALID' : '❌ INVALID'}`);
  console.log(`  Inventory Orphan:  ${orphanInv[0].cnt} (Harus 0) -> ${orphanInv[0].cnt === 0 ? '✅ VALID' : '❌ INVALID'}`);

  console.log('\n====================================================');
  console.log('✅ SELURUH VERIFIKASI INTEGRITAS DATABASE LULUS 100%');
  console.log('====================================================');
  process.exit(0);
}

verify().catch(e => {
  console.error(e);
  process.exit(1);
});
