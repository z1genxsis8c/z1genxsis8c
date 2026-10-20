/* ============================================================
   posts-page.js — рендер постов, поиск, фильтры, сортировка,
   создание постов, редактирование, комментарии, реакции, закладки
   ============================================================ */

(async function () {
  const CATEGORIES = {
    code: {
      label: "Программирование",
      short: "Код",
      icon: "</>",
      color: "var(--c-code)",
    },
    game: { label: "Игры", short: "Игры", icon: "🎮", color: "var(--c-game)" },
    story: {
      label: "Рассказы",
      short: "Рассказы",
      icon: "✎",
      color: "var(--c-story)",
    },
  };

  const KEY = "posts-reactions";
  const VIEWED_KEY = "posts-viewed";

  const feedEl = document.getElementById("posts-feed");
  const filtersEl = document.getElementById("filters");
  const emptyEl = document.getElementById("empty-state");
  const modalEl = document.getElementById("modal");
  const modalBody = document.getElementById("modal-body");
  const searchEl = document.getElementById("search");
  const clearEl = document.getElementById("search-clear");
  const sortEl = document.getElementById("sort");

  const createBtn = document.getElementById("create-post-btn");
  const createModal = document.getElementById("create-post-modal");
  const createForm = document.getElementById("create-post-form");
  const postMsg = document.getElementById("post-msg");

  const editModal = document.getElementById("edit-post-modal");
  const editForm = document.getElementById("edit-post-form");
  const editMsg = document.getElementById("edit-post-msg");

  if (!feedEl) return;

  let currentFilter = "all";
  let currentSort = "new";
  let currentSearch = "";
  let currentTag = null;
  let editingPostId = null;
  let cachedPosts = []; // Здесь храним посты, загруженные из БД

  /* ---------- Реакции (пока локально) ---------- */
  function loadReactions() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || "{}");
    } catch {
      return {};
    }
  }
  function saveReactions(r) {
    localStorage.setItem(KEY, JSON.stringify(r));
  }
  let reactions = loadReactions();

  function getCounts(post) {
    const r = reactions[post.id];
    return {
      likes: (post.likes || 0) + (r === "like" ? 1 : 0),
      dislikes: (post.dislikes || 0) + (r === "dislike" ? 1 : 0),
      views: post.views || 0,
      userReaction: r || null,
    };
  }
  function setReaction(id, type) {
    const current = reactions[id];
    if (current === type) delete reactions[id];
    else reactions[id] = type;
    saveReactions(reactions);
    renderFeed();
  }

  /* ---------- Просмотры (локально) ---------- */
  function loadViewed() {
    try {
      return new Set(JSON.parse(localStorage.getItem(VIEWED_KEY) || "[]"));
    } catch {
      return new Set();
    }
  }
  function saveViewed(s) {
    localStorage.setItem(VIEWED_KEY, JSON.stringify([...s]));
  }
  let viewed = loadViewed();
  function bumpViews(post) {
    if (viewed.has(post.id)) return;
    viewed.add(post.id);
    saveViewed(viewed);
    post.views = (post.views || 0) + 1;
  }

  /* ---------- Утилиты ---------- */
  function formatDate(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
  function escapeHTML(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function numberShort(n) {
    if (n < 1000) return String(n);
    if (n < 1000000) return (n / 1000).toFixed(1).replace(".0", "") + "k";
    return (n / 1000000).toFixed(1).replace(".0", "") + "M";
  }
  function avatarHTML(author) {
    if (author.avatar)
      return `<img src="${author.avatar}" alt="" class="author-avatar" />`;
    const letter = (author.name || "?").charAt(0).toUpperCase();
    return `<span class="author-avatar author-avatar-letter">${letter}</span>`;
  }
  function isAuthorMe(post) {
    const me = window.Auth && window.Auth.getCurrentUser();
    if (!me) return false;
    return me.username.toLowerCase() === (post.author.name || "").toLowerCase();
  }
  function commentCount(postId) {
    // Пока возвращаем 0, так как комментарии подгружаются внутри модалки
    // В идеале нужно добавить count в getAllPosts, но для простоты пока так
    return 0;
  }

  /* ---------- Фильтры ---------- */
  function renderFilters() {
    const counts = { all: cachedPosts.length };
    cachedPosts.forEach((p) => {
      counts[p.category] = (counts[p.category] || 0) + 1;
    });
    const bookmarksCount = window.Auth.getBookmarks
      ? window.Auth.getBookmarks().length
      : 0;
    counts.bookmarks = bookmarksCount;

    const items = [
      { key: "all", label: "Всё", icon: "◈" },
      ...Object.entries(CATEGORIES).map(([k, v]) => ({
        key: k,
        label: v.short,
        icon: v.icon,
      })),
      { key: "bookmarks", label: "Закладки", icon: "🔖" },
    ];

    filtersEl.innerHTML = items
      .filter(
        (item) =>
          item.key === "all" ||
          item.key === "bookmarks" ||
          counts[item.key] > 0,
      )
      .map(
        (item) => `
        <button class="filter-btn ${item.key === currentFilter ? "active" : ""}" data-filter="${item.key}">
          <span class="f-icon">${item.icon}</span>
          <span class="f-label">${item.label}</span>
          <span class="f-count">${counts[item.key] || 0}</span>
        </button>
      `,
      )
      .join("");

    filtersEl.querySelectorAll(".filter-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        currentFilter = btn.dataset.filter;
        currentTag = null;
        renderFilters();
        renderFeed();
        renderTagBanner();
      });
    });
  }

  /* ---------- Карточка ---------- */
  function cardHTML(post) {
    const cat = CATEGORIES[post.category] || CATEGORIES.story;
    const c = getCounts(post);
    const showReport = !isAuthorMe(post);
    const cCount = commentCount(post.id);
    const bookmarked = window.Auth.isBookmarked
      ? window.Auth.isBookmarked(post.id)
      : false;

    return `
      <article class="post-card" data-id="${post.id}" style="--accent: ${cat.color}">
        <div class="post-head">
          <div class="author">
            ${avatarHTML(post.author)}
            <div class="author-info">
              <span class="author-name">${escapeHTML(post.author.name)}</span>
              <time class="post-date">${formatDate(post.date)}</time>
            </div>
          </div>
          <span class="post-category">
            <span class="c-icon">${cat.icon}</span>${cat.short}
          </span>
        </div>

        <h3 class="post-title">${escapeHTML(post.title)}</h3>

        ${post.image ? `<div class="post-image"><img src="${post.image}" alt="" loading="lazy" /></div>` : ""}

        <p class="post-excerpt">${escapeHTML(post.excerpt)}</p>

        ${
          post.tags && post.tags.length
            ? `<div class="post-tags">${post.tags.map((t) => `<button type="button" class="tag" data-tag="${escapeHTML(t)}">#${escapeHTML(t)}</button>`).join("")}</div>`
            : ""
        }

        <footer class="post-foot">
          <div class="reactions" data-id="${post.id}">
            <button class="react-btn like ${c.userReaction === "like" ? "active" : ""}" data-react="like" aria-label="Нравится">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="${c.userReaction === "like" ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M7 10v12"/><path d="M15 5.88L14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88z"/>
              </svg>
              <span>${numberShort(c.likes)}</span>
            </button>
            <button class="react-btn dislike ${c.userReaction === "dislike" ? "active" : ""}" data-react="dislike" aria-label="Не нравится">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="${c.userReaction === "dislike" ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 14V2"/><path d="M9 18.12L10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88z"/>
              </svg>
              <span>${numberShort(c.dislikes)}</span>
            </button>
          </div>

          <div class="post-foot-right">
            <span class="post-meta-item" title="Комментарии">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              ${numberShort(cCount)}
            </span>
            <span class="post-meta-item" title="Просмотры">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              ${numberShort(c.views)}
            </span>
            <button class="post-bookmark-btn ${bookmarked ? "active" : ""}" data-bookmark="${post.id}" aria-label="В закладки" title="В закладки">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="${bookmarked ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            </button>
            ${
              showReport
                ? `
              <button class="post-report-btn" data-report="${post.id}" aria-label="Пожаловаться" title="Пожаловаться">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </button>`
                : ""
            }
          </div>
        </footer>
      </article>
    `;
  }

  /* ---------- Лента ---------- */
  function getVisiblePosts() {
    let list = [...cachedPosts];

    if (currentFilter === "bookmarks") {
      const bm = window.Auth.getBookmarks ? window.Auth.getBookmarks() : [];
      list = list.filter((p) => bm.includes(p.id));
    } else if (currentFilter !== "all") {
      list = list.filter((p) => p.category === currentFilter);
    }

    if (currentSearch.trim()) {
      const q = currentSearch.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.excerpt.toLowerCase().includes(q) ||
          p.author.name.toLowerCase().includes(q) ||
          (p.tags || []).some((t) => t.toLowerCase().includes(q)),
      );
    }

    if (currentTag) {
      list = list.filter((p) =>
        (p.tags || []).some(
          (t) => t.toLowerCase() === currentTag.toLowerCase(),
        ),
      );
    }

    if (currentSort === "new") {
      list.sort((a, b) => new Date(b.date) - new Date(a.date));
    } else if (currentSort === "popular") {
      list.sort((a, b) => {
        const cA = getCounts(a),
          cB = getCounts(b);
        return cB.likes - cB.dislikes - (cA.likes - cA.dislikes);
      });
    } else if (currentSort === "views") {
      list.sort((a, b) => (b.views || 0) - (a.views || 0));
    }
    return list;
  }

  function renderFeed() {
    const list = getVisiblePosts();

    if (!list.length) {
      feedEl.innerHTML = "";
      emptyEl.hidden = false;
      return;
    }
    emptyEl.hidden = true;
    feedEl.innerHTML = list.map(cardHTML).join("");

    feedEl.querySelectorAll(".post-card").forEach((card) => {
      card.addEventListener("click", (e) => {
        if (
          e.target.closest(".react-btn") ||
          e.target.closest(".post-report-btn") ||
          e.target.closest(".post-bookmark-btn") ||
          e.target.closest(".tag")
        )
          return;
        const post = cachedPosts.find((p) => p.id === card.dataset.id);
        if (post) openModal(post);
      });
    });

    feedEl.querySelectorAll(".react-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.closest(".reactions").dataset.id;
        setReaction(id, btn.dataset.react);
      });
    });

    feedEl.querySelectorAll("[data-bookmark]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!window.Auth.getCurrentUser()) {
          window.Toast.info("Войди, чтобы сохранять посты");
          return;
        }
        const res = window.Auth.toggleBookmark(btn.dataset.bookmark);
        if (res.ok) {
          btn.classList.toggle("active", res.bookmarked);
          btn
            .querySelector("svg")
            .setAttribute("fill", res.bookmarked ? "currentColor" : "none");
          if (window.Toast)
            window.Toast.success(
              res.bookmarked ? "Сохранено" : "Убрано из закладок",
            );
          renderFilters();
        }
      });
    });

    feedEl.querySelectorAll(".post-report-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const post = cachedPosts.find((p) => p.id === btn.dataset.report);
        if (!post || !window.ReportModal) return;
        window.ReportModal.open({
          type: "post",
          targetId: post.id,
          targetUserId: post.author_id,
          targetTitle: post.title,
        });
      });
    });

    feedEl.querySelectorAll(".tag[data-tag]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        currentTag = btn.dataset.tag;
        currentFilter = "all";
        currentSearch = "";
        if (searchEl) searchEl.value = "";
        if (clearEl) clearEl.hidden = true;
        renderFilters();
        renderFeed();
        renderTagBanner();
      });
    });
  }

  function renderTagBanner() {
    let banner = document.getElementById("tag-filter-banner");
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "tag-filter-banner";
      banner.className = "tag-filter-banner";
      if (feedEl && feedEl.parentNode)
        feedEl.parentNode.insertBefore(banner, feedEl);
    }
    if (!banner) return;
    if (currentTag) {
      banner.hidden = false;
      banner.innerHTML = `<span>Фильтр по тегу: <b>#${escapeHTML(currentTag)}</b></span><button id="clear-tag-btn" aria-label="Сбросить">×</button>`;
      document
        .getElementById("clear-tag-btn")
        ?.addEventListener("click", () => {
          currentTag = null;
          renderTagBanner();
          renderFeed();
        });
    } else {
      banner.hidden = true;
      banner.innerHTML = "";
    }
  }

  /* ---------- Модалка просмотра ---------- */
  function openModal(post) {
    const cat = CATEGORIES[post.category] || CATEGORIES.story;
    bumpViews(post);
    renderFeed();

    const c = getCounts(post);
    const showReport = !isAuthorMe(post);
    const me = window.Auth.getCurrentUser();
    const isStaff = me && window.Auth.isStaff(me);
    const canDelete = isStaff || isAuthorMe(post);
    const canEdit = isAuthorMe(post) || isStaff;

    modalBody.innerHTML = `
      <header class="modal-header">
        <div class="author">
          ${avatarHTML(post.author)}
          <div class="author-info">
            <span class="author-name">${escapeHTML(post.author.name)}</span>
            <time class="post-date">${formatDate(post.date)}</time>
          </div>
        </div>
        <span class="post-category" style="--accent: ${cat.color}">
          <span class="c-icon">${cat.icon}</span>${cat.label}
        </span>
      </header>

      <h2 class="modal-title">${escapeHTML(post.title)}</h2>

      ${post.image ? `<div class="modal-image"><img src="${post.image}" alt="" /></div>` : ""}

      <div class="modal-text">${post.body}</div>

      ${
        post.tags && post.tags.length
          ? `<div class="post-tags">${post.tags.map((t) => `<button type="button" class="tag" data-tag="${escapeHTML(t)}">#${escapeHTML(t)}</button>`).join("")}</div>`
          : ""
      }

      <div class="modal-meta-row">
        <button class="react-btn like ${c.userReaction === "like" ? "active" : ""}" data-react="like" data-id="${post.id}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="${c.userReaction === "like" ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v12"/><path d="M15 5.88L14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88z"/></svg>
          <span>${numberShort(c.likes)}</span>
        </button>
        <button class="react-btn dislike ${c.userReaction === "dislike" ? "active" : ""}" data-react="dislike" data-id="${post.id}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="${c.userReaction === "dislike" ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 14V2"/><path d="M9 18.12L10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88z"/></svg>
          <span>${numberShort(c.dislikes)}</span>
        </button>
        <span class="post-meta-item post-meta-item-lg">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          ${numberShort(c.views)}
        </span>
        ${
          showReport
            ? `
          <button class="post-report-btn post-report-btn-lg" data-report-modal="${post.id}" aria-label="Пожаловаться">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </button>`
            : ""
        }
        ${canEdit ? `<button class="btn-delete" id="edit-this-post" data-id="${post.id}" style="background: rgba(139,92,246,0.1); border-color: rgba(139,92,246,0.3); color: var(--purple-bright);">✏️ Редактировать</button>` : ""}
        ${canDelete ? `<button class="btn-delete" id="delete-this-post" data-id="${post.id}">Удалить</button>` : ""}
      </div>

      <div id="comments-container" class="comments-container"></div>
    `;

    modalBody.querySelectorAll(".react-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        setReaction(post.id, btn.dataset.react);
        const fresh = cachedPosts.find((p) => p.id === post.id);
        if (!fresh) return;
        const cc = getCounts(fresh);
        modalBody.querySelectorAll(".react-btn").forEach((b) => {
          const isLike = b.dataset.react === "like";
          const active =
            (isLike && cc.userReaction === "like") ||
            (!isLike && cc.userReaction === "dislike");
          b.classList.toggle("active", active);
          b.querySelector("span").textContent = numberShort(
            isLike ? cc.likes : cc.dislikes,
          );
          const path = b.querySelector("svg path");
          if (path) path.setAttribute("fill", active ? "currentColor" : "none");
        });
      });
    });

    modalBody.querySelectorAll("[data-report-modal]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const p = cachedPosts.find((x) => x.id === btn.dataset.reportModal);
        if (!p || !window.ReportModal) return;
        window.ReportModal.open({
          type: "post",
          targetId: p.id,
          targetUserId: p.author_id,
          targetTitle: p.title,
        });
      });
    });

    const delBtn = modalBody.querySelector("#delete-this-post");
    if (delBtn) {
      delBtn.addEventListener("click", async () => {
        if (!confirm("Удалить этот пост навсегда?")) return;
        delBtn.disabled = true;
        delBtn.textContent = "Удаление...";
        const res = await window.Auth.deleteCustomPost(post.id);
        if (res.ok) {
          closeModal();
          await loadDataAndRender();
          if (window.Toast) window.Toast.success("Пост удалён");
        } else {
          delBtn.disabled = false;
          delBtn.textContent = "Удалить";
          window.Toast.error(res.error);
        }
      });
    }

    const editBtn = modalBody.querySelector("#edit-this-post");
    if (editBtn) {
      editBtn.addEventListener("click", () => {
        closeModal();
        openEditModal(post);
      });
    }

    modalEl.hidden = false;
    requestAnimationFrame(() => modalEl.classList.add("open"));
    document.body.style.overflow = "hidden";

    if (window.Comments) {
      const container = modalBody.querySelector("#comments-container");
      if (container) window.Comments.mount(post.id, container);
    }
  }

  function closeModal() {
    modalEl.classList.remove("open");
    document.body.style.overflow = "";
    if (window.Comments) window.Comments.unmount();
    setTimeout(() => {
      modalEl.hidden = true;
    }, 250);
  }

  modalEl
    .querySelectorAll("[data-close]")
    .forEach((el) => el.addEventListener("click", closeModal));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modalEl.hidden) closeModal();
  });

  /* ---------- Модалка создания ---------- */
  createBtn.addEventListener("click", () => {
    if (!window.Auth.getCurrentUser()) {
      window.Toast.info("Войдите, чтобы создавать посты");
      return;
    }
    createForm.reset();
    postMsg.className = "auth-msg";
    postMsg.textContent = "";

    const draft = window.Auth.getDraft ? window.Auth.getDraft() : null;
    if (draft && (draft.title || draft.body)) {
      createForm.elements.title.value = draft.title || "";
      createForm.elements.body.value = draft.body || "";
      createForm.elements.excerpt.value = draft.excerpt || "";
      createForm.elements.tags.value = (draft.tags || []).join(", ");
      createForm.elements.category.value = draft.category || "story";
      window.Toast.info("Загружен черновик");
    }

    createModal.hidden = false;
    requestAnimationFrame(() => createModal.classList.add("open"));
  });

  function closeCreateModal() {
    createModal.classList.remove("open");
    setTimeout(() => {
      createModal.hidden = true;
    }, 250);
  }

  createModal
    .querySelectorAll("[data-close-create]")
    .forEach((el) => el.addEventListener("click", closeCreateModal));

  createForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(createForm);
    const tags = (fd.get("tags") || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const submitBtn = createForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = "Публикация...";

    const res = await window.Auth.addCustomPost({
      title: fd.get("title").trim(),
      excerpt: fd.get("excerpt").trim(),
      body: fd.get("body").trim(),
      category: fd.get("category"),
      tags: tags,
    });

    if (!res.ok) {
      postMsg.className = "auth-msg show error";
      postMsg.textContent = res.error;
      submitBtn.disabled = false;
      submitBtn.textContent = "Опубликовать";
      return;
    }

    if (window.Auth.clearDraft) window.Auth.clearDraft();
    postMsg.className = "auth-msg show success";
    postMsg.textContent = "Пост опубликован!";

    setTimeout(async () => {
      closeCreateModal();
      await loadDataAndRender(); // Перезагружаем ленту
      submitBtn.disabled = false;
      submitBtn.textContent = "Опубликовать";
    }, 800);
  });

  /* ---------- Модалка редактирования ---------- */
  function openEditModal(post) {
    if (!editModal || !editForm) return;
    editingPostId = post.id;

    editForm.elements.title.value = post.title || "";
    editForm.elements.body.value = post.body || "";
    editForm.elements.excerpt.value = post.excerpt || "";
    editForm.elements.tags.value = (post.tags || []).join(", ");
    editForm.elements.category.value = post.category || "story";

    editMsg.className = "auth-msg";
    editMsg.textContent = "";

    editModal.hidden = false;
    requestAnimationFrame(() => editModal.classList.add("open"));
    document.body.style.overflow = "hidden";
    setTimeout(() => editForm.elements.title.focus(), 60);
  }

  function closeEditModal() {
    if (!editModal) return;
    editModal.classList.remove("open");
    document.body.style.overflow = "";
    setTimeout(() => {
      editModal.hidden = true;
      editingPostId = null;
    }, 250);
  }

  if (editModal && editForm) {
    editModal
      .querySelectorAll("[data-close-edit]")
      .forEach((el) => el.addEventListener("click", closeEditModal));
    document
      .getElementById("cancel-edit-post")
      ?.addEventListener("click", closeEditModal);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !editModal.hidden) closeEditModal();
    });

    editForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!editingPostId) return;

      const fd = new FormData(editForm);
      const tags = (fd.get("tags") || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const submitBtn = editForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = "Сохранение...";

      const res = await window.Auth.editCustomPost(editingPostId, {
        title: fd.get("title").trim(),
        body: fd.get("body").trim(),
        excerpt: fd.get("excerpt").trim(),
        category: fd.get("category"),
        tags: tags,
      });

      if (!res.ok) {
        editMsg.className = "auth-msg show error";
        editMsg.textContent = res.error || "Не удалось сохранить";
        submitBtn.disabled = false;
        submitBtn.textContent = "Сохранить";
        return;
      }

      editMsg.className = "auth-msg show success";
      editMsg.textContent = "Сохранено!";
      await loadDataAndRender(); // Перезагружаем ленту

      setTimeout(() => {
        closeEditModal();
        const updated = cachedPosts.find((p) => p.id === editingPostId);
        if (updated) openModal(updated);
        if (window.Toast) window.Toast.success("Пост обновлён");
        submitBtn.disabled = false;
        submitBtn.textContent = "Сохранить";
      }, 500);
    });
  }

  /* ---------- Поиск ---------- */
  let searchTimer;
  searchEl.addEventListener("input", () => {
    currentSearch = searchEl.value;
    currentTag = null;
    renderTagBanner();
    clearEl.hidden = !currentSearch;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(renderFeed, 120);
  });
  clearEl.addEventListener("click", () => {
    searchEl.value = "";
    currentSearch = "";
    clearEl.hidden = true;
    renderFeed();
    searchEl.focus();
  });

  /* ---------- Сортировка ---------- */
  sortEl.querySelectorAll(".sort-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      sortEl
        .querySelectorAll(".sort-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentSort = btn.dataset.sort;
      renderFeed();
    });
  });

  /* ---------- Кнопка "В черновик" ---------- */
  const saveDraftBtn = document.getElementById("save-draft-btn");
  if (saveDraftBtn && createForm) {
    saveDraftBtn.addEventListener("click", () => {
      const fd = new FormData(createForm);
      const tags = (fd.get("tags") || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const res = window.Auth.saveDraft({
        title: fd.get("title") || "",
        excerpt: fd.get("excerpt") || "",
        body: fd.get("body") || "",
        category: fd.get("category") || "story",
        tags,
      });
      if (res.ok) window.Toast.success("Черновик сохранён");
      else window.Toast.error(res.error || "Не удалось сохранить");
    });
  }

  /* ---------- Загрузка данных и старт ---------- */
  async function loadDataAndRender() {
    if (window.Auth && window.Auth.getAllPosts) {
      cachedPosts = await window.Auth.getAllPosts();

      // Обработка Deep-link (?post=id или ?draft=1)
      const urlParams = new URLSearchParams(window.location.search);
      const urlPostId = urlParams.get("post");
      const urlDraft = urlParams.get("draft");

      if (urlPostId) {
        const target = cachedPosts.find(
          (p) => String(p.id) === String(urlPostId),
        );
        if (target) openModal(target);
        else if (window.Toast) window.Toast.error("Пост не найден");
      } else if (urlDraft === "1" && window.Auth.getCurrentUser()) {
        document.getElementById("create-post-btn")?.click();
      }

      renderFilters();
      renderFeed();
    }
  }

  // Слушаем изменения авторизации (чтобы обновить кнопки при входе/выходе)
  window.addEventListener("auth:change", () => {
    if (!modalEl.hidden || !createModal.hidden) return;
    renderFilters();
    renderFeed();
  });

  // Запускаем загрузку
  loadDataAndRender();
})();
