import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'server', 'routes.ts');
let content = fs.readFileSync(filePath, 'utf8');

console.log('🧹 Starting more aggressive HTML cleanup in routes.ts...');

// Remove spaces before closing bracket of tags: <div > -> <div>
content = content.replace(/<\s*([a-zA-Z1-6]+)([^>]*?)\s+>/g, '<$1$2>');

// Remove leading spaces inside template literals if they start with a tag correctly but have spaces
// Actually, let's just target the distored pattern: "> " -> ">"
content = content.replace(/>\s+</g, '><');

// Fix closing tags that might still have spaces: </td > -> </td>
content = content.replace(/<\/\s*([a-zA-Z1-6]+)\s*>/g, '</$1>');

fs.writeFileSync(filePath, content);
console.log('✅ More aggressive HTML cleanup complete!');
