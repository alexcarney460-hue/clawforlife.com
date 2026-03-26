/**
 * Business data parsing routes.
 *
 * These endpoints crawl shared folders for business-relevant files,
 * parse them, and return structured data the phone AI can use.
 *
 * GET /api/business/contacts  — Customer/contact list from spreadsheets
 * GET /api/business/invoices  — Invoice data from spreadsheets and PDFs
 * GET /api/business/calendar  — Calendar events (ICS files)
 * GET /api/business/summary   — Overview of all discovered business data
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const { parseCSV } = require('../parsers/csv');
const { parseExcel } = require('../parsers/excel');
const { parsePDF } = require('../parsers/pdf');

function findFiles(folders, extensions, maxDepth = 4) {
  const files = [];
  function walk(dir, depth) {
    if (depth > maxDepth || files.length > 500) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (['node_modules', '.git', '__pycache__', '.cache', 'AppData'].includes(entry.name)) continue;
          walk(full, depth + 1);
        } else {
          const ext = path.extname(entry.name).toLowerCase();
          if (extensions.includes(ext)) {
            files.push(full);
          }
        }
      }
    } catch { /* skip */ }
  }
  for (const folder of folders) {
    walk(folder, 0);
  }
  return files;
}

module.exports = function businessRouter(config) {
  const router = express.Router();

  // GET /api/business/contacts
  router.get('/contacts', async (req, res) => {
    try {
      const spreadsheets = findFiles(config.sharedFolders, ['.csv', '.xlsx', '.xls']);
      const contacts = [];

      for (const file of spreadsheets) {
        try {
          const ext = path.extname(file).toLowerCase();
          let rows = [];

          if (ext === '.csv') {
            rows = await parseCSV(file);
          } else {
            rows = parseExcel(file);
          }

          if (rows.length === 0) continue;

          // Heuristic: does this look like a contact list?
          const headers = Object.keys(rows[0]).map(h => h.toLowerCase());
          const contactIndicators = ['name', 'email', 'phone', 'customer', 'client', 'contact', 'company', 'address'];
          const matchCount = contactIndicators.filter(ind => headers.some(h => h.includes(ind))).length;

          if (matchCount >= 2) {
            contacts.push({
              source: file,
              sourceFile: path.basename(file),
              rowCount: rows.length,
              headers: Object.keys(rows[0]),
              records: rows.slice(0, 200) // Cap at 200 per file
            });
          }
        } catch (err) {
          console.warn(`[business] Failed to parse ${file}: ${err.message}`);
        }
      }

      return res.json({
        success: true,
        data: contacts,
        meta: { filesScanned: spreadsheets.length, sourcesFound: contacts.length }
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET /api/business/invoices
  router.get('/invoices', async (req, res) => {
    try {
      const files = findFiles(config.sharedFolders, ['.csv', '.xlsx', '.xls', '.pdf']);
      const invoices = [];

      for (const file of files) {
        const name = path.basename(file).toLowerCase();
        const ext = path.extname(file).toLowerCase();

        // Heuristic: filename suggests invoice data
        const isInvoiceFile = ['invoice', 'inv', 'billing', 'receipt', 'payment', 'accounts receivable', 'ar'].some(kw => name.includes(kw));

        if (!isInvoiceFile) continue;

        try {
          if (ext === '.pdf') {
            const text = await parsePDF(file);
            invoices.push({
              source: file,
              sourceFile: path.basename(file),
              type: 'pdf',
              textContent: text.slice(0, 5000) // Cap text
            });
          } else if (ext === '.csv') {
            const rows = await parseCSV(file);
            invoices.push({
              source: file,
              sourceFile: path.basename(file),
              type: 'spreadsheet',
              rowCount: rows.length,
              headers: rows.length > 0 ? Object.keys(rows[0]) : [],
              records: rows.slice(0, 200)
            });
          } else {
            const rows = parseExcel(file);
            invoices.push({
              source: file,
              sourceFile: path.basename(file),
              type: 'spreadsheet',
              rowCount: rows.length,
              headers: rows.length > 0 ? Object.keys(rows[0]) : [],
              records: rows.slice(0, 200)
            });
          }
        } catch (err) {
          console.warn(`[business] Failed to parse invoice ${file}: ${err.message}`);
        }
      }

      return res.json({
        success: true,
        data: invoices,
        meta: { filesScanned: files.length, invoiceSourcesFound: invoices.length }
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET /api/business/calendar
  router.get('/calendar', async (req, res) => {
    try {
      const files = findFiles(config.sharedFolders, ['.ics', '.ical']);
      const events = [];

      for (const file of files) {
        try {
          const content = fs.readFileSync(file, 'utf-8');
          // Basic ICS parsing — extract VEVENT blocks
          const veventRegex = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/g;
          let match;
          while ((match = veventRegex.exec(content)) !== null) {
            const block = match[1];
            const get = (key) => {
              const m = block.match(new RegExp(`${key}[^:]*:(.+)`));
              return m ? m[1].trim() : null;
            };
            events.push({
              source: file,
              summary: get('SUMMARY'),
              start: get('DTSTART'),
              end: get('DTEND'),
              location: get('LOCATION'),
              description: get('DESCRIPTION')
            });
          }
        } catch (err) {
          console.warn(`[business] Failed to parse calendar ${file}: ${err.message}`);
        }
      }

      return res.json({
        success: true,
        data: events,
        meta: { filesScanned: files.length, eventsFound: events.length }
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET /api/business/summary — overview of discovered data
  router.get('/summary', async (req, res) => {
    try {
      const allFiles = findFiles(config.sharedFolders, [
        '.csv', '.xlsx', '.xls', '.pdf', '.doc', '.docx',
        '.txt', '.json', '.xml', '.ics', '.qbw', '.qbb', '.iif'
      ]);

      const byType = {};
      let totalSize = 0;

      for (const file of allFiles) {
        const ext = path.extname(file).toLowerCase();
        if (!byType[ext]) byType[ext] = { count: 0, totalSize: 0, examples: [] };
        byType[ext].count++;
        try {
          const stat = fs.statSync(file);
          byType[ext].totalSize += stat.size;
          totalSize += stat.size;
          if (byType[ext].examples.length < 3) {
            byType[ext].examples.push(path.basename(file));
          }
        } catch { /* skip */ }
      }

      return res.json({
        success: true,
        data: {
          sharedFolders: config.sharedFolders,
          totalFiles: allFiles.length,
          totalSizeBytes: totalSize,
          totalSizeMB: Math.round(totalSize / 1024 / 1024 * 10) / 10,
          byFileType: byType
        }
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
};
