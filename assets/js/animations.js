/**
 * Royalty Real Estate — GSAP + Lenis Animation System
 *
 * Load order in HTML (just before </body>):
 *   <script src="gsap.min.js"></script>
 *   <script src="ScrollTrigger.min.js"></script>
 *   <script src="lenis.min.js"></script>
 *   <script src="animations.js"></script>  ← this file
 *
 * GSAP/Lenis are globals set by the above scripts.
 * This file runs synchronously right before </body> so the DOM is ready.
 */

(function () {
  'use strict';

  const gsap   = window.gsap;
  const ST     = window.ScrollTrigger;
  const Lenis  = window.Lenis;

  /* Abort silently if CDN failed */
  if (!gsap || !ST || !Lenis) return;

  gsap.registerPlugin(ST);
  if (window.SplitText) gsap.registerPlugin(window.SplitText);

  /* Signal to CSS that GSAP is active (disables CSS fallback pageIn animation) */
  document.documentElement.classList.add('gsap-ready');

  /* ────────────────────────────────
     Helper: run fn now or after DOM
  ──────────────────────────────── */
  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  /* ══════════════════════════════════════════
     1. SMOOTH SCROLL — Lenis + GSAP tick sync
  ══════════════════════════════════════════ */
  const lenis = new Lenis({
    lerp: 0.1,
    smoothTouch: false,
    wheelMultiplier: 1.0,
  });

  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  window.__lenis = lenis;

  /* Prevent Lenis from hijacking scroll inside Leaflet maps */
  function patchMaps() {
    document.querySelectorAll('.leaflet-container, .map-canvas').forEach((el) => {
      if (!el.hasAttribute('data-lenis-prevent')) el.setAttribute('data-lenis-prevent', '');
    });
  }
  patchMaps();
  const _mapObs = new MutationObserver(patchMaps);
  _mapObs.observe(document.body, { childList: true, subtree: true });

  /* ══════════════════════════════════════════
     2. PAGE TRANSITION CURTAIN
  ══════════════════════════════════════════ */
  function getCurtain() {
    let c = document.querySelector('.page-curtain');
    if (!c) {
      c = document.createElement('div');
      c.className = 'page-curtain';
      document.body.appendChild(c);
    }
    return c;
  }

  function playCurtainExit(curtain) {
    gsap.set(curtain, { scaleY: 1, transformOrigin: 'top center' });
    gsap.to(curtain, {
      scaleY: 0, duration: 0.9, ease: 'expo.inOut',
      transformOrigin: 'top center',
      onComplete() { curtain.style.pointerEvents = 'none'; curtain.style.display = 'none'; },
    });
  }

  function playCurtainEnter() {
    const c = getCurtain();
    c.style.display = 'block';
    c.style.pointerEvents = 'auto';
    gsap.set(c, { scaleY: 0, transformOrigin: 'bottom center' });
    return gsap.to(c, { scaleY: 1, duration: 0.55, ease: 'expo.in' });
  }

  /* Link-click transition */
  document.addEventListener('click', function (e) {
    const link = e.target.closest('a[href]');
    if (!link) return;
    const href = link.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('//') ||
        href.startsWith('mailto:') || href.startsWith('tel:') ||
        link.hasAttribute('download') || link.target === '_blank' ||
        link.classList.contains('tab-link') || link.classList.contains('no-transition')) return;

    e.preventDefault();
    lenis.scrollTo(0, { immediate: true });
    const tween = playCurtainEnter();
    tween.then(() => { window.location.href = href; });
  });

  /* ══════════════════════════════════════════
     3. NAVBAR SCROLL STATE
  ══════════════════════════════════════════ */
  function initNavbar() {
    const nav = document.querySelector('.navbar');
    if (!nav) return;
    ST.create({
      trigger: document.body, start: '80px top',
      onEnter:     () => nav.classList.add('scrolled'),
      onLeaveBack: () => nav.classList.remove('scrolled'),
    });
  }

  /* ══════════════════════════════════════════
     4. PAGE ENTRANCE ANIMATIONS
  ══════════════════════════════════════════ */
  function playEntrance() {
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });

    /* Hero section */
    const heroTitle = document.querySelector('.hero-title');
    if (heroTitle) {
      if (window.SplitText) {
        const split = new SplitText(heroTitle, { type: 'lines', linesClass: 'split-line' });
        gsap.set(split.lines, { overflow: 'hidden' });
        tl.from(split.lines, { yPercent: 110, opacity: 0, duration: 1, stagger: 0.1 }, 0.2);
      } else {
        tl.from(heroTitle, { y: 40, opacity: 0, duration: 1 }, 0.2);
      }
    }

    const heroSupporting = document.querySelectorAll('.hero-eyebrow, .hero-desc, .hero-actions');
    if (heroSupporting.length) {
      tl.from(heroSupporting, { y: 24, opacity: 0, duration: 0.85, stagger: 0.1 }, 0.55);
    }

    const heroImage = document.querySelector('.hero-image');
    if (heroImage) {
      tl.from(heroImage, { scale: 0.95, opacity: 0, duration: 1.1 }, 0.1);
    }

    const heroStats = document.querySelector('.hero-stats');
    if (heroStats) {
      tl.from(heroStats, { y: 20, opacity: 0, duration: 0.8 }, 0.8);
    }

    /* Dashboard */
    const dashHeader = document.querySelector('.dashboard-header');
    if (dashHeader) {
      tl.from(dashHeader, { y: 18, opacity: 0, duration: 0.7 }, 0.15);
    }

    const statCards = document.querySelectorAll('.stat-card');
    if (statCards.length) {
      tl.from(statCards, { y: 16, opacity: 0, duration: 0.6, stagger: 0.07 }, 0.3);
    }

    /* Login */
    const loginForm = document.querySelector('.login-form-wrap');
    if (loginForm) {
      tl.from(loginForm, { y: 28, opacity: 0, duration: 0.9 }, 0.35);
    }
    const loginImg = document.querySelector('.login-image');
    if (loginImg) {
      tl.from(loginImg, { opacity: 0, duration: 1.2 }, 0);
    }
  }

  /* ══════════════════════════════════════════
     5. SCROLL-TRIGGERED ANIMATIONS
  ══════════════════════════════════════════ */
  function initScrollAnimations() {
    /* Generic reveal */
    document.querySelectorAll('.reveal').forEach((el) => {
      gsap.from(el, {
        y: 30, opacity: 0, duration: 0.9, ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      });
    });

    /* Staggered children */
    document.querySelectorAll('.reveal-stagger').forEach((parent) => {
      const kids = Array.from(parent.children);
      if (!kids.length) return;
      gsap.from(kids, {
        y: 22, opacity: 0, duration: 0.8, ease: 'expo.out', stagger: 0.1,
        scrollTrigger: { trigger: parent, start: 'top 86%', once: true },
      });
    });

    /* Section titles */
    document.querySelectorAll('.section-title').forEach((el) => {
      gsap.from(el, {
        y: 36, opacity: 0, duration: 1, ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 87%', once: true },
      });
    });

    /* Card grids */
    document.querySelectorAll('.grid-cards, .admin-project-grid').forEach((grid) => {
      const cards = Array.from(grid.children);
      if (!cards.length) return;
      gsap.from(cards, {
        y: 28, opacity: 0, duration: 0.7, ease: 'expo.out', stagger: 0.09,
        scrollTrigger: { trigger: grid, start: 'top 88%', once: true },
      });
    });

    /* Pillar items */
    document.querySelectorAll('.pillars-cards').forEach((container) => {
      const items = Array.from(container.children);
      gsap.from(items, {
        y: 24, opacity: 0, duration: 0.75, ease: 'expo.out', stagger: 0.1,
        scrollTrigger: { trigger: container, start: 'top 85%', once: true },
      });
    });

    /* Pillars text */
    const pillarsLeft = document.querySelector('.pillars-grid > *:first-child');
    if (pillarsLeft) {
      gsap.from(pillarsLeft, {
        y: 40, opacity: 0, duration: 1, ease: 'expo.out',
        scrollTrigger: { trigger: pillarsLeft, start: 'top 82%', once: true },
      });
    }

    /* Hero stat counters */
    document.querySelectorAll('.hero-stat-value').forEach((el) => {
      const raw  = el.textContent.trim();
      const num  = parseFloat(raw.replace(/[^0-9.]+/g, ''));
      const sfx  = raw.replace(/^[\d.,\s]+/, '');
      if (!num || isNaN(num)) return;
      const obj = { val: 0 };
      gsap.to(obj, {
        val: num, duration: 2.2, ease: 'power3.out',
        onUpdate() { el.textContent = Math.round(obj.val).toLocaleString() + sfx; },
        scrollTrigger: { trigger: el, start: 'top 86%', once: true },
      });
    });

    /* Hero image gentle parallax */
    const heroWrap = document.querySelector('.hero-image-wrap');
    if (heroWrap) {
      gsap.to(heroWrap, {
        yPercent: -6, ease: 'none',
        scrollTrigger: {
          trigger: heroWrap,
          start: 'top bottom', end: 'bottom top',
          scrub: 1.8,
        },
      });
    }

    /* DB card grid */
    const dbGrid = document.querySelector('.db-grid');
    if (dbGrid) {
      const cards = Array.from(dbGrid.children);
      if (cards.length) {
        gsap.from(cards, {
          y: 24, opacity: 0, duration: 0.65, ease: 'expo.out', stagger: 0.08,
          scrollTrigger: { trigger: dbGrid, start: 'top 88%', once: true },
        });
      }
    }
  }

  /* ══════════════════════════════════════════
     6. PROP-GRID LIVE OBSERVER (dashboard cards load async)
  ══════════════════════════════════════════ */
  function watchPropertyGrid() {
    const grid = document.getElementById('propGrid');
    if (!grid) return;
    let animated = new WeakSet();
    const observer = new MutationObserver(() => {
      const newCards = Array.from(grid.querySelectorAll('.prop-card')).filter(c => !animated.has(c));
      if (!newCards.length) return;
      newCards.forEach(c => animated.add(c));
      gsap.from(newCards, { y: 18, opacity: 0, duration: 0.55, ease: 'expo.out', stagger: 0.06 });
    });
    observer.observe(grid, { childList: true });
  }

  /* ══════════════════════════════════════════
     7. STAT CARDS — watch for late injection
  ══════════════════════════════════════════ */
  function watchStatGrid() {
    const grid = document.querySelector('.stat-grid');
    if (!grid) return;
    let done = false;
    const observer = new MutationObserver(() => {
      if (done) return;
      const cards = grid.querySelectorAll('.stat-card');
      if (cards.length < 2) return;
      done = true;
      gsap.from(cards, { y: 16, opacity: 0, duration: 0.6, ease: 'expo.out', stagger: 0.07 });
      observer.disconnect();
    });
    observer.observe(grid, { childList: true, subtree: true });
  }

  /* ══════════════════════════════════════════
     8. REDUCED MOTION
  ══════════════════════════════════════════ */
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    gsap.globalTimeline.timeScale(100);
    lenis.destroy();
    return;
  }

  /* ══════════════════════════════════════════
     BOOTSTRAP
  ══════════════════════════════════════════ */
  onReady(function () {
    initNavbar();
    playEntrance();
    initScrollAnimations();
    watchPropertyGrid();
    watchStatGrid();
    ST.refresh();
  });

  /* ══════════════════════════════════════════
     PUBLIC API
  ══════════════════════════════════════════ */
  window.__anim = {
    fadeUp(els, opts) {
      return gsap.from(els, { y: 18, opacity: 0, duration: 0.7, ease: 'expo.out', ...(opts || {}) });
    },
    stagger(els, opts) {
      return gsap.from(els, { y: 18, opacity: 0, duration: 0.6, ease: 'expo.out', stagger: 0.08, ...(opts || {}) });
    },
    scrollTo(target, opts) {
      lenis.scrollTo(target, opts);
    },
  };
})();
