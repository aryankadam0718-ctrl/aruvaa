/**
 * ARUVA — Shared App Utilities
 * API client, Auth, Nav, Product Images, Utilities
 */

const API = 'http://localhost:3000/api';

// ── AUTH ──────────────────────────────────────────────────────
const Auth = {
  token:     () => localStorage.getItem('aruva_token'),
  user:      () => { try { return JSON.parse(localStorage.getItem('aruva_user') || 'null'); } catch { return null; } },
  save:      (token, user) => { localStorage.setItem('aruva_token', token); localStorage.setItem('aruva_user', JSON.stringify(user)); },
  clear:     () => { localStorage.removeItem('aruva_token'); localStorage.removeItem('aruva_user'); },
  logout:    () => { Auth.clear(); window.location.href = '/login.html'; },
  isLoggedIn:() => !!Auth.token()
};

// ── API CLIENT ─────────────────────────────────────────────────
async function api(path, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  const token = Auth.token();
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body)  opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  const data = await res.json();
  if (!res.ok) throw data;
  return data;
}

// ── UTILITIES ─────────────────────────────────────────────────
function fmt(price)  { return '₹' + Number(price).toLocaleString('en-IN', { minimumFractionDigits: 0 }); }
function fmtDate(dt) { return new Date(dt).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }); }
function debounce(fn, ms) { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); }; }
function qs(sel, ctx = document) { return ctx.querySelector(sel); }
function qsa(sel, ctx = document) { return [...ctx.querySelectorAll(sel)]; }

function starsHTML(rating, size = 13) {
  let h = '';
  for (let i = 1; i <= 5; i++)
    h += `<span style="color:${i <= Math.round(rating) ? '#C9A84C' : '#333'};font-size:${size}px">★</span>`;
  return h;
}

function effectivePrice(product) {
  return product.is_on_sale && product.sale_price ? product.sale_price : product.price;
}

// ── TOAST ─────────────────────────────────────────────────────
function toast(msg, type = 'ok') {
  qsa('.aruva-toast').forEach(el => el.remove());
  const colors = { ok: { bg:'#1a1a1a', border:'rgba(201,168,76,.28)', text:'#F0F0F0' }, error: { bg:'rgba(239,68,68,.12)', border:'rgba(239,68,68,.35)', text:'#f87171' }, success: { bg:'rgba(76,175,80,.12)', border:'rgba(76,175,80,.35)', text:'#4ade80' } };
  const c = colors[type] || colors.ok;
  const t = document.createElement('div');
  t.className = 'aruva-toast';
  t.innerHTML = `<div style="background:${c.bg};border:1px solid ${c.border};color:${c.text};padding:11px 22px;border-radius:50px;font-size:13px;font-family:'Segoe UI',sans-serif;box-shadow:0 8px 32px rgba(0,0,0,.4)">${msg}</div>`;
  document.body.appendChild(t);
  setTimeout(() => t.firstChild.style.cssText += ';transition:transform .3s', 0);
  setTimeout(() => { try { t.remove(); } catch {} }, 3200);
}

// ── PRODUCT IMAGE ─────────────────────────────────────────────
function renderProductCanvas(canvas, product) {
  const W = canvas.width || 300, H = canvas.height || 380;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#0d0d0d';
  ctx.fillRect(0, 0, W, H);

  // Shirt path scaled to canvas
  const sx = W / 300, sy = H / 380;
  ctx.save();
  ctx.scale(sx, sy);

  // Draw t-shirt shape
  ctx.beginPath();
  ctx.moveTo(50, 340);
  ctx.bezierCurveTo(50, 346, 150, 354, 250, 340);
  ctx.lineTo(250, 110);
  ctx.bezierCurveTo(268, 102, 290, 95, 310, 82);
  ctx.lineTo(292, 50);
  ctx.bezierCurveTo(258, 64, 225, 82, 200, 92);
  ctx.bezierCurveTo(183, 98, 167, 102, 150, 104);
  ctx.bezierCurveTo(133, 102, 117, 98, 100, 92);
  ctx.bezierCurveTo(75, 82, 42, 64, 8, 50);
  ctx.lineTo(-10, 82);
  ctx.bezierCurveTo(10, 95, 32, 102, 50, 110);
  ctx.closePath();

  // Main color fill
  const col = product.color || '#1a1a1a';
  ctx.fillStyle = col;
  ctx.fill();

  // Subtle highlight gradient
  const grad = ctx.createLinearGradient(50, 50, 250, 340);
  grad.addColorStop(0, 'rgba(255,255,255,0.07)');
  grad.addColorStop(1, 'rgba(0,0,0,0.15)');
  ctx.fillStyle = grad;
  ctx.fill();

  // Noise texture
  for (let i = 0; i < 1200; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.025})`;
    ctx.fillRect(Math.random() * 300, Math.random() * 380, 1, 1);
  }

  // Outline
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.restore();

  // Custom / New text on shirt
  if (product.is_customizable) {
    ctx.save();
    ctx.font = `bold ${W * 0.1}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = _contrastColor(col);
    ctx.globalAlpha = 0.55;
    ctx.fillText('CUSTOM', W / 2, H * 0.62);
    ctx.font = `${W * 0.07}px Arial`;
    ctx.fillText('3D STUDIO', W / 2, H * 0.72);
    ctx.restore();
  }
}

function _contrastColor(hex) {
  if (!hex || hex.length < 6) return '#F0F0F0';
  const r = parseInt(hex.slice(1,3)||'1a',16);
  const g = parseInt(hex.slice(3,5)||'1a',16);
  const b = parseInt(hex.slice(5,7)||'1a',16);
  return (0.299*r + 0.587*g + 0.114*b) / 255 > 0.52 ? '#111111' : '#F0F0F0';
}

// ── PRODUCT CARD BUILDER ──────────────────────────────────────
function buildProductCard(product, wishlistIds = new Set()) {
  const price = effectivePrice(product);
  let colorsArr = [];
  try { colorsArr = JSON.parse(product.colors || '[]'); } catch {}
  const inWl = wishlistIds.has(product.id);

  const card = document.createElement('div');
  card.className = 'product-card';
  card.dataset.id = product.id;

  const badges = [
    product.is_new     && '<span class="badge badge-new">New</span>',
    product.is_on_sale && '<span class="badge badge-sale">Sale</span>',
    product.is_customizable && '<span class="badge badge-custom">3D</span>',
  ].filter(Boolean).join('');

  const colDots = colorsArr.slice(0,5).map(c => `<span class="product-card-color-dot" style="background:${c}" title="${c}"></span>`).join('');

  card.innerHTML = `
    <div class="product-card-img">
      <canvas width="300" height="380"></canvas>
      <div class="product-card-badges">${badges}</div>
      <button class="product-card-wl${inWl?' active':''}" data-pid="${product.id}" title="${inWl?'Remove from wishlist':'Add to wishlist'}">
        ${inWl ? '♥' : '♡'}
      </button>
    </div>
    <div class="product-card-body">
      <div class="product-card-cat">${product.cat_name || ''}</div>
      <div class="product-card-name">${product.name}</div>
      <div class="product-card-rating">
        <span class="product-card-stars">${starsHTML(product.rating,11)}</span>
        <span class="product-card-rc">(${product.review_count})</span>
      </div>
      <div class="product-card-price">
        <span class="product-card-current">${fmt(price)}</span>
        ${product.is_on_sale ? `<span class="product-card-original">${fmt(product.price)}</span>` : ''}
      </div>
      ${colDots ? `<div class="product-card-colors">${colDots}</div>` : ''}
    </div>`;

  // Render canvas
  const canvas = card.querySelector('canvas');
  canvas.width = 300; canvas.height = 380;
  renderProductCanvas(canvas, product);

  // Navigate on card click (not wishlist)
  card.addEventListener('click', e => {
    if (e.target.closest('.product-card-wl')) return;
    window.location.href = `product.html?id=${product.id}`;
  });

  // Wishlist button
  card.querySelector('.product-card-wl').addEventListener('click', e => {
    e.stopPropagation();
    toggleWishlist(product.id, card.querySelector('.product-card-wl'));
  });

  return card;
}

async function toggleWishlist(productId, btn) {
  if (!Auth.isLoggedIn()) { window.location.href = 'login.html'; return; }
  const active = btn.classList.contains('active');
  try {
    if (active) {
      await api(`/wishlist/${productId}`, 'DELETE');
      btn.classList.remove('active');
      btn.textContent = '♡';
      toast('Removed from wishlist');
    } else {
      await api('/wishlist', 'POST', { product_id: productId });
      btn.classList.add('active');
      btn.textContent = '♥';
      toast('Added to wishlist ♥');
    }
    updateBadges();
  } catch { toast('Please sign in first', 'error'); }
}

// ── BADGE UPDATER ─────────────────────────────────────────────
async function updateBadges() {
  if (!Auth.isLoggedIn()) return;
  try {
    const [cart, wl] = await Promise.all([api('/cart'), api('/wishlist')]);
    const cartCount = cart.reduce((a, i) => a + i.quantity, 0);
    qsa('.cart-badge').forEach(el => {
      el.textContent = cartCount || '';
      el.classList.toggle('show', cartCount > 0);
    });
    qsa('.wl-badge').forEach(el => {
      el.textContent = wl.length || '';
      el.classList.toggle('show', wl.length > 0);
    });
  } catch {}
}

// ── NAV INJECTION ─────────────────────────────────────────────
function injectNav(activeCat = '') {
  const root = document.getElementById('nav-root');
  if (!root) return;
  const user = Auth.user();

  root.innerHTML = `
  <nav class="main-nav">
    <a href="/home.html" class="nav-logo">ARUVA</a>
    <div class="nav-center">
      <div class="nav-item"><a href="/shop.html" ${activeCat?'':'class="active"'}>Shop</a></div>
      <div class="nav-item"><a href="/shop.html?is_new=1">New <span class="new-badge">New</span></a></div>
      <div class="nav-item"><a href="/aruva.html">3D Studio</a></div>
      <div class="nav-item"><a href="/shop.html?is_on_sale=1">Sale <span class="sale-badge">%</span></a></div>
    </div>
    <div class="nav-right">
      <button class="nav-icon-btn" onclick="openSearch()" title="Search">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      </button>
      <a href="/account.html?tab=wishlist" class="nav-icon-btn" title="Wishlist">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        <span class="nav-badge wl-badge"></span>
      </a>
      <a href="/cart.html" class="nav-icon-btn" title="Cart">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
        <span class="nav-badge cart-badge"></span>
      </a>
      ${user
        ? `<div class="nav-item">
            <button class="nav-user-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              ${user.first_name || user.email.split('@')[0]}
            </button>
            <div class="nav-dropdown" style="right:0;left:auto;min-width:180px">
              <a href="/account.html">My Account</a>
              <a href="/account.html?tab=orders">Orders</a>
              <a href="/account.html?tab=wishlist">Wishlist</a>
              <hr style="border:none;border-top:1px solid rgba(255,255,255,.07);margin:4px 0">
              <a href="#" onclick="Auth.logout();return false" style="color:#f87171">Sign Out</a>
            </div>
          </div>`
        : `<a href="/login.html" class="nav-login-btn">Sign In</a>`
      }
    </div>
  </nav>
  <!-- Search Overlay -->
  <div class="search-overlay" id="search-overlay">
    <div class="search-box">
      <input class="search-input" id="search-input" placeholder="Search products…" autocomplete="off">
      <button class="search-close" onclick="closeSearch()">×</button>
      <div class="search-results" id="search-results" style="display:none"></div>
    </div>
  </div>`;

  // Search logic
  const inp = document.getElementById('search-input');
  const results = document.getElementById('search-results');
  if (inp) {
    inp.addEventListener('input', debounce(async () => {
      const q = inp.value.trim();
      if (q.length < 2) { results.style.display = 'none'; return; }
      try {
        const data = await api(`/search?q=${encodeURIComponent(q)}`);
        if (!data.length) { results.style.display = 'none'; return; }
        results.innerHTML = data.map(p => `
          <div class="search-result-item" onclick="window.location.href='/product.html?id=${p.id}'">
            <span class="search-result-dot" style="background:${p.color}"></span>
            <span class="search-result-name">${p.name}</span>
            <span class="search-result-price">${fmt(p.is_on_sale && p.sale_price ? p.sale_price : p.price)}</span>
          </div>`).join('');
        results.style.display = 'block';
      } catch {}
    }, 300));
  }

  updateBadges();
}

function openSearch() {
  document.getElementById('search-overlay').classList.add('open');
  setTimeout(() => document.getElementById('search-input')?.focus(), 100);
}
function closeSearch() {
  document.getElementById('search-overlay').classList.remove('open');
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSearch(); });

// ── FOOTER INJECTION ──────────────────────────────────────────
function injectFooter() {
  const root = document.getElementById('footer-root');
  if (!root) return;
  root.innerHTML = `
  <footer class="main-footer">
    <div class="footer-grid">
      <div>
        <div class="footer-logo">ARUVA</div>
        <p class="footer-desc">Where fashion meets technology. Design your story, wear your vision.</p>
        <div class="footer-social">
          <a href="#">in</a><a href="#">tw</a><a href="#">ig</a><a href="#">yt</a>
        </div>
      </div>
      <div class="footer-col">
        <h4>Shop</h4>
        <ul>
          <li><a href="/shop.html?cat=mens">Men's</a></li>
          <li><a href="/shop.html?cat=womens">Women's</a></li>
          <li><a href="/shop.html?is_new=1">New Arrivals</a></li>
          <li><a href="/shop.html?is_on_sale=1">Sale</a></li>
          <li><a href="/aruva.html">3D Studio</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>Help</h4>
        <ul>
          <li><a href="#">Size Guide</a></li>
          <li><a href="#">Shipping Info</a></li>
          <li><a href="#">Returns</a></li>
          <li><a href="#">Track Order</a></li>
          <li><a href="#">Contact Us</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>Company</h4>
        <ul>
          <li><a href="#">About ARUVA</a></li>
          <li><a href="#">Sustainability</a></li>
          <li><a href="#">Careers</a></li>
          <li><a href="#">Press</a></li>
          <li><a href="#">Privacy Policy</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <p>© 2026 ARUVA Fashion Pvt. Ltd. All rights reserved.</p>
      <div class="footer-payments">
        <span class="pay-badge">VISA</span>
        <span class="pay-badge">MC</span>
        <span class="pay-badge">UPI</span>
        <span class="pay-badge">COD</span>
        <span class="pay-badge">EMI</span>
      </div>
    </div>
  </footer>`;
}
