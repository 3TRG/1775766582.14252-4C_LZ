const fileList = document.getElementById("fileList");
const fileSearchInput = document.getElementById("fileSearchInput");
const fileDetailArea = document.getElementById("fileDetailArea");

const CHAT_TARGET_STORAGE_KEY = "QKE_PENDING_CHAT_TARGET";

const filesData = [
  {
    id: 1,
    name: "原型图.fig",
    desc: "最新版本原型设计文件，包含登录页、聊天页和功能扩展页。",
    size: "12.4 MB",
    type: "设计文件",
    updateTime: "今天",
    chatTargetName: "前端开发组",
    chatTargetAvatar: "群",
    welcomeText: "大家好，我想同步一下最新的原型图文件。"
  },
  {
    id: 2,
    name: "开发说明.docx",
    desc: "记录当前开发规范、页面结构和交互说明。",
    size: "1.8 MB",
    type: "文档",
    updateTime: "昨天",
    chatTargetName: "张三",
    chatTargetAvatar: "张",
    welcomeText: "你好，我想继续确认一下开发说明文档。"
  },
  {
    id: 3,
    name: "测试报告.pdf",
    desc: "最近一次测试结果汇总，包含问题清单和修复建议。",
    size: "3.1 MB",
    type: "报告",
    updateTime: "周一",
    chatTargetName: "王五",
    chatTargetAvatar: "王",
    welcomeText: "你好，我想和你继续确认测试报告里的问题。"
  },
  {
    id: 4,
    name: "素材图片.zip",
    desc: "项目中用到的图标、插图和背景资源打包文件。",
    size: "25.7 MB",
    type: "压缩包",
    updateTime: "更早",
    chatTargetName: "文件助手",
    chatTargetAvatar: "文",
    welcomeText: "你好，我想处理一下素材图片压缩包。"
  }
];

let currentFileId = null;

initFilesPage();

function initFilesPage() {
  renderFileList(filesData);

  if (fileSearchInput) {
    fileSearchInput.addEventListener("input", function () {
      const keyword = this.value.trim().toLowerCase();

      const filteredList = filesData.filter(function (item) {
        return (
          item.name.toLowerCase().includes(keyword) ||
          item.desc.toLowerCase().includes(keyword) ||
          item.type.toLowerCase().includes(keyword)
        );
      });

      currentFileId = null;
      renderFileList(filteredList);

      if (!filteredList.length) {
        renderFileEmptyDetail("没有找到匹配的文件");
      }
    });
  }
}

function renderFileList(list) {
  if (!fileList) return;

  fileList.innerHTML = "";

  if (!list.length) {
    fileList.innerHTML = `
      <div style="padding:16px;color:#94a3b8;font-size:14px;">
        没有文件内容
      </div>
    `;
    return;
  }

  list.forEach(function (item, index) {
    const card = document.createElement("div");
    card.className = `session-card ${item.id === currentFileId ? "active" : ""}`;

    card.innerHTML = `
      <div class="session-avatar">📁</div>
      <div class="session-info">
        <div class="session-line-top">
          <div class="session-name">${escapeHtml(item.name)}</div>
          <div class="session-time">${escapeHtml(item.size)}</div>
        </div>
        <div class="session-line-bottom">
          <div class="session-desc">${escapeHtml(item.type)} · ${escapeHtml(item.desc)}</div>
        </div>
      </div>
    `;

    card.addEventListener("click", function () {
      currentFileId = item.id;
      renderFileList(list);
      renderFileDetail(item);
    });

    fileList.appendChild(card);

    if (index === 0 && currentFileId === null) {
      currentFileId = item.id;
      renderFileDetail(item);
    }
  });
}

function renderFileDetail(item) {
  if (!fileDetailArea) return;

  fileDetailArea.innerHTML = `
    <div class="friend-profile-card">
      <div class="friend-profile-section">
        <div class="friend-profile-label">文件名称</div>
        <div class="friend-profile-value">${escapeHtml(item.name)}</div>
      </div>

      <div class="friend-profile-section">
        <div class="friend-profile-label">文件类型</div>
        <div class="friend-profile-value">${escapeHtml(item.type)}</div>
      </div>

      <div class="friend-profile-section">
        <div class="friend-profile-label">文件大小</div>
        <div class="friend-profile-value">${escapeHtml(item.size)}</div>
      </div>

      <div class="friend-profile-section">
        <div class="friend-profile-label">更新时间</div>
        <div class="friend-profile-value">${escapeHtml(item.updateTime)}</div>
      </div>

      <div class="friend-profile-section">
        <div class="friend-profile-label">文件说明</div>
        <div class="friend-profile-value">${escapeHtml(item.desc)}</div>
      </div>

      <div class="friend-profile-actions">
        <button class="friend-outline-btn" id="fileShareBtn" type="button">分享文件</button>
        <button class="friend-primary-btn" id="fileChatBtn" type="button">去聊天</button>
      </div>
    </div>
  `;

  bindFileDetailActions(item);
}

function bindFileDetailActions(item) {
  const fileChatBtn = document.getElementById("fileChatBtn");

  if (fileChatBtn) {
    fileChatBtn.addEventListener("click", function () {
      jumpToChatPage({
        type: "file",
        name: item.chatTargetName,
        avatar: item.chatTargetAvatar || item.chatTargetName.slice(0, 1),
        welcomeText: item.welcomeText || `你好，我想继续讨论一下文件「${item.name}」。`
      });
    });
  }
}

function jumpToChatPage(target) {
  localStorage.setItem(CHAT_TARGET_STORAGE_KEY, JSON.stringify(target));
  window.location.href = "chat.html";
}

function renderFileEmptyDetail(text) {
  if (!fileDetailArea) return;

  fileDetailArea.innerHTML = `
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