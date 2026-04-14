const fs = require('fs');
const path = require('path');

const SOURCE_IMG = 'C:\\Users\\rv941\\.gemini\\antigravity\\brain\\f998b652-b919-4d21-86c7-2f9227de3657\\blockchain_hero_optimized_1776096585975.png';
const DEST_IMG_DIR = path.join(__dirname, 'assets');
const DEST_IMG = path.join(DEST_IMG_DIR, 'blockchain-hero-optimized.png');

if (!fs.existsSync(DEST_IMG_DIR)) {
    fs.mkdirSync(DEST_IMG_DIR, { recursive: true });
}

fs.copyFileSync(SOURCE_IMG, DEST_IMG);
console.log('Copied hero image to assets.');

const missingFiles = JSON.parse(fs.readFileSync('missing.json', 'utf8'));

let patchedCount = 0;

for (const file of missingFiles) {
    let html = fs.readFileSync(file, 'utf8');

    if (!html.includes('class="hero-image"')) {
        const insertion = `
                </header>
                
                <figure class="hero-image-container" style="text-align: center; margin: 30px 0;">
                    <img class="hero-image" src="../../../assets/blockchain-hero-optimized.png" alt="Abstract Blockchain Execution Architecture" loading="lazy" style="border-radius: 12px; width: 100%; max-height: 480px; object-fit: cover;">
                </figure>
                
                <div class="content-body">`;

        html = html.replace(/<\/header>\s+<div class="content-body">/, insertion);
        fs.writeFileSync(file, html, 'utf8');
        patchedCount++;
        console.log('Patched ' + path.basename(file));
    }
}

console.log('Successfully injected hero image into ' + patchedCount + ' blog posts.');
