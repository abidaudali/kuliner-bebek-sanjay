/**
 * POS (Point of Sale / Kasir) Module
 */
const POS = {
  menuList: [],
  cart: [],
  activeCategory: 'Semua',
  searchQuery: '',
  selectedPayMethod: 'TUNAI',
  lastTransaction: null,
  isSubmitting: false,

  async render() {
    const container = document.getElementById('content-area');
    container.innerHTML = `
      <div class="pos-container">
        <!-- Left: Menu Catalog -->
        <div>
          <!-- Search & Categories -->
          <div class="d-flex flex-wrap gap-2 justify-content-between align-items-center mb-3">
            <div class="input-group" style="max-width: 320px;">
              <span class="input-group-text bg-white border-end-0"><i class="bi bi-search text-muted"></i></span>
              <input type="text" id="pos-search" class="form-control border-start-0" placeholder="Cari menu makanan/minuman..." oninput="POS.onSearch(this.value)">
            </div>
            <div class="text-muted small">
              Klik menu untuk menambahkan ke keranjang pesanan
            </div>
          </div>

          <div class="pos-categories" id="pos-category-tabs">
            <button class="pos-cat-btn active" onclick="POS.filterCategory('Semua', this)">Semua Menu</button>
            <button class="pos-cat-btn" onclick="POS.filterCategory('Bumbu Hitam', this)">Bumbu Hitam</button>
            <button class="pos-cat-btn" onclick="POS.filterCategory('Spesial Kremes', this)">Spesial Kremes</button>
            <button class="pos-cat-btn" onclick="POS.filterCategory('Include Nasi', this)">Include Nasi</button>
            <button class="pos-cat-btn" onclick="POS.filterCategory('Sayur', this)">Sayur</button>
            <button class="pos-cat-btn" onclick="POS.filterCategory('Tambahan', this)">Tambahan</button>
            <button class="pos-cat-btn" onclick="POS.filterCategory('Minuman', this)">Minuman</button>
          </div>

          <!-- Menu Cards Grid -->
          <div class="pos-menu-grid" id="pos-menu-grid">
            <div class="text-center py-5 col-span-full">
              <div class="spinner-border text-warning" role="status"></div>
            </div>
          </div>
        </div>

        <!-- Right: Cart Panel -->
        <div>
          <div class="pos-cart-panel">
            <div class="pos-cart-header">
              <h5 class="m-0 fw-bold fs-6"><i class="bi bi-cart3 text-warning"></i> Pesanan Kasir</h5>
              <button class="btn btn-sm btn-outline-light py-0 px-2" onclick="POS.clearCart()" title="Kosongkan Keranjang">
                <i class="bi bi-trash"></i> Reset
              </button>
            </div>

            <div class="pos-cart-items" id="pos-cart-items">
              <div class="text-center text-muted py-5">
                <i class="bi bi-bag-x fs-1 text-secondary"></i>
                <div class="mt-2 small">Keranjang masih kosong</div>
              </div>
            </div>

            <div class="pos-cart-footer">
              <div class="d-flex justify-content-between text-muted small mb-1">
                <span>Jumlah Item:</span>
                <span id="pos-total-items">0 item (0 porsi)</span>
              </div>
              <div class="pos-total-row">
                <span>Total Bayar:</span>
                <span class="text-dark" id="pos-total-price">Rp 0</span>
              </div>
              <button class="btn btn-bsg-yellow w-100 py-2 fs-6 fw-bold justify-content-center" id="btn-open-payment" onclick="POS.openPaymentModal()" disabled>
                <i class="bi bi-credit-card-2-front"></i> Lanjut ke Pembayaran
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.loadCart();
    this.renderCart();
    await this.loadMenu();
  },

  loadCart() {
    try {
      const saved = localStorage.getItem('bsg_pos_cart');
      if (saved) {
        this.cart = JSON.parse(saved);
      }
    } catch (e) {
      this.cart = [];
    }
  },

  saveCart() {
    try {
      localStorage.setItem('bsg_pos_cart', JSON.stringify(this.cart));
    } catch (e) {}
  },

  async loadMenu() {
    try {
      const res = await API.get('/menu');
      this.menuList = res.data;
      this.renderMenuGrid();
    } catch (err) {
      document.getElementById('pos-menu-grid').innerHTML = `
        <div class="alert alert-danger w-100">Gagal memuat menu: ${err.message}</div>
      `;
    }
  },

  onSearch(query) {
    this.searchQuery = query.toLowerCase();
    this.renderMenuGrid();
  },

  filterCategory(cat, btn) {
    this.activeCategory = cat;
    document.querySelectorAll('.pos-cat-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    this.renderMenuGrid();
  },

  getMenuImage(menuName) {
    const nameLower = menuName.toLowerCase();
    if (nameLower.includes('bumbu hitam')) return '/assets/images/Bebek bumbu hitam.jpg';
    if (nameLower.includes('kremes')) return '/assets/images/Bebek goreng krispi.jpg';
    if (nameLower.includes('kemangi')) return '/assets/images/Bebek goreng sambal ijo.jpg';
    if (nameLower.includes('ayam')) return '/assets/images/Bebek penyet sambal bawang.jpg';
    if (nameLower.includes('bebek')) return '/assets/images/Bebek bumbu hitam.jpg';
    if (nameLower.includes('kangkung') || nameLower.includes('toge') || nameLower.includes('terong') || nameLower.includes('kol')) {
      return '/assets/images/Sambal Ekstra Bawang.jpg';
    }
    if (nameLower.includes('tahu')) return '/assets/images/Tahu Goreng.jpg';
    if (nameLower.includes('tempe')) return '/assets/images/Tempe Goreng .jpg';
    if (nameLower.includes('nasi putih')) return '/assets/images/Nasi Putih.jpg';
    if (nameLower.includes('teh')) return '/assets/images/Es Teh.jpg';
    if (nameLower.includes('jeruk')) return '/assets/images/Es Jeruk Segar.png';
    if (nameLower.includes('mineral')) return '/assets/images/Air Mineral 600ml.jpg';
    return '/assets/images/papan_nama.jpg';
  },

  renderMenuGrid() {
    const grid = document.getElementById('pos-menu-grid');
    if (!grid) return;

    let filtered = [...this.menuList];

    if (this.activeCategory !== 'Semua') {
      filtered = filtered.filter(m => m.kategori.toLowerCase() === this.activeCategory.toLowerCase());
    }

    if (this.searchQuery) {
      filtered = filtered.filter(m =>
        m.nama_menu.toLowerCase().includes(this.searchQuery) ||
        m.kategori.toLowerCase().includes(this.searchQuery)
      );
    }

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="text-center text-muted py-5" style="grid-column: 1 / -1;">
          <i class="bi bi-search fs-1"></i>
          <div class="mt-2">Tidak ada menu yang sesuai dengan pencarian.</div>
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered.map(m => `
      <div class="pos-menu-card" onclick="POS.addToCart(${m.kode_menu})">
        <div class="pos-menu-img-wrap">
          <img src="${this.getMenuImage(m.nama_menu)}" alt="${m.nama_menu}" class="pos-menu-img" onerror="this.src='/assets/images/papan_nama.jpg'">
          <span class="pos-menu-badge">${m.kategori}</span>
        </div>
        <div class="pos-menu-content">
          <div class="pos-menu-name">${m.nama_menu}</div>
          <div class="d-flex justify-content-between align-items-center mt-2">
            <span class="pos-menu-price">${App.formatRp(m.harga_satuan_rp)}</span>
            <span class="btn btn-sm btn-bsg-yellow py-0 px-2 rounded-circle" style="width: 26px; height: 26px; line-height: 24px; padding: 0;">+</span>
          </div>
        </div>
      </div>
    `).join('');
  },

  addToCart(kode_menu) {
    const menuObj = this.menuList.find(m => Number(m.kode_menu) === Number(kode_menu));
    if (!menuObj) return;

    const existingIndex = this.cart.findIndex(c => Number(c.kode_menu) === Number(kode_menu));
    if (existingIndex !== -1) {
      this.cart[existingIndex].qty_porsi += 1;
    } else {
      this.cart.push({
        kode_menu: menuObj.kode_menu,
        nama_menu: menuObj.nama_menu,
        kategori: menuObj.kategori,
        harga_satuan_rp: menuObj.harga_satuan_rp,
        qty_porsi: 1
      });
    }

    this.saveCart();
    this.renderCart();
  },

  updateQty(kode_menu, delta) {
    const index = this.cart.findIndex(c => Number(c.kode_menu) === Number(kode_menu));
    if (index === -1) return;

    this.cart[index].qty_porsi += delta;
    if (this.cart[index].qty_porsi <= 0) {
      this.cart.splice(index, 1);
    }

    this.saveCart();
    this.renderCart();
  },

  removeItem(kode_menu) {
    this.cart = this.cart.filter(c => Number(c.kode_menu) !== Number(kode_menu));
    this.saveCart();
    this.renderCart();
  },

  clearCart() {
    this.cart = [];
    this.saveCart();
    this.renderCart();
  },

  getTotalPrice() {
    return this.cart.reduce((sum, item) => sum + (item.harga_satuan_rp * item.qty_porsi), 0);
  },

  getTotalPorsi() {
    return this.cart.reduce((sum, item) => sum + item.qty_porsi, 0);
  },

  renderCart() {
    const itemsContainer = document.getElementById('pos-cart-items');
    const totalItemsEl = document.getElementById('pos-total-items');
    const totalPriceEl = document.getElementById('pos-total-price');
    const btnPay = document.getElementById('btn-open-payment');

    if (!itemsContainer) return;

    const total = this.getTotalPrice();
    const totalPorsi = this.getTotalPorsi();

    totalItemsEl.textContent = `${this.cart.length} item (${totalPorsi} porsi)`;
    totalPriceEl.textContent = App.formatRp(total);

    if (this.cart.length === 0) {
      btnPay.disabled = true;
      itemsContainer.innerHTML = `
        <div class="text-center text-muted py-5">
          <i class="bi bi-bag-x fs-1 text-secondary"></i>
          <div class="mt-2 small">Keranjang masih kosong</div>
        </div>
      `;
      return;
    }

    btnPay.disabled = false;
    itemsContainer.innerHTML = this.cart.map(item => `
      <div class="pos-cart-item">
        <div class="pos-item-info">
          <div class="pos-item-title">${item.nama_menu}</div>
          <div class="pos-item-price">${App.formatRp(item.harga_satuan_rp)} × ${item.qty_porsi} = <strong>${App.formatRp(item.harga_satuan_rp * item.qty_porsi)}</strong></div>
        </div>
        <div class="pos-qty-controls">
          <button class="pos-qty-btn" onclick="POS.updateQty(${item.kode_menu}, -1)">-</button>
          <span class="fw-bold px-1" style="min-width: 20px; text-align: center;">${item.qty_porsi}</span>
          <button class="pos-qty-btn" onclick="POS.updateQty(${item.kode_menu}, 1)">+</button>
        </div>
        <button class="btn btn-sm btn-link text-danger p-0 ms-1" onclick="POS.removeItem(${item.kode_menu})" title="Hapus">
          <i class="bi bi-x-circle"></i>
        </button>
      </div>
    `).join('');
  },

  /* ==========================================================================
     PAYMENT & CHECKOUT MODAL
     ========================================================================== */
  openPaymentModal() {
    if (this.cart.length === 0) return;

    const total = this.getTotalPrice();
    document.getElementById('pay-total-display').textContent = App.formatRp(total);

    // Default payment method TUNAI
    this.selectPayMethod(null, 'TUNAI');
    document.getElementById('pay-cash-received').value = total;
    this.calculateChange();

    const modal = new bootstrap.Modal(document.getElementById('modalPayment'));
    modal.show();
  },

  selectPayMethod(btn, method) {
    this.selectedPayMethod = method;
    document.querySelectorAll('#payment-methods-grid button').forEach(b => b.classList.remove('active', 'btn-dark'));
    if (btn) {
      btn.classList.add('active', 'btn-dark');
    } else {
      const defaultBtn = document.querySelector(`#payment-methods-grid button[data-method="${method}"]`);
      if (defaultBtn) defaultBtn.classList.add('active', 'btn-dark');
    }

    const cashFields = document.getElementById('cash-payment-fields');
    if (method === 'TUNAI') {
      cashFields.style.display = 'block';
    } else {
      cashFields.style.display = 'none';
    }
  },

  setCashExact() {
    const total = this.getTotalPrice();
    document.getElementById('pay-cash-received').value = total;
    this.calculateChange();
  },

  addCash(amount) {
    const current = Number(document.getElementById('pay-cash-received').value) || 0;
    document.getElementById('pay-cash-received').value = current + amount;
    this.calculateChange();
  },

  calculateChange() {
    const total = this.getTotalPrice();
    const received = Number(document.getElementById('pay-cash-received').value) || 0;
    const change = received - total;

    const display = document.getElementById('pay-change-display');
    if (change < 0) {
      display.textContent = 'Kurang ' + App.formatRp(Math.abs(change));
      display.className = 'fs-5 fw-bold text-danger';
    } else {
      display.textContent = App.formatRp(change);
      display.className = 'fs-5 fw-bold text-success';
    }
  },

  async submitOrder() {
    if (this.isSubmitting) return; // Prevent double click
    this.isSubmitting = true;

    const btnSubmit = document.getElementById('btn-confirm-payment');
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Menyimpan ke Excel...`;

    try {
      const total = this.getTotalPrice();
      const received = Number(document.getElementById('pay-cash-received').value) || total;

      if (this.selectedPayMethod === 'TUNAI' && received < total) {
        throw new Error('Nominal uang diterima kurang dari total tagihan.');
      }

      const notes = document.getElementById('pay-notes').value.trim();
      const idempotencyKey = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const payload = {
        items: this.cart,
        paymentMethod: this.selectedPayMethod,
        notes,
        idempotencyKey
      };

      const res = await API.post('/transaksi', payload);
      this.lastTransaction = {
        ...res.data,
        paymentMethod: this.selectedPayMethod,
        paid: received,
        change: Math.max(0, received - total)
      };

      // Close Payment Modal
      const modalEl = document.getElementById('modalPayment');
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();

      // Show Receipt
      this.showReceipt(this.lastTransaction);

      // Clear cart
      this.clearCart();

      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Transaksi Berhasil!',
        text: `Tersimpan ke Excel (${res.data.id_transaksi}) & stok terpotong`,
        showConfirmButton: false,
        timer: 3000
      });

    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Gagal Memproses Transaksi',
        text: err.message,
        confirmButtonColor: '#171717'
      });
    } finally {
      this.isSubmitting = false;
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = `<i class="bi bi-check-circle-fill"></i> Proses & Simpan Transaksi`;
    }
  },

  showReceipt(trx) {
    document.getElementById('rec-id').textContent = trx.id_transaksi;
    document.getElementById('rec-datetime').textContent = `${trx.tanggal} ${trx.jam}`;
    document.getElementById('rec-cashier').textContent = App.currentUser ? App.currentUser.name : 'Kasir';
    document.getElementById('rec-total').textContent = App.formatRp(trx.total_penjualan_rp);
    document.getElementById('rec-method').textContent = trx.paymentMethod;
    document.getElementById('rec-paid').textContent = App.formatRp(trx.paid);
    document.getElementById('rec-change').textContent = App.formatRp(trx.change);

    const itemsContainer = document.getElementById('rec-items-list');
    itemsContainer.innerHTML = trx.items.map(i => `
      <div class="d-flex justify-content-between my-1">
        <div>
          <div>${i.nama_menu}</div>
          <div class="text-muted" style="font-size: 0.75rem;">${i.qty_porsi} × ${App.formatRp(i.harga_satuan_rp)}</div>
        </div>
        <div class="fw-bold">${App.formatRp(i.total_penjualan_rp)}</div>
      </div>
    `).join('');

    const modal = new bootstrap.Modal(document.getElementById('modalReceipt'));
    modal.show();
  }
};
