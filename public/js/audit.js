/**
 * Audit Log Module (Riwayat Perubahan Data Excel)
 */
const AuditModule = {
  list: [],

  async render() {
    const container = document.getElementById('content-area');
    container.innerHTML = `
      <div class="content-card">
        <div class="content-card-header flex-wrap gap-2">
          <div class="d-flex align-items-center gap-3">
            <h5 class="content-card-title"><i class="bi bi-journal-text text-warning"></i> Log Riwayat Perubahan Data (Audit Trail)</h5>
            <span class="badge bg-light text-dark border" id="audit-total-badge">0 Catatan</span>
          </div>
          <button class="btn btn-sm btn-outline-dark" onclick="AuditModule.loadData()">
            <i class="bi bi-arrow-clockwise"></i> Segarkan Log
          </button>
        </div>

        <div class="content-card-body p-0">
          <div class="table-responsive">
            <table class="table table-bsg align-middle mb-0">
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Pengguna</th>
                  <th>Aktivitas</th>
                  <th>Lembar (Sheet)</th>
                  <th>Rincian Keterangan</th>
                  <th>Data Sebelum / Sesudah</th>
                </tr>
              </thead>
              <tbody id="audit-table-body">
                <tr><td colspan="6" class="text-center py-4">Memuat log perubahan data...</td></tr>
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
      const res = await API.get('/audit');
      this.list = res.data;
      document.getElementById('audit-total-badge').textContent = `${this.list.length} Log`;
      this.renderTable(this.list);
    } catch (err) {
      document.getElementById('audit-table-body').innerHTML = `
        <tr><td colspan="6" class="text-center text-danger py-4">Gagal memuat log audit: ${err.message}</td></tr>
      `;
    }
  },

  renderTable(items) {
    const tbody = document.getElementById('audit-table-body');
    if (!tbody) return;

    if (items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">Belum ada riwayat aktivitas tercatat.</td></tr>`;
      return;
    }

    tbody.innerHTML = items.map(l => `
      <tr>
        <td>
          <div class="fw-bold">${l.tanggal}</div>
          <div class="text-muted small">${l.jam}</div>
        </td>
        <td>
          <div class="fw-bold">${l.username}</div>
          <span class="badge bg-dark" style="font-size: 0.65rem;">${l.role}</span>
        </td>
        <td>
          <span class="badge bg-warning text-dark font-monospace">${l.action}</span>
        </td>
        <td>
          <span class="badge bg-light text-dark border font-monospace">${l.sheet}</span>
        </td>
        <td>${l.details}</td>
        <td>
          ${l.before || l.after ? `
            <button class="btn btn-sm btn-outline-secondary py-0 px-2 small" onclick='AuditModule.showPayload(${JSON.stringify(l).replace(/'/g, "&#39;")})'>
              <i class="bi bi-code-slash"></i> Lihat Nilai
            </button>
          ` : '<span class="text-muted small">-</span>'}
        </td>
      </tr>
    `).join('');
  },

  showPayload(log) {
    Swal.fire({
      title: `<span class="fs-6 fw-bold">Detail Perubahan: ${log.action}</span>`,
      html: `
        <div class="text-start small">
          <div class="mb-2"><strong>Waktu:</strong> ${log.tanggal} ${log.jam} | <strong>User:</strong> ${log.username} (${log.role})</div>
          <div class="mb-3"><strong>Sheet:</strong> <code>${log.sheet}</code></div>
          
          <div class="row g-2">
            <div class="col-6">
              <label class="fw-bold text-danger">Nilai Sebelum:</label>
              <pre class="p-2 bg-light border rounded" style="max-height: 200px; font-size: 0.75rem;">${JSON.stringify(log.before, null, 2) || 'null'}</pre>
            </div>
            <div class="col-6">
              <label class="fw-bold text-success">Nilai Sesudah:</label>
              <pre class="p-2 bg-light border rounded" style="max-height: 200px; font-size: 0.75rem;">${JSON.stringify(log.after, null, 2) || 'null'}</pre>
            </div>
          </div>
        </div>
      `,
      confirmButtonColor: '#171717',
      width: '600px'
    });
  }
};
