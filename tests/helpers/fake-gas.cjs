// Runs backend/Code.gs (Google Apps Script) in Node against an in-memory
// spreadsheet, so the stock and order logic can be tested without Google.
const fs = require('fs'), vm = require('vm'), path = require('path');

function parseCSV(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.map(r => r.map(v => v === 'TRUE' ? true : v === 'FALSE' ? false : v !== '' && !isNaN(Number(v)) ? Number(v) : v));
}

function makeSheet(name, data = []) {
  const sh = { name, data, frozen: 0, rules: [], checkboxes: false };
  const width = () => Math.max(0, ...sh.data.map(r => r.length));
  const ensure = (r, c) => { while (sh.data.length < r) sh.data.push([]); for (const row of sh.data) while (row.length < c) row.push(''); };
  const range = (r, c, nr = 1, nc = 1) => ({
    getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => (sh.data[r - 1 + i] || [])[c - 1 + j] ?? '')),
    getValue: () => (sh.data[r - 1] || [])[c - 1] ?? '',
    setValue: (v) => { ensure(r, c); sh.data[r - 1][c - 1] = v; return range(r, c, nr, nc); },
    setValues: (vals) => { ensure(r + nr - 1, c + nc - 1); vals.forEach((row, i) => row.forEach((v, j) => { sh.data[r - 1 + i][c - 1 + j] = v; })); return range(r, c, nr, nc); },
    insertCheckboxes: () => { sh.checkboxes = true; },
    setFontWeight() { return this; }, setBackground() { return this; }, setFontColor() { return this; },
    getColumn: () => c
  });
  Object.assign(sh, {
    getDataRange: () => range(1, 1, sh.data.length, width()),
    getRange: range,
    getLastRow: () => sh.data.length,
    getLastColumn: () => width(),
    getMaxRows: () => Math.max(1000, sh.data.length),
    appendRow: (row) => { sh.data.push(row.slice()); },
    setFrozenRows: (n) => { sh.frozen = n; },
    getConditionalFormatRules: () => sh.rules.slice(),
    setConditionalFormatRules: (r) => { sh.rules = r; },
    autoResizeColumns: () => {},
    setName: (n) => { for (const k in sheetsRef) if (sheetsRef[k] === sh) { delete sheetsRef[k]; sheetsRef[n] = sh; } sh.name = n; return sh; }
  });
  return sh;
}

let sheetsRef;
function createGas(csvPath, tabName = 'Inventory') {
  const sheets = {}; sheetsRef = sheets;
  if (csvPath) sheets[tabName] = makeSheet(tabName, parseCSV(fs.readFileSync(csvPath, 'utf8')));
  const ss = {
    getSheetByName: (n) => sheets[n] || null,
    getSheets: () => Object.values(sheets),
    insertSheet: (n) => (sheets[n] = makeSheet(n))
  };
  const ruleBuilder = () => { const b = { r: [], whenFormulaSatisfied(f) { b.f = f; return b; }, setBackground() { return b; }, setFontColor() { return b; }, setRanges(r) { b.r = r; return b; }, build: () => ({ f: b.f, getRanges: () => b.r }) }; return b; };
  let locked = false;
  const ctx = {
    SpreadsheetApp: { getActive: () => ss, newConditionalFormatRule: ruleBuilder },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (s) => ({ content: s, setMimeType() { return this; } }) },
    LockService: { getScriptLock: () => ({ waitLock() { if (locked) throw new Error('lock busy'); locked = true; }, releaseLock() { locked = false; } }) },
    JSON, Math, Number, String, Object, Array, Date, isNaN, isFinite, Error
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../../backend/Code.gs'), 'utf8'), ctx);
  return { ctx, sheets };
}

module.exports = { createGas };
