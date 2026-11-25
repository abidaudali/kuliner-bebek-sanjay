/**
 * ============================================================================
 * MYSQL DATA SERVICE: KULINER BEBEK SANJAY GOWA
 * File: services/mysqlDataService.js
 * 
 * Pusat logika data dan query database MySQL (InnoDB):
 * - Prepared Statements
 * - Transaksi ACID (BEGIN, COMMIT, ROLLBACK)
 * - Anti-duplikasi pesanan (Idempotency)
 * - Resep BOM, SMA (7 hari), SS, dan ROP
 * - Audit Trail ke activity_logs
 * ============================================================================
 */

const { getConnection, query } = require('../config/database');

class MySQLDataService {
  constructor() {
    this.isLoaded = true;
    this.loadPromise = Promise.resolve();
  }

  // Helper log audit
  async logAudit(conn, userId, action, moduleName, details, before = null, after = null) {
    const sql = `
      INSERT INTO activity_logs (user_id, action, module, details, data_before, data_after, created_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;
    const params = [
      userId || null,
      action,
      moduleName,
      details,
      before ? JSON.stringify(before) : null,
      after ? JSON.stringify(after) : null
    ];
    if (conn) {
      await conn.query(sql, params);
    } else {
      await query(sql, params);
    }
  }

  // --------------------------------------------------------------------------
  // 1. DASHBOARD & STATISTIK
  // --------------------------------------------------------------------------
  async getDashboardStats() {
    // 1. KPI Cards
    const [salesRow] = await query(`
      SELECT 
        COALESCE(SUM(grand_total), 0) as totalPenjualan,
        COUNT(DISTINCT order_no) as totalTransaksi
      FROM orders
    `);

    const [menuRow] = await query(`SELECT COUNT(*) as totalMenu FROM menus WHERE is_active = 1`);
    const [bahanRow] = await query(`SELECT COUNT(*) as totalBahan FROM ingredients WHERE is_active = 1`);

    // Status stok & ROP
    const stockStatusRows = await query(`
      SELECT 
        i.code as kode_bahan,
        i.name as nama_bahan,
        i.usage_unit as satuan,
        inv.current_stock as stok_tersedia,
        ip.avg_daily_usage as rata_rata_per_hari,
        ip.safety_stock,
        ip.reorder_point,
        CASE 
          WHEN inv.current_stock <= ip.safety_stock THEN 'Harus Restock'
          WHEN inv.current_stock <= ip.reorder_point THEN 'Perlu Perhatian'
          ELSE 'Aman'
        END as status_stok
      FROM ingredients i
      JOIN inventory inv ON inv.ingredient_id = i.id
      JOIN inventory_parameters ip ON ip.ingredient_id = i.id
      WHERE i.is_active = 1
      ORDER BY i.code ASC
    `);

    let stokMenipisCount = 0;
    let perluRestockCount = 0;
    const criticalBahan = [];

    for (const item of stockStatusRows) {
      if (item.status_stok === 'Harus Restock') {
        perluRestockCount++;
        criticalBahan.push(item);
      } else if (item.status_stok === 'Perlu Perhatian') {
        stokMenipisCount++;
        criticalBahan.push(item);
      }
    }

    // 2. Grafik Penjualan Harian
    const dailySalesRows = await query(`
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m-%d') as date,
        SUM(grand_total) as total
      FROM orders
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);

    // 3. Grafik Menu Terlaris (Top 7)
    const topMenuRows = await query(`
      SELECT 
        m.name,
        SUM(od.qty_portions) as total_qty
      FROM order_details od
      JOIN menus m ON m.id = od.menu_id
      GROUP BY od.menu_id, m.name
      ORDER BY total_qty DESC
      LIMIT 7
    `);

    // 4. Grafik Pemakaian Bahan Baku Terbanyak (Top 7)
    const topUsageRows = await query(`
      SELECT 
        i.name,
        SUM(su.daily_total_usage) as total_usage,
        su.unit
      FROM stock_usage su
      JOIN ingredients i ON i.id = su.ingredient_id
      GROUP BY su.ingredient_id, i.name, su.unit
      ORDER BY total_usage DESC
      LIMIT 7
    `);

    // 5. Grafik Stok vs ROP (Bahan Prioritas)
    const stockVsRopRows = stockStatusRows
      .filter(b => b.reorder_point > 0)
      .slice(0, 10);

    return {
      cards: {
        totalPenjualan: parseFloat(salesRow.totalPenjualan) || 0,
        totalTransaksi: parseInt(salesRow.totalTransaksi, 10) || 0,
        totalMenu: parseInt(menuRow.totalMenu, 10) || 0,
        totalBahan: parseInt(bahanRow.totalBahan, 10) || 0,
        stokMenipisCount,
        perluRestockCount
      },
      charts: {
        salesChart: {
          labels: dailySalesRows.map(r => r.date),
          values: dailySalesRows.map(r => parseFloat(r.total) || 0)
        },
        topMenuChart: {
          labels: topMenuRows.map(r => r.name),
          values: topMenuRows.map(r => parseInt(r.total_qty, 10) || 0)
        },
        materialUsageChart: {
          labels: topUsageRows.map(r => `${r.name} (${r.unit})`),
          values: topUsageRows.map(r => parseFloat(r.total_usage) || 0)
        },
        stockVsRop: {
          labels: stockVsRopRows.map(r => r.nama_bahan),
          stock: stockVsRopRows.map(r => parseFloat(r.stok_tersedia) || 0),
          rop: stockVsRopRows.map(r => parseFloat(r.reorder_point) || 0)
        }
      },
      criticalBahan
    };
  }

  // --------------------------------------------------------------------------
  // 2. MASTER MENU
  // --------------------------------------------------------------------------
  async getMenu(filters = {}) {
    let sql = `
      SELECT 
        id,
        code as kode_menu,
        name as nama_menu,
        category as kategori,
        price as harga_satuan_rp,
        price_status as status_harga,
        image_url,
        notes as catatan,
        is_active
      FROM menus
      WHERE is_active = 1
    `;
    const params = [];

    if (filters.kategori) {
      sql += ' AND category = ?';
      params.push(filters.kategori);
    }
    if (filters.search) {
      sql += ' AND (name LIKE ? OR code LIKE ?)';
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    sql += ' ORDER BY code ASC';
    const rows = await query(sql, params);
    return rows.map(r => ({
      ...r,
      harga_satuan_rp: parseFloat(r.harga_satuan_rp) || 0
    }));
  }

  async addMenu(data, user) {
    if (!data.nama_menu || !data.kategori || !data.harga_satuan_rp) {
      throw new Error('Nama menu, kategori, dan harga wajib diisi.');
    }

    // Auto increment code jika tidak ada
    let code = parseInt(data.kode_menu, 10);
    if (!code) {
      const [maxCode] = await query('SELECT MAX(code) as max_c FROM menus');
      code = (maxCode.max_c || 0) + 1;
    }

    const price = parseFloat(data.harga_satuan_rp) || 0;
    const priceStatus = data.status_harga || 'HARGA AKTUAL';
    const notes = data.catatan || null;

    const sql = `
      INSERT INTO menus (code, name, category, price, price_status, notes, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `;
    await query(sql, [code, data.nama_menu, data.kategori, price, priceStatus, notes]);
    await this.logAudit(null, user?.id, 'TAMBAH_MENU', 'MENU', `Menambahkan menu: ${data.nama_menu} (Kode: ${code})`, null, data);

    return { kode_menu: code, nama_menu: data.nama_menu, kategori: data.kategori, harga_satuan_rp: price };
  }

  async updateMenu(code, data, user) {
    const [existing] = await query('SELECT * FROM menus WHERE code = ?', [code]);
    if (!existing) throw new Error(`Menu dengan kode ${code} tidak ditemukan.`);

    const name = data.nama_menu || existing.name;
    const category = data.kategori || existing.category;
    const price = data.harga_satuan_rp !== undefined ? parseFloat(data.harga_satuan_rp) : existing.price;
    const priceStatus = data.status_harga || existing.price_status;
    const notes = data.catatan !== undefined ? data.catatan : existing.notes;

    await query(`
      UPDATE menus 
      SET name = ?, category = ?, price = ?, price_status = ?, notes = ?
      WHERE code = ?
    `, [name, category, price, priceStatus, notes, code]);

    await this.logAudit(null, user?.id, 'UPDATE_MENU', 'MENU', `Memperbarui menu kode ${code}`, existing, { name, category, price });

    return { kode_menu: code, nama_menu: name, kategori: category, harga_satuan_rp: price };
  }

  async deleteMenu(code, user) {
    const [existing] = await query('SELECT * FROM menus WHERE code = ?', [code]);
    if (!existing) throw new Error(`Menu dengan kode ${code} tidak ditemukan.`);

    await query('UPDATE menus SET is_active = 0 WHERE code = ?', [code]);
    await this.logAudit(null, user?.id, 'HAPUS_MENU', 'MENU', `Menonaktifkan menu kode ${code}: ${existing.name}`);
    return true;
  }

  // --------------------------------------------------------------------------
  // 3. MASTER BAHAN BAKU & INVENTORY
  // --------------------------------------------------------------------------
  async getBahan(filters = {}) {
    let sql = `
      SELECT 
        i.id,
        i.code as kode_bahan,
        i.name as nama_bahan,
        i.usage_unit as satuan_pemakaian,
        i.purchase_unit,
        i.conversion_ratio,
        inv.current_stock as stok_tersedia,
        i.notes as catatan,
        ip.avg_daily_usage,
        ip.safety_stock,
        ip.reorder_point,
        CASE 
          WHEN inv.current_stock <= ip.safety_stock THEN 'Harus Restock'
          WHEN inv.current_stock <= ip.reorder_point THEN 'Perlu Perhatian'
          ELSE 'Aman'
        END as status_stok
      FROM ingredients i
      LEFT JOIN inventory inv ON inv.ingredient_id = i.id
      LEFT JOIN inventory_parameters ip ON ip.ingredient_id = i.id
      WHERE i.is_active = 1
    `;
    const params = [];

    if (filters.search) {
      sql += ' AND (i.name LIKE ? OR i.code LIKE ?)';
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    sql += ' ORDER BY i.code ASC';
    const rows = await query(sql, params);
    return rows.map(r => ({
      ...r,
      stok_tersedia: parseFloat(r.stok_tersedia) || 0,
      safety_stock: parseFloat(r.safety_stock) || 0,
      reorder_point: parseFloat(r.reorder_point) || 0
    }));
  }

  async addBahan(data, user) {
    if (!data.nama_bahan || !data.satuan_pemakaian) {
      throw new Error('Nama bahan dan satuan pemakaian wajib diisi.');
    }

    let code = data.kode_bahan;
    if (!code) {
      const [maxCode] = await query('SELECT MAX(CAST(SUBSTRING(code, 2) AS UNSIGNED)) as max_c FROM ingredients WHERE code LIKE "B%"');
      const nextNum = (maxCode.max_c || 0) + 1;
      code = `B${String(nextNum).padStart(3, '0')}`;
    }

    const conn = await getConnection();
    await conn.beginTransaction();

    try {
      const usageUnit = data.satuan_pemakaian;
      const purchaseUnit = data.purchase_unit || usageUnit;
      const conversionRatio = parseFloat(data.conversion_ratio) || 1.0;
      const notes = data.catatan || null;

      const [res] = await conn.query(`
        INSERT INTO ingredients (code, name, usage_unit, purchase_unit, conversion_ratio, notes, is_active)
        VALUES (?, ?, ?, ?, ?, ?, 1)
      `, [code, data.nama_bahan, usageUnit, purchaseUnit, conversionRatio, notes]);

      const ingredientId = res.insertId;
      const initialStock = parseFloat(data.stok_awal) || 0;

      await conn.query(`
        INSERT INTO inventory (ingredient_id, current_stock, unit, last_updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `, [ingredientId, initialStock, usageUnit]);

      await conn.query(`
        INSERT INTO inventory_parameters (ingredient_id, lead_time_days, ma_period_days, last_calculated_at)
        VALUES (?, 1, 7, CURRENT_TIMESTAMP)
      `, [ingredientId]);

      if (initialStock > 0) {
        await conn.query(`
          INSERT INTO stock_movements (
            ingredient_id, movement_type, quantity, unit, balance_before, balance_after, reference_type, reference_id, user_id, notes
          ) VALUES (?, 'IN_ADJUSTMENT', ?, ?, 0, ?, 'STOK_AWAL', 'INIT-MANUAL', ?, 'Saldo awal bahan baru')
        `, [ingredientId, initialStock, usageUnit, initialStock, user?.id || null]);
      }

      await this.logAudit(conn, user?.id, 'TAMBAH_BAHAN', 'INVENTORY', `Menambahkan bahan: ${data.nama_bahan} (${code})`);
      await conn.commit();

      return { kode_bahan: code, nama_bahan: data.nama_bahan, satuan_pemakaian: usageUnit, stok_tersedia: initialStock };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  async updateBahan(code, data, user) {
    const [existing] = await query('SELECT * FROM ingredients WHERE code = ?', [code]);
    if (!existing) throw new Error(`Bahan dengan kode ${code} tidak ditemukan.`);

    const name = data.nama_bahan || existing.name;
    const usageUnit = data.satuan_pemakaian || existing.usage_unit;
    const notes = data.catatan !== undefined ? data.catatan : existing.notes;

    await query(`
      UPDATE ingredients 
      SET name = ?, usage_unit = ?, notes = ?
      WHERE code = ?
    `, [name, usageUnit, notes, code]);

    await this.logAudit(null, user?.id, 'UPDATE_BAHAN', 'INVENTORY', `Memperbarui bahan ${code}`, existing, { name, usageUnit, notes });
    return { kode_bahan: code, nama_bahan: name, satuan_pemakaian: usageUnit };
  }

  // --------------------------------------------------------------------------
  // 4. TRANSAKSI KASIR (POS) & ACID CHECKOUT
  // --------------------------------------------------------------------------
  async getTransaksi(filters = {}) {
    let sql = `
      SELECT 
        o.id,
        o.order_no as id_transaksi,
        DATE_FORMAT(o.created_at, '%Y-%m-%d') as tanggal,
        DATE_FORMAT(o.created_at, '%H:%i') as jam,
        m.code as kode_menu,
        m.name as nama_menu,
        m.category as kategori,
        od.qty_portions as qty_porsi,
        od.unit_price as harga_satuan_rp,
        od.subtotal as total_penjualan_rp,
        o.grand_total,
        o.data_source as status_data,
        o.notes as catatan,
        o.order_status as status_pesanan,
        p.payment_status as status_pembayaran,
        p.payment_method as metode_pembayaran
      FROM orders o
      JOIN order_details od ON od.order_id = o.id
      JOIN menus m ON m.id = od.menu_id
      LEFT JOIN payments p ON p.order_id = o.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.tanggal) {
      sql += ' AND DATE(o.created_at) = ?';
      params.push(filters.tanggal);
    }
    if (filters.id_transaksi) {
      sql += ' AND o.order_no = ?';
      params.push(filters.id_transaksi);
    }

    sql += ' ORDER BY o.id DESC, od.id ASC';
    const rows = await query(sql, params);
    return rows.map(r => ({
      ...r,
      harga_satuan_rp: parseFloat(r.harga_satuan_rp) || 0,
      total_penjualan_rp: parseFloat(r.total_penjualan_rp) || 0,
      grand_total: parseFloat(r.grand_total) || 0
    }));
  }

  async processNewTransaction(data, user) {
    if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
      throw new Error('Pesanan harus memiliki minimal 1 item menu.');
    }

    const conn = await getConnection();
    await conn.beginTransaction();

    try {
      // 1. Anti-duplikasi / Idempotensi (cek apakah order identik dibuat dalam 3 detik terakhir)
      const totalAmount = parseFloat(data.total_penjualan_rp) || data.items.reduce((sum, it) => sum + (it.qty_porsi * it.harga_satuan_rp), 0);
      const [recentDuplicates] = await conn.query(`
        SELECT id, order_no FROM orders 
        WHERE total_amount = ? AND created_at >= NOW() - INTERVAL 3 SECOND
        LIMIT 1
      `, [totalAmount]);

      if (recentDuplicates && recentDuplicates.length > 0) {
        throw new Error('Transaksi duplikat terdeteksi. Silakan tunggu beberapa detik.');
      }

      // 2. Buat Nomor Transaksi Baru (TRX-BSG-YYYYMMDD-XXX)
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const datePrefix = `TRX-BSG-${year}${month}${day}`;

      const [maxOrderRows] = await conn.query(`
        SELECT order_no FROM orders 
        WHERE order_no LIKE ?
        ORDER BY id DESC LIMIT 1
      `, [`${datePrefix}-%`]);

      let seq = 1;
      if (maxOrderRows && maxOrderRows.length > 0) {
        const parts = maxOrderRows[0].order_no.split('-');
        const lastSeq = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(lastSeq)) seq = lastSeq + 1;
      }
      const orderNo = `${datePrefix}-${String(seq).padStart(3, '0')}`;

      // 3. Simpan Header Pesanan (orders)
      const customerName = data.customer_name || 'Pelanggan';
      const tableNo = data.table_no || '01';
      const notes = data.catatan || null;

      const [orderRes] = await conn.query(`
        INSERT INTO orders (
          order_no, user_id, customer_name, order_type, table_no,
          total_amount, discount_amount, tax_amount, grand_total,
          order_status, data_source, notes, created_at
        ) VALUES (?, ?, ?, 'dine_in', ?, ?, 0, 0, ?, 'diproses', 'AKTUAL', ?, NOW())
      `, [orderNo, user?.id || 2, customerName, tableNo, totalAmount, totalAmount, notes]);

      const orderId = orderRes.insertId;

      // 4. Simpan Order Details & Deduct Stock melalui Resep BOM
      const usedIngredients = new Map(); // ingredient_id -> qty_used

      for (const item of data.items) {
        const qtyPorsi = parseInt(item.qty_porsi, 10) || 1;
        const unitPrice = parseFloat(item.harga_satuan_rp) || 0;
        const subtotal = qtyPorsi * unitPrice;

        // Ambil menu_id dari kode_menu
        const [menuRows] = await conn.query('SELECT id, name FROM menus WHERE code = ?', [item.kode_menu]);
        if (!menuRows || menuRows.length === 0) throw new Error(`Menu dengan kode ${item.kode_menu} tidak valid.`);
        const menuId = menuRows[0].id;

        await conn.query(`
          INSERT INTO order_details (order_id, menu_id, qty_portions, unit_price, subtotal, notes)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [orderId, menuId, qtyPorsi, unitPrice, subtotal, item.catatan || null]);

        // Cek Resep BOM untuk menu ini
        const [bomItems] = await conn.query(`
          SELECT ingredient_id, quantity_per_portion, unit 
          FROM bom_details 
          WHERE menu_id = ?
        `, [menuId]);

        for (const bom of bomItems) {
          let neededQty = parseFloat(bom.quantity_per_portion) * qtyPorsi;
          const currentTotal = usedIngredients.get(bom.ingredient_id) || { qty: 0, bomUnit: bom.unit };
          usedIngredients.set(bom.ingredient_id, {
            qty: currentTotal.qty + neededQty,
            bomUnit: bom.unit
          });
        }
      }

      // 5. Potong Stok Bahan & Catat Mutasi (stock_movements)
      for (const [ingredientId, usageData] of usedIngredients.entries()) {
        const [invRows] = await conn.query(`
          SELECT current_stock, unit FROM inventory 
          WHERE ingredient_id = ? FOR UPDATE
        `, [ingredientId]);

        if (invRows && invRows.length > 0) {
          const invRow = invRows[0];
          const currentBalance = parseFloat(invRow.current_stock);

          // Konversi satuan jika BOM dalam gram tapi inventory dalam kg
          let qtyToDeduct = usageData.qty;
          if (invRow.unit.toLowerCase() === 'kg' && usageData.bomUnit.toLowerCase() === 'gram') {
            qtyToDeduct = usageData.qty / 1000;
          } else if (invRow.unit.toLowerCase() === 'liter' && usageData.bomUnit.toLowerCase() === 'ml') {
            qtyToDeduct = usageData.qty / 1000;
          }

          const newBalance = currentBalance - qtyToDeduct;

          // Update inventory
          await conn.query(`
            UPDATE inventory 
            SET current_stock = ?, last_updated_at = CURRENT_TIMESTAMP
            WHERE ingredient_id = ?
          `, [newBalance, ingredientId]);

          // Catat ke stock_movements
          await conn.query(`
            INSERT INTO stock_movements (
              ingredient_id, movement_type, quantity, unit,
              balance_before, balance_after, reference_type, reference_id, user_id, notes, created_at
            ) VALUES (?, 'OUT_SALE', ?, ?, ?, ?, 'ORDER', ?, ?, 'Pemakaian bahan otomatis dari transaksi kasir', NOW())
          `, [ingredientId, qtyToDeduct, invRow.unit, currentBalance, newBalance, orderNo, user?.id || null]);

          // Update rekap pemakaian harian (stock_usage)
          const today = `${year}-${month}-${day}`;
          await conn.query(`
            INSERT INTO stock_usage (date, ingredient_id, daily_total_usage, unit, data_status, created_at)
            VALUES (?, ?, ?, ?, 'AKTUAL', NOW())
            ON DUPLICATE KEY UPDATE 
              daily_total_usage = daily_total_usage + VALUES(daily_total_usage)
          `, [today, ingredientId, qtyToDeduct, invRow.unit]);
        }
      }

      // 6. Simpan Pembayaran (payments)
      const paymentInfo = data.pembayaran || {};
      const method = (data.paymentMethod || paymentInfo.metode_pembayaran || 'TUNAI').toUpperCase();
      const amountPaid = parseFloat(data.paid || paymentInfo.jumlah_bayar) || totalAmount;
      const changeAmount = parseFloat(data.change || paymentInfo.kembalian) || Math.max(0, amountPaid - totalAmount);

      await conn.query(`
        INSERT INTO payments (order_id, payment_method, amount_paid, change_amount, payment_status, payment_time)
        VALUES (?, ?, ?, ?, 'LUNAS', NOW())
      `, [orderId, method, amountPaid, Math.max(0, changeAmount)]);

      // 7. Masukkan ke Antrean Produksi Dapur (productions)
      await conn.query(`
        INSERT INTO productions (order_id, status, started_at, processed_by, notes)
        VALUES (?, 'menunggu_proses', NOW(), ?, 'Pesanan masuk dari kasir POS')
      `, [orderId, user?.id || null]);

      // 8. Log ke activity_logs
      await this.logAudit(conn, user?.id, 'TRANSAKSI_KASIR', 'POS', `Transaksi berhasil: ${orderNo} senilai Rp ${totalAmount.toLocaleString('id-ID')}`);

      await conn.commit();

      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');

      return {
        id_transaksi: orderNo,
        tanggal: `${year}-${month}-${day}`,
        jam: `${hours}:${minutes}`,
        total_penjualan_rp: totalAmount,
        items: data.items.map(it => ({
          ...it,
          qty_porsi: parseInt(it.qty_porsi, 10) || 1,
          harga_satuan_rp: parseFloat(it.harga_satuan_rp) || 0,
          total_penjualan_rp: (parseInt(it.qty_porsi, 10) || 1) * (parseFloat(it.harga_satuan_rp) || 0)
        })),
        paymentMethod: method,
        paid: amountPaid,
        change: Math.max(0, changeAmount),
        status: 'selesai'
      };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  // --------------------------------------------------------------------------
  // 5. DAPUR & ANTREAN PRODUKSI
  // --------------------------------------------------------------------------
  async getKitchenQueue() {
    const orders = await query(`
      SELECT 
        o.id,
        o.order_no as id_transaksi,
        DATE_FORMAT(o.created_at, '%Y-%m-%d') as tanggal,
        DATE_FORMAT(o.created_at, '%H:%i') as jam,
        p.status as status_pesanan,
        o.customer_name,
        o.table_no,
        o.notes as catatan
      FROM productions p
      JOIN orders o ON o.id = p.order_id
      WHERE p.status != 'selesai' AND o.order_status != 'dibatalkan'
      ORDER BY o.id ASC
    `);

    // Tambahkan item detail untuk setiap pesanan antrean
    for (const ord of orders) {
      const items = await query(`
        SELECT 
          m.code as kode_menu,
          m.name as nama_menu,
          od.qty_portions as qty_porsi
        FROM order_details od
        JOIN menus m ON m.id = od.menu_id
        WHERE od.order_id = ?
      `, [ord.id]);

      ord.items = items;
      ord.total_porsi = items.reduce((sum, it) => sum + it.qty_porsi, 0);
    }

    return orders;
  }

  async updateKitchenStatus(orderNo, newStatus, user) {
    const validStatuses = ['menunggu_proses', 'diproses', 'siap', 'selesai'];
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Status tidak valid. Pilihan: ${validStatuses.join(', ')}`);
    }

    const [orderRow] = await query('SELECT id FROM orders WHERE order_no = ?', [orderNo]);
    if (!orderRow) throw new Error(`Pesanan ${orderNo} tidak ditemukan.`);

    const conn = await getConnection();
    await conn.beginTransaction();

    try {
      await conn.query(`
        UPDATE productions 
        SET status = ?, 
            completed_at = CASE WHEN ? = 'selesai' THEN NOW() ELSE completed_at END,
            processed_by = ?
        WHERE order_id = ?
      `, [newStatus, newStatus, user?.id || null, orderRow.id]);

      await conn.query(`
        UPDATE orders 
        SET order_status = ?
        WHERE id = ?
      `, [newStatus, orderRow.id]);

      await this.logAudit(conn, user?.id, 'UPDATE_STATUS_DAPUR', 'KITCHEN', `Memperbarui status pesanan ${orderNo} menjadi ${newStatus}`);
      await conn.commit();

      return { id_transaksi: orderNo, status_pesanan: newStatus };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  // --------------------------------------------------------------------------
  // 6. BARANG MASUK & PENGADAAN
  // --------------------------------------------------------------------------
  async getBarangMasuk(filters = {}) {
    let sql = `
      SELECT 
        si.id,
        DATE_FORMAT(si.received_date, '%Y-%m-%d') as tanggal,
        i.code as kode_bahan,
        i.name as nama_bahan,
        si.qty_in as qty_masuk,
        si.unit as satuan,
        si.type as jenis,
        si.data_status as status_data,
        si.notes as catatan
      FROM stock_in si
      JOIN ingredients i ON i.id = si.ingredient_id
      WHERE 1=1
    `;
    const params = [];

    if (filters.search) {
      sql += ' AND (i.name LIKE ? OR i.code LIKE ?)';
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    sql += ' ORDER BY si.received_date DESC, si.id DESC';
    const rows = await query(sql, params);
    return rows.map(r => ({
      ...r,
      qty_masuk: parseFloat(r.qty_masuk) || 0
    }));
  }

  async addBarangMasuk(data, user) {
    if (!data.kode_bahan || !data.qty_masuk) {
      throw new Error('Kode bahan dan jumlah barang masuk wajib diisi.');
    }

    const [ingRow] = await query('SELECT id, name, usage_unit FROM ingredients WHERE code = ?', [data.kode_bahan]);
    if (!ingRow) throw new Error(`Bahan dengan kode ${data.kode_bahan} tidak ditemukan.`);

    const conn = await getConnection();
    await conn.beginTransaction();

    try {
      const qtyIn = parseFloat(data.qty_masuk);
      const unit = data.satuan || ingRow.usage_unit;
      const tgl = data.tanggal || new Date().toISOString().slice(0, 10);
      const jenis = data.jenis || 'PEMBELIAN';
      const notes = data.catatan || null;

      // 1. Simpan ke stock_in
      await conn.query(`
        INSERT INTO stock_in (
          ingredient_id, qty_in, unit, received_date, type, supplier_name, data_status, user_id, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, 'Pemasok Terpilih', 'AKTUAL', ?, ?, NOW())
      `, [ingRow.id, qtyIn, unit, tgl, jenis, user?.id || null, notes]);

      // 2. Tambah stok di inventory
      const [invRow] = await conn.query('SELECT current_stock FROM inventory WHERE ingredient_id = ? FOR UPDATE', [ingRow.id]);
      const before = invRow ? parseFloat(invRow.current_stock) : 0;
      const after = before + qtyIn;

      await conn.query(`
        UPDATE inventory 
        SET current_stock = ?, last_updated_at = CURRENT_TIMESTAMP
        WHERE ingredient_id = ?
      `, [after, ingRow.id]);

      // 3. Catat mutasi stock_movements
      await conn.query(`
        INSERT INTO stock_movements (
          ingredient_id, movement_type, quantity, unit, balance_before, balance_after, reference_type, reference_id, user_id, notes, created_at
        ) VALUES (?, 'IN_PURCHASE', ?, ?, ?, ?, 'STOCK_IN', 'MANUAL-IN', ?, ?, NOW())
      `, [ingRow.id, qtyIn, unit, before, after, user?.id || null, notes || 'Penerimaan barang masuk']);

      await this.logAudit(conn, user?.id, 'BARANG_MASUK', 'INVENTORY', `Penerimaan barang: ${qtyIn} ${unit} ${ingRow.name}`);
      await conn.commit();

      return { kode_bahan: data.kode_bahan, nama_bahan: ingRow.name, qty_masuk: qtyIn, stok_tersedia: after };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  // --------------------------------------------------------------------------
  // 7. RESEP BOM
  // --------------------------------------------------------------------------
  async getResep(filters = {}) {
    let sql = `
      SELECT 
        b.id,
        m.code as kode_menu,
        m.name as nama_menu,
        i.code as kode_bahan,
        i.name as nama_bahan,
        b.quantity_per_portion as qty_per_menu,
        b.unit as satuan,
        b.data_status as status_data,
        b.notes as catatan
      FROM bom_details b
      JOIN menus m ON m.id = b.menu_id
      JOIN ingredients i ON i.id = b.ingredient_id
      WHERE 1=1
    `;
    const params = [];

    if (filters.kode_menu) {
      sql += ' AND m.code = ?';
      params.push(filters.kode_menu);
    }
    if (filters.search) {
      sql += ' AND (m.name LIKE ? OR i.name LIKE ?)';
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    sql += ' ORDER BY m.code ASC, i.code ASC';
    const rows = await query(sql, params);
    return rows.map(r => ({
      ...r,
      qty_per_menu: parseFloat(r.qty_per_menu) || 0
    }));
  }

  async addResep(data, user) {
    if (!data.kode_menu || !data.kode_bahan || !data.qty_per_menu) {
      throw new Error('Kode menu, kode bahan, dan takaran per menu wajib diisi.');
    }

    const [menu] = await query('SELECT id, name FROM menus WHERE code = ?', [data.kode_menu]);
    if (!menu) throw new Error(`Menu dengan kode ${data.kode_menu} tidak ditemukan.`);

    const [ing] = await query('SELECT id, name, usage_unit FROM ingredients WHERE code = ?', [data.kode_bahan]);
    if (!ing) throw new Error(`Bahan dengan kode ${data.kode_bahan} tidak ditemukan.`);

    const qty = parseFloat(data.qty_per_menu);
    const unit = data.satuan || ing.usage_unit;
    const notes = data.catatan || null;

    await query(`
      INSERT INTO bom_details (menu_id, ingredient_id, quantity_per_portion, unit, data_status, notes)
      VALUES (?, ?, ?, ?, 'TERVERIFIKASI', ?)
      ON DUPLICATE KEY UPDATE 
        quantity_per_portion = VALUES(quantity_per_portion),
        unit = VALUES(unit),
        notes = VALUES(notes)
    `, [menu.id, ing.id, qty, unit, notes]);

    await this.logAudit(null, user?.id, 'UPDATE_BOM', 'BOM', `Resep ${menu.name} - ${ing.name}: ${qty} ${unit}`);
    return { kode_menu: data.kode_menu, kode_bahan: data.kode_bahan, qty_per_menu: qty, satuan: unit };
  }

  async deleteResep(menuCode, ingCode, user) {
    const [menu] = await query('SELECT id FROM menus WHERE code = ?', [menuCode]);
    const [ing] = await query('SELECT id FROM ingredients WHERE code = ?', [ingCode]);
    if (!menu || !ing) throw new Error('Menu atau bahan tidak valid.');

    await query('DELETE FROM bom_details WHERE menu_id = ? AND ingredient_id = ?', [menu.id, ing.id]);
    await this.logAudit(null, user?.id, 'HAPUS_BOM', 'BOM', `Menghapus takaran bahan ${ingCode} dari menu ${menuCode}`);
    return true;
  }

  // --------------------------------------------------------------------------
  // 8. LAPORAN PEMAKAIAN, KARTU STOK & SS-ROP
  // --------------------------------------------------------------------------
  async getPemakaianHarian(filters = {}) {
    let sql = `
      SELECT 
        DATE_FORMAT(su.date, '%Y-%m-%d') as tanggal,
        i.code as kode_bahan,
        i.name as nama_bahan,
        su.unit as satuan,
        su.daily_total_usage as total_pemakaian,
        su.data_status as status_data,
        su.notes as catatan
      FROM stock_usage su
      JOIN ingredients i ON i.id = su.ingredient_id
      WHERE 1=1
    `;
    const params = [];

    if (filters.search) {
      sql += ' AND (i.name LIKE ? OR i.code LIKE ?)';
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    sql += ' ORDER BY su.date DESC, i.code ASC';
    const rows = await query(sql, params);
    return rows.map(r => ({
      ...r,
      total_pemakaian: parseFloat(r.total_pemakaian) || 0
    }));
  }

  async getPemakaianDetail(filters = {}) {
    // Generate detail pemakaian dari orders x order_details x bom_details
    let sql = `
      SELECT 
        o.order_no as id_transaksi,
        DATE_FORMAT(o.created_at, '%Y-%m-%d') as tanggal,
        m.code as kode_menu,
        m.name as nama_menu,
        od.qty_portions as qty_porsi,
        i.code as kode_bahan,
        i.name as nama_bahan,
        b.quantity_per_portion as qty_per_menu,
        b.unit as satuan,
        (od.qty_portions * b.quantity_per_portion) as total_pemakaian_bahan,
        'HASIL PERHITUNGAN' as status_data,
        'Perhitungan kuantitas transaksi x takaran resep' as catatan
      FROM orders o
      JOIN order_details od ON od.order_id = o.id
      JOIN menus m ON m.id = od.menu_id
      JOIN bom_details b ON b.menu_id = m.id
      JOIN ingredients i ON i.id = b.ingredient_id
      WHERE 1=1
    `;
    const params = [];

    if (filters.id_transaksi) {
      sql += ' AND o.order_no = ?';
      params.push(filters.id_transaksi);
    }

    sql += ' ORDER BY o.id DESC, m.code ASC LIMIT 1000';
    const rows = await query(sql, params);
    return rows.map(r => ({
      ...r,
      qty_per_menu: parseFloat(r.qty_per_menu) || 0,
      total_pemakaian_bahan: parseFloat(r.total_pemakaian_bahan) || 0
    }));
  }

  async getKartuStok(filters = {}) {
    // Rekap mutasi kartu stok dari stock_usage, stock_in, dan saldo inventory
    let sql = `
      SELECT 
        DATE_FORMAT(su.date, '%Y-%m-%d') as tanggal,
        i.code as kode_bahan,
        i.name as nama_bahan,
        0 as stok_awal_hari,
        COALESCE(si.qty_masuk, 0) as barang_masuk,
        su.daily_total_usage as pemakaian,
        0 as stok_akhir_hari,
        su.unit as satuan,
        'HASIL PERHITUNGAN' as status_data,
        'Rekapitulasi mutasi stok harian' as catatan
      FROM stock_usage su
      JOIN ingredients i ON i.id = su.ingredient_id
      LEFT JOIN (
        SELECT received_date, ingredient_id, SUM(qty_in) as qty_masuk
        FROM stock_in
        GROUP BY received_date, ingredient_id
      ) si ON si.received_date = su.date AND si.ingredient_id = su.ingredient_id
      WHERE 1=1
    `;
    const params = [];

    if (filters.search) {
      sql += ' AND (i.name LIKE ? OR i.code LIKE ?)';
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    sql += ' ORDER BY su.date DESC, i.code ASC';
    const rows = await query(sql, params);
    return rows.map(r => ({
      ...r,
      barang_masuk: parseFloat(r.barang_masuk) || 0,
      pemakaian: parseFloat(r.pemakaian) || 0
    }));
  }

  async getSsRop(filters = {}) {
    let sql = `
      SELECT 
        i.code as kode_bahan,
        i.name as nama_bahan,
        i.usage_unit as satuan,
        ROUND(ip.avg_daily_usage * 7, 2) as total_pemakaian_7_hari,
        ip.avg_daily_usage as rata_rata_per_hari,
        ip.max_daily_usage as maksimum_per_hari,
        ip.lead_time_days as lead_time_hari_asumsi,
        ip.safety_stock,
        ip.reorder_point,
        CEIL(ip.reorder_point) as rekomendasi_pembelian,
        inv.current_stock as stok_tersedia,
        CASE 
          WHEN inv.current_stock <= ip.safety_stock THEN 'Harus Restock'
          WHEN inv.current_stock <= ip.reorder_point THEN 'Perlu Perhatian'
          ELSE 'Aman'
        END as status_stok
      FROM inventory_parameters ip
      JOIN ingredients i ON i.id = ip.ingredient_id
      LEFT JOIN inventory inv ON inv.ingredient_id = i.id
      WHERE i.is_active = 1
    `;
    const params = [];

    if (filters.search) {
      sql += ' AND (i.name LIKE ? OR i.code LIKE ?)';
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    sql += ' ORDER BY i.code ASC';
    const rows = await query(sql, params);
    return rows.map(r => ({
      ...r,
      total_pemakaian_7_hari: parseFloat(r.total_pemakaian_7_hari) || 0,
      rata_rata_per_hari: parseFloat(r.rata_rata_per_hari) || 0,
      maksimum_per_hari: parseFloat(r.maksimum_per_hari) || 0,
      safety_stock: parseFloat(r.safety_stock) || 0,
      reorder_point: parseFloat(r.reorder_point) || 0,
      stok_tersedia: parseFloat(r.stok_tersedia) || 0
    }));
  }

  // --------------------------------------------------------------------------
  // 9. AUDIT LOGS
  // --------------------------------------------------------------------------
  async getAuditLogs() {
    const rows = await query(`
      SELECT 
        al.id,
        DATE_FORMAT(al.created_at, '%Y-%m-%d %H:%i:%s') as timestamp,
        COALESCE(u.username, 'system') as username,
        COALESCE(u.name, 'Sistem Antigravity') as user_name,
        COALESCE(r.name, 'SYSTEM') as role,
        al.action,
        al.module,
        al.details,
        al.data_before,
        al.data_after
      FROM activity_logs al
      LEFT JOIN users u ON u.id = al.user_id
      LEFT JOIN roles r ON r.id = u.role_id
      ORDER BY al.id DESC
      LIMIT 200
    `);
    return rows;
  }
}

module.exports = new MySQLDataService();
