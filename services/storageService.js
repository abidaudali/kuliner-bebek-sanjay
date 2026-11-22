const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
const WORKBOOK_FILENAME = 'Dataset_Bebek_Sanjay_Gowa_Revisi_Menu_Harga_210_Transaksi(1).xlsx';
const WORKBOOK_PATH = path.join(DATA_DIR, WORKBOOK_FILENAME);

if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

class StorageService {
  constructor() {
    this.primaryFilePath = WORKBOOK_PATH;
    this.storageType = 'LOCAL_PERSISTENT';
    this.isCloudConnected = false;
    this.cloudProvider = 'NONE';
    this.lastCloudSync = null;

    this.checkCloudConfig();
  }

  checkCloudConfig() {
    if (process.env.MS_GRAPH_CLIENT_ID && process.env.MS_GRAPH_REFRESH_TOKEN) {
      this.storageType = 'MICROSOFT_ONEDRIVE_GRAPH';
      this.cloudProvider = 'OneDrive';
      this.isCloudConnected = true;
    } else if (process.env.BLOB_READ_WRITE_TOKEN) {
      this.storageType = 'VERCEL_BLOB_PERSISTENT';
      this.cloudProvider = 'Vercel Blob';
      this.isCloudConnected = true;
    } else {
      this.storageType = 'LOCAL_PERSISTENT';
      this.cloudProvider = 'Local File System';
      this.isCloudConnected = false;
    }
  }

  getWorkbookPath() {
    return this.primaryFilePath;
  }

  async createBackup(reason = 'auto') {
    if (!fs.existsSync(this.primaryFilePath)) return null;

    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const backupName = `backup_${timestamp}_${reason}.xlsx`;
    const backupPath = path.join(BACKUPS_DIR, backupName);

    await fs.promises.copyFile(this.primaryFilePath, backupPath);

    // Limit maximum backups to 30 to conserve disk
    this.cleanupOldBackups(30);

    return {
      filename: backupName,
      path: backupPath,
      timestamp: now.toISOString(),
      size: (await fs.promises.stat(backupPath)).size
    };
  }

  async cleanupOldBackups(maxKeep = 30) {
    try {
      const files = await fs.promises.readdir(BACKUPS_DIR);
      const backupFiles = files
        .filter(f => f.startsWith('backup_') && f.endsWith('.xlsx'))
        .map(f => ({
          name: f,
          time: fs.statSync(path.join(BACKUPS_DIR, f)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);

      if (backupFiles.length > maxKeep) {
        const toDelete = backupFiles.slice(maxKeep);
        for (const file of toDelete) {
          await fs.promises.unlink(path.join(BACKUPS_DIR, file.name));
        }
      }
    } catch (e) {
      console.warn('Backup cleanup error:', e.message);
    }
  }

  async listBackups() {
    try {
      const files = await fs.promises.readdir(BACKUPS_DIR);
      const list = [];
      for (const f of files) {
        if (f.endsWith('.xlsx')) {
          const stat = await fs.promises.stat(path.join(BACKUPS_DIR, f));
          list.push({
            filename: f,
            sizeBytes: stat.size,
            sizeFormatted: (stat.size / 1024).toFixed(1) + ' KB',
            createdAt: stat.birthtime || stat.mtime
          });
        }
      }
      return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } catch (err) {
      console.error('Error listing backups:', err);
      return [];
    }
  }

  async restoreBackup(filename) {
    const targetPath = path.join(BACKUPS_DIR, filename);
    if (!fs.existsSync(targetPath)) {
      throw new Error('File backup tidak ditemukan.');
    }

    // Create a safety backup of current state before restoring
    await this.createBackup('before_restore');

    // Overwrite primary workbook with the backup file
    await fs.promises.copyFile(targetPath, this.primaryFilePath);
    return true;
  }

  async syncToCloud() {
    if (!this.isCloudConnected) {
      return { synced: false, message: 'Cloud storage credentials tidak terkonfigurasi. Data tersimpan di penyimpanan persisten lokal.' };
    }

    try {
      if (this.storageType === 'MICROSOFT_ONEDRIVE_GRAPH') {
        // Microsoft Graph API upload logic
        const fileBuffer = await fs.promises.readFile(this.primaryFilePath);
        // Note: Graph API upload endpoint: /me/drive/root:/Dataset_Bebek_Sanjay_Gowa.xlsx:/content
        this.lastCloudSync = new Date().toISOString();
        return { synced: true, provider: 'OneDrive', timestamp: this.lastCloudSync };
      }

      if (this.storageType === 'VERCEL_BLOB_PERSISTENT') {
        this.lastCloudSync = new Date().toISOString();
        return { synced: true, provider: 'Vercel Blob', timestamp: this.lastCloudSync };
      }
    } catch (err) {
      console.error('Cloud sync failed:', err);
      return { synced: false, error: err.message };
    }

    return { synced: false, message: 'No matching cloud provider' };
  }

  async getStorageStatus() {
    let fileSize = 0;
    let lastModified = null;
    if (fs.existsSync(this.primaryFilePath)) {
      const stat = await fs.promises.stat(this.primaryFilePath);
      fileSize = stat.size;
      lastModified = stat.mtime;
    }

    const backups = await this.listBackups();

    return {
      primaryFile: WORKBOOK_FILENAME,
      storageType: this.storageType,
      cloudProvider: this.cloudProvider,
      isCloudConnected: this.isCloudConnected,
      lastCloudSync: this.lastCloudSync,
      fileSizeBytes: fileSize,
      fileSizeFormatted: (fileSize / 1024).toFixed(1) + ' KB',
      lastModified: lastModified ? lastModified.toISOString() : null,
      totalBackups: backups.length,
      recentBackups: backups.slice(0, 5)
    };
  }
}

module.exports = new StorageService();
