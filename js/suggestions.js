/* ============================================================
   suggestions.js — страница «Предложка»
   ============================================================ */

(function () {
  const feedEl = document.getElementById("suggest-feed");
  if (!feedEl) return;

  const formWrap = document.getElementById("suggest-form-wrap");
  const openBtn = document.getElementById("open-suggest-form");
  const closeBtn = document.getElementById("close-suggest-form");
  const form = document.getElementById("suggest-form");
  const msg = document.getElementById("suggest-msg");
  const typesEl = document.getElementById("suggest-types");
  const filtersEl = document.getElementById("filters");
  const sortEl = document.getElementById("sort");
  const emptyEl = document.getElementById("empty-state");

  const TYPES = window.Auth.SUGGESTION_TYPES;

  let currentFilter = "all";
  let currentSort = "new";
  let currentType = "movie";

  /* ---------- Утилиты ---------- */
  function escapeHTML(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function formatTime(ts) {
    const d = new Date(ts);
    if (isNaN(d)) return "";
    const now = Date.now();
    const diff = (now - d.getTime()) / 1000;
    if (diff < 60) return "только что";
    if (diff < 3600) return Math.floor(diff / 60) + " мин назад";
    if (diff < 86400) return Math.floor(diff / 3600) + " ч назад";
    if (diff < 86400 * 7) return Math.floor(diff / 86400) + " дн назад";
    return d.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
      year:
        d.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
    });
  }
  function hostname(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  }

  /* ---------- Форма ---------- */
  function renderTypes() {
    typesEl.innerHTML = Object.entries(TYPES)
      .map(
        ([key, val]) => `
      <button type="button"
              class="suggest-type ${key === currentType ? "active" : ""}"
              data-type="${key}">
        <span class="st-icon">${val.icon}</span>
        <span class="st-label">${val.label}</span>
      </button>
    `,
      )
      .join("");

    typesEl.querySelectorAll(".suggest-type").forEach((btn) => {
      btn.addEventListener("click", () => {
        currentType = btn.dataset.type;
        renderTypes();
      });
    });
  }

  function showMsg(type, text) {
    msg.className = "suggest-form-msg show " + type;
    msg.textContent = text;
    setTimeout(() => msg.classList.remove("show"), 3500);
  }

  function openForm() {
    const me = window.Auth.getCurrentUser();
    if (!me) {
      window.Toast.info("Войди, чтобы предложить.");
      return;
    }
    formWrap.hidden = false;
    requestAnimationFrame(() => formWrap.classList.add("open"));
    setTimeout(() => document.getElementById("suggest-title")?.focus(), 200);
    formWrap.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function closeForm() {
    formWrap.classList.remove("open");
    setTimeout(() => {
      formWrap.hidden = true;
    }, 250);
  }

  openBtn?.addEventListener("click", openForm);
  closeBtn?.addEventListener("click", closeForm);

  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const res = window.Auth.addSuggestion({
      type: currentType,
      title: fd.get("title"),
      url: fd.get("url"),
      comment: fd.get("comment"),
    });
    if (!res.ok) return showMsg("error", res.error);
    showMsg("success", "Отправлено!");
    form.reset();
    currentType = "movie";
    renderTypes();
    renderFilters();
    renderFeed();
    setTimeout(() => closeForm(), 600);
  });

  /* ---------- Фильтры ---------- */
  function renderFilters() {
    const all = window.Auth.listSuggestions();
    const counts = { all: all.length };
    Object.keys(TYPES).forEach((k) => {
      counts[k] = 0;
    });
    all.forEach((s) => {
      counts[s.type] = (counts[s.type] || 0) + 1;
    });

    const items = [
      { key: "all", label: "Всё", icon: "◈" },
      ...Object.entries(TYPES).map(([k, v]) => ({
        key: k,
        label: v.label,
        icon: v.icon,
      })),
    ];

    filtersEl.innerHTML = items
      .filter((item) => item.key === "all" || counts[item.key] > 0)
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
        renderFilters();
        renderFeed();
      });
    });
  }

  /* ---------- Карточка ---------- */
  function cardHTML(item) {
    const meta = TYPES[item.type] || TYPES.other;
    const me = window.Auth.getCurrentUser();
    const isMine = me && me.id === item.authorId;
    const isStaff = me && window.Auth.isStaff(me);
    const canDelete = isMine || isStaff;

    const canReport = me && !isMine;

    const counts = window.Auth.getSuggestionCounts(item);
    const host = item.url ? hostname(item.url) : "";
    const author = window.Auth.getUserById(item.authorId);
    const roleLabel = author ? window.Auth.getRoleLabel(author) : "";
    const roleClass = author ? (author.role || "").toLowerCase() : "";
    const commentCount = window.Auth.getCommentCount("sug_" + item.id);

    return `
      <article class="suggest-card" data-id="${item.id}" style="--accent: ${meta.color}">
        <header class="suggest-card-head">
          <span class="suggest-type-chip">
            <span class="st-icon">${meta.icon}</span>
            ${meta.label}
          </span>
          <span class="suggest-time">${formatTime(item.createdAt)}</span>
        </header>

        <h3 class="suggest-title">${escapeHTML(item.title)}</h3>

        ${item.comment ? `<p class="suggest-comment">${escapeHTML(item.comment)}</p>` : ""}

        ${
          item.url
            ? `
          <a class="suggest-url" href="${escapeHTML(item.url)}" target="_blank" rel="noopener noreferrer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
            ${escapeHTML(host || item.url)}
          </a>
        `
            : ""
        }

        <footer class="suggest-foot">
          <div class="suggest-author">
            <span class="suggest-author-avatar">
              ${
                author && author.avatar
                  ? `<img src="${escapeHTML(author.avatar)}" alt="" />`
                  : escapeHTML((item.authorName || "?").charAt(0).toUpperCase())
              }
            </span>
            <div class="suggest-author-info">
              <span class="suggest-author-name">${escapeHTML(item.authorName)}</span>
              ${roleLabel ? `<span class="suggest-author-role ${roleClass}">${escapeHTML(roleLabel)}</span>` : ""}
            </div>
          </div>

          <div class="suggest-actions">
            <button class="react-btn" data-act="comments" data-id="${item.id}" aria-label="Комментарии" title="Комментарии">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              <span>${commentCount}</span>
            </button>

            <button class="react-btn like ${counts.userReaction === "like" ? "active" : ""}"
                    data-act="like" data-id="${item.id}" aria-label="Нравится">
              <svg width="15" height="15" viewBox="0 0 24 24"
                   fill="${counts.userReaction === "like" ? "currentColor" : "none"}"
                   stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M7 10v12"/>
                <path d="M15 5.88L14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88z"/>
              </svg>
              <span>${counts.likes}</span>
            </button>

            <button class="react-btn dislike ${counts.userReaction === "dislike" ? "active" : ""}"
                    data-act="dislike" data-id="${item.id}" aria-label="Не нравится">
              <svg width="15" height="15" viewBox="0 0 24 24"
                   fill="${counts.userReaction === "dislike" ? "currentColor" : "none"}"
                   stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 14V2"/>
                <path d="M9 18.12L10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88z"/>
              </svg>
              <span>${counts.dislikes}</span>
            </button>

            ${
              canReport
                ? `
              <button class="suggest-icon-btn" data-act="report" data-id="${item.id}" aria-label="Пожаловаться" title="Пожаловаться">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </button>
            `
                : ""
            }

            ${
              canDelete
                ? `
              <button class="suggest-icon-btn danger" data-act="delete" data-id="${item.id}" aria-label="Удалить" title="Удалить">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  <path d="M10 11v6M14 11v6"/>
                  <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            `
                : ""
            }
          </div>
        </footer>
      </article>
    `;
  }

  /* ---------- Лента ---------- */
  function getVisible() {
    let list = window.Auth.listSuggestions();
    if (currentFilter !== "all")
      list = list.filter((s) => s.type === currentFilter);

    if (currentSort === "popular") {
      list.sort((a, b) => {
        const cA = window.Auth.getSuggestionCounts(a);
        const cB = window.Auth.getSuggestionCounts(b);
        return cB.likes - cB.dislikes - (cA.likes - cA.dislikes);
      });
    } else {
      list.sort((a, b) => b.createdAt - a.createdAt);
    }
    return list;
  }

  function renderFeed() {
    const list = getVisible();
    if (!list.length) {
      feedEl.innerHTML = "";
      emptyEl.hidden = false;
      return;
    }
    emptyEl.hidden = true;
    feedEl.innerHTML = list.map(cardHTML).join("");

    feedEl.querySelectorAll("[data-act]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = Number(btn.dataset.id);
        const act = btn.dataset.act;

        if (act === "like" || act === "dislike") {
          if (!window.Auth.getCurrentUser())
            return window.Toast.info("Войди, чтобы голосовать.");
          window.Auth.reactToSuggestion(id, act);
          renderFeed();
        } else if (act === "delete") {
          if (!confirm("Удалить предложку?")) return;
          const res = window.Auth.removeSuggestion(id);
          if (!res.ok) return window.Toast.error(res.error);
          renderFilters();
          renderFeed();
        } else if (act === "report") {
          const s = window.Auth.getSuggestionById(id);
          if (!s) return;
          window.ReportModal.open({
            type: "suggestion",
            targetId: s.id,
            targetUserId: s.authorId,
            targetTitle: s.title,
          });
        } else if (act === "comments") {
          const s = window.Auth.getSuggestionById(id);
          if (!s) return;
          openSuggestComments(s);
        }
      });
    });
  }

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

  /* ============================================================
     МОДАЛКА КОММЕНТАРИЕВ К ПРЕДЛОЖКЕ
     ============================================================ */
  function openSuggestComments(item) {
    const modal = document.getElementById("suggest-comments-modal");
    const subEl = document.getElementById("suggest-comments-subtitle");
    const container = document.getElementById("suggest-comments-container");

    if (!modal || !container) return;

    // Устанавливаем название предложки в шапку модалки
    if (subEl) subEl.textContent = item.title;

    container.innerHTML = "";

    modal.hidden = false;
    requestAnimationFrame(() => modal.classList.add("open"));
    document.body.style.overflow = "hidden";

    let closed = false;
    function close() {
      if (closed) return;
      closed = true;
      modal.classList.remove("open");
      document.body.style.overflow = "";
      if (window.Comments) window.Comments.unmount();
      setTimeout(() => {
        modal.hidden = true;
      }, 250);
      modal
        .querySelectorAll("[data-close-suggest-comments]")
        .forEach((el) => el.removeEventListener("click", close));
      document.removeEventListener("keydown", onEsc);
      renderFeed();
    }
    function onEsc(e) {
      if (e.key === "Escape") close();
    }

    modal
      .querySelectorAll("[data-close-suggest-comments]")
      .forEach((el) => el.addEventListener("click", close));
    document.addEventListener("keydown", onEsc);

    setTimeout(() => {
      if (window.Comments) {
        // Передаем ID предложки в comments.js с префиксом "sug_"
        window.Comments.mount("sug_" + item.id, container);
      }
    }, 50);
  }

  /* ---------- Старт ---------- */
  renderTypes();
  renderFilters();
  renderFeed();

  window.addEventListener("auth:change", () => {
    renderFilters();
    renderFeed();
  });
})();
