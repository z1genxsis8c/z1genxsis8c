/* ============================================================
   home.js — динамика на главной (обложка)
   ============================================================ */

(function () {
  const statsEl = document.getElementById("cover-stats");
  if (!statsEl || typeof POSTS === "undefined") return;

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

  let totalViews = 0;
  let totalLikes = 0;

  allPosts.forEach((p) => {
    totalViews += p.views || 0;
    const r = reactions[p.id];
    totalLikes += (p.likes || 0) + (r === "like" ? 1 : 0);
  });

  function short(n) {
    if (n < 1000) return String(n);
    if (n < 1000000) return (n / 1000).toFixed(1).replace(".0", "") + "k";
    return (n / 1000000).toFixed(1).replace(".0", "") + "M";
  }

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
})();
