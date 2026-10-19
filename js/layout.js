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
    footerNote: "Сделано с любовью к тёмно-фиолетовому.",
  };

  const currentPage = (() => {
    const path = window.location.pathname.split("/").pop() || "index.html";
    return path === "" ? "index.html" : path;
  })();

  const navHTML = `
    <nav class="nav" id="nav">
      <a href="index.html" class="logo">✦ ${CONFIG.name}</a>
      <div class="nav-right">
        <ul class="nav-links">
          ${CONFIG.navLinks
            .map(
              (link) => `
            <li>
              <a href="${link.href}"
                 class="${link.href === currentPage ? "active" : ""}">
                ${link.label}
              </a>
            </li>
          `,
            )
            .join("")}
        </ul>
        <div class="nav-auth" id="nav-auth"></div>
      </div>
    </nav>
  `;

  const year = new Date().getFullYear();
  const footerHTML = `
    <footer class="footer">
      <p>© ${year} ${CONFIG.name}. ${CONFIG.footerNote}</p>
    </footer>
  `;

  const navSlot = document.getElementById("site-nav");
  const footerSlot = document.getElementById("site-footer");
  if (navSlot) navSlot.outerHTML = navHTML;
  if (footerSlot) footerSlot.outerHTML = footerHTML;
})();
