const currentUser = document.getElementById("currentUser");
const currentNickname = document.getElementById("currentNickname");
const logoutBtn = document.getElementById("logoutBtn");
const sendBtn = document.getElementById("sendBtn");
const chatInput = document.getElementById("chatInput");
const chatMessages = document.getElementById("chatMessages");
const chatTitle = document.getElementById("chatTitle");
const sessionList = document.getElementById("sessionList");
const searchInput = document.getElementById("searchInput");
const addSessionBtn = document.getElementById("addSessionBtn");

const sessionModal = document.getElementById("sessionModal");
const closeModalBtn = document.getElementById("closeModalBtn");
const cancelModalBtn = document.getElementById("cancelModalBtn");
const confirmModalBtn = document.getElementById("confirmModalBtn");
const sessionNameInput = document.getElementById("sessionNameInput");
const modalMessage = document.getElementById("modalMessage");
const modalTitle = document.getElementById("modalTitle");

const deleteModal = document.getElementById("deleteModal");
const deleteModalText = document.getElementById("deleteModalText");
const closeDeleteModalBtn = document.getElementById("closeDeleteModalBtn");
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");

const CHAT_TARGET_STORAGE_KEY = "QKE_PENDING_CHAT_TARGET";

let currentSessionId = "fileHelper";
let sessionData = loadSessionData();
let currentKeyword = "";
let modalMode = "create";
let editingSessionId = null;
let deletingSessionId = null;
let openDropdownSessionId = null;
let pageUser = null;

// 打字指示器相关变量
let isTyping = false;
let typingIndicatorTimer = null;

initPage();

async function initPage() {
  pageUser = getStoredUser();
  const token = localStorage.getItem(STORAGE_KEYS.TOKEN);

  if (!pageUser || !token) {
    window.location.href = APP_CONFIG.LOGOUT_REDIRECT;
    return;
  }

  if (currentUser) {
    currentUser.textContent = pageUser.phone;
  }

  if (currentNickname) {
    currentNickname.textContent = `（${pageUser.nickname}）`;
  }

  bindStaticEvents();
  bindRealtimeEvents();
  bindSocketEvents(); // 添加Socket.IO事件绑定
  setupTypingDetection(); // 设置打字检测

  try {
    const loginPayload = await loginRealtimeApi(pageUser);
    mergeRealtimeData(loginPayload);
    applyPendingChatTarget();
    ensureCurrentSessionExists();
    renderSessionList();

    // 初始化Socket.IO连接
    await initializeSocketConnection();

    await loadCurrentFriendHistoryIfNeeded();
    renderMessages();
  } catch (error) {
    console.error(error);
    ensureCurrentSessionExists();
    renderSessionList();
    renderMessages();
  }
}

function bindStaticEvents() {
  if (logoutBtn) {
    logoutBtn.addEventListener("click", function () {
      localStorage.removeItem(STORAGE_KEYS.USER);
      localStorage.removeItem(STORAGE_KEYS.TOKEN);
      localStorage.removeItem(STORAGE_KEYS.MESSAGES);
      window.location.href = APP_CONFIG.LOGOUT_REDIRECT;
    });
  }

  if (sendBtn) {
    sendBtn.addEventListener("click", sendMessage);
  }

  bindFileTool();

  if (chatInput) {
    chatInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", function () {
      currentKeyword = this.value.trim();
      renderSessionList();
    });
  }

  if (addSessionBtn) {
    addSessionBtn.addEventListener("click", function () {
      openSessionModal("create");
    });
  }

  if (closeModalBtn) closeModalBtn.addEventListener("click", closeSessionModal);
  if (cancelModalBtn) cancelModalBtn.addEventListener("click", closeSessionModal);

  if (confirmModalBtn) {
    confirmModalBtn.addEventListener("click", function () {
      if (modalMode === "create") {
        createNewSessionFromModal();
      } else {
        renameSessionFromModal();
      }
    });
  }

  if (sessionNameInput) {
    sessionNameInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        if (modalMode === "create") {
          createNewSessionFromModal();
        } else {
          renameSessionFromModal();
        }
      }
    });
  }

  if (sessionModal) {
    sessionModal.addEventListener("click", function (e) {
      if (e.target === sessionModal) {
        closeSessionModal();
      }
    });
  }

  if (closeDeleteModalBtn) closeDeleteModalBtn.addEventListener("click", closeDeleteModal);
  if (cancelDeleteBtn) cancelDeleteBtn.addEventListener("click", closeDeleteModal);

  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener("click", deleteSessionConfirmed);
  }

  if (deleteModal) {
    deleteModal.addEventListener("click", function (e) {
      if (e.target === deleteModal) {
        closeDeleteModal();
      }
    });
  }

  document.addEventListener("click", function () {
    if (openDropdownSessionId !== null) {
      openDropdownSessionId = null;
      renderSessionList();
    }
  });
}

function bindFileTool() {
  const chips = Array.from(document.querySelectorAll(".tool-chip"));
  const attachChip = chips.find(function (el) {
    return (el.textContent || "").trim() === "📎";
  });
  if (!attachChip) return;

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.style.display = "none";
  document.body.appendChild(fileInput);

  attachChip.addEventListener("click", function () {
    const session = sessionData[currentSessionId];
    if (!session || session.chatType !== "friend" || !session.targetUserId) return;
    fileInput.value = "";
    fileInput.click();
  });

  fileInput.addEventListener("change", function () {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    sendFileMessage(file);
  });
}

async function sendFileMessage(file) {
  const session = sessionData[currentSessionId];
  if (!session || !pageUser) return;
  if (session.chatType !== "friend" || !session.targetUserId) return;

  const fileName = file.name || "file";
  const objectUrl = URL.createObjectURL(file);
  const selfMessage = {
    type: "self",
    name: pageUser.nickname,
    text: `[文件] ${fileName}`,
    fileName: fileName,
    fileDataUrl: objectUrl,
    time: getCurrentTime(),
    dayLabel: "今天",
    createdAt: new Date().toISOString()
  };

  session.messages.push(selfMessage);
  session.updatedAt = Date.now();

  saveSessionData();
  renderMessages();
  renderSessionList();
  scrollMessagesToBottom();

  try {
    await sendP2PFileApi({
      fromUser: pageUser,
      toUserId: session.targetUserId,
      file: file
    });
  } catch (error) {
    console.error(error);
  }
}

function bindRealtimeEvents() {
  onChatEvent("recv-p2p", function (payload) {
    handleIncomingP2PMessage(payload);
  });

  onChatEvent("msg-error", function (message) {
    console.error("消息发送失败：", message);
  });
}

function mergeRealtimeData(loginPayload) {
  const friendProfiles = loginPayload.friendProfiles || [];
  const recentMessages = loginPayload.recentMessages || [];
  const groupedMessages = {};

  friendProfiles.forEach(function (profile) {
    const sessionId = buildFriendSessionId(profile.userId);
    if (!sessionData[sessionId]) {
      sessionData[sessionId] = createEmptyFriendSession(profile);
    }
  });

  recentMessages.forEach(function (row) {
    if (row.msgType !== "p2p" && row.msgType !== "file_p2p") return;

    const partnerId =
      row.fromUserId === pageUser.userId ? row.toUserId : row.fromUserId;

    if (!partnerId) return;

    const profile = getFriendProfile(partnerId);
    const sessionId = buildFriendSessionId(partnerId);

    if (!groupedMessages[sessionId]) {
      groupedMessages[sessionId] = {
        title: profile.username,
        avatar: profile.avatar,
        chatType: "friend",
        targetUserId: profile.userId,
        updatedAt: 0,
        messages: []
      };
    }

    groupedMessages[sessionId].messages.push(
      convertServerMessageToUiMessage(row, pageUser.userId)
    );

    const createdAtTs = new Date(row.createdAt || Date.now()).getTime();
    if (createdAtTs > groupedMessages[sessionId].updatedAt) {
      groupedMessages[sessionId].updatedAt = createdAtTs;
    }
  });

  Object.keys(groupedMessages).forEach(function (sessionId) {
    sessionData[sessionId] = {
      ...(sessionData[sessionId] || {}),
      ...groupedMessages[sessionId]
    };
  });

  saveSessionData();
}

function createEmptyFriendSession(profile) {
  return {
    title: profile.username,
    avatar: profile.avatar,
    chatType: "friend",
    targetUserId: profile.userId,
    updatedAt: Date.now() - 1,
    messages: [
      {
        type: "other",
        name: profile.username,
        avatar: profile.avatar,
        text: `你已与 ${profile.username} 建立好友关系，可以开始聊天。`,
        time: getCurrentTime(),
        dayLabel: "今天"
      }
    ]
  };
}

function handleIncomingP2PMessage(payload) {
  const fromUserId = payload.fromUserId;
  const profile = getFriendProfile(fromUserId);
  const sessionId = buildFriendSessionId(fromUserId);

  if (!sessionData[sessionId]) {
    sessionData[sessionId] = createEmptyFriendSession(profile);
  }

  const exists = sessionData[sessionId].messages.some(function (msg) {
    return msg.serverId && msg.serverId === payload.id;
  });

  if (!exists) {
    sessionData[sessionId].messages.push({
      serverId: payload.id,
      type: "other",
      name: profile.username,
      avatar: profile.avatar,
      text: extractMessageText(payload.encryptedMsg, ""),
      time: formatMessageTime(payload.createdAt),
      dayLabel: formatMessageDayLabel(payload.createdAt),
      createdAt: payload.createdAt
    });
  }

  sessionData[sessionId].title = profile.username;
  sessionData[sessionId].avatar = profile.avatar;
  sessionData[sessionId].chatType = "friend";
  sessionData[sessionId].targetUserId = profile.userId;
  sessionData[sessionId].updatedAt = Date.now();

  saveSessionData();
  renderSessionList();

  if (currentSessionId === sessionId) {
    renderMessages();
  }
}

function openSessionModal(mode, sessionId = null) {
  if (!sessionModal || !sessionNameInput || !modalMessage || !modalTitle) return;

  modalMode = mode;
  editingSessionId = sessionId;

  if (mode === "create") {
    modalTitle.textContent = "新建会话";
    sessionNameInput.value = "";
    modalMessage.textContent = "输入后点击确认创建会话";
  } else {
    modalTitle.textContent = "重命名会话";
    sessionNameInput.value = sessionData[sessionId]?.title || "";
    modalMessage.textContent = "修改名称后点击确认保存";
  }

  modalMessage.style.color = "#94a3b8";
  sessionModal.classList.remove("hidden");

  setTimeout(function () {
    sessionNameInput.focus();
    sessionNameInput.select();
  }, 0);
}

function closeSessionModal() {
  if (!sessionModal) return;
  sessionModal.classList.add("hidden");
  editingSessionId = null;
}

function createNewSessionFromModal() {
  if (!sessionNameInput || !modalMessage) return;

  const rawName = sessionNameInput.value.trim();

  if (!rawName) {
    modalMessage.textContent = "会话名称不能为空";
    modalMessage.style.color = "#f87171";
    return;
  }

  const normalizedName = rawName.replace(/\s+/g, " ").trim();

  const exists = Object.keys(sessionData).some(function (sessionId) {
    return sessionData[sessionId].title === normalizedName;
  });

  if (exists) {
    modalMessage.textContent = "该会话名称已存在，请换一个名字";
    modalMessage.style.color = "#f87171";
    return;
  }

  const sessionId = generateSessionId(normalizedName);

  sessionData[sessionId] = {
    title: normalizedName,
    avatar: normalizedName.slice(0, 1),
    chatType: "custom",
    updatedAt: Date.now(),
    messages: [
      {
        type: "other",
        name: normalizedName,
        avatar: normalizedName.slice(0, 1),
        text: `你好，我是 ${normalizedName}，这是新建会话。`,
        time: getCurrentTime(),
        dayLabel: "今天"
      }
    ]
  };

  currentSessionId = sessionId;
  saveSessionData();
  renderSessionList();
  renderMessages();
  closeSessionModal();
}

function renameSessionFromModal() {
  if (!sessionNameInput || !modalMessage || !editingSessionId) return;

  const rawName = sessionNameInput.value.trim();

  if (!rawName) {
    modalMessage.textContent = "会话名称不能为空";
    modalMessage.style.color = "#f87171";
    return;
  }

  const normalizedName = rawName.replace(/\s+/g, " ").trim();

  const exists = Object.keys(sessionData).some(function (sessionId) {
    return sessionId !== editingSessionId && sessionData[sessionId].title === normalizedName;
  });

  if (exists) {
    modalMessage.textContent = "该会话名称已存在，请换一个名字";
    modalMessage.style.color = "#f87171";
    return;
  }

  sessionData[editingSessionId].title = normalizedName;
  sessionData[editingSessionId].avatar = normalizedName.slice(0, 1);
  sessionData[editingSessionId].updatedAt = Date.now();

  saveSessionData();
  renderSessionList();
  renderMessages();
  closeSessionModal();
}

function openDeleteModal(sessionId) {
  if (!deleteModal || !deleteModalText) return;

  deletingSessionId = sessionId;
  const session = sessionData[sessionId];
  deleteModalText.textContent = `确认删除“${session.title}”这个会话吗？删除后无法恢复。`;
  deleteModal.classList.remove("hidden");
}

function closeDeleteModal() {
  if (!deleteModal) return;
  deleteModal.classList.add("hidden");
  deletingSessionId = null;
}

function deleteSessionConfirmed() {
  if (!deletingSessionId || !sessionData[deletingSessionId]) return;

  delete sessionData[deletingSessionId];

  const ids = getSortedSessionIds();
  if (ids.length === 0) {
    sessionData = cloneData(DEFAULT_SESSION_DATA);
    sessionData = prepareSessionData(sessionData);
  }

  currentSessionId = getSortedSessionIds()[0];
  openDropdownSessionId = null;
  saveSessionData();
  renderSessionList();
  renderMessages();
  closeDeleteModal();
}

function renderSessionList() {
  if (!sessionList) return;

  const ids = getSortedSessionIds();
  const keyword = currentKeyword.toLowerCase();

  const filteredIds = ids.filter(function (sessionId) {
    const session = sessionData[sessionId];
    if (!keyword) return true;

    const title = session.title.toLowerCase();
    const lastMessage = getLastMessageText(session).toLowerCase();
    return title.includes(keyword) || lastMessage.includes(keyword);
  });

  sessionList.innerHTML = "";

  if (filteredIds.length === 0) {
    sessionList.innerHTML = `
      <div style="padding:16px;color:#94a3b8;font-size:14px;">
        没有找到匹配的会话
      </div>
    `;
    return;
  }

  filteredIds.forEach(function (sessionId) {
    const session = sessionData[sessionId];
    const lastMessage = getLastMessage(session);
    const unreadCount = getUnreadCount(sessionId);
    const isDropdownOpen = openDropdownSessionId === sessionId;

    const card = document.createElement("div");
    card.className = `session-card ${sessionId === currentSessionId ? "active" : ""}`;
    card.dataset.sessionId = sessionId;

    // 获取用户在线状态
    const userOnlineStatus = session.chatType === "friend" && session.targetUserId
      ? getUserOnlineStatus(session.targetUserId)
      : false;

    card.innerHTML = `
      <div class="session-avatar">${escapeHtml(session.avatar || "")}</div>
      <div class="session-info">
        <div class="session-card-head">
          <div class="session-name">${escapeHtml(session.title)}</div>
          <div class="session-status-indicator">
            <span class="status-dot ${userOnlineStatus ? 'online' : 'offline'}" title="${userOnlineStatus ? '在线' : '离线'}"></span>
          </div>
          <div class="session-more-wrap">
            <button class="session-more-btn" type="button">⋯</button>
            <div class="session-dropdown ${isDropdownOpen ? "" : "hidden"}">
              <button class="session-dropdown-btn rename-btn" type="button">重命名</button>
              <button class="session-dropdown-btn danger delete-btn" type="button">删除</button>
            </div>
          </div>
        </div>

        <div class="session-line-top">
          <div class="session-time">${escapeHtml(lastMessage.time || "")}</div>
        </div>

        <div class="session-line-bottom">
          <div class="session-desc">${escapeHtml(lastMessage.text || "")}</div>
          <div class="session-badge ${unreadCount === 0 ? "muted" : ""}" style="${unreadCount === 0 ? "opacity:0;" : ""}">
            ${unreadCount > 0 ? unreadCount : ""}
          </div>
        </div>
      </div>
    `;

    card.addEventListener("click", async function () {
      currentSessionId = sessionId;
      openDropdownSessionId = null;
      renderSessionList();
      await loadCurrentFriendHistoryIfNeeded();
      renderMessages();
    });

    const moreBtn = card.querySelector(".session-more-btn");
    const renameBtn = card.querySelector(".rename-btn");
    const deleteBtn = card.querySelector(".delete-btn");

    if (moreBtn) {
      moreBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        openDropdownSessionId = openDropdownSessionId === sessionId ? null : sessionId;
        renderSessionList();
      });
    }

    if (renameBtn) {
      renameBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        openDropdownSessionId = null;
        renderSessionList();
        openSessionModal("rename", sessionId);
      });
    }

    if (deleteBtn) {
      deleteBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        openDropdownSessionId = null;
        renderSessionList();
        openDeleteModal(sessionId);
      });
    }

    const dropdown = card.querySelector(".session-dropdown");
    if (dropdown) {
      dropdown.addEventListener("click", function (e) {
        e.stopPropagation();
      });
    }

    sessionList.appendChild(card);
  });
}

function renderMessages() {
  if (!chatMessages || !chatTitle) return;

  const session = sessionData[currentSessionId];
  if (!session) return;

  chatTitle.textContent = session.title;
  chatMessages.innerHTML = "";

  let lastDivider = "";

  session.messages.forEach(function (msg) {
    const dividerLabel = getMessageDividerLabel(msg);

    if (dividerLabel && dividerLabel !== lastDivider) {
      const divider = document.createElement("div");
      divider.className = "message-divider";
      divider.innerHTML = `<span>${escapeHtml(dividerLabel)}</span>`;
      chatMessages.appendChild(divider);
      lastDivider = dividerLabel;
    }

    const row = document.createElement("div");
    row.className = `message-row ${msg.type}`;

    if (msg.type !== "self") {
      const avatar = document.createElement("div");
      avatar.className = "message-avatar";
      avatar.textContent = msg.avatar || "";
      row.appendChild(avatar);
    }

    const wrap = document.createElement("div");
    wrap.className = "message-bubble-wrap";

    const name = document.createElement("div");
    name.className = "message-name";
    name.textContent = `${msg.name || ""} · ${msg.time || ""}`.trim();
    wrap.appendChild(name);

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    if (msg.fileDataUrl && msg.fileName) {
      const link = document.createElement("a");
      link.href = msg.fileDataUrl;
      link.download = msg.fileName;
      link.textContent = `[文件] ${msg.fileName}`;
      bubble.appendChild(link);
    } else {
      bubble.textContent = msg.text || "";
    }
    wrap.appendChild(bubble);
    row.appendChild(wrap);

    chatMessages.appendChild(row);
  });

  scrollMessagesToBottom();
}

async function sendMessage() {
  if (!chatInput) return;

  const text = chatInput.value.trim();
  if (!text) return;

  const session = sessionData[currentSessionId];
  if (!session || !pageUser) return;

  const selfMessage = {
    type: "self",
    name: pageUser.nickname,
    text: text,
    time: getCurrentTime(),
    dayLabel: "今天",
    createdAt: new Date().toISOString()
  };

  session.messages.push(selfMessage);
  session.updatedAt = Date.now();

  saveSessionData();
  renderMessages();
  renderSessionList();
  chatInput.value = "";
  scrollMessagesToBottom();

  // 发送消息时重置打字状态
  isTyping = false;

  if (session.chatType === "friend" && session.targetUserId) {
    try {
      await sendP2PMessageApi({
        fromUser: pageUser,
        toUserId: session.targetUserId,
        text: text
      });

      // REST API 已经在后端完成持久化并通过 WebSocket 通知对方
      // 本地不需要再调用 WS send_message
    } catch (error) {
      console.error(error);
    }
    return;
  }

  const reply = await fakeReplyApi(session);
  if (!reply.dayLabel) {
    reply.dayLabel = "今天";
  }

  session.messages.push(reply);
  session.updatedAt = Date.now();

  saveSessionData();
  renderMessages();
  renderSessionList();
  scrollMessagesToBottom();
}

async function loadCurrentFriendHistoryIfNeeded() {
  const session = sessionData[currentSessionId];
  if (!session) return;

  if (session.chatType !== "friend" || !session.targetUserId) {
    return;
  }

  try {
    const rows = await getP2PHistoryApi(session.targetUserId, 100);
    const historyMessages = rows.map(function (row) {
      return convertServerMessageToUiMessage(row, pageUser.userId);
    });

    if (historyMessages.length > 0) {
      session.messages = historyMessages;
      session.updatedAt = new Date(
        rows[rows.length - 1].createdAt || Date.now()
      ).getTime();
      saveSessionData();
    }
  } catch (error) {
    console.error(error);
  }
}

function getMessageDividerLabel(msg) {
  if (msg && msg.dayLabel) {
    return msg.dayLabel;
  }
  return "今天";
}

function scrollMessagesToBottom() {
  if (!chatMessages) return;
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function loadSessionData() {
  const raw = localStorage.getItem(STORAGE_KEYS.MESSAGES);
  if (!raw) {
    const prepared = prepareSessionData(cloneData(DEFAULT_SESSION_DATA));
    saveRawSessionData(prepared);
    return prepared;
  }

  try {
    const parsed = JSON.parse(raw);
    return prepareSessionData(parsed);
  } catch (error) {
    const prepared = prepareSessionData(cloneData(DEFAULT_SESSION_DATA));
    saveRawSessionData(prepared);
    return prepared;
  }
}

function prepareSessionData(data) {
  Object.keys(data).forEach(function (sessionId) {
    const session = data[sessionId];
    if (!session.messages) {
      session.messages = [];
    }

    if (!session.updatedAt) {
      session.updatedAt = Date.now() - 1;
    }

    session.messages = session.messages.map(function (msg) {
      if (!msg.dayLabel) {
        msg.dayLabel = inferDayLabel(msg.time);
      }
      return msg;
    });
  });

  return data;
}

function inferDayLabel(time) {
  if (!time) return "今天";
  if (time === "昨天") return "昨天";
  if (
    time === "周一" ||
    time === "周二" ||
    time === "周三" ||
    time === "周四" ||
    time === "周五" ||
    time === "周六" ||
    time === "周日"
  ) {
    return "更早";
  }
  return "今天";
}

function saveSessionData() {
  saveRawSessionData(sessionData);
}

function saveRawSessionData(data) {
  localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(data));
}

function getUnreadCount(sessionId) {
  if (sessionId === currentSessionId) return 0;

  const session = sessionData[sessionId];
  if (!session) return 0;

  const otherMessages = session.messages.filter(function (msg) {
    return msg.type === "other";
  });

  return Math.min(otherMessages.length, 9);
}

/**
 * 获取用户在线状态
 * 由于我们没有实时的用户状态同步机制，这里返回一个基于最近活动的近似值
 * 在实际应用中，这应该通过WebSocket实时同步
 * @param {number|string} userId - 用户ID
 * @returns {boolean} 用户是否在线
 */
function getUserOnlineStatus(userId) {
  // 由于我们当前没有实现完整的用户在线状态同步，
  // 这里我们返回一个简化的实现：假设最近5分钟有活动的用户是在线的
  // 实际上，这应该通过WebSocket从服务器实时获取

  // 临时方案：检查本地存储中是否有最近的用户活动记录
  try {
    const activityKey = `user_activity_${userId}`;
    const lastActivity = localStorage.getItem(activityKey);
    if (lastActivity) {
      const lastActivityTime = parseInt(lastActivity, 10);
      const now = Date.now();
      // 如果最后活动时间在5分钟内，则认为用户在线
      return (now - lastActivityTime) < 5 * 60 * 1000;
    }
  } catch (e) {
    console.warn('[Chat] 获取用户活动时间失败:', e);
  }

  // 默认返回false（离线）
  return false;
}

/**
 * 更新用户活动时间（在用户进行操作时调用）
 * @param {number|string} userId - 用户ID
 */
function updateUserActivity(userId) {
  try {
    const activityKey = `user_activity_${userId}`;
    localStorage.setItem(activityKey, Date.now().toString());
  } catch (e) {
    console.warn('[Chat] 更新用户活动时间失败:', e);
  }
}

/**
 * WebSocket 事件绑定 - 对接后端 WebSocket 协议
 */
function bindSocketEvents() {
  // 监听 WebSocket 连接
  wsClient.on('connect', () => {
    console.log('[WS] 已连接');
    updateSecurityIndicator('connected');
    if (pageUser && pageUser.userId) {
      updateUserActivity(pageUser.userId);
    }
  });

  wsClient.on('disconnect', () => {
    console.log('[WS] 已断开连接');
    updateSecurityIndicator('disconnected');
  });

  wsClient.on('reconnect', () => {
    console.log('[WS] 已重连');
    updateSecurityIndicator('connected');
  });

  // 监听后端发送的所有消息，根据 type 字段分发处理
  wsClient.on('message', (message) => {
    const msgType = message.type;
    const data = message.data || {};

    if (msgType === 'new_message') {
      handleIncomingMessageFromBackend(data);
      updateUserActivity(data.sender_id);
    } else if (msgType === 'pong') {
      // 心跳响应
    } else if (msgType === 'connection_success') {
      console.log('[WS] ', data.message || '连接成功');
      updateSecurityIndicator('connected');
    } else if (msgType === 'status_update') {
      // 在线状态更新
      console.log('[WS] 状态更新:', data);
    } else {
      console.log('[WS] 收到未处理消息:', msgType, data);
    }
  });
}

/**
 * 处理后端通过 WebSocket 发送给前端的消息
 * 后端格式: {type: "new_message", data: {conversation_id, message_id, sender_id, content, timestamp}}
 */
function handleIncomingMessageFromBackend(data) {
  try {
    const fromUserId = String(data.sender_id);

    // 忽略自己发送的消息（已在本地显示）
    if (pageUser && String(data.sender_id) === String(pageUser.userId)) return;

    const partnerId = fromUserId;

    if (!partnerId) return;

    const profile = getFriendProfile(partnerId);
    if (!profile) return;

    const sessionId = buildFriendSessionId(partnerId);

    if (!sessionData[sessionId]) {
      sessionData[sessionId] = createEmptyFriendSession(profile);
    }

    // 检查消息是否已经存在（避免重复）
    const exists = sessionData[sessionId].messages.some(function (msg) {
      return msg.serverId && msg.serverId === data.message_id;
    });

    if (!exists) {
      sessionData[sessionId].messages.push({
        serverId: data.message_id,
        type: 'other',
        name: profile.username,
        avatar: profile.avatar,
        text: data.content || '',
        time: formatMessageTime(data.timestamp),
        dayLabel: formatMessageDayLabel(data.timestamp),
        createdAt: data.timestamp
      });

      sessionData[sessionId].updatedAt = Date.now();
      saveSessionData();

      if (currentSessionId === sessionId) {
        renderMessages();
        scrollMessagesToBottom();
      }

      renderSessionList();
    }
  } catch (error) {
    console.error('[WS] 处理后端消息时出错:', error);
  }
}

/**
 * 设置打字检测
 */
function setupTypingDetection() {
  if (!chatInput) return;

  let typingTimeout = null;

  chatInput.addEventListener('input', function () {
    const session = sessionData[currentSessionId];
    if (!session || session.chatType !== 'friend' || !session.targetUserId) return;

    // 发送正在输入状态
    if (!isTyping) {
      isTyping = true;
      wsClient.emit('typing', {
        conversationId: session.targetUserId,
        isTyping: true
      });
    }

    // 重置超时定时器
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }

    typingTimeout = setTimeout(function () {
      isTyping = false;
      wsClient.emit('typing', {
        conversationId: session.targetUserId,
        isTyping: false
      });
    }, 2000);
  });
}

/**
 * 更新安全状态指示器
 * @param {string} status - 'connected', 'disconnected', 'connecting'
 */
function updateSecurityIndicator(status) {
  var statusBox = document.querySelector('.online-status-box');
  if (!statusBox) return;

  var dot = statusBox.querySelector('.online-dot');
  var text = statusBox.querySelector('span:not(.online-dot)') || statusBox.lastChild;

  if (!dot) {
    dot = document.createElement('span');
    dot.className = 'online-dot';
    statusBox.insertBefore(dot, statusBox.firstChild);
  }

  dot.className = 'online-dot';

  if (status === 'connected') {
    dot.style.background = '#22c55e';
    dot.style.boxShadow = '0 0 12px rgba(34, 197, 94, 0.7)';
    text.textContent = '安全连接已建立';
    statusBox.style.color = 'var(--text-3)';
  } else if (status === 'connecting') {
    dot.style.background = '#f59e0b';
    dot.style.boxShadow = '0 0 12px rgba(245, 158, 11, 0.7)';
    text.textContent = '正在建立安全连接...';
    statusBox.style.color = '#f59e0b';
  } else {
    dot.style.background = '#ef4444';
    dot.style.boxShadow = '0 0 12px rgba(239, 68, 68, 0.7)';
    text.textContent = '安全连接已断开';
    statusBox.style.color = '#ef4444';
  }
}

/**
 * 初始化Socket.IO连接
 * @returns {Promise<void>}
 */
async function initializeSocketConnection() {
  try {
    const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
    if (!token) return;

    updateSecurityIndicator('connecting');

    const apiBaseUrl = APP_CONFIG.API_BASE_URL;
    let wsUrl = apiBaseUrl.replace(/^http:\/\//, 'ws://').replace(/^https:\/\//, 'wss://');
    const wsBaseUrl = wsUrl.substring(0, wsUrl.lastIndexOf('/api'));

    console.log('[WS] 正在连接到服务器:', wsBaseUrl);
    await wsClient.connect(wsBaseUrl, token);
  } catch (error) {
    console.error('[WS] 初始化连接失败:', error);
    updateSecurityIndicator('disconnected');
  }
}

function getLastMessage(session) {
  if (!session || !session.messages || session.messages.length === 0) {
    return { text: "", time: "" };
  }

  return session.messages[session.messages.length - 1];
}

function getLastMessageText(session) {
  const lastMessage = getLastMessage(session);
  return lastMessage.text || "";
}

function generateSessionId(name) {
  return "custom_" + name.replace(/\s+/g, "_") + "_" + Date.now();
}

function ensureCurrentSessionExists() {
  const ids = getSortedSessionIds();
  if (!ids.length) {
    sessionData = cloneData(DEFAULT_SESSION_DATA);
    sessionData = prepareSessionData(sessionData);
    saveSessionData();
    currentSessionId = "fileHelper";
    return;
  }

  if (!sessionData[currentSessionId]) {
    currentSessionId = ids[0];
  }
}

function getSortedSessionIds() {
  return Object.keys(sessionData).sort(function (a, b) {
    const aTime = sessionData[a]?.updatedAt || 0;
    const bTime = sessionData[b]?.updatedAt || 0;
    return bTime - aTime;
  });
}

function buildFriendSessionId(userId) {
  return "friend_" + userId;
}

function applyPendingChatTarget() {
  const raw = localStorage.getItem(CHAT_TARGET_STORAGE_KEY);
  if (!raw) return;

  try {
    const target = JSON.parse(raw);
    if (!target || !target.name) return;

    if (target.type === "friend" && target.userId) {
      const profile = {
        userId: target.userId,
        username: target.name,
        phone: "",
        avatar: target.avatar || target.name.slice(0, 1)
      };

      saveFriendProfile(profile);

      const sessionId = buildFriendSessionId(target.userId);

      if (!sessionData[sessionId]) {
        sessionData[sessionId] = {
          title: target.name,
          avatar: profile.avatar,
          chatType: "friend",
          targetUserId: target.userId,
          updatedAt: Date.now(),
          messages: [
            {
              type: "other",
              name: target.name,
              avatar: profile.avatar,
              text: `你已进入和 ${target.name} 的聊天窗口。`,
              time: getCurrentTime(),
              dayLabel: "今天"
            }
          ]
        };
      }

      currentSessionId = sessionId;
      saveSessionData();
      return;
    }
  } catch (error) {
    console.error(error);
  } finally {
    localStorage.removeItem(CHAT_TARGET_STORAGE_KEY);
  }
}
