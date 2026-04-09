# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在本仓库中工作时提供指导。

## 项目概述

QKE-Viz 是面向 2026 年（第 19 届）中国大学生计算机设计大赛（4C）的量子安全通讯平台。系统将基于 Qiskit 的量子密钥协商（QKE）引擎与即时通讯系统相结合。架构：一个统一 FastAPI 后端 + 两个 React 前端（用户聊天端 + 管理监控端）+ 一个 QKE 引擎。

代码注释、模型名称和 API 描述主要使用中文。

## 常用命令

### 后端（Python, FastAPI）
```bash
cd backend
pip install -r requirements.txt
python main.py                  # 开发服务器 :8000（自动创建数据库表）
python init_db.py               # 手动创建所有数据库表
alembic upgrade head            # 生产环境数据库迁移
```

### 用户端前端（React, 端口 3001）
```bash
cd user-frontend
npm install
npm run dev                     # 代理 /api → :8000, /ws → ws://:8000
npm run build                   # tsc && vite build
```

### 管理端前端（React, 端口 3000）
```bash
cd admin-frontend
npm install
npm run dev                     # 代理 /api → :8000
npm run build                   # tsc && vite build
```

### 测试
```bash
pytest                                          # 运行全部测试
pytest tests/test_qke_engine.py                 # 运行单个测试文件
pytest tests/test_security_service.py -k "test_encrypt"  # 运行单个测试用例
```
测试使用 SQLite 内存数据库、`httpx.AsyncClient` + `ASGITransport`，每个会话自动创建/删除表。

### Docker（全栈部署）
```bash
cp .env.example .env
docker-compose up               # 启动后端、两个前端、PostgreSQL、Redis、Prometheus、Grafana
```

## 架构

### 双 API 层

- **Legacy API**（`/api/session/*`）：原始 QKE 仿真端点（创建会话、运行协议）。已标记废弃但仍可用。
- **V1 API**（`/api/v1/*`）：正式业务 API，包含子路由：
  - `/v1/auth` — 注册（分配 Pauli 私钥）、登录（JWT）
  - `/v1/chat` — 通过 WebSocket 加密通讯
  - `/v1/admin/*` — 仪表盘、QKE 会话管理、用户管理、分析、统计

### QKE 引擎（`backend/app/services/qke_engine/`）

四层设计，严格分离：
1. **`qke_interface.py`** — 抽象基类 `QKEEngineInterface`，定义类型化数据类（`SessionHandle`、`KeyMaterialHandle`、`ProtocolResult`、`ProtocolEvent`）
2. **`qke_core.py`** — 纯协议逻辑（`QuantumCore` + `QKEProtocol`）：领导者选举、GHZ-4/3/Bell 态协议、诱饵态插入、QBER/熵值计算。无框架依赖。
3. **`qke_backend.py`** — 后端抽象（`QuantumBackend` ABC），默认实现 `LocalSimulatorBackend`
4. **`qke_adapter.py`** — 适配器 + 工厂（`create_qke_engine()`）

协议按参与者人数选择：2人 → Bell、3人 → GHZ-3、4人及以上 → 领导者选举 + GHZ-4 QKA + 动态 QKD。

### 安全与密钥派生

`app/core/security.py` 提供 AES-256-GCM 加密，`app/services/security_service.py` 提供：
- JWT（HS256）认证，过期时间可配置
- PBKDF2-HMAC-SHA256 密码哈希（120k 迭代）
- 密钥派生链：QKE 共享密钥 → HKDF → epoch 密钥 → 消息密钥（AES-GCM）
- 句柄式安全设计：API 不暴露原始密钥材料，使用指纹和不透明句柄

### 数据库模型

`backend/app/models/` 下三个模型文件：
- `models.py` — Legacy QKE 表（Session, Participant, QKDRound）
- `v1_models.py` — V1 业务模型（User, Conversation, Message, QKESession, QKERound, QKEEvent, KeyEpoch, SecurityAlert, AuditLog 等）
- `quantum.py` — 量子分析专用模型

数据库引擎在 `models/__init__.py` 中通过 `create_engine()` 创建。开发环境用 SQLite（`./database.db`），生产环境用 PostgreSQL。开发模式启动时自动建表。

### 服务层（`backend/app/services/`）

- `qke_service.py` — 业务编排：会话 → 参与者 → QKE 协商 → 密钥周期
- `security_service.py` — 统一密码学操作（JWT, AES-GCM, HKDF, 密钥指纹）
- `event_service.py` — 发布/订阅事件系统，通过 WebSocket 广播到管理端并持久化到数据库
- `key_management_service.py` — 密钥生命周期：激活、轮换、过期、撤销、熵值分析
- `chat_service.py` — 消息处理
- `auth_service.py` — 用户认证

### WebSocket 端点

- `/ws/user` — 用户端实时聊天消息
- `/ws/admin/realtime` — 管理端实时监控
- `/ws/admin/page2/{qke_session_id}` — QKE 会话事件流
- `/api/admin/ws/sessions/{id}/events` — Legacy 管理端事件流

### 前端架构

**用户端**（`user-frontend/src/`）：React 18 + TypeScript + Zustand 状态管理 + TailwindCSS。路径别名 `@` → `./src`。同时存在旧版静态 HTML 页面（根目录）和现代 React SPA。核心 Store：`authStore`、`chatStore`、`contactsStore`、`groupsStore`、`meetingsStore`、`filesStore`、`uiStore`。

**管理端**（`admin-frontend/src/`）：React 18 + TypeScript + Zustand + ECharts + Three.js + D3 + TailwindCSS。六个面板：Dashboard、KeyManagement、Performance、RiskAlert、SystemConfig。通过 `services/api.ts` 发起 REST 请求，`hooks/useRealtime.ts` 接入 WebSocket。

## 关键约定

- **配置优先级**：环境变量 > YAML/JSON 配置文件 > 默认值。通过 `ConfigManager` 单例读取 `APP_*` 环境变量。
- **Legacy 响应清洗**：Legacy 运行端点会剥离 `private_key`、`shared_key`、`final_key`，仅返回密钥指纹。
- **CORS**：当 origins 包含 `*` 时 `allow_credentials=false`。
- **事件格式**：所有 QKE 事件遵循统一结构：`{event_id, timestamp, event_type, session_id, conversation_id, severity, title, description, payload}`。
- **无恶意节点模型**：系统通过诱饵态和 QBER 检测窃听，但不再模拟攻击者角色（malicious/HBC 节点已移除）。
