/**
 * User Management Module (OWNER only)
 */
const UsersModule = {
  list: [],

  async render() {
    const container = document.getElementById('content-area');
    container.innerHTML = `
      <div class="content-card">
        <div class="content-card-header flex-wrap gap-2">
          <div class="d-flex align-items-center gap-3">
            <h5 class="content-card-title"><i class="bi bi-people-fill text-warning"></i> Manajemen Hak Akses Pengguna</h5>
            <span class="badge bg-light text-dark border" id="users-total-badge">0 Akun</span>
          </div>
          <button class="btn btn-bsg-yellow btn-sm" onclick="UsersModule.openAddModal()">
            <i class="bi bi-person-plus-fill"></i> Tambah Pengguna Baru
          </button>
        </div>

        <div class="content-card-body p-0">
          <div class="table-responsive">
            <table class="table table-bsg align-middle mb-0">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nama Lengkap</th>
                  <th>Username</th>
                  <th>Peran (Role)</th>
                  <th>Izin Akses</th>
                  <th class="text-end">Aksi</th>
                </tr>
              </thead>
              <tbody id="users-table-body">
                <tr><td colspan="6" class="text-center py-4">Memuat pengguna...</td></tr>
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
      const res = await API.get('/users');
      this.list = res.data;
      document.getElementById('users-total-badge').textContent = `${this.list.length} Akun`;
      this.renderTable(this.list);
    } catch (err) {
      document.getElementById('users-table-body').innerHTML = `
        <tr><td colspan="6" class="text-center text-danger py-4">Gagal memuat pengguna: ${err.message}</td></tr>
      `;
    }
  },

  renderTable(items) {
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;

    tbody.innerHTML = items.map(u => {
      let roleBadge = 'bg-secondary';
      let permissions = '';
      if (u.role === 'OWNER') {
        roleBadge = 'bg-dark text-warning';
        permissions = 'Seluruh Dashboard, Menu, Bahan, Transaksi, Persediaan, Laporan, User';
      } else if (u.role === 'KASIR') {
        roleBadge = 'bg-primary';
        permissions = 'Menu, Kasir POS, Transaksi, Cetak Struk';
      } else if (u.role === 'DAPUR') {
        roleBadge = 'bg-danger';
        permissions = 'Antrean Dapur, Kebutuhan Bahan, Update Status Pesanan';
      }

      return `
        <tr>
          <td>${u.id}</td>
          <td class="fw-bold">${u.name}</td>
          <td><code>${u.username}</code></td>
          <td><span class="badge ${roleBadge}">${u.role}</span></td>
          <td class="text-muted small">${permissions}</td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-dark me-1" onclick="UsersModule.openEditModal(${u.id})">
              <i class="bi bi-pencil-square"></i> Edit
            </button>
            ${u.username !== 'owner' ? `
              <button class="btn btn-sm btn-outline-danger" onclick="UsersModule.deleteUser(${u.id}, '${u.username}')">
                <i class="bi bi-trash"></i>
              </button>
            ` : ''}
          </td>
        </tr>
      `;
    }).join('');
  },

  openAddModal() {
    document.getElementById('modalUserTitle').innerHTML = '<i class="bi bi-person-plus text-warning"></i> Tambah Pengguna Baru';
    document.getElementById('user-edit-id').value = '';
    document.getElementById('user-name').value = '';
    document.getElementById('user-username').value = '';
    document.getElementById('user-username').disabled = false;
    document.getElementById('user-password').value = '';
    document.getElementById('user-password').required = true;
    document.getElementById('user-password-label').textContent = 'Password';
    document.getElementById('user-role').value = 'KASIR';

    const modal = new bootstrap.Modal(document.getElementById('modalUser'));
    modal.show();
  },

  openEditModal(id) {
    const u = this.list.find(user => user.id === id);
    if (!u) return;

    document.getElementById('modalUserTitle').innerHTML = `<i class="bi bi-pencil-square text-warning"></i> Edit Pengguna (${u.username})`;
    document.getElementById('user-edit-id').value = u.id;
    document.getElementById('user-name').value = u.name;
    document.getElementById('user-username').value = u.username;
    document.getElementById('user-username').disabled = true;
    document.getElementById('user-password').value = '';
    document.getElementById('user-password').required = false;
    document.getElementById('user-password-label').textContent = 'Ganti Password (Kosongkan jika tidak diubah)';
    document.getElementById('user-role').value = u.role;

    const modal = new bootstrap.Modal(document.getElementById('modalUser'));
    modal.show();
  },

  async save(e) {
    e.preventDefault();
    const id = document.getElementById('user-edit-id').value;
    const name = document.getElementById('user-name').value.trim();
    const username = document.getElementById('user-username').value.trim();
    const password = document.getElementById('user-password').value;
    const role = document.getElementById('user-role').value;

    try {
      if (id) {
        await API.put(`/users/${id}`, { name, role, password });
      } else {
        await API.post('/users', { name, username, password, role });
      }

      const modalEl = document.getElementById('modalUser');
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();

      Swal.fire({
        icon: 'success',
        title: 'Berhasil',
        text: 'Data pengguna berhasil disimpan.',
        timer: 1500,
        showConfirmButton: false
      });

      await this.loadData();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err.message });
    }
  },

  async deleteUser(id, username) {
    const result = await Swal.fire({
      title: 'Hapus Pengguna?',
      text: `Apakah Anda yakin ingin menghapus akun "${username}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#171717',
      confirmButtonText: 'Ya, Hapus'
    });

    if (result.isConfirmed) {
      try {
        await API.delete(`/users/${id}`);
        Swal.fire({ icon: 'success', title: 'Terhapus', timer: 1500, showConfirmButton: false });
        await this.loadData();
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'Gagal', text: err.message });
      }
    }
  }
};
