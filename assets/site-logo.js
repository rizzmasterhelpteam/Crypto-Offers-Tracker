(function () {
    var STYLE_ID = 'site-logo-shared-styles';

    function ensureStyles() {
        if (document.getElementById(STYLE_ID) || !document.head) {
            return;
        }

        var style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = [
            '.logo, .footer-logo { display: inline-flex; align-items: center; gap: 12px; }',
            '.site-logo-image { width: 40px; height: 40px; object-fit: contain; display: block; flex-shrink: 0; }',
            '.site-logo-fallback { max-width: 1100px; margin: 0 auto 24px; padding: 16px 20px 0; }',
            '.site-logo-fallback-inner { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }',
            '.site-logo-fallback .nav-links { display: flex; gap: 18px; flex-wrap: wrap; }',
            '.site-logo-fallback .nav-links a { text-decoration: none; }',
            '@media (max-width: 640px) { .site-logo-fallback { padding: 16px 16px 0; } }'
        ].join('');
        document.head.appendChild(style);
    }

    function createLogoImage() {
        var img = document.createElement('img');
        img.src = '/assets/logo.png';
        img.alt = 'Crypto Offers logo';
        img.className = 'site-logo-image';
        img.width = 40;
        img.height = 40;
        img.decoding = 'async';
        return img;
    }

    function ensureLogoImage(node) {
        if (!node || node.querySelector('img')) {
            return;
        }

        node.insertBefore(createLogoImage(), node.firstChild);
    }

    function ensureFallbackHeader() {
        var isBlogPath = window.location.pathname.indexOf('/blog/') !== -1;
        if (!isBlogPath || document.querySelector('.logo') || !document.body) {
            return;
        }

        var wrapper = document.createElement('div');
        wrapper.className = 'site-logo-fallback';
        wrapper.innerHTML = [
            '<div class="site-logo-fallback-inner">',
            '  <a href="/" class="logo">',
            '    <img src="/assets/logo.png" alt="Crypto Digest logo" class="site-logo-image" width="40" height="40">',
            '    <span>Crypto Digest</span>',
            '  </a>',
            '  <nav class="nav-links">',
            '    <a href="/">Home</a>',
            '    <a href="/blog/">Digest</a>',
            '    <a href="/about.html">About</a>',
            '    <a href="/contact.html">Contact</a>',
            '  </nav>',
            '</div>'
        ].join('');

        document.body.insertBefore(wrapper, document.body.firstChild);
    }

    function init() {
        ensureStyles();
        document.querySelectorAll('.logo, .footer-logo').forEach(ensureLogoImage);
        ensureFallbackHeader();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
