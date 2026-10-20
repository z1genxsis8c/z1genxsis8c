/* ============================================================
   profile.js — страница профиля (визитка + активность)
   ============================================================ */

(function () {
  const root = document.getElementById("profile-root");
  if (!root) return;

  /* ---------- Утилиты ---------- */
  function escapeHTML(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function formatDateOnly(ts) {
    const d = new Date(ts);
    if (isNaN(d)) return "—";
    return d.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }
  function formatDateTime(ts) {
    const d = new Date(ts);
    if (isNaN(d)) return "—";
    return d.toLocaleString("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  function formatTimeAgo(ts) {
    const d = new Date(ts);
    if (isNaN(d)) return "";
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return "только что";
    if (diff < 3600) return Math.floor(diff / 60) + " мин назад";
    if (diff < 86400) return Math.floor(diff / 3600) + " ч назад";
    if (diff < 86400 * 7) return Math.floor(diff / 86400) + " дн назад";
    return formatDateOnly(ts);
  }
  function avatarHTML(user) {
    if (user.avatar) return `<img src="${escapeHTML(user.avatar)}" alt="" />`;
    return escapeHTML((user.username || "?").charAt(0).toUpperCase());
  }
  function banBadgeHTML(user) {
    if (!window.Auth.isBanned(user)) return "";
    const until = user.banUntil
      ? `до ${formatDateTime(user.banUntil)}`
      : "навсегда";
    return `
      <div class="ban-banner">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2.2"
             stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
        </svg>
        <div>
          <strong>Пользователь забанен ${until}</strong>
          ${user.banReason ? `<span class="ban-reason">Причина: ${escapeHTML(user.banReason)}</span>` : ""}
        </div>
      </div>
    `;
  }

  /* ---------- Целевой юзер ---------- */
  function getTargetUser() {
    const params = new URLSearchParams(window.location.search);
    const u = params.get("u");
    const me = window.Auth.getCurrentUser();
    if (!u) return me;
    return window.Auth.getUserByUsername(u);
  }

  function renderNotFound(text = "Такого пользователя нет или он был удалён.") {
    root.innerHTML = `
      <div class="profile-notfound">
        <span class="emoji">👻</span>
        <h2>Профиль не найден</h2>
        <p>${escapeHTML(text)}</p>
      </div>
    `;
  }

  /* ---------- Секции ---------- */
  function renderUserPosts(user) {
    const all = window.Auth.getAllPosts ? window.Auth.getAllPosts() : [];
    const mine = all.filter(
      (p) =>
        (p.author?.name || "").toLowerCase() === user.username.toLowerCase(),
    );
    if (!mine.length) {
      return `<div class="profile-empty">Постов пока нет.</div>`;
    }
    return `<div class="profile-list">${mine
      .map((p) => {
        const catLabel =
          { code: "Код", game: "Игра", story: "Рассказ" }[p.category] || "Пост";
        return `
        <a href="posts.html?post=${p.id}" class="profile-list-item">
          <span class="pli-badge">${catLabel}</span>
          <span class="pli-title">${escapeHTML(p.title)}</span>
          <span class="pli-meta">${formatDateOnly(p.date)} · 👁 ${p.views || 0}</span>
        </a>`;
      })
      .join("")}</div>`;
  }

  function renderUserComments(user) {
    if (!window.Auth.getUserComments) {
      return `<div class="profile-empty">Комментариев пока нет.</div>`;
    }
    const list = window.Auth.getUserComments(user.id, 10);
    if (!list.length) {
      return `<div class="profile-empty">Комментариев пока нет.</div>`;
    }
    return `<div class="profile-list">${list
      .map((c) => {
        const isSuggestion = String(c._postId).startsWith("sug_");
        let target = "posts.html";
        let targetTitle = "Пост";
        if (isSuggestion) {
          target = "suggestions.html";
          targetTitle = "Предложка";
        } else {
          const posts = window.Auth.getAllPosts
            ? window.Auth.getAllPosts()
            : [];
          const p = posts.find((x) => String(x.id) === String(c._postId));
          if (p) {
            target = "posts.html?post=" + p.id;
            targetTitle = p.title;
          }
        }
        const preview =
          c.text.length > 120 ? c.text.slice(0, 120) + "…" : c.text;
        return `
        <a href="${target}" class="profile-list-item">
          <span class="pli-badge" title="${escapeHTML(targetTitle)}">${escapeHTML(targetTitle)}</span>
          <span class="pli-title">${escapeHTML(preview)}</span>
          <span class="pli-meta">${formatTimeAgo(c.createdAt)}</span>
        </a>`;
      })
      .join("")}</div>`;
  }

  function renderUserBookmarks() {
    if (!window.Auth.getBookmarks) return "";
    const bm = window.Auth.getBookmarks();
    if (!bm.length) {
      return `<div class="profile-empty">Ты ещё ничего не сохранил.</div>`;
    }
    const posts = window.Auth.getAllPosts ? window.Auth.getAllPosts() : [];
    const saved = posts.filter((p) => bm.includes(p.id));
    if (!saved.length) {
      return `<div class="profile-empty">Сохранённые посты не найдены.</div>`;
    }
    return `<div class="profile-list">${saved
      .map(
        (p) => `
      <a href="posts.html?post=${p.id}" class="profile-list-item">
        <span class="pli-badge">Пост</span>
        <span class="pli-title">${escapeHTML(p.title)}</span>
        <span class="pli-meta">${formatDateOnly(p.date)}</span>
      </a>`,
      )
      .join("")}</div>`;
  }

  function renderDraftBlock() {
    if (!window.Auth.getDraft) return "";
    const draft = window.Auth.getDraft();
    if (!draft || (!draft.title && !draft.body)) return "";
    return `
      <section class="profile-section">
        <div class="profile-section-head">
          <span class="profile-section-title">Черновик</span>
        </div>
        <div class="profile-draft">
          <div class="profile-draft-info">
            <span class="profile-draft-title">${escapeHTML(draft.title || "Без названия")}</span>
            <span class="profile-draft-meta">Обновлён ${formatTimeAgo(draft.updatedAt)}</span>
          </div>
          <a href="posts.html?draft=1" class="btn-save" style="text-decoration:none;">Продолжить</a>
        </div>
      </section>
    `;
  }

  /* ---------- Основной рендер ---------- */
  function render() {
    const me = window.Auth.getCurrentUser();
    const target = getTargetUser();

    if (!target) return renderNotFound();

    const isMe = me && me.id === target.id;
    const iAmStaff = me && window.Auth.isStaff(me);
    const roleLabel = window.Auth.getRoleLabel(target);
    const roleClass = (target.role || "").toLowerCase();
    const likeCount = window.Auth.getProfileLikeCount(target);
    const liked = me ? window.Auth.hasLikedProfile(target.id) : false;
    const bio = target.bio || "";
    const banned = window.Auth.isBanned(target);

    const allPosts = window.Auth.getAllPosts ? window.Auth.getAllPosts() : [];
    const userPosts = allPosts.filter(
      (p) =>
        (p.author?.name || "").toLowerCase() === target.username.toLowerCase(),
    );
    const userComments = window.Auth.getUserComments
      ? window.Auth.getUserComments(target.id, null)
      : [];
    const userBookmarks =
      isMe && window.Auth.getBookmarks ? window.Auth.getBookmarks() : [];

    root.innerHTML = `
      <!-- Шапка -->
      <section class="profile-header">
        <div class="profile-avatar">${avatarHTML(target)}</div>

        <div class="profile-info">
          <div class="profile-name-row">
            <h1 class="profile-name">${escapeHTML(target.username)}</h1>
            <span class="profile-role ${roleClass}">${escapeHTML(roleLabel)}</span>
          </div>

          <div class="profile-meta">
            ${
              iAmStaff
                ? `
              <span class="profile-meta-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2"
                     stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                Регистрация: ${formatDateOnly(target.createdAt)}
              </span>
            `
                : ""
            }
            <span class="profile-meta-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2"
                   stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              ${liked ? "Тебе нравится этот профиль" : "Профиль сообщества"}
            </span>
          </div>

          <div class="profile-actions">
            <button class="profile-like-btn ${liked ? "active" : ""}" id="like-btn">
              <svg width="16" height="16" viewBox="0 0 24 24"
                   fill="${liked ? "currentColor" : "none"}"
                   stroke="currentColor" stroke-width="2"
                   stroke-linecap="round" stroke-linejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
              <span>${likeCount}</span>
            </button>

            ${
              !isMe
                ? `
              <button class="profile-report-btn" id="report-btn">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2"
                     stroke-linecap="round" stroke-linejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                Пожаловаться
              </button>
            `
                : ""
            }

            ${
              iAmStaff && !isMe && banned
                ? `<button class="profile-unban-btn" id="unban-btn">Снять бан</button>`
                : ""
            }
          </div>
        </div>
      </section>

      ${banned ? banBadgeHTML(target) : ""}

      <!-- О себе -->
      <section class="profile-section">
        <div class="profile-section-head">
          <span class="profile-section-title">О себе</span>
          ${
            isMe
              ? `
            <button class="btn-edit" id="edit-btn">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2"
                   stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 20h9"/>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
              Редактировать
            </button>
          `
              : ""
          }
        </div>

        <div id="bio-view">
          ${
            bio.trim()
              ? `<div class="profile-bio">${escapeHTML(bio)}</div>`
              : `<div class="profile-bio empty">${
                  isMe
                    ? "Расскажи о себе — во что играешь, что делаешь, чем живёшь."
                    : "Пользователь пока ничего не рассказал о себе."
                }</div>`
          }
        </div>

        ${
          isMe
            ? `
          <div class="profile-edit" id="bio-edit">
            <div class="profile-msg" id="profile-msg"></div>

            <label>Аватарка</label>
            <div class="avatar-uploader">
              <div class="avatar-preview" id="avatar-preview">
                ${
                  target.avatar
                    ? `<img src="${escapeHTML(target.avatar)}" alt="" />`
                    : `<span>${escapeHTML((target.username || "?").charAt(0).toUpperCase())}</span>`
                }
              </div>
              <div class="avatar-uploader-info">
                <input type="file" id="avatar-input" accept="image/*" hidden />
                <div class="avatar-buttons">
                  <button type="button" class="btn-save" id="avatar-pick">Выбрать фото</button>
                  ${target.avatar ? `<button type="button" class="btn-cancel" id="avatar-remove">Удалить</button>` : ""}
                </div>
                <p class="avatar-hint">JPG или PNG, до 8 МБ. Дальше сам выберешь область — то, что в круге, станет аватаркой.</p>
              </div>
            </div>

            <label for="bio-input">О себе</label>
            <textarea id="bio-input" maxlength="800"
              placeholder="Кто ты, чем занимаешься, во что играешь…">${escapeHTML(bio)}</textarea>

            <div class="profile-edit-actions">
              <button class="btn-save" id="save-btn">Сохранить</button>
              <button class="btn-cancel" id="cancel-btn">Отмена</button>
            </div>
          </div>
        `
            : ""
        }
      </section>

      <!-- Активность -->
      <section class="profile-section">
        <div class="profile-section-head">
          <span class="profile-section-title">Активность</span>
        </div>
        <div class="profile-activity">
          <div class="pa-item"><span class="pa-value">${userPosts.length}</span><span class="pa-label">постов</span></div>
          <div class="pa-item"><span class="pa-value">${userComments.length}</span><span class="pa-label">комментариев</span></div>
          <div class="pa-item"><span class="pa-value">${userBookmarks.length}</span><span class="pa-label">закладок</span></div>
          <div class="pa-item"><span class="pa-value">${likeCount}</span><span class="pa-label">лайков профиля</span></div>
        </div>
      </section>

      ${isMe ? renderDraftBlock() : ""}

      <!-- Посты -->
      <section class="profile-section">
        <div class="profile-section-head">
          <span class="profile-section-title">Посты</span>
        </div>
        ${renderUserPosts(target)}
      </section>

      <!-- Комментарии -->
      <section class="profile-section">
        <div class="profile-section-head">
          <span class="profile-section-title">Комментарии</span>
        </div>
        ${renderUserComments(target)}
      </section>

      <!-- Сохранённое (только для себя) -->
      ${
        isMe
          ? `
        <section class="profile-section">
          <div class="profile-section-head">
            <span class="profile-section-title">Сохранённое</span>
          </div>
          ${renderUserBookmarks()}
        </section>
      `
          : ""
      }
    `;

    bindEvents(target, me, isMe, iAmStaff);
  }

  /* ---------- События ---------- */
  function bindEvents(target, me, isMe, iAmStaff) {
    document.getElementById("like-btn")?.addEventListener("click", () => {
      if (!me) {
        window.Toast.info("Войди, чтобы поставить лайк.");
        return;
      }
      if (me.id === target.id) return;
      window.Auth.toggleProfileLike(target.id);
      render();
    });

    document.getElementById("report-btn")?.addEventListener("click", () => {
      window.ReportModal.open({
        type: "profile",
        targetUserId: target.id,
        targetTitle: target.username,
      });
    });

    document.getElementById("unban-btn")?.addEventListener("click", () => {
      if (!confirm(`Снять бан с ${target.username}?`)) return;
      window.Auth.unbanUser(target.id);
      render();
    });

    if (!isMe) return;

    const editBtn = document.getElementById("edit-btn");
    const cancelBtn = document.getElementById("cancel-btn");
    const saveBtn = document.getElementById("save-btn");
    const editForm = document.getElementById("bio-edit");
    const bioView = document.getElementById("bio-view");
    const bioInput = document.getElementById("bio-input");
    const fileInput = document.getElementById("avatar-input");
    const pickBtn = document.getElementById("avatar-pick");
    const removeBtn = document.getElementById("avatar-remove");
    const preview = document.getElementById("avatar-preview");
    const msg = document.getElementById("profile-msg");

    let pendingAvatar = target.avatar || "";

    function showMsg(type, text) {
      if (!msg) return;
      msg.className = "profile-msg show " + type;
      msg.textContent = text;
      setTimeout(() => msg.classList.remove("show"), 3500);
    }

    editBtn?.addEventListener("click", () => {
      editForm.classList.add("active");
      bioView.style.display = "none";
    });

    cancelBtn?.addEventListener("click", () => {
      editForm.classList.remove("active");
      bioView.style.display = "block";
      bioInput.value = target.bio || "";
      pendingAvatar = target.avatar || "";
      preview.innerHTML = pendingAvatar
        ? `<img src="${escapeHTML(pendingAvatar)}" alt="" />`
        : `<span>${escapeHTML((target.username || "?").charAt(0).toUpperCase())}</span>`;
    });

    pickBtn?.addEventListener("click", () => fileInput.click());

    fileInput?.addEventListener("change", () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      fileInput.value = "";
      if (!window.AvatarCropper) {
        showMsg("error", "Кроппер не загружен");
        return;
      }
      window.AvatarCropper.open(file, (dataUrl) => {
        pendingAvatar = dataUrl;
        preview.innerHTML = `<img src="${dataUrl}" alt="" />`;
        showMsg("success", "Аватарка готова. Не забудь сохранить.");
      });
    });

    removeBtn?.addEventListener("click", () => {
      pendingAvatar = "";
      preview.innerHTML = `<span>${escapeHTML((target.username || "?").charAt(0).toUpperCase())}</span>`;
    });

    saveBtn?.addEventListener("click", () => {
      const res = window.Auth.updateProfile(target.id, {
        bio: bioInput.value.trim(),
        avatar: pendingAvatar,
      });
      if (!res.ok) return showMsg("error", res.error || "Ошибка сохранения");
      showMsg("success", "Сохранено!");
      target.bio = bioInput.value.trim();
      target.avatar = pendingAvatar;
      setTimeout(() => render(), 500);
    });
  }

  window.addEventListener("auth:change", () => {
    const editActive = document
      .getElementById("bio-edit")
      ?.classList.contains("active");
    if (!editActive) render();
  });

  render();
})();
