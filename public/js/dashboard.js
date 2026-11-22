/**
 * Dashboard Module with Chart.js Visualizations
 */
const DashboardModule = {
  charts: {},

  async render() {
    const container = document.getElementById('content-area');
    container.innerHTML = `
      <div class="d-flex justify-content-center align-items-center py-5">
        <div class="spinner-border text-warning" role="status"></div>
        <span class="ms-3 fw-semibold">Memuat analisis data dari Excel Workbook...</span>
      </div>
    `;

    try {
      const res = await API.get('/dashboard/stats');
      const stats = res.data;
      const cards = stats.cards;

      container.innerHTML = `
        <!-- KPI Cards Row -->
        <div class="row g-3 mb-4">
          <div class="col-xl-2 col-md-4 col-sm-6">
            <div class="card-kpi kpi-yellow">
              <div class="kpi-header">
                <span class="kpi-title">Total Penjualan</span>
                <div class="kpi-icon icon-yellow"><i class="bi bi-wallet2"></i></div>
              </div>
              <div class="kpi-value text-truncate">${App.formatRp(cards.totalPenjualan)}</div>
              <div class="kpi-subtext text-success"><i class="bi bi-graph-up-arrow"></i> 210 Transaksi Aktual</div>
            </div>
          </div>

          <div class="col-xl-2 col-md-4 col-sm-6">
            <div class="card-kpi">
              <div class="kpi-header">
                <span class="kpi-title">Jumlah Transaksi</span>
                <div class="kpi-icon icon-black"><i class="bi bi-receipt"></i></div>
              </div>
              <div class="kpi-value">${cards.totalTransaksi}</div>
              <div class="kpi-subtext"><i class="bi bi-calendar-check"></i> Skenario 7 Hari</div>
            </div>
          </div>

          <div class="col-xl-2 col-md-4 col-sm-6">
            <div class="card-kpi">
              <div class="kpi-header">
                <span class="kpi-title">Total Menu</span>
                <div class="kpi-icon icon-black"><i class="bi bi-egg-fried"></i></div>
              </div>
              <div class="kpi-value">${cards.totalMenu}</div>
              <div class="kpi-subtext"><i class="bi bi-tags"></i> Termasuk Paket & Minuman</div>
            </div>
          </div>

          <div class="col-xl-2 col-md-4 col-sm-6">
            <div class="card-kpi">
              <div class="kpi-header">
                <span class="kpi-title">Bahan Baku</span>
                <div class="kpi-icon icon-black"><i class="bi bi-box-seam"></i></div>
              </div>
              <div class="kpi-value">${cards.totalBahan}</div>
              <div class="kpi-subtext"><i class="bi bi-check2-circle"></i> Terstandar BOM</div>
            </div>
          </div>

          <div class="col-xl-2 col-md-4 col-sm-6">
            <div class="card-kpi kpi-warning">
              <div class="kpi-header">
                <span class="kpi-title">Stok Menipis</span>
                <div class="kpi-icon icon-warning"><i class="bi bi-exclamation-triangle"></i></div>
              </div>
              <div class="kpi-value text-warning">${cards.stokMenipisCount}</div>
              <div class="kpi-subtext text-warning"><i class="bi bi-bell"></i> Di Bawah ROP</div>
            </div>
          </div>

          <div class="col-xl-2 col-md-4 col-sm-6">
            <div class="card-kpi kpi-danger">
              <div class="kpi-header">
                <span class="kpi-title">Perlu Restock</span>
                <div class="kpi-icon icon-danger"><i class="bi bi-shield-slash"></i></div>
              </div>
              <div class="kpi-value text-danger">${cards.perluRestockCount}</div>
              <div class="kpi-subtext text-danger"><i class="bi bi-arrow-repeat"></i> Kritis (<= Safety Stock)</div>
            </div>
          </div>
        </div>

        <!-- 4 Charts Grid -->
        <div class="row g-4 mb-4">
          <!-- Chart 1: Penjualan Harian -->
          <div class="col-lg-6">
            <div class="content-card h-100">
              <div class="content-card-header">
                <h5 class="content-card-title"><i class="bi bi-graph-up text-warning"></i> Tren Penjualan Harian (Rp)</h5>
                <span class="badge bg-dark">Chart.js</span>
              </div>
              <div class="content-card-body">
                <canvas id="chart-daily-sales" height="240"></canvas>
              </div>
            </div>
          </div>

          <!-- Chart 2: Menu Terlaris -->
          <div class="col-lg-6">
            <div class="content-card h-100">
              <div class="content-card-header">
                <h5 class="content-card-title"><i class="bi bi-trophy-fill text-warning"></i> Menu Terlaris (Top 8 Porsi)</h5>
                <span class="badge bg-dark">Porsi Terjual</span>
              </div>
              <div class="content-card-body">
                <canvas id="chart-top-menu" height="240"></canvas>
              </div>
            </div>
          </div>

          <!-- Chart 3: Pemakaian Bahan -->
          <div class="col-lg-6">
            <div class="content-card h-100">
              <div class="content-card-header">
                <h5 class="content-card-title"><i class="bi bi-pie-chart text-warning"></i> Akumulasi Pemakaian Bahan Baku (Top 8)</h5>
                <span class="badge bg-dark">7 Hari Terakhir</span>
              </div>
              <div class="content-card-body">
                <canvas id="chart-material-usage" height="240"></canvas>
              </div>
            </div>
          </div>

          <!-- Chart 4: Pergerakan Persediaan vs ROP -->
          <div class="col-lg-6">
            <div class="content-card h-100">
              <div class="content-card-header">
                <h5 class="content-card-title"><i class="bi bi-bar-chart-steps text-warning"></i> Stok Aktual vs Batas Reorder Point (ROP)</h5>
                <span class="badge bg-dark">Bahan Prioritas</span>
              </div>
              <div class="content-card-body">
                <canvas id="chart-stock-vs-rop" height="240"></canvas>
              </div>
            </div>
          </div>
        </div>

        <!-- Critical Materials Alert Table -->
        <div class="content-card">
          <div class="content-card-header">
            <h5 class="content-card-title">
              <i class="bi bi-exclamation-octagon-fill text-danger"></i> Bahan Baku Perlu Perhatian & Restock Segera
            </h5>
            <button class="btn btn-sm btn-bsg-yellow" onclick="App.navigate('barang-masuk')">
              <i class="bi bi-plus-circle"></i> Input Barang Masuk
            </button>
          </div>
          <div class="content-card-body p-0">
            <div class="table-responsive">
              <table class="table table-bsg align-middle mb-0">
                <thead>
                  <tr>
                    <th>Kode</th>
                    <th>Nama Bahan Baku</th>
                    <th>Satuan</th>
                    <th>Stok Tersedia</th>
                    <th>Rata-rata / Hari</th>
                    <th>Safety Stock (SS)</th>
                    <th>Reorder Point (ROP)</th>
                    <th>Status Stok</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  ${(stats.criticalBahan || []).map(b => `
                    <tr>
                      <td class="fw-bold">${b.kode_bahan}</td>
                      <td><strong>${b.nama_bahan}</strong></td>
                      <td><span class="badge bg-light text-dark border">${b.satuan}</span></td>
                      <td class="fw-bold fs-6">${b.stok_tersedia.toLocaleString('id-ID')}</td>
                      <td>${b.rata_rata_per_hari.toLocaleString('id-ID')}</td>
                      <td>${b.safety_stock.toLocaleString('id-ID')}</td>
                      <td class="fw-bold">${b.reorder_point.toLocaleString('id-ID')}</td>
                      <td>
                        <span class="${b.status_stok === 'Harus Restock' ? 'badge-harus-restock' : 'badge-perlu-perhatian'}">
                          <i class="bi ${b.status_stok === 'Harus Restock' ? 'bi-x-circle-fill' : 'bi-exclamation-circle-fill'}"></i>
                          ${b.status_stok}
                        </span>
                      </td>
                      <td>
                        <button class="btn btn-sm btn-outline-dark" onclick="BarangMasukModule.openModalForBahan('${b.kode_bahan}')">
                          <i class="bi bi-plus-lg"></i> Restock
                        </button>
                      </td>
                    </tr>
                  `).join('') || `<tr><td colspan="9" class="text-center py-4 text-muted">Semua bahan berada dalam level stok aman.</td></tr>`}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;

      // Render Charts
      this.initCharts(stats.charts);

    } catch (err) {
      container.innerHTML = `
        <div class="alert alert-danger p-4">
          <h5><i class="bi bi-exclamation-triangle-fill"></i> Gagal Memuat Dashboard</h5>
          <p class="mb-2">${err.message}</p>
          <button class="btn btn-dark btn-sm" onclick="DashboardModule.render()">Coba Lagi</button>
        </div>
      `;
    }
  },

  initCharts(chartData) {
    // Destroy previous chart instances if any
    Object.values(this.charts).forEach(c => c && c.destroy && c.destroy());
    this.charts = {};

    // 1. Daily Sales
    const ctxSales = document.getElementById('chart-daily-sales');
    if (ctxSales && chartData.salesChart) {
      this.charts.sales = new Chart(ctxSales, {
        type: 'line',
        data: {
          labels: chartData.salesChart.labels.map(d => {
            const date = new Date(d);
            return isNaN(date) ? d : date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
          }),
          datasets: [{
            label: 'Penjualan (Rp)',
            data: chartData.salesChart.data,
            borderColor: '#F5D500',
            backgroundColor: 'rgba(245, 213, 0, 0.15)',
            fill: true,
            tension: 0.3,
            borderWidth: 3,
            pointBackgroundColor: '#171717',
            pointBorderColor: '#F5D500',
            pointRadius: 5
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            tooltip: {
              callbacks: {
                label: ctx => ' Rp ' + ctx.raw.toLocaleString('id-ID')
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: val => 'Rp ' + (val / 1000).toLocaleString('id-ID') + 'k'
              }
            }
          }
        }
      });
    }

    // 2. Top Selling Menu
    const ctxTop = document.getElementById('chart-top-menu');
    if (ctxTop && chartData.topMenuChart) {
      this.charts.top = new Chart(ctxTop, {
        type: 'bar',
        data: {
          labels: chartData.topMenuChart.labels,
          datasets: [{
            label: 'Porsi Terjual',
            data: chartData.topMenuChart.data,
            backgroundColor: '#171717',
            hoverBackgroundColor: '#F5D500',
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: 'y',
          plugins: {
            legend: { display: false }
          },
          scales: {
            x: { beginAtZero: true }
          }
        }
      });
    }

    // 3. Material Usage
    const ctxMat = document.getElementById('chart-material-usage');
    if (ctxMat && chartData.materialUsageChart) {
      this.charts.mat = new Chart(ctxMat, {
        type: 'bar',
        data: {
          labels: chartData.materialUsageChart.labels,
          datasets: [{
            label: 'Total Pemakaian',
            data: chartData.materialUsageChart.data,
            backgroundColor: 'rgba(245, 213, 0, 0.85)',
            borderColor: '#171717',
            borderWidth: 1,
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: { beginAtZero: true }
          }
        }
      });
    }

    // 4. Stock vs ROP
    const ctxRop = document.getElementById('chart-stock-vs-rop');
    if (ctxRop && chartData.stockVsRop) {
      this.charts.rop = new Chart(ctxRop, {
        type: 'bar',
        data: {
          labels: chartData.stockVsRop.map(s => s.name),
          datasets: [
            {
              label: 'Stok Saat Ini',
              data: chartData.stockVsRop.map(s => s.current),
              backgroundColor: '#10B981',
              borderRadius: 4
            },
            {
              label: 'Batas ROP',
              data: chartData.stockVsRop.map(s => s.rop),
              backgroundColor: '#F59E0B',
              borderRadius: 4
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { beginAtZero: true }
          }
        }
      });
    }
  }
};
