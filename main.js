/* ============================================================
   Motion + haptics layer
   ============================================================ */
(function () {
  'use strict';

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- Footer year ---------- */
  const yr = document.getElementById('year');
  if (yr) yr.textContent = new Date().getFullYear();

  /* ---------- Haptics (real device vibration where supported) ---------- */
  const canVibrate = 'vibrate' in navigator;
  function haptic(pattern) {
    if (canVibrate && !reduce) {
      try { navigator.vibrate(pattern); } catch (e) {}
    }
  }
  // Light tap on any interactive press; firmer buzz on button/card press.
  document.addEventListener('pointerdown', function (e) {
    const t = e.target.closest('a, button, .card, [data-cursor]');
    if (!t) return;
    haptic(t.matches('.btn, .card, .nav__resume') ? 12 : 6);
  }, { passive: true });

  /* ---------- Custom cursor ---------- */
  if (canHover && !reduce) {
    const ring = document.querySelector('.cursor');
    const dot = document.querySelector('.cursor-dot');
    let mx = window.innerWidth / 2, my = window.innerHeight / 2;
    let rx = mx, ry = my;

    window.addEventListener('pointermove', function (e) {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%, -50%)`;
    }, { passive: true });

    (function loop() {
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`;
      requestAnimationFrame(loop);
    })();

    document.querySelectorAll('a, button, [data-cursor], .card').forEach(function (el) {
      el.addEventListener('pointerenter', () => ring.classList.add('is-hover'));
      el.addEventListener('pointerleave', () => ring.classList.remove('is-hover'));
    });
    window.addEventListener('pointerdown', () => ring.classList.add('is-down'));
    window.addEventListener('pointerup', () => ring.classList.remove('is-down'));
  }

  /* ---------- Magnetic buttons ---------- */
  if (canHover && !reduce) {
    document.querySelectorAll('.magnetic').forEach(function (el) {
      const strength = 0.35;
      el.addEventListener('pointermove', function (e) {
        const r = el.getBoundingClientRect();
        const x = e.clientX - (r.left + r.width / 2);
        const y = e.clientY - (r.top + r.height / 2);
        el.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
      });
      el.addEventListener('pointerleave', function () {
        el.style.transform = 'translate(0, 0)';
      });
    });
  }

  /* ---------- 3D tilt on project cards ---------- */
  if (canHover && !reduce) {
    document.querySelectorAll('[data-tilt]').forEach(function (card) {
      const max = 7;
      card.addEventListener('pointermove', function (e) {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform =
          `perspective(900px) rotateY(${px * max}deg) rotateX(${-py * max}deg) translateY(-4px)`;
      });
      card.addEventListener('pointerleave', function () {
        card.style.transform = '';
      });
    });
  }

  /* ---------- Split hero name into animated lines ---------- */
  const nameEl = document.querySelector('[data-splitlines]');
  if (nameEl) {
    const parts = nameEl.textContent.trim().split(/\s+/);
    nameEl.innerHTML = parts
      .map((w) => `<span class="line"><span>${w}</span></span>`)
      .join(' ');
    requestAnimationFrame(() => document.querySelector('.hero').classList.add('is-in'));
  }

  /* ---------- Reveal on scroll ---------- */
  const revealEls = document.querySelectorAll('[data-reveal]');
  if (reduce) {
    revealEls.forEach((el) => el.classList.add('is-visible'));
  } else {
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        const delay = parseInt(e.target.dataset.revealDelay || '0', 10);
        setTimeout(() => e.target.classList.add('is-visible'), delay);
        io.unobserve(e.target);
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });
    revealEls.forEach((el) => io.observe(el));
  }

  /* ---------- Animated stat counters ---------- */
  function animateCount(el) {
    const target = parseFloat(el.dataset.count);
    const suffix = el.dataset.suffix || '';
    if (reduce) { el.textContent = format(target) + suffix; return; }
    const dur = 1400;
    const start = performance.now();
    function tick(now) {
      const p = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = format(Math.round(target * eased)) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  function format(n) {
    return n >= 1000 ? n.toLocaleString('en-US') : String(n);
  }
  const countEls = document.querySelectorAll('[data-count]');
  const countIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      animateCount(e.target);
      countIO.unobserve(e.target);
    });
  }, { threshold: 0.6 });
  countEls.forEach((el) => countIO.observe(el));

  /* ---------- Scroll progress + nav state ---------- */
  const progress = document.querySelector('.scroll-progress');
  const nav = document.querySelector('.nav');
  let ticking = false;
  function onScroll() {
    const h = document.documentElement;
    const scrolled = h.scrollTop / (h.scrollHeight - h.clientHeight || 1);
    if (progress) progress.style.transform = `scaleX(${scrolled})`;
    if (nav) nav.classList.toggle('is-scrolled', h.scrollTop > 20);
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });
  onScroll();

  /* ---------- Subtle hero parallax ---------- */
  if (!reduce) {
    const heroName = document.querySelector('.hero__name');
    const heroTag = document.querySelector('.hero__tagline');
    window.addEventListener('scroll', function () {
      const y = window.scrollY;
      if (y < window.innerHeight) {
        if (heroName) heroName.style.transform = `translateY(${y * 0.12}px)`;
        if (heroTag) heroTag.style.transform = `translateY(${y * 0.06}px)`;
      }
    }, { passive: true });
  }
})();
