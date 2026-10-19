/* ============================================================
   home.js — динамика на главной: статистика и свежие посты
   ============================================================ */

(function () {
  if (typeof POSTS === "undefined") return;

  const CATEGORIES = {
    code: { label: "Код", icon: "</>", color: "var(--c-code)" },
    game: { label: "Игры", icon: "🎮", color: "var(--c-game)" },
    story: { label: "Рассказы", icon: "✎", color: "var(--c-story)" },
  };

  const KEY = "posts-reactions";
  let reactions = {};
  try {
    reactions = JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {}

  const customPosts =
    window.Auth && window.Auth.getCustomPosts
      ? window.Auth.getCustomPosts()
      : [];
  const removedIds =
    window.Auth && window.Auth.getRemovedPostIds
      ? window.Auth.getRemovedPostIds()
      : [];
  const allPosts = [...customPosts, ...POSTS].filter(
    (p) => !removedIds.includes(p.id),
  );

  function escapeHTML(str) {
    return String(str == null ? "" : str).replace(
      /[&<>"']/g,
      (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  }

  function short(n) {
    if (n < 1000) return String(n);
    if (n < 1000000) return (n / 1000).toFixed(1).replace(".0", "") + "k";
    return (n / 1000000).toFixed(1).replace(".0", "") + "M";
  }

  function toDate(p) {
    const d = new Date(p.date || p.createdAt || 0);
    return isNaN(d.getTime()) ? new Date(0) : d;
  }

  /* ---------- Статистика ---------- */
  const statsEl = document.getElementById("cover-stats");
  if (statsEl) {
    let totalViews = 0;
    let totalLikes = 0;
    allPosts.forEach((p) => {
      totalViews += p.views || 0;
      const r = reactions[p.id];
      totalLikes += (p.likes || 0) + (r === "like" ? 1 : 0);
    });

    statsEl.innerHTML = `
      <div class="cover-stat">
        <span class="cover-stat-value">${allPosts.length}</span>
        <span class="cover-stat-label">постов</span>
      </div>
      <div class="cover-stat">
        <span class="cover-stat-value">${short(totalViews)}</span>
        <span class="cover-stat-label">просмотров</span>
      </div>
      <div class="cover-stat">
        <span class="cover-stat-value">${short(totalLikes)}</span>
        <span class="cover-stat-label">лайков</span>
      </div>
    `;
  }

  /* ---------- Свежие посты ---------- */
  const latestEl = document.getElementById("home-latest");
  if (latestEl) {
    const latest = [...allPosts]
      .sort((a, b) => toDate(b) - toDate(a))
      .slice(0, 3);

    if (!latest.length) {
      latestEl.innerHTML =
        '<p class="home-posts-empty">Постов пока нет, но скоро появятся.</p>';
      return;
    }

    latestEl.innerHTML = latest
      .map((p) => {
        const cat = CATEGORIES[p.category] || CATEGORIES.story;
        const d = toDate(p);
        const dateText = d.getTime()
          ? d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })
          : "";
        return `
          <a class="home-post" href="posts.html" style="--accent: ${cat.color}">
            <span class="home-post-cat">
              <span aria-hidden="true">${escapeHTML(cat.icon)}</span>${cat.label}
            </span>
            <h3>${escapeHTML(p.title)}</h3>
            <p>${escapeHTML(p.excerpt)}</p>
            <span class="home-post-meta">
              ${dateText ? `<span>${dateText}</span>` : ""}
              <span>${short(p.views || 0)} просмотров</span>
            </span>
          </a>
        `;
      })
      .join("");
  }
})();
