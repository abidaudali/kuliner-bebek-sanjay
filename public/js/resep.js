/**
 * Resep & BOM (Bill of Materials) Module
 */
const ResepModule = {
  list: [],
  menuList: [],
  bahanList: [],

  async render() {
    const container = document.getElementById('content-area');
    container.innerHTML = `
      <div class="content-card">
        <div class="content-card-header flex-wrap gap-2">
          <div class="d-flex align-items-center gap-3">
            <h5 class="content-card-title"><i class="bi bi-diagram-3-fill text-warning"></i> Resep & Bill of Materials (BOM)</h5>
            <span class="badge bg-light text-dark border" id="resep-total-badge">231 Komposisi</span>
          </div>

          <div class="d-flex gap-2 align-items-center">
            <div class="input-group" style="max-width: 260px;">
              <span class="input-group-text bg-white border-end-0"><i class="bi bi-search"></i></span>
              <input type="text" class="form-control border-start-0" placeholder="Filter menu atau bahan..." oninput="ResepModule.filter(this.value)">
            </div>
            ${App.currentUser.role === 'OWNER' ? `
              <button class="btn btn-bsg-yellow btn-sm" onclick="ResepModule.openAddModal()">
                <i class="bi bi-plus-lg"></i> Tambah BOM
              </button>
            ` : ''}
          </div>
        </div>

        <div class="content-card-body p-0">
          <div class="table-responsive">
            <table class="table table-bsg align-middle mb-0">
              <thead>
                <tr>
                  <th>Kode Menu</th>
                  <th>Nama Menu</th>
                  <th>Kode Bahan</th>
                  <th>Nama Bahan Baku</th>
                  <th>Kebutuhan per Porsi</th>
                  <th>Satuan</th>
                  <th>Status Resep</th>
                  ${App.currentUser.role === 'OWNER' ? '<th class="text-end">Aksi</th>' : ''}
                </tr>
              </thead>
              <tbody id="resep-table-body">
                <tr><td colspan="8" class="text-center py-4">Memuat data BOM resep...</td></tr>
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
      const [resResep, resMenu, resBahan] = await Promise.all([
        API.get('/resep'),
        API.get('/menu'),
        API.get('/bahan')
      ]);

      this.list = resResep.data;
      this.menuList = resMenu.data;
      this.bahanList = resBahan.data;

      document.getElementById('resep-total-badge').textContent = `${this.list.length} Komposisi BOM`;
      this.renderTable(this.list);
    } catch (err) {
      document.getElementById('resep-table-body').innerHTML = `
        <tr><td colspan="8" class="text-center text-danger py-4">Gagal memuat resep: ${err.message}</td></tr>
      `;
    }
  },

  renderTable(items) {
    const tbody = document.getElementById('resep-table-body');
    if (!tbody) return;

    if (items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-muted">Tidak ada data resep BOM.</td></tr>`;
      return;
    }

    const isOwner = App.currentUser && App.currentUser.role === 'OWNER';

    tbody.innerHTML = items.map(r => `
      <tr>
        <td class="fw-bold">${r.kode_menu}</td>
        <td><strong>${r.nama_menu}</strong></td>
        <td><span class="badge bg-dark">${r.kode_bahan}</span></td>
        <td>${r.nama_bahan}</td>
        <td class="fw-bold fs-6 text-dark">${r.qty_per_menu}</td>
        <td><span class="badge bg-light text-dark border">${r.satuan}</span></td>
        <td><span class="badge bg-success-subtle text-success border border-success-subtle">${r.status_data}</span></td>
        ${isOwner ? `
          <td class="text-end">
            <button class="btn btn-sm btn-outline-danger" onclick="ResepModule.deleteItem('${r.kode_menu}', '${r.kode_bahan}', '${r.nama_menu}', '${r.nama_bahan}')" title="Hapus Takaran">
              <i class="bi bi-trash"></i>
            </button>
          </td>
        ` : ''}
      </tr>
    `).join('');
  },

  filter(query) {
    const q = query.toLowerCase();
    const filtered = this.list.filter(r =>
      r.nama_menu.toLowerCase().includes(q) ||
      r.nama_bahan.toLowerCase().includes(q) ||
      String(r.kode_menu).includes(q) ||
      r.kode_bahan.toLowerCase().includes(q)
    );
    this.renderTable(filtered);
  },

  openAddModal() {
    // Populate Menu select
    const menuSelect = document.getElementById('resep-kode-menu');
    menuSelect.innerHTML = this.menuList.map(m => `<option value="${m.kode_menu}">${m.kode_menu} — ${m.nama_menu}</option>`).join('');

    // Populate Bahan select
    const bahanSelect = document.getElementById('resep-kode-bahan');
    bahanSelect.innerHTML = this.bahanList.map(b => `<option value="${b.kode_bahan}" data-satuan="${b.satuan_pemakaian}">${b.kode_bahan} — ${b.nama_bahan} (${b.satuan_pemakaian})</option>`).join('');

    bahanSelect.onchange = () => {
      const selected = bahanSelect.options[bahanSelect.selectedIndex];
      document.getElementById('resep-satuan-label').textContent = selected.getAttribute('data-satuan') || 'gram';
    };
    if (this.bahanList.length > 0) {
      document.getElementById('resep-satuan-label').textContent = this.bahanList[0].satuan_pemakaian;
    }

    document.getElementById('resep-qty').value = '';
    document.getElementById('resep-catatan').value = 'Takaran bahan berdasarkan resep standar per porsi';

    const modal = new bootstrap.Modal(document.getElementById('modalResep'));
    modal.show();
  },

  async save(e) {
    e.preventDefault();
    const kode_menu = document.getElementById('resep-kode-menu').value;
    const kode_bahan = document.getElementById('resep-kode-bahan').value;
    const qty_per_menu = Number(document.getElementById('resep-qty').value);
    const satuan = document.getElementById('resep-satuan-label').textContent;
    const catatan = document.getElementById('resep-catatan').value.trim();

    try {
      await API.post('/resep', {
        kode_menu,
        kode_bahan,
        qty_per_menu,
        satuan,
        catatan
      });

      const modalEl = document.getElementById('modalResep');
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();

      Swal.fire({
        icon: 'success',
        title: 'Berhasil',
        text: 'BOM resep berhasil tersimpan ke workbook Excel.',
        timer: 1800,
        showConfirmButton: false
      });

      await this.loadData();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err.message });
    }
  },

  async deleteItem(kode_menu, kode_bahan, nama_menu, nama_bahan) {
    const result = await Swal.fire({
      title: 'Hapus Takaran BOM?',
      text: `Hapus takaran "${nama_bahan}" untuk menu "${nama_menu}" dari workbook Excel?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#171717',
      confirmButtonText: 'Ya, Hapus'
    });

    if (result.isConfirmed) {
      try {
        await API.delete(`/resep/${kode_menu}/${kode_bahan}`);
        Swal.fire({ icon: 'success', title: 'Terhapus', timer: 1500, showConfirmButton: false });
        await this.loadData();
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'Gagal', text: err.message });
      }
    }
  }
};
