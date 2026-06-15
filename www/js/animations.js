/* ═══════════════════════════════════════════════════════════════
   ARUVA — Shared Animation Engine
   Auto-applies to every page that loads this script.
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── 1. Scroll Reveal ──────────────────────────────────────── */
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('ar-in');
      revealObserver.unobserve(e.target);
    });
  }, { threshold: 0.09, rootMargin: '0px 0px -36px 0px' });

  /* Auto-tag common elements that don't already have a reveal class */
  const autoSelectors = [
    'h1:not(.ar-reveal):not(.ar-reveal-left):not(.ar-reveal-scale)',
    'h2:not(.ar-reveal):not(.ar-reveal-left):not(.ar-reveal-scale)',
    'h3:not(.ar-reveal):not(.ar-reveal-left):not(.ar-reveal-scale)',
    '.card:not(.ar-reveal)',
    '.product-card:not(.ar-reveal)',
    '.how-step:not(.ar-reveal)',
    '.cat-tile:not(.ar-reveal)',
    '.feat-card:not(.ar-reveal)',
    '.testi-card:not(.ar-reveal)',
    '.stat-card:not(.ar-reveal)',
    '.step-circle-wrap:not(.ar-reveal)',
    '.footer-col:not(.ar-reveal)',
    '.sec-kicker:not(.ar-reveal)',
    '.sidebar:not(.ar-reveal)',
  ];

  function initReveal() {
    /* Manually-tagged elements */
    document.querySelectorAll('.ar-reveal, .ar-reveal-left, .ar-reveal-right, .ar-reveal-scale')
      .forEach(el => revealObserver.observe(el));

    /* Auto-tag — skip anything inside nav/fixed elements */
    autoSelectors.forEach(sel => {
      document.querySelectorAll(sel).forEach((el, i) => {
        if (el.closest('.nav, .main-nav, [style*="position:fixed"], [style*="position: fixed"]')) return;
        el.classList.add('ar-reveal');
        el.style.transitionDelay = (i % 6) * 0.07 + 's'; /* stagger up to 6 siblings */
        revealObserver.observe(el);
      });
    });

    /* Stagger grid containers tagged with data-stagger */
    document.querySelectorAll('[data-stagger]').forEach(grid => {
      Array.from(grid.children).forEach((child, i) => {
        if (!child.classList.contains('ar-reveal')) child.classList.add('ar-reveal');
        child.style.transitionDelay = i * 0.08 + 's';
        revealObserver.observe(child);
      });
    });
  }

  /* ── 2. Ripple on buttons ──────────────────────────────────── */
  function addRipple(e) {
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    const wave = document.createElement('span');
    wave.className = 'ar-ripple-wave';
    wave.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px;position:absolute;`;
    btn.style.position = btn.style.position || 'relative';
    btn.appendChild(wave);
    wave.addEventListener('animationend', () => wave.remove());
  }

  function initRipples() {
    document.querySelectorAll(
      '.btn, .btn-primary, .btn-secondary, .btn-outline-gold, ' +
      '.nav-cta, .nav-login-btn, .nav-cart, ' +
      'button:not(.no-ripple):not(.qty-btn):not(.modal-close):not(.search-close)'
    ).forEach(btn => {
      if (btn._rippleAttached) return;
      btn.style.overflow = btn.style.overflow || 'hidden';
      btn.addEventListener('click', addRipple);
      btn._rippleAttached = true;
    });
  }

  /* ── 3. Magnetic hover on CTA buttons ─────────────────────── */
  function initMagneticBtns() {
    document.querySelectorAll('.btn-primary, .nav-cta, .nav-login-btn').forEach(btn => {
      btn.addEventListener('mousemove', e => {
        const r = btn.getBoundingClientRect();
        const dx = (e.clientX - r.left - r.width  / 2) * 0.18;
        const dy = (e.clientY - r.top  - r.height / 2) * 0.18;
        btn.style.transform = `translate(${dx}px,${dy}px) translateY(-2px)`;
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.transform = '';
      });
    });
  }

  /* ── 4. Counter animation (numbers counting up) ────────────── */
  function animateCounter(el) {
    const target = parseFloat(el.dataset.target || el.innerText.replace(/[^0-9.]/g, ''));
    if (isNaN(target)) return;
    const suffix = el.innerText.replace(/[0-9.]/g, '');
    const duration = 1400;
    const start = performance.now();
    const isDecimal = target % 1 !== 0;

    function tick(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3); /* ease-out cubic */
      const value = target * ease;
      el.innerText = (isDecimal ? value.toFixed(1) : Math.floor(value)) + suffix;
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function initCounters() {
    const counterObs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        animateCounter(e.target);
        counterObs.unobserve(e.target);
      });
    }, { threshold: 0.5 });

    document.querySelectorAll('[data-counter]').forEach(el => counterObs.observe(el));
  }

  /* ── 5. Smooth hover tilt on cards ────────────────────────── */
  function initCardTilt() {
    document.querySelectorAll('.product-card, .how-step, .feat-card, .glass-panel').forEach(card => {
      card.addEventListener('mousemove', e => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width  - 0.5;
        const y = (e.clientY - r.top)  / r.height - 0.5;
        card.style.transform = `perspective(800px) rotateY(${x * 6}deg) rotateX(${-y * 6}deg) translateY(-4px)`;
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
      });
    });
  }

  /* ── 6. Active nav link highlight ─────────────────────────── */
  function initActiveNav() {
    const path = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-links a, .nav-item > a, .nav-center a').forEach(a => {
      if (a.getAttribute('href') === path) a.classList.add('active');
    });
  }

  /* ── 7. Smooth anchor scroll ───────────────────────────────── */
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      if (a._scrollAttached) return;
      a.addEventListener('click', e => {
        const target = document.querySelector(a.getAttribute('href'));
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
      a._scrollAttached = true;
    });
  }

  /* ── 8. Page transition out ────────────────────────────────── */
  function initPageTransitions() {
    document.querySelectorAll('a[href]').forEach(a => {
      const href = a.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto')) return;
      if (a._transitionAttached) return;
      a.addEventListener('click', e => {
        const dest = a.href;
        if (!dest || a.target === '_blank') return;
        e.preventDefault();
        document.body.style.opacity = '0';
        document.body.style.transform = 'translateY(-8px)';
        document.body.style.transition = 'opacity .22s ease, transform .22s ease';
        setTimeout(() => { location.href = dest; }, 220);
      });
      a._transitionAttached = true;
    });
  }

  /* ── Init everything on DOM ready ──────────────────────────── */
  function init() {
    initReveal();
    initRipples();
    initMagneticBtns();
    initCounters();
    initCardTilt();
    initActiveNav();
    initSmoothScroll();
    initPageTransitions();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
