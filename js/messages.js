/* ============================================================
   messages.js — полная логика мессенджера
   ============================================================ */

(function () {
  const layout = document.querySelector(".tg-layout");
  const chatListEl = document.getElementById("tg-chat-list");
  const emptyEl = document.getElementById("tg-empty-chat");
  const activeChatEl = document.getElementById("tg-active-chat");
  const chatTitleEl = document.getElementById("tg-chat-title");
  const chatStatusEl = document.getElementById("tg-chat-status");
  const messagesEl = document.getElementById("tg-messages");
  const backBtn = document.getElementById("tg-back-btn");
  const openSettingsBtn = document.getElementById("open-settings-btn");

  const groupForm = document.getElementById("tg-group-form");
  const groupInput = document.getElementById("tg-group-input");
  const channelForm = document.getElementById("tg-channel-form");
  const channelInput = document.getElementById("tg-channel-input");
  const subscriberNotice = document.getElementById("tg-subscriber-notice");
  const blockNotice = document.getElementById("tg-block-notice");

  const groupFile = document.getElementById("tg-group-file");
  const channelFile = document.getElementById("tg-channel-file");
  let pendingGroupImage = null;
  let pendingChannelImage = null;

  const modal = document.getElementById("new-chat-modal");
  const modalNameInput = document.getElementById("chat-name-input");
  const modalAvatarInput = document.getElementById("chat-avatar-input");
  const modalAvatarPreview = document.getElementById("chat-avatar-preview");
  const modalSearchInput = document.getElementById("chat-member-search");
  const searchDropdown = document.getElementById("chat-search-dropdown");
  const selectedMembersWrap = document.getElementById("chat-selected-members");
  const createChatBtn = document.getElementById("create-chat-btn");
  const tabs = document.querySelectorAll(".tg-tab");

  const settingsModal = document.getElementById("settings-modal");
  const settingsTitle = document.getElementById("settings-title");
  const blockWrap = document.getElementById("settings-block-wrap");
  const blockBtn = document.getElementById("block-user-btn");
  const deleteWrap = document.getElementById("settings-delete-wrap");
  const deleteChatBtn = document.getElementById("delete-chat-btn");
  const membersWrap = document.getElementById("settings-members-wrap");
  const membersSearch = document.getElementById("settings-member-search");
  const membersList = document.getElementById("settings-members-list");

  const addMemberModal = document.getElementById("add-member-modal");
  const addMemberSearch = document.getElementById("add-member-search");
  const addMemberDropdown = document.getElementById("add-member-dropdown");

  const commentsModal = document.getElementById("comments-modal");
  const commentsList = document.getElementById("comments-list");
  const commentForm = document.getElementById("comment-form");
  const commentInput = document.getElementById("comment-input");

  if (!chatListEl) return;

  const me = window.Auth.getCurrentUser();
  if (!me) {
    chatListEl.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--muted);">Войдите, чтобы использовать мессенджер</div>`;
    return;
  }

  const DB_KEY = "site-messages";
  const BLOCK_KEY = "site-blocks";
  let currentChatId = null;
  let currentPostId = null;
  let chatType = "private";
  let pendingAvatar = "";
  let selectedMembers = [];

  /* ---------- Утилиты ---------- */
  function esc(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function toast(type, msg) {
    if (window.Toast && window.Toast[type]) window.Toast[type](msg);
    else alert(msg);
  }

  /* ---------- Блокировки ---------- */
  function getBlocks() {
    return JSON.parse(localStorage.getItem(BLOCK_KEY) || "{}");
  }
  function saveBlocks(b) {
    localStorage.setItem(BLOCK_KEY, JSON.stringify(b));
  }
  function isBlockedByMe(targetId) {
    return (getBlocks()[me.id] || []).includes(String(targetId));
  }
  function isBlockingMe(targetId) {
    return (getBlocks()[String(targetId)] || []).includes(String(me.id));
  }

  function initFakeData() {
    let data = JSON.parse(localStorage.getItem(DB_KEY) || "{}");
    data["bot"] = {
      chatId: "bot",
      type: "private",
      title: "🤖 Z1-Bot",
      avatar: "B",
      ownerId: "bot",
      members: [me.id, "bot"],
      messages: data["bot"]?.messages || [
        {
          id: 1,
          senderId: "bot",
          text: "Привет! Я тестовый бот.",
          time: Date.now() - 100000,
        },
      ],
    };
    localStorage.setItem(DB_KEY, JSON.stringify(data));
  }
  initFakeData();

  /* ============================================================
     МОДАЛКА СОЗДАНИЯ
     ============================================================ */
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      chatType = tab.dataset.type;
      modalNameInput.placeholder =
        chatType === "private"
          ? "Имя пользователя"
          : chatType === "group"
            ? "Название группы"
            : "Название канала";
    });
  });

  document.querySelector(".tg-new-chat")?.addEventListener("click", () => {
    pendingAvatar = "";
    selectedMembers = [];
    chatType = "private";
    tabs.forEach((t) => t.classList.remove("active"));
    tabs[0].classList.add("active");

    modalNameInput.value = "";
    modalSearchInput.value = "";
    modalAvatarPreview.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>`;
    searchDropdown.hidden = true;
    renderSelectedMembers();
    modal.hidden = false;
    if (chatType !== "private") modalNameInput.focus();
    else modalSearchInput.focus();
  });

  modal
    .querySelectorAll("[data-close]")
    .forEach((el) => el.addEventListener("click", () => (modal.hidden = true)));

  modalAvatarInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      pendingAvatar = ev.target.result;
      modalAvatarPreview.innerHTML = `<img src="${pendingAvatar}" />`;
    };
    reader.readAsDataURL(file);
  });

  modalSearchInput.addEventListener("input", () => {
    const query = modalSearchInput.value.trim().toLowerCase();
    if (!query) {
      searchDropdown.hidden = true;
      return;
    }
    const users = window.Auth.listUsers().filter((u) => {
      if (u.id === me.id || selectedMembers.some((m) => m.id === u.id))
        return false;
      return (
        u.username.toLowerCase().includes(query) || String(u.id).includes(query)
      );
    });
    if (!users.length) {
      searchDropdown.innerHTML = `<div style="padding: 12px; text-align: center; color: var(--muted); font-size: 13px;">Никого не найдено</div>`;
    } else {
      searchDropdown.innerHTML = users
        .map(
          (u) => `
        <div class="tg-search-item" data-id="${u.id}">
          <div class="avatar">${u.avatar ? `<img src="${u.avatar}" />` : u.username.charAt(0).toUpperCase()}</div>
          <div class="info"><span class="name">${esc(u.username)}</span><span class="id">ID: ${u.id}</span></div>
        </div>
      `,
        )
        .join("");
      searchDropdown.querySelectorAll(".tg-search-item").forEach((item) => {
        item.addEventListener("click", () => {
          const userObj = window.Auth.getUserById(Number(item.dataset.id));
          if (userObj) {
            if (chatType === "private") {
              modalNameInput.value = userObj.username;
              selectedMembers = [userObj];
            } else {
              selectedMembers.push(userObj);
            }
            renderSelectedMembers();
            modalSearchInput.value = "";
            searchDropdown.hidden = true;
          }
        });
      });
    }
    searchDropdown.hidden = false;
  });

  document.addEventListener("click", (e) => {
    if (
      !e.target.closest(".tg-modal-search-wrap") &&
      !e.target.closest(".dropdown-menu") &&
      !e.target.closest(".menu-btn")
    ) {
      searchDropdown.hidden = true;
      document.querySelectorAll(".dropdown-menu").forEach((d) => d.remove());
    }
  });

  function renderSelectedMembers() {
    selectedMembersWrap.innerHTML = selectedMembers
      .map(
        (u) => `
      <div class="tg-member-chip">
        <div class="chip-avatar">${u.avatar ? `<img src="${u.avatar}" />` : u.username.charAt(0).toUpperCase()}</div>
        <span>${esc(u.username)}</span>
        <button class="remove-member" data-id="${u.id}">&times;</button>
      </div>
    `,
      )
      .join("");
    selectedMembersWrap.querySelectorAll(".remove-member").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedMembers = selectedMembers.filter(
          (m) => m.id !== Number(btn.dataset.id),
        );
        renderSelectedMembers();
      });
    });
  }

  createChatBtn.addEventListener("click", () => {
    let name = modalNameInput.value.trim();
    if (chatType === "private") {
      if (!selectedMembers.length)
        return toast("error", "Выберите пользователя");
    } else {
      if (!name) return toast("error", "Введите название");
    }

    const id = "chat_" + Date.now();
    const data = JSON.parse(localStorage.getItem(DB_KEY) || "{}");
    const base = {
      chatId: id,
      type: chatType,
      title: name || selectedMembers[0].username,
      avatar:
        pendingAvatar ||
        (name
          ? name.charAt(0).toUpperCase()
          : selectedMembers[0].username.charAt(0).toUpperCase()),
      ownerId: me.id,
      admins: [],
      members: [me.id, ...selectedMembers.map((m) => m.id)],
    };
    if (chatType === "group" || chatType === "private") {
      base.messages = [
        {
          id: Date.now(),
          senderId: "system",
          text: `Чат создан.`,
          time: Date.now(),
        },
      ];
    } else {
      base.posts = [
        {
          id: Date.now(),
          senderId: me.id,
          text: `Канал "${name}" создан.`,
          time: Date.now(),
          reactions: { like: 0, dislike: 0, users: {} },
          comments: [],
        },
      ];
    }

    data[id] = base;
    localStorage.setItem(DB_KEY, JSON.stringify(data));
    modal.hidden = true;
    loadChats();
    openChat(id);
  });

  /* ============================================================
     СПИСОК ЧАТОВ
     ============================================================ */
  function loadChats() {
    const data = JSON.parse(localStorage.getItem(DB_KEY) || "{}");
    const chats = Object.values(data).sort((a, b) => {
      const getLastTime = (c) => {
        if (c.type === "channel" && c.posts?.length)
          return c.posts[c.posts.length - 1].time;
        if (c.messages?.length) return c.messages[c.messages.length - 1].time;
        return 0;
      };
      return getLastTime(b) - getLastTime(a);
    });

    chatListEl.innerHTML = chats
      .map((chat) => {
        const isChannel = chat.type === "channel";
        const lastMsg = isChannel
          ? chat.posts?.length
            ? chat.posts[chat.posts.length - 1].text
            : "Нет постов"
          : chat.messages?.length
            ? chat.messages[chat.messages.length - 1].text
            : "Нет сообщений";
        let previewText =
          lastMsg.length > 26 ? lastMsg.slice(0, 26) + "…" : lastMsg;
        const avatarHTML =
          chat.avatar && chat.avatar.startsWith("data:image")
            ? `<img src="${chat.avatar}" />`
            : chat.avatar;

        let badge = "";
        if (chat.type === "channel") badge = `<span class="badge">Канал</span>`;
        if (chat.type === "group") badge = `<span class="badge">Группа</span>`;

        return `
        <div class="tg-chat-item ${chat.chatId === currentChatId ? "active" : ""}" data-id="${chat.chatId}">
          <div class="tg-chat-avatar" ${chat.avatar && chat.avatar.startsWith("data:image") ? 'style="background:transparent;"' : ""}>${avatarHTML}</div>
          <div class="tg-chat-details">
            <div class="tg-chat-header-row">
              <span class="tg-chat-name">${esc(chat.title)} ${badge}</span>
            </div>
            <span class="tg-chat-last-msg">${esc(previewText)}</span>
          </div>
        </div>
      `;
      })
      .join("");

    document
      .querySelectorAll(".tg-chat-item")
      .forEach((item) =>
        item.addEventListener("click", () => openChat(item.dataset.id)),
      );
  }

  function openChat(chatId) {
    currentChatId = chatId;
    layout.classList.add("chat-open");
    emptyEl.hidden = true;
    activeChatEl.hidden = false;
    const data = JSON.parse(localStorage.getItem(DB_KEY) || "{}");
    const chat = data[chatId];
    if (!chat) return;

    chatTitleEl.textContent = chat.title;
    chatStatusEl.textContent =
      chat.type === "channel"
        ? "канал"
        : chat.type === "group"
          ? "группа"
          : "личный чат";

    const isAdmin =
      String(chat.ownerId) === String(me.id) ||
      (chat.admins && chat.admins.map(String).includes(String(me.id)));

    groupForm.hidden = true;
    channelForm.hidden = true;
    subscriberNotice.hidden = true;
    blockNotice.hidden = true;

    if (chat.type === "private" && chat.chatId !== "bot") {
      const otherId = chat.members.find((id) => String(id) !== String(me.id));
      if (isBlockedByMe(otherId)) {
        blockNotice.textContent =
          "Вы заблокировали этого пользователя. Чтобы разблокировать, зайдите в настройки.";
        blockNotice.hidden = false;
      } else if (isBlockingMe(otherId)) {
        blockNotice.textContent =
          "Пользователь вас заблокировал. Вы не можете отправлять сообщения.";
        blockNotice.hidden = false;
      } else {
        groupForm.hidden = false;
      }
    } else if (chat.type === "group") {
      groupForm.hidden = false;
    } else if (chat.type === "channel") {
      if (isAdmin) channelForm.hidden = false;
      else subscriberNotice.hidden = false;
    }

    renderChatContent(chat);
    loadChats();
  }

  function renderChatContent(chat) {
    if (chat.type !== "channel") renderGroupMessages(chat);
    else renderChannelPosts(chat);
    setTimeout(() => {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }, 10);
  }

  function renderGroupMessages(chat) {
    messagesEl.innerHTML = chat.messages
      .map((msg) => {
        const isMine = String(msg.senderId) === String(me.id);
        const cls = isMine ? "mine" : "other";
        const time = new Date(msg.time).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
        const img = msg.image ? `<img src="${msg.image}" />` : "";
        return `
        <div class="tg-msg-row ${cls}">
          <div class="tg-msg-bubble">${esc(msg.text)}${img}</div>
          <div class="tg-msg-time">${time}</div>
        </div>
      `;
      })
      .join("");
  }

  function renderChannelPosts(chat) {
    messagesEl.innerHTML = chat.posts
      .map((post) => {
        const time = new Date(post.time).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
        const author = window.Auth.getUserById(post.senderId);
        const authorName = author ? author.username : "Админ";
        const img = post.image
          ? `<div class="tg-post-image"><img src="${post.image}" /></div>`
          : "";

        const userReaction = post.reactions.users[me.id];
        const likeCls = userReaction === "like" ? "active" : "";
        const dislikeCls = userReaction === "dislike" ? "active dislike" : "";

        return `
        <div class="tg-channel-post">
          <div class="tg-post-head">${esc(authorName)} • ${time}</div>
          <div class="tg-post-text">${esc(post.text)}</div>
          ${img}
          <div class="tg-post-footer">
            <button class="tg-post-btn ${likeCls}" data-post="${post.id}" data-reaction="like">👍 ${post.reactions.like || 0}</button>
            <button class="tg-post-btn ${dislikeCls}" data-post="${post.id}" data-reaction="dislike">👎 ${post.reactions.dislike || 0}</button>
            <button class="tg-post-btn" data-post="${post.id}" data-comments>💬 ${post.comments ? post.comments.length : 0}</button>
          </div>
        </div>
      `;
      })
      .join("");

    messagesEl.querySelectorAll("[data-reaction]").forEach((btn) => {
      btn.addEventListener("click", () =>
        handleReaction(Number(btn.dataset.post), btn.dataset.reaction),
      );
    });
    messagesEl.querySelectorAll("[data-comments]").forEach((btn) => {
      btn.addEventListener("click", () =>
        openComments(Number(btn.dataset.post)),
      );
    });
  }

  function handleReaction(postId, type) {
    const data = JSON.parse(localStorage.getItem(DB_KEY) || "{}");
    const chat = data[currentChatId];
    const post = chat.posts.find((p) => p.id === postId);
    if (!post) return;

    const current = post.reactions.users[me.id];
    if (current === type) {
      post.reactions[type]--;
      delete post.reactions.users[me.id];
    } else {
      if (current) post.reactions[current]--;
      post.reactions[type]++;
      post.reactions.users[me.id] = type;
    }
    localStorage.setItem(DB_KEY, JSON.stringify(data));
    renderChannelPosts(chat);
  }

  /* ============================================================
     ОТПРАВКА
     ============================================================ */
  document
    .getElementById("tg-group-attach")
    .addEventListener("click", () => groupFile.click());
  groupFile.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      pendingGroupImage = ev.target.result;
    };
    reader.readAsDataURL(file);
  });

  groupForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = groupInput.value.trim();
    if (!text && !pendingGroupImage) return;

    const data = JSON.parse(localStorage.getItem(DB_KEY) || "{}");
    data[currentChatId].messages.push({
      id: Date.now(),
      senderId: me.id,
      text,
      image: pendingGroupImage,
      time: Date.now(),
    });
    localStorage.setItem(DB_KEY, JSON.stringify(data));

    groupInput.value = "";
    pendingGroupImage = null;
    renderGroupMessages(data[currentChatId]);
    loadChats();
  });

  document
    .getElementById("tg-channel-attach")
    .addEventListener("click", () => channelFile.click());
  channelFile.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      pendingChannelImage = ev.target.result;
    };
    reader.readAsDataURL(file);
  });

  channelForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = channelInput.value.trim();
    if (!text && !pendingChannelImage) return;

    const data = JSON.parse(localStorage.getItem(DB_KEY) || "{}");
    data[currentChatId].posts.push({
      id: Date.now(),
      senderId: me.id,
      text,
      image: pendingChannelImage,
      time: Date.now(),
      reactions: { like: 0, dislike: 0, users: {} },
      comments: [],
    });
    localStorage.setItem(DB_KEY, JSON.stringify(data));

    channelInput.value = "";
    pendingChannelImage = null;
    renderChannelPosts(data[currentChatId]);
    loadChats();
  });

  /* ============================================================
     НАСТРОЙКИ ЧАТА
     ============================================================ */
  openSettingsBtn.addEventListener("click", () => {
    const data = JSON.parse(localStorage.getItem(DB_KEY) || "{}");
    const chat = data[currentChatId];
    if (!chat) return;

    // Чистим динамические кнопки
    membersWrap
      .querySelectorAll(".leave-chat-btn, .open-add-member-btn")
      .forEach((b) => b.remove());

    settingsTitle.textContent = "Настройки: " + chat.title;
    blockWrap.hidden = true;
    deleteWrap.hidden = true;
    membersWrap.hidden = true;

    if (chat.type === "private" || chat.type === "bot") {
      deleteWrap.hidden = false;
      deleteChatBtn.textContent = "Удалить чат";
      if (chat.type === "private") {
        blockWrap.hidden = false;
        const otherId = chat.members.find((id) => String(id) !== String(me.id));
        if (isBlockedByMe(otherId)) {
          blockBtn.textContent = "Разблокировать пользователя";
          blockBtn.style.color = "#4ade80";
          blockBtn.style.borderColor = "rgba(74, 222, 128, 0.3)";
          blockBtn.style.background = "rgba(74, 222, 128, 0.1)";
        } else {
          blockBtn.textContent = "Заблокировать пользователя";
          blockBtn.style.color = "#f87171";
          blockBtn.style.borderColor = "rgba(248, 113, 113, 0.3)";
          blockBtn.style.background = "rgba(248, 113, 113, 0.1)";
        }
      }
    }

    if (chat.type === "group" || chat.type === "channel") {
      deleteWrap.hidden = false;
      deleteChatBtn.textContent =
        chat.type === "channel" ? "Удалить канал" : "Удалить группу";

      membersWrap.hidden = false;
      membersSearch.value = "";
      renderMembersList(chat, chat.members);

      const isOwnerChat = String(chat.ownerId) === String(me.id);
      const isAdm =
        isOwnerChat ||
        (chat.admins && chat.admins.map(String).includes(String(me.id)));

      if (isAdm) {
        const addBtn = document.createElement("button");
        addBtn.className = "tg-btn-primary open-add-member-btn";
        addBtn.textContent = "+ Добавить участника";
        addBtn.style.marginBottom = "12px";
        addBtn.addEventListener("click", () => {
          addMemberModal.hidden = false;
          addMemberSearch.value = "";
          addMemberDropdown.hidden = true;
          setTimeout(() => addMemberSearch.focus(), 50);
        });
        // Вставляем перед списком (первый child - input поиска)
        const firstChild = membersWrap.firstChild;
        membersWrap.insertBefore(
          addBtn,
          firstChild ? firstChild.nextSibling : null,
        );
      }

      if (!isOwnerChat) {
        const leaveBtn = document.createElement("button");
        leaveBtn.className = "tg-btn-danger leave-chat-btn";
        leaveBtn.textContent =
          chat.type === "channel" ? "Отписаться от канала" : "Покинуть группу";
        leaveBtn.style.marginTop = "16px";
        leaveBtn.addEventListener("click", () => {
          if (!confirm("Вы уверены?")) return;
          const d2 = JSON.parse(localStorage.getItem(DB_KEY) || "{}");
          const c = d2[currentChatId];
          c.members = c.members.filter((id) => String(id) !== String(me.id));
          localStorage.setItem(DB_KEY, JSON.stringify(d2));
          settingsModal.hidden = true;
          layout.classList.remove("chat-open");
          currentChatId = null;
          activeChatEl.hidden = true;
          emptyEl.hidden = false;
          loadChats();
          toast("info", "Вы вышли из чата");
        });
        membersWrap.appendChild(leaveBtn);
      }
    }

    settingsModal.hidden = false;
  });

  settingsModal.querySelectorAll("[data-close-settings]").forEach((el) =>
    el.addEventListener("click", () => {
      settingsModal.hidden = true;
      document.querySelectorAll(".dropdown-menu").forEach((d) => d.remove());
    }),
  );

  blockBtn.addEventListener("click", () => {
    const data = JSON.parse(localStorage.getItem(DB_KEY) || "{}");
    const chat = data[currentChatId];
    const otherId = String(
      chat.members.find((id) => String(id) !== String(me.id)),
    );
    const blocks = getBlocks();
    if (!blocks[me.id]) blocks[me.id] = [];
    if (isBlockedByMe(otherId)) {
      blocks[me.id] = blocks[me.id].filter((id) => id !== otherId);
    } else {
      blocks[me.id].push(otherId);
    }
    saveBlocks(blocks);
    settingsModal.hidden = true;
    openChat(currentChatId);
  });

  deleteChatBtn.addEventListener("click", () => {
    if (!confirm("Вы уверены, что хотите удалить этот чат/канал для всех?"))
      return;
    const data = JSON.parse(localStorage.getItem(DB_KEY) || "{}");
    delete data[currentChatId];
    localStorage.setItem(DB_KEY, JSON.stringify(data));
    settingsModal.hidden = true;
    layout.classList.remove("chat-open");
    currentChatId = null;
    activeChatEl.hidden = true;
    emptyEl.hidden = false;
    loadChats();
  });

  membersSearch.addEventListener("input", () => {
    const data = JSON.parse(localStorage.getItem(DB_KEY) || "{}");
    const chat = data[currentChatId];
    if (!chat) return;
    const q = membersSearch.value.toLowerCase();
    const filtered = chat.members.filter((id) => {
      const u = window.Auth.getUserById(id);
      return u && u.username.toLowerCase().includes(q);
    });
    renderMembersList(chat, filtered);
  });

  function renderMembersList(chat, memberIds) {
    const isOwner = String(chat.ownerId) === String(me.id);

    membersList.innerHTML = memberIds
      .map((id) => {
        const u = window.Auth.getUserById(id);
        if (!u) return "";

        const isChatOwner = String(id) === String(chat.ownerId);
        const isAdmin =
          chat.admins && chat.admins.map(String).includes(String(id));

        let roleText = "";
        if (isChatOwner) roleText = '<span class="role">Владелец</span>';
        else if (isAdmin) roleText = '<span class="role">Админ</span>';

        const showMenu = isOwner && String(id) !== String(me.id);

        return `
        <div class="tg-settings-member">
          <div class="avatar">${u.avatar ? `<img src="${u.avatar}" />` : u.username.charAt(0).toUpperCase()}</div>
          <div class="info">
            <span class="name">${esc(u.username)}</span>
            ${roleText}
          </div>
          ${
            showMenu
              ? `<button class="menu-btn" data-user-id="${id}" data-chat-id="${chat.chatId}">⋮</button>`
              : ""
          }
        </div>
      `;
      })
      .join("");

    membersList.querySelectorAll(".menu-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        document.querySelectorAll(".dropdown-menu").forEach((d) => d.remove());

        const userId = btn.dataset.userId;
        const chatId = btn.dataset.chatId;
        const isChannel = chat.type === "channel";

        const menu = document.createElement("div");
        menu.className = "dropdown-menu";
        menu.style.position = "absolute";
        const rect = btn.getBoundingClientRect();
        menu.style.top = rect.bottom + 5 + "px";
        menu.style.left = rect.left - 150 + "px";

        let menuHTML = "";
        if (isChannel) {
          const isAdmin =
            chat.admins && chat.admins.map(String).includes(String(userId));
          menuHTML += `<button data-action="toggle-admin" data-user-id="${userId}" data-chat-id="${chatId}">
            ${isAdmin ? "Снять права админа" : "Сделать админом"}
          </button>`;
        }
        menuHTML += `<button class="danger" data-action="kick" data-user-id="${userId}" data-chat-id="${chatId}">Удалить из чата</button>`;

        menu.innerHTML = menuHTML;
        document.body.appendChild(menu);

        menu.querySelectorAll("button").forEach((actionBtn) => {
          actionBtn.addEventListener("click", () => {
            const act = actionBtn.dataset.action;
            handleMemberAction(chatId, userId, act);
            menu.remove();
          });
        });
      });
    });
  }

  function handleMemberAction(chatId, userId, action) {
    const data = JSON.parse(localStorage.getItem(DB_KEY) || "{}");
    const chat = data[chatId];
    if (!chat) return;

    if (action === "kick") {
      chat.members = chat.members.filter((id) => String(id) !== String(userId));
      if (chat.admins)
        chat.admins = chat.admins.filter((id) => String(id) !== String(userId));
    } else if (action === "toggle-admin") {
      if (!chat.admins) chat.admins = [];
      if (chat.admins.map(String).includes(String(userId))) {
        chat.admins = chat.admins.filter((id) => String(id) !== String(userId));
      } else {
        chat.admins.push(userId);
      }
    }

    localStorage.setItem(DB_KEY, JSON.stringify(data));
    settingsModal.hidden = true;
    if (String(userId) === String(me.id)) {
      layout.classList.remove("chat-open");
      currentChatId = null;
      activeChatEl.hidden = true;
      emptyEl.hidden = false;
      loadChats();
    } else {
      openSettingsBtn.click();
    }
  }

  /* ============================================================
     ДОБАВЛЕНИЕ УЧАСТНИКА (модалка)
     ============================================================ */
  addMemberModal
    .querySelectorAll("[data-close-add]")
    .forEach((el) =>
      el.addEventListener("click", () => (addMemberModal.hidden = true)),
    );

  addMemberSearch.addEventListener("input", () => {
    const q = addMemberSearch.value.trim().toLowerCase();
    if (!q) return (addMemberDropdown.hidden = true);

    const data = JSON.parse(localStorage.getItem(DB_KEY) || "{}");
    const chat = data[currentChatId];
    if (!chat) return;

    const candidates = window.Auth.listUsers().filter((u) => {
      if (chat.members.map(String).includes(String(u.id))) return false;
      return u.username.toLowerCase().includes(q) || String(u.id).includes(q);
    });

    if (!candidates.length) {
      addMemberDropdown.innerHTML = `<div style="padding:12px;text-align:center;color:var(--muted);font-size:13px;">Не найдено</div>`;
    } else {
      addMemberDropdown.innerHTML = candidates
        .map(
          (u) => `
        <div class="tg-search-item" data-id="${u.id}">
          <div class="avatar">${u.avatar ? `<img src="${u.avatar}"/>` : u.username.charAt(0).toUpperCase()}</div>
          <div class="info"><span class="name">${esc(u.username)}</span></div>
        </div>`,
        )
        .join("");
      addMemberDropdown.querySelectorAll(".tg-search-item").forEach((item) => {
        item.addEventListener("click", () => {
          const uid = Number(item.dataset.id);
          chat.members.push(uid);
          localStorage.setItem(DB_KEY, JSON.stringify(data));
          addMemberModal.hidden = true;
          renderMembersList(chat, chat.members);
          toast("success", "Участник добавлен");
        });
      });
    }
    addMemberDropdown.hidden = false;
  });

  /* ============================================================
     КОММЕНТАРИИ К ПОСТАМ КАНАЛА
     ============================================================ */
  function openComments(postId) {
    currentPostId = postId;
    const data = JSON.parse(localStorage.getItem(DB_KEY) || "{}");
    const post = data[currentChatId].posts.find((p) => p.id === postId);
    if (!post) return;

    renderComments(post.comments);
    commentsModal.hidden = false;
    commentInput.focus();
  }

  function renderComments(comments) {
    if (!comments || !comments.length) {
      commentsList.innerHTML = `<div style="text-align: center; color: var(--muted); margin-top: 20px;">Пока нет комментариев</div>`;
    } else {
      commentsList.innerHTML = comments
        .map((c) => {
          const author = window.Auth.getUserById(c.senderId);
          const authorName = author ? author.username : "Пользователь";
          const time = new Date(c.time).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });
          return `
          <div class="tg-comment-item">
            <div class="tg-comment-head">
              <span class="tg-comment-author">${esc(authorName)}</span>
              <span class="tg-comment-time">${time}</span>
            </div>
            <div class="tg-comment-text">${esc(c.text)}</div>
          </div>
        `;
        })
        .join("");
    }
    setTimeout(() => {
      commentsList.scrollTop = commentsList.scrollHeight;
    }, 10);
  }

  commentForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = commentInput.value.trim();
    if (!text) return;

    const data = JSON.parse(localStorage.getItem(DB_KEY) || "{}");
    const post = data[currentChatId].posts.find((p) => p.id === currentPostId);
    if (!post) return;

    post.comments = post.comments || [];
    post.comments.push({
      id: Date.now(),
      senderId: me.id,
      text,
      time: Date.now(),
    });
    localStorage.setItem(DB_KEY, JSON.stringify(data));

    commentInput.value = "";
    renderComments(post.comments);
    renderChannelPosts(data[currentChatId]);
  });

  commentsModal.querySelectorAll("[data-close-comments]").forEach((el) => {
    el.addEventListener("click", () => {
      commentsModal.hidden = true;
      currentPostId = null;
    });
  });

  /* ============================================================
     ВСПОМОГАТЕЛЬНОЕ
     ============================================================ */
  backBtn.addEventListener("click", () => {
    layout.classList.remove("chat-open");
    currentChatId = null;
    activeChatEl.hidden = true;
    emptyEl.hidden = false;
    loadChats();
  });

  loadChats();
})();
