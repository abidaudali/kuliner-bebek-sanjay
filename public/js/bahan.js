/**
 * Bahan Baku Module (MASTER_BAHAN & STOK_AWAL)
 */
const BahanModule = {
  list: [],

  async render() {
    const container = document.getElementById('content-area');
    container.innerHTML = `
      <div class="content-card">
        <div class="content-card-header flex-wrap gap-2">
          <div class="d-flex align-items-center gap-3">
            <h5 class="content-card-title"><i class="bi bi-box-seam-fill text-warning"></i> Master Bahan Baku (38 Bahan)</h5>
            <span class="badge bg-light text-dark border" id="bahan-total-badge">38 Bahan</span>
          </div>

          <div class="d-flex gap-2 align-items-center">
            <div class="input-group" style="max-width: 260px;">
              <span class="input-group-text bg-white border-end-0"><i class="bi bi-search"></i></span>
              <input type="text" class="form-control border-start-0" placeholder="Cari bahan..." oninput="BahanModule.filter(this.value)">
            </div>
            ${App.currentUser.role === 'OWNER' ? `
              <button class="btn btn-bsg-yellow btn-sm" onclick="BahanModule.openAddModal()">
                <i class="bi bi-plus-lg"></i> Tambah Bahan
              </button>
            ` : ''}
          </div>
        </div>

        <div class="content-card-body p-0">
          <div class="table-responsive">
            <table class="table table-bsg align-middle mb-0">
              <thead>
                <tr>
                  <th>Kode Bahan</th>
                  <th>Nama Bahan Baku</th>
                  <th>Satuan Pemakaian</th>
                  <th>Stok Saldo Terakhir</th>
                  <th>Status Data</th>
                  <th>Catatan</th>
                  ${App.currentUser.role === 'OWNER' ? '<th class="text-end">Aksi</th>' : ''}
                </tr>
              </thead>
              <tbody id="bahan-table-body">
                <tr><td colspan="7" class="text-center py-4">Memuat data bahan baku...</td></tr>
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
      const res = await API.get('/bahan');
      this.list = res.data;
      document.getElementById('bahan-total-badge').textContent = `${this.list.length} Bahan Baku`;
      this.renderTable(this.list);
    } catch (err) {
      document.getElementById('bahan-table-body').innerHTML = `
        <tr><td colspan="7" class="text-center text-danger py-4">Gagal memuat bahan: ${err.message}</td></tr>
      `;
    }
  },

  renderTable(items) {
    const tbody = document.getElementById('bahan-table-body');
    if (!tbody) return;

    if (items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">Tidak ada data bahan baku.</td></tr>`;
      return;
    }

    const isOwner = App.currentUser && App.currentUser.role === 'OWNER';

    tbody.innerHTML = items.map(b => `
      <tr>
        <td class="fw-bold">${b.kode_bahan}</td>
        <td><strong>${b.nama_bahan}</strong></td>
        <td><span class="badge bg-light text-dark border">${b.satuan_pemakaian}</span></td>
        <td class="fw-bold fs-6 text-dark">${b.stok_saat_ini.toLocaleString('id-ID')}</td>
        <td><span class="badge bg-dark text-white">${b.status_data}</span></td>
        <td class="text-muted small">${b.catatan || '-'}</td>
        ${isOwner ? `
          <td class="text-end">
            <button class="btn btn-sm btn-outline-dark me-1" onclick="BahanModule.openEditModal('${b.kode_bahan}')" title="Edit Bahan">
              <i class="bi bi-pencil-square"></i> Edit
            </button>
            <button class="btn btn-sm btn-bsg-yellow" onclick="BarangMasukModule.openModalForBahan('${b.kode_bahan}')" title="Restock">
              <i class="bi bi-plus-lg"></i> Masuk
            </button>
          </td>
        ` : ''}
      </tr>
    `).join('');
  },

  filter(query) {
    const q = query.toLowerCase();
    const filtered = this.list.filter(b =>
      b.nama_bahan.toLowerCase().includes(q) ||
      b.kode_bahan.toLowerCase().includes(q) ||
      b.satuan_pemakaian.toLowerCase().includes(q)
    );
    this.renderTable(filtered);
  },

  openAddModal() {
    document.getElementById('modalBahanTitle').innerHTML = '<i class="bi bi-plus-circle text-warning"></i> Tambah Bahan Baku';
    document.getElementById('bahan-edit-code').value = '';
    document.getElementById('bahan-nama').value = '';
    document.getElementById('bahan-satuan').value = 'gram';
    document.getElementById('bahan-stok-awal-group').style.display = 'block';
    document.getElementById('bahan-stok-awal').value = '0';
    document.getElementById('bahan-catatan').value = 'Satuan rancangan; validasi satuan pembelian dan pemakaian';

    const modal = new bootstrap.Modal(document.getElementById('modalBahan'));
    modal.show();
  },

  openEditModal(kode_bahan) {
    const item = this.list.find(b => b.kode_bahan === kode_bahan);
    if (!item) return;

    document.getElementById('modalBahanTitle').innerHTML = `<i class="bi bi-pencil-square text-warning"></i> Edit Bahan (${item.kode_bahan})`;
    document.getElementById('bahan-edit-code').value = item.kode_bahan;
    document.getElementById('bahan-nama').value = item.nama_bahan;
    document.getElementById('bahan-satuan').value = item.satuan_pemakaian;
    document.getElementById('bahan-stok-awal-group').style.display = 'none';
    document.getElementById('bahan-catatan').value = item.catatan;

    const modal = new bootstrap.Modal(document.getElementById('modalBahan'));
    modal.show();
  },

  async save(e) {
    e.preventDefault();
    const code = document.getElementById('bahan-edit-code').value;
    const payload = {
      nama_bahan: document.getElementById('bahan-nama').value.trim(),
      satuan_pemakaian: document.getElementById('bahan-satuan').value,
      stok_awal: Number(document.getElementById('bahan-stok-awal').value) || 0,
      catatan: document.getElementById('bahan-catatan').value.trim()
    };

    try {
      if (code) {
        await API.put(`/bahan/${code}`, payload);
      } else {
        await API.post('/bahan', payload);
      }

      const modalEl = document.getElementById('modalBahan');
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();

      Swal.fire({
        icon: 'success',
        title: 'Berhasil',
        text: 'Data bahan baku berhasil tersimpan di workbook Excel.',
        timer: 1800,
        showConfirmButton: false
      });

      await this.loadData();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err.message });
    }
  }
};
