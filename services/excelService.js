const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const os = require('os');
const storageService = require('./storageService');
const inventoryService = require('./inventoryService');

const isVercel = Boolean(process.env.VERCEL);
const BUNDLE_AUDIT_LOG_FILE = path.join(__dirname, '..', 'data', 'audit_log.json');
const AUDIT_LOG_FILE = isVercel ? path.join(os.tmpdir(), 'bebek_sanjay_audit.json') : BUNDLE_AUDIT_LOG_FILE;

if (isVercel && !fs.existsSync(AUDIT_LOG_FILE) && fs.existsSync(BUNDLE_AUDIT_LOG_FILE)) {
  try {
    fs.copyFileSync(BUNDLE_AUDIT_LOG_FILE, AUDIT_LOG_FILE);
  } catch (e) {}
}

class ExcelService {
  constructor() {
    this.workbook = null;
    this.filePath = storageService.getWorkbookPath();
    this.writeQueue = Promise.resolve();
    this.cache = {
      menu: [],
      bahan: [],
      transaksi: [],
      resep: [],
      pemakaianDetail: [],
      pemakaianHarian: [],
      stokAwal: [],
      barangMasuk: [],
      kartuStok: [],
      ssRop: [],
      auditLog: []
    };
    this.isLoaded = false;
    this.loadPromise = this.init();
  }

  async init() {
    await this.loadWorkbook();
  }

  async loadWorkbook() {
    if (!fs.existsSync(this.filePath)) {
      throw new Error(`Excel file not found at ${this.filePath}`);
    }

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(this.filePath);
    this.workbook = wb;

    this.parseAllSheets();
    this.loadAuditLogs();
    this.isLoaded = true;
    console.log('✅ Excel workbook loaded successfully into memory.');
  }

  parseAllSheets() {
    // 1. MASTER_MENU
    const menuSheet = this.workbook.getWorksheet('MASTER_MENU');
    this.cache.menu = [];
    if (menuSheet) {
      menuSheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const kode = row.getCell(1).value;
        if (!kode) return;
        this.cache.menu.push({
          kode_menu: kode,
          nama_menu: String(row.getCell(2).value || ''),
          kategori: String(row.getCell(3).value || ''),
          harga_satuan_rp: Number(row.getCell(4).value) || 0,
          status_harga: String(row.getCell(5).value || 'HARGA AKTUAL'),
          catatan: String(row.getCell(6).value || '')
        });
      });
    }

    // 2. MASTER_BAHAN
    const bahanSheet = this.workbook.getWorksheet('MASTER_BAHAN');
    this.cache.bahan = [];
    if (bahanSheet) {
      bahanSheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const kode = row.getCell(1).value;
        if (!kode) return;
        this.cache.bahan.push({
          kode_bahan: String(kode),
          nama_bahan: String(row.getCell(2).value || ''),
          satuan_pemakaian: String(row.getCell(3).value || ''),
          status_data: String(row.getCell(4).value || 'AKTUAL'),
          catatan: String(row.getCell(5).value || '')
        });
      });
    }

    // 3. TRANSAKSI_210
    const trxSheet = this.workbook.getWorksheet('TRANSAKSI_210');
    this.cache.transaksi = [];
    if (trxSheet) {
      trxSheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const idTrx = row.getCell(1).value;
        if (!idTrx) return;
        this.cache.transaksi.push({
          id_transaksi: String(idTrx),
          tanggal: this.formatDate(row.getCell(2).value),
          jam: this.formatTime(row.getCell(3).value),
          kode_menu: row.getCell(4).value,
          nama_menu: String(row.getCell(5).value || ''),
          kategori: String(row.getCell(6).value || ''),
          qty_porsi: Number(row.getCell(7).value) || 0,
          harga_satuan_rp: Number(row.getCell(8).value) || 0,
          total_penjualan_rp: Number(row.getCell(9).value) || 0,
          status_data: String(row.getCell(10).value || 'AKTUAL'),
          catatan: String(row.getCell(11).value || '')
        });
      });
    }

    // 4. RESEP_BOM
    const resepSheet = this.workbook.getWorksheet('RESEP_BOM');
    this.cache.resep = [];
    if (resepSheet) {
      resepSheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const kodeMenu = row.getCell(1).value;
        if (!kodeMenu) return;
        this.cache.resep.push({
          kode_menu: kodeMenu,
          nama_menu: String(row.getCell(2).value || ''),
          kode_bahan: String(row.getCell(3).value || ''),
          nama_bahan: String(row.getCell(4).value || ''),
          qty_per_menu: Number(row.getCell(5).value) || 0,
          satuan: String(row.getCell(6).value || ''),
          status_data: String(row.getCell(7).value || 'TERVERIFIKASI'),
          catatan: String(row.getCell(8).value || '')
        });
      });
    }

    // 5. PEMAKAIAN_DETAIL
    const detailSheet = this.workbook.getWorksheet('PEMAKAIAN_DETAIL');
    this.cache.pemakaianDetail = [];
    if (detailSheet) {
      detailSheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const idTrx = row.getCell(1).value;
        if (!idTrx) return;
        this.cache.pemakaianDetail.push({
          id_transaksi: String(idTrx),
          tanggal: this.formatDate(row.getCell(2).value),
          kode_menu: row.getCell(3).value,
          nama_menu: String(row.getCell(4).value || ''),
          qty_porsi: Number(row.getCell(5).value) || 0,
          kode_bahan: String(row.getCell(6).value || ''),
          nama_bahan: String(row.getCell(7).value || ''),
          qty_per_menu: Number(row.getCell(8).value) || 0,
          satuan: String(row.getCell(9).value || ''),
          total_pemakaian_bahan: Number(row.getCell(10).value) || 0,
          status_data: String(row.getCell(11).value || 'HASIL PERHITUNGAN'),
          catatan: String(row.getCell(12).value || '')
        });
      });
    }

    // 6. PEMAKAIAN_HARIAN
    const harianSheet = this.workbook.getWorksheet('PEMAKAIAN_HARIAN');
    this.cache.pemakaianHarian = [];
    if (harianSheet) {
      harianSheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const tgl = row.getCell(1).value;
        if (!tgl) return;
        this.cache.pemakaianHarian.push({
          tanggal: this.formatDate(tgl),
          kode_bahan: String(row.getCell(2).value || ''),
          nama_bahan: String(row.getCell(3).value || ''),
          satuan: String(row.getCell(4).value || ''),
          total_pemakaian: Number(row.getCell(5).value) || 0,
          status_data: String(row.getCell(6).value || 'HASIL REKAPITULASI'),
          catatan: String(row.getCell(7).value || '')
        });
      });
    }

    // 7. STOK_AWAL
    const awalSheet = this.workbook.getWorksheet('STOK_AWAL');
    this.cache.stokAwal = [];
    if (awalSheet) {
      awalSheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const kode = row.getCell(1).value;
        if (!kode) return;
        this.cache.stokAwal.push({
          kode_bahan: String(kode),
          nama_bahan: String(row.getCell(2).value || ''),
          satuan: String(row.getCell(3).value || ''),
          stok_awal: Number(row.getCell(4).value) || 0,
          status_data: String(row.getCell(5).value || 'AKTUAL'),
          catatan: String(row.getCell(6).value || '')
        });
      });
    }

    // 8. BARANG_MASUK
    const masukSheet = this.workbook.getWorksheet('BARANG_MASUK');
    this.cache.barangMasuk = [];
    if (masukSheet) {
      masukSheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const tgl = row.getCell(1).value;
        if (!tgl) return;
        this.cache.barangMasuk.push({
          tanggal: this.formatDate(tgl),
          kode_bahan: String(row.getCell(2).value || ''),
          nama_bahan: String(row.getCell(3).value || ''),
          qty_masuk: Number(row.getCell(4).value) || 0,
          satuan: String(row.getCell(5).value || ''),
          jenis: String(row.getCell(6).value || 'PEMBELIAN'),
          status_data: String(row.getCell(7).value || 'AKTUAL'),
          catatan: String(row.getCell(8).value || '')
        });
      });
    }

    // 9. KARTU_STOK_HARIAN
    const kartuSheet = this.workbook.getWorksheet('KARTU_STOK_HARIAN');
    this.cache.kartuStok = [];
    if (kartuSheet) {
      kartuSheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const tgl = row.getCell(1).value;
        if (!tgl) return;
        this.cache.kartuStok.push({
          tanggal: this.formatDate(tgl),
          kode_bahan: String(row.getCell(2).value || ''),
          nama_bahan: String(row.getCell(3).value || ''),
          stok_awal_hari: Number(row.getCell(4).value) || 0,
          barang_masuk: Number(row.getCell(5).value) || 0,
          pemakaian: Number(row.getCell(6).value) || 0,
          stok_akhir_hari: Number(row.getCell(7).value) || 0,
          satuan: String(row.getCell(8).value || ''),
          status_data: String(row.getCell(9).value || 'HASIL PERHITUNGAN'),
          catatan: String(row.getCell(10).value || '')
        });
      });
    }

    // 10. PERHITUNGAN_SS_ROP
    const ssSheet = this.workbook.getWorksheet('PERHITUNGAN_SS_ROP');
    this.cache.ssRop = [];
    if (ssSheet) {
      ssSheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const kode = row.getCell(1).value;
        if (!kode) return;
        this.cache.ssRop.push({
          kode_bahan: String(kode),
          nama_bahan: String(row.getCell(2).value || ''),
          satuan: String(row.getCell(3).value || ''),
          total_pemakaian_7_hari: Number(row.getCell(4).value) || 0,
          rata_rata_per_hari: Number(row.getCell(5).value) || 0,
          maksimum_per_hari: Number(row.getCell(6).value) || 0,
          lead_time_hari_asumsi: Number(row.getCell(7).value) || 1,
          safety_stock: Number(row.getCell(8).value) || 0,
          reorder_point: Number(row.getCell(9).value) || 0,
          status_data: String(row.getCell(10).value || 'HASIL PERHITUNGAN'),
          catatan: String(row.getCell(11).value || '')
        });
      });
    }
  }

  loadAuditLogs() {
    try {
      if (fs.existsSync(AUDIT_LOG_FILE)) {
        this.cache.auditLog = JSON.parse(fs.readFileSync(AUDIT_LOG_FILE, 'utf8'));
      }
    } catch (e) {
      console.warn('Could not read audit log JSON:', e.message);
    }
  }

  formatDate(val) {
    if (!val) return '';
    if (val instanceof Date) {
      const pad = n => String(n).padStart(2, '0');
      return `${val.getFullYear()}-${pad(val.getMonth() + 1)}-${pad(val.getDate())}`;
    }
    const str = String(val).trim();
    if (str.includes('T')) return str.split('T')[0];
    if (str.includes(' ')) {
      // Check if it's like "Sun Nov 01 2026..."
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        const pad = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      }
    }
    return str;
  }

  formatTime(val) {
    if (!val) return '12:00';
    if (val instanceof Date) {
      const pad = n => String(n).padStart(2, '0');
      return `${pad(val.getHours())}:${pad(val.getMinutes())}`;
    }
    return String(val).substring(0, 5);
  }

  /**
   * Thread-safe Queue for all write operations (Sequential Mutex)
   */
  enqueueWrite(fn) {
    const next = (async () => {
      try {
        await this.writeQueue;
      } catch (ignored) {
        // Previous operation error does not block subsequent queue tasks
      }
      return await fn();
    })();

    this.writeQueue = next.catch(() => {});
    return next;
  }

  /**
   * Write workbook to disk, create safety backup, and sync to cloud
   */
  async persistWorkbook(actionName = 'update') {
    // 1. Create timestamped backup of current file
    await storageService.createBackup(actionName);

    // 2. Write file
    await this.workbook.xlsx.writeFile(this.filePath);

    // 3. Trigger cloud sync if available
    storageService.syncToCloud().catch(err => console.warn('Background cloud sync:', err.message));
  }

  /**
   * Log an audit activity both to JSON and in-memory
   */
  logAudit(user, action, sheet, details, before = null, after = null) {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const tanggal = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const jam = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    const logEntry = {
      id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: now.toISOString(),
      tanggal,
      jam,
      username: user ? user.username : 'system',
      role: user ? user.role : 'SYSTEM',
      action,
      sheet,
      details,
      before,
      after
    };

    this.cache.auditLog.unshift(logEntry);
    if (this.cache.auditLog.length > 500) {
      this.cache.auditLog = this.cache.auditLog.slice(0, 500);
    }

    try {
      fs.writeFileSync(AUDIT_LOG_FILE, JSON.stringify(this.cache.auditLog, null, 2), 'utf8');
    } catch (e) {
      console.warn('Failed writing audit log:', e.message);
    }

    return logEntry;
  }

  /* ==========================================================================
     DASHBOARD STATISTICS & ANALYTICS
     ========================================================================== */
  getDashboardStats() {
    // Total Penjualan
    const totalPenjualan = this.cache.transaksi.reduce((sum, t) => sum + (Number(t.total_penjualan_rp) || 0), 0);
    const totalTransaksi = new Set(this.cache.transaksi.map(t => t.id_transaksi)).size;
    const totalMenu = this.cache.menu.length;
    const totalBahan = this.cache.bahan.length;

    // Calculate current stock levels from latest KARTU_STOK_HARIAN or STOK_AWAL
    const currentStockMap = this.getCurrentStockMap();

    // Check low stock & restock needed using PERHITUNGAN_SS_ROP
    let stokMenipisCount = 0; // Perlu Perhatian
    let perluRestockCount = 0; // Harus Restock
    const bahanStatusList = [];

    for (const ss of this.cache.ssRop) {
      const stock = currentStockMap[ss.kode_bahan] ?? 0;
      const status = inventoryService.determineStockStatus(stock, ss.safety_stock, ss.reorder_point);
      if (status === 'Harus Restock') perluRestockCount++;
      if (status === 'Perlu Perhatian') stokMenipisCount++;

      bahanStatusList.push({
        kode_bahan: ss.kode_bahan,
        nama_bahan: ss.nama_bahan,
        satuan: ss.satuan,
        stok_tersedia: Math.round(stock * 100) / 100,
        rata_rata_per_hari: ss.rata_rata_per_hari,
        safety_stock: ss.safety_stock,
        reorder_point: ss.reorder_point,
        status_stok: status
      });
    }

    // 1. Grafik Penjualan Harian
    const salesByDate = {};
    for (const t of this.cache.transaksi) {
      const date = t.tanggal;
      salesByDate[date] = (salesByDate[date] || 0) + (Number(t.total_penjualan_rp) || 0);
    }
    const salesChart = {
      labels: Object.keys(salesByDate).sort(),
      data: Object.keys(salesByDate).sort().map(d => salesByDate[d])
    };

    // 2. Grafik Menu Terlaris (Top 8)
    const menuSalesCount = {};
    for (const t of this.cache.transaksi) {
      const name = t.nama_menu;
      menuSalesCount[name] = (menuSalesCount[name] || 0) + (Number(t.qty_porsi) || 0);
    }
    const sortedMenus = Object.entries(menuSalesCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
    const topMenuChart = {
      labels: sortedMenus.map(m => m[0]),
      data: sortedMenus.map(m => m[1])
    };

    // 3. Grafik Pemakaian Bahan (Top 8 Bahan Baku terbanyak)
    const sortedMaterials = [...this.cache.ssRop]
      .sort((a, b) => b.total_pemakaian_7_hari - a.total_pemakaian_7_hari)
      .slice(0, 8);
    const materialUsageChart = {
      labels: sortedMaterials.map(m => m.nama_bahan),
      data: sortedMaterials.map(m => m.total_pemakaian_7_hari),
      units: sortedMaterials.map(m => m.satuan)
    };

    // 4. Pergerakan Persediaan (Stok Akhir vs ROP)
    const stockVsRop = sortedMaterials.map(m => ({
      name: m.nama_bahan,
      current: currentStockMap[m.kode_bahan] ?? 0,
      rop: m.reorder_point,
      ss: m.safety_stock
    }));

    return {
      cards: {
        totalPenjualan,
        totalTransaksi,
        totalMenu,
        totalBahan,
        stokMenipisCount,
        perluRestockCount
      },
      charts: {
        salesChart,
        topMenuChart,
        materialUsageChart,
        stockVsRop
      },
      criticalBahan: bahanStatusList.filter(b => b.status_stok !== 'Stok Aman')
    };
  }

  getCurrentStockMap() {
    const stockMap = {};

    // Base initial stock
    for (const item of this.cache.stokAwal) {
      stockMap[item.kode_bahan] = Number(item.stok_awal) || 0;
    }

    // Sort kartu stok by date ascending to find the absolute latest balance
    const sortedKartu = [...this.cache.kartuStok].sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));
    for (const row of sortedKartu) {
      stockMap[row.kode_bahan] = Number(row.stok_akhir_hari) || 0;
    }

    return stockMap;
  }

  /* ==========================================================================
     MENU MANAGEMENT (MASTER_MENU)
     ========================================================================== */
  getMenu(filters = {}) {
    let list = [...this.cache.menu];
    if (filters.kategori) {
      list = list.filter(m => m.kategori.toLowerCase() === filters.kategori.toLowerCase());
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(m => m.nama_menu.toLowerCase().includes(q) || String(m.kode_menu).includes(q));
    }
    return list;
  }

  async addMenu(data, user) {
    return this.enqueueWrite(async () => {
      const sheet = this.workbook.getWorksheet('MASTER_MENU');
      
      // Auto-assign next code if not provided
      let nextCode = Number(data.kode_menu);
      if (!nextCode) {
        const existingCodes = this.cache.menu.map(m => Number(m.kode_menu)).filter(n => !isNaN(n));
        nextCode = existingCodes.length > 0 ? Math.max(...existingCodes) + 1 : 1;
      }

      const newMenu = {
        kode_menu: nextCode,
        nama_menu: data.nama_menu.trim(),
        kategori: data.kategori ? data.kategori.trim() : 'Bumbu Hitam',
        harga_satuan_rp: Number(data.harga_satuan_rp) || 0,
        status_harga: data.status_harga || 'HARGA AKTUAL',
        catatan: data.catatan || 'Ditambahkan via aplikasi'
      };

      sheet.addRow([
        newMenu.kode_menu,
        newMenu.nama_menu,
        newMenu.kategori,
        newMenu.harga_satuan_rp,
        newMenu.status_harga,
        newMenu.catatan
      ]);

      this.cache.menu.push(newMenu);
      await this.persistWorkbook('tambah_menu');
      this.logAudit(user, 'TAMBAH_MENU', 'MASTER_MENU', `Menambahkan menu: ${newMenu.nama_menu} (Rp ${newMenu.harga_satuan_rp})`, null, newMenu);

      return newMenu;
    });
  }

  async updateMenu(kode_menu, data, user) {
    return this.enqueueWrite(async () => {
      const sheet = this.workbook.getWorksheet('MASTER_MENU');
      const idx = this.cache.menu.findIndex(m => String(m.kode_menu) === String(kode_menu));
      if (idx === -1) throw new Error('Menu tidak ditemukan');

      const before = { ...this.cache.menu[idx] };
      const after = {
        ...before,
        nama_menu: data.nama_menu !== undefined ? data.nama_menu.trim() : before.nama_menu,
        kategori: data.kategori !== undefined ? data.kategori.trim() : before.kategori,
        harga_satuan_rp: data.harga_satuan_rp !== undefined ? Number(data.harga_satuan_rp) : before.harga_satuan_rp,
        status_harga: data.status_harga !== undefined ? data.status_harga : before.status_harga,
        catatan: data.catatan !== undefined ? data.catatan : before.catatan
      };

      this.cache.menu[idx] = after;

      // Update row in worksheet
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        if (String(row.getCell(1).value) === String(kode_menu)) {
          row.getCell(2).value = after.nama_menu;
          row.getCell(3).value = after.kategori;
          row.getCell(4).value = after.harga_satuan_rp;
          row.getCell(5).value = after.status_harga;
          row.getCell(6).value = after.catatan;
        }
      });

      await this.persistWorkbook('update_menu');
      this.logAudit(user, 'UPDATE_MENU', 'MASTER_MENU', `Memperbarui menu kode ${kode_menu}`, before, after);

      return after;
    });
  }

  async deleteMenu(kode_menu, user) {
    return this.enqueueWrite(async () => {
      const sheet = this.workbook.getWorksheet('MASTER_MENU');
      const idx = this.cache.menu.findIndex(m => String(m.kode_menu) === String(kode_menu));
      if (idx === -1) throw new Error('Menu tidak ditemukan');

      const target = this.cache.menu[idx];
      let rowToDelete = null;

      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        if (String(row.getCell(1).value) === String(kode_menu)) {
          rowToDelete = rowNumber;
        }
      });

      if (rowToDelete) {
        sheet.spliceRows(rowToDelete, 1);
      }

      this.cache.menu.splice(idx, 1);
      await this.persistWorkbook('hapus_menu');
      this.logAudit(user, 'HAPUS_MENU', 'MASTER_MENU', `Menghapus menu: ${target.nama_menu} (${kode_menu})`, target, null);

      return true;
    });
  }

  /* ==========================================================================
     BAHAN BAKU (MASTER_BAHAN)
     ========================================================================== */
  getBahan(filters = {}) {
    const currentStock = this.getCurrentStockMap();
    let list = this.cache.bahan.map(b => ({
      ...b,
      stok_saat_ini: currentStock[b.kode_bahan] ?? 0
    }));

    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(b => b.nama_bahan.toLowerCase().includes(q) || b.kode_bahan.toLowerCase().includes(q));
    }
    return list;
  }

  async addBahan(data, user) {
    return this.enqueueWrite(async () => {
      const sheet = this.workbook.getWorksheet('MASTER_BAHAN');
      let kode = data.kode_bahan;
      if (!kode) {
        const nums = this.cache.bahan
          .map(b => parseInt(b.kode_bahan.replace(/\D/g, ''), 10))
          .filter(n => !isNaN(n));
        const maxNum = nums.length > 0 ? Math.max(...nums) : 0;
        kode = `B${String(maxNum + 1).padStart(3, '0')}`;
      }

      const newBahan = {
        kode_bahan: kode,
        nama_bahan: data.nama_bahan.trim(),
        satuan_pemakaian: data.satuan_pemakaian ? data.satuan_pemakaian.trim() : 'gram',
        status_data: data.status_data || 'AKTUAL',
        catatan: data.catatan || 'Ditambahkan via aplikasi'
      };

      sheet.addRow([
        newBahan.kode_bahan,
        newBahan.nama_bahan,
        newBahan.satuan_pemakaian,
        newBahan.status_data,
        newBahan.catatan
      ]);

      this.cache.bahan.push(newBahan);

      // Add corresponding row to STOK_AWAL if specified
      if (data.stok_awal !== undefined) {
        const awalSheet = this.workbook.getWorksheet('STOK_AWAL');
        const awalItem = {
          kode_bahan: kode,
          nama_bahan: newBahan.nama_bahan,
          satuan: newBahan.satuan_pemakaian,
          stok_awal: Number(data.stok_awal) || 0,
          status_data: 'AKTUAL',
          catatan: 'Stok awal bahan baru'
        };
        awalSheet.addRow([
          awalItem.kode_bahan,
          awalItem.nama_bahan,
          awalItem.satuan,
          awalItem.stok_awal,
          awalItem.status_data,
          awalItem.catatan
        ]);
        this.cache.stokAwal.push(awalItem);
      }

      await this.persistWorkbook('tambah_bahan');
      this.logAudit(user, 'TAMBAH_BAHAN', 'MASTER_BAHAN', `Menambahkan bahan baku: ${newBahan.nama_bahan} (${newBahan.kode_bahan})`, null, newBahan);

      return newBahan;
    });
  }

  async updateBahan(kode_bahan, data, user) {
    return this.enqueueWrite(async () => {
      const sheet = this.workbook.getWorksheet('MASTER_BAHAN');
      const idx = this.cache.bahan.findIndex(b => b.kode_bahan === kode_bahan);
      if (idx === -1) throw new Error('Bahan baku tidak ditemukan');

      const before = { ...this.cache.bahan[idx] };
      const after = {
        ...before,
        nama_bahan: data.nama_bahan !== undefined ? data.nama_bahan.trim() : before.nama_bahan,
        satuan_pemakaian: data.satuan_pemakaian !== undefined ? data.satuan_pemakaian.trim() : before.satuan_pemakaian,
        status_data: data.status_data !== undefined ? data.status_data : before.status_data,
        catatan: data.catatan !== undefined ? data.catatan : before.catatan
      };

      this.cache.bahan[idx] = after;

      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        if (String(row.getCell(1).value) === kode_bahan) {
          row.getCell(2).value = after.nama_bahan;
          row.getCell(3).value = after.satuan_pemakaian;
          row.getCell(4).value = after.status_data;
          row.getCell(5).value = after.catatan;
        }
      });

      await this.persistWorkbook('update_bahan');
      this.logAudit(user, 'UPDATE_BAHAN', 'MASTER_BAHAN', `Memperbarui bahan baku ${kode_bahan}`, before, after);

      return after;
    });
  }

  /* ==========================================================================
     TRANSAKSI PENJUALAN (POS & CHECKOUT)
     Simpan transaksi -> Hitung BOM -> Update PEMAKAIAN_DETAIL ->
     Update PEMAKAIAN_HARIAN -> Update KARTU_STOK_HARIAN -> Update SS & ROP
     ========================================================================== */
  getTransaksi(filters = {}) {
    let list = [...this.cache.transaksi];
    if (filters.tanggal) {
      list = list.filter(t => t.tanggal === filters.tanggal);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(t =>
        t.id_transaksi.toLowerCase().includes(q) ||
        t.nama_menu.toLowerCase().includes(q) ||
        t.kategori.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => b.id_transaksi.localeCompare(a.id_transaksi));
  }

  async processNewTransaction({ items, paymentMethod, notes, idempotencyKey }, user) {
    return this.enqueueWrite(async () => {
      if (!items || items.length === 0) {
        throw new Error('Keranjang pesanan tidak boleh kosong.');
      }

      const now = new Date();
      const pad = n => String(n).padStart(2, '0');
      const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
      const dateNumStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;

      // Check duplicate transactions within the last 15 seconds with the same items
      if (idempotencyKey) {
        const isDuplicate = this.cache.transaksi.some(t => t.catatan && t.catatan.includes(`IDEM:${idempotencyKey}`));
        if (isDuplicate) {
          throw new Error('Transaksi telah diproses sebelumnya. Tidak boleh ada duplikasi transaksi.');
        }
      }

      // Generate next transaction ID: TRX-BSG-YYYYMMDD-XXX
      const todayPrefix = `TRX-BSG-${dateNumStr}-`;
      const todayTrxs = this.cache.transaksi
        .map(t => t.id_transaksi)
        .filter(id => id.startsWith(todayPrefix) || id.startsWith(`EST-BSG-${dateNumStr}-`));
      
      const nextSeq = todayTrxs.length + 1;
      const id_transaksi = `${todayPrefix}${String(nextSeq).padStart(3, '0')}`;

      const trxSheet = this.workbook.getWorksheet('TRANSAKSI_210');
      const detailSheet = this.workbook.getWorksheet('PEMAKAIAN_DETAIL');
      const harianSheet = this.workbook.getWorksheet('PEMAKAIAN_HARIAN');
      const kartuSheet = this.workbook.getWorksheet('KARTU_STOK_HARIAN');
      const ssSheet = this.workbook.getWorksheet('PERHITUNGAN_SS_ROP');

      const savedTransactionRows = [];
      let grandTotalRp = 0;

      // 1. Process items into TRANSAKSI_210
      for (const item of items) {
        const menuObj = this.cache.menu.find(m => String(m.kode_menu) === String(item.kode_menu));
        const nama_menu = menuObj ? menuObj.nama_menu : item.nama_menu;
        const kategori = menuObj ? menuObj.kategori : (item.kategori || 'Makanan');
        const harga_satuan_rp = Number(item.harga_satuan_rp) || (menuObj ? menuObj.harga_satuan_rp : 0);
        const qty_porsi = Number(item.qty_porsi) || 1;
        const total_penjualan_rp = harga_satuan_rp * qty_porsi;
        grandTotalRp += total_penjualan_rp;

        const catatan = `${paymentMethod || 'TUNAI'} | ${notes || 'Kasir POS'}${idempotencyKey ? ` [IDEM:${idempotencyKey}]` : ''}`;

        const trxRow = {
          id_transaksi,
          tanggal: dateStr,
          jam: timeStr,
          kode_menu: item.kode_menu,
          nama_menu,
          kategori,
          qty_porsi,
          harga_satuan_rp,
          total_penjualan_rp,
          status_data: 'AKTUAL',
          catatan
        };

        trxSheet.addRow([
          trxRow.id_transaksi,
          trxRow.tanggal,
          trxRow.jam,
          trxRow.kode_menu,
          trxRow.nama_menu,
          trxRow.kategori,
          trxRow.qty_porsi,
          trxRow.harga_satuan_rp,
          trxRow.total_penjualan_rp,
          trxRow.status_data,
          trxRow.catatan
        ]);

        this.cache.transaksi.push(trxRow);
        savedTransactionRows.push(trxRow);
      }

      // 2. Calculate BOM & Append to PEMAKAIAN_DETAIL
      const bomRequirements = inventoryService.calculateBomRequirements(items, this.cache.resep);
      for (const req of bomRequirements) {
        req.id_transaksi = id_transaksi;
        req.tanggal = dateStr;

        detailSheet.addRow([
          req.id_transaksi,
          req.tanggal,
          req.kode_menu,
          req.nama_menu,
          req.qty_porsi,
          req.kode_bahan,
          req.nama_bahan,
          req.qty_per_menu,
          req.satuan,
          req.total_pemakaian_bahan,
          req.status_data,
          req.catatan
        ]);

        this.cache.pemakaianDetail.push(req);
      }

      // 3. Aggregate today's material usages and Update PEMAKAIAN_HARIAN
      const materialUsageDelta = {};
      for (const req of bomRequirements) {
        materialUsageDelta[req.kode_bahan] = (materialUsageDelta[req.kode_bahan] || 0) + req.total_pemakaian_bahan;
      }

      for (const [kode_bahan, deltaUsage] of Object.entries(materialUsageDelta)) {
        const bahanMeta = this.cache.bahan.find(b => b.kode_bahan === kode_bahan);
        const nama_bahan = bahanMeta ? bahanMeta.nama_bahan : kode_bahan;
        const satuan = bahanMeta ? bahanMeta.satuan_pemakaian : 'gram';

        // Check if row exists for today in PEMAKAIAN_HARIAN
        const existingIdx = this.cache.pemakaianHarian.findIndex(
          p => p.tanggal === dateStr && p.kode_bahan === kode_bahan
        );

        if (existingIdx !== -1) {
          this.cache.pemakaianHarian[existingIdx].total_pemakaian += deltaUsage;

          // Update cell in sheet
          harianSheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;
            const rTgl = this.formatDate(row.getCell(1).value);
            const rKode = String(row.getCell(2).value);
            if (rTgl === dateStr && rKode === kode_bahan) {
              row.getCell(5).value = this.cache.pemakaianHarian[existingIdx].total_pemakaian;
            }
          });
        } else {
          const newHarian = {
            tanggal: dateStr,
            kode_bahan,
            nama_bahan,
            satuan,
            total_pemakaian: deltaUsage,
            status_data: 'HASIL REKAPITULASI',
            catatan: 'Rekapitulasi pemakaian bahan berdasarkan transaksi harian'
          };
          harianSheet.addRow([
            newHarian.tanggal,
            newHarian.kode_bahan,
            newHarian.nama_bahan,
            newHarian.satuan,
            newHarian.total_pemakaian,
            newHarian.status_data,
            newHarian.catatan
          ]);
          this.cache.pemakaianHarian.push(newHarian);
        }

        // 4. Update KARTU_STOK_HARIAN
        const kartuIdx = this.cache.kartuStok.findIndex(
          k => k.tanggal === dateStr && k.kode_bahan === kode_bahan
        );

        if (kartuIdx !== -1) {
          this.cache.kartuStok[kartuIdx].pemakaian += deltaUsage;
          this.cache.kartuStok[kartuIdx].stok_akhir_hari =
            this.cache.kartuStok[kartuIdx].stok_awal_hari +
            this.cache.kartuStok[kartuIdx].barang_masuk -
            this.cache.kartuStok[kartuIdx].pemakaian;

          kartuSheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;
            const rTgl = this.formatDate(row.getCell(1).value);
            const rKode = String(row.getCell(2).value);
            if (rTgl === dateStr && rKode === kode_bahan) {
              row.getCell(6).value = this.cache.kartuStok[kartuIdx].pemakaian;
              row.getCell(7).value = this.cache.kartuStok[kartuIdx].stok_akhir_hari;
            }
          });
        } else {
          // If no row for today yet, fetch yesterday's stock or initial stock
          const currentStockMap = this.getCurrentStockMap();
          const stok_awal_hari = currentStockMap[kode_bahan] ?? 0;
          const barang_masuk = 0;
          const pemakaian = deltaUsage;
          const stok_akhir_hari = stok_awal_hari + barang_masuk - pemakaian;

          const newKartu = {
            tanggal: dateStr,
            kode_bahan,
            nama_bahan,
            stok_awal_hari,
            barang_masuk,
            pemakaian,
            stok_akhir_hari,
            satuan,
            status_data: 'HASIL PERHITUNGAN',
            catatan: 'Stok awal + masuk - pemakaian'
          };

          kartuSheet.addRow([
            newKartu.tanggal,
            newKartu.kode_bahan,
            newKartu.nama_bahan,
            newKartu.stok_awal_hari,
            newKartu.barang_masuk,
            newKartu.pemakaian,
            newKartu.stok_akhir_hari,
            newKartu.satuan,
            newKartu.status_data,
            newKartu.catatan
          ]);
          this.cache.kartuStok.push(newKartu);
        }
      }

      // 5. Recalculate PERHITUNGAN_SS_ROP table
      const updatedSsTable = inventoryService.recomputeSsRopTable(
        this.cache.bahan,
        this.cache.pemakaianHarian,
        1
      );
      this.cache.ssRop = updatedSsTable;

      // Update PERHITUNGAN_SS_ROP sheet cells
      ssSheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const kode = String(row.getCell(1).value);
        const match = updatedSsTable.find(s => s.kode_bahan === kode);
        if (match) {
          row.getCell(4).value = match.total_pemakaian_7_hari;
          row.getCell(5).value = match.rata_rata_per_hari;
          row.getCell(6).value = match.maksimum_per_hari;
          row.getCell(7).value = match.lead_time_hari_asumsi;
          row.getCell(8).value = match.safety_stock;
          row.getCell(9).value = match.reorder_point;
        }
      });

      // 6. Persist workbook, create backup, trigger cloud sync
      await this.persistWorkbook('transaksi_baru');

      // 7. Audit log
      this.logAudit(
        user,
        'TRANSAKSI_PENJUALAN',
        'TRANSAKSI_210',
        `Transaksi ${id_transaksi} berhasil: ${items.length} item, Total Rp ${grandTotalRp.toLocaleString('id-ID')}`,
        null,
        { id_transaksi, total: grandTotalRp, itemsCount: items.length }
      );

      return {
        id_transaksi,
        tanggal: dateStr,
        jam: timeStr,
        total_penjualan_rp: grandTotalRp,
        items: savedTransactionRows,
        bom_pemakaian_count: bomRequirements.length
      };
    });
  }

  /* ==========================================================================
     BARANG MASUK & PEMBELIAN (BARANG_MASUK)
     ========================================================================== */
  getBarangMasuk(filters = {}) {
    let list = [...this.cache.barangMasuk];
    if (filters.tanggal) list = list.filter(b => b.tanggal === filters.tanggal);
    if (filters.kode_bahan) list = list.filter(b => b.kode_bahan === filters.kode_bahan);
    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(b => b.nama_bahan.toLowerCase().includes(q) || b.jenis.toLowerCase().includes(q));
    }
    return list.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
  }

  async addBarangMasuk(data, user) {
    return this.enqueueWrite(async () => {
      const masukSheet = this.workbook.getWorksheet('BARANG_MASUK');
      const kartuSheet = this.workbook.getWorksheet('KARTU_STOK_HARIAN');

      const now = new Date();
      const pad = n => String(n).padStart(2, '0');
      const tanggal = data.tanggal || `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

      const bahanObj = this.cache.bahan.find(b => b.kode_bahan === data.kode_bahan);
      const nama_bahan = bahanObj ? bahanObj.nama_bahan : (data.nama_bahan || '');
      const satuan = bahanObj ? bahanObj.satuan_pemakaian : (data.satuan || 'gram');
      const qty_masuk = Number(data.qty_masuk) || 0;
      const jenis = data.jenis || 'PEMBELIAN';
      const catatan = data.catatan || 'Barang masuk via aplikasi';

      const newEntry = {
        tanggal,
        kode_bahan: data.kode_bahan,
        nama_bahan,
        qty_masuk,
        satuan,
        jenis,
        status_data: 'AKTUAL',
        catatan
      };

      masukSheet.addRow([
        newEntry.tanggal,
        newEntry.kode_bahan,
        newEntry.nama_bahan,
        newEntry.qty_masuk,
        newEntry.satuan,
        newEntry.jenis,
        newEntry.status_data,
        newEntry.catatan
      ]);

      this.cache.barangMasuk.push(newEntry);

      // Update KARTU_STOK_HARIAN for that date & material
      const kartuIdx = this.cache.kartuStok.findIndex(
        k => k.tanggal === tanggal && k.kode_bahan === data.kode_bahan
      );

      if (kartuIdx !== -1) {
        this.cache.kartuStok[kartuIdx].barang_masuk += qty_masuk;
        this.cache.kartuStok[kartuIdx].stok_akhir_hari =
          this.cache.kartuStok[kartuIdx].stok_awal_hari +
          this.cache.kartuStok[kartuIdx].barang_masuk -
          this.cache.kartuStok[kartuIdx].pemakaian;

        kartuSheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return;
          const rTgl = this.formatDate(row.getCell(1).value);
          const rKode = String(row.getCell(2).value);
          if (rTgl === tanggal && rKode === data.kode_bahan) {
            row.getCell(5).value = this.cache.kartuStok[kartuIdx].barang_masuk;
            row.getCell(7).value = this.cache.kartuStok[kartuIdx].stok_akhir_hari;
          }
        });
      } else {
        const currentStockMap = this.getCurrentStockMap();
        const stok_awal_hari = currentStockMap[data.kode_bahan] ?? 0;
        const pemakaian = 0;
        const stok_akhir_hari = stok_awal_hari + qty_masuk - pemakaian;

        const newKartu = {
          tanggal,
          kode_bahan: data.kode_bahan,
          nama_bahan,
          stok_awal_hari,
          barang_masuk: qty_masuk,
          pemakaian,
          stok_akhir_hari,
          satuan,
          status_data: 'HASIL PERHITUNGAN',
          catatan: 'Stok awal + masuk - pemakaian'
        };

        kartuSheet.addRow([
          newKartu.tanggal,
          newKartu.kode_bahan,
          newKartu.nama_bahan,
          newKartu.stok_awal_hari,
          newKartu.barang_masuk,
          newKartu.pemakaian,
          newKartu.stok_akhir_hari,
          newKartu.satuan,
          newKartu.status_data,
          newKartu.catatan
        ]);
        this.cache.kartuStok.push(newKartu);
      }

      await this.persistWorkbook('barang_masuk');
      this.logAudit(
        user,
        'BARANG_MASUK',
        'BARANG_MASUK',
        `Mencatat barang masuk: ${nama_bahan} (${qty_masuk} ${satuan}, ${jenis})`,
        null,
        newEntry
      );

      return newEntry;
    });
  }

  /* ==========================================================================
     RESEP & BILL OF MATERIALS (RESEP_BOM)
     ========================================================================== */
  getResep(filters = {}) {
    let list = [...this.cache.resep];
    if (filters.kode_menu) {
      list = list.filter(r => String(r.kode_menu) === String(filters.kode_menu));
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(r =>
        r.nama_menu.toLowerCase().includes(q) ||
        r.nama_bahan.toLowerCase().includes(q)
      );
    }
    return list;
  }

  async addResep(data, user) {
    return this.enqueueWrite(async () => {
      const sheet = this.workbook.getWorksheet('RESEP_BOM');
      const menuObj = this.cache.menu.find(m => String(m.kode_menu) === String(data.kode_menu));
      const bahanObj = this.cache.bahan.find(b => b.kode_bahan === data.kode_bahan);

      const newResep = {
        kode_menu: data.kode_menu,
        nama_menu: menuObj ? menuObj.nama_menu : (data.nama_menu || ''),
        kode_bahan: data.kode_bahan,
        nama_bahan: bahanObj ? bahanObj.nama_bahan : (data.nama_bahan || ''),
        qty_per_menu: Number(data.qty_per_menu) || 0,
        satuan: data.satuan || (bahanObj ? bahanObj.satuan_pemakaian : 'gram'),
        status_data: 'TERVERIFIKASI',
        catatan: data.catatan || 'Takaran bahan berdasarkan resep standar per porsi'
      };

      sheet.addRow([
        newResep.kode_menu,
        newResep.nama_menu,
        newResep.kode_bahan,
        newResep.nama_bahan,
        newResep.qty_per_menu,
        newResep.satuan,
        newResep.status_data,
        newResep.catatan
      ]);

      this.cache.resep.push(newResep);
      await this.persistWorkbook('tambah_resep');
      this.logAudit(
        user,
        'TAMBAH_RESEP',
        'RESEP_BOM',
        `Menambahkan BOM resep: ${newResep.nama_menu} - ${newResep.nama_bahan} (${newResep.qty_per_menu} ${newResep.satuan})`,
        null,
        newResep
      );

      return newResep;
    });
  }

  async deleteResep(kode_menu, kode_bahan, user) {
    return this.enqueueWrite(async () => {
      const sheet = this.workbook.getWorksheet('RESEP_BOM');
      const idx = this.cache.resep.findIndex(
        r => String(r.kode_menu) === String(kode_menu) && r.kode_bahan === kode_bahan
      );
      if (idx === -1) throw new Error('Resep tidak ditemukan');

      const target = this.cache.resep[idx];
      let rowToDelete = null;

      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        if (String(row.getCell(1).value) === String(kode_menu) && String(row.getCell(3).value) === kode_bahan) {
          rowToDelete = rowNumber;
        }
      });

      if (rowToDelete) {
        sheet.spliceRows(rowToDelete, 1);
      }

      this.cache.resep.splice(idx, 1);
      await this.persistWorkbook('hapus_resep');
      this.logAudit(user, 'HAPUS_RESEP', 'RESEP_BOM', `Menghapus BOM: ${target.nama_menu} - ${target.nama_bahan}`, target, null);

      return true;
    });
  }

  /* ==========================================================================
     PEMAKAIAN, KARTU STOK, DAN PERHITUNGAN SS & ROP
     ========================================================================== */
  getPemakaianDetail(filters = {}) {
    let list = [...this.cache.pemakaianDetail];
    if (filters.tanggal) list = list.filter(p => p.tanggal === filters.tanggal);
    if (filters.id_transaksi) list = list.filter(p => p.id_transaksi.includes(filters.id_transaksi));
    if (filters.kode_bahan) list = list.filter(p => p.kode_bahan === filters.kode_bahan);
    return list;
  }

  getPemakaianHarian(filters = {}) {
    let list = [...this.cache.pemakaianHarian];
    if (filters.tanggal) list = list.filter(p => p.tanggal === filters.tanggal);
    if (filters.kode_bahan) list = list.filter(p => p.kode_bahan === filters.kode_bahan);
    return list;
  }

  getKartuStok(filters = {}) {
    let list = [...this.cache.kartuStok];
    if (filters.tanggal) list = list.filter(k => k.tanggal === filters.tanggal);
    if (filters.kode_bahan) list = list.filter(k => k.kode_bahan === filters.kode_bahan);
    return list;
  }

  getSsRop(filters = {}) {
    const currentStock = this.getCurrentStockMap();
    let list = this.cache.ssRop.map(s => {
      const stock = currentStock[s.kode_bahan] ?? 0;
      const status_stok = inventoryService.determineStockStatus(stock, s.safety_stock, s.reorder_point);
      return {
        ...s,
        stok_tersedia: Math.round(stock * 100) / 100,
        status_stok
      };
    });

    if (filters.status_stok) {
      list = list.filter(s => s.status_stok === filters.status_stok);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(s => s.nama_bahan.toLowerCase().includes(q) || s.kode_bahan.toLowerCase().includes(q));
    }
    return list;
  }

  getAuditLogs() {
    return this.cache.auditLog;
  }
}

module.exports = new ExcelService();
