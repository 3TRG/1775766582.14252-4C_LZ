const settingsMenuList = document.getElementById("settingsMenuList");
const settingsTitle = document.getElementById("settingsTitle");
const settingsSubtitle = document.getElementById("settingsSubtitle");
const settingsDetailArea = document.getElementById("settingsDetailArea");

const SETTINGS_DATA = {
  account: {
    title: "账号设置",
    subtitle: "查看当前账号的基础资料与状态",
    name: "账号设置",
    content: function () {
      const user = getStoredUser ? getStoredUser() : null;
      const nickname = user?.nickname || "未设置";
      const phone = user?.phone || "未登录";
      const token = localStorage.getItem(STORAGE_KEYS?.TOKEN || "token");

      return `
        <strong>当前昵称：</strong>${escapeHtml(nickname)}<br /><br />
        <strong>当前手机号：</strong>${escapeHtml(phone)}<br /><br />
        <strong>登录状态：</strong>${token ? "已登录" : "未登录"}<br /><br />
        这里后续可以继续扩展为：修改头像、修改昵称、修改密码、绑定邮箱等功能。
      `;
    }
  },

  notice: {
    title: "消息通知",
    subtitle: "管理通知提醒和提示方式",
    name: "消息通知",
    content: function () {
      return `
        <strong>通知状态：</strong>默认开启<br /><br />
        <strong>声音提醒：</strong>默认开启<br /><br />
        <strong>免打扰模式：</strong>暂未开启<br /><br />
        后续你可以在这里继续增加：
        页面开关、声音开关、消息红点、桌面通知等交互。
      `;
    }
  },

  privacy: {
    title: "隐私设置",
    subtitle: "管理可见范围与安全选项",
    name: "隐私设置",
    content: function () {
      return `
        <strong>账号可见范围：</strong>仅联系人可见<br /><br />
        <strong>聊天记录保护：</strong>已启用本地存储隔离<br /><br />
        <strong>安全建议：</strong>定期更新密码并妥善保管账号信息<br /><br />
        后续你可以在这里继续增加：
        黑名单、权限管理、设备登录记录、二次验证等功能。
      `;
    }
  }
};

initSettingsPage();

function initSettingsPage() {
  renderSettingsDetail("account");
  bindSettingsMenuEvents();
}

function bindSettingsMenuEvents() {
  if (!settingsMenuList) return;

  const cards = settingsMenuList.querySelectorAll(".session-card");

  cards.forEach(function (card) {
    card.addEventListener("click", function () {
      const settingKey = card.dataset.settingKey;
      if (!settingKey || !SETTINGS_DATA[settingKey]) return;

      cards.forEach(function (item) {
        item.classList.remove("active");
      });

      card.classList.add("active");
      renderSettingsDetail(settingKey);
    });
  });
}

function renderSettingsDetail(settingKey) {
  const data = SETTINGS_DATA[settingKey];
  if (!data) return;

  if (settingsTitle) {
    settingsTitle.textContent = data.title;
  }

  if (settingsSubtitle) {
    settingsSubtitle.textContent = data.subtitle;
  }

  if (settingsDetailArea) {
    settingsDetailArea.innerHTML = `
      <div class="message-bubble-wrap" style="max-width:100%;">
        <div class="message-name">${escapeHtml(data.name)}</div>
        <div class="message-bubble">
          ${data.content()}
        </div>
      </div>
    `;
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}