/**
 * PDF text extraction.
 *
 * Extracts raw text from PDF files using pdf-parse.
 * Returns plain text content for AI analysis.
 */

const fs = require('fs');
const pdfParse = require('pdf-parse');

async function parsePDF(filePath) {
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);
  return data.text || '';
}

async function parsePDFWithMeta(filePath) {
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);
  return {
    text: data.text || '',
    pages: data.numpages,
    info: data.info || {}
  };
}

module.exports = { parsePDF, parsePDFWithMeta };
