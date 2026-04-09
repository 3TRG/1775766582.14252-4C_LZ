// 通讯录UI管理模块
const contactList = document.getElementById("contactList");
const contactSearchInput = document.getElementById("contactSearchInput");
const addContactInput = document.getElementById("addContactInput");
const addContactBtn = document.getElementById("addContactBtn");
const contactStatusMsg = document.getElementById("contactStatusMsg");
const contactDetailArea = document.getElementById("contactDetailArea");
const contactDetailTitle = document.getElementById("contactDetailTitle");
const contactDetailSubtitle = document.getElementById("contactDetailSubtitle");

// 过滤器按钮
const filterAll = document.getElementById("filterAll");
const filterFavorites = document.getElementById("filterFavorites");
const filterGroups = document.getElementById("filterGroups");
const filterTags = document.getElementById("filterTags");

let currentContactId = null;
let currentFilter = "all"; // all, favorites, groups, tags
let currentSearchKeyword = "";

// 初始化通讯录页面
async function initContactsPage() {
  const currentUser = getStoredUser();
  const token = localStorage.getItem(STORAGE_KEYS.TOKEN);

  if (!currentUser || !token) {
    window.location.href = APP_CONFIG.LOGOUT_REDIRECT;
    return;
  }

  bindContactEvents();
  renderContacts();

  setContactStatus("通讯录已加载完成", false);
}

// 绑定通讯录事件
function bindContactEvents() {
  // 搜索输入
  if (contactSearchInput) {
    contactSearchInput.addEventListener("input", function () {
      currentSearchKeyword = this.value.trim();
      renderContacts();
    });
  }

  // 添加联系人
  if (addContactBtn) {
    addContactBtn.addEventListener("click", handleAddContact);
  }

  if (addContactInput) {
    addContactInput.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        handleAddContact();
      }
    });
  }

  // 过滤器按钮
  if (filterAll) {
    filterAll.addEventListener("click", () => setFilter("all"));
  }
  if (filterFavorites) {
    filterFavorites.addEventListener("click", () => setFilter("favorites"));
  }
  if (filterGroups) {
    filterGroups.addEventListener("click", () => setFilter("groups"));
  }
  if (filterTags) {
    filterTags.addEventListener("click", () => setFilter("tags"));
  }
}

// 设置过滤器
function setFilter(filter) {
  currentFilter = filter;

  // 更新按钮状态
  [filterAll, filterFavorites, filterGroups, filterTags].forEach(btn => {
    btn.classList.remove("active");
  });

  switch (filter) {
    case "all":
      filterAll.classList.add("active");
      break;
    case "favorites":
      filterFavorites.classList.add("active");
      break;
    case "groups":
      filterGroups.classList.add("active");
      break;
    case "tags":
      filterTags.classList.add("active");
      break;
  }

  renderContacts();
}

// 添加联系人
async function handleAddContact() {
  const rawValue = String(addContactInput?.value || "").trim();

  if (!rawValue) {
    setContactStatus("请输入联系人信息", true);
    return;
  }

  try {
    addContactBtn.disabled = true;
    setContactStatus("正在添加联系人...", false);

    // 解析输入内容
    const contactInfo = parseContactInput(rawValue);

    // 创建联系人对象
    const newContact = new Contact(
      contactInfo.id,
      contactInfo.name,
      contactInfo.phone,
      contactInfo.email,
      contactInfo.avatar
    );

    // 添加到通讯录
    const contactId = contactManager.addContact(newContact);

    // 选中新联系人
    currentContactId = contactId;

    renderContacts();
    renderCurrentContactDetail();

    if (addContactInput) {
      addContactInput.value = "";
    }

    setContactStatus(`已成功添加联系人：${contactInfo.name}`, false);
  } catch (error) {
    console.error(error);
    setContactStatus(error.message || "添加联系人失败", true);
  } finally {
    addContactBtn.disabled = false;
  }
}

// 解析联系人输入
function parseContactInput(input) {
  // 尝试识别输入格式：姓名 手机号 邮箱
  const parts = input.split(/\s+/);

  if (parts.length >= 2) {
    const name = parts[0];
    const phone = parts[1];
    const email = parts[2] || "";
    const id = `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      id,
      name,
      phone,
      email,
      avatar: name.slice(0, 1)
    };
  } else {
    // 如果只有一个部分，假设是姓名或手机号
    const value = parts[0];
    const isPhone = /^\d{11}$/.test(value);
    const name = isPhone ? `联系人${value.slice(-4)}` : value;
    const phone = isPhone ? value : "";
    const id = `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      id,
      name,
      phone,
      email: "",
      avatar: name.slice(0, 1)
    };
  }
}

// 渲染联系人列表
function renderContacts() {
  if (!contactList) return;

  let contacts = [];

  // 根据过滤器获取联系人
  switch (currentFilter) {
    case "favorites":
      contacts = contactManager.getFavoriteContacts();
      break;
    case "groups":
      contacts = contactManager.getAllContacts(); // TODO: 实现分组过滤
      break;
    case "tags":
      contacts = contactManager.getAllContacts(); // TODO: 实现标签过滤
      break;
    default:
      contacts = contactManager.getAllContacts();
      break;
  }

  // 搜索过滤
  if (currentSearchKeyword) {
    contacts = contacts.filter(contact =>
      contact.name.toLowerCase().includes(currentSearchKeyword.toLowerCase()) ||
      contact.phone.includes(currentSearchKeyword) ||
      contact.email.toLowerCase().includes(currentSearchKeyword.toLowerCase()) ||
      contact.id.toLowerCase().includes(currentSearchKeyword.toLowerCase())
    );
  }

  // 按更新时间排序
  contacts.sort((a, b) => b.updatedAt - a.updatedAt);

  contactList.innerHTML = "";

  if (!contacts.length) {
    const filterName = getFilterDisplayName(currentFilter);
    contactList.innerHTML = `
      <div style="padding:16px;color:#94a3b8;font-size:14px;text-align:center;">
        ${currentSearchKeyword ? `未找到包含"${currentSearchKeyword}"的联系人` : `暂无${filterName}联系人`}
      </div>
    `;
    return;
  }

  contacts.forEach(contact => {
    const card = document.createElement("div");
    card.className = `session-card ${contact.id === currentContactId ? "active" : ""}`;

    // 获取分组信息
    const groupInfo = contact.groupId ? contactManager.getGroup(contact.groupId) : null;

    card.innerHTML = `
      <div class="session-avatar">${escapeHtml(contact.avatar)}</div>
      <div class="session-info">
        <div class="session-line-top">
          <span class="session-name">${escapeHtml(contact.name)}</span>
          ${contact.isFavorite ? '<span class="favorite-star">⭐</span>' : ''}
          <span class="session-status">${getStatusDisplay(contact.status)}</span>
        </div>
        <div class="session-desc">${escapeHtml(contact.phone || contact.email || contact.id)}</div>
        ${groupInfo ? `<div class="contact-group-info">${escapeHtml(groupInfo.name)}</div>` : ''}
      </div>
    `;

    card.addEventListener("click", function () {
      currentContactId = contact.id;
      renderContacts();
      renderCurrentContactDetail();
    });

    contactList.appendChild(card);
  });
}

// 获取过滤器显示名称
function getFilterDisplayName(filter) {
  switch (filter) {
    case "favorites":
      return "收藏夹";
    case "groups":
      return "分组";
    case "tags":
      return "标签";
    default:
      return "";
  }
}

// 获取状态显示
function getStatusDisplay(status) {
  switch (status) {
    case "online":
      return "在线";
    case "busy":
      return "忙碌";
    case "away":
      return "离开";
    default:
      return "离线";
  }
}

// 渲染当前联系人详情
function renderCurrentContactDetail() {
  if (!contactDetailArea) return;

  const currentContact = contactManager.getContact(currentContactId);

  if (!currentContact) {
    contactDetailTitle.textContent = "联系人详情";
    contactDetailSubtitle.textContent = "请选择左侧联系人查看详情";
    contactDetailArea.innerHTML = `
      <div style="color:#94a3b8;font-size:14px;">请选择左侧联系人查看详情</div>
    `;
    return;
  }

  contactDetailTitle.textContent = currentContact.name;
  contactDetailSubtitle.textContent = currentContact.isFavorite ? "⭐ 收藏联系人" : "普通联系人";

  // 获取分组信息
  const groupInfo = currentContact.groupId ? contactManager.getGroup(currentContact.groupId) : null;

  contactDetailArea.innerHTML = `
    <div class="contact-detail-card">
      <div class="contact-detail-row">
        <div class="contact-detail-label">姓名</div>
        <div class="contact-detail-value">${escapeHtml(currentContact.name)}</div>
      </div>

      <div class="contact-detail-row">
        <div class="contact-detail-label">手机号</div>
        <div class="contact-detail-value">${escapeHtml(currentContact.phone || "未设置")}</div>
      </div>

      <div class="contact-detail-row">
        <div class="contact-detail-label">邮箱</div>
        <div class="contact-detail-value">${escapeHtml(currentContact.email || "未设置")}</div>
      </div>

      <div class="contact-detail-row">
        <div class="contact-detail-label">状态</div>
        <div class="contact-detail-value">${getStatusDisplay(currentContact.status)}</div>
      </div>

      ${groupInfo ? `
      <div class="contact-detail-row">
        <div class="contact-detail-label">分组</div>
        <div class="contact-detail-value">
          <span class="contact-group-badge">${escapeHtml(groupInfo.name)}</span>
        </div>
      </div>
      ` : ''}

      ${currentContact.tags.length > 0 ? `
      <div class="contact-detail-row">
        <div class="contact-detail-label">标签</div>
        <div class="contact-detail-value">
          ${currentContact.tags.map(tag => `<span class="contact-tag">${escapeHtml(tag)}</span>`).join('')}
        </div>
      </div>
      ` : ''}

      <div class="contact-action-row">
        <button class="contact-action-btn secondary" id="editContactBtn" type="button">编辑信息</button>
        <button class="contact-action-btn primary" id="startChatBtn" type="button">发起聊天</button>
      </div>
    </div>
  `;

  const editContactBtn = document.getElementById("editContactBtn");
  const startChatBtn = document.getElementById("startChatBtn");

  if (editContactBtn) {
    editContactBtn.addEventListener("click", function () {
      // TODO: 实现编辑联系人功能
      setContactStatus("编辑功能开发中...", false);
    });
  }

  if (startChatBtn) {
    startChatBtn.addEventListener("click", function () {
      // 跳转到聊天页面，并传递联系人信息
      localStorage.setItem("QKE_PENDING_CHAT_TARGET", JSON.stringify({
        type: "contact",
        contactId: currentContact.id,
        name: currentContact.name,
        avatar: currentContact.avatar
      }));

      window.location.href = "chat.html";
    });
  }
}

// 设置联系人状态消息
function setContactStatus(message, isError) {
  if (!contactStatusMsg) return;
  contactStatusMsg.textContent = message;
  contactStatusMsg.style.color = isError ? "#f87171" : "#94a3b8";
}

// 导出函数供其他模块使用
window.initContactsPage = initContactsPage;
window.renderContacts = renderContacts;
window.renderCurrentContactDetail = renderCurrentContactDetail;