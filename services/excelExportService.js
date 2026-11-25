/**
 * Export MySQL data to Excel Workbook
 * File: services/excelExportService.js
 */
const ExcelJS = require('exceljs');
const { query } = require('../config/database');

async function generateExcelWorkbook() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Kuliner Bebek Sanjay Gowa';
  wb.created = new Date();

  // 1. MASTER_MENU
  const wsMenu = wb.addWorksheet('MASTER_MENU');
  wsMenu.columns = [
    { header: 'kode_menu', key: 'code', width: 12 },
    { header: 'nama_menu', key: 'name', width: 30 },
    { header: 'kategori', key: 'category', width: 20 },
    { header: 'harga_satuan_rp', key: 'price', width: 18 },
    { header: 'status_harga', key: 'price_status', width: 18 },
    { header: 'catatan', key: 'notes', width: 35 }
  ];
  const menus = await query('SELECT code, name, category, price, price_status, notes FROM menus WHERE is_active = 1 ORDER BY code ASC');
  menus.forEach(m => wsMenu.addRow(m));

  // 2. MASTER_BAHAN
  const wsBahan = wb.addWorksheet('MASTER_BAHAN');
  wsBahan.columns = [
    { header: 'kode_bahan', key: 'code', width: 12 },
    { header: 'nama_bahan', key: 'name', width: 25 },
    { header: 'satuan_pemakaian', key: 'usage_unit', width: 18 },
    { header: 'satuan_pembelian', key: 'purchase_unit', width: 18 },
    { header: 'catatan', key: 'notes', width: 40 }
  ];
  const ingredients = await query('SELECT code, name, usage_unit, purchase_unit, notes FROM ingredients WHERE is_active = 1 ORDER BY code ASC');
  ingredients.forEach(i => wsBahan.addRow(i));

  // 3. TRANSAKSI
  const wsTrx = wb.addWorksheet('TRANSAKSI_210');
  wsTrx.columns = [
    { header: 'id_transaksi', key: 'order_no', width: 24 },
    { header: 'tanggal', key: 'tgl', width: 14 },
    { header: 'jam', key: 'jam', width: 10 },
    { header: 'kode_menu', key: 'code', width: 12 },
    { header: 'nama_menu', key: 'menu_name', width: 30 },
    { header: 'kategori', key: 'category', width: 18 },
    { header: 'qty_porsi', key: 'qty_portions', width: 12 },
    { header: 'harga_satuan_rp', key: 'unit_price', width: 16 },
    { header: 'total_penjualan_rp', key: 'subtotal', width: 18 },
    { header: 'status_data', key: 'data_source', width: 14 },
    { header: 'catatan', key: 'notes', width: 35 }
  ];
  const trxs = await query(`
    SELECT 
      o.order_no,
      DATE_FORMAT(o.created_at, '%Y-%m-%d') as tgl,
      DATE_FORMAT(o.created_at, '%H:%i') as jam,
      m.code,
      m.name as menu_name,
      m.category,
      od.qty_portions,
      od.unit_price,
      od.subtotal,
      o.data_source,
      o.notes
    FROM orders o
    JOIN order_details od ON od.order_id = o.id
    JOIN menus m ON m.id = od.menu_id
    ORDER BY o.id ASC
  `);
  trxs.forEach(t => wsTrx.addRow(t));

  // 4. RESEP_BOM
  const wsBom = wb.addWorksheet('RESEP_BOM');
  wsBom.columns = [
    { header: 'kode_menu', key: 'menu_code', width: 12 },
    { header: 'nama_menu', key: 'menu_name', width: 30 },
    { header: 'kode_bahan', key: 'ing_code', width: 12 },
    { header: 'nama_bahan', key: 'ing_name', width: 25 },
    { header: 'qty_per_menu', key: 'quantity_per_portion', width: 15 },
    { header: 'satuan', key: 'unit', width: 12 },
    { header: 'catatan', key: 'notes', width: 35 }
  ];
  const boms = await query(`
    SELECT m.code as menu_code, m.name as menu_name, i.code as ing_code, i.name as ing_name, b.quantity_per_portion, b.unit, b.notes
    FROM bom_details b
    JOIN menus m ON m.id = b.menu_id
    JOIN ingredients i ON i.id = b.ingredient_id
    ORDER BY m.code ASC, i.code ASC
  `);
  boms.forEach(b => wsBom.addRow(b));

  // 5. STOK_TERKINI & PARAMETER
  const wsStok = wb.addWorksheet('STOK_TERKINI_SS_ROP');
  wsStok.columns = [
    { header: 'kode_bahan', key: 'code', width: 12 },
    { header: 'nama_bahan', key: 'name', width: 25 },
    { header: 'satuan', key: 'usage_unit', width: 12 },
    { header: 'stok_tersedia', key: 'current_stock', width: 16 },
    { header: 'rata_rata_harian', key: 'avg_daily_usage', width: 18 },
    { header: 'safety_stock', key: 'safety_stock', width: 16 },
    { header: 'reorder_point', key: 'reorder_point', width: 16 },
    { header: 'status_stok', key: 'status_stok', width: 16 }
  ];
  const stocks = await query(`
    SELECT 
      i.code, i.name, i.usage_unit, inv.current_stock, ip.avg_daily_usage, ip.safety_stock, ip.reorder_point,
      CASE 
        WHEN inv.current_stock <= ip.safety_stock THEN 'Harus Restock'
        WHEN inv.current_stock <= ip.reorder_point THEN 'Perlu Perhatian'
        ELSE 'Aman'
      END as status_stok
    FROM ingredients i
    JOIN inventory inv ON inv.ingredient_id = i.id
    JOIN inventory_parameters ip ON ip.ingredient_id = i.id
    ORDER BY i.code ASC
  `);
  stocks.forEach(s => wsStok.addRow(s));

  return wb;
}

module.exports = { generateExcelWorkbook };
