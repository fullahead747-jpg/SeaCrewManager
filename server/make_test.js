const fs = require('fs');
const code = fs.readFileSync('googleOcrService.ts', 'utf8');
const funcStr = code.substring(code.indexOf('function normalizeDateStr'), code.indexOf('let tesseractWorker'));
fs.writeFileSync('test_norm.js', funcStr + '\nconsole.log(normalizeDateStr("16 03 2022"));\nconsole.log(normalizeDateStr("1503 2032"));');
