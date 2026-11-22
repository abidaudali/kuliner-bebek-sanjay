/**
 * Settings & Excel Data Center Module
 */
const SettingsModule = {
  status: null,
  backups: [],

  async render() {
    const container = document.getElementById('content-area');
    container.innerHTML = `
      <div class="row g-4">
        <!-- Card 1: Excel Data Center & Status -->
        <div class="col-lg-6">
          <div class="content-card h-100">
            <div class="content-card-header">
              <h5 class="content-card-title"><i class="bi bi-file-earmark-excel-fill text-success"></i> Pusat Data Excel Utama</h5>
              <span class="badge bg-success">Persisten</span>
            </div>
            <div class="content-card-body" id="settings-storage-info">
              <div class="text-center py-4">
                <div class="spinner-border text-success" role="status"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Card 2: Cloud Sync Configuration -->
        <div class="col-lg-6">
          <div class="content-card h-100">
            <div class="content-card-header">
              <h5 class="content-card-title"><i class="bi bi-cloud-arrow-up-fill text-primary"></i> Integrasi Penyimpanan Cloud</h5>
              <button class="btn btn-sm btn-outline-primary" onclick="SettingsModule.triggerSync()">
                <i class="bi bi-arrow-repeat"></i> Sinkronisasi
              </button>
            </div>
            <div class="content-card-body" id="settings-cloud-info">
              <!-- Rendered dynamically -->
            </div>
          </div>
        </div>

        <!-- Card 3: Backup & Restore Manager -->
        <div class="col-12">
          <div class="content-card">
            <div class="content-card-header flex-wrap gap-2">
              <div class="d-flex align-items-center gap-3">
                <h5 class="content-card-title"><i class="bi bi-shield-check text-warning"></i> Cadangan Workbook (Automated Backups)</h5>
                <span class="badge bg-light text-dark border" id="backup-total-badge">0 File</span>
              </div>
              <button class="btn btn-bsg-yellow btn-sm" onclick="SettingsModule.createBackup()">
                <i class="bi bi-plus-lg"></i> Buat Backup Manual Sekarang
              </button>
            </div>
            <div class="content-card-body p-0">
              <div class="table-responsive">
                <table class="table table-bsg align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Nama File Backup</th>
                      <th>Ukuran File</th>
                      <th>Waktu Pembuatan</th>
                      <th class="text-end">Aksi Pemulihan</th>
                    </tr>
                  </thead>
                  <tbody id="backup-table-body">
                    <tr><td colspan="4" class="text-center py-4">Memuat daftar backup...</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    await this.loadData();
  },

  async loadData() {
    try {
      const [resStatus, resBackups] = await Promise.all([
        API.get('/storage/status'),
        API.get('/storage/backups')
      ]);

      this.status = resStatus.data;
      this.backups = resBackups.data;

      this.renderStorageInfo();
      this.renderCloudInfo();
      this.renderBackups();
    } catch (err) {
      console.error(err);
    }
  },

  renderStorageInfo() {
    const el = document.getElementById('settings-storage-info');
    if (!el || !this.status) return;

    el.innerHTML = `
      <div class="mb-3">
        <label class="text-muted small fw-bold">File Workbook Utama:</label>
        <div class="fw-bold font-monospace fs-6 text-dark">${this.status.primaryFile}</div>
      </div>
      <div class="row g-3 mb-4">
        <div class="col-sm-6">
          <div class="p-3 bg-light rounded-3 border">
            <div class="text-muted small">Ukuran File:</div>
            <div class="fw-bold fs-5">${this.status.fileSizeFormatted}</div>
          </div>
        </div>
        <div class="col-sm-6">
          <div class="p-3 bg-light rounded-3 border">
            <div class="text-muted small">Terakhir Dimodifikasi:</div>
            <div class="fw-bold small mt-1">${this.status.lastModified ? new Date(this.status.lastModified).toLocaleString('id-ID') : '-'}</div>
          </div>
        </div>
      </div>

      <div class="d-flex gap-2">
        <a href="/api/storage/download" class="btn btn-dark w-100 py-2">
          <i class="bi bi-download"></i> Unduh Workbook Excel Terkini
        </a>
      </div>
    `;
  },

  renderCloudInfo() {
    const el = document.getElementById('settings-cloud-info');
    if (!el || !this.status) return;

    el.innerHTML = `
      <div class="p-3 rounded-3 mb-3 ${this.status.isCloudConnected ? 'bg-success-subtle border border-success' : 'bg-light border'}">
        <div class="d-flex align-items-center gap-2 mb-1">
          <i class="bi ${this.status.isCloudConnected ? 'bi-cloud-check-fill text-success fs-5' : 'bi-cloud-slash text-muted fs-5'}"></i>
          <strong class="text-dark">Penyedia Cloud: ${this.status.cloudProvider}</strong>
        </div>
        <div class="small text-muted">
          ${this.status.isCloudConnected ?
            'Terkoneksi persisten. Setiap transaksi dan perubahan data disinkronkan otomatis.' :
            'Saat ini berjalan pada penyimpanan persisten file sistem lokal. Untuk Vercel production, sediakan <code>MS_GRAPH_CLIENT_ID</code> atau <code>BLOB_READ_WRITE_TOKEN</code> pada Environment Variables.'}
        </div>
      </div>

      <div class="small text-muted">
        <strong>Ketentuan Sesuai Panduan Proyek:</strong>
        <ul class="mb-0 ps-3 mt-1">
          <li>Workbook Excel menjadi sumber data tunggal (Single Source of Truth).</li>
          <li>Setiap perubahan transaksi, menu, BOM, dan barang masuk langsung disimpan ke Excel.</li>
          <li>Antrean penulisan (Write Queue Mutex) mencegah tabrakan data multi-pengguna.</li>
          <li>Backup otomatis dibuat sebelum setiap penulisan data penting.</li>
        </ul>
      </div>
    `;
  },

  renderBackups() {
    const tbody = document.getElementById('backup-table-body');
    const badge = document.getElementById('backup-total-badge');
    if (!tbody) return;

    badge.textContent = `${this.backups.length} File`;

    if (this.backups.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-muted">Belum ada file backup yang dibuat.</td></tr>`;
      return;
    }

    tbody.innerHTML = this.backups.map(b => `
      <tr>
        <td class="fw-bold font-monospace small"><i class="bi bi-file-earmark-spreadsheet text-success me-1"></i> ${b.filename}</td>
        <td>${b.sizeFormatted}</td>
        <td>${new Date(b.createdAt).toLocaleString('id-ID')}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-warning" onclick="SettingsModule.restoreBackup('${b.filename}')">
            <i class="bi bi-arrow-counterclockwise"></i> Pulihkan (Restore)
          </button>
        </td>
      </tr>
    `).join('');
  },

  async createBackup() {
    try {
      Swal.fire({
        title: 'Membuat Backup...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      });

      await API.post('/storage/backups', {});
      Swal.fire({ icon: 'success', title: 'Backup Berhasil', timer: 1500, showConfirmButton: false });
      await this.loadData();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal Membuat Backup', text: err.message });
    }
  },

  async restoreBackup(filename) {
    const result = await Swal.fire({
      title: 'Pulihkan Workbook?',
      text: `Apakah Anda yakin ingin memulihkan data dari "${filename}"? Sistem akan mencadangkan kondisi saat ini sebelum pemulihan.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#171717',
      confirmButtonText: 'Ya, Pulihkan Data'
    });

    if (result.isConfirmed) {
      try {
        Swal.fire({ title: 'Memulihkan...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        await API.post('/storage/restore', { filename });
        Swal.fire({ icon: 'success', title: 'Berhasil Dipulihkan!', text: 'Data terbaru dari backup telah aktif.', confirmButtonColor: '#171717' });
        await this.loadData();
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'Gagal Memulihkan', text: err.message });
      }
    }
  },

  async triggerSync() {
    try {
      Swal.fire({ title: 'Menyinkronkan ke Cloud...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      const res = await API.post('/storage/sync', {});
      Swal.fire({
        icon: res.data.synced ? 'success' : 'info',
        title: res.data.synced ? 'Tersinkronisasi' : 'Informasi Penyimpanan',
        text: res.data.message || 'Sinkronisasi berhasil dilakukan.',
        confirmButtonColor: '#171717'
      });
      await this.loadData();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal Sinkronisasi', text: err.message });
    }
  }
};
