/* ============================================================
   auth.js — авторизация, профиль, роли, баны, жалобы, посты
   ============================================================ */

(function () {
  /* ============ КОНФИГ ============ */
  const CONFIG = {
    owners: ["z1genxsis8c"],
    emailInConsole: true,
  };

  const ROLES = {
    owner: { label: "OWNER", level: 100 },
    admin: { label: "ADMIN", level: 80 },
    moderator: { label: "MODERATOR", level: 50 },
    user: { label: "USER", level: 10 },
  };

  const SUGGESTION_TYPES = {
    movie: { label: "Фильм", icon: "🎬", color: "#a78bfa" },
    anime: { label: "Аниме", icon: "🌸", color: "#e879f9" },
    series: { label: "Сериал", icon: "📺", color: "#60a5fa" },
    cartoon: { label: "Мультик", icon: "🧸", color: "#fbbf24" },
    youtube: { label: "YouTube", icon: "▶️", color: "#f87171" },
    tiktok: { label: "TikTok", icon: "🎵", color: "#22d3ee" },
    news: { label: "Новость", icon: "📰", color: "#4ade80" },
    other: { label: "Другое", icon: "💡", color: "#94a3b8" },
  };

  /* ============ КЛЮЧИ ============ */
  const USERS_KEY = "site-users";
  const SESSION_KEY = "site-session";
  const RESET_KEY = "site-reset-codes";
  const REPORTS_KEY = "site-reports";
  const REMOVED_POSTS = "site-removed-posts";
  const PROFILE_LIKES = "profile-reactions";
  const COMMENTS_KEY = "site-comments";
  const COMMENTS_REACTIONS_KEY = "comments-reactions";
  const SUGGESTIONS_KEY = "site-suggestions";
  const SUGGESTIONS_REACTIONS_KEY = "suggestions-reactions";
  const CUSTOM_POSTS_KEY = "site-custom-posts";
  const BOOKMARKS_KEY = "site-bookmarks";

  function _load(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch {
      return fallback;
    }
  }
  function _save(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }

  function loadUsers() {
    return _load(USERS_KEY, []);
  }
  function saveUsers(u) {
    _save(USERS_KEY, u);
  }
  function loadResets() {
    return _load(RESET_KEY, {});
  }
  function saveResets(r) {
    _save(RESET_KEY, r);
  }
  function loadReports() {
    return _load(REPORTS_KEY, []);
  }
  function saveReports(r) {
    _save(REPORTS_KEY, r);
  }

  function loadComments() {
    return _load(COMMENTS_KEY, {});
  }
  function saveComments(c) {
    _save(COMMENTS_KEY, c);
  }
  function loadCommentReactions() {
    return _load(COMMENTS_REACTIONS_KEY, {});
  }
  function saveCommentReactions(r) {
    _save(COMMENTS_REACTIONS_KEY, r);
  }

  function loadSuggestions() {
    return _load(SUGGESTIONS_KEY, []);
  }
  function saveSuggestions(s) {
    _save(SUGGESTIONS_KEY, s);
  }
  function loadSuggestionReactions() {
    return _load(SUGGESTIONS_REACTIONS_KEY, {});
  }
  function saveSuggestionReactions(r) {
    _save(SUGGESTIONS_REACTIONS_KEY, r);
  }

  function hash(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) {
      h = (h << 5) + h + str.charCodeAt(i);
      h = h & h;
    }
    return "h" + (h >>> 0).toString(36) + "_" + str.length;
  }

  /* ============ СЕССИЯ ============ */
  function getCurrentUser() {
    try {
      const session = _load(SESSION_KEY, null);
      if (!session) return null;
      const u = loadUsers().find((x) => x.id === session.id) || null;
      return u ? ensureRole(u) : null;
    } catch {
      return null;
    }
  }
  function setSession(user) {
    _save(SESSION_KEY, { id: user.id, ts: Date.now() });
    emitChange();
  }
  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
    emitChange();
  }

  /* ============ РОЛИ ============ */
  function ensureRole(user) {
    if (!user) return user;
    if (!user.role) {
      user.role = CONFIG.owners.includes(user.username) ? "owner" : "user";
    }
    return user;
  }
  function isOwner(user) {
    return !!user && user.role === "owner";
  }
  function isAdmin(user) {
    return !!user && (user.role === "owner" || user.role === "admin");
  }
  function isStaff(user) {
    return (
      !!user &&
      (user.role === "owner" ||
        user.role === "admin" ||
        user.role === "moderator")
    );
  }
  function getRoleLabel(user) {
    if (!user) return "";
    const r = ROLES[user.role];
    return r ? r.label : user.role || "USER";
  }

  function getRoleLevel(roleKey) {
    if (!roleKey) return 0;
    const r = ROLES[String(roleKey).toLowerCase()];
    return r ? r.level : 0;
  }
  function _userLevel(user) {
    if (!user) return 0;
    return getRoleLevel(user.role);
  }
  function canModerateUser(actor, target) {
    if (!actor || !target) return false;
    if (!isStaff(actor)) return false;
    if (actor.id === target.id) return false;
    if (actor.role === "owner") return true;
    return _userLevel(actor) > _userLevel(target);
  }
  function canChangeUserRole(actor, target, newRoleKey) {
    if (!actor || !target) return false;
    if (!isStaff(actor)) return false;
    if (actor.id === target.id) return false;

    const newLvl = getRoleLevel(newRoleKey);
    if (newLvl > _userLevel(actor)) return false;

    if (actor.role === "owner") return true;
    return _userLevel(actor) > _userLevel(target);
  }

  function setUserRole(id, role) {
    const me = getCurrentUser();
    if (!me) return { ok: false, error: "Нужно войти в аккаунт" };

    const users = loadUsers();
    const u = users.find((x) => x.id === id);
    if (!u) return { ok: false, error: "Пользователь не найден" };

    const clean = String(role || "user")
      .trim()
      .toLowerCase()
      .slice(0, 16);
    const finalRole = clean in ROLES ? clean : "user";

    if (!canChangeUserRole(me, u, finalRole)) {
      return {
        ok: false,
        error: "Недостаточно прав: цель не ниже по рангу или роль выше вашей",
      };
    }

    if (u.role === "owner" && finalRole !== "owner") {
      const owners = users.filter((x) => x.role === "owner");
      if (owners.length <= 1) {
        return { ok: false, error: "Нельзя снять роль с единственного OWNER" };
      }
    }

    u.role = finalRole;
    saveUsers(users);
    emitChange();
    return { ok: true };
  }

  /* ============ БАНЫ ============ */
  function isBanned(user) {
    if (!user || !user.banned) return false;
    if (user.banUntil === null || user.banUntil === undefined) return true;
    return user.banUntil > Date.now();
  }
  function banUser(id, durationMs, reason) {
    const me = getCurrentUser();
    if (!me) return { ok: false, error: "Нужно войти в аккаунт" };

    const users = loadUsers();
    const u = users.find((x) => x.id === id);
    if (!u) return { ok: false, error: "Пользователь не найден" };

    if (!canModerateUser(me, u)) {
      return { ok: false, error: "Недостаточно прав: цель не ниже по рангу" };
    }

    u.banned = true;
    u.banUntil = durationMs === null ? null : Date.now() + durationMs;
    u.banReason = String(reason || "").slice(0, 500);
    u.bannedAt = Date.now();
    saveUsers(users);
    emitChange();
    return { ok: true };
  }
  function unbanUser(id) {
    const me = getCurrentUser();
    if (!me) return { ok: false, error: "Нужно войти в аккаунт" };

    const users = loadUsers();
    const u = users.find((x) => x.id === id);
    if (!u) return { ok: false, error: "Пользователь не найден" };

    if (!canModerateUser(me, u)) {
      return { ok: false, error: "Недостаточно прав: цель не ниже по рангу" };
    }

    delete u.banned;
    delete u.banUntil;
    delete u.banReason;
    delete u.bannedAt;
    saveUsers(users);
    emitChange();
    return { ok: true };
  }

  /* ============ АВАТАРКА ============ */
  function processAvatarFile(file, maxSize = 400) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith("image/"))
        return reject(new Error("Можно загрузить только изображение"));
      if (file.size > 8 * 1024 * 1024)
        return reject(new Error("Файл больше 8 МБ"));
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const side = Math.min(img.width, img.height);
          const sx = (img.width - side) / 2;
          const sy = (img.height - side) / 2;
          canvas.width = maxSize;
          canvas.height = maxSize;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, sx, sy, side, side, 0, 0, maxSize, maxSize);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        };
        img.onerror = () => reject(new Error("Ошибка чтения файла"));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error("Ошибка чтения файла"));
      reader.readAsDataURL(file);
    });
  }

  /* ============ РЕГИСТРАЦИЯ / ВХОД ============ */
  function register({ username, email, password, passwordConfirm }) {
    if (!username || username.length < 3)
      return { ok: false, error: "Логин — минимум 3 символа" };
    if (!/^[a-zA-Z0-9_-]+$/.test(username))
      return { ok: false, error: "Логин: только буквы, цифры, _ и -" };
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
      return { ok: false, error: "Некорректная почта" };
    if (!password || password.length < 6)
      return { ok: false, error: "Пароль — минимум 6 символов" };
    if (password !== passwordConfirm)
      return { ok: false, error: "Пароли не совпадают" };

    const users = loadUsers();
    if (users.some((u) => u.username.toLowerCase() === username.toLowerCase()))
      return { ok: false, error: "Такой логин уже занят" };
    if (users.some((u) => u.email.toLowerCase() === email.toLowerCase()))
      return { ok: false, error: "Эта почта уже зарегистрирована" };

    const isOwnerUser = CONFIG.owners.includes(username);
    const user = {
      id: Date.now(),
      username,
      email,
      passwordHash: hash(password),
      status: isOwnerUser ? "approved" : "pending",
      role: isOwnerUser ? "owner" : "user",
      bio: "",
      avatar: "",
      profileLikes: 0,
      socials: {},
      createdAt: new Date().toISOString(),
    };
    users.push(user);
    saveUsers(users);

    if (CONFIG.emailInConsole && !isOwnerUser) {
      console.log(
        "%c📧 [DEMO] Новая заявка",
        "color:#a78bfa;font-weight:bold",
        "\nЛогин: " + username + "\nПочта: " + email,
      );
    }
    return { ok: true, user };
  }

  function login({ username, password }) {
    if (!username || !password) return { ok: false, error: "Заполни все поля" };
    const users = loadUsers();
    const user = users.find(
      (u) =>
        u.username.toLowerCase() === username.toLowerCase() ||
        u.email.toLowerCase() === username.toLowerCase(),
    );
    if (!user) return { ok: false, error: "Пользователь не найден" };
    if (user.passwordHash !== hash(password))
      return { ok: false, error: "Неверный пароль" };
    if (user.status === "pending")
      return { ok: false, error: "Заявка ещё на рассмотрении." };
    if (user.status === "rejected")
      return { ok: false, error: "Доступ отклонён." };

    ensureRole(user);
    saveUsers(users);
    setSession(user);
    return { ok: true, user };
  }
  function logout() {
    clearSession();
  }

  /* ============ ВОССТАНОВЛЕНИЕ ПАРОЛЯ ============ */
  function requestReset(email) {
    if (!email) return { ok: false, error: "Укажи почту" };
    const users = loadUsers();
    const user = users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase(),
    );
    if (!user) return { ok: false, error: "Почта не найдена" };

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const resets = loadResets();
    resets[email.toLowerCase()] = {
      code,
      expires: Date.now() + 15 * 60 * 1000,
    };
    saveResets(resets);

    if (CONFIG.emailInConsole) {
      console.log(
        "%c📧 [DEMO] Код восстановления",
        "color:#a78bfa;font-weight:bold",
        "\nКому: " + email + "\nКод: " + code,
      );
    }
    return { ok: true, code };
  }
  function verifyResetCode(email, code) {
    const r = loadResets()[email.toLowerCase()];
    if (!r) return { ok: false, error: "Код не найден" };
    if (r.expires < Date.now()) return { ok: false, error: "Код истёк" };
    if (r.code !== code) return { ok: false, error: "Неверный код" };
    return { ok: true };
  }
  function resetPassword(email, code, newPassword, confirm) {
    const check = verifyResetCode(email, code);
    if (!check.ok) return check;
    if (!newPassword || newPassword.length < 6)
      return { ok: false, error: "Пароль — минимум 6 символов" };
    if (newPassword !== confirm)
      return { ok: false, error: "Пароли не совпадают" };

    const users = loadUsers();
    const user = users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase(),
    );
    if (!user) return { ok: false, error: "Пользователь не найден" };

    user.passwordHash = hash(newPassword);
    saveUsers(users);

    const resets = loadResets();
    delete resets[email.toLowerCase()];
    saveResets(resets);
    return { ok: true };
  }

  /* ============ ЗАЯВКИ ============ */
  function listUsers() {
    return loadUsers();
  }

  function approveUser(id) {
    const me = getCurrentUser();
    if (!me || !isAdmin(me)) return { ok: false, error: "Недостаточно прав" };

    const users = loadUsers();
    const u = users.find((x) => x.id === id);
    if (!u) return { ok: false, error: "Пользователь не найден" };

    if (u.status !== "pending" && u.role !== "user") {
      if (!canModerateUser(me, u)) {
        return { ok: false, error: "Недостаточно прав: цель не ниже по рангу" };
      }
    }

    u.status = "approved";
    saveUsers(users);
    emitChange();
    return { ok: true };
  }

  function rejectUser(id) {
    const me = getCurrentUser();
    if (!me || !isAdmin(me)) return { ok: false, error: "Недостаточно прав" };

    const users = loadUsers();
    const u = users.find((x) => x.id === id);
    if (!u) return { ok: false, error: "Пользователь не найден" };

    if (u.status !== "pending") {
      if (!canModerateUser(me, u)) {
        return { ok: false, error: "Недостаточно прав: цель не ниже по рангу" };
      }
    }

    u.status = "rejected";
    saveUsers(users);
    emitChange();
    return { ok: true };
  }

  function deleteUser(id) {
    const me = getCurrentUser();
    if (!me || !isAdmin(me)) return { ok: false, error: "Недостаточно прав" };

    const users = loadUsers();
    const u = users.find((x) => x.id === id);
    if (!u) return { ok: false, error: "Пользователь не найден" };

    if (!canModerateUser(me, u)) {
      return { ok: false, error: "Недостаточно прав: цель не ниже по рангу" };
    }

    saveUsers(users.filter((x) => x.id !== id));
    emitChange();
    return { ok: true };
  }

  /* ============ ПРОФИЛЬ ============ */
  function getUserByUsername(username) {
    if (!username) return null;
    const u = loadUsers().find(
      (x) => x.username.toLowerCase() === username.toLowerCase(),
    );
    return u ? ensureRole(u) : null;
  }
  function getUserById(id) {
    const u = loadUsers().find((x) => x.id === id);
    return u ? ensureRole(u) : null;
  }
  function updateProfile(id, { bio, avatar, socials }) {
    const users = loadUsers();
    const u = users.find((x) => x.id === id);
    if (!u) return { ok: false, error: "Пользователь не найден" };

    if (typeof bio === "string") {
      if (bio.length > 800)
        return { ok: false, error: "Максимум 800 символов" };
      u.bio = bio;
    }
    if (typeof avatar === "string") u.avatar = avatar;

    if (socials && typeof socials === "object") {
      u.socials = u.socials || {};
      for (const key in socials) {
        if (socials[key]) u.socials[key] = socials[key];
        else delete u.socials[key];
      }
    }

    saveUsers(users);
    emitChange();
    return { ok: true };
  }

  /* ============ ЛАЙКИ ПРОФИЛЯ ============ */
  function loadProfileLikes() {
    return _load(PROFILE_LIKES, {});
  }
  function saveProfileLikes(r) {
    _save(PROFILE_LIKES, r);
  }
  function hasLikedProfile(targetId) {
    return !!loadProfileLikes()[targetId];
  }
  function getProfileLikeCount(user) {
    if (!user) return 0;
    return (user.profileLikes || 0) + (hasLikedProfile(user.id) ? 1 : 0);
  }
  function toggleProfileLike(targetId) {
    const r = loadProfileLikes();
    if (r[targetId]) delete r[targetId];
    else r[targetId] = true;
    saveProfileLikes(r);
    emitChange();
  }

  /* ============ КОММЕНТАРИИ ============ */
  function listComments(postId) {
    const all = loadComments();
    return (all[postId] || []).slice();
  }
  function getCommentCount(postId) {
    const all = loadComments();
    return (all[postId] || []).filter((c) => !c.deleted).length;
  }
  function addComment(postId, text, parentId = null) {
    const me = getCurrentUser();
    if (!me) return { ok: false, error: "Войди, чтобы комментировать" };
    if (isBanned(me))
      return { ok: false, error: "Ты забанен и не можешь писать" };

    text = String(text || "").trim();
    if (!text) return { ok: false, error: "Пустой комментарий" };
    if (text.length > 1500)
      return { ok: false, error: "Максимум 1500 символов" };

    const all = loadComments();
    const list = all[postId] || [];

    let actualParent = null;
    if (parentId) {
      const target = list.find((c) => c.id === parentId);
      if (!target) return { ok: false, error: "Родитель не найден" };
      actualParent = target.parentId || target.id;
    }

    const comment = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      postId,
      parentId: actualParent,
      authorId: me.id,
      authorName: me.username,
      text,
      createdAt: Date.now(),
      likes: 0,
      dislikes: 0,
      deleted: false,
    };
    list.push(comment);
    all[postId] = list;
    saveComments(all);
    emitChange();
    return { ok: true, comment };
  }
  function removeComment(commentId) {
    const me = getCurrentUser();
    if (!me) return { ok: false, error: "Нужно войти" };

    const all = loadComments();
    let found = false;
    for (const pid in all) {
      const c = all[pid].find((x) => x.id === commentId);
      if (c) {
        if (c.authorId !== me.id) {
          const author = getUserById(c.authorId);
          if (!author || !canModerateUser(me, author)) {
            return {
              ok: false,
              error: "Недостаточно прав для удаления этого комментария",
            };
          }
        }
        c.deleted = true;
        c.text = "";
        found = true;
        break;
      }
    }
    if (found) {
      saveComments(all);
      emitChange();
    }
    return { ok: found };
  }
  function getCommentReaction(commentId) {
    return loadCommentReactions()[commentId] || null;
  }
  function getCommentCounts(comment) {
    const r = loadCommentReactions()[comment.id];
    return {
      likes: (comment.likes || 0) + (r === "like" ? 1 : 0),
      dislikes: (comment.dislikes || 0) + (r === "dislike" ? 1 : 0),
      userReaction: r || null,
    };
  }
  function reactToComment(commentId, type) {
    const me = getCurrentUser();
    if (!me) return { ok: false, error: "Войди" };
    const r = loadCommentReactions();
    if (r[commentId] === type) delete r[commentId];
    else r[commentId] = type;
    saveCommentReactions(r);
    emitChange();
    return { ok: true };
  }

  /* ============ ПРЕДЛОЖКА ============ */
  function listSuggestions() {
    return loadSuggestions()
      .filter((s) => !s.deleted)
      .sort((a, b) => b.createdAt - a.createdAt);
  }
  function getSuggestionById(id) {
    const s = loadSuggestions().find((x) => x.id === id);
    return s || null;
  }
  function addSuggestion({ type, title, url, comment }) {
    const me = getCurrentUser();
    if (!me) return { ok: false, error: "Войди, чтобы предложить" };
    if (isBanned(me))
      return { ok: false, error: "Ты забанен и не можешь предлагать" };

    type = String(type || "").trim();
    if (!(type in SUGGESTION_TYPES)) return { ok: false, error: "Выбери тип" };

    title = String(title || "").trim();
    if (title.length < 2)
      return { ok: false, error: "Название — минимум 2 символа" };
    if (title.length > 200)
      return { ok: false, error: "Название — максимум 200 символов" };

    comment = String(comment || "").trim();
    if (comment.length > 1000)
      return { ok: false, error: "Комментарий — максимум 1000 символов" };

    url = String(url || "")
      .trim()
      .slice(0, 500);
    if (url && !/^https?:\/\//i.test(url)) url = "https://" + url;

    const list = loadSuggestions();
    const item = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      type,
      title,
      url,
      comment,
      authorId: me.id,
      authorName: me.username,
      createdAt: Date.now(),
      likes: 0,
      dislikes: 0,
      deleted: false,
    };
    list.push(item);
    saveSuggestions(list);
    emitChange();
    return { ok: true, item };
  }
  function removeSuggestion(id) {
    const me = getCurrentUser();
    if (!me) return { ok: false, error: "Нужно войти" };

    const list = loadSuggestions();
    const s = list.find((x) => x.id === id);
    if (!s) return { ok: false, error: "Предложение не найдено" };

    if (s.authorId !== me.id) {
      const author = getUserById(s.authorId);
      if (!author || !canModerateUser(me, author)) {
        return { ok: false, error: "Недостаточно прав" };
      }
    }

    s.deleted = true;
    saveSuggestions(list);
    emitChange();
    return { ok: true };
  }
  function getSuggestionReaction(id) {
    return loadSuggestionReactions()[id] || null;
  }
  function getSuggestionCounts(item) {
    const r = loadSuggestionReactions()[item.id];
    return {
      likes: (item.likes || 0) + (r === "like" ? 1 : 0),
      dislikes: (item.dislikes || 0) + (r === "dislike" ? 1 : 0),
      userReaction: r || null,
    };
  }
  function reactToSuggestion(id, type) {
    const me = getCurrentUser();
    if (!me) return { ok: false, error: "Войди" };
    const r = loadSuggestionReactions();
    if (r[id] === type) delete r[id];
    else r[id] = type;
    saveSuggestionReactions(r);
    emitChange();
    return { ok: true };
  }

  /* ============ ПОЛЬЗОВАТЕЛЬСКИЕ ПОСТЫ ============ */
  function getCustomPosts() {
    return _load(CUSTOM_POSTS_KEY, []);
  }

  function addCustomPost({ title, excerpt, body, category, tags }) {
    const me = getCurrentUser();
    if (!me) return { ok: false, error: "Войдите, чтобы создать пост" };
    if (!title || !body)
      return { ok: false, error: "Заполните заголовок и текст" };

    const posts = getCustomPosts();
    const newPost = {
      id: Date.now(),
      date: new Date().toISOString().split("T")[0],
      category: category || "story",
      title: title,
      excerpt: excerpt || body.slice(0, 150) + (body.length > 150 ? "..." : ""),
      body: body,
      tags: tags || [],
      image: "",
      author: { name: me.username, avatar: me.avatar || "" },
      likes: 0,
      dislikes: 0,
      views: 0,
      isCustom: true,
    };

    posts.unshift(newPost);
    _save(CUSTOM_POSTS_KEY, posts);
    emitChange();
    return { ok: true, post: newPost };
  }

  function deleteCustomPost(id) {
    const me = getCurrentUser();
    if (!me) return { ok: false, error: "Нужно войти" };

    const posts = getCustomPosts();
    const post = posts.find((p) => p.id === id);
    if (!post) return { ok: false, error: "Пост не найден" };

    if (post.author.name !== me.username && !isStaff(me)) {
      return { ok: false, error: "Нет прав на удаление" };
    }

    const updated = posts.filter((p) => p.id !== id);
    _save(CUSTOM_POSTS_KEY, updated);
    emitChange();
    return { ok: true };
  }

  function deletePost(id) {
    const me = getCurrentUser();
    if (!me || !isStaff(me))
      return { ok: false, error: "Нужны права администратора" };

    const removed = _load(REMOVED_POSTS, []);
    if (!removed.includes(id)) removed.push(id);
    _save(REMOVED_POSTS, removed);

    emitChange();
    return { ok: true };
  }

  /* ============ ЖАЛОБЫ ============ */
  const REPORT_REASONS = [
    { key: "spam", label: "Спам или реклама" },
    { key: "abuse", label: "Оскорбления / агрессия" },
    { key: "nsfw", label: "Нецензурный контент" },
    { key: "hate", label: "Разжигание ненависти" },
    { key: "fake", label: "Обман / фейк" },
    { key: "other", label: "Другое" },
  ];

  function createReport({
    type,
    targetId,
    targetUserId,
    targetTitle,
    reason,
    comment,
  }) {
    const me = getCurrentUser();
    if (!me) return { ok: false, error: "Нужно войти в аккаунт" };
    if (
      (type === "profile" || type === "comment" || type === "suggestion") &&
      me.id === targetUserId
    ) {
      return { ok: false, error: "Нельзя жаловаться на себя" };
    }

    const reports = loadReports();
    const dup = reports.find(
      (r) =>
        r.reporterId === me.id &&
        r.type === type &&
        r.targetId === targetId &&
        r.status === "pending",
    );
    if (dup) return { ok: false, error: "Ты уже пожаловался на это" };

    reports.push({
      id: Date.now() + Math.floor(Math.random() * 1000),
      type,
      targetId: targetId ?? null,
      targetUserId: targetUserId ?? null,
      targetTitle: targetTitle || "",
      reporterId: me.id,
      reporterName: me.username,
      reason,
      comment: String(comment || "").slice(0, 500),
      status: "pending",
      createdAt: Date.now(),
      resolvedAt: null,
      resolvedBy: null,
      action: null,
    });
    saveReports(reports);
    emitChange();
    return { ok: true };
  }
  function listReports() {
    return loadReports().sort((a, b) => b.createdAt - a.createdAt);
  }
  function dismissReport(id) {
    const reports = loadReports();
    const r = reports.find((x) => x.id === id);
    if (!r) return { ok: false, error: "Репорт не найден" };
    r.status = "dismissed";
    r.resolvedAt = Date.now();
    r.resolvedBy = (getCurrentUser() || {}).username || "admin";
    saveReports(reports);
    emitChange();
    return { ok: true };
  }
  function resolveReport(id, action) {
    const reports = loadReports();
    const r = reports.find((x) => x.id === id);
    if (!r) return { ok: false, error: "Репорт не найден" };

    if (action.type === "remove") {
      if (r.type === "post" && r.targetId != null) {
        const removed = _load(REMOVED_POSTS, []);
        if (!removed.includes(r.targetId)) removed.push(r.targetId);
        _save(REMOVED_POSTS, removed);
      } else if (r.type === "comment" && r.targetId != null) {
        const me = getCurrentUser();
        const author = r.targetUserId ? getUserById(r.targetUserId) : null;
        if (author && me && !canModerateUser(me, author)) {
          return {
            ok: false,
            error: "Недостаточно прав: автор комментария не ниже по рангу",
          };
        }
        removeComment(r.targetId);
      } else if (r.type === "suggestion" && r.targetId != null) {
        const me = getCurrentUser();
        const author = r.targetUserId ? getUserById(r.targetUserId) : null;
        if (author && me && !canModerateUser(me, author)) {
          return {
            ok: false,
            error: "Недостаточно прав: автор предложки не ниже по рангу",
          };
        }
        const list = loadSuggestions();
        const s = list.find((x) => x.id === r.targetId);
        if (s) {
          s.deleted = true;
          saveSuggestions(list);
        }
      }
    }
    if (
      (action.type === "ban_temp" || action.type === "ban_perm") &&
      r.targetUserId
    ) {
      const duration =
        action.type === "ban_perm"
          ? null
          : action.durationMs || 24 * 3600 * 1000;
      const reason = action.reason || "Жалоба: " + r.reason;
      const banRes = banUser(r.targetUserId, duration, reason);
      if (!banRes.ok) return banRes;
    }

    r.status = "resolved";
    r.resolvedAt = Date.now();
    r.resolvedBy = (getCurrentUser() || {}).username || "admin";
    r.action = action.type;
    saveReports(reports);
    emitChange();
    return { ok: true };
  }
  function getRemovedPostIds() {
    return _load(REMOVED_POSTS, []);
  }

  function emitChange() {
    window.dispatchEvent(new CustomEvent("auth:change"));
  }

  /* ============ НОВЫЕ УТИЛИТЫ (escapeHTML) ============ */
  function escapeHTML(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* ============ ЗАКЛАДКИ ============ */
  function getBookmarks() {
    return _load(BOOKMARKS_KEY, []);
  }
  function isBookmarked(postId) {
    return getBookmarks().includes(postId);
  }
  function toggleBookmark(postId) {
    const list = getBookmarks();
    const idx = list.indexOf(postId);
    if (idx >= 0) list.splice(idx, 1);
    else list.push(postId);
    _save(BOOKMARKS_KEY, list);
    emitChange();
    return { ok: true, bookmarked: idx < 0 };
  }

  /* ============ РЕДАКТИРОВАНИЕ ПОСТА ============ */
  function editCustomPost(id, { title, excerpt, body, category, tags, image }) {
    const me = getCurrentUser();
    if (!me) return { ok: false, error: "Нужно войти" };

    const posts = getCustomPosts();
    const post = posts.find((p) => p.id === id);
    if (!post) return { ok: false, error: "Пост не найден" };

    if (post.author.name !== me.username && !isStaff(me)) {
      return { ok: false, error: "Нет прав на редактирование" };
    }

    if (!title || !body)
      return { ok: false, error: "Заполните заголовок и текст" };

    post.title = title;
    post.excerpt =
      excerpt || body.slice(0, 150) + (body.length > 150 ? "..." : "");
    post.body = body;
    post.category = category || post.category;
    post.tags = tags || post.tags;
    if (typeof image === "string") post.image = image;
    post.editedAt = Date.now();

    _save(CUSTOM_POSTS_KEY, posts);
    emitChange();
    return { ok: true, post };
  }

  /* ============ ХЕЛПЕР "ВСЕ ПОСТЫ" ============ */
  function getAllPosts() {
    const custom = getCustomPosts();
    const removed = getRemovedPostIds();
    const base = typeof POSTS !== "undefined" ? POSTS : [];
    return [...custom, ...base].filter((p) => !removed.includes(p.id));
  }

  /* ============ ЭКСПОРТ ============ */
  window.Auth = {
    getCurrentUser,
    register,
    login,
    logout,
    requestReset,
    verifyResetCode,
    resetPassword,

    isOwner,
    isAdmin,
    isStaff,
    getRoleLabel,
    ROLES,
    setUserRole,

    getRoleLevel,
    canModerateUser,
    canChangeUserRole,

    listUsers,
    approveUser,
    rejectUser,
    deleteUser,
    getUserByUsername,
    getUserById,
    updateProfile,
    processAvatarFile,

    toggleProfileLike,
    getProfileLikeCount,
    hasLikedProfile,

    banUser,
    unbanUser,
    isBanned,

    listComments,
    getCommentCount,
    addComment,
    removeComment,
    reactToComment,
    getCommentReaction,
    getCommentCounts,

    SUGGESTION_TYPES,
    listSuggestions,
    getSuggestionById,
    addSuggestion,
    removeSuggestion,
    getSuggestionReaction,
    getSuggestionCounts,
    reactToSuggestion,

    getCustomPosts,
    addCustomPost,
    deleteCustomPost,
    deletePost,

    REPORT_REASONS,
    createReport,
    listReports,
    resolveReport,
    dismissReport,
    getRemovedPostIds,

    /* НОВЫЕ */
    escapeHTML,
    toggleBookmark,
    isBookmarked,
    getBookmarks,
    editCustomPost,
    getAllPosts,

    _hash: hash,
  };

  /* ============ УТИЛИТА (для навбара) ============ */
  function escapeHTMLForSlot(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* ============ КНОПКА В НАВБАРЕ ============ */
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

    const user = getCurrentUser();

    if (!user) {
      slot.innerHTML = `
        <button class="auth-btn" id="open-auth">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.5"
               stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
            <polyline points="10 17 15 12 10 7"/>
            <line x1="15" y1="12" x2="3" y2="12"/>
          </svg>
          <span class="auth-btn-text">Войти</span>
        </button>
      `;
      const btn = slot.querySelector("#open-auth");
      if (btn) btn.addEventListener("click", () => openAuth("login"));
      return;
    }

    ensureRole(user);
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
          <svg class="caret" width="12" height="12" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.5"
               stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
        <div class="user-dropdown">
          <div class="menu-head">
            <span class="menu-username">${escapeHTMLForSlot(user.username)}</span>
            <span class="menu-role">${escapeHTMLForSlot(roleLabel)}</span>
          </div>

          <a href="profile.html">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            Мой профиль
          </a>

          ${
            staff
              ? `
            <a href="admin.html">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2"
                   stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/>
              </svg>
              Панель админа
            </a>
          `
              : ""
          }

          <button class="danger" id="logout-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
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

    slot.querySelector("#logout-btn").addEventListener("click", () => {
      logout();
      menu.classList.remove("open");
    });
  }

  /* ============ МОДАЛКА ВХОДА ============ */
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

    modal.querySelectorAll("[data-close]").forEach((el) => {
      el.addEventListener("click", closeAuth);
    });
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
    if (view === "forgot") body.innerHTML = viewForgot();

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
      loginForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const fd = new FormData(loginForm);
        const res = login({
          username: fd.get("username").trim(),
          password: fd.get("password"),
        });
        if (!res.ok) return showMsg("error", res.error);
        showMsg("success", "Успешный вход!");
        setTimeout(() => {
          closeAuth();
          renderAuthSlot();
        }, 500);
      });
    }

    const regForm = body.querySelector("#register-form");
    if (regForm) {
      regForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const fd = new FormData(regForm);
        const res = register({
          username: fd.get("username").trim(),
          email: fd.get("email").trim(),
          password: fd.get("password"),
          passwordConfirm: fd.get("passwordConfirm"),
        });
        if (!res.ok) return showMsg("error", res.error);
        showMsg("success", "Заявка отправлена! Дождись подтверждения.");
        regForm.reset();
      });
    }

    const forgotForm = body.querySelector("#forgot-form");
    if (forgotForm) {
      let step = 1;
      let resetEmail = "";
      forgotForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const fd = new FormData(forgotForm);
        if (step === 1) {
          resetEmail = fd.get("email").trim();
          const res = requestReset(resetEmail);
          if (!res.ok) return showMsg("error", res.error);
          showMsg(
            "info",
            "Демо: код отправлен на " +
              resetEmail +
              ". Код: " +
              res.code +
              " (смотри консоль).",
          );
          forgotForm
            .querySelector('[data-step="1"]')
            .classList.remove("active");
          forgotForm.querySelector('[data-step="2"]').classList.add("active");
          step = 2;
          return;
        }
        if (step === 2) {
          const res = resetPassword(
            resetEmail,
            fd.get("code").trim(),
            fd.get("newPassword"),
            fd.get("newPasswordConfirm"),
          );
          if (!res.ok) return showMsg("error", res.error);
          showMsg("success", "Пароль изменён! Теперь можно войти.");
          setTimeout(() => renderAuthView("login"), 1200);
        }
      });
    }
  }

  function viewLogin() {
    return `
      <h2 class="auth-title">С возвращением</h2>
      <p class="auth-subtitle">Войди, чтобы писать посты, ставить лайки и сохранять в закладки.</p>
      <div class="auth-tabs">
        <button class="auth-tab active" data-view="login">Вход</button>
        <button class="auth-tab" data-view="register">Регистрация</button>
      </div>
      <div class="auth-msg" id="auth-msg"></div>
      <form class="auth-form" id="login-form">
        <div class="field">
          <label>Логин или почта</label>
          <input type="text" name="username" placeholder="username или email" required />
        </div>
        <div class="field">
          <label>Пароль</label>
          <input type="password" name="password" placeholder="••••••••" required />
        </div>
        <button type="submit" class="auth-submit">Войти</button>
      </form>
      <button class="auth-link" data-view="forgot">Забыл пароль</button>
    `;
  }
  function viewRegister() {
    return `
      <h2 class="auth-title">Создать аккаунт</h2>
      <p class="auth-subtitle">Заявка уйдёт администратору на проверку.</p>
      <div class="auth-tabs">
        <button class="auth-tab" data-view="login">Вход</button>
        <button class="auth-tab active" data-view="register">Регистрация</button>
      </div>
      <div class="auth-msg" id="auth-msg"></div>
      <form class="auth-form" id="register-form">
        <div class="field">
          <label>Логин</label>
          <input type="text" name="username" placeholder="username" required minlength="3" pattern="[a-zA-Z0-9_-]+" />
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
        <button type="submit" class="auth-submit">Отправить заявку</button>
      </form>
    `;
  }
  function viewForgot() {
    return `
      <h2 class="auth-title">Восстановление пароля</h2>
      <p class="auth-subtitle">Введи почту — мы отправим код.</p>
      <div class="auth-msg" id="auth-msg"></div>
      <form class="auth-form" id="forgot-form">
        <div class="auth-step active" data-step="1">
          <div class="field">
            <label>Почта</label>
            <input type="email" name="email" placeholder="you@example.com" required />
          </div>
          <button type="submit" class="auth-submit">Отправить код</button>
        </div>
        <div class="auth-step" data-step="2">
          <div class="field">
            <label>Код из письма</label>
            <input type="text" name="code" placeholder="6 цифр" required maxlength="6" pattern="[0-9]{6}" />
          </div>
          <div class="field">
            <label>Новый пароль</label>
            <input type="password" name="newPassword" placeholder="Минимум 6 символов" required minlength="6" />
          </div>
          <div class="field">
            <label>Подтверждение</label>
            <input type="password" name="newPasswordConfirm" placeholder="Повтори пароль" required minlength="6" />
          </div>
          <button type="submit" class="auth-submit">Изменить пароль</button>
        </div>
      </form>
      <button class="auth-link" data-view="login">← Вернуться ко входу</button>
    `;
  }

  /* ============ СТАРТ ============ */
  window.addEventListener("auth:change", renderAuthSlot);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () =>
      setTimeout(renderAuthSlot, 0),
    );
  } else {
    setTimeout(renderAuthSlot, 0);
  }
})();
