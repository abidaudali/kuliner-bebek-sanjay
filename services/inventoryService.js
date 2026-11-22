/**
 * Inventory Service — BOM, Safety Stock (SS), and Reorder Point (ROP) Calculations
 * Following strictly the 3 formulas required:
 * 1. BOM: Kebutuhan bahan = Jumlah porsi × Kebutuhan bahan per porsi
 * 2. SS: Safety Stock = MAX(0, (Maksimum Pemakaian Harian - Rata-rata Pemakaian Harian) × Lead Time)
 * 3. ROP: Reorder Point = (Rata-rata Pemakaian Harian × Lead Time) + Safety Stock
 */

class InventoryService {
  /**
   * Calculate BOM material requirements for an order
   * @param {Array<{kode_menu: string|number, qty_porsi: number}>} items
   * @param {Array<Object>} bomList
   * @returns {Array<Object>} required materials list
   */
  calculateBomRequirements(items, bomList) {
    const requirements = [];

    for (const item of items) {
      const menuBom = bomList.filter(
        b => String(b.kode_menu) === String(item.kode_menu)
      );

      for (const recipe of menuBom) {
        const qty_porsi = Number(item.qty_porsi) || 1;
        const qty_per_menu = Number(recipe.qty_per_menu) || 0;
        const total_pemakaian_bahan = qty_porsi * qty_per_menu;

        requirements.push({
          kode_menu: recipe.kode_menu,
          nama_menu: recipe.nama_menu,
          qty_porsi,
          kode_bahan: recipe.kode_bahan,
          nama_bahan: recipe.nama_bahan,
          qty_per_menu,
          satuan: recipe.satuan,
          total_pemakaian_bahan,
          status_data: 'HASIL PERHITUNGAN',
          catatan: 'Jumlah pemakaian diperoleh dari jumlah porsi dikalikan kebutuhan bahan per menu'
        });
      }
    }

    return requirements;
  }

  /**
   * Calculate Safety Stock
   * @param {number} maxDaily - Maksimum pemakaian harian
   * @param {number} avgDaily - Rata-rata pemakaian harian
   * @param {number} leadTime - Waktu tunggu pemasok (hari)
   * @returns {number} safety stock
   */
  calculateSafetyStock(maxDaily, avgDaily, leadTime = 1) {
    const diff = (Number(maxDaily) || 0) - (Number(avgDaily) || 0);
    return Math.max(0, diff * (Number(leadTime) || 1));
  }

  /**
   * Calculate Reorder Point
   * @param {number} avgDaily - Rata-rata pemakaian harian
   * @param {number} leadTime - Waktu tunggu pemasok (hari)
   * @param {number} safetyStock - Nilai Safety Stock
   * @returns {number} reorder point
   */
  calculateReorderPoint(avgDaily, leadTime = 1, safetyStock = 0) {
    const usageDuringLeadTime = (Number(avgDaily) || 0) * (Number(leadTime) || 1);
    return usageDuringLeadTime + (Number(safetyStock) || 0);
  }

  /**
   * Determine Stock Status based on Current Stock, SS, and ROP
   * @param {number} currentStock
   * @param {number} safetyStock
   * @param {number} reorderPoint
   * @returns {'Stok Aman' | 'Perlu Perhatian' | 'Harus Restock'}
   */
  determineStockStatus(currentStock, safetyStock, reorderPoint) {
    const stock = Number(currentStock) || 0;
    const ss = Number(safetyStock) || 0;
    const rop = Number(reorderPoint) || 0;

    if (stock <= ss) {
      return 'Harus Restock';
    } else if (stock <= rop) {
      return 'Perlu Perhatian';
    } else {
      return 'Stok Aman';
    }
  }

  /**
   * Recalculate SS & ROP across all materials given pemakaian harian history
   * @param {Array<Object>} masterBahanList
   * @param {Array<Object>} pemakaianHarianList
   * @param {number} leadTimeAssumed
   * @returns {Array<Object>}
   */
  recomputeSsRopTable(masterBahanList, pemakaianHarianList, leadTimeAssumed = 1) {
    const results = [];

    // Group daily usages by date to know distinct days count
    const uniqueDates = [...new Set(pemakaianHarianList.map(p => {
      const d = new Date(p.tanggal);
      return !isNaN(d) ? d.toISOString().split('T')[0] : String(p.tanggal);
    }))];
    const daysCount = Math.max(uniqueDates.length, 7); // Default to at least 7 days or recorded days

    for (const bahan of masterBahanList) {
      const kode = bahan.kode_bahan;
      const usages = pemakaianHarianList.filter(p => p.kode_bahan === kode);
      
      const usageValues = usages.map(u => Number(u.total_pemakaian) || 0);
      const totalPemakaian = usageValues.reduce((acc, v) => acc + v, 0);
      const maxDaily = usageValues.length > 0 ? Math.max(...usageValues) : 0;
      const avgDaily = totalPemakaian / daysCount;

      const ss = this.calculateSafetyStock(maxDaily, avgDaily, leadTimeAssumed);
      const rop = this.calculateReorderPoint(avgDaily, leadTimeAssumed, ss);

      results.push({
        kode_bahan: kode,
        nama_bahan: bahan.nama_bahan,
        satuan: bahan.satuan_pemakaian || usages[0]?.satuan || 'gram',
        total_pemakaian_7_hari: Math.round(totalPemakaian * 100) / 100,
        rata_rata_per_hari: Math.round(avgDaily * 100) / 100,
        maksimum_per_hari: Math.round(maxDaily * 100) / 100,
        lead_time_hari_asumsi: leadTimeAssumed,
        safety_stock: Math.round(ss * 100) / 100,
        reorder_point: Math.round(rop * 100) / 100,
        status_data: 'HASIL PERHITUNGAN',
        catatan: 'Perhitungan berdasarkan pemakaian bahan dan waktu tunggu pemasok'
      });
    }

    return results;
  }
}

module.exports = new InventoryService();
