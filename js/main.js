/* ============================================================
   main.js — общие скрипты
   ============================================================ */

(function () {
  /* ---------- Навбар: класс .scrolled ---------- */
  const nav = document.getElementById("nav");
  if (nav) {
    const onScroll = () =>
      nav.classList.toggle("scrolled", window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---------- Reveal-анимация ---------- */
  const revealEls = document.querySelectorAll(".reveal");
  if (revealEls.length) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 },
    );
    revealEls.forEach((el) => io.observe(el));
  }

  /* ---------- Плавный якорный скролл ---------- */
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (e) => {
      const id = link.getAttribute("href");
      if (id.length > 1) {
        const target = document.querySelector(id);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    });
  });

  /* ---------- Кнопка "Наверх" ---------- */
  (function () {
    const btn = document.createElement("button");
    btn.className = "scroll-top";
    btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>`;
    btn.setAttribute("aria-label", "Наверх");
    document.body.appendChild(btn);

    const onScroll = () =>
      btn.classList.toggle("visible", window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    btn.addEventListener("click", () =>
      window.scrollTo({ top: 0, behavior: "smooth" }),
    );
  })();
})();
