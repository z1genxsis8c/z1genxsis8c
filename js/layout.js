/* ============================================================
   layout.js — навбар + футер
   ============================================================ */

(function () {
  const CONFIG = {
    name: "z1genxsis8c",
    navLinks: [
      { href: "index.html", label: "Главная" },
      { href: "posts.html", label: "Посты" },
      { href: "suggestions.html", label: "Предложка" },
      { href: "messages.html", label: "Сообщения" },
    ],
    footerNote:
      "Личное место для кода, игр, историй и всего, чем хочется поделиться.",
  };

  const currentPage = (() => {
    const path = window.location.pathname.split("/").pop() || "index.html";
    return path === "" ? "index.html" : path;
  })();

  const logoHTML = `
    <span class="logo-mark" aria-hidden="true">z</span>
    <span class="logo-text">${CONFIG.name}</span>
  `;

  const navHTML = `
    <header class="nav" id="nav">
      <div class="nav-inner">
        <a href="index.html" class="logo" aria-label="${CONFIG.name} — на главную">${logoHTML}</a>
        <div class="nav-right">
          <nav aria-label="Основная навигация">
            <ul class="nav-links" id="nav-links">
              ${CONFIG.navLinks
                .map(
                  (link) => `
                <li>
                  <a href="${link.href}"
                     class="${link.href === currentPage ? "active" : ""}"
                     ${link.href === currentPage ? 'aria-current="page"' : ""}>
                    ${link.label}
                  </a>
                </li>`,
                )
                .join("")}
            </ul>
          </nav>
          <div class="nav-auth" id="nav-auth"></div>
          <button class="nav-burger" id="nav-burger" type="button"
                  aria-label="Меню" aria-expanded="false" aria-controls="nav-links">
            <svg class="icon-open" width="18" height="18" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/>
            </svg>
            <svg class="icon-close" width="18" height="18" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
            </svg>
          </button>
        </div>
      </div>
    </header>
  `;

  const year = new Date().getFullYear();
  const footerHTML = `
    <footer class="footer">
      <div class="footer-inner">
        <div class="footer-brand">
          <a href="index.html" class="logo">${logoHTML}</a>
          <p class="footer-note">${CONFIG.footerNote}</p>
        </div>
        <ul class="footer-links">
          ${CONFIG.navLinks
            .map((link) => `<li><a href="${link.href}">${link.label}</a></li>`)
            .join("")}
        </ul>
        <p class="footer-copy">© ${year} ${CONFIG.name}</p>
      </div>
    </footer>
  `;

  const navSlot = document.getElementById("site-nav");
  const footerSlot = document.getElementById("site-footer");
  if (navSlot) navSlot.outerHTML = navHTML;
  if (footerSlot) footerSlot.outerHTML = footerHTML;

  /* ---------- Мобильное меню ---------- */
  const nav = document.getElementById("nav");
  const burger = document.getElementById("nav-burger");
  if (!nav || !burger) return;

  const setOpen = (open) => {
    nav.classList.toggle("menu-open", open);
    burger.setAttribute("aria-expanded", String(open));
  };

  burger.addEventListener("click", (e) => {
    e.stopPropagation();
    setOpen(!nav.classList.contains("menu-open"));
  });
  document.addEventListener("click", (e) => {
    if (nav.classList.contains("menu-open") && !nav.contains(e.target)) {
      setOpen(false);
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && nav.classList.contains("menu-open")) {
      setOpen(false);
      burger.focus();
    }
  });
  window.addEventListener("resize", () => {
    if (window.innerWidth > 860) setOpen(false);
  });
})();
