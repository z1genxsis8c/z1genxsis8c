/* ============================================================
   report-modal.js — модалка жалобы
   ============================================================ */

(function () {
  function escapeHTML(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  const TYPE_LABEL = {
    post: "Пост",
    profile: "Профиль",
    comment: "Комментарий",
    suggestion: "Предложка",
  };

  let modalEl = null;
  let onSubmit = null;

  function ensure() {
    if (modalEl) return modalEl;

    modalEl = document.createElement("div");
    modalEl.className = "report-modal";
    modalEl.hidden = true;
    modalEl.innerHTML = `
      <div class="report-backdrop" data-close></div>
      <div class="report-window">
        <button class="report-close" data-close>×</button>
        <div class="report-body">
          <h2 class="report-title">Пожаловаться</h2>
          <p class="report-subtitle" id="report-target"></p>

          <div class="auth-msg" id="report-msg"></div>

          <form class="report-form" id="report-form">
            <label class="report-label">Причина</label>
            <div class="report-reasons" id="report-reasons"></div>

            <label class="report-label" for="report-comment">Комментарий (необязательно)</label>
            <textarea id="report-comment" maxlength="500" rows="3"
              placeholder="Опиши подробнее, что не так…"></textarea>

            <button type="submit" class="auth-submit">Отправить жалобу</button>
          </form>
        </div>
      </div>
    `;
    document.body.appendChild(modalEl);

    modalEl.querySelectorAll("[data-close]").forEach((el) => {
      el.addEventListener("click", close);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !modalEl.hidden) close();
    });

    const reasonsEl = modalEl.querySelector("#report-reasons");
    const reasons = (window.Auth && window.Auth.REPORT_REASONS) || [];
    reasonsEl.innerHTML = reasons
      .map(
        (r, i) => `
      <label class="reason-option">
        <input type="radio" name="reason" value="${r.key}" ${i === 0 ? "checked" : ""} />
        <span>${escapeHTML(r.label)}</span>
      </label>
    `,
      )
      .join("");

    modalEl.querySelector("#report-form").addEventListener("submit", (e) => {
      e.preventDefault();
      if (onSubmit) onSubmit();
    });

    return modalEl;
  }

  function open(options) {
    const me = window.Auth && window.Auth.getCurrentUser();
    if (!me) {
      alert("Войди в аккаунт, чтобы пожаловаться.");
      return;
    }

    const modal = ensure();
    const msg = modal.querySelector("#report-msg");
    msg.className = "auth-msg";
    msg.textContent = "";

    const targetEl = modal.querySelector("#report-target");
    const label = TYPE_LABEL[options.type] || "Объект";
    const preview = options.targetTitle ? options.targetTitle : "—";
    targetEl.textContent = label + ": " + preview;

    const commentEl = modal.querySelector("#report-comment");
    commentEl.value = "";

    onSubmit = () => {
      const reasonKey = modal.querySelector(
        'input[name="reason"]:checked',
      ).value;
      if (!reasonKey) return;

      const res = window.Auth.createReport({
        type: options.type,
        targetId: options.targetId ?? null,
        targetUserId: options.targetUserId ?? null,
        targetTitle: options.targetTitle || "",
        reason: reasonKey,
        comment: commentEl.value.trim(),
      });

      if (!res.ok) {
        msg.className = "auth-msg show error";
        msg.textContent = res.error;
        return;
      }

      msg.className = "auth-msg show success";
      msg.textContent = "Жалоба отправлена. Спасибо!";
      if (options.onSuccess) options.onSuccess();

      setTimeout(() => close(), 900);
    };

    modal.hidden = false;
    requestAnimationFrame(() => modal.classList.add("open"));
    document.body.style.overflow = "hidden";
  }

  function close() {
    if (!modalEl) return;
    modalEl.classList.remove("open");
    document.body.style.overflow = "";
    setTimeout(() => {
      modalEl.hidden = true;
    }, 250);
  }

  window.ReportModal = { open, close };
})();
