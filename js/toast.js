/* ============================================================
   toast.js — красивые уведомления вместо alert()
   ============================================================ */

(function () {
  function ensureContainer() {
    let el = document.getElementById("toast-container");
    if (!el) {
      el = document.createElement("div");
      el.id = "toast-container";
      el.className = "toast-container";
      document.body.appendChild(el);
    }
    return el;
  }

  const ICONS = { success: "✓", error: "✕", info: "ℹ", warning: "⚠" };

  function esc(s) {
    return String(s ?? "").replace(
      /[<>&"]/g,
      (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c],
    );
  }

  function show(message, type = "info", duration = 3200) {
    const container = ensureContainer();
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${ICONS[type] || "•"}</span>
      <span class="toast-text">${esc(message)}</span>
      <button class="toast-close" aria-label="Закрыть">×</button>
    `;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));

    const hide = () => {
      toast.classList.remove("show");
      toast.classList.add("hide");
      setTimeout(() => toast.remove(), 300);
    };

    toast.querySelector(".toast-close").addEventListener("click", hide);
    setTimeout(hide, duration);
    return { hide };
  }

  window.Toast = {
    show,
    success: (m, d) => show(m, "success", d),
    error: (m, d) => show(m, "error", d),
    info: (m, d) => show(m, "info", d),
    warning: (m, d) => show(m, "warning", d),
  };
})();
