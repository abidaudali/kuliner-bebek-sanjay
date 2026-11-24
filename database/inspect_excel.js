/**
 * Script: inspect_excel.js
 * Purpose: Inspect all sheets and columns from the Excel workbook
 * Usage: node database/inspect_excel.js
 */

const ExcelJS = require('exceljs');
const path = require('path');

const EXCEL_PATH = path.join(__dirname, '..', 'data', 'Dataset_Bebek_Sanjay_Gowa_Revisi_Menu_Harga_210_Transaksi(1).xlsx');

async function inspectExcel() {
  console.log('====================================================');
  console.log('🔍 INSPEKSI WORKBOOK EXCEL - KULINER BEBEK SANJAY');
  console.log('====================================================');
  console.log('File:', EXCEL_PATH);
  console.log('');

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(EXCEL_PATH);

  console.log(`Total Sheet: ${wb.worksheets.length}`);
  console.log('');

  wb.worksheets.forEach((ws, idx) => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`[${idx + 1}] SHEET: "${ws.name}" | Rows: ${ws.rowCount} | Cols: ${ws.columnCount}`);
    console.log('='.repeat(60));

    // Print header row (row 1)
    const headerRow = ws.getRow(1);
    const headers = [];
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      headers.push(`Col${colNumber}: ${JSON.stringify(cell.value)}`);
    });
    console.log('HEADER ROW 1:', headers.join(' | '));

    // Print row 2 (first data row)
    if (ws.rowCount >= 2) {
      const row2 = ws.getRow(2);
      const vals2 = [];
      row2.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        vals2.push(`Col${colNumber}: ${JSON.stringify(cell.value)}`);
      });
      console.log('DATA ROW 2: ', vals2.join(' | '));
    }

    // Print row 3 (second data row)
    if (ws.rowCount >= 3) {
      const row3 = ws.getRow(3);
      const vals3 = [];
      row3.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        vals3.push(`Col${colNumber}: ${JSON.stringify(cell.value)}`);
      });
      console.log('DATA ROW 3: ', vals3.join(' | '));
    }

    // Count non-empty data rows
    let dataRowCount = 0;
    ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
      if (rowNum > 1) dataRowCount++;
    });
    console.log(`\nData rows (excluding header): ${dataRowCount}`);
  });

  console.log('\n\n====================================================');
  console.log('✅ INSPEKSI SELESAI');
  console.log('====================================================');
}

inspectExcel().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
