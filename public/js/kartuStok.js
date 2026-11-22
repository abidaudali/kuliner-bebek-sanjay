/**
 * Kartu Stok Harian Module (KARTU_STOK_HARIAN)
 */
const KartuStokModule = {
  list: [],

  async render() {
    const container = document.getElementById('content-area');
    container.innerHTML = `
      <div class="content-card">
        <div class="content-card-header flex-wrap gap-2">
          <div class="d-flex align-items-center gap-3">
            <h5 class="content-card-title"><i class="bi bi-card-checklist text-warning"></i> Kartu Stok Harian Persediaan</h5>
            <span class="badge bg-light text-dark border" id="kartu-total-badge">267 Rekap</span>
          </div>

          <div class="d-flex gap-2 align-items-center flex-wrap">
            <div class="input-group" style="max-width: 220px;">
              <span class="input-group-text bg-white border-end-0"><i class="bi bi-calendar"></i></span>
              <input type="date" id="kartu-filter-date" class="form-control border-start-0" onchange="KartuStokModule.filter()">
            </div>
            <div class="input-group" style="max-width: 220px;">
              <span class="input-group-text bg-white border-end-0"><i class="bi bi-search"></i></span>
              <input type="text" id="kartu-filter-search" class="form-control border-start-0" placeholder="Cari bahan..." oninput="KartuStokModule.filter()">
            </div>
            <button class="btn btn-sm btn-outline-dark" onclick="KartuStokModule.reset()">Reset</button>
          </div>
        </div>

        <div class="content-card-body p-0">
          <div class="table-responsive">
            <table class="table table-bsg align-middle mb-0">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Kode Bahan</th>
                  <th>Nama Bahan Baku</th>
                  <th>Stok Awal Hari</th>
                  <th>Barang Masuk</th>
                  <th>Pemakaian</th>
                  <th>Stok Akhir Hari</th>
                  <th>Satuan</th>
                  <th>Status Data</th>
                  <th>Formula Catatan</th>
                </tr>
              </thead>
              <tbody id="kartu-stok-body">
                <tr><td colspan="10" class="text-center py-4">Memuat kartu stok harian...</td></tr>
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
      const res = await API.get('/inventory/kartu-stok');
      this.list = res.data;
      document.getElementById('kartu-total-badge').textContent = `${this.list.length} Baris Rekap`;
      this.renderTable(this.list);
    } catch (err) {
      document.getElementById('kartu-stok-body').innerHTML = `
        <tr><td colspan="10" class="text-center text-danger py-4">Gagal memuat kartu stok: ${err.message}</td></tr>
      `;
    }
  },

  renderTable(items) {
    const tbody = document.getElementById('kartu-stok-body');
    if (!tbody) return;

    if (items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" class="text-center py-4 text-muted">Tidak ada data kartu stok.</td></tr>`;
      return;
    }

    tbody.innerHTML = items.map(k => `
      <tr>
        <td><strong>${k.tanggal}</strong></td>
        <td><span class="badge bg-dark">${k.kode_bahan}</span></td>
        <td class="fw-bold">${k.nama_bahan}</td>
        <td>${k.stok_awal_hari.toLocaleString('id-ID')}</td>
        <td class="${k.barang_masuk > 0 ? 'text-success fw-bold' : 'text-muted'}">
          ${k.barang_masuk > 0 ? '+' + k.barang_masuk.toLocaleString('id-ID') : '-'}
        </td>
        <td class="${k.pemakaian > 0 ? 'text-danger fw-bold' : 'text-muted'}">
          ${k.pemakaian > 0 ? '-' + k.pemakaian.toLocaleString('id-ID') : '0'}
        </td>
        <td class="fw-bold fs-6 text-dark">${k.stok_akhir_hari.toLocaleString('id-ID')}</td>
        <td><span class="badge bg-light text-dark border">${k.satuan}</span></td>
        <td><span class="badge bg-dark">${k.status_data}</span></td>
        <td class="text-muted small">${k.catatan}</td>
      </tr>
    `).join('');
  },

  filter() {
    const date = document.getElementById('kartu-filter-date').value;
    const q = document.getElementById('kartu-filter-search').value.toLowerCase();

    let filtered = [...this.list];
    if (date) {
      filtered = filtered.filter(k => k.tanggal === date);
    }
    if (q) {
      filtered = filtered.filter(k =>
        k.nama_bahan.toLowerCase().includes(q) ||
        k.kode_bahan.toLowerCase().includes(q)
      );
    }

    this.renderTable(filtered);
  },

  reset() {
    document.getElementById('kartu-filter-date').value = '';
    document.getElementById('kartu-filter-search').value = '';
    this.renderTable(this.list);
  }
};
