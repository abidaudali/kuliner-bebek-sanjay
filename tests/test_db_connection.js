/**
 * Test Database Connectivity & Schema Verification
 * Kuliner Bebek Sanjay Gowa
 */
const db = require('../config/database');

async function verify() {
  console.log('====================================================');
  console.log('🔍 VERIFIKASI KONEKSI MYSQL & STRUKTUR TABEL');
  console.log('====================================================\n');

  // 1. Test Connection
  const status = await db.testConnection();
  console.log('Status Koneksi:', status.connected ? '✅ TERHUBUNG' : '❌ GAGAL');
  console.log('Mode Lingkungan:', status.mode);
  console.log('Host:', status.host);
  console.log('Database Aktif:', status.database);
  console.log('Versi MySQL/MariaDB:', status.version);

  if (!status.connected) {
    console.error('Koneksi database gagal:', status.error);
    process.exit(1);
  }

  // 2. Count Tables
  const tables = await db.query('SHOW TABLES FROM `kuliner_bebek`');
  console.log(`\nJumlah Tabel Ditemukan: ${tables.length} dari 16 tabel yang dirancang`);
  const tableNames = tables.map(t => Object.values(t)[0]);
  console.log('Daftar Tabel:', tableNames.join(', '));

  const expectedTables = [
    'roles', 'users', 'menus', 'ingredients', 'bom_details',
    'orders', 'order_details', 'payments', 'productions',
    'inventory', 'stock_movements', 'stock_in', 'stock_usage',
    'inventory_parameters', 'activity_logs', 'excel_import_logs'
  ];

  const missing = expectedTables.filter(t => !tableNames.includes(t));
  if (missing.length > 0) {
    console.error('❌ Tabel yang belum dibuat:', missing);
    process.exit(1);
  } else {
    console.log('✅ Seluruh 16 tabel relasional valid dan lengkap!');
  }

  // 3. Verify Foreign Keys
  const fkQuery = `
    SELECT 
      TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
    FROM 
      INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE 
      TABLE_SCHEMA = 'kuliner_bebek' AND REFERENCED_TABLE_NAME IS NOT NULL
    ORDER BY TABLE_NAME;
  `;
  const fks = await db.query(fkQuery);
  console.log(`\nJumlah Relasi Foreign Key Terdaftar: ${fks.length}`);
  fks.forEach(fk => {
    console.log(`  🔗 ${fk.TABLE_NAME}.${fk.COLUMN_NAME} ➔ ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME} (${fk.CONSTRAINT_NAME})`);
  });

  // 4. Verify Roles & Seed Users
  const roles = await db.query('SELECT * FROM roles');
  console.log(`\nRoles Terdaftar (${roles.length}):`, roles.map(r => r.name).join(', '));

  const users = await db.query(`
    SELECT u.id, u.username, u.name, r.name as role_name 
    FROM users u 
    JOIN roles r ON u.role_id = r.id
  `);
  console.log(`Users Default Terdaftar (${users.length}):`);
  users.forEach(u => {
    console.log(`  👤 ID: ${u.id} | Username: ${u.username} | Nama: ${u.name} | Role: ${u.role_name}`);
  });

  console.log('\n====================================================');
  console.log('🎉 SELURUH VERIFIKASI TAHAP 2 & 3 BERHASIL 100%!');
  console.log('====================================================\n');
  process.exit(0);
}

verify().catch(err => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
