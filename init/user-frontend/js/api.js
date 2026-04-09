const FRIEND_PROFILE_STORAGE_KEY = "chat_demo_friend_profiles";
const CHAT_EVENT_PREFIX = "qke-chat:";

function emitChatEvent(type, detail) {
  window.dispatchEvent(
    new CustomEvent(CHAT_EVENT_PREFIX + type, {
      detail
    })
  );
}

function onChatEvent(type, handler) {
  const wrapped = function (event) {
    handler(event.detail);
  };
  window.addEventListener(CHAT_EVENT_PREFIX + type, wrapped);
  return function () {
    window.removeEventListener(CHAT_EVENT_PREFIX + type, wrapped);
  };
}

function getAccessToken() {
  return localStorage.getItem(STORAGE_KEYS.TOKEN) || "";
}

async function httpRequest(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  const token = getAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(APP_CONFIG.API_BASE_URL + path, {
    ...options,
    headers
  });

  if (!response.ok) {
    let detail = "请求失败";
    try {
      const payload = await response.json();
      detail = payload.detail || payload.message || detail;
    } catch (error) {
      detail = response.statusText || detail;
    }
    throw new Error(detail);
  }

  if (response.status === 204) return null;
  return await response.json();
}

async function httpRequestForm(path, formData) {
  const headers = {};
  const token = getAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(APP_CONFIG.API_BASE_URL + path, {
    method: "POST",
    headers,
    body: formData
  });

  if (!response.ok) {
    let detail = "请求失败";
    try {
      const payload = await response.json();
      detail = payload.detail || payload.message || detail;
    } catch (error) {
      detail = response.statusText || detail;
    }
    throw new Error(detail);
  }

  if (response.status === 204) return null;
  return await response.json();
}

async function registerUserApi(payload) {
  return await httpRequest("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

async function loginUserApi(account, password) {
  return await httpRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({ account, password })
  });
}

async function fakeLoginApi(phone, password) {
  const loginResult = await loginUserApi(phone, password);
  return {
    token: loginResult.access_token,
    user: {
      phone: loginResult.user.account,
      nickname: loginResult.user.username,
      userId: String(loginResult.user.user_id)
    }
  };
}

/**
 * 获取当前用户的所有会话（私聊/群聊）
 * @returns {Promise<{items: Array}>}
 */
async function listMyConversationsApi() {
  return await httpRequest("/chat/conversations/mine");
}

async function loginRealtimeApi(user) {
  const friendsPayload = await httpRequest("/chat/friends");
  const friendProfiles = (friendsPayload.items || []).map(function (item) {
    const profile = {
      userId: String(item.user_id),
      username: item.username,
      phone: item.account || "",
      avatar: (item.username || "U").slice(0, 1)
    };
    saveFriendProfile(profile);
    return profile;
  });

  // 从后端拉取真实会话列表和历史消息
  var recentMessages = [];
  var conversations = [];
  try {
    var convPayload = await httpRequest("/chat/conversations/mine");
    conversations = convPayload.items || [];
  } catch (e) {
    console.warn("[API] 获取会话列表失败，将使用本地缓存:", e);
  }

  return {
    userId: user.userId,
    username: user.nickname,
    qkeKey: "",
    friends: friendProfiles.map(function (item) {
      return item.userId;
    }),
    friendProfiles,
    groups: [],
    recentMessages: recentMessages,
    conversations: conversations
  };
}

async function addFriendApi(inputValue) {
  const payload = await httpRequest("/chat/friends", {
    method: "POST",
    body: JSON.stringify({ account_or_user_id: String(inputValue || "").trim() })
  });

  const profile = {
    userId: String(payload.user_id),
    username: payload.username,
    phone: payload.account || "",
    avatar: (payload.username || "U").slice(0, 1)
  };
  saveFriendProfile(profile);
  return {
    friendId: profile.userId,
    profile,
    msg: "添加成功"
  };
}

async function sendP2PMessageApi(options) {
  const fromUser = options.fromUser;
  const toUserId = String(options.toUserId || "").trim();
  const text = String(options.text || "").trim();

  if (!fromUser || !fromUser.userId || !toUserId || !text) {
    throw new Error("发送消息缺少必要字段");
  }

  const payload = await httpRequest("/chat/messages/p2p", {
    method: "POST",
    body: JSON.stringify({
      to_user_id: Number(toUserId),
      text
    })
  });

  emitChatEvent("message-delivered", payload);
  return { ok: true };
}

async function sendP2PFileApi(options) {
  const fromUser = options.fromUser;
  const toUserId = String(options.toUserId || "").trim();
  const file = options.file;

  if (!fromUser || !fromUser.userId || !toUserId || !file) {
    throw new Error("发送文件缺少必要字段");
  }

  const formData = new FormData();
  formData.append("to_user_id", String(Number(toUserId)));
  formData.append("file", file, file.name || "file");

  const payload = await httpRequestForm("/chat/messages/p2p/file", formData);
  emitChatEvent("message-delivered", payload);
  return payload;
}

async function getP2PHistoryApi(withUserId, limit = 50) {
  const payload = await httpRequest(
    `/chat/messages/p2p/history?with_user_id=${encodeURIComponent(Number(withUserId))}&limit=${encodeURIComponent(limit)}`
  );

  return (payload.items || []).map(function (row) {
    if (row.message_type === "file") {
      const safeMime = row.file_mime || "application/octet-stream";
      const dataUrl = row.file_b64 ? `data:${safeMime};base64,${row.file_b64}` : "";
      return {
        id: row.id,
        msgType: "file_p2p",
        fromUserId: String(row.from_user_id),
        toUserId: String(row.to_user_id),
        encryptedMsg: {
          text: row.plaintext
        },
        content: {},
        fileName: row.file_name || "file",
        fileDataUrl: dataUrl,
        createdAt: row.created_at
      };
    }
    return {
      id: row.id,
      msgType: "p2p",
      fromUserId: String(row.from_user_id),
      toUserId: String(row.to_user_id),
      encryptedMsg: {
        text: row.plaintext
      },
      content: {
        text: row.plaintext
      },
      createdAt: row.created_at
    };
  });
}

function fakeReplyApi(session) {
  return new Promise(function (resolve) {
    setTimeout(function () {
      resolve({
        type: "other",
        name: session.title,
        avatar: session.avatar,
        text: `已收到你发给${session.title}的消息，这是演示回复。`,
        time: getCurrentTime()
      });
    }, APP_CONFIG.DEMO_REPLY_DELAY);
  });
}

function getFriendProfilesMap() {
  const raw = localStorage.getItem(FRIEND_PROFILE_STORAGE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (error) {
    return {};
  }
}

function saveFriendProfilesMap(map) {
  localStorage.setItem(FRIEND_PROFILE_STORAGE_KEY, JSON.stringify(map));
}

function saveFriendProfile(profile) {
  if (!profile || !profile.userId) return;
  const map = getFriendProfilesMap();
  map[profile.userId] = {
    userId: profile.userId,
    username: profile.username,
    phone: profile.phone || "",
    avatar: profile.avatar || (profile.username || profile.userId).slice(0, 1)
  };
  saveFriendProfilesMap(map);
}

function getFriendProfile(userId) {
  const map = getFriendProfilesMap();
  return map[String(userId)] || deriveProfileFromUserId(userId);
}

function mergeFriendIdsToProfiles(friendIds) {
  return (friendIds || []).map(function (friendId) {
    const profile = getFriendProfile(friendId);
    saveFriendProfile(profile);
    return profile;
  });
}

function deriveProfileFromUserId(userId) {
  const value = String(userId || "").trim();
  return {
    userId: value,
    phone: "",
    username: value || "未知用户",
    avatar: (value || "U").slice(0, 1)
  };
}

function extractMessageText(content, fileName) {
  if (fileName) return `[文件] ${fileName}`;
  if (typeof content === "string") return content;
  if (content && typeof content === "object") {
    if (content.text) return content.text;
    if (content.message) return content.message;
  }
  return "收到一条消息";
}

function formatMessageTime(isoString) {
  if (!isoString) return getCurrentTime();
  const date = new Date(isoString);
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${hour}:${minute}`;
}

function formatMessageDayLabel(isoString) {
  if (!isoString) return "今天";
  const msgDate = new Date(isoString);
  const now = new Date();
  const msgDay = new Date(msgDate.getFullYear(), msgDate.getMonth(), msgDate.getDate());
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.floor((nowDay - msgDay) / 86400000);
  if (diff <= 0) return "今天";
  if (diff === 1) return "昨天";
  return "更早";
}

function convertServerMessageToUiMessage(row, currentUserId) {
  const selfUser = getStoredUser();
  const isSelf = String(row.fromUserId) === String(currentUserId);
  const partnerUserId = isSelf ? row.toUserId : row.fromUserId;
  const partnerProfile = getFriendProfile(partnerUserId);

  return {
    serverId: row.id,
    type: isSelf ? "self" : "other",
    name: isSelf ? selfUser?.nickname || "我" : partnerProfile.username || partnerUserId,
    avatar: isSelf
      ? (selfUser?.nickname || "我").slice(0, 1)
      : partnerProfile.avatar || (partnerProfile.username || "U").slice(0, 1),
    text: extractMessageText(row.content, row.fileName),
    fileName: row.fileName || "",
    fileDataUrl: row.fileDataUrl || "",
    time: formatMessageTime(row.createdAt),
    dayLabel: formatMessageDayLabel(row.createdAt),
    createdAt: row.createdAt
  };
}
