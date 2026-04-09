# API 接口规划 

## 认证与用户 
- `POST /api/v1/auth/register`: 用户注册（分配泡利私钥）
- `POST /api/v1/auth/login`: 用户登录

## 社交与会话 
- `GET /api/v1/friends`: 获取好友列表
- `POST /api/v1/conversations`: 创建私聊/群聊会话（触发 QKE）

## 消息加密 
- `POST /api/v1/messages/p2p`: 发送私聊消息（AES-GCM 加密）
- `GET /api/v1/messages/history`: 获取历史加密消息

## 管理端接口 
- `GET /api/admin/sessions`: 获取所有 QKE 会话
- `GET /api/admin/sessions/{id}/snapshot`: 获取会话实时快照
- `WS /api/admin/ws/events`: QKE 事件流实时推送
