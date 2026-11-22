const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const USERS_FILE = path.join(__dirname, '..', 'data', 'users.json');
const JWT_SECRET = process.env.JWT_SECRET || 'bebek_sanjay_gowa_secret_key_2026';

function getUsers() {
  try {
    if (!fs.existsSync(USERS_FILE)) return [];
    const data = fs.readFileSync(USERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading users:', err);
    return [];
  }
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}

function authenticate(username, password) {
  const users = getUsers();
  const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!user) return null;
  
  const isValid = bcrypt.compareSync(password, user.passwordHash);
  if (!isValid) return null;
  
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role
    }
  };
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

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

function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Akses dilarang. Fitur ini hanya untuk peran: ${allowedRoles.join(', ')}.`
      });
    }
    next();
  };
}

function createUser({ username, password, name, role }) {
  const users = getUsers();
  if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
    throw new Error('Username sudah digunakan.');
  }

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(password, salt);
  const newUser = {
    id: Date.now(),
    username: username.trim(),
    passwordHash,
    name: name.trim(),
    role: role || 'KASIR',
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  saveUsers(users);
  return { id: newUser.id, username: newUser.username, name: newUser.name, role: newUser.role };
}

function updateUser(id, { name, role, password }) {
  const users = getUsers();
  const index = users.findIndex(u => u.id === Number(id));
  if (index === -1) throw new Error('Pengguna tidak ditemukan.');

  if (name) users[index].name = name.trim();
  if (role) users[index].role = role;
  if (password && password.trim() !== '') {
    users[index].passwordHash = bcrypt.hashSync(password, 10);
  }
  users[index].updatedAt = new Date().toISOString();

  saveUsers(users);
  return {
    id: users[index].id,
    username: users[index].username,
    name: users[index].name,
    role: users[index].role
  };
}

function deleteUser(id) {
  let users = getUsers();
  const target = users.find(u => u.id === Number(id));
  if (!target) throw new Error('Pengguna tidak ditemukan.');
  if (target.username === 'owner') {
    throw new Error('Akun utama Owner tidak boleh dihapus.');
  }
  users = users.filter(u => u.id !== Number(id));
  saveUsers(users);
  return true;
}

module.exports = {
  getUsers,
  authenticate,
  verifyToken,
  authMiddleware,
  requireRole,
  createUser,
  updateUser,
  deleteUser
};
