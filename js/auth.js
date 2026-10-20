/* ============================================================
   auth.js — авторизация и профиль через Supabase
   ============================================================ */

(function () {
  // Глобальные переменные для кэша текущего пользователя
  let currentUser = null;
  let currentProfile = null;
  let authResolved = false;

  /* ============ ИНИЦИАЛИЗАЦИЯ И СЛУШАТЕЛЬ ============ */

  // Слушаем изменения авторизации (вход, выход, обновление токена)
  window.supabase.auth.onAuthStateChange(async (event, session) => {
    if (session) {
      // Если есть сессия, подгружаем профиль пользователя из таблицы profiles
      const { data, error } = await window.supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (!error && data) {
        currentUser = session.user;
        currentProfile = data;
      }
    } else {
      // Если сессии нет — разлогиниваем
      currentUser = null;
      currentProfile = null;
    }

    authResolved = true;
    emitChange();
    renderAuthSlot();
  });

  // Получить текущего пользователя (синхронно, из кэша)
  function getCurrentUser() {
    if (!currentProfile) return null;

    // Возвращаем объект, совместимый со старым форматом сайта
    return {
      id: currentProfile.id,
      username: currentProfile.username,
      email: currentUser?.email || "",
      role: currentProfile.role || "user",
      bio: currentProfile.bio || "",
      avatar: currentProfile.avatar_url || "",
      banned: currentProfile.banned_until ? true : false,
      banUntil: currentProfile.banned_until,
      banReason: currentProfile.ban_reason,
      createdAt: currentProfile.created_at,
    };
  }

  /* ============ РЕГИСТРАЦИЯ / ВХОД ============ */

  async function register({ username, email, password, passwordConfirm }) {
    if (!username || username.length < 3)
      return { ok: false, error: "Логин — минимум 3 символа" };
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
      return { ok: false, error: "Некорректная почта" };
    if (!password || password.length < 6)
      return { ok: false, error: "Пароль — минимум 6 символов" };
    if (password !== passwordConfirm)
      return { ok: false, error: "Пароли не совпадают" };

    // 1. Создаем пользователя в Auth
    const { data, error } = await window.supabase.auth.signUp({
      email: email,
      password: password,
    });

    if (error) {
      if (error.message.includes("already registered")) {
        return { ok: false, error: "Эта почта уже зарегистрирована" };
      }
      return { ok: false, error: error.message };
    }

    // 2. Создаем профиль в базе
    const { error: profileError } = await window.supabase
      .from("profiles")
      .insert({
        id: data.user.id,
        username: username,
        role: "user",
      });

    if (profileError) {
      if (profileError.code === "23505") {
        return { ok: false, error: "Такой логин уже занят" };
      }
      return { ok: false, error: profileError.message };
    }

    return { ok: true, user: data.user };
  }

  async function login({ email, password }) {
    if (!email || !password) return { ok: false, error: "Заполни все поля" };

    const { data, error } = await window.supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      return { ok: false, error: "Неверная почта или пароль" };
    }

    return { ok: true, user: data.user };
  }

  async function logout() {
    await window.supabase.auth.signOut();
  }

  /* ============ ПРОФИЛЬ ============ */

  function getUserByUsername(username) {
    // Пока это заглушка, работает только если профили загружены (мы это исправим позже)
    return null;
  }

  function getUserById(id) {
    // Заглушка
    return null;
  }

  async function updateProfile(id, { bio, avatar }) {
    const updates = {};
    if (typeof bio === "string") updates.bio = bio;
    if (typeof avatar === "string") updates.avatar_url = avatar;

    const { error } = await window.supabase
      .from("profiles")
      .update(updates)
      .eq("id", id);

    if (error) return { ok: false, error: error.message };

    // Обновляем локальный кэш
    if (currentProfile) {
      currentProfile.bio = updates.bio || currentProfile.bio;
      currentProfile.avatar_url =
        updates.avatar_url || currentProfile.avatar_url;
    }
    emitChange();
    return { ok: true };
  }

  /* ============ ЗАГЛУШКИ ДЛЯ СТАРОГО КОДА ============ */
  // Эти функции мы перепишем на следующем шаге, когда будем переводить посты и комменты на базу.

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
    if (!user || !user.banned) return false;
    if (!user.banUntil) return true;
    return new Date(user.banUntil) > new Date();
  }

  // Заглушки для постов/комментов, чтобы сайт не падал
  function getCustomPosts() {
    return [];
  }
  function getAllPosts() {
    return typeof POSTS !== "undefined" ? POSTS : [];
  }
  function getBookmarks() {
    return [];
  }
  function isBookmarked() {
    return false;
  }
  function getComments() {
    return [];
  }
  function getCommentCount() {
    return 0;
  }

  const REPORT_REASONS = [
    { key: "spam", label: "Спам или реклама" },
    { key: "abuse", label: "Оскорбления / агрессия" },
    { key: "nsfw", label: "Нецензурный контент" },
    { key: "hate", label: "Разжигание ненависти" },
    { key: "fake", label: "Обман / фейк" },
    { key: "other", label: "Другое" },
  ];

  /* ============ НАВБАР И МОДАЛКА ВХОДА ============ */

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
    if (!slot) {
      const navRight = document.querySelector(".nav-right");
      if (!navRight) return;
      slot = navRight.querySelector(".nav-auth");
      if (!slot) {
        slot = document.createElement("div");
        slot.className = "nav-auth";
        navRight.appendChild(slot);
      }
    }

    if (!authResolved) return; // Ждем, пока Supabase проверит сессию

    const user = getCurrentUser();

    if (!user) {
      slot.innerHTML = `
        <button class="auth-btn" id="open-auth">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
            <polyline points="10 17 15 12 10 7"/>
            <line x1="15" y1="12" x2="3" y2="12"/>
          </svg>
          <span class="auth-btn-text">Войти</span>
        </button>
      `;
      slot
        .querySelector("#open-auth")
        ?.addEventListener("click", () => openAuth("login"));
      return;
    }

    const letter = (user.username || "?").charAt(0).toUpperCase();
    const staff = isStaff(user);
    const roleLabel = getRoleLabel(user);

    slot.innerHTML = `
      <div class="user-menu" id="user-menu">
        <button class="user-menu-btn" id="user-menu-toggle">
          <span class="user-avatar">
            ${user.avatar ? '<img src="' + escapeHTMLForSlot(user.avatar) + '" alt="" />' : letter}
          </span>
          <span class="user-name">${escapeHTMLForSlot(user.username)}</span>
          <svg class="caret" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
        <div class="user-dropdown">
          <div class="menu-head">
            <span class="menu-username">${escapeHTMLForSlot(user.username)}</span>
            <span class="menu-role">${escapeHTMLForSlot(roleLabel)}</span>
          </div>

          <a href="profile.html">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            Мой профиль
          </a>

          ${
            staff
              ? `
            <a href="admin.html">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/>
              </svg>
              Панель админа
            </a>
          `
              : ""
          }

          <button class="danger" id="logout-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Выйти
          </button>
        </div>
      </div>
    `;

    const menu = slot.querySelector("#user-menu");
    menu.querySelector("#user-menu-toggle").addEventListener("click", (e) => {
      e.stopPropagation();
      menu.classList.toggle("open");
    });
    document.addEventListener("click", () => menu.classList.remove("open"));
    menu.addEventListener("click", (e) => e.stopPropagation());

    slot.querySelector("#logout-btn").addEventListener("click", async () => {
      await logout();
      menu.classList.remove("open");
    });
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
        <button class="auth-close" data-close aria-label="Закрыть">×</button>
        <div class="auth-body" id="auth-body"></div>
      </div>
    `;
    document.body.appendChild(modal);

    modal
      .querySelectorAll("[data-close]")
      .forEach((el) => el.addEventListener("click", closeAuth));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !modal.hidden) closeAuth();
    });
    return modal;
  }

  function openAuth(view = "login") {
    const modal = ensureModal();
    renderAuthView(view);
    modal.hidden = false;
    requestAnimationFrame(() => modal.classList.add("open"));
    document.body.style.overflow = "hidden";
  }

  function closeAuth() {
    const modal = document.getElementById("auth-modal");
    if (!modal) return;
    modal.classList.remove("open");
    document.body.style.overflow = "";
    setTimeout(() => {
      modal.hidden = true;
    }, 250);
  }

  function renderAuthView(view) {
    const body = document.getElementById("auth-body");
    if (!body) return;

    if (view === "login") body.innerHTML = viewLogin();
    if (view === "register") body.innerHTML = viewRegister();

    const msg = body.querySelector("#auth-msg");
    function showMsg(type, text) {
      if (!msg) return;
      msg.className = "auth-msg show " + type;
      msg.textContent = text;
    }

    body.querySelectorAll("[data-view]").forEach((btn) => {
      btn.addEventListener("click", () => renderAuthView(btn.dataset.view));
    });

    const loginForm = body.querySelector("#login-form");
    if (loginForm) {
      loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const fd = new FormData(loginForm);
        const btn = loginForm.querySelector("button[type=submit]");
        btn.disabled = true;
        btn.textContent = "Входим...";

        const res = await login({
          email: fd.get("email").trim(),
          password: fd.get("password"),
        });

        if (!res.ok) {
          btn.disabled = false;
          btn.textContent = "Войти";
          return showMsg("error", res.error);
        }

        showMsg("success", "Успешный вход!");
        setTimeout(() => closeAuth(), 500);
      });
    }

    const regForm = body.querySelector("#register-form");
    if (regForm) {
      regForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const fd = new FormData(regForm);
        const btn = regForm.querySelector("button[type=submit]");
        btn.disabled = true;
        btn.textContent = "Создаем...";

        const res = await register({
          username: fd.get("username").trim(),
          email: fd.get("email").trim(),
          password: fd.get("password"),
          passwordConfirm: fd.get("passwordConfirm"),
        });

        if (!res.ok) {
          btn.disabled = false;
          btn.textContent = "Отправить заявку";
          return showMsg("error", res.error);
        }

        showMsg("success", "Аккаунт создан! Входим...");
        // Автоматически входим после регистрации
        await login({
          email: fd.get("email").trim(),
          password: fd.get("password"),
        });
        setTimeout(() => closeAuth(), 800);
      });
    }
  }

  function viewLogin() {
    return `
      <h2 class="auth-title">С возвращением</h2>
      <p class="auth-subtitle">Войди, чтобы писать посты и общаться.</p>
      <div class="auth-tabs">
        <button class="auth-tab active" data-view="login">Вход</button>
        <button class="auth-tab" data-view="register">Регистрация</button>
      </div>
      <div class="auth-msg" id="auth-msg"></div>
      <form class="auth-form" id="login-form">
        <div class="field">
          <label>Почта</label>
          <input type="email" name="email" placeholder="you@example.com" required />
        </div>
        <div class="field">
          <label>Пароль</label>
          <input type="password" name="password" placeholder="••••••••" required />
        </div>
        <button type="submit" class="auth-submit">Войти</button>
      </form>
    `;
  }

  function viewRegister() {
    return `
      <h2 class="auth-title">Создать аккаунт</h2>
      <p class="auth-subtitle">Придумай уникальный ник и пароль.</p>
      <div class="auth-tabs">
        <button class="auth-tab" data-view="login">Вход</button>
        <button class="auth-tab active" data-view="register">Регистрация</button>
      </div>
      <div class="auth-msg" id="auth-msg"></div>
      <form class="auth-form" id="register-form">
        <div class="field">
          <label>Логин (Ник)</label>
          <input type="text" name="username" placeholder="username" required minlength="3" />
        </div>
        <div class="field">
          <label>Почта</label>
          <input type="email" name="email" placeholder="you@example.com" required />
        </div>
        <div class="field">
          <label>Пароль</label>
          <input type="password" name="password" placeholder="Минимум 6 символов" required minlength="6" />
        </div>
        <div class="field">
          <label>Подтверждение пароля</label>
          <input type="password" name="passwordConfirm" placeholder="Повтори пароль" required minlength="6" />
        </div>
        <button type="submit" class="auth-submit">Зарегистрироваться</button>
      </form>
    `;
  }

  /* ============ ЭКСПОРТ ============ */

  window.Auth = {
    getCurrentUser,
    register,
    login,
    logout,
    updateProfile,
    isOwner,
    isAdmin,
    isStaff,
    getRoleLabel,
    isBanned,
    getUserByUsername,
    getUserById,
    openAuth, // Добавили, чтобы вызывать из других мест
    REPORT_REASONS,
    // Заглушки
    getCustomPosts,
    getAllPosts,
    getBookmarks,
    isBookmarked,
    getComments,
    getCommentCount,
  };

  // При старте проверяем сессию
  window.addEventListener("auth:change", renderAuthSlot);
})();
