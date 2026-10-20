/* ============================================================
   auth.js — авторизация, посты, комменты, реакции (Supabase)
   ============================================================ */

(function () {
  let currentUser = null;
  let currentProfile = null;
  let authResolved = false;

  /* ============ ИНИЦИАЛИЗАЦИЯ ============ */
  if (window.supabase && window.supabase.auth) {
    window.supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        const { data } = await window.supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();
        currentUser = session.user;
        currentProfile = data;
      } else {
        currentUser = null;
        currentProfile = null;
      }
      authResolved = true;
      emitChange();
      renderAuthSlot();
    });
  } else {
    authResolved = true;
    setTimeout(renderAuthSlot, 0);
  }

  function getCurrentUser() {
    if (!currentProfile) return null;
    return {
      id: currentProfile.id,
      username: currentProfile.username,
      email: currentUser?.email || "",
      role: currentProfile.role || "user",
      bio: currentProfile.bio || "",
      avatar: currentProfile.avatar_url || "",
      banned: currentProfile.banned_until ? true : false,
      createdAt: currentProfile.created_at,
    };
  }

  /* ============ АВТОРИЗАЦИЯ ============ */
  async function register({ username, email, password }) {
    const { data, error } = await window.supabase.auth.signUp({
      email,
      password,
    });
    if (error)
      return {
        ok: false,
        error: error.message.includes("already")
          ? "Почта занята"
          : error.message,
      };

    const { error: profileError } = await window.supabase
      .from("profiles")
      .insert({ id: data.user.id, username });
    if (profileError) return { ok: false, error: "Ник уже занят" };
    return { ok: true };
  }

  async function login({ email, password }) {
    const { error } = await window.supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return { ok: false, error: "Неверная почта или пароль" };
    return { ok: true };
  }

  async function logout() {
    await window.supabase.auth.signOut();
  }

  /* ============ ПОСТЫ ============ */
  async function getAllPosts() {
    const { data } = await window.supabase
      .from("posts")
      .select("*, profiles(username, avatar_url)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    // Преобразуем структуру из базы в формат, который ждет твой старый код
    return (data || []).map((p) => ({
      id: p.id,
      title: p.title,
      body: p.body,
      excerpt: p.excerpt,
      category: p.category,
      tags: p.tags,
      image: p.image_url,
      views: p.views,
      date: p.created_at,
      isCustom: true,
      author: {
        name: p.profiles?.username || "Unknown",
        avatar: p.profiles?.avatar_url || "",
      },
    }));
  }

  async function addCustomPost({ title, excerpt, body, category, tags }) {
    const { error } = await window.supabase.from("posts").insert({
      author_id: currentProfile.id,
      title,
      excerpt,
      body,
      category,
      tags,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  /* ============ КОММЕНТАРИИ ============ */
  async function listComments(postId) {
    const { data } = await window.supabase
      .from("comments")
      .select("*, profiles(username, avatar_url)")
      .eq("post_id", postId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    return (data || []).map((c) => ({
      id: c.id,
      postId: c.post_id,
      parentId: c.parent_id,
      text: c.body,
      createdAt: new Date(c.created_at).getTime(),
      authorId: c.author_id,
      authorName: c.profiles?.username || "Unknown",
      deleted: false,
    }));
  }

  async function addComment(postId, text, parentId = null) {
    if (!currentProfile) return { ok: false, error: "Войди в аккаунт" };

    // Если postId начинается с "sug_", значит это комментарий к предложке
    const isSuggestion = String(postId).startsWith("sug_");
    const realId = isSuggestion ? postId.replace("sug_", "") : postId;

    const { error } = await window.supabase.from("comments").insert({
      author_id: currentProfile.id,
      post_id: isSuggestion ? null : realId,
      suggestion_id: isSuggestion ? realId : null,
      parent_id: parentId,
      body: text,
    });

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  async function getCommentCount(postId) {
    const isSuggestion = String(postId).startsWith("sug_");
    const realId = isSuggestion ? postId.replace("sug_", "") : postId;

    let query = window.supabase
      .from("comments")
      .select("*", { count: "exact", head: true })
      .is("deleted_at", null);
    if (isSuggestion) query = query.eq("suggestion_id", realId);
    else query = query.eq("post_id", realId);

    const { count } = await query;
    return count || 0;
  }

  /* ============ ЗАГЛУШКИ (чтобы старый код не падал) ============ */
  function isOwner(user) {
    return user?.role === "owner";
  }
  function isAdmin(user) {
    return user?.role === "admin" || user?.role === "owner";
  }
  function isStaff(user) {
    return ["owner", "admin", "moderator"].includes(user?.role);
  }
  function getRoleLabel(user) {
    if (!user) return "";
    const r = {
      owner: "OWNER",
      admin: "ADMIN",
      moderator: "MODERATOR",
      user: "USER",
    };
    return r[user.role] || "USER";
  }
  function isBanned(user) {
    return false;
  } // Упрощенно

  function getBookmarks() {
    return [];
  }
  function isBookmarked() {
    return false;
  }
  function toggleBookmark() {
    return { ok: false, error: "В разработке" };
  }

  const REPORT_REASONS = [
    { key: "spam", label: "Спам или реклама" },
    { key: "abuse", label: "Оскорбления / агрессия" },
    { key: "other", label: "Другое" },
  ];

  /* ============ НАВБАР И UI ============ */
  function escapeHTMLForSlot(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function emitChange() {
    window.dispatchEvent(new CustomEvent("auth:change"));
  }

  function renderAuthSlot() {
    let slot = document.getElementById("nav-auth");
    if (!slot) return;

    if (!authResolved) {
      setTimeout(renderAuthSlot, 1000);
      return;
    }

    const user = getCurrentUser();

    if (!user) {
      slot.innerHTML = `
        <button class="auth-btn" id="open-auth">
          <span class="auth-btn-text">Войти</span>
        </button>
      `;
      slot
        .querySelector("#open-auth")
        ?.addEventListener("click", () => openAuth("login"));
      return;
    }

    const letter = (user.username || "?").charAt(0).toUpperCase();
    slot.innerHTML = `
      <div class="user-menu" id="user-menu">
        <button class="user-menu-btn" id="user-menu-toggle">
          <span class="user-avatar">${user.avatar ? '<img src="' + escapeHTMLForSlot(user.avatar) + '" />' : letter}</span>
          <span class="user-name">${escapeHTMLForSlot(user.username)}</span>
        </button>
        <div class="user-dropdown">
          <a href="profile.html">Мой профиль</a>
          ${isStaff(user) ? `<a href="admin.html">Панель админа</a>` : ""}
          <button class="danger" id="logout-btn">Выйти</button>
        </div>
      </div>
    `;

    const menu = slot.querySelector("#user-menu");
    menu.querySelector("#user-menu-toggle").addEventListener("click", (e) => {
      e.stopPropagation();
      menu.classList.toggle("open");
    });
    document.addEventListener("click", () => menu.classList.remove("open"));
    slot.querySelector("#logout-btn").addEventListener("click", () => logout());
  }

  function ensureModal() {
    let modal = document.getElementById("auth-modal");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "auth-modal";
    modal.className = "auth-modal";
    modal.hidden = true;
    modal.innerHTML = `
      <div class="auth-backdrop" data-close></div>
      <div class="auth-window">
        <button class="auth-close" data-close>×</button>
        <div class="auth-body" id="auth-body"></div>
      </div>
    `;
    document.body.appendChild(modal);
    modal
      .querySelectorAll("[data-close]")
      .forEach((el) => el.addEventListener("click", closeAuth));
    return modal;
  }

  function openAuth(view = "login") {
    const modal = ensureModal();
    renderAuthView(view);
    modal.hidden = false;
    requestAnimationFrame(() => modal.classList.add("open"));
  }
  function closeAuth() {
    const modal = document.getElementById("auth-modal");
    if (modal) {
      modal.classList.remove("open");
      setTimeout(() => (modal.hidden = true), 250);
    }
  }

  function renderAuthView(view) {
    const body = document.getElementById("auth-body");
    body.innerHTML = view === "login" ? viewLogin() : viewRegister();

    body.querySelectorAll("[data-view]").forEach((btn) => {
      btn.addEventListener("click", () => renderAuthView(btn.dataset.view));
    });

    const form = body.querySelector("form");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const btn = form.querySelector("button[type=submit]");
      btn.disabled = true;
      btn.textContent = "Загрузка...";

      let res;
      if (view === "login") {
        res = await login({
          email: fd.get("email"),
          password: fd.get("password"),
        });
      } else {
        res = await register({
          username: fd.get("username"),
          email: fd.get("email"),
          password: fd.get("password"),
        });
        if (res.ok)
          await login({ email: fd.get("email"), password: fd.get("password") });
      }

      if (!res.ok) {
        btn.disabled = false;
        btn.textContent = view === "login" ? "Войти" : "Зарегистрироваться";
        const msg = body.querySelector("#auth-msg");
        msg.className = "auth-msg show error";
        msg.textContent = res.error;
      } else {
        closeAuth();
      }
    });
  }

  function viewLogin() {
    return `
      <h2 class="auth-title">Вход</h2>
      <div class="auth-tabs">
        <button class="auth-tab active" data-view="login">Вход</button>
        <button class="auth-tab" data-view="register">Регистрация</button>
      </div>
      <div class="auth-msg" id="auth-msg"></div>
      <form class="auth-form">
        <div class="field"><label>Почта</label><input type="email" name="email" required /></div>
        <div class="field"><label>Пароль</label><input type="password" name="password" required /></div>
        <button type="submit" class="auth-submit">Войти</button>
      </form>
    `;
  }

  function viewRegister() {
    return `
      <h2 class="auth-title">Регистрация</h2>
      <div class="auth-tabs">
        <button class="auth-tab" data-view="login">Вход</button>
        <button class="auth-tab active" data-view="register">Регистрация</button>
      </div>
      <div class="auth-msg" id="auth-msg"></div>
      <form class="auth-form">
        <div class="field"><label>Ник</label><input type="text" name="username" required /></div>
        <div class="field"><label>Почта</label><input type="email" name="email" required /></div>
        <div class="field"><label>Пароль</label><input type="password" name="password" required minlength="6" /></div>
        <button type="submit" class="auth-submit">Зарегистрироваться</button>
      </form>
    `;
  }

  window.Auth = {
    getCurrentUser,
    register,
    login,
    logout,
    isOwner,
    isAdmin,
    isStaff,
    getRoleLabel,
    isBanned,
    getAllPosts,
    addCustomPost,
    listComments,
    addComment,
    getCommentCount,
    getBookmarks,
    isBookmarked,
    toggleBookmark,
    REPORT_REASONS,
    openAuth,
  };

  window.addEventListener("auth:change", renderAuthSlot);
  setTimeout(renderAuthSlot, 100);
})();
