/**
 * ============================================================================
 * AUTHENTICATION SERVICE: KULINER BEBEK SANJAY GOWA
 * File: services/authService.js
 * 
 * Terintegrasi penuh dengan tabel `users` dan `roles` di MySQL:
 * - Autentikasi aman berbasis bcrypt (password hashing)
 * - JSON Web Token (JWT) dengan masa berlaku sesi
 * - Middleware verifikasi token dan pembatasan hak akses berbasis peran (RBAC)
 * ============================================================================
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query, getConnection } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'bebek_sanjay_gowa_super_secret_jwt_2026_xyz';

/**
 * Autentikasi Pengguna (Login)
 */
async function authenticate(username, password) {
  if (!username || !password) return null;

  const rows = await query(`
    SELECT 
      u.id,
      u.role_id,
      u.username,
      u.password_hash,
      u.name,
      u.phone,
      u.is_active,
      r.name as role
    FROM users u
    JOIN roles r ON r.id = u.role_id
    WHERE u.username = ? AND u.is_active = 1
    LIMIT 1
  `, [username.trim()]);

  if (!rows || rows.length === 0) return null;
  const user = rows[0];

  const isValid = bcrypt.compareSync(password, user.password_hash);
  if (!isValid) return null;

  const token = jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      phone: user.phone
    }
  };
}

/**
 * Verifikasi Token JWT
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

/**
 * Middleware Autentikasi Token
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Akses ditolak. Token autentikasi diperlukan.' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ success: false, message: 'Sesi telah kedaluwarsa atau token tidak valid.' });
  }

  req.user = decoded;
  next();
}

/**
 * Middleware Otorisasi Hak Akses Berdasarkan Role
 */
function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Pengguna belum terautentikasi.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Akses ditolak. Fitur ini memerlukan hak akses [${allowedRoles.join(' / ')}]. Role Anda saat ini: ${req.user.role}`
      });
    }

    next();
  };
}

/**
 * Kelola Pengguna (Khusus Role OWNER)
 */
async function getUsers() {
  const rows = await query(`
    SELECT 
      u.id,
      u.username,
      u.name,
      r.name as role,
      u.phone,
      u.is_active,
      DATE_FORMAT(u.created_at, '%Y-%m-%d %H:%i:%s') as createdAt
    FROM users u
    JOIN roles r ON r.id = u.role_id
    ORDER BY u.id ASC
  `);
  return rows;
}

async function createUser(data) {
  if (!data.username || !data.password || !data.name || !data.role) {
    throw new Error('Username, password, nama, dan role wajib diisi.');
  }

  const [roleRow] = await query('SELECT id FROM roles WHERE name = ?', [data.role.toUpperCase()]);
  if (!roleRow) throw new Error(`Role ${data.role} tidak valid.`);

  const passwordHash = bcrypt.hashSync(data.password, 10);
  const phone = data.phone || null;

  const [res] = await query(`
    INSERT INTO users (role_id, username, password_hash, name, phone, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, 1, NOW())
  `, [roleRow.id, data.username.toLowerCase().trim(), passwordHash, data.name.trim(), phone]);

  return {
    id: res.insertId,
    username: data.username.toLowerCase().trim(),
    name: data.name.trim(),
    role: data.role.toUpperCase(),
    phone
  };
}

async function updateUser(id, data) {
  const [existing] = await query('SELECT * FROM users WHERE id = ?', [id]);
  if (!existing) throw new Error(`Pengguna dengan ID ${id} tidak ditemukan.`);

  const name = data.name ? data.name.trim() : existing.name;
  const phone = data.phone !== undefined ? data.phone : existing.phone;
  let roleId = existing.role_id;

  if (data.role) {
    const [roleRow] = await query('SELECT id FROM roles WHERE name = ?', [data.role.toUpperCase()]);
    if (roleRow) roleId = roleRow.id;
  }

  let passwordHash = existing.password_hash;
  if (data.password && data.password.trim() !== '') {
    passwordHash = bcrypt.hashSync(data.password.trim(), 10);
  }

  await query(`
    UPDATE users 
    SET name = ?, phone = ?, role_id = ?, password_hash = ?, updated_at = NOW()
    WHERE id = ?
  `, [name, phone, roleId, passwordHash, id]);

  const [updated] = await query(`
    SELECT u.id, u.username, u.name, r.name as role, u.phone 
    FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?
  `, [id]);

  return updated;
}

async function deleteUser(id) {
  if (parseInt(id, 10) === 1) {
    throw new Error('Akun super admin Owner utama tidak boleh dihapus.');
  }

  await query('UPDATE users SET is_active = 0 WHERE id = ?', [id]);
  return true;
}

module.exports = {
  authenticate,
  verifyToken,
  authMiddleware,
  requireRole,
  getUsers,
  createUser,
  updateUser,
  deleteUser
};
