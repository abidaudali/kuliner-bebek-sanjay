/**
 * Kitchen Display System (KDS / Antrean Dapur) Module
 */
const KitchenModule = {
  queue: [],
  pollTimer: null,

  async render() {
    const container = document.getElementById('content-area');
    container.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div>
          <h4 class="fw-bold m-0"><i class="bi bi-fire text-danger"></i> Antrean Dapur (Kitchen Display)</h4>
          <span class="text-muted small">Pembaruan otomatis realtime setiap 5 detik tanpa refresh manual</span>
        </div>
        <div class="d-flex align-items-center gap-2">
          <span class="badge bg-success-subtle text-success border border-success px-3 py-2">
            <span class="excel-status-dot me-1"></span> Live Polling Aktif
          </span>
          <button class="btn btn-sm btn-outline-dark" onclick="KitchenModule.loadQueue()">
            <i class="bi bi-arrow-clockwise"></i> Perbarui Antrean
          </button>
        </div>
      </div>

      <div class="kitchen-grid" id="kitchen-cards-container">
        <div class="text-center py-5 col-span-full">
          <div class="spinner-border text-danger" role="status"></div>
          <div class="mt-2 text-muted">Memeriksa antrean pesanan dapur...</div>
        </div>
      </div>
    `;

    await this.loadQueue();
    this.startAutoPoll();
  },

  async loadQueue() {
    try {
      const res = await API.get('/kitchen/queue');
      this.queue = res.data;
      this.renderQueue();
    } catch (err) {
      const container = document.getElementById('kitchen-cards-container');
      if (container) {
        container.innerHTML = `<div class="alert alert-danger w-100">Gagal memuat antrean: ${err.message}</div>`;
      }
    }
  },

  renderQueue() {
    const container = document.getElementById('kitchen-cards-container');
    if (!container) return;

    if (this.queue.length === 0) {
      container.innerHTML = `
        <div class="text-center py-5 w-100" style="grid-column: 1 / -1;">
          <i class="bi bi-check2-circle display-3 text-success"></i>
          <h5 class="fw-bold mt-3">Tidak Ada Antrean Pesanan</h5>
          <p class="text-muted small">Semua pesanan saat ini telah selesai disiapkan dan disajikan.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = this.queue.map(order => {
      let actionBtn = '';
      if (order.status_pesanan === 'menunggu_proses') {
        actionBtn = `
          <button class="btn btn-warning w-100 fw-bold" onclick="KitchenModule.updateStatus('${order.id_transaksi}', 'diproses')">
            <i class="bi bi-play-fill"></i> Mulai Masak (Proses)
          </button>
        `;
      } else if (order.status_pesanan === 'diproses') {
        actionBtn = `
          <button class="btn btn-primary w-100 fw-bold" onclick="KitchenModule.updateStatus('${order.id_transaksi}', 'siap')">
            <i class="bi bi-bell-fill"></i> Masakan Siap Saji
          </button>
        `;
      } else if (order.status_pesanan === 'siap') {
        actionBtn = `
          <button class="btn btn-success w-100 fw-bold" onclick="KitchenModule.updateStatus('${order.id_transaksi}', 'selesai')">
            <i class="bi bi-check-all"></i> Selesai Diserahkan
          </button>
        `;
      }

      return `
        <div class="kitchen-card status-${order.status_pesanan}">
          <div class="kitchen-card-header header-${order.status_pesanan}">
            <div>
              <strong class="font-monospace">${order.id_transaksi}</strong>
              <div style="font-size: 0.75rem;"><i class="bi bi-clock"></i> ${order.jam} | ${order.tanggal}</div>
            </div>
            <span class="badge bg-dark text-white text-uppercase">${order.status_pesanan.replace('_', ' ')}</span>
          </div>
          <div class="kitchen-card-body">
            <div class="small text-muted mb-2 fw-semibold">Detail Menu (${order.total_porsi} Porsi):</div>
            ${order.items.map(item => `
              <div class="kitchen-item-row">
                <span>${item.nama_menu}</span>
                <span class="kitchen-item-qty">${item.qty_porsi} porsi</span>
              </div>
            `).join('')}

            ${order.catatan ? `
              <div class="mt-3 p-2 bg-light rounded text-muted small">
                <i class="bi bi-chat-left-dots"></i> <em>${order.catatan}</em>
              </div>
            ` : ''}
          </div>
          <div class="kitchen-card-footer">
            ${actionBtn}
          </div>
        </div>
      `;
    }).join('');
  },

  async updateStatus(id, newStatus) {
    try {
      await API.put(`/kitchen/status/${id}`, { status: newStatus });
      await this.loadQueue();

      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: `Status diubah: ${newStatus}`,
        showConfirmButton: false,
        timer: 1500
      });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err.message });
    }
  },

  startAutoPoll() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = setInterval(() => {
      if (App.currentRoute === 'kitchen') {
        this.loadQueue();
      } else {
        clearInterval(this.pollTimer);
      }
    }, 5000);
  }
};
