/**
 * Excel file parser (.xlsx, .xls).
 *
 * Reads the first sheet and returns an array of objects.
 * Uses the SheetJS library (xlsx).
 */

const XLSX = require('xlsx');

function parseExcel(filePath) {
  const workbook = XLSX.readFile(filePath, { type: 'file' });

  // Use first sheet
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  return rows;
}

function parseExcelAllSheets(filePath) {
  const workbook = XLSX.readFile(filePath, { type: 'file' });
  const result = {};

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    result[sheetName] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  }

  return result;
}

module.exports = { parseExcel, parseExcelAllSheets };
