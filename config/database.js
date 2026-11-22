const mysql = require('mysql2/promise');
require('dotenv').config();

// Determine environment: local (XAMPP) vs cloud (Vercel / Production)
const isVercel = Boolean(process.env.VERCEL);
const dbMode = (process.env.DB_MODE || (isVercel ? 'cloud' : 'local')).toLowerCase();

const dbConfig = {
  host: dbMode === 'cloud' ? (process.env.CLOUD_DB_HOST || process.env.DB_HOST || 'localhost') : (process.env.DB_HOST || 'localhost'),
  port: Number(dbMode === 'cloud' ? (process.env.CLOUD_DB_PORT || process.env.DB_PORT || 3306) : (process.env.DB_PORT || 3306)),
  user: dbMode === 'cloud' ? (process.env.CLOUD_DB_USER || process.env.DB_USER || 'root') : (process.env.DB_USER || 'root'),
  password: dbMode === 'cloud' ? (process.env.CLOUD_DB_PASSWORD || process.env.DB_PASSWORD || '') : (process.env.DB_PASSWORD || ''),
  database: dbMode === 'cloud' ? (process.env.CLOUD_DB_NAME || process.env.DB_NAME || 'kuliner_bebek') : (process.env.DB_NAME || 'kuliner_bebek'),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  decimalNumbers: true
};

// Enable SSL if cloud requires it (e.g., Aiven, PlanetScale, TiDB, Supabase)
if (dbMode === 'cloud' && (process.env.CLOUD_DB_SSL === 'true' || process.env.DB_SSL === 'true')) {
  dbConfig.ssl = {
    rejectUnauthorized: false
  };
}

let pool = null;

function getPool() {
  if (!pool) {
    pool = mysql.createPool(dbConfig);
  }
  return pool;
}

/**
 * Execute parameterized query
 */
async function query(sql, params = []) {
  const p = getPool();
  const [rows, fields] = await p.execute(sql, params);
  return rows;
}

/**
 * Get dedicated connection for multi-query ACID transactions
 */
async function getConnection() {
  const p = getPool();
  return await p.getConnection();
}

/**
 * Test connectivity
 */
async function testConnection() {
  try {
    const p = getPool();
    const [rows] = await p.query('SELECT 1 + 1 AS result, VERSION() as version, DATABASE() as current_db');
    return {
      connected: true,
      mode: dbMode,
      host: dbConfig.host,
      database: dbConfig.database,
      version: rows[0].version,
      current_db: rows[0].current_db
    };
  } catch (err) {
    return {
      connected: false,
      mode: dbMode,
      host: dbConfig.host,
      database: dbConfig.database,
      error: err.message
    };
  }
}

/**
 * Helper to ensure database exists on local MySQL
 */
async function ensureDatabaseExists() {
  if (dbMode !== 'local') return;

  const tempConfig = {
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password
  };

  const conn = await mysql.createConnection(tempConfig);
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  await conn.end();
}

module.exports = {
  dbConfig,
  dbMode,
  getPool,
  query,
  getConnection,
  testConnection,
  ensureDatabaseExists
};
