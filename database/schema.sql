-- ============================================================================
-- DATABASE SCHEMA: KULINER BEBEK SANJAY GOWA
-- Database Name: kuliner_bebek
-- Total Tables: 16 Relational Tables
-- Engine: InnoDB | Charset: utf8mb4 | Collation: utf8mb4_unicode_ci
-- ============================================================================

CREATE DATABASE IF NOT EXISTS `kuliner_bebek` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `kuliner_bebek`;

-- ----------------------------------------------------------------------------
-- 1. TABEL: roles (Peran Hak Akses Pengguna)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `roles` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(50) NOT NULL UNIQUE,
  `description` VARCHAR(255) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 2. TABEL: users (Akun Pengguna Sistem)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `role_id` INT NOT NULL,
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `phone` VARCHAR(20) NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_users_role` (`role_id`),
  CONSTRAINT `fk_users_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 3. TABEL: menus (Daftar Menu & Harga Produk)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `menus` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `code` INT NOT NULL UNIQUE,
  `name` VARCHAR(150) NOT NULL,
  `category` VARCHAR(80) NOT NULL,
  `price` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `price_status` VARCHAR(50) NOT NULL DEFAULT 'HARGA AKTUAL',
  `image_url` VARCHAR(255) NULL,
  `notes` TEXT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_menus_category` (`category`),
  INDEX `idx_menus_active` (`is_active`)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 4. TABEL: ingredients (Master 38 Bahan Baku)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `ingredients` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `code` VARCHAR(20) NOT NULL UNIQUE,
  `name` VARCHAR(100) NOT NULL,
  `usage_unit` VARCHAR(20) NOT NULL DEFAULT 'gram' COMMENT 'Satuan pemakaian BOM: gram, ml, pcs, kg',
  `purchase_unit` VARCHAR(20) NOT NULL DEFAULT 'kg' COMMENT 'Satuan beli: ekor, kg, liter, dus, pcs',
  `conversion_ratio` DECIMAL(12,4) NOT NULL DEFAULT 1.0000 COMMENT 'Rasio dari satuan beli ke satuan pakai',
  `cost_per_unit` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `notes` TEXT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_ingredients_code` (`code`)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 5. TABEL: bom_details (Bill of Materials / Resep per Porsi)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `bom_details` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `menu_id` INT NOT NULL,
  `ingredient_id` INT NOT NULL,
  `quantity_per_portion` DECIMAL(12,4) NOT NULL,
  `unit` VARCHAR(20) NOT NULL,
  `data_status` VARCHAR(50) NOT NULL DEFAULT 'TERVERIFIKASI',
  `notes` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_menu_ingredient` (`menu_id`, `ingredient_id`),
  INDEX `idx_bom_menu` (`menu_id`),
  INDEX `idx_bom_ingredient` (`ingredient_id`),
  CONSTRAINT `fk_bom_menu` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_bom_ingredient` FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients` (`id`)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 6. TABEL: orders (Transaksi Penjualan Kasir POS)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `orders` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `order_no` VARCHAR(50) NOT NULL UNIQUE,
  `user_id` INT NULL,
  `customer_name` VARCHAR(100) NULL DEFAULT 'Pelanggan',
  `order_type` ENUM('dine_in', 'take_away') NOT NULL DEFAULT 'dine_in',
  `table_no` VARCHAR(20) NULL,
  `total_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `discount_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `tax_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `grand_total` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `order_status` ENUM('menunggu_proses', 'diproses', 'siap', 'selesai', 'dibatalkan') NOT NULL DEFAULT 'menunggu_proses',
  `data_source` ENUM('AKTUAL', 'ESTIMASI') NOT NULL DEFAULT 'AKTUAL',
  `notes` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_orders_created` (`created_at`),
  INDEX `idx_orders_status` (`order_status`),
  CONSTRAINT `fk_orders_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 7. TABEL: order_details (Rincian Item Menu Terjual)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `order_details` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `order_id` INT NOT NULL,
  `menu_id` INT NOT NULL,
  `qty_portions` INT NOT NULL DEFAULT 1,
  `unit_price` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `subtotal` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `notes` TEXT NULL,
  INDEX `idx_od_order` (`order_id`),
  INDEX `idx_od_menu` (`menu_id`),
  CONSTRAINT `fk_od_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_od_menu` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 8. TABEL: payments (Pembayaran Pesanan)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `payments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `order_id` INT NOT NULL,
  `payment_method` ENUM('TUNAI', 'QRIS', 'TRANSFER', 'DEBIT') NOT NULL DEFAULT 'TUNAI',
  `amount_paid` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `change_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `payment_status` ENUM('LUNAS', 'PENDING') NOT NULL DEFAULT 'LUNAS',
  `payment_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_payments_order` (`order_id`),
  CONSTRAINT `fk_payments_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 9. TABEL: productions (Antrean & Pelaksanaan Masak Dapur)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `productions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `order_id` INT NOT NULL,
  `status` ENUM('menunggu_proses', 'diproses', 'siap', 'selesai') NOT NULL DEFAULT 'menunggu_proses',
  `started_at` DATETIME NULL,
  `completed_at` DATETIME NULL,
  `processed_by` INT NULL,
  `notes` TEXT NULL,
  INDEX `idx_productions_order` (`order_id`),
  INDEX `idx_productions_status` (`status`),
  CONSTRAINT `fk_prod_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_prod_user` FOREIGN KEY (`processed_by`) REFERENCES `users` (`id`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 10. TABEL: inventory (Saldo Stok Bahan Baku Terkini)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `inventory` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `ingredient_id` INT NOT NULL UNIQUE,
  `current_stock` DECIMAL(14,3) NOT NULL DEFAULT 0.000,
  `unit` VARCHAR(20) NOT NULL,
  `last_updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_inventory_ingredient` FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 11. TABEL: stock_movements (Mutasi / Log Buku Besar Stok)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `stock_movements` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `ingredient_id` INT NOT NULL,
  `movement_type` ENUM(
    'IN_PURCHASE', 'IN_TRANSFER', 'IN_RETURN', 'IN_ADJUSTMENT',
    'OUT_SALE', 'OUT_PRODUCTION', 'OUT_WASTE', 'OUT_ADJUSTMENT'
  ) NOT NULL,
  `quantity` DECIMAL(14,3) NOT NULL,
  `unit` VARCHAR(20) NOT NULL,
  `balance_before` DECIMAL(14,3) NOT NULL,
  `balance_after` DECIMAL(14,3) NOT NULL,
  `reference_type` VARCHAR(50) NULL COMMENT 'ORDER, STOCK_IN, PRODUCTION, MANUAL',
  `reference_id` VARCHAR(50) NULL,
  `user_id` INT NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_sm_ingredient` (`ingredient_id`),
  INDEX `idx_sm_created` (`created_at`),
  CONSTRAINT `fk_sm_ingredient` FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_sm_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 12. TABEL: stock_in (Penerimaan Barang Masuk / Pembelian)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `stock_in` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `ingredient_id` INT NOT NULL,
  `qty_in` DECIMAL(14,3) NOT NULL,
  `unit` VARCHAR(20) NOT NULL,
  `received_date` DATE NOT NULL,
  `type` ENUM('PEMBELIAN', 'TRANSFER_MASUK', 'RETUR_PENJUALAN', 'PENYESUAIAN_STOK') NOT NULL DEFAULT 'PEMBELIAN',
  `supplier_name` VARCHAR(150) NULL,
  `invoice_no` VARCHAR(100) NULL,
  `data_status` VARCHAR(50) NOT NULL DEFAULT 'AKTUAL',
  `user_id` INT NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_si_date` (`received_date`),
  INDEX `idx_si_ingredient` (`ingredient_id`),
  CONSTRAINT `fk_si_ingredient` FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients` (`id`)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_si_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 13. TABEL: stock_usage (Rekapitulasi Konsumsi Bahan Harian)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `stock_usage` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `date` DATE NOT NULL,
  `ingredient_id` INT NOT NULL,
  `daily_total_usage` DECIMAL(14,3) NOT NULL DEFAULT 0.000,
  `unit` VARCHAR(20) NOT NULL,
  `data_status` VARCHAR(50) NOT NULL DEFAULT 'HASIL REKAPITULASI',
  `notes` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_usage_date_ingredient` (`date`, `ingredient_id`),
  INDEX `idx_su_date` (`date`),
  INDEX `idx_su_ingredient` (`ingredient_id`),
  CONSTRAINT `fk_su_ingredient` FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 14. TABEL: inventory_parameters (Parameter SS, ROP, dan SMA)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `inventory_parameters` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `ingredient_id` INT NOT NULL UNIQUE,
  `lead_time_days` INT NOT NULL DEFAULT 1,
  `ma_period_days` INT NOT NULL DEFAULT 7 COMMENT 'Periode Simple Moving Average (default 7 hari)',
  `avg_daily_usage` DECIMAL(14,4) NOT NULL DEFAULT 0.0000 COMMENT 'Rata-rata pemakaian harian (SMA)',
  `max_daily_usage` DECIMAL(14,4) NOT NULL DEFAULT 0.0000 COMMENT 'Maksimum pemakaian harian',
  `safety_stock` DECIMAL(14,3) NOT NULL DEFAULT 0.000,
  `reorder_point` DECIMAL(14,3) NOT NULL DEFAULT 0.000,
  `recommended_purchase` DECIMAL(14,3) NOT NULL DEFAULT 0.000,
  `last_calculated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_ip_ingredient` FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 15. TABEL: activity_logs (Audit Trail Riwayat Aktivitas Pengguna)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `activity_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NULL,
  `action` VARCHAR(80) NOT NULL,
  `module` VARCHAR(80) NOT NULL,
  `details` TEXT NOT NULL,
  `data_before` JSON NULL,
  `data_after` JSON NULL,
  `ip_address` VARCHAR(50) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_al_created` (`created_at`),
  INDEX `idx_al_user` (`user_id`),
  CONSTRAINT `fk_al_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 16. TABEL: excel_import_logs (Riwayat Import Workbook Excel)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `excel_import_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `file_name` VARCHAR(255) NOT NULL,
  `import_type` VARCHAR(50) NOT NULL DEFAULT 'FULL_DATASET',
  `records_imported` INT NOT NULL DEFAULT 0,
  `records_failed` INT NOT NULL DEFAULT 0,
  `status` ENUM('SUCCESS', 'PARTIAL', 'FAILED') NOT NULL DEFAULT 'SUCCESS',
  `user_id` INT NULL,
  `error_details` JSON NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_eil_created` (`created_at`),
  CONSTRAINT `fk_eil_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- SEED DATA AWAL: Roles & Default Users
-- ----------------------------------------------------------------------------
INSERT INTO `roles` (`id`, `name`, `description`) VALUES
(1, 'OWNER', 'Pemilik usaha dengan kendali penuh atas seluruh sistem dan laporan'),
(2, 'KASIR', 'Staf kasir untuk melayani pesanan, pembayaran, dan pencetakan struk'),
(3, 'DAPUR', 'Staf dapur untuk melihat antrean pengerjaan pesanan dan pemakaian bahan')
ON DUPLICATE KEY UPDATE `description` = VALUES(`description`);

-- password default = "password" (bcrypt $2b$10$m0N3s0JJ2uVKapGljxIFReDJHKRhZVUBo.tRNGseNZxfEaEQrjasS)
INSERT INTO `users` (`id`, `role_id`, `username`, `password_hash`, `name`, `phone`, `is_active`) VALUES
(1, 1, 'owner', '$2b$10$m0N3s0JJ2uVKapGljxIFReDJHKRhZVUBo.tRNGseNZxfEaEQrjasS', 'Owner Bebek Sanjay Gowa', '081200000001', 1),
(2, 2, 'kasir', '$2b$10$m0N3s0JJ2uVKapGljxIFReDJHKRhZVUBo.tRNGseNZxfEaEQrjasS', 'Kasir Bebek Sanjay Gowa', '081200000002', 1),
(3, 3, 'dapur', '$2b$10$m0N3s0JJ2uVKapGljxIFReDJHKRhZVUBo.tRNGseNZxfEaEQrjasS', 'Dapur Bebek Sanjay Gowa', '081200000003', 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `role_id` = VALUES(`role_id`);
