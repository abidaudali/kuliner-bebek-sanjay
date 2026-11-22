# KULINER BEBEK SANJAY GOWA
### Modern Restaurant Management System & Persediaan Terintegrasi Excel Workbook

Sistem manajemen restoran dan estimasi kebutuhan bahan baku **Kuliner Bebek Sanjay Gowa** yang dibangun ulang dari awal dengan desain modern, profesional, responsif, dan terintegrasi langsung dengan workbook Excel sebagai pusat data utama (Single Source of Truth).

---

## 1. Identitas Visual & Konsep Desain
Mengacu langsung pada papan nama fisik Bebek Sanjay Gowa:
- **Primary Black**: `#171717` (Sidebar & Elemen Utama)
- **Secondary Black**: `#242424` (Sub-panel & Navbar)
- **Brand Yellow**: `#F5D500` (Aksen & Identitas Merek)
- **White**: `#FFFFFF` (Area Konten & Teks)
- **Background**: `#F5F6F8` (Latar Belakang Bersih)
- **Border**: `#E5E7EB`
- **Text**: `#222222`
- **Logo**: Vektor tajam SVG Bebek Sanjay Gowa dengan lingkaran kuning, monogram "BS", siluet bebek putih "Nasi Bebek", tipografi kuning "Sanjay", dan tag miring "GOWA".

---

## 2. Arsitektur Data: Excel Sebagai Pusat Data
Sistem tidak menggunakan database MySQL/PHP lama yang terpisah, melainkan langsung membaca dan menulis workbook Excel `Dataset_Bebek_Sanjay_Gowa_Revisi_Menu_Harga_210_Transaksi(1).xlsx` melalui REST API Node.js dengan `exceljs`:

### 10 Sheet Utama:
1. **MASTER_MENU** (29 menu, kategori, harga satuan aktual, status harga, catatan)
2. **MASTER_BAHAN** (38 bahan baku terstandar pemakaian)
3. **TRANSAKSI_210** (210 transaksi skenario 7 hari + transaksi baru)
4. **RESEP_BOM** (231 takaran resep per menu dan bahan)
5. **PEMAKAIAN_DETAIL** (1.896+ baris rincian pemakaian bahan per porsi transaksi)
6. **PEMAKAIAN_HARIAN** (267 baris rekapitulasi konsumsi per hari)
7. **STOK_AWAL** (38 saldo awal fisik bahan)
8. **BARANG_MASUK** (Riwayat penerimaan: PEMBELIAN, TRANSFER_MASUK, RETUR_PENJUALAN, PENYESUAIAN_STOK)
9. **KARTU_STOK_HARIAN** (Buku besar stok: `stok_awal_hari + barang_masuk - pemakaian = stok_akhir_hari`)
10. **PERHITUNGAN_SS_ROP** (Analisis Safety Stock, Reorder Point, dan status stok)

### Mekanisme Penguncian & Integritas:
- **Write Queue Mutex**: Antrean promise asinkron berurutan mencegah dua pengguna menimpa file Excel pada saat yang bersamaan (*race condition*).
- **Automated Backup Before Write**: Setiap transaksi atau perubahan data membuat backup otomatis berstempel waktu di `data/backups/`.
- **Audit Trail**: Mencatat pengguna, waktu, lembar (sheet) yang diubah, serta nilai sebelum dan sesudah perubahan secara permanen di `data/audit_log.json`.
- **Proteksi Idempotensi**: Mencegah pesanan tercatat ganda bila kasir menekan tombol bayar berulang kali.

---

## 3. Rumus & Konsep Persediaan
Hanya menggunakan 3 konsep perhitungan matematis sesuai arahan:
1. **Bill of Materials (BOM)**:
   $$\text{Kebutuhan Bahan} = \text{Jumlah Porsi} \times \text{Kebutuhan Bahan per Porsi}$$
2. **Safety Stock (SS)**:
   $$\text{Safety Stock} = \max\Big(0, (\text{Maksimum Harian} - \text{Rata-rata Harian}) \times \text{Lead Time}\Big)$$
3. **Reorder Point (ROP)**:
   $$\text{ROP} = (\text{Rata-rata Harian} \times \text{Lead Time}) + \text{Safety Stock}$$

### Klasifikasi Status Stok:
- 🟢 **Stok Aman**: Stok Saat Ini > ROP
- 🟡 **Perlu Perhatian**: Safety Stock < Stok Saat Ini $\le$ ROP
- 🔴 **Harus Restock**: Stok Saat Ini $\le$ Safety Stock

---

## 4. Akun & Hak Akses Pengguna

| Peran (Role) | Username | Password | Hak Akses |
|---|---|---|---|
| **OWNER** | `owner` | `password` | Seluruh Dashboard, Menu, Bahan Baku, Transaksi, Persediaan, Laporan, Log Audit, Manajemen Pengguna, dan Backup Excel. |
| **KASIR** | `kasir` | `password` | Modul Kasir (POS), Menu & Harga, Riwayat Transaksi, Cetak Struk Penjualan. |
| **DAPUR** | `dapur` | `password` | Antrean Dapur (Kitchen Display), Update Status Pesanan (*menunggu_proses* $\to$ *diproses* $\to$ *siap* $\to$ *selesai*), Cek Kebutuhan Bahan. |

*Catatan: Password dienkripsi dengan bcrypt dan disimpan terpisah dari workbook Excel.*

---

## 5. Menjalankan Aplikasi Secara Lokal

### Prasyarat:
- Node.js versi 18 ke atas (diuji pada v26.13.0)
- npm (Node Package Manager)

### Langkah Menjalankan:
```bash
# Masuk ke direktori proyek
cd c:\xampp\htdocs\kuliner-bebek-sanjay

# Jalankan server
npm start
```
Akses di browser: `http://localhost:3000`

### Menjalankan Automated Test:
```bash
npm test
```

---

## 6. Deployment ke Vercel & GitHub

Proyek ini telah dikonfigurasi dengan `vercel.json` dan handler serverless `api/index.js`.

### Opsi Integrasi Cloud Persisten:
1. **Microsoft OneDrive / SharePoint via Microsoft Graph API**:
   Isi environment variables pada pengaturan Vercel Project:
   - `MS_GRAPH_CLIENT_ID`
   - `MS_GRAPH_CLIENT_SECRET`
   - `MS_GRAPH_TENANT_ID`
   - `MS_GRAPH_REFRESH_TOKEN`
   - `MS_GRAPH_FILE_PATH`
2. **Vercel Blob Persistent Storage**:
   Pasang Vercel Blob dan sediakan:
   - `BLOB_READ_WRITE_TOKEN`
3. **Penyimpanan Lokal / VPS / Self-hosted**:
   Langsung membaca dan memperbarui file workbook di folder `data/` tanpa perlu konfigurasi tambahan.

---

## 7. Fitur Utama Website
1. **Dashboard Utama**: 6 Kartu KPI ringkas, 4 grafik Chart.js interaktif (Penjualan, Menu Terlaris, Pemakaian Bahan, Pergerakan Persediaan), dan tabel peringatan stok kritis.
2. **Modul Kasir (POS)**: Navigasi kategori dinamis, pencarian cepat, kalkulasi subtotal otomatis, metode pembayaran (Tunai, QRIS, Transfer, Debit), kalkulator kembalian, dan cetak struk thermal 58mm/80mm & PDF.
3. **Katalog Menu & Harga**: Pengelolaan 29 menu aktual, harga satuan, kategori, status harga, dan catatan.
4. **Bahan Baku**: Pantauan stok fisik 38 bahan baku dengan satuan standar.
5. **Resep & BOM**: Pemetaan takaran bahan baku per porsi menu makanan dan minuman.
6. **Barang Masuk**: Pencatatan pembelian bahan dari supplier dengan auto-update kartu stok harian.
7. **Pemakaian Bahan**: Tabulasi rincian pemakaian per transaksi dan rekapitulasi harian.
8. **Kartu Stok Harian**: Buku besar pergerakan persediaan harian.
9. **Safety Stock & ROP**: Rekomendasi restock otomatis dan tombol aksi cepat pemesanan bahan.
10. **Riwayat Transaksi**: Audit seluruh transaksi 210+ baris dengan filter tanggal dan pencarian.
11. **Antrean Dapur (Kitchen Display)**: Tampilan visual kartu pesanan dapur dengan polling otomatis 5 detik.
12. **Log Perubahan (Audit Trail)**: Riwayat lengkap aktivitas perubahan data sheet dengan komparasi nilai sebelum dan sesudah.
13. **Pengaturan & Excel Data Center**: Status koneksi workbook, unduh Excel terbaru, manajemen backup otomatis, dan tombol pemulihan data (restore).
