/**
 * CSV file parser.
 *
 * Reads a CSV file and returns an array of objects (header row becomes keys).
 * Handles common CSV quirks: BOM, mixed line endings, quoted fields.
 */

const fs = require('fs');
const { parse } = require('csv-parse/sync');

async function parseCSV(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');

  // Strip BOM if present
  const content = raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw;

  if (content.trim().length === 0) return [];

  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    cast: (value) => {
      // Try to cast numbers
      if (/^-?\d+(\.\d+)?$/.test(value)) {
        const num = Number(value);
        if (!isNaN(num) && isFinite(num)) return num;
      }
      return value;
    }
  });

  return records;
}

module.exports = { parseCSV };
