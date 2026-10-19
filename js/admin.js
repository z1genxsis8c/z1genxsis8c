/* ============================================================
   admin.js — логика панели администратора
   ============================================================ */

(function () {
  const deniedEl = document.getElementById("admin-denied");
  const contentEl = document.getElementById("admin-content");
  const statsEl = document.getElementById("admin-stats");
  const tabsEl = document.getElementById("admin-tabs");
  const listEl = document.getElementById("admin-list");
  const emptyEl = document.getElementById("admin-empty");

  if (!contentEl) return;

  function checkAccess() {
    const user = window.Auth && window.Auth.getCurrentUser();
    const isAdm = user && window.Auth.isAdmin(user);
    if (!isAdm) {
      deniedEl.hidden = false;
      contentEl.hidden = true;
      return false;
    }
    deniedEl.hidden = true;
    contentEl.hidden = false;
    return true;
  }

  let currentTab = "pending";

  function escapeHTML(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function formatDate(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return "";
    return d.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  function avatarLetter(name) {
    return (name || "?").charAt(0).toUpperCase();
  }
  function hostname(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return url;
    }
  }
  function toast(type, msg) {
    if (window.Toast && window.Toast[type]) window.Toast[type](msg);
    else alert(msg);
  }

  const ROLE_OPTIONS = [
    { key: "user", label: "Участник" },
    { key: "moderator", label: "Модератор" },
    { key: "admin", label: "Админ" },
    { key: "owner", label: "Владелец" },
  ];

  function me_() {
    return window.Auth.getCurrentUser();
  }
  function canModerate(target) {
    const m = me_();
    return !!(m && window.Auth.canModerateUser(m, target));
  }
  function myLevel() {
    const m = me_();
    return m ? window.Auth.getRoleLevel(m.role) : 0;
  }
  function levelOf(roleKey) {
    return window.Auth.getRoleLevel(roleKey);
  }

  /* ---------- Статистика ---------- */
  function renderStats() {
    const users = window.Auth.listUsers();
    const total = users.length;
    const pending = users.filter((u) => u.status === "pending").length;
    const approved = users.filter((u) => u.status === "approved").length;
    const rejected = users.filter((u) => u.status === "rejected").length;
    const reports = window.Auth.listReports().filter(
      (r) => r.status === "pending",
    ).length;
    const sugCount = window.Auth.listSuggestions().length;

    statsEl.innerHTML = `
      <div class="stat-card"><span class="stat-value">${total}</span><span class="stat-label">всего заявок</span></div>
      <div class="stat-card"><span class="stat-value">${pending}</span><span class="stat-label">на рассмотрении</span></div>
      <div class="stat-card"><span class="stat-value">${approved}</span><span class="stat-label">одобрено</span></div>
      <div class="stat-card"><span class="stat-value">${rejected}</span><span class="stat-label">отклонено</span></div>
      <div class="stat-card"><span class="stat-value">${reports}</span><span class="stat-label">жалоб</span></div>
      <div class="stat-card"><span class="stat-value">${sugCount}</span><span class="stat-label">предложек</span></div>
    `;
    document.getElementById("count-pending").textContent = pending;
    document.getElementById("count-approved").textContent = approved;
    document.getElementById("count-rejected").textContent = rejected;
    document.getElementById("count-reports").textContent = reports;
    document.getElementById("count-suggestions").textContent = sugCount;
  }

  /* ---------- Строка пользователя ---------- */
  function userRowHTML(user) {
    const m = me_();
    const isSelf = m && m.id === user.id;
    const canMod = !isSelf && canModerate(user);
    const myLvl = myLevel();

    const statusLabel =
      {
        pending: "На рассмотрении",
        approved: "Одобрен",
        rejected: "Отклонён",
      }[user.status] || user.status;

    const banned = window.Auth.isBanned(user);

    function actionBtn({ action, cls, label, allowed, why }) {
      if (!allowed) {
        return `<button class="btn-mini ${cls}" disabled title="${escapeHTML(why || "Недостаточно прав")}">${label}</button>`;
      }
      return `<button class="btn-mini ${cls}" data-action="${action}" data-id="${user.id}">${label}</button>`;
    }

    let actions = "";
    if (user.status === "pending") {
      actions = `
        ${actionBtn({ action: "approve", cls: "approve", label: "✓ Одобрить", allowed: true })}
        ${actionBtn({ action: "reject", cls: "reject", label: "✕ Отклонить", allowed: true })}
      `;
    } else if (user.status === "approved") {
      actions = actionBtn({
        action: "reject",
        cls: "reject",
        label: "Заблокировать",
        allowed: canMod,
        why: isSelf ? "Нельзя заблокировать себя" : "Цель не ниже по рангу",
      });
    } else if (user.status === "rejected") {
      actions = actionBtn({
        action: "approve",
        cls: "approve",
        label: "Одобрить",
        allowed: canMod || isSelf ? false : true,
        why: "Цель не ниже по рангу",
      });
    }

    if (banned) {
      actions += actionBtn({
        action: "unban",
        cls: "approve",
        label: "Снять бан",
        allowed: canMod,
        why: isSelf ? "Нельзя разбанить себя" : "Цель не ниже по рангу",
      });
    }

    actions += actionBtn({
      action: "delete",
      cls: "danger",
      label: "Удалить",
      allowed: canMod,
      why: isSelf ? "Нельзя удалить себя" : "Цель не ниже по рангу",
    });

    const canEditThisUser =
      !!m &&
      !isSelf &&
      window.Auth.isStaff(m) &&
      (m.role === "owner" || levelOf(user.role) < myLvl);

    let roleEditorHTML;
    if (!canEditThisUser) {
      const reason = isSelf
        ? "Нельзя менять себе роль"
        : !window.Auth.isStaff(m)
          ? "Недостаточно прав"
          : "Цель не ниже по рангу";
      roleEditorHTML = `
        <div class="role-editor role-editor-locked" title="${escapeHTML(reason)}">
          <label>Роль:</label>
          <span class="role-chip-static ${(user.role || "").toLowerCase()}">
            ${escapeHTML(window.Auth.getRoleLabel(user))}
          </span>
          <span class="role-locked-hint">🔒 ${escapeHTML(reason)}</span>
        </div>
      `;
    } else {
      const roleOptions = ROLE_OPTIONS.map((opt) => {
        const optLvl = levelOf(opt.key);
        const tooHigh = optLvl > myLvl;
        const isCurrent = user.role === opt.key;
        const disabled = tooHigh && !isCurrent ? "disabled" : "";
        const suffix = tooHigh && !isCurrent ? " (выше вашей)" : "";
        return `<option value="${opt.key}" ${isCurrent ? "selected" : ""} ${disabled}>${opt.label}${suffix}</option>`;
      }).join("");

      roleEditorHTML = `
        <div class="role-editor">
          <label>Роль:</label>
          <select class="role-select" data-role-for="${user.id}">
            ${roleOptions}
          </select>
          <button class="btn-mini save-role" data-action="save-role" data-id="${user.id}">
            Сохранить
          </button>
        </div>
      `;
    }

    return `
      <div class="user-row ${banned ? "banned" : ""}" data-id="${user.id}">
        <div class="user-avatar">${avatarLetter(user.username)}</div>

        <div class="user-row-info">
          <div class="user-row-name-line">
            <span class="user-row-username">${escapeHTML(user.username)}</span>
            ${banned ? '<span class="status-chip banned">🚫 Бан</span>' : ""}
            ${isSelf ? '<span class="status-chip self">Это вы</span>' : ""}
          </div>
          <span class="user-row-email">${escapeHTML(user.email)}</span>
          <div class="user-row-meta">
            <span>${formatDate(user.createdAt)}</span>
            <span class="status-chip ${user.status}">${statusLabel}</span>
            <span class="status-chip role">${escapeHTML(window.Auth.getRoleLabel(user))}</span>
          </div>
          ${roleEditorHTML}
        </div>

        <div class="user-row-actions">
          ${actions}
        </div>
      </div>
    `;
  }

  /* ---------- Строка жалобы ---------- */
  function reportRowHTML(report) {
    const reasonLabel =
      (window.Auth.REPORT_REASONS.find((r) => r.key === report.reason) || {})
        .label || report.reason;

    const typeLabel =
      {
        post: "Пост",
        profile: "Профиль",
        comment: "Комментарий",
        suggestion: "Предложка",
      }[report.type] || report.type;

    const statusLabel =
      {
        pending: "На рассмотрении",
        resolved: "Решена",
        dismissed: "Отклонена",
      }[report.status] || report.status;

    const targetUser = report.targetUserId
      ? window.Auth.getUserById(report.targetUserId)
      : null;
    const canPunish = targetUser ? canModerate(targetUser) : false;
    const whyNoPunish = !targetUser
      ? "Автор не найден"
      : "Автор не ниже по рангу";

    let canRemove = true;
    let whyNoRemove = "";
    if (
      (report.type === "comment" || report.type === "suggestion") &&
      targetUser
    ) {
      canRemove = canModerate(targetUser);
      whyNoRemove = whyNoPunish;
    }

    let actions = "";
    if (report.status === "pending") {
      const removeLabel =
        report.type === "post"
          ? "Удалить пост"
          : report.type === "comment"
            ? "Удалить комментарий"
            : report.type === "suggestion"
              ? "Удалить предложку"
              : null;

      actions = `
        <button class="btn-mini reject" data-action="dismiss-report" data-id="${report.id}">
          Отклонить
        </button>
        ${
          removeLabel
            ? canRemove
              ? `<button class="btn-mini approve" data-action="remove-content" data-id="${report.id}">${removeLabel}</button>`
              : `<button class="btn-mini approve" disabled title="${escapeHTML(whyNoRemove)}">${removeLabel}</button>`
            : ""
        }
        ${
          report.targetUserId
            ? canPunish
              ? `<button class="btn-mini warn" data-action="ban-temp" data-id="${report.id}">Забанить временно</button>`
              : `<button class="btn-mini warn" disabled title="${escapeHTML(whyNoPunish)}">Забанить временно</button>`
            : ""
        }
        ${
          report.targetUserId
            ? canPunish
              ? `<button class="btn-mini danger" data-action="ban-perm" data-id="${report.id}">Забанить навсегда</button>`
              : `<button class="btn-mini danger" disabled title="${escapeHTML(whyNoPunish)}">Забанить навсегда</button>`
            : ""
        }
      `;
    }

    return `
      <div class="report-row" data-id="${report.id}">
        <div class="report-info">
          <div class="report-head">
            <span class="report-type">${typeLabel}</span>
            <span class="status-chip ${report.status}">${statusLabel}</span>
          </div>
          <span class="report-target">${escapeHTML(report.targetTitle || "—")}</span>
          <div class="report-meta">
            <span>От: <b>${escapeHTML(report.reporterName)}</b></span>
            <span>Причина: <b>${escapeHTML(reasonLabel)}</b></span>
            ${targetUser ? `<span>Автор: <b>${escapeHTML(targetUser.username)}</b> · ${escapeHTML(window.Auth.getRoleLabel(targetUser))}</span>` : ""}
            <span>${formatDate(report.createdAt)}</span>
          </div>
          ${report.comment ? `<p class="report-comment">${escapeHTML(report.comment)}</p>` : ""}
        </div>
        <div class="report-actions">${actions}</div>
      </div>
    `;
  }

  /* ---------- Строка предложки ---------- */
  function suggestionRowHTML(item) {
    const meta =
      window.Auth.SUGGESTION_TYPES[item.type] ||
      window.Auth.SUGGESTION_TYPES.other;
    const author = window.Auth.getUserById(item.authorId);
    const canDel = author ? canModerate(author) : true;

    return `
      <div class="report-row suggestion-row" data-id="${item.id}">
        <div class="report-info">
          <div class="report-head">
            <span class="report-type">${meta.icon} ${meta.label}</span>
            <span class="status-chip">${formatDate(item.createdAt)}</span>
          </div>
          <span class="report-target">${escapeHTML(item.title)}</span>
          <div class="report-meta">
            <span>Автор: <b>${escapeHTML(item.authorName)}</b>${author ? " · " + escapeHTML(window.Auth.getRoleLabel(author)) : ""}</span>
            ${item.url ? `<span><a href="${escapeHTML(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(hostname(item.url))}</a></span>` : ""}
          </div>
          ${item.comment ? `<p class="report-comment">${escapeHTML(item.comment)}</p>` : ""}
        </div>
        <div class="report-actions">
          ${
            canDel
              ? `<button class="btn-mini danger" data-action="delete-suggestion" data-id="${item.id}">Удалить</button>`
              : `<button class="btn-mini danger" disabled title="Автор не ниже по рангу">Удалить</button>`
          }
        </div>
      </div>
    `;
  }

  /* ---------- Список ---------- */
  function renderList() {
    if (currentTab === "reports") {
      const reports = window.Auth.listReports();
      if (!reports.length) {
        listEl.innerHTML = "";
        emptyEl.hidden = false;
        return;
      }
      emptyEl.hidden = true;
      listEl.innerHTML = reports.map(reportRowHTML).join("");
      bindReportActions();
      return;
    }

    if (currentTab === "suggestions") {
      const list = window.Auth.listSuggestions().sort(
        (a, b) => b.createdAt - a.createdAt,
      );
      if (!list.length) {
        listEl.innerHTML = "";
        emptyEl.hidden = false;
        return;
      }
      emptyEl.hidden = true;
      listEl.innerHTML = list.map(suggestionRowHTML).join("");
      listEl
        .querySelectorAll('[data-action="delete-suggestion"]')
        .forEach((btn) => {
          btn.addEventListener("click", () => {
            const id = Number(btn.dataset.id);
            if (!confirm("Удалить предложку?")) return;
            const res = window.Auth.removeSuggestion(id);
            if (!res.ok) {
              toast("error", res.error);
              return;
            }
            renderStats();
            renderList();
          });
        });
      return;
    }

    const users = window.Auth.listUsers()
      .filter((u) => u.status === currentTab)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (!users.length) {
      listEl.innerHTML = "";
      emptyEl.hidden = false;
      return;
    }
    emptyEl.hidden = true;

    listEl.innerHTML = users.map(userRowHTML).join("");

    listEl.querySelectorAll(".user-row").forEach((el, i) => {
      el.style.animationDelay = i * 0.05 + "s";
    });

    listEl.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number(btn.dataset.id);
        const action = btn.dataset.action;

        let res;
        if (action === "approve") res = window.Auth.approveUser(id);
        else if (action === "reject") res = window.Auth.rejectUser(id);
        else if (action === "unban") res = window.Auth.unbanUser(id);
        else if (action === "delete") {
          if (!confirm("Удалить пользователя навсегда?")) return;
          res = window.Auth.deleteUser(id);
        } else if (action === "save-role") {
          const select = listEl.querySelector(`[data-role-for="${id}"]`);
          if (!select) return;
          res = window.Auth.setUserRole(id, select.value);
          if (res && res.ok) {
            select.classList.add("saved");
            toast("success", "Роль обновлена");
            setTimeout(() => {
              renderStats();
              renderList();
            }, 900);
            return;
          }
        }

        if (res && !res.ok)
          toast("error", res.error || "Не удалось выполнить действие");

        renderStats();
        renderList();
      });
    });
  }

  /* ---------- Действия с жалобами ---------- */
  function bindReportActions() {
    listEl.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number(btn.dataset.id);
        const action = btn.dataset.action;

        let res;
        if (action === "dismiss-report") {
          res = window.Auth.dismissReport(id);
        } else if (action === "remove-content") {
          if (!confirm("Удалить этот контент?")) return;
          res = window.Auth.resolveReport(id, { type: "remove" });
        } else if (action === "ban-temp") {
          const days = prompt("Забанить на сколько дней?", "7");
          if (!days) return;
          const n = Number(days);
          if (!n || n <= 0)
            return toast("error", "Введи корректное число дней");
          res = window.Auth.resolveReport(id, {
            type: "ban_temp",
            durationMs: n * 24 * 3600 * 1000,
          });
        } else if (action === "ban-perm") {
          if (!confirm("Забанить навсегда?")) return;
          res = window.Auth.resolveReport(id, { type: "ban_perm" });
        }

        if (res && !res.ok)
          toast("error", res.error || "Не удалось выполнить действие");

        renderStats();
        renderList();
      });
    });
  }

  /* ---------- Вкладки ---------- */
  tabsEl.querySelectorAll(".admin-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      tabsEl
        .querySelectorAll(".admin-tab")
        .forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      currentTab = tab.dataset.tab;
      renderList();
    });
  });

  window.addEventListener("auth:change", () => {
    if (checkAccess()) {
      renderStats();
      renderList();
    }
  });

  if (checkAccess()) {
    renderStats();
    renderList();
  }
})();
