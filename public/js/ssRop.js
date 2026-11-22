/**
 * Safety Stock & Reorder Point (PERHITUNGAN_SS_ROP) Module
 */
const SsRopModule = {
  list: [],

  async render() {
    const container = document.getElementById('content-area');
    container.innerHTML = `
      <!-- Calculation Formula Banner -->
      <div class="alert alert-light border shadow-sm p-4 mb-4">
        <div class="d-flex align-items-center gap-2 mb-2">
          <i class="bi bi-info-circle-fill text-warning fs-5"></i>
          <h6 class="fw-bold text-dark m-0">Ketentuan Perhitungan Persediaan UMKM Bebek Sanjay Gowa</h6>
        </div>
        <p class="text-muted small mb-2">
          Sistem hanya menerapkan 3 rumus persediaan standar tanpa asumsi forecasting tambahan:
        </p>
        <div class="row g-3 small">
          <div class="col-md-4">
            <div class="p-2 bg-white rounded border">
              <strong>1. Bill of Materials (BOM)</strong><br>
              <code>Kebutuhan = Porsi × Takaran per Menu</code>
            </div>
          </div>
          <div class="col-md-4">
            <div class="p-2 bg-white rounded border">
              <strong>2. Safety Stock (SS)</strong><br>
              <code>SS = MAX(0, (Maks Harian − Rata-rata) × Lead Time)</code>
            </div>
          </div>
          <div class="col-md-4">
            <div class="p-2 bg-white rounded border">
              <strong>3. Reorder Point (ROP)</strong><br>
              <code>ROP = (Rata-rata Harian × Lead Time) + SS</code>
            </div>
          </div>
        </div>
      </div>

      <div class="content-card">
        <div class="content-card-header flex-wrap gap-2">
          <div class="d-flex align-items-center gap-3">
            <h5 class="content-card-title"><i class="bi bi-shield-exclamation text-warning"></i> Tabel Safety Stock & Reorder Point</h5>
            <span class="badge bg-light text-dark border" id="ss-total-badge">38 Bahan</span>
          </div>

          <div class="d-flex gap-2 align-items-center flex-wrap">
            <select id="ss-status-filter" class="form-select form-select-sm" style="width: 170px;" onchange="SsRopModule.filter()">
              <option value="">Semua Status</option>
              <option value="Harus Restock">Harus Restock (Kritis)</option>
              <option value="Perlu Perhatian">Perlu Perhatian</option>
              <option value="Stok Aman">Stok Aman</option>
            </select>
            <div class="input-group" style="max-width: 220px;">
              <span class="input-group-text bg-white border-end-0"><i class="bi bi-search"></i></span>
              <input type="text" id="ss-search-input" class="form-control border-start-0 form-control-sm" placeholder="Cari bahan..." oninput="SsRopModule.filter()">
            </div>
          </div>
        </div>

        <div class="content-card-body p-0">
          <div class="table-responsive">
            <table class="table table-bsg align-middle mb-0">
              <thead>
                <tr>
                  <th>Kode Bahan</th>
                  <th>Nama Bahan Baku</th>
                  <th>Satuan</th>
                  <th>Total Pemakaian (7 Hari)</th>
                  <th>Rata-rata / Hari</th>
                  <th>Maksimum / Hari</th>
                  <th>Lead Time (Hari)</th>
                  <th>Safety Stock (SS)</th>
                  <th>Reorder Point (ROP)</th>
                  <th>Stok Tersedia</th>
                  <th>Status Stok</th>
                  <th class="text-end">Aksi Restock</th>
                </tr>
              </thead>
              <tbody id="ss-rop-body">
                <tr><td colspan="12" class="text-center py-4">Memuat perhitungan SS & ROP...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    await this.loadData();
  },

  async loadData() {
    try {
      const res = await API.get('/inventory/ss-rop');
      this.list = res.data;
      document.getElementById('ss-total-badge').textContent = `${this.list.length} Bahan Baku`;
      this.renderTable(this.list);
    } catch (err) {
      document.getElementById('ss-rop-body').innerHTML = `
        <tr><td colspan="12" class="text-center text-danger py-4">Gagal memuat perhitungan SS & ROP: ${err.message}</td></tr>
      `;
    }
  },

  renderTable(items) {
    const tbody = document.getElementById('ss-rop-body');
    if (!tbody) return;

    if (items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="12" class="text-center py-4 text-muted">Tidak ada data yang sesuai filter.</td></tr>`;
      return;
    }

    tbody.innerHTML = items.map(s => {
      let badgeClass = 'badge-stok-aman';
      let icon = 'bi-check-circle-fill';
      if (s.status_stok === 'Harus Restock') {
        badgeClass = 'badge-harus-restock';
        icon = 'bi-x-circle-fill';
      } else if (s.status_stok === 'Perlu Perhatian') {
        badgeClass = 'badge-perlu-perhatian';
        icon = 'bi-exclamation-circle-fill';
      }

      return `
        <tr>
          <td class="fw-bold">${s.kode_bahan}</td>
          <td><strong>${s.nama_bahan}</strong></td>
          <td><span class="badge bg-light text-dark border">${s.satuan}</span></td>
          <td>${s.total_pemakaian_7_hari.toLocaleString('id-ID')}</td>
          <td>${s.rata_rata_per_hari.toLocaleString('id-ID')}</td>
          <td>${s.maksimum_per_hari.toLocaleString('id-ID')}</td>
          <td class="text-center">${s.lead_time_hari_asumsi}</td>
          <td class="fw-bold text-secondary">${s.safety_stock.toLocaleString('id-ID')}</td>
          <td class="fw-bold text-dark fs-6">${s.reorder_point.toLocaleString('id-ID')}</td>
          <td class="fw-bold fs-6 ${s.status_stok === 'Harus Restock' ? 'text-danger' : (s.status_stok === 'Perlu Perhatian' ? 'text-warning' : 'text-success')}">
            ${s.stok_tersedia.toLocaleString('id-ID')}
          </td>
          <td>
            <span class="${badgeClass}">
              <i class="bi ${icon}"></i> ${s.status_stok}
            </span>
          </td>
          <td class="text-end">
            <button class="btn btn-sm btn-bsg-yellow" onclick="BarangMasukModule.openModalForBahan('${s.kode_bahan}')" title="Catat Pengadaan Bahan">
              <i class="bi bi-cart-plus"></i> Pesan
            </button>
          </td>
        </tr>
      `;
    }).join('');
  },

  filter() {
    const status = document.getElementById('ss-status-filter').value;
    const q = document.getElementById('ss-search-input').value.toLowerCase();

    let filtered = [...this.list];
    if (status) {
      filtered = filtered.filter(s => s.status_stok === status);
    }
    if (q) {
      filtered = filtered.filter(s =>
        s.nama_bahan.toLowerCase().includes(q) ||
        s.kode_bahan.toLowerCase().includes(q)
      );
    }

    this.renderTable(filtered);
  }
};
