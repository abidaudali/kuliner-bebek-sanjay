/**
 * Riwayat Transaksi Penjualan Module (TRANSAKSI_210)
 */
const TransaksiModule = {
  list: [],

  async render() {
    const container = document.getElementById('content-area');
    container.innerHTML = `
      <div class="content-card">
        <div class="content-card-header flex-wrap gap-2">
          <div class="d-flex align-items-center gap-3">
            <h5 class="content-card-title"><i class="bi bi-receipt-cutoff text-warning"></i> Riwayat Transaksi Penjualan</h5>
            <span class="badge bg-light text-dark border" id="trx-total-badge">210 Transaksi</span>
          </div>

          <div class="d-flex gap-2 align-items-center flex-wrap">
            <div class="input-group" style="max-width: 220px;">
              <span class="input-group-text bg-white border-end-0"><i class="bi bi-calendar"></i></span>
              <input type="date" id="trx-filter-date" class="form-control border-start-0" onchange="TransaksiModule.filter()">
            </div>
            <div class="input-group" style="max-width: 240px;">
              <span class="input-group-text bg-white border-end-0"><i class="bi bi-search"></i></span>
              <input type="text" id="trx-filter-search" class="form-control border-start-0" placeholder="ID transaksi / menu..." oninput="TransaksiModule.filter()">
            </div>
            <button class="btn btn-sm btn-outline-dark" onclick="TransaksiModule.reset()">Reset</button>
          </div>
        </div>

        <div class="content-card-body p-0">
          <div class="table-responsive">
            <table class="table table-bsg align-middle mb-0">
              <thead>
                <tr>
                  <th>ID Transaksi</th>
                  <th>Tanggal</th>
                  <th>Jam</th>
                  <th>Kode Menu</th>
                  <th>Nama Menu</th>
                  <th>Kategori</th>
                  <th>Porsi</th>
                  <th>Harga Satuan (Rp)</th>
                  <th>Total Penjualan (Rp)</th>
                  <th>Status</th>
                  <th>Catatan</th>
                </tr>
              </thead>
              <tbody id="trx-table-body">
                <tr><td colspan="11" class="text-center py-4">Memuat riwayat transaksi...</td></tr>
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
      const res = await API.get('/transaksi');
      this.list = res.data;
      document.getElementById('trx-total-badge').textContent = `${this.list.length} Baris Transaksi`;
      this.renderTable(this.list);
    } catch (err) {
      document.getElementById('trx-table-body').innerHTML = `
        <tr><td colspan="11" class="text-center text-danger py-4">Gagal memuat transaksi: ${err.message}</td></tr>
      `;
    }
  },

  renderTable(items) {
    const tbody = document.getElementById('trx-table-body');
    if (!tbody) return;

    if (items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="11" class="text-center py-4 text-muted">Tidak ada transaksi yang cocok.</td></tr>`;
      return;
    }

    tbody.innerHTML = items.map(t => `
      <tr>
        <td class="fw-bold font-monospace small">${t.id_transaksi}</td>
        <td>${t.tanggal}</td>
        <td><i class="bi bi-clock text-muted"></i> ${t.jam}</td>
        <td><span class="badge bg-dark">${t.kode_menu}</span></td>
        <td class="fw-bold">${t.nama_menu}</td>
        <td><span class="badge bg-light text-dark border">${t.kategori}</span></td>
        <td><span class="badge bg-warning text-dark fw-bold">${t.qty_porsi}</span></td>
        <td>${App.formatRp(t.harga_satuan_rp)}</td>
        <td class="fw-bold fs-6 text-dark">${App.formatRp(t.total_penjualan_rp)}</td>
        <td><span class="badge bg-success-subtle text-success border border-success-subtle">${t.status_data}</span></td>
        <td class="text-muted small">${t.catatan || '-'}</td>
      </tr>
    `).join('');
  },

  filter() {
    const date = document.getElementById('trx-filter-date').value;
    const q = document.getElementById('trx-filter-search').value.toLowerCase();

    let filtered = [...this.list];
    if (date) {
      filtered = filtered.filter(t => t.tanggal === date);
    }
    if (q) {
      filtered = filtered.filter(t =>
        t.id_transaksi.toLowerCase().includes(q) ||
        t.nama_menu.toLowerCase().includes(q) ||
        t.kategori.toLowerCase().includes(q)
      );
    }

    this.renderTable(filtered);
  },

  reset() {
    document.getElementById('trx-filter-date').value = '';
    document.getElementById('trx-filter-search').value = '';
    this.renderTable(this.list);
  }
};
