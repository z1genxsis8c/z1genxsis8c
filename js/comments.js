/* ============================================================
   comments.js — секция комментариев под постом
   ============================================================ */

(function () {
  let currentPostId = null;
  let currentContainer = null;
  let replyTo = null;
  let boundAuthChange = false;

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
  function avatarHTML(user, fallbackName) {
    if (user && user.avatar) {
      return `<img src="${escapeHTML(user.avatar)}" alt="" />`;
    }
    return escapeHTML((fallbackName || "?").charAt(0).toUpperCase());
  }
  function requireLogin() {
    const me = window.Auth.getCurrentUser();
    if (!me) {
      if (window.Auth && window.Auth.openAuth) {
        // попытаться открыть модалку входа, если есть
      }
      alert("Войди в аккаунт, чтобы участвовать в обсуждении.");
      return false;
    }
    return true;
  }

  /* ---------- Рендер формы ---------- */
  function renderMainForm() {
    const me = window.Auth.getCurrentUser();
    if (!me) {
      return `
        <div class="comment-login-hint">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
            <polyline points="10 17 15 12 10 7"/>
            <line x1="15" y1="12" x2="3" y2="12"/>
          </svg>
          <span>Войди, чтобы оставить комментарий.</span>
        </div>
      `;
    }
    return `
      <form class="comment-form" id="comment-form">
        <div class="comment-form-avatar">${avatarHTML(me, me.username)}</div>
        <div class="comment-form-body">
          <textarea name="text" maxlength="1500" rows="3"
            placeholder="Написать комментарий…"></textarea>
          <div class="comment-form-foot">
            <span class="comment-char-count" data-count></span>
            <button type="submit" class="btn-save">Отправить</button>
          </div>
        </div>
      </form>
    `;
  }

  /* ---------- Рендер одного комментария ---------- */
  function renderComment(c, repliesMap, me) {
    const replies = repliesMap[c.id] || [];
    const hasAliveReplies = replies.some((r) => !r.deleted);

    // Удалён и нет живых ответов — вообще не показываем
    if (c.deleted && !hasAliveReplies) return "";

    const isMine = me && me.id === c.authorId;
    const isStaff = me && window.Auth.isStaff(me);
    const canDelete = isMine || isStaff;
    const canReport = me && !isMine;
    const counts = window.Auth.getCommentCounts(c);
    const user = window.Auth.getUserById(c.authorId);
    const role = user ? window.Auth.getRoleLabel(user) : "";
    const roleClass = user ? (user.role || "").toLowerCase() : "";

    let actionsHTML = "";
    if (!c.deleted) {
      actionsHTML = `
        <button class="comment-action ${counts.userReaction === "like" ? "active like" : ""}"
                data-act="like" title="Нравится">
          <svg width="13" height="13" viewBox="0 0 24 24"
               fill="${counts.userReaction === "like" ? "currentColor" : "none"}"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M7 10v12"/>
            <path d="M15 5.88L14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88z"/>
          </svg>
          <span>${counts.likes}</span>
        </button>
        <button class="comment-action ${counts.userReaction === "dislike" ? "active dislike" : ""}"
                data-act="dislike" title="Не нравится">
          <svg width="13" height="13" viewBox="0 0 24 24"
               fill="${counts.userReaction === "dislike" ? "currentColor" : "none"}"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 14V2"/>
            <path d="M9 18.12L10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88z"/>
          </svg>
          <span>${counts.dislikes}</span>
        </button>
        <button class="comment-action" data-act="reply">Ответить</button>
        ${canReport ? `<button class="comment-action" data-act="report">Жалоба</button>` : ""}
        ${canDelete ? `<button class="comment-action danger" data-act="delete">Удалить</button>` : ""}
      `;
    }

    const bodyHTML = c.deleted
      ? `<p class="comment-text deleted">Комментарий удалён</p>`
      : `<p class="comment-text">${escapeHTML(c.text)}</p>`;

    const headHTML = c.deleted
      ? `<div class="comment-head"><span class="comment-author">—</span></div>`
      : `
        <div class="comment-head">
          <span class="comment-author">${escapeHTML(c.authorName)}</span>
          ${role ? `<span class="comment-role ${roleClass}">${escapeHTML(role)}</span>` : ""}
          <time class="comment-time">${formatTime(c.createdAt)}</time>
        </div>
      `;

    const replyForm =
      replyTo === c.id
        ? `
      <form class="comment-reply-form" data-parent-id="${c.id}">
        <textarea name="text" maxlength="1500" rows="2"
          placeholder="Ответить ${escapeHTML(c.authorName)}…" autofocus></textarea>
        <div class="comment-form-foot">
          <button type="button" class="btn-cancel" data-act="cancel-reply">Отмена</button>
          <button type="submit" class="btn-save">Ответить</button>
        </div>
      </form>
    `
        : "";

    const repliesHTML = replies.length
      ? `<div class="comment-replies">${replies.map((r) => renderComment(r, {}, me)).join("")}</div>`
      : "";

    return `
      <article class="comment ${c.deleted ? "is-deleted" : ""}" data-id="${c.id}">
        <div class="comment-avatar">${avatarHTML(user, c.authorName)}</div>
        <div class="comment-body">
          ${headHTML}
          ${bodyHTML}
          <div class="comment-actions">${actionsHTML}</div>
          ${replyForm}
          ${repliesHTML}
        </div>
      </article>
    `;
  }

  /* ---------- Рендер всей секции ---------- */
  function render() {
    if (!currentContainer || !currentPostId) return;

    const me = window.Auth.getCurrentUser();
    const all = window.Auth.listComments(currentPostId);
    const aliveCount = all.filter((c) => !c.deleted).length;

    const topLevel = all
      .filter((c) => !c.parentId)
      .sort((a, b) => b.createdAt - a.createdAt);

    const repliesMap = {};
    all
      .filter((c) => c.parentId)
      .forEach((c) => {
        (repliesMap[c.parentId] = repliesMap[c.parentId] || []).push(c);
      });
    for (const k in repliesMap) {
      repliesMap[k].sort((a, b) => a.createdAt - b.createdAt);
    }

    currentContainer.innerHTML = `
      <section class="comments-section">
        <div class="comments-head">
          <h3 class="comments-title">
            Комментарии
            <span class="comments-count">${aliveCount}</span>
          </h3>
        </div>

        ${renderMainForm()}

        <div class="comments-list">
          ${
            topLevel.length
              ? topLevel.map((c) => renderComment(c, repliesMap, me)).join("")
              : `<div class="comments-empty">Пока нет комментариев. Будь первым!</div>`
          }
        </div>
      </section>
    `;

    bindEvents();
  }

  /* ---------- События ---------- */
  function bindEvents() {
    // Счётчик символов
    const form = currentContainer.querySelector("#comment-form");
    if (form) {
      const ta = form.querySelector("textarea");
      const counter = form.querySelector("[data-count]");
      const update = () => {
        counter.textContent = ta.value.length + " / 1500";
      };
      ta.addEventListener("input", update);
      update();
      form.addEventListener("submit", onSubmitMain);
    }

    // Клики по комментариям (делегирование)
    currentContainer.querySelectorAll(".comments-list").forEach((list) => {
      list.addEventListener("click", onClickComment);
    });

    // Сабмит ответов
    currentContainer.querySelectorAll(".comment-reply-form").forEach((f) => {
      f.addEventListener("submit", onSubmitReply);
      const ta = f.querySelector("textarea");
      if (ta && f.dataset.parentId === String(replyTo)) {
        setTimeout(() => ta.focus(), 30);
      }
    });

    // Отмена ответа
    currentContainer
      .querySelectorAll('[data-act="cancel-reply"]')
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          replyTo = null;
          render();
        });
      });
  }

  function onSubmitMain(e) {
    e.preventDefault();
    if (!requireLogin()) return;
    const ta = e.target.querySelector("textarea");
    const text = ta.value.trim();
    if (!text) return;
    const res = window.Auth.addComment(currentPostId, text);
    if (!res.ok) return alert(res.error);
    ta.value = "";
    render();
  }

  function onSubmitReply(e) {
    e.preventDefault();
    if (!requireLogin()) return;
    const parentId = Number(e.target.dataset.parentId);
    const ta = e.target.querySelector("textarea");
    const text = ta.value.trim();
    if (!text) return;
    const res = window.Auth.addComment(currentPostId, text, parentId);
    if (!res.ok) return alert(res.error);
    replyTo = null;
    render();
  }

  function onClickComment(e) {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const commentEl = btn.closest(".comment");
    if (!commentEl) return;
    const id = Number(commentEl.dataset.id);
    const act = btn.dataset.act;

    if (act === "like" || act === "dislike") {
      if (!requireLogin()) return;
      window.Auth.reactToComment(id, act);
      render();
      return;
    }
    if (act === "reply") {
      if (!requireLogin()) return;
      replyTo = replyTo === id ? null : id;
      render();
      return;
    }
    if (act === "report") {
      if (!requireLogin()) return;
      const comment = window.Auth.listComments(currentPostId).find(
        (c) => c.id === id,
      );
      if (!comment) return;
      const preview =
        comment.text.length > 60
          ? comment.text.slice(0, 60) + "…"
          : comment.text;
      window.ReportModal.open({
        type: "comment",
        targetId: id,
        targetUserId: comment.authorId,
        targetTitle: preview,
      });
      return;
    }
    if (act === "delete") {
      if (!confirm("Удалить комментарий?")) return;
      window.Auth.removeComment(id);
      render();
      return;
    }
  }

  /* ---------- Публичный API ---------- */
  function mount(postId, container) {
    currentPostId = postId;
    currentContainer = container;
    replyTo = null;
    render();

    if (!boundAuthChange) {
      boundAuthChange = true;
      window.addEventListener("auth:change", () => {
        if (currentContainer && currentPostId) render();
      });
    }
  }
  function unmount() {
    currentPostId = null;
    currentContainer = null;
    replyTo = null;
  }

  window.Comments = { mount, unmount };
})();
