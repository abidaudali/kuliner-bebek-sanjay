/**
 * Menu Management Module
 */
const MenuModule = {
  list: [],

  async render() {
    const container = document.getElementById('content-area');
    container.innerHTML = `
      <div class="content-card">
        <div class="content-card-header flex-wrap gap-2">
          <div class="d-flex align-items-center gap-3">
            <h5 class="content-card-title"><i class="bi bi-book-half text-warning"></i> Daftar Menu & Harga</h5>
            <span class="badge bg-light text-dark border" id="menu-total-badge">0 Menu</span>
          </div>

          <div class="d-flex gap-2 align-items-center">
            <div class="input-group" style="max-width: 260px;">
              <span class="input-group-text bg-white border-end-0"><i class="bi bi-search"></i></span>
              <input type="text" id="menu-search-input" class="form-control border-start-0" placeholder="Cari menu..." oninput="MenuModule.filter(this.value)">
            </div>
            ${App.currentUser.role === 'OWNER' ? `
              <button class="btn btn-bsg-yellow btn-sm" onclick="MenuModule.openAddModal()">
                <i class="bi bi-plus-lg"></i> Tambah Menu
              </button>
            ` : ''}
          </div>
        </div>

        <div class="content-card-body p-0">
          <div class="table-responsive">
            <table class="table table-bsg align-middle mb-0" id="table-menu">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Nama Menu</th>
                  <th>Kategori</th>
                  <th>Harga Satuan (Rp)</th>
                  <th>Status Harga</th>
                  <th>Catatan</th>
                  ${App.currentUser.role === 'OWNER' ? '<th class="text-end">Aksi</th>' : ''}
                </tr>
              </thead>
              <tbody id="menu-table-body">
                <tr><td colspan="7" class="text-center py-4">Memuat data menu...</td></tr>
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
      const res = await API.get('/menu');
      this.list = res.data;
      document.getElementById('menu-total-badge').textContent = `${this.list.length} Menu`;
      this.renderTable(this.list);
    } catch (err) {
      document.getElementById('menu-table-body').innerHTML = `
        <tr><td colspan="7" class="text-center text-danger py-4">Gagal memuat menu: ${err.message}</td></tr>
      `;
    }
  },

  renderTable(items) {
    const tbody = document.getElementById('menu-table-body');
    if (!tbody) return;

    if (items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">Tidak ada data menu.</td></tr>`;
      return;
    }

    const isOwner = App.currentUser && App.currentUser.role === 'OWNER';

    tbody.innerHTML = items.map(m => `
      <tr>
        <td class="fw-bold">${m.kode_menu}</td>
        <td>
          <div class="fw-bold">${m.nama_menu}</div>
        </td>
        <td><span class="badge bg-dark text-warning">${m.kategori}</span></td>
        <td class="fw-bold fs-6 text-dark">${App.formatRp(m.harga_satuan_rp)}</td>
        <td>
          <span class="badge ${m.status_harga === 'HARGA AKTUAL' ? 'bg-success' : 'bg-secondary'}">${m.status_harga}</span>
        </td>
        <td class="text-muted small">${m.catatan || '-'}</td>
        ${isOwner ? `
          <td class="text-end">
            <button class="btn btn-sm btn-outline-dark me-1" onclick="MenuModule.openEditModal(${m.kode_menu})" title="Edit Menu">
              <i class="bi bi-pencil-square"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger" onclick="MenuModule.deleteItem(${m.kode_menu}, '${m.nama_menu}')" title="Hapus Menu">
              <i class="bi bi-trash"></i>
            </button>
          </td>
        ` : ''}
      </tr>
    `).join('');
  },

  filter(query) {
    const q = query.toLowerCase();
    const filtered = this.list.filter(m =>
      m.nama_menu.toLowerCase().includes(q) ||
      m.kategori.toLowerCase().includes(q) ||
      String(m.kode_menu).includes(q)
    );
    this.renderTable(filtered);
  },

  openAddModal() {
    document.getElementById('modalMenuTitle').innerHTML = '<i class="bi bi-plus-circle text-warning"></i> Tambah Menu Baru';
    document.getElementById('menu-edit-code').value = '';
    document.getElementById('menu-nama').value = '';
    document.getElementById('menu-kategori').value = 'Bumbu Hitam';
    document.getElementById('menu-harga').value = '';
    document.getElementById('menu-status-harga').value = 'HARGA AKTUAL';
    document.getElementById('menu-catatan').value = 'Harga berdasarkan daftar menu atau konfirmasi pemilik';

    const modal = new bootstrap.Modal(document.getElementById('modalMenu'));
    modal.show();
  },

  openEditModal(kode_menu) {
    const item = this.list.find(m => Number(m.kode_menu) === Number(kode_menu));
    if (!item) return;

    document.getElementById('modalMenuTitle').innerHTML = `<i class="bi bi-pencil-square text-warning"></i> Edit Menu (${item.kode_menu})`;
    document.getElementById('menu-edit-code').value = item.kode_menu;
    document.getElementById('menu-nama').value = item.nama_menu;
    document.getElementById('menu-kategori').value = item.kategori;
    document.getElementById('menu-harga').value = item.harga_satuan_rp;
    document.getElementById('menu-status-harga').value = item.status_harga;
    document.getElementById('menu-catatan').value = item.catatan;

    const modal = new bootstrap.Modal(document.getElementById('modalMenu'));
    modal.show();
  },

  async save(e) {
    e.preventDefault();
    const code = document.getElementById('menu-edit-code').value;
    const payload = {
      nama_menu: document.getElementById('menu-nama').value.trim(),
      kategori: document.getElementById('menu-kategori').value,
      harga_satuan_rp: Number(document.getElementById('menu-harga').value),
      status_harga: document.getElementById('menu-status-harga').value,
      catatan: document.getElementById('menu-catatan').value.trim()
    };

    try {
      if (code) {
        await API.put(`/menu/${code}`, payload);
      } else {
        await API.post('/menu', payload);
      }

      const modalEl = document.getElementById('modalMenu');
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();

      Swal.fire({
        icon: 'success',
        title: 'Berhasil',
        text: 'Data menu berhasil tersimpan di workbook Excel.',
        timer: 1800,
        showConfirmButton: false
      });

      await this.loadData();
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Gagal Menyimpan',
        text: err.message
      });
    }
  },

  async deleteItem(kode_menu, nama_menu) {
    const result = await Swal.fire({
      title: 'Hapus Menu?',
      text: `Apakah Anda yakin ingin menghapus "${nama_menu}" dari daftar menu dan workbook Excel?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#171717',
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal'
    });

    if (result.isConfirmed) {
      try {
        await API.delete(`/menu/${kode_menu}`);
        Swal.fire({
          icon: 'success',
          title: 'Terhapus',
          text: 'Menu berhasil dihapus dari Excel.',
          timer: 1500,
          showConfirmButton: false
        });
        await this.loadData();
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'Gagal', text: err.message });
      }
    }
  }
};
