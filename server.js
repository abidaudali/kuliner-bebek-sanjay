const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const excelService = require('./services/excelService');
const authRoutes = require('./routes/authRoutes');
const menuRoutes = require('./routes/menuRoutes');
const bahanRoutes = require('./routes/bahanRoutes');
const transaksiRoutes = require('./routes/transaksiRoutes');
const resepRoutes = require('./routes/resepRoutes');
const barangMasukRoutes = require('./routes/barangMasukRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const kitchenRoutes = require('./routes/kitchenRoutes');
const auditRoutes = require('./routes/auditRoutes');
const userRoutes = require('./routes/userRoutes');
const storageRoutes = require('./routes/storageRoutes');
const { authMiddleware } = require('./services/authService');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static frontend assets
app.use(express.static(path.join(__dirname, 'public')));

// Ensure Excel Service is ready
app.use(async (req, res, next) => {
  if (!excelService.isLoaded) {
    try {
      await excelService.loadPromise;
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Gagal memuat dataset Excel: ' + err.message });
    }
  }
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/bahan', bahanRoutes);
app.use('/api/transaksi', transaksiRoutes);
app.use('/api/resep', resepRoutes);
app.use('/api/barang-masuk', barangMasukRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/kitchen', kitchenRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/users', userRoutes);
app.use('/api/storage', storageRoutes);

// Dashboard stats endpoint
app.get('/api/dashboard/stats', authMiddleware, (req, res) => {
  try {
    const stats = excelService.getDashboardStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'UP',
    name: 'Kuliner Bebek Sanjay Gowa API',
    timestamp: new Date().toISOString(),
    excelLoaded: excelService.isLoaded
  });
});

// SPA fallback for HTML5 routing
app.use((req, res, next) => {
  // If request is for an API route that wasn't matched, return 404 JSON
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, message: 'API route not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server: ' + err.message });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🦆 KULINER BEBEK SANJAY GOWA — SERVER RUNNING`);
    console.log(`🌐 URL: http://localhost:${PORT}`);
    console.log(`📊 Excel Data Center: Ready & Integrated`);
    console.log(`=======================================================`);
  });
}

module.exports = app;
