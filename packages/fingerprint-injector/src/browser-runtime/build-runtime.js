const fs = require('fs');
const path = require('path');

const RUNTIME_DIR = __dirname;
const OUTPUT_FILE = path.join(RUNTIME_DIR, '..', 'utils.js');

const files = [
    'cache.js',
    'proxy-helpers.js',
    'error-stack.js',
    'webgl.js',
    'codecs.js',
    'battery.js',
    'intl.js',
    'screen.js',
    'webrtc.js',
    'useragent-data.js',
    'headless-patches.js',
    'static.js',
];

console.log('Building browser runtime utils.js...');

let combinedContent = '';
for (const file of files) {
    const filePath = path.join(RUNTIME_DIR, file);
    if (fs.existsSync(filePath)) {
        console.log(`Concating ${file}...`);
        combinedContent += fs.readFileSync(filePath, 'utf8') + '\n';
    } else {
        console.error(`Warning: ${file} does not exist!`);
    }
}

fs.writeFileSync(OUTPUT_FILE, combinedContent, 'utf8');
console.log(`Successfully generated ${OUTPUT_FILE}`);
