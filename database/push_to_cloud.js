/**
 * ============================================================================
 * SCRIPT: push_to_cloud.js
 * Tool migrasi database kuliner_bebek ke Cloud MySQL (TiDB / Aiven / Railway / etc)
 * 
 * Penggunaan:
 * 1. Isi variabel CLOUD_DB_* pada file .env
 * 2. Jalankan: node database/push_to_cloud.js --dry-run
 * 3. Untuk migrasi penuh: node database/push_to_cloud.js --execute
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

const SQL_FILE = path.join(__dirname, 'cloud_export_ready.sql');

async function getCloudConnection() {
  const host = process.env.CLOUD_DB_HOST;
  const port = Number(process.env.CLOUD_DB_PORT || 3306);
  const user = process.env.CLOUD_DB_USER;
  const password = process.env.CLOUD_DB_PASSWORD;
  const database = process.env.CLOUD_DB_NAME || 'kuliner_bebek';
  const sslRequired = process.env.CLOUD_DB_SSL === 'true' || process.env.DB_SSL === 'true';

  if (!host || !user) {
    throw new Error('Konfigurasi CLOUD_DB_HOST atau CLOUD_DB_USER belum diisi pada file .env');
  }

  const config = {
    host,
    port,
    user,
    password,
    database,
    multipleStatements: true
  };

  if (sslRequired) {
    config.ssl = { rejectUnauthorized: false };
  }

  return await mysql.createConnection(config);
}

async function runCloudMigration() {
  const args = process.argv.slice(2);
  const isExecute = args.includes('--execute');

  console.log('====================================================');
  console.log('☁️ SCRIPT PERSIAPAN & MIGRASI CLOUD MYSQL');
  console.log('====================================================\n');

  console.log('Target Cloud Host:', process.env.CLOUD_DB_HOST || '(Belum diset)');
  console.log('Target Database:  ', process.env.CLOUD_DB_NAME || 'kuliner_bebek');
  console.log('SSL Terenkripsi:  ', process.env.CLOUD_DB_SSL === 'true' ? 'AKTIF (TLS)' : 'TIDAK AKTIF');

  if (!process.env.CLOUD_DB_HOST) {
    console.log('\n⚠️ STATUS: Kredensial Cloud MySQL belum dikonfigurasi di .env.');
    console.log('Silakan pilih salah satu provider Cloud MySQL (Rekomendasi: TiDB Cloud Serverless) dan masukkan variabel:');
    console.log('  CLOUD_DB_HOST=gateway01.ap-southeast-1.prod.aws.tidbcloud.com');
    console.log('  CLOUD_DB_PORT=4000');
    console.log('  CLOUD_DB_USER=xxxxxx.root');
    console.log('  CLOUD_DB_PASSWORD=xxxxxx');
    console.log('  CLOUD_DB_NAME=kuliner_bebek');
    console.log('  CLOUD_DB_SSL=true');
    console.log('\nFile dump database yang siap dimigrasi:');
    console.log(`  📁 ${SQL_FILE} (Ukuran: ${(fs.statSync(SQL_FILE).size / 1024).toFixed(1)} KB)`);
    console.log('====================================================\n');
    return;
  }

  console.log('\n⏳ Menguji koneksi ke Cloud MySQL...');
  let conn;
  try {
    conn = await getCloudConnection();
    const [rows] = await conn.query('SELECT VERSION() as version, DATABASE() as db');
    console.log(`✅ Berhasil terhubung ke Cloud Database: ${rows[0].version} (DB: ${rows[0].db})`);
  } catch (err) {
    console.error(`❌ Gagal terhubung ke Cloud MySQL: ${err.message}`);
    return;
  }

  if (!isExecute) {
    console.log('\n💡 Mode: DRY-RUN / UJI KONEKSI BERHASIL.');
    console.log('Untuk menjalankan migrasi seluruh skema dan 210 transaksi ke cloud, jalankan:');
    console.log('  node database/push_to_cloud.js --execute');
    await conn.end();
    return;
  }

  console.log('\n🚀 Memulai injeksi skema & dataset ke Cloud MySQL...');
  const sqlContent = fs.readFileSync(SQL_FILE, 'utf8');

  try {
    await conn.query(sqlContent);
    console.log('✅ Skema 16 tabel dan seluruh dataset berhasil diinjeksikan ke Cloud MySQL!');

    // Verifikasi hitungan baris di cloud
    const [menuCnt] = await conn.query('SELECT COUNT(*) as cnt FROM menus');
    const [bahanCnt] = await conn.query('SELECT COUNT(*) as cnt FROM ingredients');
    const [bomCnt] = await conn.query('SELECT COUNT(*) as cnt FROM bom_details');
    const [orderCnt] = await conn.query('SELECT COUNT(*) as cnt, SUM(grand_total) as omset FROM orders');

    console.log('\n📊 HASIL VERIFIKASI CLOUD DATABASE:');
    console.log(`  - Master Menu:     ${menuCnt[0].cnt} (Wajib 29)`);
    console.log(`  - Master Bahan:    ${bahanCnt[0].cnt} (Wajib 38)`);
    console.log(`  - Resep BOM:       ${bomCnt[0].cnt} (Wajib 231)`);
    console.log(`  - Transaksi:       ${orderCnt[0].cnt} (Wajib 210)`);
    console.log(`  - Total Omset:     Rp ${Number(orderCnt[0].omset).toLocaleString('id-ID')} (Wajib 4.841.000)`);
    console.log('\n🎉 CLOUD DATABASE KULINER_BEBEK SIAP DIGUNAKAN DI VERCEL!');
  } catch (err) {
    console.error('❌ Terjadi kesalahan saat migrasi cloud:', err.message);
  } finally {
    await conn.end();
  }
}

runCloudMigration().catch(console.error);
