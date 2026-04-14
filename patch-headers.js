const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, 'blog');

function getAllHtmlFiles(dirPath, arrayOfFiles = []) {
    const files = fs.readdirSync(dirPath);
    files.forEach(file => {
        if (fs.statSync(dirPath + "/" + file).isDirectory()) {
            arrayOfFiles = getAllHtmlFiles(dirPath + "/" + file, arrayOfFiles);
        } else {
            if (file.endsWith('.html') && file !== 'index.html') {
                arrayOfFiles.push(path.join(dirPath, file));
            }
        }
    });
    return arrayOfFiles;
}

const htmlFiles = getAllHtmlFiles(DIR);

const stickyHtml = `

    <!-- NEW: Sticky Header -->
    <div class="sticky-header">
        <div class="sticky-header-inner">
            <span class="sticky-title"></span>
            <nav class="sticky-nav nav-links">
                <a href="/">Home</a>
                <a href="/blog/" style="color: var(--accent-secondary);">Digest</a>
            </nav>
        </div>
    </div>`;

const newJs = `// ── Sticky Header & Progress Bar ───────────────────────
        (function () {
            var h1 = document.querySelector('.post-header h1');
            var stickyHeader = document.querySelector('.sticky-header');
            var progressBar = document.getElementById('myBar');
            var stickyTitle = document.querySelector('.sticky-title');
            
            if (h1 && stickyTitle) {
                stickyTitle.textContent = h1.textContent;
            }

            window.addEventListener('scroll', function () {
                if (h1 && stickyHeader) {
                    var gone = h1.getBoundingClientRect().bottom <= 0;
                    if (gone) {
                        stickyHeader.classList.add('visible');
                    } else {
                        stickyHeader.classList.remove('visible');
                    }
                }
                
                if (progressBar) {
                    var winScroll = document.body.scrollTop || document.documentElement.scrollTop;
                    var height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
                    if (height > 0) {
                        var scrolled = (winScroll / height) * 100;
                        progressBar.style.width = scrolled + "%";
                    }
                }
            }, { passive: true });
        })();`;

htmlFiles.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let modified = false;

    // 1. Insert HTML if not present
    if (!content.includes('<div class="sticky-header">')) {
        content = content.replace('id="myBar"></div>\n    </div>', 'id="myBar"></div>\n    </div>' + stickyHtml);
        modified = true;
    }

    // 2. Replace JS block
    const oldJsRegex = /\/\/ ── Sticky Title Swap ──────────────────────────────────\s*\([\s\S]*?\}\)\(\);/m;
    if (oldJsRegex.test(content)) {
        content = content.replace(oldJsRegex, newJs);
        modified = true;
    } else if (!content.includes('Sticky Header & Progress Bar')) {
        // Fallback replacement if regex misses due to formatting
        const oldJsFallback = /\/\/ ── Sticky Title Swap[^\<]+/m;
        if (content.match(oldJsFallback)) {
            content = content.replace(oldJsFallback, newJs + '\n');
            modified = true;
        }
    }

    if (modified) {
        fs.writeFileSync(file, content, 'utf8');
        console.log(`Patched: ${file}`);
    }
});

console.log('All files patched successfully.');
