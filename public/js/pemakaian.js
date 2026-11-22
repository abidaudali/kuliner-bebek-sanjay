/**
 * Pemakaian Bahan Baku Module (PEMAKAIAN_DETAIL & PEMAKAIAN_HARIAN)
 */
const PemakaianModule = {
  activeTab: 'detail',
  detailList: [],
  harianList: [],

  async render() {
    const container = document.getElementById('content-area');
    container.innerHTML = `
      <div class="content-card">
        <div class="content-card-header flex-wrap gap-2">
          <div class="d-flex align-items-center gap-3">
            <h5 class="content-card-title"><i class="bi bi-pie-chart-fill text-warning"></i> Pemakaian Bahan Baku</h5>
            <!-- Nav Tabs -->
            <ul class="nav nav-pills ms-3">
              <li class="nav-item">
                <button class="nav-link active py-1 px-3 fw-bold small" id="tab-btn-detail" onclick="PemakaianModule.switchTab('detail')">
                  <i class="bi bi-list-task"></i> Detail Transaksi
                </button>
              </li>
              <li class="nav-item ms-2">
                <button class="nav-link py-1 px-3 fw-bold small" id="tab-btn-harian" onclick="PemakaianModule.switchTab('harian')">
                  <i class="bi bi-calendar3"></i> Rekapitulasi Harian
                </button>
              </li>
            </ul>
          </div>

          <div class="d-flex gap-2 align-items-center">
            <div class="input-group" style="max-width: 240px;">
              <span class="input-group-text bg-white border-end-0"><i class="bi bi-calendar"></i></span>
              <input type="date" id="pemakaian-date-filter" class="form-control border-start-0" onchange="PemakaianModule.filterByDate(this.value)">
            </div>
            <button class="btn btn-sm btn-outline-dark" onclick="PemakaianModule.resetFilter()">Reset</button>
          </div>
        </div>

        <div class="content-card-body p-0">
          <!-- Detail View -->
          <div id="view-pemakaian-detail" class="table-responsive">
            <table class="table table-bsg align-middle mb-0">
              <thead>
                <tr>
                  <th>ID Transaksi</th>
                  <th>Tanggal</th>
                  <th>Menu</th>
                  <th>Porsi</th>
                  <th>Kode Bahan</th>
                  <th>Nama Bahan Baku</th>
                  <th>Takaran/Porsi</th>
                  <th>Total Pemakaian</th>
                  <th>Satuan</th>
                  <th>Status Data</th>
                </tr>
              </thead>
              <tbody id="pemakaian-detail-body">
                <tr><td colspan="10" class="text-center py-4">Memuat detail pemakaian...</td></tr>
              </tbody>
            </table>
          </div>

          <!-- Harian View -->
          <div id="view-pemakaian-harian" class="table-responsive" style="display: none;">
            <table class="table table-bsg align-middle mb-0">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Kode Bahan</th>
                  <th>Nama Bahan Baku</th>
                  <th>Satuan</th>
                  <th>Total Pemakaian Harian</th>
                  <th>Status Data</th>
                  <th>Catatan</th>
                </tr>
              </thead>
              <tbody id="pemakaian-harian-body">
                <tr><td colspan="7" class="text-center py-4">Memuat rekapitulasi harian...</td></tr>
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
      const [resDetail, resHarian] = await Promise.all([
        API.get('/inventory/pemakaian-detail'),
        API.get('/inventory/pemakaian-harian')
      ]);

      this.detailList = resDetail.data;
      this.harianList = resHarian.data;

      this.renderDetailTable(this.detailList);
      this.renderHarianTable(this.harianList);
    } catch (err) {
      console.error(err);
    }
  },

  switchTab(tab) {
    this.activeTab = tab;
    const btnDetail = document.getElementById('tab-btn-detail');
    const btnHarian = document.getElementById('tab-btn-harian');
    const viewDetail = document.getElementById('view-pemakaian-detail');
    const viewHarian = document.getElementById('view-pemakaian-harian');

    if (tab === 'detail') {
      btnDetail.classList.add('active');
      btnHarian.classList.remove('active');
      viewDetail.style.display = 'block';
      viewHarian.style.display = 'none';
    } else {
      btnHarian.classList.add('active');
      btnDetail.classList.remove('active');
      viewHarian.style.display = 'block';
      viewDetail.style.display = 'none';
    }
  },

  renderDetailTable(items) {
    const tbody = document.getElementById('pemakaian-detail-body');
    if (!tbody) return;

    if (items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" class="text-center py-4 text-muted">Tidak ada data detail pemakaian.</td></tr>`;
      return;
    }

    // Limit display to latest 200 rows for smooth performance
    const displayItems = items.slice(0, 200);

    tbody.innerHTML = displayItems.map(d => `
      <tr>
        <td class="fw-bold font-monospace small">${d.id_transaksi}</td>
        <td>${d.tanggal}</td>
        <td><strong>${d.nama_menu}</strong></td>
        <td><span class="badge bg-light text-dark border">${d.qty_porsi}</span></td>
        <td><span class="badge bg-dark">${d.kode_bahan}</span></td>
        <td>${d.nama_bahan}</td>
        <td>${d.qty_per_menu}</td>
        <td class="fw-bold text-danger fs-6">${d.total_pemakaian_bahan}</td>
        <td><span class="badge bg-light text-dark border">${d.satuan}</span></td>
        <td><span class="badge bg-success-subtle text-success border border-success-subtle">${d.status_data}</span></td>
      </tr>
    `).join('') + (items.length > 200 ? `<tr><td colspan="10" class="text-center py-2 bg-light text-muted small">Menampilkan 200 dari total ${items.length} data pemakaian transaksi. Gunakan filter tanggal untuk pencarian spesifik.</td></tr>` : '');
  },

  renderHarianTable(items) {
    const tbody = document.getElementById('pemakaian-harian-body');
    if (!tbody) return;

    if (items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">Tidak ada data rekapitulasi harian.</td></tr>`;
      return;
    }

    tbody.innerHTML = items.map(h => `
      <tr>
        <td><strong>${h.tanggal}</strong></td>
        <td><span class="badge bg-dark">${h.kode_bahan}</span></td>
        <td class="fw-bold">${h.nama_bahan}</td>
        <td><span class="badge bg-light text-dark border">${h.satuan}</span></td>
        <td class="fw-bold fs-6 text-danger">${h.total_pemakaian.toLocaleString('id-ID')}</td>
        <td><span class="badge bg-primary-subtle text-primary border border-primary-subtle">${h.status_data}</span></td>
        <td class="text-muted small">${h.catatan || '-'}</td>
      </tr>
    `).join('');
  },

  filterByDate(date) {
    if (!date) {
      this.resetFilter();
      return;
    }
    const filteredDetail = this.detailList.filter(d => d.tanggal === date);
    const filteredHarian = this.harianList.filter(h => h.tanggal === date);
    this.renderDetailTable(filteredDetail);
    this.renderHarianTable(filteredHarian);
  },

  resetFilter() {
    document.getElementById('pemakaian-date-filter').value = '';
    this.renderDetailTable(this.detailList);
    this.renderHarianTable(this.harianList);
  }
};
