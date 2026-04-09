// 群聊管理模块
const groupList = document.getElementById("groupList");
const groupSearchInput = document.getElementById("groupSearchInput");
const createGroupInput = document.getElementById("createGroupInput");
const createGroupBtn = document.getElementById("createGroupBtn");
const createGroupConfirmBtn = document.getElementById("createGroupConfirmBtn");
const groupStatusMsg = document.getElementById("groupStatusMsg");
const groupDetailArea = document.getElementById("groupDetailArea");
const groupDetailTitle = document.getElementById("groupDetailTitle");
const groupDetailSubtitle = document.getElementById("groupDetailSubtitle");

let currentGroupId = null;
let groupsData = [];
let currentSearchKeyword = "";

// 群聊数据模型
class GroupChat {
  constructor(id, name, description = "", creatorId, members = [], avatar = null) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.creatorId = creatorId;
    this.members = [...members]; // 成员ID列表
    this.admins = [creatorId]; // 管理员ID列表（创建者默认是管理员）
    this.createdAt = Date.now();
    this.updatedAt = Date.now();
    this.avatar = avatar || name.slice(0, 1);
    this.lastMessage = null;
    this.lastMessageTime = null;
    this.messageCount = 0;
    this.settings = {
      isPublic: false,
      requireApproval: false,
      maxMembers: 200,
      allowInvites: true
    };
    this.announcements = []; // 群公告
  }

  // 转换为Plain Object
  toObject() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      creatorId: this.creatorId,
      members: [...this.members],
      admins: [...this.admins],
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      avatar: this.avatar,
      lastMessage: this.lastMessage,
      lastMessageTime: this.lastMessageTime,
      messageCount: this.messageCount,
      settings: { ...this.settings },
      announcements: [...this.announcements]
    };
  }

  // 从Plain Object创建实例
  static fromObject(obj) {
    const group = new GroupChat(
      obj.id,
      obj.name,
      obj.description,
      obj.creatorId,
      obj.members || [],
      obj.avatar
    );
    group.admins = obj.admins || [obj.creatorId];
    group.createdAt = obj.createdAt || Date.now();
    group.updatedAt = obj.updatedAt || Date.now();
    group.lastMessage = obj.lastMessage || null;
    group.lastMessageTime = obj.lastMessageTime || null;
    group.messageCount = obj.messageCount || 0;
    group.settings = obj.settings || {
      isPublic: false,
      requireApproval: false,
      maxMembers: 200,
      allowInvites: true
    };
    group.announcements = obj.announcements || [];
    return group;
  }

  // 添加成员
  addMember(userId) {
    if (!this.members.includes(userId) && this.members.length < this.settings.maxMembers) {
      this.members.push(userId);
      this.updatedAt = Date.now();
      return true;
    }
    return false;
  }

  // 移除成员
  removeMember(userId) {
    const index = this.members.indexOf(userId);
    if (index > -1) {
      this.members.splice(index, 1);
      // 如果是管理员，也从管理员列表中移除
      const adminIndex = this.admins.indexOf(userId);
      if (adminIndex > -1) {
        this.admins.splice(adminIndex, 1);
      }
      this.updatedAt = Date.now();
      return true;
    }
    return false;
  }

  // 添加管理员
  addAdmin(userId) {
    if (this.members.includes(userId) && !this.admins.includes(userId)) {
      this.admins.push(userId);
      this.updatedAt = Date.now();
      return true;
    }
    return false;
  }

  // 移除管理员
  removeAdmin(userId) {
    if (this.admins.includes(userId) && this.admins.length > 1) { // 至少保留一个管理员
      const index = this.admins.indexOf(userId);
      if (index > -1) {
        this.admins.splice(index, 1);
        this.updatedAt = Date.now();
        return true;
      }
    }
    return false;
  }

  // 检查是否是成员
  isMember(userId) {
    return this.members.includes(userId);
  }

  // 检查是否是管理员
  isAdmin(userId) {
    return this.admins.includes(userId);
  }

  // 检查是否是创建者
  isCreator(userId) {
    return this.creatorId === userId;
  }

  // 获取成员数量
  getMemberCount() {
    return this.members.length;
  }

  // 更新最后消息
  updateLastMessage(message, timestamp) {
    this.lastMessage = message;
    this.lastMessageTime = timestamp || Date.now();
    this.messageCount++;
    this.updatedAt = Date.now();
  }
}

// 群聊管理器
class GroupManager {
  constructor() {
    this.groups = new Map(); // id -> GroupChat
    this._loadFromStorage();
  }

  // 从localStorage加载数据
  _loadFromStorage() {
    try {
      const groupsJson = localStorage.getItem("qke_groups");
      if (groupsJson) {
        const groupsArray = JSON.parse(groupsJson);
        groupsArray.forEach(groupObj => {
          const group = GroupChat.fromObject(groupObj);
          this.groups.set(group.id, group);
        });
      }
    } catch (error) {
      console.error("[GroupManager] 加载群聊数据失败:", error);
    }
  }

  // 保存数据到localStorage
  _saveToStorage() {
    try {
      const groupsArray = Array.from(this.groups.values()).map(group => group.toObject());
      localStorage.setItem("qke_groups", JSON.stringify(groupsArray));
    } catch (error) {
      console.error("[GroupManager] 保存群聊数据失败:", error);
    }
  }

  // 创建群聊
  createGroup(name, description = "", creatorId) {
    const id = `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const group = new GroupChat(id, name, description, creatorId, [creatorId]);
    this.groups.set(id, group);
    this._saveToStorage();
    return group;
  }

  // 删除群聊
  deleteGroup(groupId, userId) {
    const group = this.groups.get(groupId);
    if (!group || group.creatorId !== userId) {
      return false; // 只有创建者可以删除群聊
    }
    this.groups.delete(groupId);
    this._saveToStorage();
    return true;
  }

  // 获取群聊
  getGroup(groupId) {
    return this.groups.get(groupId);
  }

  // 获取所有群聊
  getAllGroups() {
    return Array.from(this.groups.values());
  }

  // 搜索群聊
  searchGroups(query) {
    if (!query) return this.getAllGroups();

    const lowerQuery = query.toLowerCase();
    return this.getAllGroups().filter(group =>
      group.name.toLowerCase().includes(lowerQuery) ||
      group.description.toLowerCase().includes(lowerQuery)
    );
  }

  // 添加成员
  addMember(groupId, userId, adderId) {
    const group = this.groups.get(groupId);
    if (!group) return false;

    // 检查权限：管理员可以添加成员
    if (!group.isAdmin(adderId)) {
      return false;
    }

    if (group.addMember(userId)) {
      this._saveToStorage();
      return true;
    }
    return false;
  }

  // 移除成员
  removeMember(groupId, userId, removerId) {
    const group = this.groups.get(groupId);
    if (!group) return false;

    // 管理员可以移除普通成员，创建者可以移除管理员，成员可以退出自己
    if (!group.isAdmin(removerId) && removerId !== userId) {
      return false;
    }

    if (removerId !== userId && !group.isCreator(removerId) && group.isAdmin(userId)) {
      return false; // 非创建者不能移除管理员
    }

    if (group.removeMember(userId)) {
      this._saveToStorage();
      return true;
    }
    return false;
  }

  // 添加管理员
  addAdmin(groupId, userId, adderId) {
    const group = this.groups.get(groupId);
    if (!group || group.creatorId !== adderId) {
      return false; // 只有创建者可以添加管理员
    }

    if (group.addAdmin(userId)) {
      this._saveToStorage();
      return true;
    }
    return false;
  }

  // 移除管理员
  removeAdmin(groupId, userId, removerId) {
    const group = this.groups.get(groupId);
    if (!group || group.creatorId !== removerId) {
      return false; // 只有创建者可以移除管理员
    }

    if (group.removeAdmin(userId)) {
      this._saveToStorage();
      return true;
    }
    return false;
  }
}

// 创建全局群聊管理器实例
const groupManager = new GroupManager();

// 初始化群聊页面
async function initGroupsPage() {
  const currentUser = getStoredUser();
  const token = localStorage.getItem(STORAGE_KEYS.TOKEN);

  if (!currentUser || !token) {
    window.location.href = APP_CONFIG.LOGOUT_REDIRECT;
    return;
  }

  bindGroupEvents();
  renderGroups();

  setGroupStatus("群聊管理已加载完成", false);
}

// 绑定群聊事件
function bindGroupEvents() {
  // 搜索输入
  if (groupSearchInput) {
    groupSearchInput.addEventListener("input", function () {
      currentSearchKeyword = this.value.trim();
      renderGroups();
    });
  }

  // 创建群聊
  if (createGroupBtn) {
    createGroupBtn.addEventListener("click", function() {
      // 切换输入框显示
      const inputRow = document.querySelector('.group-create-row');
      if (inputRow) {
        inputRow.style.display = inputRow.style.display === 'none' ? 'flex' : 'none';
        if (inputRow.style.display === 'flex') {
          createGroupInput.focus();
        }
      }
    });
  }

  if (createGroupConfirmBtn) {
    createGroupConfirmBtn.addEventListener("click", handleCreateGroup);
  }

  if (createGroupInput) {
    createGroupInput.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        handleCreateGroup();
      }
    });
  }
}

// 创建群聊
async function handleCreateGroup() {
  const groupName = String(createGroupInput?.value || "").trim();

  if (!groupName) {
    setGroupStatus("请输入群聊名称", true);
    return;
  }

  if (groupName.length < 2 || groupName.length > 20) {
    setGroupStatus("群聊名称长度应在2-20个字符之间", true);
    return;
  }

  const currentUser = getStoredUser();
  if (!currentUser) {
    setGroupStatus("用户未登录", true);
    return;
  }

  try {
    createGroupConfirmBtn.disabled = true;
    setGroupStatus("正在创建群聊...", false);

    // 创建群聊
    const newGroup = groupManager.createGroup(
      groupName,
      "",
      currentUser.userId
    );

    // 选中新群聊
    currentGroupId = newGroup.id;

    renderGroups();
    renderCurrentGroupDetail();

    if (createGroupInput) {
      createGroupInput.value = "";
      // 隐藏输入框
      const inputRow = document.querySelector('.group-create-row');
      if (inputRow) {
        inputRow.style.display = 'none';
      }
    }

    setGroupStatus(`已成功创建群聊：${groupName}`, false);
  } catch (error) {
    console.error(error);
    setGroupStatus(error.message || "创建群聊失败", true);
  } finally {
    createGroupConfirmBtn.disabled = false;
  }
}

// 渲染群聊列表
function renderGroups() {
  if (!groupList) return;

  let groups = groupManager.getAllGroups();

  // 搜索过滤
  if (currentSearchKeyword) {
    groups = groups.filter(group =>
      group.name.toLowerCase().includes(currentSearchKeyword.toLowerCase()) ||
      group.description.toLowerCase().includes(currentSearchKeyword.toLowerCase())
    );
  }

  // 按更新时间排序（最近活跃的在前）
  groups.sort((a, b) => b.updatedAt - a.updatedAt);

  groupList.innerHTML = "";

  if (!groups.length) {
    groupList.innerHTML = `
      <div style="padding:16px;color:#94a3b8;font-size:14px;text-align:center;">
        ${currentSearchKeyword ? `未找到包含"${currentSearchKeyword}"的群聊` : `暂无群聊，点击"+"创建群聊`}
      </div>
    `;
    return;
  }

  groups.forEach(group => {
    const card = document.createElement("div");
    card.className = `session-card ${group.id === currentGroupId ? "active" : ""}`;

    const lastMessageTime = group.lastMessageTime ? new Date(group.lastMessageTime).toLocaleTimeString() : "";
    const lastMessageText = group.lastMessage ? group.lastMessage.slice(0, 20) + "..." : "暂无消息";

    card.innerHTML = `
      <div class="session-avatar">${escapeHtml(group.avatar)}</div>
      <div class="session-info">
        <div class="session-line-top">
          <span class="session-name">${escapeHtml(group.name)}</span>
          <span class="session-time">${lastMessageTime}</span>
        </div>
        <div class="session-desc">${lastMessageText}</div>
        <div class="session-desc">${group.getMemberCount()}人</div>
      </div>
    `;

    card.addEventListener("click", function () {
      currentGroupId = group.id;
      renderGroups();
      renderCurrentGroupDetail();
    });

    groupList.appendChild(card);
  });
}

// 渲染当前群聊详情
function renderCurrentGroupDetail() {
  if (!groupDetailArea) return;

  const currentGroup = groupManager.getGroup(currentGroupId);

  if (!currentGroup) {
    groupDetailTitle.textContent = "群聊详情";
    groupDetailSubtitle.textContent = "请选择左侧群聊查看详情";
    groupDetailArea.innerHTML = `
      <div style="color:#94a3b8;font-size:14px;">请选择左侧群聊查看详情</div>
    `;
    return;
  }

  const currentUser = getStoredUser();
  const isCreator = currentGroup.isCreator(currentUser?.userId);
  const isAdmin = currentGroup.isAdmin(currentUser?.userId);
  const memberCount = currentGroup.getMemberCount();

  groupDetailTitle.textContent = currentGroup.name;
  groupDetailSubtitle.textContent = `${memberCount}人 · ${isCreator ? '群主' : (isAdmin ? '管理员' : '成员')}`;

  // 模拟获取成员信息（实际应用中应该从服务器获取）
  const mockMembers = currentGroup.members.map(memberId => ({
    id: memberId,
    name: `用户${memberId.slice(-4)}`,
    role: currentGroup.creatorId === memberId ? '群主' : (currentGroup.admins.includes(memberId) ? '管理员' : '成员'),
    avatar: memberId.slice(-1),
    status: 'offline' // 在实际应用中需要实时状态
  }));

  const creationTime = new Date(currentGroup.createdAt).toLocaleString();

  groupDetailArea.innerHTML = `
    <div class="group-detail-card">
      <div class="group-stats">
        <div class="stat-item">
          <div class="stat-value">${memberCount}</div>
          <div class="stat-label">成员人数</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${currentGroup.settings.maxMembers}</div>
          <div class="stat-label">最大容量</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${currentGroup.messageCount}</div>
          <div class="stat-label">消息总数</div>
        </div>
      </div>

      <div class="group-detail-row">
        <div class="group-detail-label">群聊名称</div>
        <div class="group-detail-value">${escapeHtml(currentGroup.name)}</div>
      </div>

      <div class="group-detail-row">
        <div class="group-detail-label">群聊描述</div>
        <div class="group-detail-value">${escapeHtml(currentGroup.description || "暂无描述")}</div>
      </div>

      <div class="group-detail-row">
        <div class="group-detail-label">创建时间</div>
        <div class="group-detail-value">${creationTime}</div>
      </div>

      <div class="group-detail-row">
        <div class="group-detail-label">成员列表</div>
        <div class="group-detail-value">
          <div class="group-members">
            ${mockMembers.map(member => `
              <div class="group-member-item">
                <div class="member-avatar">${escapeHtml(member.avatar)}</div>
                <div class="member-info">
                  <div class="member-name">${escapeHtml(member.name)}</div>
                  <div class="member-role">${member.role}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      ${currentGroup.announcements.length > 0 ? `
      <div class="group-detail-row">
        <div class="group-detail-label">群公告</div>
        <div class="group-detail-value">
          <div class="group-announcements">
            ${currentGroup.announcements.map((announcement, index) => `
              <div class="announcement-item">
                <div class="announcement-content">${escapeHtml(announcement.content)}</div>
                <div class="announcement-time">${new Date(announcement.time).toLocaleString()}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
      ` : ''}

      <div class="group-action-row">
        <button class="group-action-btn secondary" id="editGroupBtn" type="button">编辑群聊</button>
        <button class="group-action-btn primary" id="startGroupChatBtn" type="button">进入群聊</button>
      </div>
    </div>
  `;

  const editGroupBtn = document.getElementById("editGroupBtn");
  const startGroupChatBtn = document.getElementById("startGroupChatBtn");

  if (editGroupBtn) {
    editGroupBtn.addEventListener("click", function () {
      // TODO: 实现编辑群聊功能
      setGroupStatus("编辑功能开发中...", false);
    });
  }

  if (startGroupChatBtn) {
    startGroupChatBtn.addEventListener("click", function () {
      // 跳转到群聊页面
      localStorage.setItem("QKE_PENDING_CHAT_TARGET", JSON.stringify({
        type: "group",
        groupId: currentGroup.id,
        name: currentGroup.name,
        avatar: currentGroup.avatar
      }));

      window.location.href = "chat.html";
    });
  }
}

// 设置群聊状态消息
function setGroupStatus(message, isError) {
  if (!groupStatusMsg) return;
  groupStatusMsg.textContent = message;
  groupStatusMsg.style.color = isError ? "#f87171" : "#94a3b8";
}

// 导出函数供其他模块使用
window.initGroupsPage = initGroupsPage;
window.renderGroups = renderGroups;
window.renderCurrentGroupDetail = renderCurrentGroupDetail;