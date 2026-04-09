const favoriteList = document.getElementById("favoriteList");
const favoriteSearchInput = document.getElementById("favoriteSearchInput");
const favoriteDetailArea = document.getElementById("favoriteDetailArea");

const CHAT_TARGET_STORAGE_KEY = "QKE_PENDING_CHAT_TARGET";

const favoritesData = [
  {
    id: 1,
    title: "项目需求文档",
    desc: "这是你收藏的重要需求说明，包含页面目标、核心功能和验收标准。",
    time: "今天",
    type: "文档",
    chatTargetName: "文件助手",
    chatTargetAvatar: "文",
    welcomeText: "你好，我想继续讨论一下《项目需求文档》的内容。"
  },
  {
    id: 2,
    title: "会议纪要",
    desc: "记录了最近一次项目会议内容，包括排期、负责人和待办事项。",
    time: "昨天",
    type: "记录",
    chatTargetName: "李四",
    chatTargetAvatar: "李",
    welcomeText: "你好，我想继续确认一下会议纪要里的内容。"
  },
  {
    id: 3,
    title: "高优先级消息",
    desc: "这是你标记的重要聊天内容，后续需要继续跟进和处理。",
    time: "周一",
    type: "消息",
    chatTargetName: "张三",
    chatTargetAvatar: "张",
    welcomeText: "你好，我来继续跟进之前那条高优先级消息。"
  },
  {
    id: 4,
    title: "UI参考链接",
    desc: "这里整理了你收藏的界面风格参考，方便后续继续统一设计。",
    time: "更早",
    type: "链接",
    chatTargetName: "前端开发组",
    chatTargetAvatar: "群",
    welcomeText: "大家好，我想同步一下收藏的 UI 参考链接。"
  }
];

let currentFavoriteId = null;

initFavoritesPage();

function initFavoritesPage() {
  renderFavoriteList(favoritesData);

  if (favoriteSearchInput) {
    favoriteSearchInput.addEventListener("input", function () {
      const keyword = this.value.trim().toLowerCase();

      const filteredList = favoritesData.filter(function (item) {
        return (
          item.title.toLowerCase().includes(keyword) ||
          item.desc.toLowerCase().includes(keyword) ||
          item.type.toLowerCase().includes(keyword)
        );
      });

      currentFavoriteId = null;
      renderFavoriteList(filteredList);

      if (!filteredList.length) {
        renderFavoriteEmptyDetail("没有找到匹配的收藏内容");
      }
    });
  }
}

function renderFavoriteList(list) {
  if (!favoriteList) return;

  favoriteList.innerHTML = "";

  if (!list.length) {
    favoriteList.innerHTML = `
      <div style="padding:16px;color:#94a3b8;font-size:14px;">
        没有收藏内容
      </div>
    `;
    return;
  }

  list.forEach(function (item, index) {
    const card = document.createElement("div");
    card.className = `session-card ${item.id === currentFavoriteId ? "active" : ""}`;

    card.innerHTML = `
      <div class="session-avatar">⭐</div>
      <div class="session-info">
        <div class="session-line-top">
          <div class="session-name">${escapeHtml(item.title)}</div>
          <div class="session-time">${escapeHtml(item.time)}</div>
        </div>
        <div class="session-line-bottom">
          <div class="session-desc">${escapeHtml(item.type)} · ${escapeHtml(item.desc)}</div>
        </div>
      </div>
    `;

    card.addEventListener("click", function () {
      currentFavoriteId = item.id;
      renderFavoriteList(list);
      renderFavoriteDetail(item);
    });

    favoriteList.appendChild(card);

    if (index === 0 && currentFavoriteId === null) {
      currentFavoriteId = item.id;
      renderFavoriteDetail(item);
    }
  });
}

function renderFavoriteDetail(item) {
  if (!favoriteDetailArea) return;

  favoriteDetailArea.innerHTML = `
    <div class="friend-profile-card">
      <div class="friend-profile-section">
        <div class="friend-profile-label">收藏标题</div>
        <div class="friend-profile-value">${escapeHtml(item.title)}</div>
      </div>

      <div class="friend-profile-section">
        <div class="friend-profile-label">内容类型</div>
        <div class="friend-profile-value">${escapeHtml(item.type)}</div>
      </div>

      <div class="friend-profile-section">
        <div class="friend-profile-label">收藏时间</div>
        <div class="friend-profile-value">${escapeHtml(item.time)}</div>
      </div>

      <div class="friend-profile-section">
        <div class="friend-profile-label">内容说明</div>
        <div class="friend-profile-value">${escapeHtml(item.desc)}</div>
      </div>

      <div class="friend-profile-actions">
        <button class="friend-outline-btn" id="favoriteShareBtn" type="button">分享收藏</button>
        <button class="friend-primary-btn" id="favoriteChatBtn" type="button">去聊天</button>
      </div>
    </div>
  `;

  bindFavoriteDetailActions(item);
}

function bindFavoriteDetailActions(item) {
  const favoriteChatBtn = document.getElementById("favoriteChatBtn");

  if (favoriteChatBtn) {
    favoriteChatBtn.addEventListener("click", function () {
      jumpToChatPage({
        type: "favorite",
        name: item.chatTargetName,
        avatar: item.chatTargetAvatar || item.chatTargetName.slice(0, 1),
        welcomeText: item.welcomeText || `你好，我想继续讨论一下「${item.title}」。`
      });
    });
  }
}

function jumpToChatPage(target) {
  localStorage.setItem(CHAT_TARGET_STORAGE_KEY, JSON.stringify(target));
  window.location.href = "chat.html";
}

function renderFavoriteEmptyDetail(text) {
  if (!favoriteDetailArea) return;

  favoriteDetailArea.innerHTML = `
    <div style="color:#94a3b8;font-size:14px;">
      ${escapeHtml(text)}
    </div>
  `;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}