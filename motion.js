/* ============================================================
   Motion layer: Lenis smooth scrolling plus GSAP (ScrollTrigger,
   SplitText, DrawSVG) for the reveals, the sideways project
   gallery, the cursor, and the progress rail. If the CDN fails
   to load, the page still works without any of this.
   ============================================================ */
(function () {
  'use strict';

  var gsap = window.gsap, ST = window.ScrollTrigger;
  if (!gsap || !ST) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  gsap.registerPlugin(ST);
  var hasSplit = !!window.SplitText, hasDraw = !!window.DrawSVGPlugin;
  if (hasSplit) gsap.registerPlugin(window.SplitText);
  if (hasDraw) gsap.registerPlugin(window.DrawSVGPlugin);

  var root = document.documentElement;
  root.classList.add('has-motion');
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- Smooth scrolling ---------- */
  if (window.Lenis) {
    var lenis = new window.Lenis({ lerp: 0.09 });
    window.lenis = lenis;
    lenis.on('scroll', ST.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  /* ---------- Cursor ---------- */
  if (fine) {
    root.classList.add('has-cursor');
    var cur = document.querySelector('.cursor');
    var ring = cur.querySelector('.cursor__ring'), dot = cur.querySelector('.cursor__dot');
    gsap.set([ring, dot], { xPercent: -50, yPercent: -50, x: -100, y: -100 });
    var rx = gsap.quickTo(ring, 'x', { duration: 0.5, ease: 'power3' });
    var ry = gsap.quickTo(ring, 'y', { duration: 0.5, ease: 'power3' });
    var dx = gsap.quickTo(dot, 'x', { duration: 0.1, ease: 'power3' });
    var dy = gsap.quickTo(dot, 'y', { duration: 0.1, ease: 'power3' });
    window.addEventListener('pointermove', function (e) { rx(e.clientX); ry(e.clientY); dx(e.clientX); dy(e.clientY); }, { passive: true });
    document.addEventListener('pointerover', function (e) {
      cur.classList.toggle('is-hover', !!e.target.closest('a, button, .project, .app-icon'));
    });

    // Buttons lean toward the pointer.
    document.querySelectorAll('.pill, .nav__links a, .project__link').forEach(function (el) {
      var xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3' });
      var yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3' });
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * 0.25);
        yTo((e.clientY - (r.top + r.height / 2)) * 0.35);
      });
      el.addEventListener('pointerleave', function () { xTo(0); yTo(0); });
    });
  }

  /* ---------- Headings reveal letter by letter ---------- */
  if (hasSplit) {
    document.querySelectorAll('.block h2, .contact__big, .contact__small').forEach(function (el) {
      var split = window.SplitText.create(el, { type: 'words,chars', mask: 'words' });
      gsap.from(split.chars, {
        yPercent: 110, duration: 1, ease: 'expo.out', stagger: 0.022,
        scrollTrigger: { trigger: el, start: 'top 88%', once: true }
      });
    });
  }
  gsap.utils.toArray('.block__kicker').forEach(function (el) {
    gsap.from(el, { opacity: 0, x: -24, duration: 0.8, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
  });

  /* ---------- Experience ---------- */
  gsap.utils.toArray('.job').forEach(function (job) {
    var tl = gsap.timeline({ scrollTrigger: { trigger: job, start: 'top 88%', once: true } });
    tl.from(job, { y: 46, opacity: 0, duration: 0.9, ease: 'power3.out', clearProps: 'transform,opacity' })
      .from(job.querySelectorAll('.tags li'), { y: 10, opacity: 0, duration: 0.5, stagger: 0.05, ease: 'power2.out' }, '-=0.5');
  });
  gsap.to('.jobs__line span', {
    scaleY: 1, ease: 'none',
    scrollTrigger: { trigger: '.jobs', start: 'top 75%', end: 'bottom 55%', scrub: true }
  });

  /* ---------- Karana numbers count up ---------- */
  var build = document.getElementById('karana');
  if (build) {
    var figs = build.querySelectorAll('.figures dd');
    var targets = Array.prototype.map.call(figs, function (dd) {
      var t = dd.textContent.trim();
      var m = t.match(/^(\$?)([\d,.]+)(\D*)$/);
      return m ? { el: dd, pre: m[1], val: parseFloat(m[2].replace(/,/g, '')), dec: (m[2].split('.')[1] || '').length, suf: m[3], comma: m[2].indexOf(',') > -1 } : null;
    }).filter(Boolean);
    ST.create({
      trigger: build,
      start: function () { return 'top+=' + Math.round(0.18 * (build.offsetHeight - window.innerHeight)) + ' top'; },
      once: true,
      onEnter: function () {
        targets.forEach(function (T) {
          var o = { v: 0 };
          gsap.to(o, {
            v: T.val, duration: 1.6, ease: 'power3.out',
            onUpdate: function () {
              var n = T.dec ? o.v.toFixed(T.dec) : Math.round(o.v);
              if (T.comma) n = Number(n).toLocaleString('en-US');
              T.el.textContent = T.pre + n + T.suf;
            }
          });
        });
      }
    });
    gsap.to('.app-icon img', { y: -10, rotate: 1.5, duration: 2.6, ease: 'sine.inOut', yoyo: true, repeat: -1 });
  }

  /* ---------- Projects ---------- */
  function drawParts(card) {
    return card.querySelectorAll('.project__art path, .project__art circle, .project__art rect');
  }
  var mm = gsap.matchMedia();

  // Wide screens: pin the section and slide the cards sideways.
  mm.add('(min-width: 1000px) and (min-height: 700px)', function () {
    var sec = document.getElementById('projects');
    var track = sec.querySelector('.projects');
    sec.classList.add('is-gallery');
    function dist() {
      return Math.max(0, track.scrollWidth - (window.innerWidth - track.getBoundingClientRect().left) + 48);
    }
    var tween = gsap.to(track, { x: function () { return -dist(); }, ease: 'none' });
    ST.create({
      trigger: sec, start: 'top top+=40', end: function () { return '+=' + dist(); },
      pin: true, scrub: 0.6, animation: tween, invalidateOnRefresh: true, anticipatePin: 1
    });
    sec.querySelectorAll('.project').forEach(function (card) {
      var st = { trigger: card, containerAnimation: tween, start: 'left 92%', once: true };
      if (hasDraw) gsap.from(drawParts(card), { drawSVG: 0, duration: 1.6, ease: 'power2.inOut', stagger: 0.035, scrollTrigger: st });
      gsap.from(card, { y: 50, opacity: 0, rotate: 1.5, duration: 1, ease: 'power3.out', clearProps: 'transform,opacity', scrollTrigger: st });
    });
    return function () { sec.classList.remove('is-gallery'); gsap.set(track, { clearProps: 'transform' }); };
  });

  // Narrow screens: cards rise in as you scroll down.
  mm.add('(max-width: 999px), (max-height: 699px)', function () {
    document.querySelectorAll('.project').forEach(function (card) {
      var st = { trigger: card, start: 'top 88%', once: true };
      if (hasDraw) gsap.from(drawParts(card), { drawSVG: 0, duration: 1.6, ease: 'power2.inOut', stagger: 0.035, scrollTrigger: st });
      gsap.from(card, { y: 40, opacity: 0, duration: 0.9, ease: 'power3.out', clearProps: 'transform,opacity', scrollTrigger: st });
    });
  });

  /* ---------- Awards and contact ---------- */
  gsap.utils.toArray('.plain li').forEach(function (li, i) {
    gsap.from(li, { x: -30, opacity: 0, duration: 0.8, delay: (i % 5) * 0.06, ease: 'power3.out', scrollTrigger: { trigger: li, start: 'top 92%', once: true } });
  });
  gsap.from('.contact__body, .contact__actions', {
    y: 30, opacity: 0, duration: 0.9, stagger: 0.12, ease: 'power3.out',
    scrollTrigger: { trigger: '.contact__actions', start: 'top 92%', once: true }
  });

  /* ---------- Progress rail and nav ---------- */
  gsap.to('.rail__fill', { scaleY: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });
  var nav = document.querySelector('.nav');
  ST.create({
    start: 0, end: 'max',
    onUpdate: function (self) {
      if (self.scroll() < 240 || root.classList.contains('menu-open')) nav.classList.remove('is-hidden');
      else nav.classList.toggle('is-hidden', self.direction === 1);
    }
  });

  // Fonts change line lengths, so measure again once they load.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ST.refresh(); });
  window.addEventListener('load', function () { ST.refresh(); });
})();
