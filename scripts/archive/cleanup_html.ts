import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'server', 'routes.ts');
let content = fs.readFileSync(filePath, 'utf8');

console.log('🧹 Starting HTML cleanup in routes.ts...');

// Fix opening tags with spaces: < div -> <div, < p -> <p, etc.
const fixOpeningTags = /<\s+([a-zA-Z1-6]+)/g;
content = content.replace(fixOpeningTags, '<$1');

// Fix closing tags with spaces: </ div -> </div, < / div -> </div
const fixClosingTags = /<\s*\/\s*([a-zA-Z1-6]+)\s*>/g;
content = content.replace(fixClosingTags, '</$1>');

// Fix tags with spaces before closing bracket: <div > -> <div>
const fixTagBrackets = /<([a-zA-Z1-6]+)\s+>/g;
content = content.replace(fixTagBrackets, '<$1>');

// Specifically fix style attributes that might have spaces around =
// <div style = "..." > -> <div style="..." >
const fixStyleAtts = /style\s*=\s*"/g;
content = content.replace(fixStyleAtts, 'style="');

// Fix common distorted tags seen in logs
content = content.replace(/< tr >/g, '<tr>');
content = content.replace(/<\/tr >/g, '</tr>');
content = content.replace(/< td/g, '<td');
content = content.replace(/<\/td >/g, '</td>');
content = content.replace(/< h1/g, '<h1');
content = content.replace(/<\/h1 >/g, '</h1>');
content = content.replace(/< h2/g, '<h2');
content = content.replace(/<\/h2 >/g, '</h2>');
content = content.replace(/< span/g, '<span');
content = content.replace(/<\/span >/g, '</span>');

fs.writeFileSync(filePath, content);
console.log('✅ HTML cleanup complete!');
