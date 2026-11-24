const ExcelJS = require('exceljs');
const path = require('path');

async function check() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(__dirname, '..', 'data', 'Dataset_Bebek_Sanjay_Gowa_Revisi_Menu_Harga_210_Transaksi(1).xlsx'));
  
  console.log('=== PETUNJUK ===');
  const petunjuk = wb.getWorksheet('PETUNJUK');
  petunjuk.eachRow((r, i) => console.log(i + ': ' + r.values.slice(1).join(' | ')));

  console.log('\n=== ALL MASTER_BAHAN ===');
  const bahan = wb.getWorksheet('MASTER_BAHAN');
  bahan.eachRow((r, i) => console.log(i + ': ' + r.values.slice(1).join(' | ')));

  console.log('\n=== SAMPLE BARANG_MASUK (First 10) ===');
  const bm = wb.getWorksheet('BARANG_MASUK');
  bm.eachRow((r, i) => { if (i <= 10) console.log(i + ': ' + r.values.slice(1).join(' | ')); });

  console.log('\n=== SAMPLE STOK_AWAL (First 10) ===');
  const sa = wb.getWorksheet('STOK_AWAL');
  sa.eachRow((r, i) => { if (i <= 10) console.log(i + ': ' + r.values.slice(1).join(' | ')); });
}

check().catch(console.error);
