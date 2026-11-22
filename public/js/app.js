/**
 * Core Application Controller & Router
 */
const App = {
  currentUser: null,
  currentRoute: 'dashboard',

  init() {
    this.bindEvents();
    this.checkAuth();
  },

  bindEvents() {
    // Form Login
    const formLogin = document.getElementById('form-login');
    if (formLogin) {
      formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        await this.login(username, password);
      });
    }

    // URL Hash change router
    window.addEventListener('hashchange', () => {
      this.route();
    });
  },

  async checkAuth() {
    const token = API.getToken();
    const storedUser = localStorage.getItem('bsg_user');

    if (!token || !storedUser) {
      this.showLogin();
      return;
    }

    try {
      this.currentUser = JSON.parse(storedUser);
      this.showApp();
      this.route();
    } catch (e) {
      this.showLogin();
    }
  },

  async login(username, password) {
    try {
      Swal.fire({
        title: 'Menghubungkan...',
        text: 'Memvalidasi kredensial dan menghubungkan ke Excel Data Center',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      });

      const res = await API.post('/auth/login', { username, password });
      API.setToken(res.token);
      localStorage.setItem('bsg_user', JSON.stringify(res.user));
      this.currentUser = res.user;

      Swal.close();
      this.showApp();

      // If user is DAPUR, directly navigate to kitchen queue
      if (this.currentUser.role === 'DAPUR') {
        window.location.hash = '#/kitchen';
      } else {
        window.location.hash = '#/dashboard';
      }
      this.route();
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Login Gagal',
        text: err.message || 'Username atau password salah.',
        confirmButtonColor: '#171717'
      });
    }
  },

  quickLogin(username, password) {
    document.getElementById('login-username').value = username;
    document.getElementById('login-password').value = password;
    this.login(username, password);
  },

  logout() {
    Swal.fire({
      title: 'Keluar dari Sistem?',
      text: 'Anda akan keluar dari sesi akun saat ini.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#171717',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Ya, Keluar',
      cancelButtonText: 'Batal'
    }).then((result) => {
      if (result.isConfirmed) {
        API.setToken(null);
        localStorage.removeItem('bsg_user');
        this.currentUser = null;
        this.showLogin();
      }
    });
  },

  showLogin() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app-layout').style.display = 'none';
  },

  showApp() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-layout').style.display = 'flex';

    // Update User Profile in Sidebar
    if (this.currentUser) {
      document.getElementById('sidebar-user-name').textContent = this.currentUser.name || this.currentUser.username;
      document.getElementById('sidebar-user-role').textContent = this.currentUser.role;
      document.getElementById('sidebar-user-avatar').textContent = (this.currentUser.username || 'U')[0].toUpperCase();
    }

    this.applyRoleRestrictions();
  },

  applyRoleRestrictions() {
    const role = this.currentUser ? this.currentUser.role : 'GUEST';

    document.querySelectorAll('.sidebar-link, .menu-category').forEach(el => {
      const allowedRoles = el.getAttribute('data-role');
      if (allowedRoles) {
        const rolesArr = allowedRoles.split(',').map(r => r.trim());
        if (!rolesArr.includes(role)) {
          el.style.display = 'none';
        } else {
          el.style.display = el.classList.contains('sidebar-link') ? 'flex' : 'block';
        }
      }
    });
  },

  toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('show');
  },

  navigate(route) {
    window.location.hash = `#/${route}`;
  },

  route() {
    if (!this.currentUser) return;

    let hash = window.location.hash.replace('#/', '').trim();
    if (!hash) hash = this.currentUser.role === 'DAPUR' ? 'kitchen' : 'dashboard';

    // Role check guard
    if (this.currentUser.role === 'DAPUR' && hash !== 'kitchen') {
      window.location.hash = '#/kitchen';
      return;
    }

    if (this.currentUser.role === 'KASIR' && ['bahan', 'resep', 'barang-masuk', 'pemakaian', 'kartu-stok', 'ss-rop', 'audit', 'users', 'settings'].includes(hash)) {
      window.location.hash = '#/dashboard';
      return;
    }

    this.currentRoute = hash;

    // Highlight active nav
    document.querySelectorAll('.sidebar-link').forEach(link => {
      if (link.getAttribute('data-nav') === hash) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Close mobile sidebar on navigate
    const sidebar = document.getElementById('sidebar');
    if (sidebar.classList.contains('show')) {
      sidebar.classList.remove('show');
    }

    // Render corresponding module view
    switch (hash) {
      case 'dashboard':
        document.getElementById('page-title').textContent = 'Dashboard Utama';
        DashboardModule.render();
        break;
      case 'pos':
        document.getElementById('page-title').textContent = 'Modul Kasir (POS)';
        POS.render();
        break;
      case 'menu':
        document.getElementById('page-title').textContent = 'Katalog Menu & Harga';
        MenuModule.render();
        break;
      case 'bahan':
        document.getElementById('page-title').textContent = 'Bahan Baku & Stok Fisik';
        BahanModule.render();
        break;
      case 'resep':
        document.getElementById('page-title').textContent = 'Resep & Bill of Materials (BOM)';
        ResepModule.render();
        break;
      case 'barang-masuk':
        document.getElementById('page-title').textContent = 'Barang Masuk & Penerimaan';
        BarangMasukModule.render();
        break;
      case 'pemakaian':
        document.getElementById('page-title').textContent = 'Pemakaian Bahan Baku';
        PemakaianModule.render();
        break;
      case 'kartu-stok':
        document.getElementById('page-title').textContent = 'Kartu Stok Harian';
        KartuStokModule.render();
        break;
      case 'ss-rop':
        document.getElementById('page-title').textContent = 'Safety Stock & Reorder Point (ROP)';
        SsRopModule.render();
        break;
      case 'transaksi':
        document.getElementById('page-title').textContent = 'Riwayat Transaksi Penjualan';
        TransaksiModule.render();
        break;
      case 'kitchen':
        document.getElementById('page-title').textContent = 'Antrean Dapur (Kitchen Display)';
        KitchenModule.render();
        break;
      case 'audit':
        document.getElementById('page-title').textContent = 'Log Riwayat Perubahan';
        AuditModule.render();
        break;
      case 'users':
        document.getElementById('page-title').textContent = 'Manajemen Pengguna';
        UsersModule.render();
        break;
      case 'settings':
        document.getElementById('page-title').textContent = 'Pengaturan Sistem & Excel Data Center';
        SettingsModule.render();
        break;
      default:
        document.getElementById('page-title').textContent = 'Dashboard Utama';
        DashboardModule.render();
        break;
    }
  },

  refreshData() {
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'info',
      title: 'Memperbarui data...',
      showConfirmButton: false,
      timer: 1000
    });
    this.route();
  },

  formatRp(val) {
    return 'Rp ' + (Number(val) || 0).toLocaleString('id-ID');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
