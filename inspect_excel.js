const ExcelJS = require('exceljs');
const path = require('path');

async function inspect() {
  const wb = new ExcelJS.Workbook();
  const filePath = path.join(__dirname, 'Dataset_Bebek_Sanjay_Gowa_Revisi_Menu_Harga_210_Transaksi(1).xlsx');
  await wb.xlsx.readFile(filePath);

  console.log('Worksheet Count:', wb.worksheets.length);
  for (const sheet of wb.worksheets) {
    console.log(`\nSheet: ${sheet.name} (Rows: ${sheet.rowCount}, Cols: ${sheet.columnCount})`);
    const headerRow = sheet.getRow(1);
    const headers = [];
    headerRow.eachCell((cell, colNumber) => {
      headers.push(`[${colNumber}] ${cell.value}`);
    });
    console.log('Headers:', headers.join(', '));
    // Sample first data row
    if (sheet.rowCount > 1) {
      const row2 = sheet.getRow(2);
      const row2Vals = [];
      row2.eachCell((cell, colNumber) => {
        row2Vals.push(`[${colNumber}] ${cell.value}`);
      });
      console.log('Sample Row 2:', row2Vals.join(', '));
    }
  }
}

inspect().catch(console.error);
