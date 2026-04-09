const friendList = document.getElementById("friendList");
const friendSearchInput = document.getElementById("friendSearchInput");
const addFriendInput = document.getElementById("addFriendInput");
const addFriendBtn = document.getElementById("addFriendBtn");
const friendStatusMsg = document.getElementById("friendStatusMsg");
const friendDetailArea = document.getElementById("friendDetailArea");
const friendDetailTitle = document.getElementById("friendDetailTitle");
const friendDetailSubtitle = document.getElementById("friendDetailSubtitle");

const CHAT_TARGET_STORAGE_KEY = "QKE_PENDING_CHAT_TARGET";

let currentUser = null;
let friendsData = [];
let currentFriendId = null;
let friendGroups = {
  "最近联系": [],
  "我的好友": [],
  "同事": [],
  "家人": [],
  "其他": []
};
let currentSearchKeyword = "";
let onlineFriends = new Set(); // 在线好友集合

initFriendsPage();

async function initFriendsPage() {
  currentUser = getStoredUser();
  const token = localStorage.getItem(STORAGE_KEYS.TOKEN);

  if (!currentUser || !token) {
    window.location.href = APP_CONFIG.LOGOUT_REDIRECT;
    return;
  }

  bindFriendEvents();

  try {
    const loginPayload = await loginRealtimeApi(currentUser);
    friendsData = (loginPayload.friendProfiles || []).map(toFriendViewModel);

    if (friendsData.length > 0) {
      currentFriendId = friendsData[0].userId;
    }

    renderFriendList();
    renderCurrentFriendDetail();
    setFriendStatus("已连接到聊天服务器", false);
  } catch (error) {
    console.error(error);
    setFriendStatus(error.message || "连接聊天服务器失败", true);
  }

  onChatEvent("friend-request", function (payload) {
    if (!payload || !payload.fromUserId) return;

    // 显示好友请求通知
    setFriendStatus(`收到来自用户${payload.fromUserId}的好友请求`, false);

    // 如果是新好友请求，可以在这里添加处理逻辑
    // 例如显示一个确认对话框
  });

  onChatEvent("friend-added", function (payload) {
    if (!payload || !payload.friend) return;

    const item = toFriendViewModel(payload.friend);
    upsertFriend(item);
    setFriendStatus(`新好友"${item.username}"已添加`, false);
  });

  onChatEvent("friend-removed", function (payload) {
    if (!payload || !payload.friendId) return;

    const friend = friendsData.find(f => f.userId === payload.friendId);
    if (friend) {
      deleteFriend(payload.friendId);
      setFriendStatus(`好友"${friend.username}"已从好友列表中移除`, false);
    }
  });

    setFriendStatus(`收到新的好友关系通知：${item.username}`, false);
    renderFriendList();
    renderCurrentFriendDetail();
  });
}

function bindFriendEvents() {
  if (friendSearchInput) {
    friendSearchInput.addEventListener("input", function () {
      renderFriendList();
    });
  }

  if (addFriendBtn) {
    addFriendBtn.addEventListener("click", handleAddFriend);
  }

  if (addFriendInput) {
    addFriendInput.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        handleAddFriend();
      }
    });
  }
}

async function handleAddFriend() {
  const rawValue = String(addFriendInput?.value || "").trim();

  if (!rawValue) {
    setFriendStatus("请输入手机号或用户ID", true);
    return;
  }

  try {
    addFriendBtn.disabled = true;
    setFriendStatus("正在添加好友...", false);

    const result = await addFriendApi(rawValue);
    const friendItem = toFriendViewModel(result.profile);

    upsertFriend(friendItem);
    currentFriendId = friendItem.userId;

    renderFriendList();
    renderCurrentFriendDetail();

    if (addFriendInput) {
      addFriendInput.value = "";
    }

    setFriendStatus(`已成功添加好友：${friendItem.username}`, false);
  } catch (error) {
    console.error(error);
    setFriendStatus(error.message || "添加好友失败", true);
  } finally {
    addFriendBtn.disabled = false;
  }
}

function renderFriendList() {
  if (!friendList) return;

  const keyword = String(friendSearchInput?.value || "").trim().toLowerCase();

  const filteredFriends = friendsData.filter(function (item) {
    if (!keyword) return true;

    return (
      item.username.toLowerCase().includes(keyword) ||
      item.userId.toLowerCase().includes(keyword) ||
      item.phone.toLowerCase().includes(keyword)
    );
  });

  friendList.innerHTML = "";

  if (!filteredFriends.length) {
    friendList.innerHTML = `
      <div style="padding:16px;color:#94a3b8;font-size:14px;">
        没有找到匹配好友
      </div>
    `;
    return;
  }

  filteredFriends.forEach(function (friend) {
    const card = document.createElement("div");
    card.className = `session-card ${friend.userId === currentFriendId ? "active" : ""}`;

    card.innerHTML = `
      <div class="session-avatar">${escapeHtml(friend.avatar)}</div>
      <div class="session-info">
        <div class="session-line-top">
          <span class="session-name">${escapeHtml(friend.username)}</span>
          <span class="session-time">${friend.online ? "在线" : "离线"}</span>
        </div>
        <div class="session-desc">${escapeHtml(friend.userId)}</div>
      </div>
    `;

    card.addEventListener("click", function () {
      currentFriendId = friend.userId;
      renderFriendList();
      renderCurrentFriendDetail();
    });

    friendList.appendChild(card);
  });
}

function renderCurrentFriendDetail() {
  if (!friendDetailArea) return;

  const currentFriend = friendsData.find(function (item) {
    return item.userId === currentFriendId;
  });

  if (!currentFriend) {
    friendDetailTitle.textContent = "好友详情";
    friendDetailSubtitle.textContent = "请选择左侧好友查看详情";
    friendDetailArea.innerHTML = `
      <div style="color:#94a3b8;font-size:14px;">请选择左侧好友查看详情</div>
    `;
    return;
  }

  friendDetailTitle.textContent = currentFriend.username;
  friendDetailSubtitle.textContent = currentFriend.online ? "当前在线" : "当前离线";

  friendDetailArea.innerHTML = `
    <div class="friend-detail-card">
      <div class="friend-detail-row">
        <div class="friend-detail-label">昵称</div>
        <div class="friend-detail-value">${escapeHtml(currentFriend.username)}</div>
      </div>

      <div class="friend-detail-row">
        <div class="friend-detail-label">用户ID</div>
        <div class="friend-detail-value">${escapeHtml(currentFriend.userId)}</div>
      </div>

      <div class="friend-detail-row">
        <div class="friend-detail-label">手机号</div>
        <div class="friend-detail-value">${escapeHtml(currentFriend.phone || "未知")}</div>
      </div>

      <div class="friend-detail-row">
        <div class="friend-detail-label">状态</div>
        <div class="friend-detail-value">${currentFriend.online ? "在线" : "离线"}</div>
      </div>

      <div class="friend-action-row">
        <button class="friend-action-btn secondary" id="refreshFriendBtn" type="button">刷新信息</button>
        <button class="friend-action-btn primary" id="startFriendChatBtn" type="button">发消息</button>
      </div>
    </div>
  `;

  const refreshFriendBtn = document.getElementById("refreshFriendBtn");
  const startFriendChatBtn = document.getElementById("startFriendChatBtn");

  if (refreshFriendBtn) {
    refreshFriendBtn.addEventListener("click", function () {
      setFriendStatus(`已刷新好友信息：${currentFriend.username}`, false);
    });
  }

  if (startFriendChatBtn) {
    startFriendChatBtn.addEventListener("click", function () {
      localStorage.setItem(
        CHAT_TARGET_STORAGE_KEY,
        JSON.stringify({
          type: "friend",
          userId: currentFriend.userId,
          name: currentFriend.username,
          avatar: currentFriend.avatar
        })
      );

      window.location.href = "chat.html";
    });
  }
}

function upsertFriend(friendItem) {
  const index = friendsData.findIndex(function (item) {
    return item.userId === friendItem.userId;
  });

  if (index >= 0) {
    friendsData[index] = friendItem;
  } else {
    friendsData.unshift(friendItem);
  }
}

function toFriendViewModel(profile) {
  return {
    userId: profile.userId,
    username: profile.username || profile.userId,
    phone: profile.phone || "",
    avatar: profile.avatar || (profile.username || profile.userId).slice(0, 1),
    online: false
  };
}

function setFriendStatus(message, isError) {
  if (!friendStatusMsg) return;
  friendStatusMsg.textContent = message;
  friendStatusMsg.style.color = isError ? "#f87171" : "#94a3b8";
}