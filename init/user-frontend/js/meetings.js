// 会议管理模块
const meetingList = document.getElementById("meetingList");
const meetingSearchInput = document.getElementById("meetingSearchInput");
const createMeetingInput = document.getElementById("createMeetingInput");
const createMeetingBtn = document.getElementById("createMeetingBtn");
const createMeetingConfirmBtn = document.getElementById("createMeetingConfirmBtn");
const meetingStatusMsg = document.getElementById("meetingStatusMsg");
const meetingDetailArea = document.getElementById("meetingDetailArea");
const meetingDetailTitle = document.getElementById("meetingDetailTitle");
const meetingDetailSubtitle = document.getElementById("meetingDetailSubtitle");

// 过滤器按钮
const filterAllMeetings = document.getElementById("filterAllMeetings");
const filterUpcoming = document.getElementById("filterUpcoming");
const filterOngoing = document.getElementById("filterOngoing");
const filterCompleted = document.getElementById("filterCompleted");

let currentMeetingId = null;
let meetingsData = [];
let currentFilter = "all"; // all, upcoming, ongoing, completed
let currentSearchKeyword = "";

// 会议数据模型
class Meeting {
  constructor(id, title, description = "", organizerId, participants = [], scheduledStart, scheduledEnd = null, maxParticipants = 50) {
    this.id = id;
    this.title = title;
    this.description = description;
    this.organizerId = organizerId;
    this.participants = [...participants]; // 参与者ID列表
    this.scheduledStart = scheduledStart; // 预定开始时间
    this.scheduledEnd = scheduledEnd; // 预定结束时间
    this.actualStart = null; // 实际开始时间
    this.actualEnd = null; // 实际结束时间
    this.status = "scheduled"; // scheduled, ongoing, completed, cancelled
    this.createdAt = Date.now();
    this.updatedAt = Date.now();
    this.maxParticipants = maxParticipants;
    this.settings = {
      allowLateJoin: true,
      recordMeeting: false,
      requirePassword: false,
      password: null,
      waitingRoom: false
    };
    this.agenda = []; // 会议议程
    this.resources = []; // 会议资源（文件、链接等）
  }

  // 转换为Plain Object
  toObject() {
    return {
      id: this.id,
      title: this.title,
      description: this.description,
      organizerId: this.organizerId,
      participants: [...this.participants],
      scheduledStart: this.scheduledStart,
      scheduledEnd: this.scheduledEnd,
      actualStart: this.actualStart,
      actualEnd: this.actualEnd,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      maxParticipants: this.maxParticipants,
      settings: { ...this.settings },
      agenda: [...this.agenda],
      resources: [...this.resources]
    };
  }

  // 从Plain Object创建实例
  static fromObject(obj) {
    const meeting = new Meeting(
      obj.id,
      obj.title,
      obj.description,
      obj.organizerId,
      obj.participants || [],
      obj.scheduledStart,
      obj.scheduledEnd,
      obj.maxParticipants || 50
    );
    meeting.actualStart = obj.actualStart || null;
    meeting.actualEnd = obj.actualEnd || null;
    meeting.status = obj.status || "scheduled";
    meeting.createdAt = obj.createdAt || Date.now();
    meeting.updatedAt = obj.updatedAt || Date.now();
    meeting.settings = obj.settings || {
      allowLateJoin: true,
      recordMeeting: false,
      requirePassword: false,
      password: null,
      waitingRoom: false
    };
    meeting.agenda = obj.agenda || [];
    meeting.resources = obj.resources || [];
    return meeting;
  }

  // 开始会议
  startMeeting() {
    if (this.status === "scheduled") {
      this.actualStart = Date.now();
      this.status = "ongoing";
      this.updatedAt = Date.now();
      return true;
    }
    return false;
  }

  // 结束会议
  endMeeting() {
    if (this.status === "ongoing") {
      this.actualEnd = Date.now();
      this.status = "completed";
      this.updatedAt = Date.now();
      return true;
    }
    return false;
  }

  // 取消会议
  cancelMeeting() {
    if (this.status === "scheduled") {
      this.status = "cancelled";
      this.updatedAt = Date.now();
      return true;
    }
    return false;
  }

  // 添加参与者
  addParticipant(userId) {
    if (!this.participants.includes(userId) && this.participants.length < this.maxParticipants) {
      this.participants.push(userId);
      this.updatedAt = Date.now();
      return true;
    }
    return false;
  }

  // 移除参与者
  removeParticipant(userId) {
    const index = this.participants.indexOf(userId);
    if (index > -1) {
      this.participants.splice(index, 1);
      this.updatedAt = Date.now();
      return true;
    }
    return false;
  }

  // 检查是否是组织者
  isOrganizer(userId) {
    return this.organizerId === userId;
  }

  // 检查是否是参与者
  isParticipant(userId) {
    return this.participants.includes(userId);
  }

  // 获取参与者数量
  getParticipantCount() {
    return this.participants.length;
  }

  // 获取会议状态显示文本
  getStatusText() {
    switch (this.status) {
      case "scheduled": return "已预约";
      case "ongoing": return "进行中";
      case "completed": return "已结束";
      case "cancelled": return "已取消";
      default: return "未知状态";
    }
  }

  // 获取会议状态CSS类名
  getStatusClass() {
    switch (this.status) {
      case "scheduled": return "status-scheduled";
      case "ongoing": return "status-ongoing";
      case "completed": return "status-completed";
      case "cancelled": return "status-cancelled";
      default: return "";
    }
  }

  // 检查会议是否即将开始（未来1小时内）
  isUpcoming() {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    return this.status === "scheduled" && this.scheduledStart - now <= oneHour && this.scheduledStart > now;
  }

  // 检查会议是否过期
  isExpired() {
    const now = Date.now();
    return this.status === "scheduled" && this.scheduledStart < now;
  }
}

// 会议管理器
class MeetingManager {
  constructor() {
    this.meetings = new Map(); // id -> Meeting
    this._loadFromStorage();
  }

  // 从localStorage加载数据
  _loadFromStorage() {
    try {
      const meetingsJson = localStorage.getItem("qke_meetings");
      if (meetingsJson) {
        const meetingsArray = JSON.parse(meetingsJson);
        meetingsArray.forEach(meetingObj => {
          const meeting = Meeting.fromObject(meetingObj);
          this.meetings.set(meeting.id, meeting);
        });
      }
    } catch (error) {
      console.error("[MeetingManager] 加载会议数据失败:", error);
    }
  }

  // 保存数据到localStorage
  _saveToStorage() {
    try {
      const meetingsArray = Array.from(this.meetings.values()).map(meeting => meeting.toObject());
      localStorage.setItem("qke_meetings", JSON.stringify(meetingsArray));
    } catch (error) {
      console.error("[MeetingManager] 保存会议数据失败:", error);
    }
  }

  // 创建会议
  createMeeting(title, description = "", organizerId, scheduledStart, scheduledEnd = null) {
    const id = `meeting_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const meeting = new Meeting(id, title, description, organizerId, [organizerId], scheduledStart, scheduledEnd);
    this.meetings.set(id, meeting);
    this._saveToStorage();
    return meeting;
  }

  // 删除会议
  deleteMeeting(meetingId, userId) {
    const meeting = this.meetings.get(meetingId);
    if (!meeting || meeting.organizerId !== userId) {
      return false; // 只有组织者可以删除会议
    }
    this.meetings.delete(meetingId);
    this._saveToStorage();
    return true;
  }

  // 获取会议
  getMeeting(meetingId) {
    return this.meetings.get(meetingId);
  }

  // 获取所有会议
  getAllMeetings() {
    return Array.from(this.meetings.values());
  }

  // 根据状态过滤会议
  getMeetingsByStatus(status) {
    return this.getAllMeetings().filter(meeting => meeting.status === status);
  }

  // 获取即将开始的会议
  getUpcomingMeetings() {
    return this.getAllMeetings().filter(meeting => meeting.isUpcoming());
  }

  // 获取进行中的会议
  getOngoingMeetings() {
    return this.getAllMeetings().filter(meeting => meeting.status === "ongoing");
  }

  // 搜索会议
  searchMeetings(query) {
    if (!query) return this.getAllMeetings();

    const lowerQuery = query.toLowerCase();
    return this.getAllMeetings().filter(meeting =>
      meeting.title.toLowerCase().includes(lowerQuery) ||
      meeting.description.toLowerCase().includes(lowerQuery)
    );
  }

  // 开始会议
  startMeeting(meetingId, userId) {
    const meeting = this.meetings.get(meetingId);
    if (!meeting || meeting.organizerId !== userId) {
      return false; // 只有组织者可以开始会议
    }

    if (meeting.startMeeting()) {
      this._saveToStorage();
      return true;
    }
    return false;
  }

  // 结束会议
  endMeeting(meetingId, userId) {
    const meeting = this.meetings.get(meetingId);
    if (!meeting || meeting.organizerId !== userId) {
      return false; // 只有组织者可以结束会议
    }

    if (meeting.endMeeting()) {
      this._saveToStorage();
      return true;
    }
    return false;
  }

  // 添加参与者
  addParticipant(meetingId, userId, adderId) {
    const meeting = this.meetings.get(meetingId);
    if (!meeting) return false;

    // 检查权限：组织者可以添加任何人
    if (meeting.organizerId !== adderId) {
      return false;
    }

    if (meeting.addParticipant(userId)) {
      this._saveToStorage();
      return true;
    }
    return false;
  }

  // 移除参与者
  removeParticipant(meetingId, userId, removerId) {
    const meeting = this.meetings.get(meetingId);
    if (!meeting) return false;

    // 组织者可以移除任何人，参与者只能退出自己
    if (meeting.organizerId !== removerId && removerId !== userId) {
      return false;
    }

    if (meeting.removeParticipant(userId)) {
      this._saveToStorage();
      return true;
    }
    return false;
  }
}

// 创建全局会议管理器实例
const meetingManager = new MeetingManager();

// 初始化会议页面
async function initMeetingsPage() {
  const currentUser = getStoredUser();
  const token = localStorage.getItem(STORAGE_KEYS.TOKEN);

  if (!currentUser || !token) {
    window.location.href = APP_CONFIG.LOGOUT_REDIRECT;
    return;
  }

  bindMeetingEvents();
  renderMeetings();

  setMeetingStatus("会议管理已加载完成", false);
}

// 绑定会议事件
function bindMeetingEvents() {
  // 搜索输入
  if (meetingSearchInput) {
    meetingSearchInput.addEventListener("input", function () {
      currentSearchKeyword = this.value.trim();
      renderMeetings();
    });
  }

  // 创建会议
  if (createMeetingBtn) {
    createMeetingBtn.addEventListener("click", function() {
      // 切换输入框显示
      const inputRow = document.querySelector('.meeting-create-row');
      if (inputRow) {
        inputRow.style.display = inputRow.style.display === 'none' ? 'flex' : 'none';
        if (inputRow.style.display === 'flex') {
          createMeetingInput.focus();
        }
      }
    });
  }

  if (createMeetingConfirmBtn) {
    createMeetingConfirmBtn.addEventListener("click", handleCreateMeeting);
  }

  if (createMeetingInput) {
    createMeetingInput.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        handleCreateMeeting();
      }
    });
  }

  // 过滤器按钮
  if (filterAllMeetings) {
    filterAllMeetings.addEventListener("click", () => setMeetingFilter("all"));
  }
  if (filterUpcoming) {
    filterUpcoming.addEventListener("click", () => setMeetingFilter("upcoming"));
  }
  if (filterOngoing) {
    filterOngoing.addEventListener("click", () => setMeetingFilter("ongoing"));
  }
  if (filterCompleted) {
    filterCompleted.addEventListener("click", () => setMeetingFilter("completed"));
  }
}

// 设置会议过滤器
function setMeetingFilter(filter) {
  currentFilter = filter;

  // 更新按钮状态
  [filterAllMeetings, filterUpcoming, filterOngoing, filterCompleted].forEach(btn => {
    btn.classList.remove("active");
  });

  switch (filter) {
    case "all":
      filterAllMeetings.classList.add("active");
      break;
    case "upcoming":
      filterUpcoming.classList.add("active");
      break;
    case "ongoing":
      filterOngoing.classList.add("active");
      break;
    case "completed":
      filterCompleted.classList.add("active");
      break;
  }

  renderMeetings();
}

// 创建会议
async function handleCreateMeeting() {
  const meetingTitle = String(createMeetingInput?.value || "").trim();

  if (!meetingTitle) {
    setMeetingStatus("请输入会议主题", true);
    return;
  }

  if (meetingTitle.length < 2 || meetingTitle.length > 50) {
    setMeetingStatus("会议主题长度应在2-50个字符之间", true);
    return;
  }

  const currentUser = getStoredUser();
  if (!currentUser) {
    setMeetingStatus("用户未登录", true);
    return;
  }

  // 设置默认会议时间（当前时间+1小时，持续1小时）
  const scheduledStart = Date.now() + 60 * 60 * 1000; // 1小时后开始
  const scheduledEnd = scheduledStart + 60 * 60 * 1000; // 持续1小时

  try {
    createMeetingConfirmBtn.disabled = true;
    setMeetingStatus("正在创建会议...", false);

    // 创建会议
    const newMeeting = meetingManager.createMeeting(
      meetingTitle,
      "",
      currentUser.userId,
      scheduledStart,
      scheduledEnd
    );

    // 选中新会议
    currentMeetingId = newMeeting.id;

    renderMeetings();
    renderCurrentMeetingDetail();

    if (createMeetingInput) {
      createMeetingInput.value = "";
      // 隐藏输入框
      const inputRow = document.querySelector('.meeting-create-row');
      if (inputRow) {
        inputRow.style.display = 'none';
      }
    }

    setMeetingStatus(`已成功创建会议：${meetingTitle}`, false);
  } catch (error) {
    console.error(error);
    setMeetingStatus(error.message || "创建会议失败", true);
  } finally {
    createMeetingConfirmBtn.disabled = false;
  }
}

// 渲染会议列表
function renderMeetings() {
  if (!meetingList) return;

  let meetings = [];

  // 根据过滤器获取会议
  switch (currentFilter) {
    case "upcoming":
      meetings = meetingManager.getUpcomingMeetings();
      break;
    case "ongoing":
      meetings = meetingManager.getOngoingMeetings();
      break;
    case "completed":
      meetings = meetingManager.getMeetingsByStatus("completed");
      break;
    default:
      meetings = meetingManager.getAllMeetings();
      break;
  }

  // 搜索过滤
  if (currentSearchKeyword) {
    meetings = meetings.filter(meeting =>
      meeting.title.toLowerCase().includes(currentSearchKeyword.toLowerCase()) ||
      meeting.description.toLowerCase().includes(currentSearchKeyword.toLowerCase())
    );
  }

  // 按开始时间排序（即将开始的在前）
  meetings.sort((a, b) => {
    if (a.status === "ongoing" && b.status !== "ongoing") return -1;
    if (b.status === "ongoing" && a.status !== "ongoing") return 1;
    return a.scheduledStart - b.scheduledStart;
  });

  meetingList.innerHTML = "";

  if (!meetings.length) {
    const filterName = getFilterDisplayName(currentFilter);
    meetingList.innerHTML = `
      <div style="padding:16px;color:#94a3b8;font-size:14px;text-align:center;">
        ${currentSearchKeyword ? `未找到包含"${currentSearchKeyword}"的${filterName}会议` : `暂无${filterName}会议，点击"+"创建会议`}
      </div>
    `;
    return;
  }

  meetings.forEach(meeting => {
    const card = document.createElement("div");
    card.className = `session-card ${meeting.id === currentMeetingId ? "active" : ""}`;

    const startTime = new Date(meeting.scheduledStart);
    const timeDisplay = startTime.toLocaleString();

    card.innerHTML = `
      <div class="session-avatar">📅</div>
      <div class="session-info">
        <div class="session-line-top">
          <span class="session-name">${escapeHtml(meeting.title)}</span>
          <span class="meeting-status ${meeting.getStatusClass()}">${meeting.getStatusText()}</span>
        </div>
        <div class="session-desc">${timeDisplay}</div>
        <div class="session-desc">${meeting.getParticipantCount()}人参与</div>
      </div>
    `;

    card.addEventListener("click", function () {
      currentMeetingId = meeting.id;
      renderMeetings();
      renderCurrentMeetingDetail();
    });

    meetingList.appendChild(card);
  });
}

// 获取过滤器显示名称
function getFilterDisplayName(filter) {
  switch (filter) {
    case "upcoming":
      return "即将开始的";
    case "ongoing":
      return "进行中的";
    case "completed":
      return "已结束的";
    default:
      return "";
  }
}

// 渲染当前会议详情
function renderCurrentMeetingDetail() {
  if (!meetingDetailArea) return;

  const currentMeeting = meetingManager.getMeeting(currentMeetingId);

  if (!currentMeeting) {
    meetingDetailTitle.textContent = "会议详情";
    meetingDetailSubtitle.textContent = "请选择左侧会议查看详情";
    meetingDetailArea.innerHTML = `
      <div style="color:#94a3b8;font-size:14px;">请选择左侧会议查看详情</div>
    `;
    return;
  }

  const currentUser = getStoredUser();
  const isOrganizer = currentMeeting.isOrganizer(currentUser?.userId);
  const participantCount = currentMeeting.getParticipantCount();

  meetingDetailTitle.textContent = currentMeeting.title;
  meetingDetailSubtitle.textContent = `${currentMeeting.getStatusText()} · ${participantCount}人 · ${isOrganizer ? '组织者' : '参与者'}`;

  // 模拟获取参与者信息（实际应用中应该从服务器获取）
  const mockParticipants = currentMeeting.participants.map(participantId => ({
    id: participantId,
    name: `用户${participantId.slice(-4)}`,
    role: currentMeeting.organizerId === participantId ? '组织者' : '参与者',
    avatar: participantId.slice(-1),
    status: 'offline' // 在实际应用中需要实时状态
  }));

  const startTime = new Date(currentMeeting.scheduledStart);
  const endTime = currentMeeting.scheduledEnd ? new Date(currentMeeting.scheduledEnd) : null;
  const actualStartTime = currentMeeting.actualStart ? new Date(currentMeeting.actualStart) : null;
  const actualEndTime = currentMeeting.actualEnd ? new Date(currentMeeting.actualEnd) : null;

  meetingDetailArea.innerHTML = `
    <div class="meeting-detail-card">
      <div class="meeting-stats">
        <div class="stat-item">
          <div class="stat-value">${participantCount}</div>
          <div class="stat-label">参与人数</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${currentMeeting.maxParticipants}</div>
          <div class="stat-label">最大容量</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${currentMeeting.agenda.length}</div>
          <div class="stat-label">议程项目</div>
        </div>
      </div>

      <div class="meeting-time-info">
        <div class="meeting-time-row">
          <span class="time-label">预定开始时间</span>
          <span class="time-value">${startTime.toLocaleString()}</span>
        </div>
        ${endTime ? `
        <div class="meeting-time-row">
          <span class="time-label">预定结束时间</span>
          <span class="time-value">${endTime.toLocaleString()}</span>
        </div>
        ` : ''}
        ${actualStartTime ? `
        <div class="meeting-time-row">
          <span class="time-label">实际开始时间</span>
          <span class="time-value">${actualStartTime.toLocaleString()}</span>
        </div>
        ` : ''}
        ${actualEndTime ? `
        <div class="meeting-time-row">
          <span class="time-label">实际结束时间</span>
          <span class="time-value">${actualEndTime.toLocaleString()}</span>
        </div>
        ` : ''}
      </div>

      <div class="meeting-detail-row">
        <div class="meeting-detail-label">会议主题</div>
        <div class="meeting-detail-value">${escapeHtml(currentMeeting.title)}</div>
      </div>

      <div class="meeting-detail-row">
        <div class="meeting-detail-label">会议描述</div>
        <div class="meeting-detail-value">${escapeHtml(currentMeeting.description || "暂无描述")}</div>
      </div>

      <div class="meeting-detail-row">
        <div class="meeting-detail-label">会议状态</div>
        <div class="meeting-detail-value">
          <span class="meeting-status ${currentMeeting.getStatusClass()}">${currentMeeting.getStatusText()}</span>
        </div>
      </div>

      <div class="meeting-detail-row">
        <div class="meeting-detail-label">参与者列表</div>
        <div class="meeting-detail-value">
          <div class="meeting-participants">
            ${mockParticipants.map(participant => `
              <div class="meeting-participant-item">
                <div class="participant-avatar">${escapeHtml(participant.avatar)}</div>
                <div class="participant-info">
                  <div class="participant-name">${escapeHtml(participant.name)}</div>
                  <div class="participant-role">${participant.role}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <div class="meeting-action-row">
        ${currentMeeting.status === 'scheduled' && isOrganizer ? `
          <button class="meeting-action-btn secondary" id="startMeetingBtn" type="button">开始会议</button>
          <button class="meeting-action-btn primary" id="joinMeetingBtn" type="button">加入会议</button>
        ` : currentMeeting.status === 'ongoing' ? `
          <button class="meeting-action-btn primary" id="joinMeetingBtn" type="button">加入会议</button>
          ${isOrganizer ? `<button class="meeting-action-btn danger" id="endMeetingBtn" type="button">结束会议</button>` : ''}
        ` : `
          <button class="meeting-action-btn secondary" id="viewRecordingBtn" type="button">查看录像</button>
          <button class="meeting-action-btn primary" id="scheduleAgainBtn" type="button">再次预约</button>
        `}
      </div>
    </div>
  `;

  // 绑定会议操作按钮事件
  bindMeetingActionButtons(currentMeeting, isOrganizer);
}

// 绑定会议操作按钮事件
function bindMeetingActionButtons(meeting, isOrganizer) {
  const startMeetingBtn = document.getElementById("startMeetingBtn");
  const joinMeetingBtn = document.getElementById("joinMeetingBtn");
  const endMeetingBtn = document.getElementById("endMeetingBtn");
  const viewRecordingBtn = document.getElementById("viewRecordingBtn");
  const scheduleAgainBtn = document.getElementById("scheduleAgainBtn");

  const currentUser = getStoredUser();

  if (startMeetingBtn && startMeetingBtn.addEventListener) {
    startMeetingBtn.addEventListener("click", function () {
      if (meetingManager.startMeeting(meeting.id, currentUser?.userId)) {
        renderMeetings();
        renderCurrentMeetingDetail();
        setMeetingStatus("会议已开始", false);
      } else {
        setMeetingStatus("开始会议失败", true);
      }
    });
  }

  if (joinMeetingBtn && joinMeetingBtn.addEventListener) {
    joinMeetingBtn.addEventListener("click", function () {
      // 跳转到会议页面
      setMeetingStatus("正在加入会议...", false);
      // TODO: 实现加入会议逻辑
      setTimeout(() => {
        setMeetingStatus("会议功能开发中", false);
      }, 1000);
    });
  }

  if (endMeetingBtn && endMeetingBtn.addEventListener) {
    endMeetingBtn.addEventListener("click", function () {
      if (meetingManager.endMeeting(meeting.id, currentUser?.userId)) {
        renderMeetings();
        renderCurrentMeetingDetail();
        setMeetingStatus("会议已结束", false);
      } else {
        setMeetingStatus("结束会议失败", true);
      }
    });
  }

  if (viewRecordingBtn && viewRecordingBtn.addEventListener) {
    viewRecordingBtn.addEventListener("click", function () {
      setMeetingStatus("录像功能开发中", false);
    });
  }

  if (scheduleAgainBtn && scheduleAgainBtn.addEventListener) {
    scheduleAgainBtn.addEventListener("click", function () {
      setMeetingStatus("再次预约功能开发中", false);
    });
  }
}

// 设置会议状态消息
function setMeetingStatus(message, isError) {
  if (!meetingStatusMsg) return;
  meetingStatusMsg.textContent = message;
  meetingStatusMsg.style.color = isError ? "#f87171" : "#94a3b8";
}

// 导出函数供其他模块使用
window.initMeetingsPage = initMeetingsPage;
window.renderMeetings = renderMeetings;
window.renderCurrentMeetingDetail = renderCurrentMeetingDetail;