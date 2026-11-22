/**
 * Barang Masuk Module (BARANG_MASUK)
 */
const BarangMasukModule = {
  list: [],
  bahanList: [],

  async render() {
    const container = document.getElementById('content-area');
    container.innerHTML = `
      <div class="content-card">
        <div class="content-card-header flex-wrap gap-2">
          <div class="d-flex align-items-center gap-3">
            <h5 class="content-card-title"><i class="bi bi-truck text-warning"></i> Riwayat Barang Masuk & Penerimaan</h5>
            <span class="badge bg-light text-dark border" id="masuk-total-badge">0 Transaksi</span>
          </div>

          <div class="d-flex gap-2 align-items-center">
            <div class="input-group" style="max-width: 240px;">
              <span class="input-group-text bg-white border-end-0"><i class="bi bi-calendar"></i></span>
              <input type="date" id="masuk-filter-date" class="form-control border-start-0" onchange="BarangMasukModule.filterDate(this.value)">
            </div>
            ${App.currentUser.role === 'OWNER' ? `
              <button class="btn btn-bsg-yellow btn-sm" onclick="BarangMasukModule.openAddModal()">
                <i class="bi bi-plus-lg"></i> Catat Barang Masuk
              </button>
            ` : ''}
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
                  <th>Jumlah Masuk</th>
                  <th>Satuan</th>
                  <th>Jenis Penerimaan</th>
                  <th>Status Data</th>
                  <th>Catatan</th>
                </tr>
              </thead>
              <tbody id="masuk-table-body">
                <tr><td colspan="8" class="text-center py-4">Memuat data barang masuk...</td></tr>
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
      const [resMasuk, resBahan] = await Promise.all([
        API.get('/barang-masuk'),
        API.get('/bahan')
      ]);

      this.list = resMasuk.data;
      this.bahanList = resBahan.data;

      document.getElementById('masuk-total-badge').textContent = `${this.list.length} Penerimaan`;
      this.renderTable(this.list);
    } catch (err) {
      document.getElementById('masuk-table-body').innerHTML = `
        <tr><td colspan="8" class="text-center text-danger py-4">Gagal memuat barang masuk: ${err.message}</td></tr>
      `;
    }
  },

  renderTable(items) {
    const tbody = document.getElementById('masuk-table-body');
    if (!tbody) return;

    if (items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-muted">Tidak ada data barang masuk.</td></tr>`;
      return;
    }

    tbody.innerHTML = items.map(m => `
      <tr>
        <td><strong>${m.tanggal}</strong></td>
        <td><span class="badge bg-dark">${m.kode_bahan}</span></td>
        <td class="fw-bold">${m.nama_bahan}</td>
        <td class="fw-bold text-success fs-6">+${m.qty_masuk.toLocaleString('id-ID')}</td>
        <td><span class="badge bg-light text-dark border">${m.satuan}</span></td>
        <td>
          <span class="badge ${m.jenis === 'PEMBELIAN' ? 'bg-primary' : 'bg-secondary'}">${m.jenis}</span>
        </td>
        <td><span class="badge bg-dark">${m.status_data}</span></td>
        <td class="text-muted small">${m.catatan || '-'}</td>
      </tr>
    `).join('');
  },

  filterDate(date) {
    if (!date) {
      this.renderTable(this.list);
      return;
    }
    const filtered = this.list.filter(m => m.tanggal === date);
    this.renderTable(filtered);
  },

  openAddModal() {
    const select = document.getElementById('masuk-kode-bahan');
    select.innerHTML = this.bahanList.map(b => `
      <option value="${b.kode_bahan}">${b.kode_bahan} — ${b.nama_bahan} (${b.satuan_pemakaian})</option>
    `).join('');

    const today = new Date().toISOString().split('T')[0];
    document.getElementById('masuk-tanggal').value = today;
    document.getElementById('masuk-qty').value = '';
    document.getElementById('masuk-jenis').value = 'PEMBELIAN';
    document.getElementById('masuk-catatan').value = 'Barang masuk berdasarkan bukti pembelian atau penerimaan barang';

    const modal = new bootstrap.Modal(document.getElementById('modalBarangMasuk'));
    modal.show();
  },

  openModalForBahan(kode_bahan) {
    this.openAddModal();
    const select = document.getElementById('masuk-kode-bahan');
    select.value = kode_bahan;
  },

  async save(e) {
    e.preventDefault();
    const tanggal = document.getElementById('masuk-tanggal').value;
    const kode_bahan = document.getElementById('masuk-kode-bahan').value;
    const qty_masuk = Number(document.getElementById('masuk-qty').value);
    const jenis = document.getElementById('masuk-jenis').value;
    const catatan = document.getElementById('masuk-catatan').value.trim();

    try {
      await API.post('/barang-masuk', {
        tanggal,
        kode_bahan,
        qty_masuk,
        jenis,
        catatan
      });

      const modalEl = document.getElementById('modalBarangMasuk');
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();

      Swal.fire({
        icon: 'success',
        title: 'Berhasil',
        text: 'Barang masuk berhasil dicatat & stok kartu otomatis diperbarui di Excel.',
        timer: 2000,
        showConfirmButton: false
      });

      await this.loadData();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err.message });
    }
  }
};
